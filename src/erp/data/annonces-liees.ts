/**
 * Un logement, ses connexions : l'annonce Airbnb et l'annonce Booking.com
 * d'un même appartement réunies sur UN logement de l'ERP. Règles pures, sans
 * réseau : utilisées par l'écran (bloc « Connexions » de la fiche, page
 * Connexions, démo) et par le serveur (repull-connexion.ts,
 * api/erp-repull-connexion.ts), qui les revérifie sur ses propres données,
 * sous le verrou de la synchronisation.
 *
 * Le modèle (types.ts, OrigineRepull.liees) : le logement garde son annonce
 * principale (`repull.id`) ; les annonces des autres plateformes sont
 * « reliées » (`repull.liees`). La synchronisation (repull-synchro.ts)
 * envoie les réservations et les conversations d'une annonce reliée sur ce
 * logement, ne crée jamais de logement pour elle, et ne prend d'elle que
 * son entrée dans `annonces` (canal connecté, lien) : nom, photos,
 * description et prix restent ceux de l'annonce principale.
 *
 * Relier une annonce déjà importée comme logement à part (« absorber ») :
 *   - tout ce qui porte l'identifiant de l'autre logement passe sur celui-ci
 *     (COLLECTIONS_LOGEMENT_ID, prix conseillés, actions de l'IA, bilans,
 *     équipe, réglages par logement, qui le suit) ;
 *   - ce que l'équipe a saisi sur l'autre (fiche voyageur, terrain,
 *     contacts, propriétaire s'il est « à renseigner » ici…) ne remplit que
 *     les champs VIDES de celui-ci : rien de ce qui est saisi ici n'est
 *     écrasé (fusionnerLogement) ;
 *   - l'autre logement est ensuite supprimé (l'historique de la base garde
 *     sa dernière version), et l'annonce reste reliée ici : aucune
 *     synchronisation ne le recrée (indexer, repull-synchro.ts : la liaison
 *     l'emporte ; trace côté serveur : repull/annonces-reliees).
 *
 * Cela ne se défait pas depuis l'ERP : après coup, on ne saurait plus dire
 * à coup sûr quel ménage, quelle facture mensuelle, quel bilan ou quel
 * message appartient à quelle annonce (voir le rapport de la PR). L'écran le
 * dit avant « Relier ».
 *
 * Rien n'est écrit sur les plateformes : c'est une opération sur les
 * données de l'ERP seulement.
 *
 * Imports relatifs avec « .js » : ce module tourne aussi côté serveur.
 */
import { ID_PROPRIETAIRE_A_RENSEIGNER } from './repull.js';
import { logementDeLAnnonce, villesDifferentes } from './liaison-annonce.js';
import { ID_REGLAGES_PROGRAMMES } from './messages-programmes.js';
import { ID_REGLAGES_SUPPLEMENTS } from './supplements.js';
import { historiqueDuLogement, type TraceHistorique } from './suppression-logement.js';
import type { ReglagesPrix } from './prix-conseils';
import type { ReglagesSupplements } from './supplements';
import type { ReglagesMessagesProgrammes } from './types-programmes';
import type { AffectationLogement } from './types-operations';
import type { Annonce, AnnonceLiee, ErpDonnees, Horodatage, Id, Logement, Reglage } from './types';

/* ================================================================ plateformes */

export type CanalPlateforme = AnnonceLiee['canal'];
export const CANAUX_PLATEFORME: readonly CanalPlateforme[] = ['airbnb', 'booking'];
export const NOM_CANAL: Record<CanalPlateforme, string> = { airbnb: 'Airbnb', booking: 'Booking.com' };

/** Plateforme d'un texte du service de connexion (« booking.com », « Airbnb »…) ; null : ni Airbnb ni Booking.com. */
export function canalDe(plateforme: unknown): CanalPlateforme | null {
  const p = String(plateforme ?? '').trim().toLowerCase();
  if (p.startsWith('airbnb')) return 'airbnb';
  if (p.startsWith('booking')) return 'booking';
  return null;
}

/** Annonces reliées (autres plateformes) d'un logement. */
export const liees = (l: Pick<Logement, 'repull'> | undefined): AnnonceLiee[] => (Array.isArray(l?.repull?.liees) ? l!.repull!.liees! : []);

/** Toutes les annonces d'un logement : la principale d'abord, puis les reliées. */
export function annoncesDe(l: Pick<Logement, 'repull'>): string[] {
  const p = l.repull?.id ? [String(l.repull.id)] : [];
  return [...p, ...liees(l).map((x) => String(x.id))];
}

/**
 * Plateformes de l'annonce principale : celles que dit le service de
 * connexion (repull.canaux), à défaut les annonces connectées de la fiche,
 * hors plateformes des annonces reliées. Vide sans annonce.
 */
export function canauxPrincipaux(l: Pick<Logement, 'repull' | 'annonces'>): CanalPlateforme[] {
  if (!l.repull?.id) return [];
  const depuisCanaux = (l.repull.canaux ?? []).map((c) => canalDe(c?.plateforme)).filter((c): c is CanalPlateforme => !!c);
  if (depuisCanaux.length) return [...new Set(depuisCanaux)];
  const desLiees = new Set(liees(l).map((x) => x.canal));
  return [...new Set((l.annonces ?? []).filter((a) => a?.connecte).map((a) => canalDe(a.canal)).filter((c): c is CanalPlateforme => !!c && !desLiees.has(c)))];
}

/** Toutes les plateformes du logement : annonce principale et annonces reliées. */
export function canauxDuLogement(l: Pick<Logement, 'repull' | 'annonces'>): CanalPlateforme[] {
  return [...new Set([...canauxPrincipaux(l), ...liees(l).map((x) => x.canal)])];
}

/**
 * Annonce dont le service de connexion ne dit aucune plateforme (aucun canal :
 * ni Airbnb, ni Booking.com, ni une autre). Reliée à un logement qui n'a
 * qu'une plateforme, elle prend l'autre (celle qu'on relie) : c'est le geste
 * du gérant (« Relier l'annonce Booking.com ») qui le dit.
 */
export function sansPlateforme(l: Pick<Logement, 'repull' | 'annonces'>): boolean {
  if (!l.repull?.id) return false;
  if ((l.repull.canaux ?? []).some((c) => String(c?.plateforme ?? '').trim())) return false;
  return !(l.annonces ?? []).some((a) => a?.canal === 'airbnb' || a?.canal === 'booking');
}

