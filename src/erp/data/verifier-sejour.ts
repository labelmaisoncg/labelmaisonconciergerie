/**
 * Auto-contrôle du livret d'accueil et du check-in en ligne (cahier B2),
 * sans réseau :
 *   - jeton : signé, lié à une réservation ET à un espace, même lien partout
 *     (fiche de la réservation, message automatique), toute retouche refusée,
 *     jamais confondu avec une session des espaces (même secret possible) ;
 *   - lien : après « # » (jamais dans une adresse lue par un serveur), expiré
 *     quelques jours après le départ, rien pour un séjour annulé ;
 *   - codes, wifi et guides d'accès : la règle de l'agent et des messages
 *     automatiques, à l'identique (48 h avant l'arrivée, séjour en cours),
 *     calculée par le serveur ; avant, textes masqués et aucun secret dans la
 *     vue ; la vue ne porte ni nom de famille, ni montant, ni propriétaire ;
 *   - formulaire : chaque champ contrôlé et borné, champs inconnus jetés,
 *     fiche de police seulement pour les voyageurs étrangers, modifiable
 *     jusqu'au jour de l'arrivée, nombre d'envois plafonné ;
 *   - purge : 6 mois après le départ, tout de suite pour un séjour annulé,
 *     dans la collection du check-in seulement ;
 *   - variable {lien_sejour} des messages automatiques ;
 *   - jamais pour l'IA, jamais dans les données chargées par le navigateur
 *     (ni dans une sauvegarde), règles SQL dans les trois fichiers, aucune
 *     écriture vers les plateformes ; démonstration (jeu de démo).
 *
 * Lancement (Node 18+, depuis la racine du dépôt) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-sejour.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-sejour.mjs \
 *     && node /tmp/verifier-sejour.mjs
 */
import { lireSessionExterne, signerSessionExterne } from './acces-externe';
import { COLLECTIONS } from './collections';
import { ID_LABEL_MAISON } from './espaces';
import { codesPermis } from './agent-messagerie';
import { CODE_MASQUE, contientCodeAcces } from './messagerie-ia';
import { TEXTES_DEFAUT, VARIABLES, codesAutorises, rendreMessage, texteAffiche, texteStocke } from './messages-programmes';
import { ecritureRepullPermise } from './repull-synchro';
import {
  COLLECTION_CHECKINS,
  JOURS_LIEN_APRES_DEPART,
  MAX_ENVOIS_CHECKIN,
  MESSAGES_ERREURS,
  MESSAGES_REFUS_CHECKIN,
  ajouterMoisISO,
  checkinsAPurger,
  codeProbable,
  codesVisibles,
  codesVisiblesLe,
  conservationJusquAu,
  dateValide,
  etatFormulaire,
  etatLienSejour,
  fichiersDeLaVue,
  jetonDuFragment,
  lienSejour,
  lireJetonSejour,
  lireSaisieCheckin,
  majeurLe,
  masquerCodesLivret,
  nouveauCheckin,
  purgerCheckins,
  signerJetonSejour,
  suiviCheckin,
  texteCacheAvant48h,
  texteSaisi,
  vueSejour,
  type BasePurge,
  type CheckinEnLigne,
  type SaisieCheckin,
} from './sejour';
import { creerSeed } from './seed';
import { TEXTES, texteApresArrivee, texteConsignes, texteFiche } from '../sejour/textes';
import type { FilMessages, Logement, Reservation, StatutReservation } from './types';

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string, detail?: unknown) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}${detail === undefined ? '' : ` : ${JSON.stringify(detail).slice(0, 500)}`}`);
  }
}
function section(titre: string) {
  console.log(`\n${titre}`);
}

type Fs = { readFileSync: (p: string, e: string) => string; existsSync: (p: string) => boolean; readdirSync: (p: string) => string[] };
type Chemins = { join: (...p: string[]) => string; dirname: (p: string) => string };
let fs: Fs;
let chemins: Chemins;
let racine = '';
const source = (f: string) => (racine ? fs.readFileSync(chemins.join(racine, f), 'utf8') : '');
/** Le code seul, sans les commentaires (« jamais l'IA » écrit dans un commentaire ne compte pas). */
const code = (f: string) => source(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* -------------------------------------------------------------- données */

const SECRET = 'secret-de-test-des-sejours-0123456789abcdef';
const SENS = '5e5e0000-0000-4000-8000-000000000002';
const AUJ = '2026-10-28';

const LOGEMENT: Logement = {
  id: 'log-1',
  nom: 'Studio M. Exemple (propriétaire)',
  adresse: '12 quai des Essais',
  ville: 'Corbeil-Essonnes',
  codePostal: '91100',
  type: 'T2',
  surfaceM2: 40,
  capacite: 4,
  chambres: 1,
  lits: [],
  statut: 'actif',
  proprietaireId: 'pro-exemple',
  residencePrincipale: false,
  serrure: 'boite_a_cles',
  fiche: {
    wifiNom: 'Livebox-Essai',
    wifiCode: 'soleil2026',
    heureArrivee: '16:00',
    heureDepart: '11:00',
    acces: 'Boîte à clés à gauche de la porte, code 4821.',
    parking: 'Portail du parking : code 7319, place 12.',
    regles: 'Pas de fête. Calme après 22 h.',
    equipements: ['Lave-linge'],
    aSavoir: 'Poubelles le mardi. Digicode immeuble 2468.',
    consignesDepart: 'Laissez les clés dans la boîte, code 4821.',
    questions: [
      { id: 'q1', question: 'Où est le sèche-cheveux ?', reponse: 'Dans la salle de bain.' },
      { id: 'q2', question: 'Le wifi ?', reponse: 'Réseau Livebox-Essai.' },
    ],
    guides: [
      { id: 'g-acces', titre: 'Récupérer la clé', media: { type: 'video', url: 'https://videos.exemple.invalid/cle' }, acces: true, ajouteLe: '2026-10-01T10:00:00+02:00', ajoutePar: 'Test' },
      { id: 'g-libre', titre: 'Le quartier', media: { type: 'document', fichier: 'stockage://erp-fichiers/logements/log-1/quartier.pdf' }, ajouteLe: '2026-10-01T10:00:00+02:00', ajoutePar: 'Test' },
    ],
  },
  descriptif: { titre: 'Studio lumineux au bord de l’eau', textes: { transports: 'RER D à 5 minutes.' }, conditions: { fetes: false, fumeur: false, animaux: true, calme: { debut: '22:00', fin: '07:00' } } },
  dotationLinge: [],
  annonces: [],
  checklistLancement: [],
  photosEquipe: ['stockage://erp-fichiers/logements/log-1/photos/a.jpg'],
};

function resa(p: Partial<Reservation> = {}): Reservation {
  return {
    id: 'res-1',
    logementId: 'log-1',
    canal: 'airbnb',
    voyageur: { nom: 'Alix Testeur', pays: 'GB', nbPersonnes: 2 },
    arrivee: '2026-11-10',
    depart: '2026-11-13',
    nuits: 3,
    statut: 'confirmee',
    montantBrutCentimes: 31400,
    commissionPlateformeCentimes: 4700,
    fraisMenageCentimes: 4000,
    ...p,
  };
}

const SAISIE: SaisieCheckin = {
  arriveeEstimee: '18:30',
  nbPersonnes: 2,
  reglesAcceptees: true,
  tousFrancais: false,
  fiches: [{ nom: 'Exemple', prenoms: 'Alex', naissanceLe: '1990-04-12', naissanceLieu: 'Exempleville, Pays d’essai', nationalite: 'Essai', domicile: '1 avenue de l’Exemple, Exempleville', enfants: 1 }],
};
const lire = (x: unknown, max = 4) => lireSaisieCheckin(x, { maxPersonnes: max, aujourdhui: AUJ });
const champs = (x: unknown, max = 4) => {
  const r = lire(x, max);
  return r.ok ? [] : r.erreurs.map((e) => (e.fiche === undefined ? e.champ : `${e.champ}#${e.fiche}`));
};

/* ================================================================ contrôles */

