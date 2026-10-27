/**
 * Vérification de l'espace propriétaire (pur, sans réseau) : filtrage strict
 * par propriétaire, aucune donnée personnelle de voyageur, prorata d'un séjour
 * à cheval sur deux mois, bilans non publiés invisibles, liens à usage unique
 * et sessions signées, rattachées à l'espace qui a invité (Label Maison, Sens…),
 * logement passé à un autre propriétaire (chacun sa période, bilan publié figé).
 *
 * Lancement :
 *   node_modules/.bin/esbuild src/erp/data/verifier-proprietaire.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-proprietaire.mjs \
 *     && node /tmp/verifier-proprietaire.mjs
 */
import {
  avisPublic,
  bilanMensuel,
  bilansPublies,
  calendrierMois,
  changerProprietaire,
  chiffresPublics,
  donneesDuProprietaire,
  etatBilan,
  ficheLogement,
  logementsSansTaux,
  joursDuMois,
  logementsDe,
  memesChiffres,
  moisPrecedent,
  moisSuivant,
  moisTermines,
  prenomInitiale,
  proprietaireAutorise,
  vueProprietaire,
  type EntreesProprietaire,
} from './proprietaire';
import {
  DUREE_CONNEXION_MS,
  DUREE_INVITATION_MS,
  LIENS_MAX,
  avecNouveauLien,
  emailValide,
  empreinteJeton,
  enteteCookie,
  inviter,
  jetonBienForme,
  lireCookie,
  lireSession,
  nouveauJeton,
  retirer,
  secretValide,
  sessionEncoreValide,
  signerSession,
  utiliserLien,
} from './proprietaire-acces';
import { avecNouveauLien as avecNouveauLienOps } from './operations-acces';
import { ID_PROPRIETAIRE_A_RENSEIGNER } from './repull';
import { ID_LABEL_MAISON } from './espaces';
import { espaceARetenir, lienAcces, lireEspaceRetenu, lireLienAcces, lireSessionExterne, marqueConnexion, signerSessionExterne } from './acces-externe';
import { creerSeed } from './seed';
import { b64url } from './web-push';
import type { Logement, Mandat, Proprietaire, Reservation } from './types';
import type { BilanProprietaire, DocumentProprietaire } from './types-proprietaire';

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

const proprietaire = (id: string, nom: string): Proprietaire => ({
  id,
  type: 'particulier',
  nom,
  contact: { email: `${id}@exemple.invalid`, telephone: '06 00 00 00 00' },
  adresse: '1 rue Secrète, 91000 Évry',
  ibanMasque: 'FR76 •••• 1234',
  notes: 'NOTE-INTERNE',
  creeLe: '2026-01-01',
});

const logement = (id: string, proprietaireId: string, statut: Logement['statut'] = 'actif'): Logement =>
  ({
    id,
    nom: `Logement ${id}`,
    adresse: 'ADRESSE-PRIVEE',
    ville: 'Évry',
    codePostal: '91000',
    type: 'T2',
    surfaceM2: 40,
    capacite: 4,
    chambres: 1,
    lits: [],
    statut,
    proprietaireId,
    residencePrincipale: false,
    serrure: 'connectee',
    fiche: { acces: 'CODE-PORTE-4821', wifiNom: 'WIFI-SECRET', wifiMotDePasse: 'MDP-WIFI' },
    dotationLinge: [],
    annonces: [],
    checklistLancement: [],
    photos: ['https://photos.exemple.invalid/a.jpg'],
  }) as unknown as Logement;

let n = 0;
const resa = (logementId: string, arrivee: string, depart: string, o: Partial<Reservation> = {}): Reservation => ({
  id: `res-${++n}`,
  logementId,
  canal: 'airbnb',
  voyageur: { nom: 'Camille Martin', pays: 'PAYS-PRIVE', nbPersonnes: 3 },
  arrivee,
  depart,
  nuits: Math.round((Date.parse(depart) - Date.parse(arrivee)) / 86_400_000),
  statut: 'terminee',
  montantBrutCentimes: 50_000,
  commissionPlateformeCentimes: 7_500,
  fraisMenageCentimes: 5_000,
  noteVoyageur: 5,
  // Seul le « Message privé » est privé : il ne doit jamais sortir.
  commentaireVoyageur: 'Très bon séjour.\n\nMessage privé : AVIS-PRIVE',
  ...o,
});

const mandat = (id: string, proprietaireId: string, logementId: string, commissionPct: number, statut: Mandat['statut'] = 'signe'): Mandat =>
  ({ id, proprietaireId, logementId, reference: id, statut, commissionPct, fraisMenageCentimes: 5_000, dateDebut: '2026-01-01' }) as Mandat;

const A = 'pro-a';
const B = 'pro-b';

const e: EntreesProprietaire = {
  proprietaires: [proprietaire(A, 'Alice Propriétaire'), proprietaire(B, 'Bruno Voisin'), proprietaire(ID_PROPRIETAIRE_A_RENSEIGNER, 'À renseigner')],
  logements: [
    logement('log-a1', A),
    logement('log-a2', A),
    logement('log-a-sorti', A, 'sorti'),
    logement('log-b', B),
    logement('log-x', ID_PROPRIETAIRE_A_RENSEIGNER),
  ],
  mandats: [mandat('m-a1', A, 'log-a1', 20), mandat('m-a1-old', A, 'log-a1', 30, 'resilie'), mandat('m-a2', A, 'log-a2', 18), mandat('m-b', B, 'log-b', 25)],
  reservations: [
    // Août : un séjour entier, un séjour à cheval août → septembre (3 nuits en août, 2 en septembre), un annulé.
    resa('log-a1', '2026-08-10', '2026-08-14'),
    resa('log-a1', '2026-08-29', '2026-09-03', { montantBrutCentimes: 100_000, commissionPlateformeCentimes: 15_000, fraisMenageCentimes: 5_000, voyageur: { nom: 'jean-pierre de la tour', nbPersonnes: 2 } }),
    resa('log-a1', '2026-08-20', '2026-08-22', { statut: 'annulee' }),
    resa('log-a2', '2026-08-01', '2026-08-03', { canal: 'booking', voyageur: { nom: 'john.doe@exemple.invalid', nbPersonnes: 1 } }),
    resa('log-a2', '2026-09-26', '2026-09-28', { statut: 'confirmee', voyageur: { nom: '+33 6 12 34 56 78', nbPersonnes: 2 } }),
    // Autres propriétaires : jamais visibles.
    resa('log-b', '2026-08-05', '2026-08-09', { voyageur: { nom: 'Zoé Interdite', nbPersonnes: 2 }, montantBrutCentimes: 999_999 }),
    resa('log-b', '2026-09-25', '2026-09-27', { statut: 'confirmee', voyageur: { nom: 'Zoé Interdite', nbPersonnes: 2 } }),
    resa('log-x', '2026-08-05', '2026-08-09', { voyageur: { nom: 'Xavier Attente', nbPersonnes: 2 } }),
  ],
  documentsProprietaire: [
    { id: 'doc-a', proprietaireId: A, categorie: 'contrat', titre: 'Mandat A', fichier: 'stockage://erp-fichiers/proprietaires/pro-a/x.pdf', nomFichier: 'x.pdf', ajouteLe: '2026-09-01T10:00:00.000Z', ajoutePar: 'g' },
    { id: 'doc-a2', proprietaireId: A, logementId: 'log-b', categorie: 'autre', titre: 'Doc A', fichier: 'stockage://erp-fichiers/proprietaires/pro-a/y.pdf', nomFichier: 'y.pdf', ajouteLe: '2026-09-02T10:00:00.000Z', ajoutePar: 'g' },
    { id: 'doc-b', proprietaireId: B, categorie: 'contrat', titre: 'DOC-DE-BRUNO', fichier: 'stockage://erp-fichiers/proprietaires/pro-b/z.pdf', nomFichier: 'z.pdf', ajouteLe: '2026-09-03T10:00:00.000Z', ajoutePar: 'g' },
    { id: 'doc-mauvaise-categorie', proprietaireId: A, categorie: 'secret' as never, titre: 'Inconnu', fichier: 'stockage://x', nomFichier: 'x', ajouteLe: '2026-09-04T10:00:00.000Z', ajoutePar: 'g' },
  ] satisfies DocumentProprietaire[],
  bilansProprietaire: [] as BilanProprietaire[],
};