/** L'autre plateforme (Airbnb ↔ Booking.com). */
export const autreCanal = (c: CanalPlateforme): CanalPlateforme => (c === 'airbnb' ? 'booking' : 'airbnb');

/**
 * Plateforme qu'un logement apporte en rejoignant `garde` : la sienne, ou,
 * sans plateforme connue, celle qui manque à `garde` (s'il n'en a qu'une).
 * null : aucune des deux, ou les deux à la fois.
 */
export function canalApporte(garde: Pick<Logement, 'repull' | 'annonces'>, l: Pick<Logement, 'repull' | 'annonces'>): CanalPlateforme | null {
  const c = canalUniqueDuLogement(l);
  if (c) return c;
  const g = canalUniqueDuLogement(garde);
  return g && sansPlateforme(l) ? autreCanal(g) : null;
}

/** Logement qui porte cette annonce comme annonce RELIÉE. */
export function logementDeLAnnonceLiee<L extends Pick<Logement, 'id' | 'repull'>>(annonce: string, logements: readonly L[]): L | undefined {
  return logements.find((l) => liees(l).some((x) => String(x.id) === String(annonce)));
}

/**
 * Logement de l'ERP qui reçoit cette annonce : celui qui la porte comme
 * annonce reliée d'abord (la liaison l'emporte, comme dans la
 * synchronisation), sinon celui dont c'est l'annonce principale.
 */
export function logementPortant<L extends Pick<Logement, 'id' | 'repull'>>(annonce: string, logements: readonly L[]): L | undefined {
  return logementDeLAnnonceLiee(annonce, logements) ?? logementDeLAnnonce(annonce, logements);
}

/** Relier et délier une connexion : un gérant, hors lecture seule. */
export const peutRelierConnexion = (role: string | undefined, lectureSeule = false): boolean => role === 'gerant' && !lectureSeule;

/**
 * Ce logement peut-il recevoir une annonce de cette plateforme ? Il a son
 * annonce (importé ou relié), n'est pas « Sorti », et n'a pas encore
 * d'annonce sur cette plateforme.
 */
export const accueilleCanal = (l: Pick<Logement, 'repull' | 'annonces' | 'statut'>, canal: CanalPlateforme): boolean =>
  !!l.repull?.id && l.statut !== 'sorti' && !canauxDuLogement(l).includes(canal);

/* ================================================================ ressemblance */

const MOTS_VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'au', 'aux', 'avec', 'en', 'sur', 'pour', 'un', 'une', 'the', 'with', 'and', 'of', 'in', 'near', 'pres', 'tout', 'tres']);
/** Mots qui disent la plateforme ou la version d'une annonce, jamais le logement. */
const MOTS_PLATEFORME = new Set(['airbnb', 'booking', 'com', 'bookingcom', 'copie', 'bis', 'nouveau', 'nouvelle', 'new', 'annonce']);
/** Mots que partagent beaucoup d'annonces sans être le même logement. */
const MOTS_GENERIQUES = new Set([
  'appartement', 'appart', 'apartment', 'studio', 'logement', 'maison', 'house', 'flat', 'duplex', 'loft', 'piece', 'chambre', 'bedroom', 'room',
  'lit', 'bed', 'personne', 'voyageur', 'guest', 'one', 'two', 'three', 'four', 'deux', 'trois', 'quatre', 'cinq', 'm2', 't1', 't2', 't3', 't4', 't5',
  'f1', 'f2', 'f3', 'f4', 'f5', 'sdb', 'salle', 'bain', 'bathroom',
]);

const sansAccents = (v: unknown): string =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Mot comparable : singulier simple (« balcons » = « balcon »). */
const singulier = (m: string): string => (m.length > 3 && m.endsWith('s') ? m.slice(0, -1) : m);

/** Mots d'un texte, sans accents, casse ni ponctuation. */
const mots = (v: unknown): string[] =>
  sansAccents(v)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((m) => m.length >= 2)
    .map(singulier);

/** Mots qui comptent dans un nom d'annonce : ni mots vides, ni plateforme, ni version, ni nombres. */
function motsDuNom(nom: unknown, avecGeneriques: boolean): Set<string> {
  return new Set(mots(nom).filter((m) => !MOTS_VIDES.has(m) && !MOTS_PLATEFORME.has(m) && !/^v\d+$/.test(m) && !/^\d+$/.test(m) && (avecGeneriques || !MOTS_GENERIQUES.has(m))));
}

/** Adresse comparable (« 12, Rue Pasteur » = « 12 rue pasteur ») ; vide si elle ne dit pas de rue. */
const adresseComparable = (v: unknown): string => {
  const a = sansAccents(v).replace(/[^a-z0-9]+/g, ' ').trim();
  return /[a-z]/.test(a) ? a : '';
};

export interface Ressemblance {
  /** forte : même adresse, ou des noms qui se recouvrent nettement (fiable) ; proche : un mot propre en commun. */
  niveau: 'forte' | 'proche' | null;
  raison?: 'adresse' | 'nom';
  /** Pour trier (0 à 1). */
  score: number;
}

type Comparable = { nom: string; adresse?: string; ville?: string };

/**
 * Deux fiches (logements, ou une annonce et un logement) semblent-elles être
 * le même appartement ? Jamais dans deux communes différentes. « forte »
 * seulement quand c'est fiable : même rue et même numéro, ou des noms qui se
 * recouvrent sur des mots propres (pas seulement « appartement », le nom de
 * la commune ou de la plateforme).
 */
