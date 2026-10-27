/**
 * Vérification des factures mensuelles des propriétaires (pur, sans réseau) :
 * prolongations regroupées (un séjour, un ménage), commission sur la base
 * nette au taux du mandat, prorata d'un mois à l'autre, numérotation à la
 * suite et jamais réutilisée, mention « art. 293 B » ou TVA de l'espace,
 * identité de chaque espace (jamais celle de Label Maison ailleurs), mêmes
 * montants que le bilan, brouillon unique par mois (passage planifié
 * idempotent), facture figée une fois validée, vue du propriétaire.
 *
 * Données fictives (« Bel Appartement », voyageur « Dylan »).
 *
 * Lancement :
 *   node_modules/.bin/esbuild src/erp/data/verifier-factures.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-factures.mjs \
 *     && node /tmp/verifier-factures.mjs
 */
import { ID_LABEL_MAISON } from './espaces';
import {
  COLLECTION_PASSAGES_FACTURES,
  DELAI_PAIEMENT_JOURS,
  ajouterAjustement,
  brouillonsDuMois,
  calculerFactureMois,
  compteurFactures,
  documentDeFacture,
  documentDeFactureVue,
  ecarterBrouillon,
  factureFigee,
  idFactureMensuelle,
  memesMontantsQueLeBilan,
  moisSansFacture,
  passageFacturesMensuelles,
  preparerBrouillon,
  prochainNumero,
  retirerAjustement,
  totalCode,
  validerFacture,
  type BasePassageFactures,
} from './factures-mensuelles';
import {
  IDENTITE_LABEL_MAISON,
  MENTION_FRANCHISE_TVA,
  erreursIdentite,
  identiteComplete,
  identiteConciergerie,
  ligneLegale,
  normaliserIdentite,
  reglageSociete,
  tauxTva,
} from './identite-conciergerie';
import { bilanMensuel, ficheLogement, vueProprietaire } from './proprietaire';
import { facturesVue, partagerFacture, planifierRelances, REGLAGES_RELANCES_DEFAUT } from './relances';
import { consoliderSejours, memeVoyageur } from './sejours-consolides';
import { ENTREPRISE_LIGNE } from '../modules/finance/_composants/entreprise';
import type { CompteurFactures, Facture, IdentiteSociete, Logement, Mandat, Proprietaire, Reglage, Reservation } from './types';

let ok = 0;
let ko = 0;
function verifier(condition: boolean, libelle: string) {
  if (condition) ok++;
  else {
    ko++;
    console.log(`  ✗ ${libelle}`);
  }
}

/* -------------------------------------------------------------- données */

const SENS = { id: '5e5e0000-0000-4000-8000-000000000002', nom: 'Sens Conciergerie' };
const LM = { id: ID_LABEL_MAISON, nom: 'Label Maison' };

const proprietaire = (id: string, nom: string, adresse = '3 rue des Lilas, 91000 Évry'): Proprietaire => ({
  id,
  type: 'particulier',
  nom,
  contact: { email: `${id}@exemple.invalid`, telephone: '' },
  adresse,
  notes: '',
  creeLe: '2026-01-01',
});

const logement = (id: string, nom: string, proprietaireId: string): Logement =>
  ({ id, nom, ville: 'Évry', statut: 'actif', proprietaireId, capacite: 4, chambres: 2, annonces: [], checklistLancement: [] }) as unknown as Logement;

const mandat = (id: string, proprietaireId: string, logementId: string, commissionPct: number): Mandat => ({
  id,
  proprietaireId,
  logementId,
  reference: id,
  statut: 'signe',
  commissionPct,
  fraisMenageCentimes: 6_000,
  dateDebut: '2026-01-01',
  preavisJours: 30,
});

let n = 0;
const resa = (logementId: string, arrivee: string, depart: string, o: Partial<Reservation> = {}): Reservation => ({
  id: `r-${String(++n).padStart(3, '0')}`,
  logementId,
  canal: 'airbnb',
  voyageur: { nom: 'Dylan Roux', nbPersonnes: 2 },
  arrivee,
  depart,
  nuits: Math.round((Date.parse(depart) - Date.parse(arrivee)) / 86_400_000),
  statut: 'terminee',
  montantBrutCentimes: 50_000,
  commissionPlateformeCentimes: 7_500,
  fraisMenageCentimes: 6_000,
  ...o,
});