/* ------------------------------------------------------------------ main */

async function main() {
  /* dates */
  verifier(joursDuMois('2026-02') === 28 && joursDuMois('2028-02') === 29 && joursDuMois('2026-08') === 31, 'jours du mois');
  verifier(moisSuivant('2026-12') === '2027-01' && moisPrecedent('2026-01') === '2025-12', 'mois suivant et précédent');
  verifier(moisTermines('2026-09-24', 3).join() === '2026-08,2026-07,2026-06', 'mois terminés (le mois en cours exclu)');

  /* anonymisation */
  verifier(prenomInitiale('Camille Martin') === 'Camille M.', 'Prénom N.');
  verifier(prenomInitiale('jean-pierre de la tour') === 'Jean-Pierre T.', 'prénom composé, initiale du nom');
  verifier(prenomInitiale('Camille M.') === 'Camille M.', 'anonymisation idempotente');
  verifier(prenomInitiale('Madonna') === 'Madonna', 'nom seul : prénom seul');
  verifier(prenomInitiale('john.doe@exemple.invalid') === 'Voyageur' && prenomInitiale('+33 6 12 34 56 78') === 'Voyageur' && prenomInitiale('') === 'Voyageur', 'e-mail, téléphone, vide → « Voyageur »');

  /* filtrage */
  verifier(!proprietaireAutorise(ID_PROPRIETAIRE_A_RENSEIGNER) && !proprietaireAutorise('') && proprietaireAutorise(A), 'fiche d’attente des logements importés refusée');
  verifier(logementsDe(e.logements, ID_PROPRIETAIRE_A_RENSEIGNER).length === 0, 'aucun logement pour la fiche d’attente');
  verifier(vueProprietaire(e, ID_PROPRIETAIRE_A_RENSEIGNER, { aujourdhui: '2026-09-24' }) === null, 'pas d’espace pour la fiche d’attente');
  verifier(vueProprietaire(e, 'pro-inconnu', { aujourdhui: '2026-09-24' }) === null, 'pas d’espace pour un propriétaire inconnu');

  /* bilan d'août, prorata */
  const aout = bilanMensuel(e, A, '2026-08');
  const enAout = aout.sejours.find((s) => s.arrivee === '2026-08-29')!;
  verifier(!!enAout && enAout.nuits === 3 && enAout.nuitsSejour === 5, 'séjour à cheval : 3 nuits sur 5 en août');
  verifier(enAout.encaisse === 60_000 && enAout.fraisPlateforme === 9_000 && enAout.menage === 3_000, 'séjour à cheval : montants au prorata (3/5)');
  // Commission sur le séjour entier : (100 000 − 15 000 − 5 000) × 20 % = 16 000, dont 3/5 en août.
  verifier(enAout.commission === 9_600 && enAout.net === 60_000 - 9_000 - 3_000 - 9_600, 'séjour à cheval : commission du mandat signé (20 %), net déduit');
  const sept = bilanMensuel(e, A, '2026-09');
  const enSept = sept.sejours.find((s) => s.arrivee === '2026-08-29')!;
  verifier(enSept.nuits === 2 && enSept.encaisse + enAout.encaisse === 100_000 && enSept.net + enAout.net === 100_000 - 15_000 - 5_000 - 16_000, 'séjour à cheval : août + septembre = séjour entier');
  verifier(aout.sejours.every((s) => s.net === s.encaisse - s.fraisPlateforme - s.menage - s.commission), 'chaque ligne s’additionne au centime');
  verifier(aout.totaux.net === aout.sejours.reduce((x, s) => x + s.net, 0) && aout.totaux.sejours === 3, 'totaux = somme des lignes ; annulé exclu');
  verifier(aout.sejours.every((s) => s.logementId.startsWith('log-a')), 'bilan : seulement ses logements');
  verifier(aout.logements.map((l) => l.logementId).join() === 'log-a1,log-a2', 'logement sorti sans nuit du mois non compté');
  verifier(aout.totaux.nuits === 4 + 3 + 2 && Math.abs(aout.occupation - 9 / 62) < 1e-9, 'nuits et occupation du mois');
  verifier(aout.logements.find((l) => l.logementId === 'log-a2')?.commissionPct === 18, 'taux du mandat de chaque logement');
  const vide = bilanMensuel(e, A, 'pas-un-mois');
  verifier(vide.sejours.length === 0 && vide.totaux.net === 0, 'mois illisible : bilan vide');

  /* calendrier */
  const cal = calendrierMois(e.reservations, 'log-a1', '2026-08');
  const jour = (d: string) => cal.jours.find((j) => j.date === d)!;
  verifier(cal.jours.length === 31 && cal.nuitsReservees === 4 + 3 && cal.nuitsLibres === 31 - 7, 'calendrier : nuits réservées et libres');
  verifier(jour('2026-08-10').arrivee && jour('2026-08-10').occupe && !jour('2026-08-10').veille, 'calendrier : jour d’arrivée');
  verifier(jour('2026-08-14').depart && !jour('2026-08-14').occupe && jour('2026-08-14').veille, 'calendrier : jour de départ');
  verifier(!jour('2026-08-20').occupe && !jour('2026-08-21').occupe, 'calendrier : séjour annulé libre');
  verifier(jour('2026-08-31').occupe && !jour('2026-08-31').depart, 'calendrier : séjour qui continue le mois suivant');
  verifier(calendrierMois(e.reservations, 'log-a1', '2026-09').jours[0].veille, 'calendrier : 1er du mois, séjour commencé le mois précédent');

  /* la vue */
  const vue = vueProprietaire(e, A, { aujourdhui: '2026-09-24', mois: '2026-08' })!;
  const texte = JSON.stringify(vue);
  verifier(vue.logements.map((l) => l.id).join() === 'log-a1,log-a2', 'vue : ses logements gérés seulement');
  verifier(!/log-b|log-x|Bruno|Zo[ée]|Xavier|DOC-DE-BRUNO|999999/.test(texte), 'vue : rien d’un autre propriétaire');
  verifier(
    !/CODE-PORTE|WIFI|MDP-WIFI|ADRESSE-PRIVEE|NOTE-INTERNE|PAYS-PRIVE|AVIS-PRIVE|exemple\.invalid@|john\.doe|\+33 6 12|06 00 00|Camille Martin|Rue Secrète|FR76/i.test(texte),
    'vue : aucune donnée personnelle (contacts, codes, adresses, avis, pays, noms complets)',
  );
  verifier(!/"id":"res-/.test(texte) && !/stockage:\/\//.test(texte), 'vue : ni identifiant de réservation, ni chemin de fichier');
  verifier(vue.prochainesArrivees.length === 1 && vue.prochainesArrivees[0].voyageur === 'Voyageur' && vue.prochainesArrivees[0].logementId === 'log-a2', 'prochaines arrivées : les siennes, anonymisées');
  verifier(vue.calendrier.mois === '2026-08' && vue.calendrier.logements.length === 2, 'calendrier du mois demandé');
  verifier(vue.documents.map((d) => d.id).join() === 'doc-a2,doc-a', 'documents : les siens, catégorie connue, du plus récent au plus ancien');
  verifier(!('logementId' in vue.documents[0]), 'document rattaché au logement d’un autre : rattachement masqué');
  verifier(vue.moisCourant.mois === '2026-09' && vue.moisCourant.provisoire && vue.moisPrecedent.provisoire, 'mois en cours et précédent provisoires sans bilan publié');

  /* bilans publiés seulement */
  const publie: BilanProprietaire = { id: `${A}-2026-08`, proprietaireId: A, mois: '2026-08', statut: 'publie', commentaire: 'Bon mois', chiffres: aout, publieLe: '2026-09-03T08:00:00.000Z', majLe: '2026-09-03T08:00:00.000Z' };
  const brouillon: BilanProprietaire = { ...publie, id: `${A}-2026-07`, mois: '2026-07', statut: 'brouillon', publieLe: undefined };
  const bilanB: BilanProprietaire = { ...publie, id: `${B}-2026-08`, proprietaireId: B, chiffres: bilanMensuel(e, B, '2026-08') };
  const avecBilans = { ...e, bilansProprietaire: [publie, brouillon, bilanB] };
  const v2 = vueProprietaire(avecBilans, A, { aujourdhui: '2026-09-24' })!;
  verifier(v2.bilans.map((b) => b.mois).join() === '2026-08', 'bilan non publié invisible ; bilan d’un autre invisible');
  verifier(!v2.moisPrecedent.provisoire && v2.moisPrecedent.net === aout.totaux.net, 'mois précédent : chiffres du bilan publié');
  verifier(!/Zo[ée]|999999/.test(JSON.stringify(v2)), 'bilan publié de B jamais dans la vue de A');
  const truque: BilanProprietaire = { ...publie, chiffres: { ...aout, sejours: [...aout.sejours, { ...aout.sejours[0], logementId: 'log-b', voyageur: 'Zoé Interdite' }] } };
  verifier(bilansPublies([truque], A)[0].chiffres.sejours.every((s) => s.logementId !== 'log-b'), 'bilan publié relu : ligne d’un autre logement retirée');
  verifier(chiffresPublics({ ...aout, sejours: [{ ...aout.sejours[0], voyageur: 'Camille Martin' }] }, new Set(['log-a1', 'log-a2'])).sejours[0].voyageur === 'Camille M.', 'bilan publié relu : voyageur réanonymisé');
  verifier(memesChiffres(aout, bilanMensuel(e, A, '2026-08')) && !memesChiffres(aout, sept), 'changement des chiffres depuis la publication détecté');

  /* page de connexion : au nom de l'espace connu sur l'appareil */
  {
    const SENS = '5e5e0000-0000-4000-8000-000000000002';
    verifier(marqueConnexion(undefined, undefined).labelMaison === false && marqueConnexion(undefined, undefined).nom === undefined, 'connexion, rien de connu : « votre conciergerie », ni marque ni numéro de Label Maison');
    verifier(marqueConnexion(undefined, { espace: SENS, nom: 'Sens' }).nom === 'Sens' && !marqueConnexion(undefined, { espace: SENS, nom: 'Sens' }).labelMaison, 'après déconnexion d’un propriétaire de Sens : au nom de Sens, sans Label Maison');
    verifier(marqueConnexion(ID_LABEL_MAISON, { espace: SENS, nom: 'Sens' }).labelMaison && marqueConnexion(undefined, { espace: ID_LABEL_MAISON }).labelMaison, 'Label Maison : par son lien, ou retenu sur l’appareil');
    verifier(marqueConnexion(SENS, undefined).nom === undefined && !marqueConnexion(SENS, { espace: ID_LABEL_MAISON, nom: 'Label Maison' }).labelMaison, 'lien d’un autre espace : jamais Label Maison, même retenu');
    verifier(
      lireEspaceRetenu(JSON.stringify({ espace: SENS.toUpperCase(), nom: '  Sens  ', email: 'x@y.fr' }))?.nom === 'Sens' &&
        !('email' in (lireEspaceRetenu(JSON.stringify({ espace: SENS, email: 'x@y.fr' })) ?? {})) &&
        lireEspaceRetenu('{pas du json') === undefined &&
        lireEspaceRetenu(JSON.stringify({ espace: 'sens' })) === undefined,
      'espace retenu relu sans confiance : id et nom seulement',
    );
    verifier(espaceARetenir({ espace: SENS }, { espace: SENS, nom: 'Sens' }).nom === 'Sens' && espaceARetenir({ espace: SENS }, { espace: ID_LABEL_MAISON, nom: 'Label Maison' }).nom === undefined, 'lien reçu du même espace : le nom connu est gardé, d’un autre espace : oublié');
  }

  /* logement passé à un autre propriétaire */
  {
    const AUJ = '2026-11-05';
    const T = 'log-t';
    const avant = logement(T, A);
    const sejours = [
      resa(T, '2026-08-03', '2026-08-08', { voyageur: { nom: 'Ancien Voyageur', nbPersonnes: 2 }, noteVoyageur: 2, commentaireVoyageur: 'AVIS-ANCIEN' }),
      resa(T, '2026-10-08', '2026-10-12', { voyageur: { nom: 'Mixte Cheval', nbPersonnes: 2 } }),
      resa(T, '2026-10-20', '2026-10-23', { voyageur: { nom: 'Nouveau Venu', nbPersonnes: 2 }, noteVoyageur: 5, commentaireVoyageur: 'AVIS-NOUVEAU' }),
      resa(T, '2026-11-20', '2026-11-22', { voyageur: { nom: 'Futur Hôte', nbPersonnes: 2 }, statut: 'confirmee' }),
    ];
    const mandatsT = [mandat('m-ta', A, T, 20), { ...mandat('m-tb', B, T, 25), dateDebut: '2026-10-10' }];
    const apres = changerProprietaire(avant, B, '2026-10-10');
    verifier(
      apres.proprietaireId === B && apres.proprietaireDepuis === '2026-10-10' && JSON.stringify(apres.proprietairesPrecedents) === JSON.stringify([{ proprietaireId: A, jusquAu: '2026-10-10' }]),
      'changement de propriétaire : nouveau depuis le jour du changement, l’ancien jusqu’à la veille',
    );
    verifier(changerProprietaire(apres, B, '2026-10-20') === apres, 'même propriétaire : rien ne change');
    const importe = changerProprietaire({ ...avant, proprietaireId: ID_PROPRIETAIRE_A_RENSEIGNER }, A, '2026-10-10');
    verifier(importe.proprietaireDepuis === undefined && !importe.proprietairesPrecedents, 'logement importé (fiche d’attente) : son premier propriétaire reçoit tout l’historique');
    const retour = changerProprietaire(apres, A, '2026-11-01');
    verifier(
      retour.proprietaireDepuis === '2026-11-01' && retour.proprietairesPrecedents?.length === 2 && retour.proprietairesPrecedents[1].proprietaireId === B && retour.proprietairesPrecedents[1].depuis === '2026-10-10',
      'retour à l’ancien propriétaire : chaque période gardée',
    );

    const base = { logements: [avant], reservations: sejours, mandats: mandatsT };
    const d = { logements: [apres], reservations: sejours, mandats: mandatsT };
    const aoutA = bilanMensuel(base, A, '2026-08');
    verifier(memesChiffres(aoutA, bilanMensuel(d, A, '2026-08')) && aoutA.totaux.nuits === 5, 'ancien propriétaire : ses mois d’avant restent les mêmes (le gérant peut encore les publier)');
    verifier(bilanMensuel(d, B, '2026-08').totaux.nuits === 0 && bilanMensuel(d, B, '2026-09').totaux.net === 0, 'nouveau propriétaire : rien d’avant son premier jour');
    const octA = bilanMensuel(d, A, '2026-10');
    const octB = bilanMensuel(d, B, '2026-10');
    verifier(octA.totaux.nuits === 4 && octA.totaux.sejours === 1 && octB.totaux.nuits === 3 && octB.totaux.sejours === 1, 'mois du changement : le séjour du 8 au 12 oct. est à l’ancien (arrivé avant le 10), toutes ses nuits');
    verifier(octB.logements[0]?.commissionPct === 25 && octA.logements[0]?.commissionPct === 20, 'chacun son mandat (taux)');
    verifier(
      Math.abs(octA.logements[0].occupation - 4 / 11) < 1e-9 && Math.abs(octB.logements[0].occupation - 3 / 20) < 1e-9,
      'occupation sur les jours de chacun (ancien : 1er-9 et ses nuits du 10-11 ; nouveau : à partir du 12)',
    );
    verifier(octA.logements[0].nom === avant.nom && octA.logements.length === 1, 'ancien propriétaire : le logement cédé apparaît dans le mois où il a eu des nuits');
    verifier(bilanMensuel(d, A, '2026-11').logements.length === 0, 'ancien propriétaire : plus rien après le changement');

    // Ce que voit le nouveau propriétaire : rien d'avant (chiffres, avis, séjours).
    const entreesB = { ...e, proprietaires: [...e.proprietaires], logements: [apres], reservations: sejours, mandats: mandatsT, bilansProprietaire: [] };
    const vueB = vueProprietaire(entreesB, B, { aujourdhui: AUJ, mois: '2026-08' })!;
    const ficheB = vueB.fiches[0];
    const texteB = JSON.stringify(vueB);
    verifier(ficheB.totaux.nuits === 3 && ficheB.mois.filter((m) => m.suivi).every((m) => m.mois >= '2026-10'), 'fiche du nouveau : 12 mois à partir de son premier jour, ses séjours seulement');
    verifier(ficheB.avis?.nombre === 1 && ficheB.avis.moyenne === 5 && !/AVIS-ANCIEN|Ancien V|Mixte C/.test(texteB), 'fiche du nouveau : avis de ses séjours seulement (ni d’avant, ni du séjour à cheval)');
    verifier(vueB.calendrier.logements[0].sejours.length === 0 && vueB.calendrier.logements[0].nuitsReservees === 0, 'calendrier du nouveau : rien d’avant son premier jour');
    verifier(vueB.prochainesArrivees.length === 1 && vueB.prochainesArrivees[0].voyageur === 'Futur H.', 'prochaines arrivées : les siennes');

    // Ce que voit l'ancien : son bilan publié, figé, tel quel.
    const publieA: BilanProprietaire = { id: `${A}-2026-08`, proprietaireId: A, mois: '2026-08', statut: 'publie', commentaire: '', chiffres: aoutA, publieLe: '2026-09-02T08:00:00.000Z', majLe: '2026-09-02T08:00:00.000Z' };
    const vueA = vueProprietaire({ ...e, logements: [...e.logements, apres], reservations: [...e.reservations, ...sejours], mandats: [...e.mandats, ...mandatsT], bilansProprietaire: [publieA] }, A, { aujourdhui: AUJ })!;
    const bilanA = vueA.bilans.find((b) => b.mois === '2026-08')!;
    verifier(
      bilanA.chiffres.totaux.sejours === aoutA.totaux.sejours && bilanA.chiffres.sejours.length === aoutA.sejours.length && bilanA.chiffres.logements.some((l) => l.logementId === T),
      'ancien propriétaire : bilan publié figé, séjours et totaux d’accord (jamais « Aucun séjour » à côté de « Séjours 1 »)',
    );
    verifier(!vueA.logements.some((l) => l.id === T) && !vueA.fiches.some((f) => f.logementId === T), 'ancien propriétaire : le logement cédé n’est plus dans « Mes logements »');

    // Côté gérant : jamais « Mettre à jour » un bilan publié dont un logement a changé de propriétaire.
    const etat = etatBilan(d, A, '2026-08', publieA);
    verifier(etat.statut === 'transfere' && etat.transferts[0]?.logementId === T && etat.transferts[0].depuis === '2026-10-10' && etat.chiffres === aoutA, 'gérant : bilan publié « Logement transféré depuis le 10 oct. », chiffres figés');
    const sansHistorique = { ...d, logements: [{ ...avant, proprietaireId: B }] };
    verifier(etatBilan(sansHistorique, A, '2026-08', publieA).statut === 'transfere', 'gérant : même un changement fait sans historique n’est pas proposé à la mise à jour (0 €)');
    verifier(etatBilan(base, A, '2026-08', publieA).statut === 'publie' && etatBilan(base, A, '2026-08', { ...publieA, chiffres: bilanMensuel(base, A, '2026-07') }).statut === 'a_mettre_a_jour', 'gérant : sinon « Publié » ou « À mettre à jour »');
    verifier(etatBilan(d, A, '2026-09').statut === 'aucun' && etatBilan(d, A, '2026-08', { ...publieA, statut: 'brouillon' }).statut === 'brouillon', 'gérant : pas encore de bilan, brouillon');

    // Ce que le serveur laisse sortir pour chacun.
    const pourB = donneesDuProprietaire(d, B);
    const pourA = donneesDuProprietaire(d, A);
    const completesB = pourB.reservations.filter((r) => r.voyageur);
    const reduitesB = pourB.reservations.filter((r) => !r.voyageur);
    verifier(completesB.length === 2 && completesB.every((r) => r.arrivee >= '2026-10-10'), 'serveur : au nouveau, ses séjours (arrivés à partir de son premier jour)');
    verifier(
      reduitesB.length === 1 && reduitesB[0].arrivee === '2026-10-08' && !JSON.stringify(reduitesB).match(/Mixte|montant|commentaire|note/i),
      'serveur : le séjour à cheval de l’ancien, au nouveau réduit à ses dates (occupation), ni voyageur, ni montants, ni avis',
    );
    verifier(memesChiffres(bilanMensuel(pourB, B, '2026-10'), octB) && !JSON.stringify(vueProprietaire({ ...entreesB, ...pourB }, B, { aujourdhui: AUJ, mois: '2026-10' })).includes('Mixte'), 'serveur : les chiffres du nouveau, calculés sur ce qui sort, sont les mêmes ; rien du séjour à cheval');
    verifier(
      pourA.reservations.every((r) => r.arrivee < '2026-10-10') && pourA.reservations.length === 2 && !JSON.stringify(pourA.logements).includes('CODE-PORTE') && pourA.logements[0].proprietaireId !== A,
      'serveur : à l’ancien, ses séjours d’avant et le logement réduit (ni codes ni fiche)',
    );
    verifier(memesChiffres(bilanMensuel(pourA, A, '2026-10'), octA) && memesChiffres(bilanMensuel(pourA, A, '2026-08'), aoutA), 'serveur : les chiffres de l’ancien, calculés sur ce qui sort, sont les mêmes');
    verifier(pourA.mandats.every((m) => m.proprietaireId === A) && pourB.mandats.every((m) => m.proprietaireId === B) && pourA.mandats.length === 1, 'serveur : à chacun ses mandats seulement');

    // Début du mandat en cours de mois : un séjour arrivé avant n'est pas géré pour lui.
    const enCours = {
      logements: [logement('log-m', A)],
      reservations: [resa('log-m', '2026-06-08', '2026-06-18'), resa('log-m', '2026-06-20', '2026-07-03')],
      mandats: [{ ...mandat('m-m', A, 'log-m', 20), dateDebut: '2026-06-15' }],
    };
    const juin = bilanMensuel(enCours, A, '2026-06');
    verifier(juin.totaux.sejours === 1 && juin.totaux.nuits === 11 && Math.abs(juin.occupation - 11 / 13) < 1e-9, 'mandat commencé le 15 : le séjour arrivé avant n’est pas à lui, ses jours commencent le 18');
  }

  /* séjour à cheval sur le changement (30 juillet → 2 août, changement le 1er août) */
  {
    const T = 'log-cheval';
    const l = changerProprietaire(logement(T, A), B, '2026-08-01');
    const sejours = [
      resa(T, '2026-07-10', '2026-07-13', { voyageur: { nom: 'Avant Ancien', nbPersonnes: 2 }, noteVoyageur: 5, commentaireVoyageur: 'AVIS-AVANT' }),
      resa(T, '2026-07-30', '2026-08-02', { voyageur: { nom: 'Cheval Limite', nbPersonnes: 2 }, noteVoyageur: 4, commentaireVoyageur: 'AVIS-CHEVAL' }),
      resa(T, '2026-08-10', '2026-08-13', { voyageur: { nom: 'Apres Nouveau', nbPersonnes: 2 }, noteVoyageur: 3, commentaireVoyageur: 'AVIS-APRES' }),
    ];
    const mandatsT = [mandat('m-ca', A, T, 20), { ...mandat('m-cb', B, T, 23), dateDebut: '2026-08-01' }];
    const d = { logements: [l], reservations: sejours, mandats: mandatsT };
    const juilA = bilanMensuel(d, A, '2026-07');
    const aoutA = bilanMensuel(d, A, '2026-08');
    const aoutB = bilanMensuel(d, B, '2026-08');
    verifier(juilA.totaux.sejours === 2 && juilA.totaux.nuits === 3 + 2 && aoutA.totaux.nuits === 1 && aoutA.sejours[0]?.voyageur === 'Cheval L.', 'ancien : le séjour arrivé le 30 juillet est à lui, nuit du 1er août comprise');
    verifier(aoutB.totaux.sejours === 1 && aoutB.totaux.nuits === 3 && !aoutB.sejours.some((x) => x.voyageur === 'Cheval L.') && bilanMensuel(d, B, '2026-07').totaux.nuits === 0, 'nouveau : ni en juillet ni en août, le séjour à cheval n’est pas à lui');
    verifier(Math.abs(aoutA.occupation - 1) < 1e-9 && Math.abs(aoutB.occupation - 3 / 30) < 1e-9, 'occupation d’août : l’ancien sur sa nuit du 1er, le nouveau à partir du 2');
    for (const [qui, mois] of [[B, '2026-07'], [B, '2026-08']] as const) {
      const vue = vueProprietaire({ ...e, logements: [l], reservations: sejours, mandats: mandatsT, bilansProprietaire: [] }, qui, { aujourdhui: '2026-09-15', mois })!;
      const texte = JSON.stringify(vue);
      verifier(!/Cheval|AVIS-CHEVAL|Avant A|AVIS-AVANT/.test(texte) && vue.fiches[0].avis?.nombre === 1 && vue.calendrier.logements[0].sejours.every((x) => x.voyageur !== 'Cheval L.'), `nouveau (${mois}) : ni le séjour à cheval ni son avis, ni ceux d’avant (chiffres, avis, calendrier)`);
    }
    const pourB = donneesDuProprietaire(d, B);
    const pourA = donneesDuProprietaire(d, A);
    verifier(!JSON.stringify(pourB).includes('Cheval') && pourA.reservations.some((r) => r.voyageur?.nom === 'Cheval Limite'), 'serveur : le séjour à cheval part chez l’ancien, jamais chez le nouveau (sauf ses dates)');

    // Ancien propriétaire sans mandat à lui : jamais le taux du nouveau.
    const sansMandatA = { ...d, mandats: [mandatsT[1]] };
    const juilSans = bilanMensuel(sansMandatA, A, '2026-07');
    verifier(
      juilSans.logements.every((x) => x.commissionPct === undefined) && juilSans.totaux.commission === 0 && juilSans.totaux.net === juilSans.totaux.encaisse - juilSans.totaux.fraisPlateforme - juilSans.totaux.menage,
      'sans mandat à lui : ni taux ni commission (jamais le taux d’un autre propriétaire)',
    );
    verifier(donneesDuProprietaire(sansMandatA, A).mandats.length === 0 && memesChiffres(bilanMensuel(donneesDuProprietaire(sansMandatA, A), A, '2026-07'), juilSans), 'serveur : pas le mandat du nouveau chez l’ancien');
    verifier(logementsSansTaux(juilSans).join() === l.nom && logementsSansTaux(juilA).length === 0, 'gérant : « Taux de commission à renseigner » pour ce logement');
  }

  /* démo */
  const seed = creerSeed();
  const demo = vueProprietaire(seed, 'pro-sci-tilleuls', { aujourdhui: '2026-09-24' })!;
  verifier(!!demo && demo.logements.length >= 1 && demo.bilans.length === 1 && demo.documents.filter((x) => x.categorie !== 'facture').length === 2, 'démo : SCI Les Tilleuls, un bilan publié, deux documents (plus le PDF d’une facture)');
  const autres = new Set(seed.logements.filter((l) => l.proprietaireId !== 'pro-sci-tilleuls').map((l) => l.id));
  verifier(!demo.calendrier.logements.some((c) => autres.has(c.logementId)) && !demo.bilans[0].chiffres.sejours.some((s) => autres.has(s.logementId)), 'démo : rien d’un autre propriétaire');

  /* liens à usage unique */
  const t0 = Date.parse('2026-10-01T10:00:00Z');
  verifier(secretValide('x'.repeat(32)) && !secretValide('court') && !secretValide(undefined), 'secret : 32 caractères au moins');
  verifier(emailValide('a@b.fr') && !emailValide('pas une adresse') && !emailValide('a@b'), 'adresse e-mail');
  const jeton = await nouveauJeton();
  verifier(jetonBienForme(jeton) && jeton !== (await nouveauJeton()), 'jeton aléatoire de 32 octets');
  const invite = avecNouveauLien(inviter(undefined, { proprietaireId: A, email: ' Alice@Exemple.FR ', par: 'g', maintenantMs: t0 }), await empreinteJeton(jeton), 'invitation', t0);
  verifier(invite.email === 'alice@exemple.fr' && invite.statut === 'invite' && invite.version === 1, 'invitation : accès créé');
  verifier(!JSON.stringify(invite).includes(jeton), 'seule l’empreinte du jeton est gardée');
  const entree = await utiliserLien([invite], jeton, t0 + 60_000);
  verifier(entree.ok && entree.acces.statut === 'actif' && !!entree.acces.derniereConnexion, 'lien valable : accès actif');
  const apres = entree.ok ? entree.acces : invite;
  const reutilise = await utiliserLien([apres], jeton, t0 + 120_000);
  verifier(!reutilise.ok && reutilise.raison === 'utilise', 'lien déjà utilisé : refusé');
  const expire = await utiliserLien([invite], jeton, t0 + DUREE_INVITATION_MS + 1);
  verifier(!expire.ok && expire.raison === 'expire', 'invitation de plus de 7 jours : refusée');
  const j2 = await nouveauJeton();
  const demande = avecNouveauLien(apres, await empreinteJeton(j2), 'connexion', t0);
  verifier(!(await utiliserLien([demande], j2, t0 + DUREE_CONNEXION_MS + 1)).ok, 'lien demandé de plus d’une heure : refusé');
  verifier((await utiliserLien([demande], j2, t0 + 10_000)).ok, 'lien demandé récent : accepté');
  verifier(!(await utiliserLien([demande], 'x'.repeat(43), t0)).ok && !(await utiliserLien([demande], '../etc', t0)).ok, 'jeton inconnu ou mal formé : refusé');
  let plein = apres;
  for (let i = 0; i < 5; i++) plein = avecNouveauLien(plein, await empreinteJeton(await nouveauJeton()), 'connexion', t0);
  verifier(plein.liens.length === LIENS_MAX, `${LIENS_MAX} liens en cours au plus`);
  // Invitation pas encore ouverte : les demandes « Recevoir mon lien » (2 minutes d'écart) ne la chassent jamais.
  for (const [nom, ajouter] of [['propriétaire', avecNouveauLien], ['opérations', avecNouveauLienOps]] as const) {
    let enAttente = invite;
    for (let i = 1; i <= 6; i++) enAttente = ajouter(enAttente, await empreinteJeton(await nouveauJeton()), 'connexion', t0 + i * 2 * 60_000);
    const connexions = enAttente.liens.filter((l) => l.motif === 'connexion').length;
    verifier(
      connexions === LIENS_MAX && enAttente.liens.some((l) => l.motif === 'invitation') && (await utiliserLien([enAttente], jeton, t0 + 13 * 60_000)).ok,
      `${nom} : six demandes de lien en 12 minutes, l’invitation reste valable (seuls les liens de connexion sont plafonnés)`,
    );
  }
  const retire = retirer(demande, t0 + 1000);
  verifier(retire.statut === 'retire' && retire.liens.length === 0 && retire.version === demande.version + 1, 'retrait : liens effacés, version augmentée');
  verifier(!(await utiliserLien([{ ...retire, liens: demande.liens }], j2, t0 + 10_000)).ok, 'accès retiré : lien refusé');
  const autreAdresse = inviter(apres, { proprietaireId: A, email: 'nouvelle@exemple.fr', par: 'g', maintenantMs: t0 });
  verifier(autreAdresse.statut === 'invite' && autreAdresse.version === apres.version + 1 && autreAdresse.liens.length === 0, 'nouvelle adresse : sessions fermées, anciens liens oubliés');
  const reinvite = inviter(retire, { proprietaireId: A, email: 'alice@exemple.fr', par: 'g', maintenantMs: t0 });
  verifier(reinvite.statut === 'invite' && !reinvite.retireLe && reinvite.version === retire.version, 'réinvitation après retrait');

  /* sessions */
  const secret = 'secret-de-test-'.padEnd(40, 'x');
  const s0 = Math.floor(t0 / 1000);
  const cookie = await signerSession(secret, { p: A, v: apres.version, exp: s0 + 3600 });
  const lue = await lireSession(secret, cookie, s0);
  verifier(!!lue && lue.p === A && sessionEncoreValide(lue, apres), 'session signée : lue et valable');
  verifier((await lireSession(secret, cookie, s0 + 3601)) === null, 'session expirée : refusée');
  verifier((await lireSession(`${secret}-autre`, cookie, s0)) === null, 'session signée avec un autre secret : refusée');
  const [corps, sig] = cookie.split('.');
  const falsifie = `${b64url(new TextEncoder().encode(JSON.stringify({ p: B, v: 1, exp: s0 + 3600 })))}.${sig}`;
  verifier((await lireSession(secret, falsifie, s0)) === null && corps.length > 0, 'session falsifiée (autre propriétaire) : refusée');
  verifier((await lireSession(secret, 'n.importe.quoi', s0)) === null && (await lireSession(secret, undefined, s0)) === null, 'cookie illisible : refusé');
  verifier(!!lue && !sessionEncoreValide(lue, retire) && !sessionEncoreValide(lue, autreAdresse) && !sessionEncoreValide(lue, undefined), 'accès retiré ou adresse changée : session fermée');
  verifier(!!lue && !sessionEncoreValide(lue, { ...apres, id: B, proprietaireId: B }), 'session d’un propriétaire sur l’accès d’un autre : refusée');
  const entete = enteteCookie(cookie, 60);
  verifier(/HttpOnly/.test(entete) && /Secure/.test(entete) && /SameSite=Lax/.test(entete) && /Path=\/api\/espace-proprietaire/.test(entete), 'cookie HttpOnly, Secure, SameSite, limité à l’API');
  verifier(lireCookie(`autre=1; lm_proprio=${cookie}; x=2`) === cookie && lireCookie('autre=1') === undefined, 'lecture du cookie');

  /* « Mes logements » : 12 derniers mois, comparaison, avis, prochains séjours */
  {
    const P = 'pro-p';
    const Q = 'pro-q';
    const l1 = logement('log-p1', P);
    const l2 = logement('log-p2', P);
    const lq = logement('log-q', Q);
    const r = (logementId: string, arrivee: string, depart: string, brut: number, o: Partial<Reservation> = {}) =>
      resa(logementId, arrivee, depart, { montantBrutCentimes: brut, commissionPlateformeCentimes: 0, fraisMenageCentimes: 2_000, voyageur: { nom: 'Lucie Perrin', nbPersonnes: 2 }, noteVoyageur: undefined, commentaireVoyageur: undefined, ...o });
    const donnees: EntreesProprietaire = {
      proprietaires: [proprietaire(P, 'Paul P'), proprietaire(Q, 'Quentin Q')],
      logements: [l1, l2, lq],
      mandats: [{ ...mandat('m-p1', P, 'log-p1', 20), dateDebut: '2024-06-01' }, { ...mandat('m-p2', P, 'log-p2', 10), dateDebut: '2026-08-16' }, mandat('m-q', Q, 'log-q', 20)],
      reservations: [
        // log-p1 : premier séjour en novembre 2024 (septembre et octobre 2024 : pas de données).
        r('log-p1', '2024-11-05', '2024-11-09', 42_000),
        r('log-p1', '2025-08-10', '2025-08-14', 42_000),
        r('log-p1', '2025-09-28', '2025-10-02', 42_000, { noteVoyageur: 4, commentaireVoyageur: 'Bien, merci.\n\nMessage privé : PRIVE-NE-PAS-MONTRER' }),
        r('log-p1', '2026-08-10', '2026-08-14', 62_000, { noteVoyageur: 5, commentaireVoyageur: 'Parfait ! Écrivez-moi : lucie@exemple.invalid ou 06 12 34 56 78, https://exemple.invalid/x' }),
        r('log-p1', '2026-08-30', '2026-09-02', 32_000, { noteVoyageur: 3 }),
        r('log-p1', '2026-07-01', '2026-07-05', 99_000, { statut: 'annulee', noteVoyageur: 1, commentaireVoyageur: 'ANNULEE' }),
        r('log-p1', '2026-09-22', '2026-09-26', 40_000, { statut: 'en_cours', voyageur: { nom: 'Marc Durand', nbPersonnes: 3 } }),
        r('log-p1', '2026-10-03', '2026-10-05', 30_000, { statut: 'confirmee' }),
        // log-p2 : mandat au 16 août 2026.
        r('log-p2', '2026-08-17', '2026-08-21', 30_000),
        // Un autre propriétaire : jamais dans la fiche de P.
        r('log-q', '2026-08-02', '2026-08-06', 70_000, { noteVoyageur: 2, commentaireVoyageur: 'AVIS-DE-QUENTIN', voyageur: { nom: 'Zacharie Autre', nbPersonnes: 4 } }),
      ],
      documentsProprietaire: [],
      bilansProprietaire: [],
    };
    const auj = '2026-09-24';
    const f = ficheLogement(donnees, 'log-p1', auj);
    verifier(f.mois.length === 12 && f.mois[0].mois === '2025-09' && f.mois[11].mois === '2026-08', 'fiche : les 12 derniers mois terminés');
    verifier(f.mois.every((m) => m.suivi), 'fiche : mois suivis depuis le premier séjour connu');
    const aout = f.mois[11];
    // Août 2026 : 4 nuits (10-14) + 2 nuits sur 3 (30 août → 2 sept.), l'annulé exclu.
    verifier(aout.nuits === 6 && aout.sejours === 2 && Math.abs(aout.occupation - 6 / 31) < 1e-9, 'mois : nuits, séjours, occupation');
    const b = bilanMensuel(donnees, P, '2026-08');
    const bP1 = b.logements.find((l) => l.logementId === 'log-p1')!;
    verifier(aout.net === bP1.net && aout.encaisse === bP1.encaisse, 'mois : même net que le bilan du mois');
    verifier(aout.prixMoyenNuit === Math.round(aout.hebergement / aout.nuits) && aout.hebergement === bP1.encaisse - bP1.menage, 'mois : prix moyen par nuit = encaissé hors ménage / nuits');
    const sept25 = f.mois[0];
    verifier(sept25.nuits === 3 && f.mois[1].nuits === 1 && f.mois[1].mois === '2025-10', 'séjour à cheval (28 sept. → 2 oct.) : 3 nuits en septembre, 1 en octobre');
    verifier(f.totaux.nuits === f.mois.reduce((x, m) => x + m.nuits, 0) && f.totaux.net === f.mois.reduce((x, m) => x + m.net, 0), '12 mois : totaux = somme des mois');
    verifier(f.totaux.sejours === 3, '12 mois : un séjour à cheval sur deux mois compté une fois');
    verifier(f.totaux.jours === 365 && Math.abs(f.totaux.occupation - f.totaux.nuits / 365) < 1e-9, '12 mois : occupation sur les jours gérés');
    // Comparaison : sept. et oct. 2024 sans données → 10 mois comparables.
    verifier(f.comparaison?.nbMois === 10, 'comparaison : seulement les mois suivis les deux années');
    verifier(f.comparaison!.precedent.nuits === 4 + 4 && f.comparaison!.actuel.nuits === f.mois.slice(2).reduce((x, m) => x + m.nuits, 0), 'comparaison : mêmes mois, un an plus tôt');
    const f2 = ficheLogement(donnees, 'log-p2', auj);
    verifier(f2.mois.filter((m) => m.suivi).map((m) => m.mois).join() === '2026-08' && f2.mois[11].jours === 16 && Math.abs(f2.mois[11].occupation - 4 / 16) < 1e-9, 'mandat au 16 août : août seul, occupation sur 16 jours');
    verifier(!f2.comparaison && !f2.avis, 'pas de données l’an dernier ni d’avis : ni comparaison ni avis');
    const vide = ficheLogement({ reservations: [], mandats: [] }, 'log-vide', auj);
    verifier(vide.mois.every((m) => !m.suivi) && vide.totaux.mois === 0 && vide.totaux.nuits === 0 && !vide.comparaison, 'logement sans séjour : aucun mois inventé');
    // Avis : séjours terminés et non annulés, partie publique seulement.
    verifier(f.avis?.nombre === 3 && f.avis.moyenne === 4, 'avis : moyenne et nombre (annulé exclu)');
    verifier(f.avis!.derniers.map((a) => a.date).join() === '2026-09-02,2026-08-14,2025-10-02', 'avis : les plus récents d’abord');
    const textes = JSON.stringify(f.avis);
    verifier(!/PRIVE-NE-PAS-MONTRER|Message privé|lucie@|06 12 34|https?:|ANNULEE|Perrin/.test(textes) && /Lucie P\./.test(textes), 'avis : sans message privé, adresse, numéro, lien ni nom complet');
    verifier(avisPublic('Message privé : rien') === undefined && avisPublic('a'.repeat(700))!.length === 600 && avisPublic('Super séjour') === 'Super séjour', 'avis : partie publique, 600 caractères au plus');
    // Prochains séjours : en cours puis à venir.
    verifier(f.prochainsSejours.map((s) => s.arrivee).join() === '2026-09-22,2026-10-03' && f.prochainsSejours[0].voyageur === 'Marc D.', 'prochains séjours : séjour en cours, puis à venir, « Prénom N. »');
    // Isolation : la vue de P ne contient que ses fiches.
    const vP = vueProprietaire(donnees, P, { aujourdhui: auj })!;
    const tP = JSON.stringify(vP.fiches);
    verifier(vP.fiches.map((x) => x.logementId).join() === 'log-p1,log-p2', 'vue : une fiche par logement du propriétaire');
    verifier(!/log-q|AVIS-DE-QUENTIN|Zacharie|Quentin/.test(tP), 'vue : rien du logement d’un autre propriétaire (avis, voyageurs, montants)');
    const fq = ficheLogement(donnees, 'log-q', auj);
    verifier(!JSON.stringify(fq).includes('Lucie') && fq.avis?.nombre === 1, 'fiche d’un logement : ses séjours seulement');
  }

  /* espaces : chaque accès appartient à l'espace qui l'a créé */
  const LM = ID_LABEL_MAISON;
  const SENS = '5e5e0000-0000-4000-8000-000000000002';
  const lien = lienAcces('https://labelmaisoncg.fr/', '/espace-proprietaire', SENS, jeton);
  verifier(lien === `https://labelmaisoncg.fr/espace-proprietaire#espace=${SENS}&jeton=${jeton}`, 'lien : espace et jeton après #');
  verifier(lireLienAcces(lien.split('#')[1]).espace === SENS && lireLienAcces(`#jeton=${jeton}`).espace === LM && lireLienAcces('#espace=pas-un-uuid&jeton=x').espace === LM, 'lien lu : un ancien lien sans espace vaut Label Maison');
  const accesSens = inviter(undefined, { proprietaireId: A, email: 'alice@exemple.fr', par: 'g', maintenantMs: t0, espace: SENS });
  verifier(accesSens.espace === SENS && inviter(accesSens, { proprietaireId: A, email: 'alice@exemple.fr', par: 'g', maintenantMs: t0 }).espace === SENS, 'invitation : rangée dans l’espace du gérant, gardée à la réinvitation');
  verifier(inviter(undefined, { proprietaireId: A, email: 'a@b.fr', par: 'g', maintenantMs: t0 }).espace === LM, 'invitation sans espace (base d’avant les espaces) : Label Maison');
  const actifSens = { ...accesSens, statut: 'actif' as const };
  const actifLM = { ...actifSens, espace: LM };
  const cookieSens = await signerSession(secret, { p: A, v: actifSens.version, exp: s0 + 3600, e: SENS });
  const sens = await lireSession(secret, cookieSens, s0);
  verifier(sens?.e === SENS && sessionEncoreValide(sens, actifSens), 'session de Sens : valable pour l’accès de Sens');
  verifier(!!sens && !sessionEncoreValide(sens, actifLM), 'session de Sens : jamais pour le même propriétaire dans Label Maison');
  verifier(!!lue && lue.e === LM && !sessionEncoreValide(lue, actifSens), 'session de Label Maison : jamais pour un accès de Sens');
  const [corpsSens, sigSens] = cookieSens.split('.');
  const charge = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(corpsSens.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))) as Record<string, unknown>;
  const espaceChange = `${b64url(new TextEncoder().encode(JSON.stringify({ ...charge, e: LM })))}.${sigSens}`;
  verifier((await lireSession(secret, espaceChange, s0)) === null, 'cookie dont on change l’espace : refusé');
  // Cookie d'avant les espaces ({ p, v, exp }, sans genre ni espace) : propriétaire de Label Maison.
  const cleHmac = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const ancienCorps = b64url(new TextEncoder().encode(JSON.stringify({ p: A, v: 2, exp: s0 + 3600 })));
  const ancien = `${ancienCorps}.${b64url(new Uint8Array(await crypto.subtle.sign('HMAC', cleHmac, new TextEncoder().encode(ancienCorps))))}`;
  const ancienne = await lireSession(secret, ancien, s0);
  verifier(ancienne?.e === LM && ancienne.p === A && ancienne.v === 2, 'ancien cookie sans espace : Label Maison');
  const operations = await signerSessionExterne(secret, { k: 'operations', p: A, e: LM, v: 1, exp: s0 + 3600 });
  verifier((await lireSession(secret, operations, s0)) === null && (await lireSessionExterne(secret, operations, 'operations', s0))?.k === 'operations', 'session des opérations : jamais valable comme propriétaire');
  const vueSens = vueProprietaire(e, A, { aujourdhui: '2026-09-24', conciergerie: { nom: 'Sens' } })!;
  verifier(vueSens.conciergerie.nom === 'Sens' && !vueSens.contacts && !/labelmaison|74954/i.test(JSON.stringify(vueSens)), 'vue d’un autre espace : son nom, aucun contact de Label Maison');
  verifier(vue.conciergerie.nom === 'Label Maison' && vue.contacts?.telephone === '+33 7 49 54 83 55', 'vue de Label Maison : ses contacts');

  console.log(`${ok} contrôles réussis, ${ko} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = ko ? 1 : 0;
}

void main();