export function ressemblance(a: Comparable, b: Comparable): Ressemblance {
  if (villesDifferentes(a.ville, b.ville)) return { niveau: null, score: 0 };
  const adresseA = adresseComparable(a.adresse);
  if (adresseA && adresseA === adresseComparable(b.adresse) && /\d/.test(adresseA)) return { niveau: 'forte', raison: 'adresse', score: 1 };
  const commune = new Set([...mots(a.ville), ...mots(b.ville)]);
  const propre = (m: string) => !commune.has(m) && !MOTS_GENERIQUES.has(m);
  const comparer = (avecGeneriques: boolean) => {
    const x = motsDuNom(a.nom, avecGeneriques);
    const y = motsDuNom(b.nom, avecGeneriques);
    const communs = [...x].filter((m) => y.has(m));
    return { x, y, communs, propres: communs.filter(propre).length };
  };
  let c = comparer(false);
  // Nom très court (« Bel appartement ») : on compare avec les mots génériques.
  if (c.x.size < 2 || c.y.size < 2) c = comparer(true);
  const min = Math.min(c.x.size, c.y.size);
  const max = Math.max(c.x.size, c.y.size);
  if (!min || !c.propres) return { niveau: null, score: 0 };
  const score = c.communs.length / max;
  const memes = c.communs.length === c.x.size && c.x.size === c.y.size;
  if ((memes && c.x.size >= 2) || (c.communs.length >= 3 && c.communs.length / min >= 0.75)) return { niveau: 'forte', raison: 'nom', score };
  return { niveau: 'proche', raison: 'nom', score };
}

/** Plateforme unique d'une annonce trouvée sur les plateformes (null : aucune des deux, ou les deux à la fois). */
export function canalUnique(plateformes: readonly string[] | undefined): CanalPlateforme | null {
  const c = [...new Set((plateformes ?? []).map(canalDe).filter((x): x is CanalPlateforme => !!x))];
  return c.length === 1 ? c[0] : null;
}

/** Canal unique de l'annonce principale d'un logement (null : aucune, ou deux plateformes déjà). */
export function canalUniqueDuLogement(l: Pick<Logement, 'repull' | 'annonces'>): CanalPlateforme | null {
  const c = canauxPrincipaux(l);
  return c.length === 1 ? c[0] : null;
}

/** Annonce trouvée sur les plateformes de l'espace (page Connexions), ce qu'il en faut ici. */
export interface AnnonceTrouvee {
  id: string;
  nom: string;
  ville?: string;
  photo?: string;
  statutRepull?: string;
  plateformes: string[];
  /** Cochée dans Connexions (suivie). */
  selectionnee?: boolean;
  logementId?: string;
}

/**
 * Deux logements qui pourraient être le même appartement : chacun porte son
 * annonce, sur des plateformes différentes, aucun n'a encore d'annonce
 * reliée, ni « Sorti », ni chez deux propriétaires connus différents.
 */
export function pairePossible(a: Logement, b: Logement): boolean {
  if (a.id === b.id || !a.repull?.id || !b.repull?.id || a.statut === 'sorti' || b.statut === 'sorti') return false;
  if (liees(a).length || liees(b).length) return false;
  // Sans plateforme connue d'un côté : il prend celle qui manque à l'autre (canalApporte).
  const ca = canalApporte(b, a);
  const cb = canalApporte(a, b);
  if (!ca || !cb || ca === cb) return false;
  return !proprietairesDifferents(a, b) && !historiquesDifferents(a, b) && !historiquesDifferents(b, a);
}

/**
 * Historiques de propriétaires incompatibles : les séjours de l'autre
 * logement seraient attribués selon l'historique du logement gardé
 * (espace propriétaire, relevés). Compatibles : aucun des deux n'en a ; le
 * gardé est « à renseigner » sans historique (il reprend celui de l'autre,
 * fusionnerLogement) ; l'autre est « à renseigner » sans historique.
 */
export function historiquesDifferents(g: Pick<Logement, 'proprietaireId' | 'proprietaireDepuis' | 'proprietairesPrecedents'>, a: Pick<Logement, 'proprietaireId' | 'proprietaireDepuis' | 'proprietairesPrecedents'>): boolean {
  const sansHistorique = (l: typeof g) => !l.proprietairesPrecedents?.length && !l.proprietaireDepuis;
  if (sansHistorique(g) && sansHistorique(a)) return false;
  if (g.proprietaireId === ID_PROPRIETAIRE_A_RENSEIGNER && !g.proprietairesPrecedents?.length) return false;
  if (a.proprietaireId === ID_PROPRIETAIRE_A_RENSEIGNER && sansHistorique(a)) return false;
  return JSON.stringify(g.proprietairesPrecedents ?? []) !== JSON.stringify(a.proprietairesPrecedents ?? []) || (g.proprietaireDepuis ?? '') !== (a.proprietaireDepuis ?? '');
}

/** Ce qui empêche l'autre logement de rejoindre le gardé (null : rien). */
export function blocageAbsorption(garde: Logement, autre: Logement): string | null {
  if (liees(autre).length) return `« ${autre.nom} » est déjà relié à une autre annonce.`;
  if (proprietairesDifferents(garde, autre)) return `« ${garde.nom} » et « ${autre.nom} » n’ont pas le même propriétaire : vérifiez avant de les relier.`;
  if (historiquesDifferents(garde, autre)) return `« ${garde.nom} » et « ${autre.nom} » n’ont pas le même historique de propriétaires : alignez-le dans leurs fiches avant de les relier.`;
  return null;
}

/** Deux propriétaires connus (pas « à renseigner ») et différents. */
export const proprietairesDifferents = (a: Pick<Logement, 'proprietaireId'>, b: Pick<Logement, 'proprietaireId'>): boolean =>
  !!a.proprietaireId && !!b.proprietaireId && a.proprietaireId !== ID_PROPRIETAIRE_A_RENSEIGNER && b.proprietaireId !== ID_PROPRIETAIRE_A_RENSEIGNER && a.proprietaireId !== b.proprietaireId;

/**
 * L'autre logement qui semble être ce même appartement, seulement si c'est
 * fiable : ressemblance « forte » et un seul candidat (deux candidats : on ne
 * sait pas lequel, rien n'est proposé).
 */
export function suggestionPour(l: Logement, logements: readonly Logement[]): Logement | undefined {
  const fortes = logements.filter((x) => pairePossible(l, x) && ressemblance(l, x).niveau === 'forte');
  if (fortes.length !== 1) return undefined;
  // Réciproque : l'autre n'a pas non plus deux candidats.
  const retour = logements.filter((x) => pairePossible(fortes[0], x) && ressemblance(fortes[0], x).niveau === 'forte');
  return retour.length === 1 ? fortes[0] : undefined;
}