async function principal() {
  const proc = (globalThis as { process?: { versions?: { node?: string }; cwd(): string } }).process;
  if (proc?.versions?.node) {
    const nomFs = 'node:fs';
    const nomChemins = 'node:path';
    fs = (await import(/* @vite-ignore */ nomFs)) as unknown as Fs;
    chemins = (await import(/* @vite-ignore */ nomChemins)) as unknown as Chemins;
    let dossier = proc.cwd();
    for (let i = 0; i < 6 && !fs.existsSync(chemins.join(dossier, 'package.json')); i++) dossier = chemins.dirname(dossier);
    racine = fs.existsSync(chemins.join(dossier, 'src/erp/data/sejour.ts')) ? dossier : '';
  }

  section('1. Jeton : signé, lié à un séjour et à un espace');
  {
    const j = await signerJetonSejour(SECRET, { espace: SENS, reservationId: 'res-1' });
    const lu = await lireJetonSejour(SECRET, j);
    verifier(lu?.espace === SENS && lu.reservationId === 'res-1', 'jeton relu : son espace et sa réservation', lu);
    verifier(j === (await signerJetonSejour(SECRET, { espace: SENS.toUpperCase(), reservationId: 'res-1' })), 'même séjour, même jeton (lien copié = lien du message)');
    const autres = await Promise.all([
      signerJetonSejour(SECRET, { espace: SENS, reservationId: 'res-2' }),
      signerJetonSejour(SECRET, { espace: ID_LABEL_MAISON, reservationId: 'res-1' }),
      signerJetonSejour('un-autre-secret-de-trente-deux-caracteres', { espace: SENS, reservationId: 'res-1' }),
    ]);
    verifier(new Set([j, ...autres]).size === 4, 'autre réservation, autre espace ou autre secret : autre jeton');
    verifier((await lireJetonSejour('un-autre-secret-de-trente-deux-caracteres', j)) === null && (await lireJetonSejour('', j)) === null, 'autre secret (ou aucun) : refusé');
    const [corps, sig] = j.split('.');
    // Retouche du corps (autre espace, autre réservation) ou de la signature : refusée.
    const octets = Uint8Array.from(atob(corps.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (corps.length % 4)) % 4)), (c) => c.charCodeAt(0));
    const b64 = (o: Uint8Array) => btoa(String.fromCharCode(...o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const espaceChange = Uint8Array.from(octets);
    espaceChange.set([0x4c, 0x4d, 0x00, 0x00], 1);
    const idChange = Uint8Array.from(octets);
    idChange[idChange.length - 1] = '2'.charCodeAt(0);
    const sigChangee = `${sig.slice(0, -1)}${sig.endsWith('A') ? 'B' : 'A'}`;
    const refus = await Promise.all([`${b64(espaceChange)}.${sig}`, `${b64(idChange)}.${sig}`, `${corps}.${sigChangee}`].map((x) => lireJetonSejour(SECRET, x)));
    verifier(refus.every((x) => x === null), 'jeton retouché (espace, réservation ou signature) : refusé');
    const formes = ['', 'x', `${corps}.${sig}.x`, `${corps}`, `${corps}.${sig.slice(0, 40)}`, ' ' + j, `${'A'.repeat(300)}.${sig}`, 42, null, { jeton: j }];
    verifier((await Promise.all(formes.map((x) => lireJetonSejour(SECRET, x)))).every((x) => x === null), 'formes inattendues (vide, trop long, en trop, pas une chaîne) : refusées');
    // Même secret qu'une session des espaces (ACCES_SECRET) : jamais l'un pour l'autre.
    const session = await signerSessionExterne(SECRET, { k: 'operations', p: 'res-1', e: SENS, v: 1, exp: 4_000_000_000 });
    verifier((await lireJetonSejour(SECRET, session)) === null, 'une session des espaces ne vaut pas jeton de séjour');
    verifier((await lireSessionExterne(SECRET, j, 'operations', 1)) === null && (await lireSessionExterne(SECRET, j, 'proprietaire', 1)) === null, 'un jeton de séjour ne vaut pas session');
    let refuse = false;
    await signerJetonSejour(SECRET, { espace: 'sens', reservationId: 'res-1' }).catch(() => (refuse = true));
    verifier(refuse, 'espace illisible : aucun jeton signé');
    // Lien : sur le site, après « # » ; l'id de la réservation n'y est pas en clair.
    const lien = lienSejour('https://www.labelmaisoncg.fr/', j);
    verifier(lien === `https://www.labelmaisoncg.fr/sejour#${j}` && !lien.includes('?') && !lien.includes('res-1'), 'lien : /sejour#<jeton>, sans paramètre ni id en clair', lien);
    verifier(jetonDuFragment(`#${j}`) === j && jetonDuFragment(`#jeton=${j}`) === j && jetonDuFragment('#autre') === '' && jetonDuFragment('') === '', 'jeton lu dans le fragment, rien d’autre');
  }

  section('2. Lien : ouvert, annulé, expiré');
  {
    const r = resa();
    verifier(etatLienSejour(undefined, AUJ) === 'inconnu', 'réservation introuvable : inconnu');
    verifier(etatLienSejour({ ...r, statut: 'annulee' }, AUJ) === 'annule', 'réservation annulée : rien');
    verifier(etatLienSejour(r, AUJ) === 'ouvert' && etatLienSejour(r, '2026-11-13') === 'ouvert', 'avant et le jour du départ : ouvert');
    verifier(JOURS_LIEN_APRES_DEPART === 3 && etatLienSejour(r, '2026-11-16') === 'ouvert' && etatLienSejour(r, '2026-11-17') === 'expire', `ouvert jusqu’à ${JOURS_LIEN_APRES_DEPART} jours après le départ, puis expiré`);
    verifier(etatLienSejour({ ...r, depart: 'demain' }, AUJ) === 'expire' && etatLienSejour({ ...r, depart: '2026-02-30' }, AUJ) === 'expire', 'départ illisible : expiré (rien de montré)');
  }

  section('3. Codes : la règle de l’agent et des messages automatiques, à l’identique');
  {
    const statuts: StatutReservation[] = ['confirmee', 'en_cours', 'terminee', 'annulee'];
    const jours = Array.from({ length: 12 }, (_, i) => `2026-11-${String(5 + i).padStart(2, '0')}`);
    let identiques = true;
    for (const statut of statuts) {
      for (const jour of jours) {
        const r = resa({ statut });
        const fil = { logementId: 'log-1' } as FilMessages;
        if (codesVisibles(r, jour) !== codesAutorises(r, 'log-1', jour) || codesVisibles(r, jour) !== codesPermis(fil, r, jour).ok) identiques = false;
      }
    }
    verifier(identiques, 'codesVisibles = codesAutorises (messages) = codesPermis (agent), pour chaque statut et chaque jour');
    verifier(!codesVisibles(resa(), '2026-11-07') && codesVisibles(resa(), '2026-11-08') && codesVisibles(resa(), '2026-11-12') && !codesVisibles(resa(), '2026-11-13'), 'visibles de J-2 à la veille du départ, pas avant, pas le jour du départ');
    verifier(codesVisiblesLe('2026-11-10') === '2026-11-08', 'premier jour des codes : J-2');
    verifier(!codesVisibles(resa({ statut: 'annulee' }), '2026-11-11'), 'séjour annulé : jamais de code');
  }

  section('4. La vue du voyageur : ce qu’il faut, rien d’autre');
  {
    const avant = vueSejour({ conciergerie: 'Label Maison', reservation: resa(), logement: LOGEMENT, aujourdhui: AUJ, checkinOuvert: true }, (f) => `https://stockage.exemple.invalid/signe?f=${encodeURIComponent(f)}`);
    const texte = JSON.stringify(avant);
    verifier(avant.acces.visible === false && avant.acces.aPartirDu === '2026-11-08', '13 jours avant : pas d’accès, « à partir du » J-2', avant.acces);
    verifier(!contientCodeAcces(texte, LOGEMENT) && !/soleil2026|Livebox-Essai|4821|7319|2468|Récupérer la clé|videos\.exemple/.test(texte), 'avant l’heure : ni code, ni wifi, ni guide d’accès dans toute la vue', texte.slice(0, 300));
    verifier(avant.logement.aSavoir?.includes(CODE_MASQUE) && avant.logement.parking?.includes(CODE_MASQUE) && avant.logement.consignesDepart?.includes(CODE_MASQUE), 'à savoir, parking, consignes de départ : codes retirés, le reste montré', avant.logement);
    verifier(avant.logement.questions.length === 1 && avant.logement.questions[0].question.includes('sèche-cheveux'), 'question fréquente qui cite le wifi : pas montrée avant l’heure', avant.logement.questions);
    verifier(avant.prenom === 'Alix' && !/Testeur/.test(texte), 'prénom seul, jamais le nom de famille');
    verifier(!/31400|4700|4000|montant|commission|pro-exemple|propri[ée]taire|M\. Exemple|GB/.test(texte), 'ni montant, ni frais, ni propriétaire, ni pays du voyageur', texte.slice(0, 300));
    verifier(avant.logement.nom === 'Studio lumineux au bord de l’eau', 'nom du logement : le titre vu sur la plateforme (pas le nom interne)');
    // Champs montrés tels quels : un code du logement n'y passe pas non plus avant l'heure.
    const glisse = vueSejour({
      conciergerie: 'Label Maison',
      reservation: resa(),
      logement: {
        ...LOGEMENT,
        adresse: '12 quai des Essais, digicode 4821',
        fiche: {
          ...LOGEMENT.fiche,
          heureArrivee: '16:00, boîte à clés 4821',
          guides: [...(LOGEMENT.fiche.guides ?? []), { id: 'g-mal-range', titre: 'Boîte à clés : 4821', media: { type: 'lien', url: 'https://exemple.invalid/g' }, ajouteLe: '2026-10-01T10:00:00.000Z', ajoutePar: 'Equipe' }],
        },
      },
      aujourdhui: AUJ,
      checkinOuvert: true,
    });
    verifier(!/4821/.test(JSON.stringify(glisse)) && glisse.logement.adresse === '91100 Corbeil-Essonnes' && !glisse.guides.some((g) => g.id === 'g-mal-range'), 'avant l’heure : ni l’heure d’arrivée, ni la rue, ni le titre d’un guide ne citent un code', glisse.logement);
    verifier(avant.guides.length === 1 && avant.guides[0].id === 'g-libre' && avant.guides[0].lien.startsWith('https://stockage.exemple.invalid/'), 'guide libre montré, en lien signé');
    verifier(avant.logement.photo?.startsWith('https://stockage.exemple.invalid/') === true, 'photo de l’équipe en lien signé');
    verifier(fichiersDeLaVue({ reservation: resa(), logement: LOGEMENT, aujourdhui: AUJ }).join() === 'stockage://erp-fichiers/logements/log-1/photos/a.jpg,stockage://erp-fichiers/logements/log-1/quartier.pdf', 'fichiers à signer : la photo et le guide libre seulement');
    verifier(!avant.logement.conditions && avant.logement.regles?.startsWith('Pas de fête') && avant.logement.transports === 'RER D à 5 minutes.' && avant.logement.adresse === '12 quai des Essais, 91100 Corbeil-Essonnes', 'règlement de l’équipe (pas un second règlement de l’annonce), transports, adresse');
    const sansRegles = vueSejour({ conciergerie: 'Label Maison', reservation: resa(), logement: { ...LOGEMENT, fiche: { ...LOGEMENT.fiche, regles: '' } }, aujourdhui: AUJ, checkinOuvert: true });
    verifier(sansRegles.logement.conditions?.fetes === false && sansRegles.logement.conditions?.calme?.debut === '22:00' && !sansRegles.logement.regles, 'sans règlement de l’équipe : les règles de l’annonce');
    verifier(avant.contact.plateforme === 'Airbnb' && /^https:\/\/www\.airbnb\./.test(avant.contact.lien ?? '') && !avant.contact.email && !avant.contact.telephone, 'contact : la messagerie Airbnb, rien d’autre');
    verifier(avant.checkin.ouvert && !avant.checkin.fait && avant.checkin.modifiable && !avant.checkin.saisie, 'check-in à faire, modifiable');

    const veille = vueSejour({ conciergerie: 'Label Maison', reservation: resa(), logement: LOGEMENT, aujourdhui: '2026-11-09', checkinOuvert: true }, () => undefined);
    verifier(veille.acces.visible && veille.acces.wifi?.code === 'soleil2026' && veille.acces.texte?.includes('4821') && veille.acces.guides.map((g) => g.id).join() === 'g-acces', 'la veille : accès, wifi et guide d’accès');
    verifier(veille.logement.questions.length === 2 && veille.logement.aSavoir?.includes('2468') && !veille.logement.photo, 'la veille : textes entiers ; fichier non signé : pas montré');
    verifier(fichiersDeLaVue({ reservation: resa(), logement: LOGEMENT, aujourdhui: '2026-11-09' }).length === 2, 'guide d’accès en lien https : rien de plus à signer');
    const direct = vueSejour({ conciergerie: 'Sens', reservation: resa({ canal: 'direct' }), logement: LOGEMENT, aujourdhui: AUJ, checkinOuvert: false, contacts: { email: 'bonjour@exemple.invalid', telephone: '01 23 45 67 89' } });
    verifier(!direct.contact.plateforme && direct.contact.email === 'bonjour@exemple.invalid' && !direct.checkin.modifiable && !direct.checkin.ouvert, 'séjour direct : contacts de la conciergerie ; base pas prête : check-in fermé');
    const sansFiche = vueSejour({ conciergerie: 'Sens', reservation: resa({ voyageur: { nom: '', nbPersonnes: 1 } }), aujourdhui: AUJ, checkinOuvert: true });
    verifier(sansFiche.prenom === '' && sansFiche.logement.capacite === 16 && sansFiche.acces.visible === false, 'logement inconnu : vue minimale, sans erreur');
  }

  section('5. Formulaire : chaque champ contrôlé et borné');
  {
    const ok = lire(SAISIE);
    verifier(ok.ok && ok.saisie.fiches[0].enfants === 1 && ok.saisie.fiches[0].nom === 'Exemple', 'voyageur étranger : saisie complète acceptée');
    const fr = lire({ arriveeEstimee: '09:05', nbPersonnes: '3', reglesAcceptees: true, tousFrancais: true, fiches: SAISIE.fiches });
    verifier(fr.ok && fr.saisie.fiches.length === 0 && fr.saisie.nbPersonnes === 3, 'tous français : aucune fiche gardée, même envoyée');
    verifier(champs({}).join() === 'arriveeEstimee,nbPersonnes,reglesAcceptees,tousFrancais', 'formulaire vide : chaque champ signalé', champs({}));
    verifier(['24:00', '9:30', '12:60', '12h30', ''].every((h) => champs({ ...SAISIE, arriveeEstimee: h }).join() === 'arriveeEstimee'), 'heure : HH:MM de 00:00 à 23:59 seulement');
    verifier([0, 5, -1, 2.5, '2a'].every((n) => champs({ ...SAISIE, nbPersonnes: n }).includes('nbPersonnes')), 'voyageurs : de 1 à la capacité du logement');
    verifier(champs({ ...SAISIE, nbPersonnes: 12 }, 0).length === 0 && champs({ ...SAISIE, nbPersonnes: 17 }, 0).includes('nbPersonnes'), 'capacité inconnue : 16 au plus');
    verifier(champs({ ...SAISIE, reglesAcceptees: 'true' }).join() === 'reglesAcceptees', 'règlement : accepté explicitement (true), rien d’autre');
    verifier(champs({ ...SAISIE, fiches: [] }).join() === 'fiches', 'voyageur étranger sans fiche : refusé');
    verifier(champs({ ...SAISIE, nbPersonnes: 1 }).join() === 'fiches', 'fiche et enfants plus nombreux que les voyageurs : refusé');
    const f0 = SAISIE.fiches[0];
    verifier(champs({ ...SAISIE, fiches: [{ ...f0, nom: '' }] }).join() === 'nom#0' && champs({ ...SAISIE, fiches: [{ ...f0, nom: 'A'.repeat(81) }] }).join() === 'nom#0' && champs({ ...SAISIE, fiches: [{ ...f0, nom: 'A'.repeat(80) }] }).length === 0, 'nom : obligatoire, 80 signes au plus');
    verifier(champs({ ...SAISIE, fiches: [{ ...f0, domicile: 'x'.repeat(201) }] }).join() === 'domicile#0' && champs({ ...SAISIE, fiches: [{ ...f0, nationalite: 'x'.repeat(61) }] }).join() === 'nationalite#0', 'domicile 200 signes, nationalité 60 signes au plus');
    verifier(['2026-02-30', '1899-12-31', '2026-10-29', '12/04/1990', ''].every((d) => champs({ ...SAISIE, fiches: [{ ...f0, naissanceLe: d }] }).join() === 'naissanceLe#0'), 'date de naissance : réelle, entre 1900 et aujourd’hui');
    verifier(champs({ ...SAISIE, nbPersonnes: 4, fiches: [{ ...f0, enfants: 11 }] }).join() === 'enfants#0' && champs({ ...SAISIE, fiches: [{ ...f0, enfants: undefined }] }).length === 0, 'enfants : 0 à 10, 0 par défaut');
    verifier(champs({ ...SAISIE, nbPersonnes: 4, fiches: [f0, { ...f0, prenoms: ' ' }, f0] }).join() === 'prenoms#1,fiches', 'plusieurs fiches : l’erreur dit laquelle', champs({ ...SAISIE, nbPersonnes: 4, fiches: [f0, { ...f0, prenoms: ' ' }, f0] }));
    const sale = lire({ ...SAISIE, passeport: 'X1234567', photo: 'data:image/png;base64,AAAA', fiches: [{ ...f0, nom: `  Ex${String.fromCharCode(0)}em${String.fromCharCode(0x200b)}ple \n `, numeroPiece: 'AB123', photo: 'data:x' }] });
    const texteSale = JSON.stringify(sale);
    verifier(sale.ok && sale.saisie.fiches[0].nom === 'Ex em ple' && !/X1234567|data:|AB123|passeport|numeroPiece|photo/.test(texteSale), 'champs inconnus jetés (pièce, photo), caractères invisibles retirés', texteSale);
    verifier(texteSaisi('a'.repeat(1000), 80) === null && texteSaisi(42, 80) === null && texteSaisi('  ', 80) === null && texteSaisi('Élise', 80) === 'Élise', 'texte : chaîne, non vide, bornée');
    verifier(lire({ ...SAISIE, fiches: Array.from({ length: 40 }, () => f0) }, 16).ok === false, 'fiches en masse : refusées');
    verifier(Object.values(MESSAGES_ERREURS).every((m) => m.fr && m.en) && Object.values(MESSAGES_REFUS_CHECKIN).every((m) => m.fr && m.en), 'chaque message en français et en anglais');
  }

  section('6. Enregistrement : modifiable jusqu’au jour de l’arrivée, envois plafonnés');
  {
    const r = resa();
    const premier = nouveauCheckin(undefined, SAISIE, { reservation: r, langue: 'en', maintenant: '2026-10-28T10:00:00.000Z', aujourdhui: AUJ });
    verifier(premier.ok && premier.checkin.id === 'res-1' && premier.checkin.envois === 1 && premier.checkin.langue === 'en' && !premier.checkin.modifieLe && premier.checkin.conserverJusquAu === '2027-05-13', 'premier envoi : une ligne par séjour, conservation au départ + 6 mois', premier);
    if (premier.ok) {
      const second = nouveauCheckin(premier.checkin, { ...SAISIE, arriveeEstimee: '20:00' }, { reservation: r, langue: 'fr', maintenant: '2026-11-10T09:00:00.000Z', aujourdhui: '2026-11-10' });
      verifier(second.ok && second.checkin.envois === 2 && second.checkin.envoyeLe === premier.checkin.envoyeLe && second.checkin.modifieLe === '2026-11-10T09:00:00.000Z', 'modifié le jour de l’arrivée : même ligne, deuxième envoi');
      const apres = nouveauCheckin(premier.checkin, SAISIE, { reservation: r, langue: 'fr', maintenant: 'x', aujourdhui: '2026-11-11' });
      verifier(!apres.ok && apres.raison === 'ferme', 'le lendemain de l’arrivée : plus modifiable');
      const limite = nouveauCheckin({ ...premier.checkin, envois: MAX_ENVOIS_CHECKIN }, SAISIE, { reservation: r, langue: 'fr', maintenant: 'x', aujourdhui: AUJ });
      verifier(!limite.ok && limite.raison === 'limite', `au-delà de ${MAX_ENVOIS_CHECKIN} envois : refusé`);
      const vue = vueSejour({ conciergerie: 'Label Maison', reservation: r, logement: LOGEMENT, checkin: premier.checkin, aujourdhui: AUJ, checkinOuvert: true });
      verifier(
        vue.checkin.fait && vue.checkin.saisie?.arriveeEstimee === SAISIE.arriveeEstimee && vue.checkin.saisie.fiches.length === 0 && vue.checkin.fichesEnvoyees?.fiches === 1 && vue.checkin.fichesEnvoyees.personnes === 2 && !/Exemple|1990-04-12|avenue/.test(JSON.stringify(vue)),
        'avant l’arrivée : la saisie revient pour être corrigée, SANS les fiches de police (leur nombre seulement)',
        vue.checkin,
      );
      // Modification « garder les fiches » : reprises de la ligne gardée, jamais du navigateur.
      const garde = lireSaisieCheckin({ ...SAISIE, arriveeEstimee: '21:00', fiches: [], garderFiches: true }, { maxPersonnes: 4, aujourdhui: AUJ, fichesPrecedentes: premier.checkin.fiches });
      verifier(garde.ok && garde.saisie.fiches[0].nom === 'Exemple' && !('garderFiches' in garde.saisie), 'garder les fiches : reprises de la ligne gardée', garde);
      const sansPrecedent = lireSaisieCheckin({ ...SAISIE, fiches: [], garderFiches: true }, { maxPersonnes: 4, aujourdhui: AUJ });
      verifier(!sansPrecedent.ok, 'garder les fiches sans fiche gardée : refusé');
      const tropPeu = lireSaisieCheckin({ ...SAISIE, nbPersonnes: 1, fiches: [], garderFiches: true }, { maxPersonnes: 4, aujourdhui: AUJ, fichesPrecedentes: premier.checkin.fiches });
      verifier(!tropPeu.ok, 'fiches gardées plus nombreuses que les voyageurs : refusé');
      const ligne = nouveauCheckin(premier.checkin, { ...SAISIE, garderFiches: true }, { reservation: r, langue: 'fr', maintenant: 'x', aujourdhui: AUJ });
      verifier(ligne.ok && !('garderFiches' in ligne.checkin), 'garderFiches : jamais enregistré');
      // Fiche de la réservation : les fiches de police aux gérants seulement.
      const ops = suiviCheckin(premier.checkin, false);
      verifier(suiviCheckin(premier.checkin, true).checkin?.fiches[0]?.nom === 'Exemple' && ops.checkin?.fiches.length === 0 && ops.fichesReservees === 1 && !JSON.stringify(ops).includes('Exemple'), 'compte « opérations » : check-in sans les fiches de police, leur nombre seulement', ops);
      const plusTard = vueSejour({ conciergerie: 'Label Maison', reservation: r, logement: LOGEMENT, checkin: premier.checkin, aujourdhui: '2026-11-12', checkinOuvert: true });
      verifier(plusTard.checkin.fait && !plusTard.checkin.saisie && !plusTard.checkin.modifiable && !JSON.stringify(plusTard).includes('Exemple'), 'après l’arrivée : « fait », la fiche de police ne ressort plus par le lien');
    }
    verifier(nouveauCheckin(undefined, SAISIE, { reservation: r, langue: 'fr', maintenant: 'x', aujourdhui: '2026-11-12' }).ok, 'premier envoi pendant le séjour : permis (fiche à remplir dès l’arrivée)');
    verifier(!etatFormulaire(r, undefined, '2026-11-13').modifiable && etatFormulaire({ ...r, statut: 'annulee' }, undefined, AUJ).raison === 'annule', 'le jour du départ, ou séjour annulé : rien');
  }

  section('7. Purge : 6 mois après le départ, tout de suite pour un séjour annulé');
  {
    verifier(ajouterMoisISO('2026-08-31', 6) === '2027-02-28' && ajouterMoisISO('2027-08-31', 6) === '2028-02-29' && ajouterMoisISO('2026-11-13', 6) === '2027-05-13' && conservationJusquAu('2026-12-15') === '2027-06-15', 'six mois : fin de mois ramenée, années bissextiles');
    verifier(dateValide('2028-02-29') && !dateValide('2027-02-29') && !dateValide('2026-13-01'), 'dates réelles seulement');
    const c = (id: string, conserverJusquAu: string) => ({ id, reservationId: id, conserverJusquAu });
    const lignes = [c('garde', '2027-05-13'), c('fini', '2027-05-13'), c('annule', '2027-05-13'), c('orphelin-vieux', '2026-01-01'), c('orphelin-recent', '2027-01-01'), c('illisible', 'jamais'), c('dates-deplacees', '2026-01-01')];
    const reservations = [
      resa({ id: 'garde' }),
      resa({ id: 'fini', depart: '2026-04-27' }),
      resa({ id: 'annule', statut: 'annulee' }),
      resa({ id: 'dates-deplacees', depart: '2026-11-20' }),
    ];
    verifier(checkinsAPurger(lignes, reservations, '2026-10-27').join() === 'annule,orphelin-vieux,illisible', 'le dernier jour (départ + 6 mois) : gardé ; annulé, sans date, réservation partie et date passée : effacés', checkinsAPurger(lignes, reservations, '2026-10-27'));
    verifier(checkinsAPurger(lignes, reservations, '2026-10-28').join() === 'fini,annule,orphelin-vieux,illisible', 'le lendemain : effacé ; dates déplacées : la nouvelle date fait foi', checkinsAPurger(lignes, reservations, '2026-10-28'));
    const supprimes: { collection: string; ids: string[] }[] = [];
    const base: BasePurge = {
      lire: async <T,>(collection: string, ids?: string[]) => (collection === COLLECTION_CHECKINS ? lignes : reservations.filter((r) => !ids || ids.includes(r.id))) as T[],
      supprimer: async (collection, ids) => {
        supprimes.push({ collection, ids });
        return ids.length;
      },
    };
    const n = await purgerCheckins(base, '2026-10-28');
    verifier(n === 4 && supprimes.length === 1 && supprimes[0].collection === COLLECTION_CHECKINS && supprimes[0].ids.join() === 'fini,annule,orphelin-vieux,illisible', 'purge d’un espace : une suppression, dans la collection des check-ins seulement', supprimes);
    const vide: BasePurge = { lire: async <T,>() => [] as T[], supprimer: async () => { throw new Error('rien à effacer'); } };
    verifier((await purgerCheckins(vide, AUJ)) === 0, 'aucun check-in : rien de lu en plus, rien d’effacé');
  }

  section('8. Variable {lien_sejour} des messages automatiques');
  {
    const v = VARIABLES.find((x) => x.cle === 'lien_sejour');
    verifier(v?.libelle === 'Lien du livret' && v.retirerSiVide && !v.sensible && !v.moments, 'variable « Lien du livret » : tous les moments, ligne retirée sans lien');
    verifier(texteAffiche('{lien_sejour}') === '{Lien du livret}' && texteStocke('{Lien du livret}') === '{lien_sejour}', 'écran ↔ base (la clé {lien_sejour} ne change pas)');
    verifier(TEXTES_DEFAUT.confirmation.includes('{lien_sejour}') && TEXTES_DEFAUT.veille_arrivee.includes('{lien_sejour}') && !TEXTES_DEFAUT.veille_arrivee.includes('{lien_guide}'), 'confirmation et infos d’arrivée : le livret seulement (il montre les guides)');
    verifier(VARIABLES.some((x) => x.cle === 'lien_guide') && texteStocke('{Lien du guide}') === '{lien_guide}', '{lien_guide} reste une variable et garde son sens');
    const modele = 'Bonjour {prenom},\nVotre livret : {lien_sejour}\nÀ bientôt';
    const base = { reservation: resa(), logement: LOGEMENT, signature: 'L’équipe', aujourdhui: AUJ };
    const lien = 'https://www.labelmaisoncg.fr/sejour#abc.def';
    verifier(rendreMessage(modele, { ...base, lienSejour: lien }).texte.includes(`Votre livret : ${lien}`), 'avec le lien : la ligne part');
    verifier(!rendreMessage(modele, base).texte.includes('livret') && rendreMessage(modele, base).retirees.includes('lien_sejour'), 'sans lien (secret absent) : la ligne est retirée');
    verifier(!rendreMessage(modele, { ...base, reservation: resa({ statut: 'annulee' }), lienSejour: lien }).texte.includes(lien), 'séjour annulé : jamais le lien');
    verifier(!rendreMessage(TEXTES_DEFAUT.confirmation, { ...base, lienSejour: lien }).codesEnClair, 'le lien ne porte aucun code (message de confirmation permis hors des 48 h)');
    if (racine) {
      verifier(/variables\.includes\('lien_sejour'\) && this\.o\.lienSejour/.test(code('src/erp/data/passage-programmes.ts')) && /lienSejour,\s*aujourdhui/.test(code('src/erp/data/passage-programmes.ts')), 'passage des messages : le lien demandé au serveur seulement si le texte le cite');
      verifier(/lienSejour: \(r\) => lienSejourServeur\(c\.espace, r\.id\)/.test(code('api/_erp-programmes.ts')), 'serveur : le lien signé dans l’espace du passage');
    }
  }

  section('9. Jamais pour l’IA, jamais chargé par le navigateur, règles SQL, plateformes en lecture seule');
  {
    verifier(!(COLLECTIONS as string[]).includes(COLLECTION_CHECKINS), 'collection hors des données de l’ERP (store, export « Télécharger une sauvegarde »)');
    verifier(!ecritureRepullPermise('PUT', '/v1/availability/1', { available: false }) && !ecritureRepullPermise('PATCH', '/v1/listings/1', { name: 'x' }), 'verrou des plateformes inchangé');
    if (racine) {
      // Fichiers qui donnent quelque chose à l'IA (agent, assistant, connecteurs, agent externe) : rien du check-in.
      const ia = [
        'src/erp/data/agent-messagerie.ts',
        'src/erp/data/agent-assistant.ts',
        'src/erp/data/messagerie-ia.ts',
        'src/erp/data/cm-mcp.ts',
        'src/erp/data/crm-mcp.ts',
        'src/erp/data/crm-assistant.ts',
        'src/erp/data/briefing.ts',
        'api/_erp-agent.ts',
        'api/_erp-agent-assistant.ts',
        'api/_erp-mcp.ts',
        'api/_crm-mcp-http.ts',
        'api/erp-agent.ts',
        ...fs.readdirSync(chemins.join(racine, 'agent-ia/src')).filter((f) => f.endsWith('.ts')).map((f) => `agent-ia/src/${f}`),
      ];
      const fautifs = ia.filter((f) => /checkinsEnLigne|COLLECTION_CHECKINS|FichePolice|naissanceLe|data\/sejour|_sejour\.js/.test(code(f).replace(/purgeCheckinsDuJour[^\n]*|import \{ purgeCheckinsDuJour \} from '\.\/_sejour\.js';/g, '')));
      verifier(fautifs.length === 0, 'agent, assistant, connecteurs MCP, agent IA externe : rien du check-in', fautifs);
      verifier(/purgeCheckinsDuJour\(\{ limite: Date\.now\(\) \+ 5_000 \}\)/.test(code('api/erp-agent.ts')), 'passage planifié : la purge, avec les autres travaux du matin');
      for (const f of ['supabase/erp-espaces.sql', 'supabase/erp-installation.sql', 'supabase/erp-acces-gerants.sql']) {
        const s = source(f);
        verifier(
          /'reglagesRelances', 'checkinsEnLigne'\)/.test(s) &&
            /'connecteurs', 'checkinsEnLigne'\)/.test(s) &&
            /if old\.collection = 'checkinsEnLigne' then\s+return case when tg_op = 'DELETE' then old else new end;/.test(s) &&
            /create or replace function erp\.checkin_en_ligne_pret\(\)/.test(s) &&
            /delete from erp\.historique where collection = 'checkinsEnLigne';/.test(s),
          `${f} : gérants seulement (et leurs anciennes versions), jamais archivé, fonction « prêt »`,
        );
      }
      verifier(/un compte « opérations » lit les check-ins en ligne/.test(source('supabase/erp-espaces.sql')) && /un check-in en ligne est archivé/.test(source('supabase/erp-acces-gerants.sql')), 'recettes SQL : lecture par l’équipe et archive refusées');
      for (const f of ['api/sejour.ts', 'api/_sejour.ts', 'src/erp/data/sejour.ts']) {
        const s = code(f);
        verifier(!/ClientRepull|repull\.dev|\/v1\/|envoyerMessage|anthropic|Anthropic/.test(s), `${f} : ni plateforme, ni envoi au voyageur, ni IA`);
        const relatifs = [...s.matchAll(/^import (?!type )[^;]*?from '(\.[^']+)'/gm)].map((m) => m[1]);
        verifier(relatifs.length > 0 && relatifs.every((i) => i.endsWith('.js')), `${f} : imports relatifs en .js (Node)`, relatifs);
      }
      const route = code('api/sejour.ts');
      verifier(/provenanceSite\(req\)/.test(route) && /TAILLE_MAX_ENVOI/.test(route) && /tropDEnvois\(ip\)/.test(route) && /remplacerSi\(COLLECTION_CHECKINS/.test(route) && /ajouterSiAbsent\(COLLECTION_CHECKINS/.test(route), 'route : provenance du site, taille, frein, écriture conditionnelle');
      verifier(/verifierMembre\(jeton, \{ espace: espaceDemande\(req\) \}\)/.test(route) && /baseAcces\(membre\.espace\)/.test(route), 'équipe : session et espace du membre');
      verifier(!/\.query\?\.jeton|searchParams\.get\('jeton'\)/.test(route), 'le jeton n’est jamais lu dans l’adresse de l’appel');
      const page = code('src/app/pages/Sejour.tsx');
      verifier(/jetonDuFragment\(window\.location\.hash\)/.test(page) && /method: 'POST'/.test(page) && !/\?jeton=/.test(page), 'page : jeton lu après « # », envoyé dans le corps');
      verifier(!/codesVisibles|codesAutorises|masquerCodes/.test(code('src/erp/sejour/LivretSejour.tsx')), 'page : n’applique pas la règle des codes elle-même (le serveur le fait)');
    }
  }

  section('10. Démonstration : le livret du jeu de démo');
  {
    const d = creerSeed();
    const prochaines = d.reservations.filter((r) => r.statut === 'confirmee').sort((a, b) => a.arrivee.localeCompare(b.arrivee));
    verifier(prochaines.length > 0, 'jeu de démo : des séjours à venir');
    let propres = true;
    for (const r of prochaines.slice(0, 20)) {
      const l = d.logements.find((x) => x.id === r.logementId);
      const aujourdhui = '2026-01-01' < r.arrivee ? r.arrivee.slice(0, 8) + '01' : r.arrivee;
      const vue = vueSejour({ conciergerie: 'Label Maison', reservation: r, logement: l, aujourdhui, checkinOuvert: true });
      if (!vue.acces.visible && contientCodeAcces(JSON.stringify(vue), l)) propres = false;
    }
    verifier(propres, 'jeu de démo : aucun code avant l’heure, séjour par séjour');
    const c: CheckinEnLigne | undefined = (() => {
      const r = nouveauCheckin(undefined, SAISIE, { reservation: prochaines[0], langue: 'fr', maintenant: '2026-10-28T10:00:00.000Z', aujourdhui: prochaines[0].arrivee });
      return r.ok ? r.checkin : undefined;
    })();
    verifier(!!c && c.reservationId === prochaines[0].id, 'jeu de démo : check-in possible');
  }

  section('11. Relecture : codes courts, jour du départ, enfants, nom du logement');
  {
    // Codes écrits sans le mot « code », à côté d'un mot d'accès.
    const codes = [
      'Portail du parking : 482.', 'Dans la boîte B7Z', '482 au portail', 'Cadenas du local vélo 1234', 'Badge A12 sur le trousseau', 'Interphone 12B', 'Boîte aux lettres, code 0042', 'Digicode : 12#4',
      // Chiffres espacés, autres mots d'accès (dont l'anglais), code loin du mot.
      'Portail du parking : 4 8 2.', 'Le code est le 4.8.2', 'Gate code: 4-8-2', 'Gate: 482', 'Keybox 482 on the left', 'Lockbox: B7Z', 'Garage : 482', 'Grille du parking : 482', 'Barrière : 482', 'Coffre à clés : 482', 'Télécommande du garage, bip 482',
      'Portail du parking, tout au fond à droite après les poubelles : 482',
    ];
    const pasCodes = [
      'Code postal 91100',
      'Le portail ferme à 22h',
      'Portail ouvert de 8h à 20h',
      'Porte au 3e étage',
      'Porte gauche, 3ème étage',
      'Boîte aux lettres au rez-de-chaussée',
      'Portail à 200 m de la gare',
      'Porte 12',
      'Le parking est à 300 m, la porte bleue',
      'Badge pour la salle de sport (20 € la semaine)',
      'RER D à 5 minutes',
      '',
      undefined,
    ];
    const ratesCodes = codes.filter((t) => !codeProbable(t));
    const fauxCodes = pasCodes.filter((t) => codeProbable(t));
    verifier(ratesCodes.length === 0, 'code court près de portail, boîte, cadenas, badge, interphone, digicode : vu', ratesCodes);
    verifier(fauxCodes.length === 0, 'code postal, heures, étages, distance, montant, durée : pas un code', fauxCodes);
    verifier(!codeProbable(`Clés dans la boîte, ${CODE_MASQUE}.`) && !codeProbable(CODE_MASQUE), 'le code déjà masqué ne compte pas (« 48 heures »)');

    // Wifi écrit hors de la case wifi, avec des chiffres : cherché avant le masquage (jamais « soleil[code…] »).
    const wifiGlisse = vueSejour({ conciergerie: 'Label Maison', reservation: resa(), logement: { ...LOGEMENT, fiche: { ...LOGEMENT.fiche, aSavoir: 'Le wifi : soleil2026, réseau Livebox-Essai.', parking: 'Mot de passe soleil2026 aussi pour le portail' } }, aujourdhui: AUJ, checkinOuvert: true });
    verifier(!wifiGlisse.logement.aSavoir && !wifiGlisse.logement.parking && !/soleil|Livebox/i.test(JSON.stringify(wifiGlisse)), 'avant l’heure : un texte qui cite le wifi n’est pas montré, même en partie', wifiGlisse.logement);

    // Livret : un texte qui cite un tel code attend les 48 h, entier.
    const court: Logement = { ...LOGEMENT, fiche: { ...LOGEMENT.fiche, parking: 'Portail du parking : 482.', regles: 'Dans la boîte B7Z, les clés du local.', aSavoir: 'Poubelles le mardi.' } };
    const tot = vueSejour({ conciergerie: 'Label Maison', reservation: resa(), logement: court, aujourdhui: AUJ, checkinOuvert: true });
    verifier(!tot.logement.parking && !tot.logement.regles && !/482|B7Z/.test(JSON.stringify(tot)), 'avant les 48 h : parking et règlement avec un code court pas montrés', tot.logement);
    verifier(tot.logement.aSavoir === 'Poubelles le mardi.' && tot.logement.conditions?.fetes === false, 'le reste est montré ; sans règlement montrable, les règles de l’annonce');
    const dedans = vueSejour({ conciergerie: 'Label Maison', reservation: resa(), logement: court, aujourdhui: '2026-11-09', checkinOuvert: true });
    verifier(dedans.logement.parking === 'Portail du parking : 482.' && dedans.logement.regles?.includes('B7Z'), 'dans les 48 h : montrés');
    if (racine) {
      const fiche = code('src/erp/modules/logements/onglets/FicheVoyageur.tsx');
      verifier(['f.parking', 'f.consignesDepart', 'f.regles', 'f.aSavoir'].every((c) => fiche.includes(`aideOuCode(${c}, enCours`)) && /aideOuCode\(edition\.reponse, logement\)/.test(code('src/erp/modules/logements/onglets/GuidesFiche.tsx')) && /logement=\{enCours\}/.test(fiche), 'fiche voyageur : l’avertissement sous parking, consignes, règles, à savoir, réponses (logement en cours d’édition)');
      verifier(/Un code semble écrit ici : ce texte restera caché au voyageur jusqu’à 48 h avant l’arrivée\./.test(source('src/erp/modules/logements/_composants/avertissementCode.tsx')) && /texteCacheAvant48h\(texte, logement\)/.test(code('src/erp/modules/logements/_composants/avertissementCode.tsx')), 'avertissement : la conséquence (« ce texte restera caché au voyageur jusqu’à 48 h avant l’arrivée »), même règle que le livret');
    }

    // Le jour du départ : « pendant » jusqu'à l'heure de départ, codes cachés, plus de date « à partir du ».
    const jour = (aujourdhui: string, heure?: string, l: Logement = LOGEMENT) => vueSejour({ conciergerie: 'Label Maison', reservation: resa(), logement: l, aujourdhui, ...(heure ? { heure } : {}), checkinOuvert: true });
    const matin = jour('2026-11-13', '10:30');
    verifier(matin.moment === 'pendant' && matin.acces.visible === false && !('aPartirDu' in matin.acces) && !/4821|soleil2026/.test(JSON.stringify(matin)), 'départ à 10:30 (avant 11:00) : pendant, codes cachés, pas de « à partir du »', matin.acces);
    verifier(jour('2026-11-13', '11:00').moment === 'apres' && jour('2026-11-13', '12:15').moment === 'apres', 'à 11:00 et après : après le séjour');
    verifier(jour('2026-11-13').moment === 'pendant', 'heure inconnue : la journée du départ reste « pendant »');
    verifier(jour('2026-11-13', '10:30', { ...LOGEMENT, fiche: { ...LOGEMENT.fiche, heureDepart: '10:00' } }).moment === 'apres', 'heure de départ de la fiche (10:00) : après dès 10:30');
    verifier(jour('2026-11-13', '10:30', { ...LOGEMENT, fiche: { ...LOGEMENT.fiche, heureDepart: '' } }).moment === 'pendant', 'sans heure de départ : 11:00');
    verifier(jour('2026-11-12', '23:00').moment === 'pendant' && jour('2026-11-12', '23:00').acces.visible, 'la veille du départ : pendant, codes visibles');
    verifier(jour('2026-11-14', '09:00').moment === 'apres' && !('aPartirDu' in jour('2026-11-14', '09:00').acces), 'le lendemain : après, pas d’accès');
    verifier(jour(AUJ).acces.visible === false && (jour(AUJ).acces as { aPartirDu?: string }).aPartirDu === '2026-11-08', 'avant la fenêtre : la date « à partir du » reste');
    const consignes = matin.logement.consignesDepart ?? '';
    verifier(consignes.includes(CODE_MASQUE) && !consignes.includes('4821'), 'consignes de départ du dernier jour : code masqué', consignes);
    const fr = texteConsignes(consignes, 'fr');
    const en = texteConsignes(consignes, 'en');
    verifier(fr === 'Laissez les clés dans la boîte, code : le même qu’à votre arrivée.' && en === 'Laissez les clés dans la boîte, code: the same as on arrival.' && ![fr, en].some((x) => /[[\]]/.test(x)), 'consignes : « code : le même qu’à votre arrivée » / « code: the same as on arrival », sans crochets', [fr, en]);
    const formes: [string, string][] = [
      [`Clés dans la boîte, code : ${CODE_MASQUE}.`, 'Clés dans la boîte, code : le même qu’à votre arrivée.'],
      [`Boîte à clés : ${CODE_MASQUE}.`, 'Boîte à clés, code : le même qu’à votre arrivée.'],
      [`Clés dans la boîte ${CODE_MASQUE} à gauche.`, 'Clés dans la boîte, code : le même qu’à votre arrivée à gauche.'],
      [`Clés dans la boîte, ${CODE_MASQUE}.`, 'Clés dans la boîte, code : le même qu’à votre arrivée.'],
      [`Digicode ${CODE_MASQUE} pour sortir.`, 'Digicode, code : le même qu’à votre arrivée pour sortir.'],
      [`(${CODE_MASQUE})`, '(code : le même qu’à votre arrivée)'],
    ];
    const mal = formes.filter(([t, attendu]) => texteConsignes(t, 'fr') !== attendu).map(([t]) => texteConsignes(t, 'fr'));
    verifier(mal.length === 0, 'consignes : « code : » jamais doublé, ni crochet, ni espace avant la virgule', mal);
    // Autres textes le jour du départ : un code est « le même qu'à votre arrivée », un autre nombre « (masqué) ».
    const apres: [string, string][] = [
      [`Portail du parking : code ${CODE_MASQUE}, place 12.`, 'Portail du parking : code : le même qu’à votre arrivée, place 12.'],
      [`Digicode immeuble ${CODE_MASQUE}.`, 'Digicode immeuble, code : le même qu’à votre arrivée.'],
      [`Appartement ${CODE_MASQUE}, 12e étage.`, 'Appartement (masqué), 12e étage.'],
      [`Urgence : appelez le ${CODE_MASQUE}.`, 'Urgence : appelez le (masqué).'],
      [`Résidence de ${CODE_MASQUE}, 91100 Corbeil-Essonnes. Boîte aux lettres ${CODE_MASQUE}.`, 'Résidence de (masqué), 91100 Corbeil-Essonnes. Boîte aux lettres, code : le même qu’à votre arrivée.'],
    ];
    const malApres = apres.filter(([t, attendu]) => texteApresArrivee(t, 'fr') !== attendu).map(([t]) => texteApresArrivee(t, 'fr'));
    verifier(malApres.length === 0 && texteApresArrivee(`Flat ${CODE_MASQUE}, 12th floor.`, 'en') === 'Flat (hidden), 12th floor.', 'jour du départ : « le même qu’à votre arrivée » seulement pour un code, sinon « (masqué) »', malApres);
    verifier(
      texteFiche(`Appartement ${CODE_MASQUE}, 12e étage.`, 'fr') === 'Appartement (affiché 48 h avant l’arrivée), 12e étage.' && texteFiche(`Flat ${CODE_MASQUE}.`, 'en') === 'Flat (shown 48 h before arrival).',
      'avant 48 h : un nombre qui n’est pas après un mot d’accès est « (affiché 48 h avant l’arrivée) »',
    );
    verifier(TEXTES.fr.accesJourDepart.includes('arrivée') && TEXTES.en.codeAttente === 'Your access code will appear here 48 hours before arrival' && TEXTES.en.questionsTitre === 'FAQs', 'textes du jour du départ et anglais revus');
    verifier(!('departAvant' in TEXTES.fr) && !('heureArriveeAide' in TEXTES.fr) && TEXTES.fr.checkinEnCours === 'Il reste votre check-in : deux minutes.' && TEXTES.en.checkinEnCours === 'Your check-in is still missing: two minutes.', '« Départ avant » et l’aide de l’heure retirés ; check-in pendant le séjour');
    if (racine) {
      const livret = code('src/erp/sejour/LivretSejour.tsx');
      verifier(/vue\.moment !== 'apres' &&/.test(livret) && /vue\.moment === 'pendant' \?[\s\S]{0,80}\{carteAcces\}[\s\S]{0,40}\{carteCheckinEl\}/.test(livret), 'livret : pas d’accès après le séjour ; pendant, l’accès avant le check-in');
      verifier(/texteConsignes\(l\.consignesDepart, langue\)/.test(livret) && !/departAvant/.test(livret), 'livret : consignes avec le code de l’arrivée, plus de « Départ avant »');
    }

    // Enfants : seulement sur la fiche d'un adulte (18 ans le jour de l'arrivée).
    const avecEnfant = (naissanceLe: string, enfants = 1) => ({ ...SAISIE, nbPersonnes: 3, fiches: [{ ...SAISIE.fiches[0], naissanceLe, enfants }] });
    const lireA = (x: unknown) => {
      const res = lireSaisieCheckin(x, { maxPersonnes: 4, aujourdhui: AUJ, arrivee: '2026-11-10' });
      return res.ok ? [] : res.erreurs.map((e) => (e.fiche === undefined ? e.champ : `${e.champ}#${e.fiche}`));
    };
    verifier(lireA(avecEnfant('2010-05-01')).join() === 'enfantsMineur#0', '16 ans avec un enfant sur sa fiche : refusé', lireA(avecEnfant('2010-05-01')));
    verifier(lireA(avecEnfant('2010-05-01', 0)).length === 0, '16 ans sans enfant : accepté');
    verifier(lireA(avecEnfant('2008-11-10')).length === 0 && lireA(avecEnfant('2008-11-11')).join() === 'enfantsMineur#0', '18 ans le jour de l’arrivée : accepté ; la veille de ses 18 ans : refusé');
    verifier(champs(avecEnfant('2008-10-28')).length === 0 && champs(avecEnfant('2008-10-29')).join() === 'enfantsMineur#0', 'sans date d’arrivée : l’âge du jour');
    verifier(lireA(avecEnfant('2027-01-01')).join() === 'naissanceLe#0', 'date de naissance fausse : une seule erreur, la date');
    verifier(majeurLe('2008-02-29', '2026-02-28') && !majeurLe('2008-02-29', '2026-02-27'), 'né un 29 février : majeur le 28 février');
    verifier(/18/.test(MESSAGES_ERREURS.enfantsMineur.fr) && /18/.test(MESSAGES_ERREURS.enfantsMineur.en), 'message : « sur la fiche d’un adulte (18 ans ou plus) », FR et EN');
    if (racine) verifier(/arrivee: s\.reservation\.arrivee/.test(code('api/sejour.ts')) && /arrivee: vue\.arrivee/.test(code('src/erp/sejour/FormulaireCheckin.tsx')), 'serveur et page : l’âge au jour de l’arrivée');

    // Nom du logement : le titre de l'annonce, jamais le nom interne.
    const sansTitre = vueSejour({ conciergerie: 'Label Maison', reservation: resa(), logement: { ...LOGEMENT, descriptif: { ...LOGEMENT.descriptif, titre: '' } }, aujourdhui: AUJ, checkinOuvert: true });
    verifier(sansTitre.logement.nom === '' && sansTitre.logement.ville === 'Corbeil-Essonnes' && !/M\. Exemple|propri/.test(JSON.stringify(sansTitre)), 'sans titre d’annonce : pas de nom (la ville), jamais le nom interne', sansTitre.logement);
    if (racine) {
      const livret = code('src/erp/sejour/LivretSejour.tsx');
      verifier(/const nomLogement = l\.nom \|\| l\.ville;/.test(livret) && /\{nomLogement && </.test(livret) && !('votreLogement' in TEXTES.fr), 'livret : titre, sinon la ville, sinon aucune ligne (plus de « Votre logement »)');
      verifier(/vue\.moment !== 'apres' && \(\s*<a href=\{`https:\/\/www\.google\.com\/maps/.test(livret), 'livret : pas d’« Itinéraire » après le séjour');
    }

    // Code retiré montré sans crochets au voyageur (CODE_MASQUE de l'agent inchangé).
    const vus = [
      texteFiche(`Digicode immeuble ${CODE_MASQUE}.`, 'fr'),
      texteFiche(`Portail du parking : code ${CODE_MASQUE}.`, 'fr'),
      texteFiche(`Digicode immeuble ${CODE_MASQUE}.`, 'en'),
      texteFiche(`Portail du parking : code ${CODE_MASQUE}.`, 'en'),
    ];
    verifier(
      vus.join('|') ===
        ['Digicode immeuble (code communiqué 48 h avant l’arrivée).', 'Portail du parking : code (communiqué 48 h avant l’arrivée).', 'Digicode immeuble (code shared 48 h before arrival).', 'Portail du parking : code (shared 48 h before arrival).'].join('|'),
      'livret : « (code communiqué 48 h avant l’arrivée) », sans crochets ni « code » doublé, FR et EN',
      vus,
    );
    verifier(CODE_MASQUE === '[code communiqué dans les 48 heures avant l’arrivée]', 'CODE_MASQUE de l’agent inchangé');
    verifier(TEXTES.fr.vosDonnees === 'Vos données' && TEXTES.en.vosDonnees === 'Your data' && TEXTES.fr.fichesARemplir === 'Vous remplissez de nouveau les fiches.' && TEXTES.fr.garderFiches === 'Garder celles déjà envoyées', 'formulaire : repli « Vos données », « Vous remplissez de nouveau les fiches. » puis « Garder celles déjà envoyées »');
  }

  section('12. Clarté avant les 48 h : code postal, année, distance, numéro de bus lisibles ; codes toujours cachés');
  {
    const lisibles = [
      'Supermarché rue de la Gare, 91100 Corbeil-Essonnes.',
      'RER D à 1200 m, bus 4021 direction Évry.',
      'Appartement rénové en 2019, merci d’en prendre soin.',
      'Code postal : 91100.',
      'Ligne 4021 puis tram T1, arrêt n° 1234. Built in 1998, since 2005.',
      'Plage à 2500 m, 1500 € de caution, 1200 mètres de la gare.',
    ];
    const changes = lisibles.filter((t) => masquerCodesLivret(t) !== t);
    verifier(changes.length === 0, 'masquerCodesLivret : code postal, année, distance, montant, numéro de bus, de ligne et n° restent lisibles', changes.map((t) => masquerCodesLivret(t)));
    verifier(masquerCodesLivret('Supermarché à 300 m. Code 4821 du local, boîte 7319.') === `Supermarché à 300 m. Code ${CODE_MASQUE} du local, boîte ${CODE_MASQUE}.`, 'une suite inconnue reste masquée (filet de sécurité)');
    verifier(masquerCodesLivret('Né en 1890 ? Non : en 2019. 48210 sans ville.').includes(CODE_MASQUE), 'année hors de 1900 à 2099, 5 chiffres sans ville : masqués');

    const clair: Logement = {
      ...LOGEMENT,
      fiche: {
        ...LOGEMENT.fiche,
        parking: 'Parking public à 150 m, rue de la Gare, 91100 Corbeil-Essonnes.',
        regles: 'Appartement rénové en 2019, merci d’en prendre soin.',
        aSavoir: 'Boulangerie au 91100 Corbeil-Essonnes. Code postal : 91100.',
        consignesDepart: 'Bus 4021 pour la gare, départ à 300 m.',
        questions: [],
      },
      descriptif: { ...LOGEMENT.descriptif, textes: { transports: 'RER D à 1200 m, bus 4021.' } },
    };
    const vClair = vueSejour({ conciergerie: 'Label Maison', reservation: resa(), logement: clair, aujourdhui: AUJ, checkinOuvert: true });
    verifier(
      vClair.logement.parking === clair.fiche.parking &&
        vClair.logement.regles === clair.fiche.regles &&
        vClair.logement.aSavoir === clair.fiche.aSavoir &&
        vClair.logement.consignesDepart === clair.fiche.consignesDepart &&
        vClair.logement.transports === 'RER D à 1200 m, bus 4021.',
      'avant 48 h : code postal, année, distance et bus montrés tels quels (et « 91100 » ne se compte pas lui-même comme un secret)',
      vClair.logement,
    );

    // Toujours cachés : le code n'apparaît jamais (texte masqué ou retiré).
    const cache = (champ: Partial<Logement['fiche']>) => {
      const v = vueSejour({ conciergerie: 'Label Maison', reservation: resa(), logement: { ...LOGEMENT, fiche: { ...LOGEMENT.fiche, aSavoir: '', parking: '', regles: '', consignesDepart: '', questions: [], ...champ } }, aujourdhui: AUJ, checkinOuvert: true });
      return JSON.stringify(v);
    };
    const fuites = [
      ['Boîte 4821 à gauche.', /4821/],
      ['Local vélos : code 4821.', /4821/],
      ['Portail : 4 8 2.', /4 8 2/],
      ['Tapez 4821 au portail.', /4821/],
      ['Le wifi soleil2026 marche partout.', /soleil/],
      ['Bus 4821 jusqu’à la gare.', /4821/],
    ].filter(([t, motif]) => (motif as RegExp).test(cache({ aSavoir: t as string })));
    verifier(fuites.length === 0, '« Boîte 4821 », « code 4821 », « Portail : 4 8 2 », « tapez 4821 au portail », wifi, code de l’accès derrière « bus » : jamais montrés', fuites.map(([t]) => t));
    // Avertissement de la fiche : exactement les textes que le livret cache en entier (pas ceux dont le code est seulement masqué).
    const essais = ['Portail du parking : 482.', 'Laissez les clés dans la boîte, code 4821.', 'Le wifi soleil2026 marche partout.', 'Boulangerie, 91100 Corbeil-Essonnes.', 'Bus 4821 jusqu’à la gare.', 'Poubelles le mardi.'];
    const ecarts = essais.filter((t) => {
      const v = vueSejour({ conciergerie: 'Label Maison', reservation: resa(), logement: { ...LOGEMENT, fiche: { ...LOGEMENT.fiche, aSavoir: t } }, aujourdhui: AUJ, checkinOuvert: true });
      return texteCacheAvant48h(t, { ...LOGEMENT, fiche: { ...LOGEMENT.fiche, aSavoir: t } }) !== (v.logement.aSavoir === undefined);
    });
    verifier(ecarts.length === 0 && texteCacheAvant48h('Portail du parking : 482.', LOGEMENT) && !texteCacheAvant48h('Laissez les clés dans la boîte, code 4821.', LOGEMENT) && texteCacheAvant48h('Le wifi soleil2026', LOGEMENT), 'avertissement de la fiche : même règle que le livret (code court, wifi, code de l’accès : caché ; code masqué : montré)', ecarts);
    // Exceptions de lisibilité détournées : un code ne passe ni pour un code postal, ni pour une unité, ni derrière « numéro ».
    const detournes = [
      ['Entrée 48213 Bât A', /48213/], ['Immeuble : 48213 Bonne arrivée', /48213/], ['Hall 48213 Escalier C', /48213/], ['Accès immeuble 48213 Merci', /48213/],
      ['Clés : 48213 Attention à la marche', /48213/], ['Le digicode change souvent ; le voici : 48213 Merci', /48213/], ['portail 75001 Paris', /75001/],
      ['Digicode : 4821M', /4821/], ['Digicode 2580J', /2580/], ['Boîte à clés 4821 h', /4821/], ['Code portail 1530 h', /1530/], ['keybox 1200 m', /1200/],
      ['Composez le numéro 4821 à l’entrée', /4821/], ['Sonnez au numéro 4821', /4821/], ['code bus 4821', /4821/], ['Boîte 2019', /2019/],
    ].filter(([t, motif]) => (motif as RegExp).test(cache({ aSavoir: t as string })));
    verifier(detournes.length === 0, 'code déguisé en code postal, unité, année ou numéro : jamais lisible avant 48 h', detournes.map(([t]) => t));
    verifier(masquerCodesLivret('Boulangerie 91100 Corbeil.', '91100') === 'Boulangerie 91100 Corbeil.' && masquerCodesLivret('Boulangerie 91100 Corbeil.').includes(CODE_MASQUE), 'le code postal du logement reste lisible partout ; un autre, seulement après une virgule ou une préposition');
    // Un code court collé à un code masqué (« 4821 puis 482 ») : un second code, le texte attend ; un code postal, une année, un bus : non.
    const voisins = [
      ['Bâtiment B : 4821 puis 482 en bas', /482 en bas/], ['Le 4821 puis 482', /puis 482/], ['Escalier C, 4821 et 7B9', /7B9/], ['Immeuble 4821, appartement 12B', /12B/],
    ].filter(([t, motif]) => (motif as RegExp).test(cache({ aSavoir: t as string })));
    verifier(voisins.length === 0, 'code court à côté d’un code masqué : jamais lisible avant 48 h', voisins.map(([t]) => t));
    // Le jeton entier est retiré : aucune lettre collée au code ne reste visible.
    const colles = [['Digicode : 4821M.', /M\./], ['Interphone B4821 à gauche.', /B[^\p{L}]*à/u], ['Clavier 12#4821*.', /12#|\*\./]].filter(([t, motif]) =>
      (motif as RegExp).test(cache({ aSavoir: t as string })),
    );
    verifier(colles.length === 0, 'lettre ou signe collé à un code masqué (« 4821M », « B4821 ») : retiré avec lui', colles.map(([t]) => cache({ aSavoir: t as string })));
    const clairs = ['Résidence de 1998, 91100 Corbeil-Essonnes.', 'Construit en 1890, bus 402 devant la maison.', 'Rénové en 1890 ; tram à 300 m.'];
    const perdus = clairs.filter((t) => !cache({ aSavoir: t }).includes(t.split(' ')[0]));
    verifier(perdus.length === 0, 'près d’un code masqué : code postal, bus et distance restent lisibles', perdus);
    const croise = cache({ parking: 'Portail du parking : code 482.', aSavoir: 'Tapez 482 en bas.' });
    verifier(!/482/.test(croise), 'code cité après « code » dans un champ, écrit nu dans un autre : le texte attend les 48 h');
    verifier(/Corbeil-Essonnes/.test(cache({ aSavoir: 'Code postal 91100 Corbeil-Essonnes.' })) && /91100/.test(cache({ aSavoir: 'Code postal 91100 Corbeil-Essonnes.' })), '« code postal 91100 » : ni masqué ni pris pour un code');
  }

  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
}

void principal();