const P = 'pro-bel';
const Q = 'pro-autre';
const donnees = {
  proprietaires: [proprietaire(P, 'Camille Bernard'), proprietaire(Q, 'Hugo Petit')],
  logements: [logement('log-bel', 'Bel Appartement', P), logement('log-jardin', 'Studio Jardin', P), logement('log-q', 'Maison Q', Q)],
  mandats: [mandat('m-bel', P, 'log-bel', 20), mandat('m-jardin', P, 'log-jardin', 25), mandat('m-q', Q, 'log-q', 18)],
  reservations: [
    // Bel Appartement : Dylan, 5 → 8 sept., prolongé 8 → 10 sept. (deux réservations, un séjour, un ménage).
    resa('log-bel', '2026-09-05', '2026-09-08', { montantBrutCentimes: 60_000, commissionPlateformeCentimes: 9_000, fraisMenageCentimes: 6_000 }),
    resa('log-bel', '2026-09-08', '2026-09-10', { montantBrutCentimes: 40_000, commissionPlateformeCentimes: 6_000, fraisMenageCentimes: 6_000, canal: 'airbnb' }),
    // Puis une autre voyageuse le jour même du départ : un autre séjour, un autre ménage.
    resa('log-bel', '2026-09-10', '2026-09-12', { voyageur: { nom: 'Inès Morel', nbPersonnes: 1 }, canal: 'booking', montantBrutCentimes: 30_000, commissionPlateformeCentimes: 4_500, fraisMenageCentimes: 5_000 }),
    // À cheval sur septembre et octobre (3 nuits en septembre sur 4).
    resa('log-bel', '2026-09-28', '2026-10-02', { voyageur: { nom: 'Léa Garnier', nbPersonnes: 2 }, montantBrutCentimes: 80_000, commissionPlateformeCentimes: 12_000, fraisMenageCentimes: 8_000 }),
    // Prolongation à cheval : Dylan, 28 oct. → 1er nov., prolongé 1er → 4 nov.
    resa('log-bel', '2026-10-28', '2026-11-01', { montantBrutCentimes: 40_000, commissionPlateformeCentimes: 6_000, fraisMenageCentimes: 7_000 }),
    resa('log-bel', '2026-11-01', '2026-11-04', { montantBrutCentimes: 30_000, commissionPlateformeCentimes: 4_500, fraisMenageCentimes: 7_000 }),
    // Studio Jardin (25 %) : un séjour, et une réservation annulée.
    resa('log-jardin', '2026-09-15', '2026-09-18', { voyageur: { nom: 'Noah Lambert', nbPersonnes: 2 }, montantBrutCentimes: 45_000, commissionPlateformeCentimes: 0, fraisMenageCentimes: 4_000, canal: 'direct' }),
    resa('log-jardin', '2026-09-18', '2026-09-20', { voyageur: { nom: 'Noah Lambert', nbPersonnes: 2 }, statut: 'annulee' }),
    // Un autre propriétaire : jamais sur la facture de P.
    resa('log-q', '2026-09-03', '2026-09-06', { voyageur: { nom: 'Zoé Interdite', nbPersonnes: 2 }, montantBrutCentimes: 999_900 }),
  ],
  factures: [] as Facture[],
};

const auj = '2026-10-03';
const maintenant = '2026-10-03T09:00:00.000Z';
const identiteSens: IdentiteSociete = normaliserIdentite({ raisonSociale: 'Sens Conciergerie', forme: 'SARL', siret: '12345678900011', adresse: '2 place du Marché, 89100 Sens', regimeTva: 'tva', tvaPct: 20 });