/** Paires fiables de tout l'espace (page Connexions) : le logement Airbnb gardé par défaut, l'autre qui le rejoint. */
export function pairesSuggerees(logements: readonly Logement[]): { garde: Logement; autre: Logement }[] {
  const vues = new Set<string>();
  const paires: { garde: Logement; autre: Logement }[] = [];
  for (const l of logements) {
    const s = suggestionPour(l, logements);
    if (!s || vues.has(l.id) || vues.has(s.id)) continue;
    vues.add(l.id).add(s.id);
    // Gardé : le logement Airbnb ; sinon celui dont la plateforme est connue.
    const cl = canalUniqueDuLogement(l);
    const cs = canalUniqueDuLogement(s);
    const lGarde = cl === 'airbnb' || (cs !== 'airbnb' && !!cl && !cs);
    paires.push(lGarde ? { garde: l, autre: s } : { garde: s, autre: l });
  }
  return paires;
}

/** Une annonce à proposer pour relier un logement, et pourquoi elle ne se choisit pas (si c'est le cas). */
export interface AnnonceProposee {
  annonce: AnnonceTrouvee;
  /** Logement de l'ERP qui la porte aujourd'hui (importée à part), s'il y en a un. */
  logement?: Logement;
  niveau: Ressemblance['niveau'];
  /** Pourquoi elle ressemble (même adresse, nom très proche). */
  raison?: Ressemblance['raison'];
  /** Raison d'une annonce qui ne se choisit pas ici ; absente : elle se choisit. */
  bloquee?: string;
}

/**
 * Annonces de cette plateforme qui peuvent rejoindre ce logement (assistant
 * « Relier l'annonce Booking.com ») : une seule plateforme, pas archivée, pas
 * déjà reliée ailleurs. Choisissables : celles déjà dans l'ERP (logement à
 * part) ou suivies ; les autres sont montrées, à cocher d'abord dans
 * Connexions. Les plus ressemblantes d'abord.
 */
export function annoncesProposees(l: Logement, canal: CanalPlateforme, annonces: readonly AnnonceTrouvee[], logements: readonly Logement[]): AnnonceProposee[] {
  const miennes = new Set(annoncesDe(l));
  const res: AnnonceProposee[] = [];
  for (const a of annonces) {
    // Sans plateforme connue : proposée pour celle qui manque à ce logement (canalApporte).
    const inconnue = !(a.plateformes ?? []).some((p) => String(p ?? '').trim()) && canalUniqueDuLogement(l) === autreCanal(canal);
    if (a.statutRepull === 'archived' || miennes.has(a.id) || (canalUnique(a.plateformes) !== canal && !inconnue)) continue;
    if (logementDeLAnnonceLiee(a.id, logements)) continue;
    const porteur = logementPortant(a.id, logements.filter((x) => x.id !== l.id)) ?? (a.logementId ? logements.find((x) => x.id === a.logementId && x.id !== l.id) : undefined);
    const r = porteur ? ressemblance(l, porteur) : ressemblance(l, { nom: a.nom, ville: a.ville });
    let bloquee: string | undefined;
    if (porteur && liees(porteur).length) bloquee = `« ${porteur.nom} » a déjà une autre annonce reliée.`;
    else if (porteur && proprietairesDifferents(l, porteur)) bloquee = `« ${porteur.nom} » n’a pas le même propriétaire.`;
    else if (porteur && historiquesDifferents(l, porteur)) bloquee = `« ${porteur.nom} » n’a pas le même historique de propriétaires.`;
    else if (!porteur && !a.selectionnee) bloquee = 'Pas encore suivie : cochez-la dans Connexions, l’ERP vous demandera alors si c’est ce logement.';
    res.push({ annonce: a, ...(porteur ? { logement: porteur } : {}), niveau: r.niveau, ...(r.raison ? { raison: r.raison } : {}), ...(bloquee ? { bloquee } : {}) });
  }
  const rang = (p: AnnonceProposee) => (p.bloquee ? 10 : 0) + (p.niveau === 'forte' ? 0 : p.niveau === 'proche' ? 1 : 2);
  return res.sort((x, y) => rang(x) - rang(y) || x.annonce.nom.localeCompare(y.annonce.nom, 'fr'));
}

/**
 * Logements existants auxquels une annonce pas encore dans l'ERP pourrait
 * appartenir (question de la page Connexions quand on la coche) : ceux
 * d'une autre plateforme, sans annonce sur la sienne, dans la même commune
 * si on la connaît. `forte` : le seul qui lui ressemble de façon fiable.
 */
export function logementsPourAnnonce(a: AnnonceTrouvee, logements: readonly Logement[]): { candidats: Logement[]; forte?: Logement } {
  const canal = canalUnique(a.plateformes);
  if (!canal) return { candidats: [] };
  const candidats = logements
    .filter((l) => accueilleCanal(l, canal) && !villesDifferentes(a.ville, l.ville) && !!canalUniqueDuLogement(l))
    .map((l) => ({ l, r: ressemblance({ nom: a.nom, ville: a.ville }, l) }))
    .sort((x, y) => y.r.score - x.r.score || x.l.nom.localeCompare(y.l.nom, 'fr'));
  const fortes = candidats.filter((x) => x.r.niveau === 'forte');
  return { candidats: candidats.map((x) => x.l), ...(fortes.length === 1 ? { forte: fortes[0].l } : {}) };
}

/* ================================================================ vérification */

/** Identifiant d'annonce acceptable (comme liaison-annonce.ts). */
const FORME_ANNONCE = /^[A-Za-z0-9_-]{1,64}$/;

export type VerdictConnexion =
  | {
      ok: true;
      /**
       * absorber : l'annonce a son propre logement dans l'ERP, qui rejoint celui-ci ;
       * ajouter : l'annonce n'est pas encore dans l'ERP, elle est seulement reliée ;
       * deja : c'est déjà fait (rien à refaire).
       */
      mode: 'absorber' | 'ajouter' | 'deja';
      garde: Logement;
      autre?: Logement;
      canal: CanalPlateforme;
      annonce: string;
      /** Nom de l'annonce (affichage, journal). */
      nomAnnonce?: string;
    }
  | { ok: false; erreur: string; statut: number };

const refus = (erreur: string, statut = 400): VerdictConnexion => ({ ok: false, erreur, statut });

