/**
 * Vérification de l'espace propriétaire (pur, sans réseau) : filtrage strict
 * par propriétaire, aucune donnée personnelle de voyageur, prorata d'un séjour
 * à cheval sur deux mois, bilans non publiés invisibles, liens à usage unique
 * et sessions signées, rattachées à l'espace qui a invité (Label Maison, Sens…).
 *
 * Lancement :
 *   node_modules/.bin/esbuild src/erp/data/verifier-proprietaire.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-proprietaire.mjs \
 *     && node /tmp/verifier-proprietaire.mjs
 */
import {
  bilanMensuel,
  bilansPublies,
  calendrierMois,
  chiffresPublics,
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
import { ID_PROPRIETAIRE_A_RENSEIGNER } from './repull';
import { ID_LABEL_MAISON } from './espaces';
import { lienAcces, lireLienAcces, lireSessionExterne, signerSessionExterne } from './acces-externe';
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
  commentaireVoyageur: 'AVIS-PRIVE',
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
  verifier(bilansPublies([truque], A, new Set(['log-a1', 'log-a2']))[0].chiffres.sejours.every((s) => s.logementId !== 'log-b'), 'bilan publié relu : ligne d’un autre logement retirée');
  verifier(chiffresPublics({ ...aout, sejours: [{ ...aout.sejours[0], voyageur: 'Camille Martin' }] }, new Set(['log-a1', 'log-a2'])).sejours[0].voyageur === 'Camille M.', 'bilan publié relu : voyageur réanonymisé');
  verifier(memesChiffres(aout, bilanMensuel(e, A, '2026-08')) && !memesChiffres(aout, sept), 'changement des chiffres depuis la publication détecté');

  /* démo */
  const seed = creerSeed();
  const demo = vueProprietaire(seed, 'pro-sci-tilleuls', { aujourdhui: '2026-09-24' })!;
  verifier(!!demo && demo.logements.length >= 1 && demo.bilans.length === 1 && demo.documents.length === 2, 'démo : SCI Les Tilleuls, un bilan publié, deux documents');
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