async function main() {
  /* ------------------------------------------------- prolongations */
  {
    const a = resa('L', '2026-09-01', '2026-09-03');
    const b = resa('L', '2026-09-03', '2026-09-05');
    const deux = consoliderSejours([b, a]);
    verifier(deux.length === 1 && deux[0].arrivee === '2026-09-01' && deux[0].depart === '2026-09-05' && deux[0].reservations.join() === `${a.id},${b.id}`, 'prolongation : 2 réservations qui se suivent, même voyageur → 1 séjour');
    verifier(deux[0].fraisMenageCentimes === 6_000 && deux[0].montantBrutCentimes === 100_000 && deux[0].commissionPlateformeCentimes === 15_000 && deux[0].nuits === 4, 'prolongation : montants additionnés, UN ménage');
    const autre = resa('L', '2026-09-03', '2026-09-05', { voyageur: { nom: 'Inès Morel', nbPersonnes: 1 } });
    verifier(consoliderSejours([a, autre]).length === 2, 'voyageurs différents → 2 séjours, 2 ménages');
    verifier(consoliderSejours([a, resa('L2', '2026-09-03', '2026-09-05')]).length === 2, 'autre logement → 2 séjours');
    verifier(consoliderSejours([a, resa('L', '2026-09-04', '2026-09-06')]).length === 2, 'un jour d’écart → 2 séjours');
    verifier(memeVoyageur(a, resa('L', 'x', 'y', { voyageur: { nom: '  dylan  ROUX ', nbPersonnes: 1 } })), 'même voyageur : majuscules et espaces ignorés');
    verifier(memeVoyageur({ voyageur: { nom: 'Zoé Léger', nbPersonnes: 1 } }, { voyageur: { nom: 'Zoe Leger', nbPersonnes: 1 } }), 'même voyageur : accents ignorés');
    verifier(!memeVoyageur({ voyageur: { nom: 'Guest', nbPersonnes: 1 } }, { voyageur: { nom: 'guest', nbPersonnes: 1 } }) && !memeVoyageur({ voyageur: { nom: '', nbPersonnes: 1 } }, { voyageur: { nom: '', nbPersonnes: 1 } }), 'nom générique ou vide : jamais regroupé');
    verifier(
      !memeVoyageur({ voyageur: { nom: 'Dylan Roux', nbPersonnes: 1 }, repull: { id: '1', voyageurId: 'g1' } }, { voyageur: { nom: 'Dylan Roux', nbPersonnes: 1 }, repull: { id: '2', voyageurId: 'g2' } }) &&
        memeVoyageur({ voyageur: { nom: 'Dylan R.', nbPersonnes: 1 }, repull: { id: '1', voyageurId: 'g1' } }, { voyageur: { nom: 'D. Roux', nbPersonnes: 1 }, repull: { id: '2', voyageurId: 'g1' } }),
      'identifiants du voyageur chez la plateforme : ils décident quand les deux en ont',
    );
    verifier(consoliderSejours([a, resa('L', '2026-09-03', '2026-09-05', { statut: 'annulee' })]).length === 2, 'réservation annulée : jamais regroupée');
    const trois = consoliderSejours([a, b, resa('L', '2026-09-05', '2026-09-06')]);
    verifier(trois.length === 1 && trois[0].reservations.length === 3, 'deux prolongations de suite → toujours 1 séjour');
  }

  /* ------------------------------------------- bilan et facture de septembre */
  const sept = bilanMensuel(donnees, P, '2026-09');
  const c = calculerFactureMois(donnees, P, '2026-09');
  const dylan = sept.sejours.find((s) => s.arrivee === '2026-09-05')!;
  verifier(!!dylan && dylan.depart === '2026-09-10' && dylan.prolongations === 1 && dylan.menage === 6_000, 'bilan : la prolongation de Dylan = un séjour, un ménage');
  verifier(sept.sejours.filter((s) => s.logementId === 'log-bel').length === 3 && sept.totaux.sejours === 4, 'bilan : Dylan (prolongé), Inès, Léa et le Studio Jardin (annulé exclu)');
  // Commission Dylan : (100 000 − 15 000 − 6 000) × 20 % = 15 800 (un seul ménage dans la base).
  verifier(dylan.commission === 15_800, 'commission sur la base nette : (encaissé − plateformes − UN ménage) × taux du mandat');
  const lea = sept.sejours.find((s) => s.arrivee === '2026-09-28')!;
  // Léa : (80 000 − 12 000 − 8 000) × 20 % = 12 000, dont 3 nuits sur 4 en septembre.
  verifier(lea.nuits === 3 && lea.commission === 9_000 && lea.menage === 6_000, 'prorata : 3 nuits sur 4 en septembre (commission et ménage)');
  const commissionBel = c.lignes.find((l) => l.code === 'commission' && l.libelle.includes('Bel Appartement'))!;
  const commissionJardin = c.lignes.find((l) => l.code === 'commission' && l.libelle.includes('Studio Jardin'))!;
  verifier(!!commissionBel && commissionBel.puCentimes === sept.logements.find((l) => l.logementId === 'log-bel')!.commission, 'facture : commission du Bel Appartement = celle du bilan');
  // Studio Jardin, 25 % : (45 000 − 0 − 4 000) × 25 % = 10 250.
  verifier(!!commissionJardin && commissionJardin.puCentimes === 10_250 && /^25 % de /.test(commissionJardin.detail ?? ''), 'facture : chaque logement à son taux de mandat (25 %), base et taux en clair');
  const menages = c.lignes.filter((l) => l.code === 'menage');
  verifier(menages.length === 4 && menages.filter((l) => /Dylan R\./.test(l.detail ?? '')).length === 1, 'facture : un ménage par séjour, un seul pour Dylan prolongé');
  verifier(/prolongation comprise/.test(menages.find((l) => /Dylan/.test(l.detail ?? ''))!.detail!) && /3 nuits sur 4 ce mois-ci/.test(menages.find((l) => /Léa/.test(l.detail ?? ''))!.detail!), 'facture : prolongation et prorata dits sur la ligne');
  verifier(c.commission === sept.totaux.commission && c.menage === sept.totaux.menage, 'facture et bilan : même commission et mêmes ménages');
  verifier(totalCode(c.lignes, 'commission') === sept.totaux.commission && totalCode(c.lignes, 'menage') === sept.totaux.menage, 'lignes de la facture = totaux du bilan, au centime');
  verifier(!JSON.stringify(c).includes('Zoé') && !JSON.stringify(c).includes('999') && !c.logements.includes('Maison Q'), 'facture : rien d’un autre propriétaire');
  verifier(!JSON.stringify(c.lignes).includes('Roux'), 'facture : voyageur en « Prénom N. » seulement');

  /* prolongation à cheval sur deux mois : un seul ménage au total */
  {
    const oct = bilanMensuel(donnees, P, '2026-10');
    const nov = bilanMensuel(donnees, P, '2026-11');
    const so = oct.sejours.find((s) => s.arrivee === '2026-10-28')!;
    const sn = nov.sejours.find((s) => s.arrivee === '2026-10-28')!;
    verifier(!!so && !!sn && so.nuitsSejour === 7 && so.nuits === 4 && sn.nuits === 3, 'prolongation à cheval : 4 nuits en octobre, 3 en novembre, sur un séjour de 7');
    verifier(so.menage + sn.menage === 7_000, 'prolongation à cheval : octobre + novembre = UN ménage');
    const cOct = calculerFactureMois(donnees, P, '2026-10');
    const cNov = calculerFactureMois(donnees, P, '2026-11');
    verifier(memesMontantsQueLeBilan(oct, { lignes: cOct.lignes }) && memesMontantsQueLeBilan(nov, { lignes: cNov.lignes }), 'octobre et novembre : facture = bilan');
    // Léa (28 sept. → 2 oct.) : septembre + octobre = séjour entier.
    const leaOct = oct.sejours.find((s) => s.arrivee === '2026-09-28')!;
    verifier(leaOct.commission + lea.commission === 12_000 && leaOct.menage + lea.menage === 8_000, 'prorata : septembre + octobre = séjour entier');
  }

  /* fiche « Mes logements » : mêmes montants que le bilan */
  {
    const f = ficheLogement(donnees, 'log-bel', '2026-12-05', { proprietaireId: P, logement: donnees.logements[0] });
    const s = f.mois.find((m) => m.mois === '2026-09')!;
    const b = sept.logements.find((l) => l.logementId === 'log-bel')!;
    verifier(s.net === b.net && s.sejours === 3, 'fiche du logement : prolongation comptée une fois, même net que le bilan');
  }

  /* sans mandat à ce propriétaire : pas de commission */
  {
    const sans = { ...donnees, mandats: donnees.mandats.filter((m) => m.id !== 'm-jardin') };
    const x = calculerFactureMois(sans, P, '2026-09');
    verifier(x.sansTaux.join() === 'Studio Jardin' && !x.lignes.some((l) => l.code === 'commission' && l.libelle.includes('Studio Jardin')), 'logement sans mandat : pas de commission, signalé au gérant');
  }

  /* ---------------------------------------------------- identité par espace */
  {
    const lm = identiteConciergerie({ reglages: [] }, LM);
    verifier(!lm.enregistree && lm.raisonSociale === IDENTITE_LABEL_MAISON.raisonSociale && lm.regimeTva === 'franchise' && identiteComplete(lm), 'Label Maison : son identité d’avant, franchise en base par défaut');
    verifier(ligneLegale(IDENTITE_LABEL_MAISON) === ENTREPRISE_LIGNE, 'Label Maison : même ligne légale qu’avant');
    const sens = identiteConciergerie({ reglages: [] }, SENS);
    verifier(sens.raisonSociale === 'Sens Conciergerie' && !sens.siret && !identiteComplete(sens) && !JSON.stringify(sens).includes('Label Maison') && !JSON.stringify(sens).includes('993'), 'autre espace sans réglage : son nom seul, rien de Label Maison');
    const copieLM = reglageSociete(IDENTITE_LABEL_MAISON, { maintenant, par: 'x' });
    const sensCopie = identiteConciergerie({ reglages: [copieLM] }, SENS);
    verifier(!sensCopie.enregistree && !sensCopie.siret && sensCopie.raisonSociale === 'Sens Conciergerie', 'autre espace avec l’identité de Label Maison (sauvegarde rechargée) : ignorée');
    const sensEnregistree = identiteConciergerie({ reglages: [reglageSociete(identiteSens, { maintenant, par: 'x' })] }, SENS);
    verifier(sensEnregistree.enregistree && sensEnregistree.siret === '123 456 789 00011' && sensEnregistree.regimeTva === 'tva', 'autre espace : son identité enregistrée');
    verifier(identiteConciergerie({ reglages: [copieLM] }, LM).enregistree, 'Label Maison : son identité enregistrée reste la sienne');
    const err = erreursIdentite({ raisonSociale: '', siret: '123', adresse: '', regimeTva: 'tva', numeroTva: '??', tvaPct: 0 });
    verifier(!!err.raisonSociale && !!err.siret && !!err.adresse && !!err.numeroTva && !!err.tvaPct, 'identité : champs manquants ou illisibles signalés');
    // Bilan imprimé : ligne légale de SON espace.
    const e = { ...donnees, documentsProprietaire: [], bilansProprietaire: [] };
    const vSens = vueProprietaire({ ...e, reglages: [] }, P, { aujourdhui: auj, conciergerie: { nom: SENS.nom, espace: SENS.id } })!;
    const vSensCopie = vueProprietaire({ ...e, reglages: [copieLM] }, P, { aujourdhui: auj, conciergerie: { nom: SENS.nom, espace: SENS.id } })!;
    const vSensOk = vueProprietaire({ ...e, reglages: [reglageSociete(identiteSens, { maintenant, par: 'x' })] }, P, { aujourdhui: auj, conciergerie: { nom: SENS.nom, espace: SENS.id } })!;
    verifier(!vSens.conciergerie.ligneLegale && !vSensCopie.conciergerie.ligneLegale && /^Sens Conciergerie SARL · SIRET 123 456 789 00011/.test(vSensOk.conciergerie.ligneLegale ?? ''), 'bilan imprimé : jamais la ligne légale de Label Maison pour un autre espace');
  }

  /* ------------------------------------------------- TVA : 293 B ou taux */
  const brouillon = preparerBrouillon({ donnees, proprietaireId: P, mois: '2026-09', identite: IDENTITE_LABEL_MAISON, aujourdhui: auj, maintenant, par: 'automatique' })!;
  verifier(!!brouillon && brouillon.id === idFactureMensuelle(P, '2026-09') && brouillon.statut === 'brouillon' && brouillon.numero === '', 'brouillon : sans numéro, id du propriétaire et du mois');
  {
    const doc = documentDeFacture(brouillon, { identite: IDENTITE_LABEL_MAISON, proprietaire: donnees.proprietaires[0], logements: c.logements })!;
    verifier(doc.brouillon && doc.tvaPct === 0 && doc.tva === 0 && doc.totalTtc === doc.totalHt && doc.mentionTva === MENTION_FRANCHISE_TVA, 'franchise en base : TVA 0 et « TVA non applicable, art. 293 B du CGI »');
    const docTva = documentDeFacture(brouillon, { identite: identiteSens, proprietaire: donnees.proprietaires[0], logements: c.logements })!;
    verifier(docTva.tvaPct === 20 && docTva.tva === Math.round(docTva.totalHt * 0.2) && docTva.totalTtc === docTva.totalHt + docTva.tva && !docTva.mentionTva, 'régime TVA : TVA 20 % calculée, sans mention 293 B');
    verifier(tauxTva({ regimeTva: 'tva', tvaPct: 10 }) === 10 && tauxTva({ regimeTva: 'franchise', tvaPct: 20 }) === 0, 'taux : celui du régime de l’espace, jamais écrit en dur');
    verifier(doc.periode.du === '2026-09-01' && doc.periode.au === '2026-09-30' && doc.client.nom === 'Camille Bernard' && doc.logements.join() === 'Bel Appartement,Studio Jardin', 'document : période du mois, propriétaire, logements');
  }

  /* --------------------------------------------- ajustements, puis validation */
  const aj = ajouterAjustement(brouillon, { libelle: 'Remplacement d’une ampoule', montantCentimes: 1_200, motif: 'Ampoule du salon grillée' }, { id: 'aj-1', maintenant, par: 'gerant@exemple.invalid' });
  verifier(aj.ok && aj.facture.lignes.filter((l) => l.code === 'ajustement').length === 1 && aj.facture.montantHtCentimes === brouillon.montantHtCentimes + 1_200, 'ajustement : une ligne avec sa raison, comptée dans le total');
  verifier(!ajouterAjustement(brouillon, { libelle: 'Geste', montantCentimes: -500, motif: '' }, { id: 'aj-2', maintenant, par: 'g' }).ok, 'ajustement sans raison : refusé');
  verifier(!ajouterAjustement(brouillon, { libelle: 'Rien', montantCentimes: 0, motif: 'x' }, { id: 'aj-3', maintenant, par: 'g' }).ok, 'ajustement à 0 € : refusé');
  const avecAj = aj.ok ? aj.facture : brouillon;
  verifier(memesMontantsQueLeBilan(sept, avecAj), 'ajustement : commission et ménages restent ceux du bilan');
  const retire = retirerAjustement(avecAj, 'aj-1');
  verifier(retire.ok && retire.facture.montantHtCentimes === brouillon.montantHtCentimes, 'ajustement retiré');

  const espaceFactures: Facture[] = [
    // Ancienne série (module Finance) : n'entre pas dans la numérotation « AAAA-NNNN ».
    { id: 'old', numero: 'LM-2026-0041', type: 'commission', destinataire: 'proprietaire', proprietaireId: P, dateEmission: '2026-08-05', echeance: '2026-08-20', montantHtCentimes: 1, tvaPct: 20, statut: 'payee', lignes: [] },
    avecAj,
  ];
  const v1 = validerFacture({ facture: avecAj, donnees, factures: espaceFactures, proprietaire: donnees.proprietaires[0], identite: IDENTITE_LABEL_MAISON, aujourdhui: auj, maintenant, par: 'gerant@exemple.invalid' });
  verifier(v1.ok, 'validation du brouillon');
  if (!v1.ok) throw new Error(v1.erreur);
  const f1 = v1.facture;
  verifier(f1.numero === '2026-0001' && f1.statut === 'emise' && f1.dateEmission === auj && f1.echeance === '2026-10-18' && DELAI_PAIEMENT_JOURS === 15, 'validation : numéro 2026-0001 attribué, émise aujourd’hui, échéance à 15 jours');
  verifier(f1.tvaPct === 0 && f1.mensuelle!.mentionTva === MENTION_FRANCHISE_TVA && f1.mensuelle!.emetteur!.siret === IDENTITE_LABEL_MAISON.siret, 'validation : identité et mention de TVA figées');
  verifier(f1.mensuelle!.client!.nom === 'Camille Bernard' && f1.mensuelle!.client!.adresse === '3 rue des Lilas, 91000 Évry' && f1.mensuelle!.ajustements.length === 1, 'validation : propriétaire et ajustement figés');
  verifier(memesMontantsQueLeBilan(sept, f1), 'facture validée : même commission et mêmes ménages que le bilan du mois');
  verifier(factureFigee(f1) && !ajouterAjustement(f1, { libelle: 'x', montantCentimes: 100, motif: 'y' }, { id: 'z', maintenant, par: 'g' }).ok && !retirerAjustement(f1, 'aj-1').ok, 'facture validée : plus aucun ajustement');
  const encore = validerFacture({ facture: f1, donnees, factures: [f1], proprietaire: donnees.proprietaires[0], identite: IDENTITE_LABEL_MAISON, aujourdhui: auj, maintenant, par: 'g' });
  verifier(!encore.ok, 'facture validée : ne se valide pas deux fois');
  verifier(preparerBrouillon({ donnees, proprietaireId: P, mois: '2026-09', existante: f1, identite: IDENTITE_LABEL_MAISON, aujourdhui: auj, maintenant, par: 'automatique' }) === null && ecarterBrouillon(f1) === null, 'facture validée : jamais recalculée ni écartée');
  // Données changées après validation : la facture validée ne bouge pas.
  const plusTard = { ...donnees, reservations: [...donnees.reservations, resa('log-bel', '2026-09-20', '2026-09-22', { voyageur: { nom: 'Tard Venu', nbPersonnes: 1 } })] };
  const docFige = documentDeFacture(f1)!;
  verifier(!docFige.brouillon && docFige.numero === '2026-0001' && docFige.totalHt === f1.montantHtCentimes && calculerFactureMois(plusTard, P, '2026-09').menage !== totalCode(f1.lignes, 'menage'), 'facture validée : figée, même si les séjours changent ensuite');

  /* ----------------------------------------------------------- numérotation */
  {
    let compteur: CompteurFactures = v1.compteur;
    verifier(compteur.derniers['2026'] === 1, 'compteur : dernier numéro de l’année gardé');
    const bQ = preparerBrouillon({ donnees, proprietaireId: Q, mois: '2026-09', identite: IDENTITE_LABEL_MAISON, aujourdhui: auj, maintenant, par: 'g' })!;
    const v2 = validerFacture({ facture: bQ, donnees, factures: [...espaceFactures, f1, bQ], compteur, proprietaire: donnees.proprietaires[1], identite: IDENTITE_LABEL_MAISON, aujourdhui: auj, maintenant, par: 'g' });
    verifier(v2.ok && v2.facture.numero === '2026-0002', 'numéros à la suite : 2026-0002');
    if (v2.ok) compteur = v2.compteur;
    // 2026-0002 disparaît (supprimée par erreur) : son numéro n'est jamais redonné.
    verifier(prochainNumero([f1], compteur, '2026').numero === '2026-0003', 'numéro jamais réutilisé, même si sa facture a disparu');
    // Compteur perdu (base restaurée) : on repart après le plus grand numéro existant.
    verifier(prochainNumero([f1, { numero: '2026-0007' }], undefined, '2026').numero === '2026-0008', 'sans compteur : après le plus grand numéro déjà donné');
    verifier(prochainNumero([f1], compteur, '2027').numero === '2027-0001', 'nouvelle année : 2027-0001');
    verifier(prochainNumero([{ numero: 'LM-2026-0041' }], undefined, '2026').numero === '2026-0001', 'ancienne série « LM-… » ignorée');
    const lu = compteurFactures({ reglages: [compteur as Reglage, { id: 'numerotation-factures', derniers: { x: 3, '2025': -1 } } as unknown as Reglage] });
    verifier(lu.derniers['2026'] === 2 && Object.keys(lu.derniers).length === 1, 'compteur lu avec tolérance');
  }

  /* ------------------------------------------ validation refusée (identité) */
  {
    const sansIdentite = validerFacture({ facture: brouillon, donnees, factures: [], proprietaire: donnees.proprietaires[0], identite: identiteConciergerie({ reglages: [] }, SENS), aujourdhui: auj, maintenant, par: 'g' });
    verifier(!sansIdentite.ok && /Paramètres → Société/.test(sansIdentite.erreur), 'autre espace sans identité : validation refusée (jamais l’identité de Label Maison)');
    const sansAdresse = validerFacture({ facture: brouillon, donnees, factures: [], proprietaire: { ...donnees.proprietaires[0], adresse: ' ' }, identite: identiteSens, aujourdhui: auj, maintenant, par: 'g' });
    verifier(!sansAdresse.ok && /adresse du propriétaire/.test(sansAdresse.erreur), 'propriétaire sans adresse : validation refusée');
    const autreP = validerFacture({ facture: brouillon, donnees, factures: [], proprietaire: donnees.proprietaires[1], identite: identiteSens, aujourdhui: auj, maintenant, par: 'g' });
    verifier(!autreP.ok, 'facture d’un propriétaire validée au nom d’un autre : refusée');
    const vSens = validerFacture({ facture: brouillon, donnees, factures: [], proprietaire: donnees.proprietaires[0], identite: identiteSens, aujourdhui: auj, maintenant, par: 'g' });
    verifier(vSens.ok && vSens.facture.tvaPct === 20 && !vSens.facture.mensuelle!.mentionTva && vSens.facture.mensuelle!.emetteur!.raisonSociale === 'Sens Conciergerie' && !JSON.stringify(vSens.facture).includes('Label Maison'), 'autre espace : sa TVA et son identité, rien de Label Maison');
  }

  /* --------------------------------------------- brouillon unique par mois */
  {
    const base = { ...donnees, factures: [] as Facture[] };
    const premiers = brouillonsDuMois({ donnees: base, mois: '2026-09', identite: IDENTITE_LABEL_MAISON, aujourdhui: auj, maintenant });
    verifier(premiers.map((f) => f.id).sort().join() === [idFactureMensuelle(P, '2026-09'), idFactureMensuelle(Q, '2026-09')].sort().join(), 'passage : un brouillon par propriétaire qui a quelque chose à payer');
    verifier(premiers.every((f) => f.mensuelle?.creeePar === 'automatique' && f.statut === 'brouillon'), 'passage : brouillons « automatique »');
    const second = brouillonsDuMois({ donnees: { ...base, factures: premiers }, mois: '2026-09', identite: IDENTITE_LABEL_MAISON, aujourdhui: auj, maintenant });
    verifier(second.length === 0, 'passage refait : aucun brouillon de plus (idempotent)');
    const avecValidee = brouillonsDuMois({ donnees: { ...base, factures: [f1] }, mois: '2026-09', identite: IDENTITE_LABEL_MAISON, aujourdhui: auj, maintenant });
    verifier(avecValidee.map((f) => f.proprietaireId).join() === Q, 'passage : une facture déjà validée n’est jamais recréée en brouillon');
    const ecarte = ecarterBrouillon(premiers.find((f) => f.proprietaireId === Q)!)!;
    verifier(ecarte.statut === 'annulee' && brouillonsDuMois({ donnees: { ...base, factures: [f1, ecarte] }, mois: '2026-09', aujourdhui: auj, maintenant }).length === 0, 'brouillon écarté : pas recréé');
    verifier(brouillonsDuMois({ donnees: base, mois: '2026-12', aujourdhui: auj, maintenant }).length === 0, 'mois sans séjour : aucun brouillon');
    const sansFacture = moisSansFacture({ ...donnees, factures: [f1] }, P, '2026-12-05', 4);
    verifier(sansFacture.map((x) => x.mois).join() === '2026-11,2026-10', 'mois sans facture : ceux qui ont quelque chose à facturer, hors mois déjà facturé');
    const rafraichi = preparerBrouillon({ donnees: plusTard, proprietaireId: P, mois: '2026-09', existante: avecAj, identite: IDENTITE_LABEL_MAISON, aujourdhui: auj, maintenant, par: 'g' })!;
    verifier(rafraichi.mensuelle!.ajustements.length === 1 && rafraichi.mensuelle!.creeePar === 'automatique' && totalCode(rafraichi.lignes, 'menage') === bilanMensuel(plusTard, P, '2026-09').totaux.menage, 'brouillon rouvert : recalculé, ajustements gardés');
  }

  /* ------------------------------------------- passage planifié (base en mémoire) */
  {
    const stock = new Map<string, Map<string, { id: string }>>();
    const col = (c: string) => stock.get(c) ?? (stock.set(c, new Map()), stock.get(c)!);
    let ecritures = 0;
    const base: BasePassageFactures = {
      async lire<T>(c: string, ids?: string[]) {
        const m = col(c);
        return (ids ? ids.map((i) => m.get(i)).filter(Boolean) : [...m.values()]) as T[];
      },
      async ecrire(c, elements) {
        for (const e of elements) col(c).set(e.id, structuredClone(e));
        ecritures += elements.length;
      },
      async ajouterSiAbsent(c, elements) {
        let k = 0;
        for (const e of elements) if (!col(c).has(e.id)) (col(c).set(e.id, structuredClone(e)), k++);
        ecritures += k;
        return k;
      },
    };
    for (const p of donnees.proprietaires) col('proprietaires').set(p.id, p);
    for (const l of donnees.logements) col('logements').set(l.id, l);
    for (const r of donnees.reservations) col('reservations').set(r.id, r);
    for (const m of donnees.mandats) col('mandats').set(m.id, m);
    // Le 30 septembre : rien pour septembre (mois pas terminé) ; août est vide.
    const avant = await passageFacturesMensuelles(base, LM, { aujourdhui: '2026-09-30', maintenant });
    verifier(avant.mois === '2026-08' && avant.brouillons === 0, 'passage : jamais le mois en cours');
    // Le gérant a déjà validé la facture de P pour septembre (à la demande) avant le passage du 1er.
    col('factures').set(f1.id, f1);
    const r1 = await passageFacturesMensuelles(base, LM, { aujourdhui: '2026-10-01', maintenant: '2026-10-01T00:30:00.000Z' });
    verifier(r1.mois === '2026-09' && r1.statut === 'fait' && r1.brouillons === 1, 'passage du 1er : brouillons du mois terminé');
    verifier((col('factures').get(f1.id) as Facture).numero === '2026-0001' && (col('factures').get(f1.id) as Facture).statut === 'emise', 'passage : la facture validée n’est jamais remplacée');
    const avantEcritures = ecritures;
    const r2 = await passageFacturesMensuelles(base, LM, { aujourdhui: '2026-10-01', maintenant: '2026-10-01T01:00:00.000Z' });
    const r3 = await passageFacturesMensuelles(base, LM, { aujourdhui: '2026-10-15', maintenant: '2026-10-15T01:00:00.000Z' });
    verifier(r2.statut === 'deja_fait' && r3.statut === 'deja_fait' && ecritures === avantEcritures && col('factures').size === 2, 'passage refait dans le mois : rien de plus (une fois par mois et par espace)');
    verifier(col(COLLECTION_PASSAGES_FACTURES).has('2026-09'), 'passage : trace du mois préparé');
    // Autre espace, identité enregistrée en TVA : brouillon à son taux.
    col('reglages').set('societe', reglageSociete(identiteSens, { maintenant, par: 'x' }));
    const r4 = await passageFacturesMensuelles(base, SENS, { aujourdhui: '2026-11-01', maintenant });
    const bOct = col('factures').get(idFactureMensuelle(P, '2026-10')) as Facture | undefined;
    verifier(r4.brouillons >= 1 && !!bOct && bOct.tvaPct === 20 && bOct.statut === 'brouillon', 'passage : brouillon au taux de TVA de l’espace');
  }

  /* --------------------------------------- partage, vue du propriétaire, relances */
  {
    const partagee = partagerFacture(f1, '2026-10-03T10:00:00.000Z');
    const vues = facturesVue([partagee, brouillon], P, '2026-10-05');
    const v = vues[0];
    verifier(vues.length === 1 && v.numero === '2026-0001', 'propriétaire : la facture partagée seulement (jamais un brouillon)');
    verifier(!!v.mensuelle && v.mensuelle.emetteur.raisonSociale === IDENTITE_LABEL_MAISON.raisonSociale && v.mensuelle.mentionTva === MENTION_FRANCHISE_TVA && v.lignes.some((l) => !!l.detail && l.code === 'menage'), 'propriétaire : identités, mention et détail des lignes figés');
    const doc = documentDeFactureVue(v)!;
    verifier(doc.totalHt === f1.montantHtCentimes && doc.totalTtc === v.montantTtc && doc.lignes.reduce((s, l) => s + l.montant, 0) === doc.totalHt, 'propriétaire : mêmes totaux que la facture validée');
    verifier(facturesVue([partagee], Q, '2026-10-05').length === 0, 'propriétaire : jamais la facture d’un autre');
    const plan = planifierRelances({ factures: [partagee], relances: [], reglages: REGLAGES_RELANCES_DEFAUT, aujourdhui: '2026-10-24', maintenant });
    verifier(plan.nouvelles.length === 1 && plan.nouvelles[0].numero === '2026-0001', 'partagée et en retard : les relances habituelles s’appliquent');
    verifier(planifierRelances({ factures: [brouillon], relances: [], reglages: REGLAGES_RELANCES_DEFAUT, aujourdhui: '2026-12-24', maintenant }).nouvelles.length === 0, 'brouillon : jamais relancé');
  }

  console.log(`${ok} contrôles réussis, ${ko} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = ko ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
});