/**
 * Relier cette annonce à ce logement est-il permis ? Gérant ; logement de
 * l'espace, qui a déjà son annonce, pas « Sorti », sans annonce sur cette
 * plateforme ; annonce d'une seule plateforme (Airbnb ou Booking.com), pas
 * déjà reliée ailleurs. Si elle a son propre logement : il n'a pas d'autre
 * annonce reliée et pas un autre propriétaire connu. Sinon : elle est sur
 * les plateformes connectées à cet espace, pas archivée. Déjà reliée ici :
 * « deja » (idempotent), ou reprise si l'autre logement est encore là.
 */
export function verifierConnexion(o: { role: string | undefined; logementId: string; annonceId: string; logements: readonly Logement[]; annonces?: readonly AnnonceTrouvee[] }): VerdictConnexion {
  if (!peutRelierConnexion(o.role)) return refus('Seul un gérant peut relier une annonce à un logement.', 403);
  const annonce = String(o.annonceId ?? '');
  if (!FORME_ANNONCE.test(annonce)) return refus('Annonce illisible : rechargez la page.');
  const garde = o.logements.find((x) => x.id === o.logementId);
  if (!garde) return refus('Logement introuvable dans cet espace.', 404);
  if (!garde.repull?.id) return refus(`« ${garde.nom} » n’est relié à aucune annonce : reliez-le d’abord à son annonce (« Relier à une annonce »).`, 409);
  const porteurDeGarde = logementDeLAnnonceLiee(String(garde.repull.id), o.logements.filter((x) => x.id !== garde.id));
  if (porteurDeGarde) return refus(`« ${garde.nom} » est déjà relié à « ${porteurDeGarde.nom} ».`, 409);
  if (String(garde.repull.id) === annonce) return refus('C’est déjà l’annonce de ce logement.', 409);
  const trouvee = o.annonces?.find((a) => a.id === annonce);
  const autres = o.logements.filter((x) => x.id !== garde.id);
  const autre = logementDeLAnnonce(annonce, autres);

  const dejaIci = liees(garde).find((x) => String(x.id) === annonce);
  if (dejaIci) {
    // Déjà relié : idempotent.
    if (!autre) return { ok: true, mode: 'deja', garde, canal: dejaIci.canal, annonce, ...(dejaIci.nom ? { nomAnnonce: dejaIci.nom } : {}) };
    // L'autre logement encore là (opération interrompue) : on reprend, seulement avec le logement d'origine et les mêmes contrôles.
    if (dejaIci.depuis && autre.id !== dejaIci.depuis) return refus(`« ${autre.nom} » n’est pas le logement d’où vient cette annonce : vérifiez avant de continuer.`, 409);
    const bloque = blocageAbsorption(garde, autre);
    if (bloque) return refus(bloque, 409);
    return { ok: true, mode: 'absorber', garde, autre, canal: dejaIci.canal, annonce, ...(dejaIci.nom ? { nomAnnonce: dejaIci.nom } : {}) };
  }
  const ailleurs = logementDeLAnnonceLiee(annonce, autres);
  if (ailleurs) return refus(`Cette annonce est déjà reliée à « ${ailleurs.nom} ».`, 409);
  if (garde.statut === 'sorti') return refus(`« ${garde.nom} » est « Sorti » : changez d’abord son statut pour lui relier une annonce.`, 409);

  const plateformes = autre ? canauxPrincipaux(autre) : (trouvee?.plateformes ?? []).map(canalDe).filter((c): c is CanalPlateforme => !!c);
  let uniques = [...new Set(plateformes)];
  if (!autre && (!trouvee || trouvee.statutRepull === 'archived')) return refus('Cette annonce n’est pas sur les plateformes connectées à cet espace : rechargez la liste.', 404);
  // Aucune plateforme connue pour l'annonce : elle prend celle qui manque au logement (s'il n'en a qu'une).
  const inconnue = autre ? sansPlateforme(autre) : !(trouvee?.plateformes ?? []).some((p) => String(p ?? '').trim());
  const deGarde = canalUniqueDuLogement(garde);
  if (!uniques.length && inconnue && deGarde) uniques = [autreCanal(deGarde)];
  if (!uniques.length) return refus('Seules les annonces Airbnb et Booking.com se relient à un logement.');
  if (uniques.length > 1) return refus('Cette annonce est déjà sur Airbnb et Booking.com : elle a son propre logement.', 409);
  const canal = uniques[0];
  if (canauxDuLogement(garde).includes(canal)) return refus(`« ${garde.nom} » a déjà une annonce ${NOM_CANAL[canal]}.`, 409);

  if (autre) {
    const bloque = blocageAbsorption(garde, autre);
    if (bloque) return refus(bloque, 409);
    return { ok: true, mode: 'absorber', garde, autre, canal, annonce, nomAnnonce: trouvee?.nom ?? autre.nom };
  }
  return { ok: true, mode: 'ajouter', garde, canal, annonce, ...(trouvee?.nom ? { nomAnnonce: trouvee.nom } : {}) };
}

/* ================================================================ fusion */

const vide = (v: unknown): boolean => (Array.isArray(v) ? v.length === 0 : typeof v === 'string' ? !v.trim() : v === undefined || v === null);
const copie = <T,>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

/** Champs de la fiche voyageur remplis par l'autre logement s'ils sont vides ici (horaires : jamais vides, gardés). */
const CHAMPS_FICHE = ['wifiNom', 'wifiCode', 'acces', 'parking', 'regles', 'equipements', 'aSavoir', 'consignesDepart', 'guides', 'questions'] as const;
const CHAMPS_MENAGE = ['duree', 'produits', 'consignes'] as const;
const CHAMPS_TECHNIQUE = ['etage', 'interphone', 'compteurElectricite', 'compteurEau', 'compteurGaz', 'disjoncteur', 'chaudiere', 'arriveeEau', 'notes'] as const;

/**
 * Le logement gardé, relié à l'annonce : l'annonce entre dans
 * `repull.liees`, son entrée dans `annonces` (canal connecté, lien) ; ce que
 * l'équipe a saisi sur l'autre logement ne remplit que les champs vides
 * d'ici. `remplis` : les champs remplis (journal). Jamais : nom, photos,
 * description, prix, statut, serrure, horaires (ceux de l'annonce
 * principale ou de ce logement).
 */
export function fusionnerLogement(garde: Logement, liee: AnnonceLiee, autre?: Logement): { logement: Logement; remplis: string[] } {
  const s: Logement = { ...garde };
  const remplis: string[] = [];
  const prendre = <K extends keyof Logement>(k: K, ok: (v: Logement[K]) => boolean = (v) => !vide(v)) => {
    if (!autre) return;
    const v = autre[k];
    if (vide(s[k]) && v !== undefined && ok(v)) {
      s[k] = copie(v);
      remplis.push(String(k));
    }
  };

  // L'annonce reliée et son entrée dans les plateformes de la fiche.
  const avant = liees(garde).filter((x) => String(x.id) !== String(liee.id));
  s.repull = { ...(garde.repull ?? { id: '' }), liees: [...avant, liee] };
  const entreeAutre = autre?.annonces?.find((a) => a?.canal === liee.canal);
  const entreeIci = garde.annonces.find((a) => a?.canal === liee.canal);
  const url = entreeIci?.url || entreeAutre?.url;
  // L'autre logement n'avait pas cette plateforme (inconnue) : pas « en ligne » tant que la synchronisation ne l'a pas vue.
  const annonce: Annonce = { canal: liee.canal, ...(url ? { url } : {}), connecte: entreeAutre ? !!entreeAutre.connecte : !autre };
  const ordre = (c: string) => ['airbnb', 'booking', 'direct'].indexOf(c);
  s.annonces = [...garde.annonces.filter((a) => a?.canal !== liee.canal), annonce].sort((a, b) => ordre(a.canal) - ordre(b.canal));

  if (!autre) return { logement: s, remplis };

  // Propriétaire « à renseigner » ici, connu là-bas : il passe ici, avec ses dates.
  if (garde.proprietaireId === ID_PROPRIETAIRE_A_RENSEIGNER && autre.proprietaireId && autre.proprietaireId !== ID_PROPRIETAIRE_A_RENSEIGNER) {
    s.proprietaireId = autre.proprietaireId;
    remplis.push('proprietaireId');
    if (autre.proprietaireDepuis && !garde.proprietaireDepuis) s.proprietaireDepuis = autre.proprietaireDepuis;
    if (autre.proprietairesPrecedents?.length && !garde.proprietairesPrecedents?.length) s.proprietairesPrecedents = copie(autre.proprietairesPrecedents);
  }
  prendre('numeroEnregistrement');
  prendre('dpe');
  if (!garde.residencePrincipale && autre.residencePrincipale) {
    s.residencePrincipale = true;
    remplis.push('residencePrincipale');
  }
  // Adresse : vide ici, connue là-bas → l'adresse entière (ville, code postal, place sur la carte).
  if (vide(garde.adresse) && !vide(autre.adresse)) {
    s.adresse = autre.adresse;
    if (vide(garde.ville)) s.ville = autre.ville;
    if (vide(garde.codePostal)) s.codePostal = autre.codePostal;
    if (!garde.position && autre.position) s.position = copie(autre.position);
    remplis.push('adresse');
  } else {
    prendre('ville');
    if (vide(garde.codePostal) && !vide(autre.codePostal) && adresseComparable(garde.adresse) === adresseComparable(autre.adresse)) {
      s.codePostal = autre.codePostal;
      remplis.push('codePostal');
    }
    if (!garde.position && autre.position && adresseComparable(s.adresse) === adresseComparable(autre.adresse)) {
      s.position = copie(autre.position);
      remplis.push('position');
    }
  }
  for (const k of ['surfaceM2', 'capacite', 'chambres'] as const) {
    if (!(garde[k] > 0) && autre[k] > 0) {
      s[k] = autre[k];
      remplis.push(k);
    }
  }
  prendre('lits');
  prendre('dotationLinge');
  prendre('contacts');
  prendre('photosEquipe');
  prendre('couleur');

  // Fiche voyageur, ménage et repères techniques : champ par champ.
  const fiche = { ...garde.fiche } as unknown as Record<string, unknown>;
  const ficheAutre = (autre.fiche ?? {}) as unknown as Record<string, unknown>;
  for (const k of CHAMPS_FICHE) {
    if (vide(fiche[k]) && !vide(ficheAutre[k])) {
      fiche[k] = copie(ficheAutre[k]);
      remplis.push(`fiche.${k}`);
    }
  }
  s.fiche = fiche as unknown as Logement['fiche'];
  const sousChamps = <K extends 'menage' | 'technique'>(cle: K, champs: readonly string[]) => {
    const ici = { ...(garde[cle] ?? {}) } as Record<string, unknown>;
    const la = (autre[cle] ?? {}) as Record<string, unknown>;
    let change = false;
    for (const c of champs) {
      if (vide(ici[c]) && !vide(la[c])) {
        ici[c] = la[c];
        remplis.push(`${cle}.${c}`);
        change = true;
      }
    }
    if (change) (s as unknown as Record<string, unknown>)[cle] = ici;
  };
  sousChamps('menage', CHAMPS_MENAGE);
  sousChamps('technique', CHAMPS_TECHNIQUE);

  // Lancement : une étape faite là-bas (mandat signé, linge étiqueté…) l'est ici aussi.
  const faites = new Map((autre.checklistLancement ?? []).filter((c) => c?.fait).map((c) => [c.cle, c]));
  if (garde.checklistLancement.some((c) => !c.fait && faites.has(c.cle))) {
    s.checklistLancement = garde.checklistLancement.map((c) => (!c.fait && faites.has(c.cle) ? { ...c, fait: true, ...(faites.get(c.cle)!.preuve && !c.preuve ? { preuve: faites.get(c.cle)!.preuve } : {}) } : c));
    remplis.push('checklistLancement');
  }
  return { logement: s, remplis };
}

/* ================================================================ déplacements */

/** Collections dont chaque élément porte un `logementId` : tout passe sur le logement gardé. */
export const COLLECTIONS_LOGEMENT_ID = [
  'reservations',
  'filsMessages',
  'missions',
  'mouvementsLinge',
  'incidents',
  'controles',
  'charges',
  'documentsProprietaire',
  'dossiers',
  'mandats',
  'avisADeposer',
  'envoisProgrammes',
  'reponsesAvis',
  'recommandations',
  'versionsAnnonce',
  'signalementsLogement',
  'demandesProprietaires',
] as const satisfies readonly (keyof ErpDonnees)[];

/**
 * Collections où l'identifiant du logement apparaît autrement : prix
 * conseillés (décisions, plancher et plafond par logement), actions de l'IA
 * (cible, lien), bilans (lignes et séjours), équipe (logements suivis),
 * réglages (suppléments, textes des messages automatiques), qui le suit
 * (affectations/<logement>).
 */
export const COLLECTIONS_AUTRES = ['conseilsPrix', 'actionsAgent', 'bilansProprietaire', 'equipe', 'reglages', 'affectations'] as const satisfies readonly (keyof ErpDonnees)[];

/** Toutes les collections touchées par un lien qui absorbe un logement (lues par le serveur). */
export const COLLECTIONS_DEPLACEES = [...COLLECTIONS_LOGEMENT_ID, ...COLLECTIONS_AUTRES] as const;

/** Clé d'un objet « par logement » déplacée vers l'autre logement seulement s'il n'y a rien pour lui (réglages). */
function cleDeplacee<V>(o: Record<string, V> | undefined, de: Id, vers: Id): Record<string, V> | undefined {
  if (!o || typeof o !== 'object' || !Object.prototype.hasOwnProperty.call(o, de)) return o;
  const { [de]: valeur, ...reste } = o;
  return Object.prototype.hasOwnProperty.call(reste, vers) ? reste : { ...reste, [vers]: valeur };
}

const lienVers = (lien: string | undefined, de: Id, vers: Id): string | undefined => {
  if (!lien) return lien;
  const p = `/erp/logements/${encodeURIComponent(de)}`;
  return lien === p || lien.startsWith(`${p}?`) || lien.startsWith(`${p}#`) || lien.startsWith(`${p}/`) ? `/erp/logements/${encodeURIComponent(vers)}${lien.slice(p.length)}` : lien;
};

/**
 * Un élément d'une collection, avec l'identifiant `de` remplacé par `vers`.
 * Le même objet s'il n'a rien à changer (rien à réécrire). Les affectations
 * sont à part (deplacerAffectations : deux éléments à réunir).
 */
export function elementDeplace(collection: string, e: unknown, de: Id, vers: Id): unknown {
  if (!e || typeof e !== 'object') return e;
  const x = e as Record<string, unknown>;
  if ((COLLECTIONS_LOGEMENT_ID as readonly string[]).includes(collection)) return x.logementId === de ? { ...x, logementId: vers } : e;
  switch (collection) {
    case 'conseilsPrix': {
      if (x.genre === 'decision') return x.logementId === de ? { ...x, logementId: vers } : e;
      if (x.genre === 'reglages') {
        const r = x as unknown as ReglagesPrix;
        const parLogement = cleDeplacee(r.parLogement, de, vers);
        return parLogement === r.parLogement ? e : { ...r, parLogement: parLogement ?? {} };
      }
      return e;
    }
    case 'actionsAgent': {
      const lien = lienVers(x.lien as string | undefined, de, vers);
      if (x.cibleId !== de && lien === x.lien) return e;
      return { ...x, ...(x.cibleId === de ? { cibleId: vers } : {}), ...(lien !== x.lien ? { lien } : {}) };
    }
    case 'bilansProprietaire': {
      const c = x.chiffres as { logements?: { logementId?: Id }[]; sejours?: { logementId?: Id }[] } | undefined;
      const touche = (l?: { logementId?: Id }[]) => (l ?? []).some((y) => y?.logementId === de);
      if (!c || (!touche(c.logements) && !touche(c.sejours))) return e;
      const repointer = <T extends { logementId?: Id }>(l?: T[]) => (l ? l.map((y) => (y?.logementId === de ? { ...y, logementId: vers } : y)) : l);
      return { ...x, chiffres: { ...c, logements: repointer(c.logements), sejours: repointer(c.sejours) } };
    }
    case 'equipe': {
      const ids = x.logementIds as Id[] | undefined;
      if (!Array.isArray(ids) || !ids.includes(de)) return e;
      return { ...x, logementIds: [...new Set(ids.map((i) => (i === de ? vers : i)))] };
    }
    case 'reglages': {
      const r = x as unknown as Reglage;
      if (r.id === ID_REGLAGES_SUPPLEMENTS) {
        const s = r as ReglagesSupplements;
        const logements = cleDeplacee(s.logements, de, vers);
        return logements === s.logements ? e : { ...s, logements: logements ?? {} };
      }
      if (r.id === ID_REGLAGES_PROGRAMMES) {
        const p = r as ReglagesMessagesProgrammes;
        if (!p.modeles || typeof p.modeles !== 'object') return e;
        let change = false;
        const modeles = Object.fromEntries(
          Object.entries(p.modeles).map(([k, m]) => {
            const logements = cleDeplacee(m?.logements, de, vers);
            if (logements === m?.logements) return [k, m];
            change = true;
            return [k, { ...m, logements: logements ?? {} }];
          }),
        ) as ReglagesMessagesProgrammes['modeles'];
        return change ? { ...p, modeles } : e;
      }
      return e;
    }
    default:
      return e;
  }
}

/**
 * Qui suit le logement : l'affectation de l'autre logement remplit les
 * champs vides de celle d'ici (ou devient celle d'ici), puis disparaît.
 */
export function deplacerAffectations(affectations: readonly AffectationLogement[], de: Id, vers: Id): { ecrire?: AffectationLogement; supprimer?: Id } {
  const la = affectations.find((a) => a?.id === de);
  if (!la) return {};
  const ici = affectations.find((a) => a?.id === vers);
  if (!ici) {
    const { id: _id, ...reste } = la;
    return { ecrire: { ...reste, id: vers }, supprimer: de };
  }
  const suivant: AffectationLogement = { ...ici };
  if (!ici.responsableId && la.responsableId) suivant.responsableId = la.responsableId;
  if (!ici.remplacantId && la.remplacantId && la.remplacantId !== suivant.responsableId) suivant.remplacantId = la.remplacantId;
  if (!ici.pointsControle?.length && la.pointsControle?.length) suivant.pointsControle = [...la.pointsControle];
  const change = suivant.responsableId !== ici.responsableId || suivant.remplacantId !== ici.remplacantId || suivant.pointsControle !== ici.pointsControle;
  return { ...(change ? { ecrire: suivant } : {}), supprimer: de };
}

/** Ce que contient l'autre logement et qui rejoint celui-ci (mêmes mots que la suppression d'un logement). */
export function ceQuiRejoint(autre: Logement, d: Partial<ErpDonnees>): TraceHistorique[] {
  return historiqueDuLogement(autre, d);
}

const ORDRE_PHRASE: readonly string[] = ['reservations', 'conversations', 'menages', 'missions', 'incidents', 'avis', 'messagesAuto', 'mandats', 'dossiers', 'documents', 'bilans', 'linge', 'controles', 'charges', 'ameliorations', 'textesAnnonce', 'prix', 'actionsIA'];
const FEMININS = new Set(['reservations', 'conversations', 'factures', 'missions', 'charges', 'ameliorations', 'actionsIA']);
const SINGULIERS: Record<string, string> = {
  reservations: 'réservation',
  conversations: 'conversation',
  factures: 'facture',
  bilans: 'bilan publié',
  documents: 'document partagé',
  mandats: 'mandat',
  dossiers: 'dossier propriétaire',
  menages: 'ménage',
  missions: 'mission',
  linge: 'mouvement de linge',
  incidents: 'incident',
  controles: 'contrôle qualité',
  charges: 'charge',
  avis: 'avis à déposer',
  messagesAuto: 'message automatique',
  ameliorations: 'amélioration proposée',
  textesAnnonce: 'texte d’annonce validé',
  prix: 'prix conseillé traité',
  actionsIA: 'action de l’IA',
};

/**
 * La phrase du récapitulatif : « Ses 12 réservations, 3 conversations et
 * 2 ménages rejoignent ce logement. » ; « Sa réservation rejoint ce
 * logement. » ; vide quand l'autre logement n'a encore rien.
 */
export function phraseCeQuiRejoint(toutes: readonly TraceHistorique[]): string {
  // Les factures gardent leur texte (noms figés) : elles ne « rejoignent » rien. Le plus parlant d'abord.
  const rang = (c: string) => {
    const i = ORDRE_PHRASE.indexOf(c);
    return i < 0 ? ORDRE_PHRASE.length : i;
  };
  const traces = toutes.filter((t) => t.cle !== 'factures').sort((a, b) => rang(a.cle) - rang(b.cle));
  if (!traces.length) return '';
  if (traces.length === 1 && traces[0].nombre === 1) {
    const mot = SINGULIERS[traces[0].cle] ?? traces[0].libelle;
    const voyelle = /^[aeéèêiîoôuh]/i.test(mot);
    return `${FEMININS.has(traces[0].cle) && !voyelle ? 'Sa' : 'Son'} ${mot} rejoint ce logement.`;
  }
  const l = traces.map((t) => t.libelle);
  const liste = l.length > 4 ? `${l.slice(0, 3).join(', ')} et d’autres éléments` : l.length < 2 ? l[0] : `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}`;
  return `Ses ${liste} rejoignent ce logement.`;
}

/* ================================================================ application locale */

export interface ConnexionAppliquee<D> {
  donnees: D;
  logement: Logement;
  remplis: string[];
  /** Éléments changés par collection (hors logements). */
  deplaces: Partial<Record<keyof ErpDonnees, number>>;
}

/**
 * Le jeu de données une fois l'annonce reliée au logement gardé (démo,
 * vérificateur ; le serveur applique les mêmes règles élément par élément) :
 * logement gardé fusionné, tout ce qui portait l'autre logement déplacé,
 * l'autre logement et son affectation retirés. Les éléments sans rapport
 * gardent leur identité (rien d'autre n'est réécrit).
 */
export function relierConnexionDe<D extends Partial<ErpDonnees>>(d: D, o: { garde: Logement; autre?: Logement; liee: AnnonceLiee }): ConnexionAppliquee<D> {
  const suivant: Partial<ErpDonnees> = { ...d };
  const { logement, remplis } = fusionnerLogement(o.garde, o.liee, o.autre);
  const deplaces: Partial<Record<keyof ErpDonnees, number>> = {};
  const logements = (d.logements ?? []).filter((l) => !o.autre || l.id !== o.autre.id).map((l) => (l.id === o.garde.id ? logement : l));
  suivant.logements = logements;
  if (o.autre) {
    const de = o.autre.id;
    const vers = o.garde.id;
    for (const cle of [...COLLECTIONS_LOGEMENT_ID, 'conseilsPrix', 'actionsAgent', 'bilansProprietaire', 'equipe', 'reglages'] as const) {
      const liste = d[cle] as unknown[] | undefined;
      if (!Array.isArray(liste)) continue;
      let n = 0;
      const nouvelle = liste.map((e) => {
        const x = elementDeplace(cle, e, de, vers);
        if (x !== e) n++;
        return x;
      });
      if (n) {
        (suivant as Record<string, unknown>)[cle] = nouvelle;
        deplaces[cle] = n;
      }
    }
    if (Array.isArray(d.affectations)) {
      const a = deplacerAffectations(d.affectations, de, vers);
      if (a.supprimer || a.ecrire) {
        const reste = d.affectations.filter((x) => x?.id !== a.supprimer && (!a.ecrire || x?.id !== a.ecrire.id));
        suivant.affectations = a.ecrire ? [...reste, a.ecrire] : reste;
        deplaces.affectations = 1;
      }
    }
  }
  return { donnees: suivant as D, logement, remplis, deplaces };
}

/** L'annonce reliée telle qu'elle entre dans `repull.liees`. */
export function nouvelleLiee(o: { annonce: string; canal: CanalPlateforme; nom?: string; le: Horodatage; par: string; depuis?: Id }): AnnonceLiee {
  return { id: o.annonce, canal: o.canal, ...(o.nom ? { nom: o.nom } : {}), le: o.le, par: o.par, ...(o.depuis ? { depuis: o.depuis } : {}) };
}

/* ================================================================ trace serveur */

/** Trace côté serveur des annonces reliées (repull/annonces-reliees) : quelle annonce va sur quel logement, d'où elle venait. */
export interface TraceAnnoncesReliees {
  id: 'annonces-reliees';
  annonces: Record<string, { logementId: Id; canal: CanalPlateforme; depuis?: Id; nom?: string; le: Horodatage; par: string }>;
}
