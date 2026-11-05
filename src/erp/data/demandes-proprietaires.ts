/**
 * Demandes des propriétaires (novembre 2026) : depuis son espace, un
 * propriétaire pose une question ou fait une demande particulière (travaux,
 * clés, linge, prix, calendrier…) ; le gérant de SON espace est prévenu
 * (notification « Demande d’un propriétaire », e-mail si l'envoi est
 * configuré), lit la demande dans l'ERP (Logements → Demandes, « À faire »
 * de l'Accueil, fiche du propriétaire), répond et règle. La réponse
 * s'affiche dans « Mes demandes ».
 *
 * Règles pures, partagées par le serveur (api/espace-proprietaire.ts), la
 * page du propriétaire, l'ERP et la démo :
 *   - saisie et limites : type connu, sujet connu pour une demande
 *     particulière, logement parmi SES logements actuels (ou « Tous mes
 *     logements »), message nettoyé de 10 à 2 000 caractères ;
 *   - au plus 5 demandes par heure et 20 par 24 heures et par propriétaire,
 *     comptées dans la base (pas seulement dans la mémoire d'une instance) ;
 *   - cloisonnement : un propriétaire ne voit et ne crée que SES demandes,
 *     lues dans la base de l'espace de sa session (jamais un autre espace) ;
 *     sa vue ne porte jamais qui a répondu dans l'équipe ;
 *   - états : envoyée → vue → répondue → réglée, chaque changement gardé.
 *
 * Le texte du propriétaire est une DONNÉE, jamais une instruction : il ne
 * part ni vers l'agent IA, ni vers le connecteur Claude, ni vers une
 * plateforme (verifier-demandes-proprietaires.ts le vérifie).
 *
 * Imports relatifs en « .js » : ce module tourne aussi côté serveur.
 */
import { ID_PROPRIETAIRE_A_RENSEIGNER } from './repull.js';
import type {
  ChangementDemande,
  DemandeProprietaire,
  EchangeDemande,
  Horodatage,
  Id,
  Logement,
  StatutDemandeProprietaire,
  SujetDemandeProprietaire,
  TypeDemandeProprietaire,
} from './types';
import type { DemandeVue } from './types-proprietaire';

/** Collection de erp.enregistrements (sans SQL : lisible par l'équipe de l'espace, voir docs/erp/README.md). */
export const COLLECTION_DEMANDES = 'demandesProprietaires';

const NBSP = ' ';

/* ------------------------------------------------------------- libellés */

export const TYPES_DEMANDE: { valeur: TypeDemandeProprietaire; libelle: string; detail?: string }[] = [
  { valeur: 'question', libelle: 'Une question', detail: 'Sur un séjour, un bilan, une facture…' },
  { valeur: 'demande', libelle: 'Une demande particulière', detail: 'Travaux, clés, linge, prix, calendrier…' },
  { valeur: 'autre', libelle: 'Autre chose' },
];

export const SUJETS_DEMANDE: { valeur: SujetDemandeProprietaire; libelle: string }[] = [
  { valeur: 'travaux', libelle: 'Travaux' },
  { valeur: 'cles', libelle: 'Clés' },
  { valeur: 'linge', libelle: 'Linge' },
  { valeur: 'prix', libelle: 'Prix' },
  { valeur: 'calendrier', libelle: 'Calendrier' },
  { valeur: 'autre', libelle: 'Autre' },
];

export const STATUTS_DEMANDE: readonly StatutDemandeProprietaire[] = ['envoyee', 'vue', 'repondue', 'reglee'];

/** Ce que lit le propriétaire (« Mes demandes »). */
export const LIBELLE_STATUT_PROPRIETAIRE: Record<StatutDemandeProprietaire, string> = { envoyee: 'Envoyée', vue: 'Vue', repondue: 'Répondue', reglee: 'Réglée' };
/** Ce que lit le gérant : les mêmes états, « Nouvelle » tant qu'il ne l'a pas ouverte. */
export const LIBELLE_STATUT_GERANT: Record<StatutDemandeProprietaire, string> = { envoyee: 'Nouvelle', vue: 'Vue', repondue: 'Répondue', reglee: 'Réglée' };

/** États que le gérant choisit (« Envoyée » ne vient que du propriétaire). */
export const STATUTS_GERANT: readonly Exclude<StatutDemandeProprietaire, 'envoyee'>[] = ['vue', 'repondue', 'reglee'];

const TYPES = new Set<string>(TYPES_DEMANDE.map((t) => t.valeur));
const SUJETS = new Set<string>(SUJETS_DEMANDE.map((s) => s.valeur));
const STATUTS = new Set<string>(STATUTS_DEMANDE);
export const typeValide = (t: unknown): t is TypeDemandeProprietaire => typeof t === 'string' && TYPES.has(t);
export const sujetValide = (s: unknown): s is SujetDemandeProprietaire => typeof s === 'string' && SUJETS.has(s);
export const statutValide = (s: unknown): s is StatutDemandeProprietaire => typeof s === 'string' && STATUTS.has(s);

/** « Question », « Demande · Clés », « Demande particulière », « Autre demande ». */
export function libelleDemande(d: { type?: unknown; sujet?: unknown }): string {
  if (d.type === 'question') return 'Question';
  if (d.type === 'demande') {
    const s = SUJETS_DEMANDE.find((x) => x.valeur === d.sujet);
    return s && s.valeur !== 'autre' ? `Demande · ${s.libelle}` : 'Demande particulière';
  }
  return 'Autre demande';
}

/** Écran de la demande dans l'ERP (notification, « À faire », fiche du propriétaire). */
export const lienDemande = (id: Id): string => `/erp/logements/demandes?demande=${encodeURIComponent(id)}`;

/* --------------------------------------------------------------- limites */

/** Message du propriétaire, réponse de la conciergerie : en caractères (un emoji compte pour un). */
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
/** Demandes au plus par propriétaire : dans l'heure, sur 24 heures. */
export const PLAFOND_DEMANDES_HEURE = 5;
export const PLAFOND_DEMANDES_JOUR = 20;
/** Messages au plus dans un échange (le message du propriétaire compris). */
export const ECHANGES_MAX = 40;
/** Demandes au plus renvoyées au propriétaire (les plus récentes). */
export const DEMANDES_VUES_MAX = 100;

const HEURE_MS = 3_600_000;
const JOUR_MS = 24 * HEURE_MS;

/** « 2 000 » (espace insécable). */
const milliers = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

/** Longueur affichée et contrôlée : en caractères, pas en unités UTF-16. */
export const longueur = (s: string): number => Array.from(s).length;

/**
 * Texte libre nettoyé : forme normale (NFC), fins de ligne unifiées,
 * caractères de contrôle et invisibles (sens d'écriture, espaces de largeur
 * nulle) retirés, espaces de fin de ligne ôtés, trois lignes vides ou plus
 * ramenées à une. Borné avant tout calcul (un texte énorme ne coûte rien).
 */
export function nettoyerTexteDemande(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v
    .slice(0, MESSAGE_MAX * 4)
    .normalize('NFC')
    .replace(/\r\n?|[\u2028\u2029\u0085]/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '')
    .replace(/\p{Cf}/gu, '')
    .split('\n')
    .map((l) => l.replace(/[  ]+$/u, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Erreur d'un message (propriétaire) ou d'une réponse (gérant) ; undefined : bon. */
function erreurTexte(t: string, o: { min: number; vide: string }): string | undefined {
  const n = longueur(t);
  if (!n) return o.vide;
  if (n < o.min) return `Écrivez au moins ${o.min} caractères.`;
  if (n > MESSAGE_MAX) return `${milliers(MESSAGE_MAX)} caractères au plus${NBSP}: raccourcissez votre message.`;
  return undefined;
}

/* ---------------------------------------------------------------- saisie */

/** Ce que le propriétaire saisit, pas à pas. `logement` : un de ses logements, « tous », ou rien (aucun choix à faire). */
export interface SaisieDemande {
  type?: TypeDemandeProprietaire;
  sujet?: SujetDemandeProprietaire;
  logement?: Id | 'tous';
  message: string;
}

export type EtapeSaisieDemande = 'type' | 'logement' | 'message' | 'recapitulatif';

/** Écrans de l'assistant : le choix du logement seulement s'il en a plusieurs. */
export function etapesDemande(nbLogements: number): EtapeSaisieDemande[] {
  return nbLogements > 1 ? ['type', 'logement', 'message', 'recapitulatif'] : ['type', 'message', 'recapitulatif'];
}

/** Saisie de départ : un seul logement, il est déjà choisi. */
export function saisieInitiale(logements: readonly { id: Id }[]): SaisieDemande {
  return { message: '', ...(logements.length === 1 ? { logement: logements[0].id } : {}) };
}

export type ChampDemande = 'type' | 'sujet' | 'logement' | 'message';

export const MESSAGES_SAISIE = {
  type: 'Choisissez de quoi il s’agit.',
  sujet: 'Choisissez le sujet de votre demande.',
  logement: `Choisissez le logement concerné, ou «${NBSP}Tous mes logements${NBSP}».`,
  message: 'Écrivez votre message.',
} as const;

/** Ce qui manque à un écran (en toutes lettres), champ par champ ; vide : on peut continuer. */
export function erreursEtapeDemande(etape: EtapeSaisieDemande, s: SaisieDemande, logements: readonly { id: Id }[]): Partial<Record<ChampDemande, string>> {
  const e: Partial<Record<ChampDemande, string>> = {};
  const tout = etape === 'recapitulatif';
  if (etape === 'type' || tout) {
    if (!typeValide(s.type)) e.type = MESSAGES_SAISIE.type;
    else if (s.type === 'demande' && !sujetValide(s.sujet)) e.sujet = MESSAGES_SAISIE.sujet;
  }
  if ((etape === 'logement' || tout) && logements.length > 1 && !(s.logement === 'tous' || logements.some((l) => l.id === s.logement))) {
    e.logement = MESSAGES_SAISIE.logement;
  }
  if (etape === 'message' || tout) {
    const m = erreurTexte(nettoyerTexteDemande(s.message), { min: MESSAGE_MIN, vide: MESSAGES_SAISIE.message });
    if (m) e.message = m;
  }
  return e;
}

/** Demande validée par le serveur : seulement des valeurs connues, un logement à lui, un message propre. */
export interface SaisieValide {
  type: TypeDemandeProprietaire;
  sujet?: SujetDemandeProprietaire;
  logementId?: Id;
  tousLogements?: boolean;
  message: string;
}

/**
 * Corps envoyé par la page du propriétaire, vérifié champ par champ. Seuls
 * `type`, `sujet`, `logement` et `message` sont lus : identifiant, état,
 * dates, propriétaire ou réponse glissés dans le corps sont ignorés.
 * `logements` : SES logements actuels (le serveur les a filtrés).
 */
export function validerDemande(corps: unknown, logements: readonly { id: Id }[]): { ok: true; saisie: SaisieValide } | { ok: false; champ: ChampDemande; erreur: string } {
  const c = (corps && typeof corps === 'object' ? corps : {}) as Record<string, unknown>;
  if (!typeValide(c.type)) return { ok: false, champ: 'type', erreur: MESSAGES_SAISIE.type };
  const type = c.type;
  let sujet: SujetDemandeProprietaire | undefined;
  if (type === 'demande') {
    if (!sujetValide(c.sujet)) return { ok: false, champ: 'sujet', erreur: MESSAGES_SAISIE.sujet };
    sujet = c.sujet;
  }
  const choisi = typeof c.logement === 'string' ? c.logement : undefined;
  let logementId: Id | undefined;
  let tousLogements: boolean | undefined;
  if (logements.length === 1) logementId = logements[0].id;
  else if (logements.length > 1) {
    if (choisi === 'tous') tousLogements = true;
    else if (choisi && logements.some((l) => l.id === choisi)) logementId = choisi;
    else return { ok: false, champ: 'logement', erreur: MESSAGES_SAISIE.logement };
  }
  const message = nettoyerTexteDemande(c.message);
  const m = erreurTexte(message, { min: MESSAGE_MIN, vide: MESSAGES_SAISIE.message });
  if (m) return { ok: false, champ: 'message', erreur: m };
  return { ok: true, saisie: { type, ...(sujet ? { sujet } : {}), ...(logementId ? { logementId } : {}), ...(tousLogements ? { tousLogements } : {}), message } };
}

/** Un propriétaire réel (pas la fiche d'attente des logements importés). */
const proprietaireReel = (id: unknown): id is Id => typeof id === 'string' && id.trim() !== '' && id !== ID_PROPRIETAIRE_A_RENSEIGNER;

/** Ses logements actuels, en gestion (pas sortis) : ceux qu'il peut choisir. */
export function logementsDeLaDemande<L extends Pick<Logement, 'id' | 'proprietaireId' | 'statut'>>(logements: readonly L[], proprietaireId: Id): L[] {
  if (!proprietaireReel(proprietaireId)) return [];
  return logements.filter((l) => !!l && l.proprietaireId === proprietaireId && l.statut !== 'sorti');
}

/* --------------------------------------------------------------- limites */

/**
 * Plus de demande pour l'instant ? Compte SES demandes (toutes, réglées
 * comprises) des 60 dernières minutes et des 24 dernières heures ; une date
 * dans le futur compte aussi (horloge décalée : jamais une porte ouverte).
 */
export function limiteDemandes(demandes: readonly unknown[], proprietaireId: Id, maintenantMs: number): { ok: true } | { ok: false; erreur: string } {
  const instants = demandes
    .filter((d): d is DemandeProprietaire => !!d && typeof d === 'object' && (d as DemandeProprietaire).proprietaireId === proprietaireId)
    .map((d) => Date.parse(String(d.creeLe ?? '')))
    .map((t) => (Number.isFinite(t) ? t : maintenantMs));
  const depuis = (ms: number) => instants.filter((t) => t > maintenantMs - ms).length;
  if (depuis(HEURE_MS) >= PLAFOND_DEMANDES_HEURE) {
    return { ok: false, erreur: `Vous avez déjà envoyé ${PLAFOND_DEMANDES_HEURE} demandes dans l’heure${NBSP}: patientez un peu avant la suivante, ou appelez votre conciergerie.` };
  }
  if (depuis(JOUR_MS) >= PLAFOND_DEMANDES_JOUR) {
    return { ok: false, erreur: `Vous avez déjà envoyé ${PLAFOND_DEMANDES_JOUR} demandes en 24${NBSP}heures${NBSP}: la suivante pourra partir demain, ou appelez votre conciergerie.` };
  }
  return { ok: true };
}

/* -------------------------------------------------------------- création */

const FORME_ID = /^dem-[a-z0-9]{16,40}$/;
export const idDemandeValide = (id: unknown): id is Id => typeof id === 'string' && FORME_ID.test(id);

/** Identifiant tiré au hasard (96 bits) : jamais choisi par la page. */
export function idDemande(aleatoire: Uint8Array = globalThis.crypto.getRandomValues(new Uint8Array(12))): Id {
  return `dem-${Array.from(aleatoire, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function nouvelleDemande(s: SaisieValide, o: { id: Id; proprietaireId: Id; le: Horodatage }): DemandeProprietaire {
  return {
    id: o.id,
    proprietaireId: o.proprietaireId,
    type: s.type,
    ...(s.sujet ? { sujet: s.sujet } : {}),
    ...(s.logementId ? { logementId: s.logementId } : {}),
    ...(s.tousLogements ? { tousLogements: true } : {}),
    statut: 'envoyee',
    creeLe: o.le,
    majLe: o.le,
    echanges: [{ id: `${o.id}-1`, auteur: 'proprietaire', texte: s.message, le: o.le }],
    historique: [{ statut: 'envoyee', le: o.le }],
  };
}

/** Ce dont l'enregistrement a besoin de la base (BaseErp en production). */
export interface BaseDemandes {
  lire<T>(collection: string, ids?: string[]): Promise<T[]>;
  /** Ajoute seulement si l'identifiant est libre ; renvoie le nombre ajouté. */
  ajouterSiAbsent(collection: string, elements: { id: string }[], auteur?: string): Promise<number>;
}

export type ResultatEnregistrement =
  | { ok: true; demande: DemandeProprietaire }
  | { ok: false; statut: 400 | 429 | 409; code: string; erreur: string };

/**
 * Enregistre la demande d'un propriétaire dans la base de SON espace (celle
 * de sa session) : corps vérifié, logement à lui, plafonds, puis ajout sans
 * jamais remplacer une ligne existante. `logements` : les logements de cette
 * base (filtrés ici sur les siens). Rien d'autre n'est écrit.
 */
export async function enregistrerDemande(
  base: BaseDemandes,
  o: { proprietaireId: Id; corps: unknown; logements: readonly Pick<Logement, 'id' | 'proprietaireId' | 'statut'>[]; maintenantMs: number; le: Horodatage; id?: Id },
): Promise<ResultatEnregistrement> {
  if (!proprietaireReel(o.proprietaireId)) return { ok: false, statut: 400, code: 'proprietaire', erreur: 'Espace introuvable. Contactez votre conciergerie.' };
  const v = validerDemande(o.corps, logementsDeLaDemande(o.logements, o.proprietaireId));
  if (!v.ok) return { ok: false, statut: 400, code: v.champ, erreur: v.erreur };
  const existantes = await base.lire<unknown>(COLLECTION_DEMANDES);
  const limite = limiteDemandes(existantes, o.proprietaireId, o.maintenantMs);
  if (!limite.ok) return { ok: false, statut: 429, code: 'limite', erreur: limite.erreur };
  const demande = nouvelleDemande(v.saisie, { id: o.id ?? idDemande(), proprietaireId: o.proprietaireId, le: o.le });
  const ajoutees = await base.ajouterSiAbsent(COLLECTION_DEMANDES, [demande], 'Espace propriétaire');
  if (ajoutees !== 1) return { ok: false, statut: 409, code: 'id', erreur: 'Votre demande n’a pas pu être enregistrée. Réessayez dans un instant.' };
  return { ok: true, demande };
}

/* ------------------------------------------------------ vue du propriétaire */

type LogementNomme = Pick<Logement, 'id' | 'nom' | 'proprietaireId' | 'proprietairesPrecedents'>;

/**
 * « Mes demandes » : SES demandes seulement (même identifiant de
 * propriétaire), des plus récentes aux plus anciennes, réduites à ce qu'il
 * doit lire. Jamais qui a répondu dans l'équipe, jamais l'historique des
 * états ; le nom d'un logement seulement s'il est (ou a été) à lui.
 */
export function demandesVues(demandes: readonly unknown[], proprietaireId: Id, logements: readonly LogementNomme[]): DemandeVue[] {
  if (!proprietaireReel(proprietaireId)) return [];
  const noms = new Map(
    logements
      .filter((l) => !!l && (l.proprietaireId === proprietaireId || (l.proprietairesPrecedents ?? []).some((p) => p?.proprietaireId === proprietaireId)))
      .map((l) => [l.id, String(l.nom ?? '')]),
  );
  const vues: DemandeVue[] = [];
  for (const x of demandes) {
    const d = x as Partial<DemandeProprietaire> | null;
    if (!d || typeof d !== 'object' || d.proprietaireId !== proprietaireId || typeof d.id !== 'string') continue;
    const nom = d.logementId ? noms.get(d.logementId) : undefined;
    const echanges = (Array.isArray(d.echanges) ? d.echanges : [])
      .filter((e): e is EchangeDemande => !!e && (e.auteur === 'proprietaire' || e.auteur === 'conciergerie') && typeof e.texte === 'string')
      .slice(0, ECHANGES_MAX)
      .map((e) => ({ id: String(e.id ?? ''), auteur: e.auteur, texte: e.texte.slice(0, MESSAGE_MAX * 2), le: String(e.le ?? '') }));
    vues.push({
      id: d.id,
      type: typeValide(d.type) ? d.type : 'autre',
      ...(d.type === 'demande' && sujetValide(d.sujet) ? { sujet: d.sujet } : {}),
      ...(d.logementId && nom !== undefined ? { logement: { id: d.logementId, nom: nom || 'Logement' } } : {}),
      ...(d.tousLogements === true ? { tousLogements: true } : {}),
      statut: statutValide(d.statut) ? d.statut : 'envoyee',
      creeLe: String(d.creeLe ?? ''),
      majLe: String(d.majLe ?? d.creeLe ?? ''),
      echanges,
    });
  }
  const t = (h: string) => Date.parse(h) || 0;
  return vues.sort((a, b) => t(b.creeLe) - t(a.creeLe)).slice(0, DEMANDES_VUES_MAX);
}

/** Où porte la demande, pour lui (« Tous mes logements ») ou pour le gérant (« Tous ses logements »). */
export function ouPorteLaDemande(d: { logement?: { nom: string }; tousLogements?: boolean }, pour: 'proprietaire' | 'gerant'): string {
  if (d.logement) return d.logement.nom;
  if (d.tousLogements) return pour === 'proprietaire' ? 'Tous mes logements' : 'Tous ses logements';
  return pour === 'proprietaire' ? 'Mon espace' : 'Sans logement précis';
}

/* ------------------------------------------------------------- le gérant */

/** Lire les demandes : le gérant (notification et liste réservées, comme les nouvelles demandes du CRM). */
export const peutVoirDemandes = (role: string | undefined): boolean => role === 'gerant';
/** Répondre, changer l'état : le gérant, hors lecture seule. */
export const peutTraiterDemandes = (role: string | undefined, lectureSeule = false): boolean => role === 'gerant' && !lectureSeule;

/** Attend le gérant : pas encore répondue ni réglée. */
export const demandeATraiter = (d: Pick<DemandeProprietaire, 'statut'> | undefined): boolean => d?.statut === 'envoyee' || d?.statut === 'vue';

/** Les demandes qui attendent : les nouvelles d'abord, puis les plus anciennes. */
export function demandesATraiter<D extends Pick<DemandeProprietaire, 'statut' | 'creeLe'>>(demandes: readonly D[] | undefined): D[] {
  const t = (h: string) => Date.parse(h) || 0;
  return (demandes ?? []).filter(demandeATraiter).sort((a, b) => (a.statut === b.statut ? t(a.creeLe) - t(b.creeLe) : a.statut === 'envoyee' ? -1 : 1));
}

const avecChangement = (d: DemandeProprietaire, statut: StatutDemandeProprietaire, o: { par: string; le: Horodatage }): DemandeProprietaire => {
  const etape: ChangementDemande = { statut, le: o.le, ...(o.par ? { par: o.par } : {}) };
  return { ...d, statut, majLe: o.le, historique: [...(Array.isArray(d.historique) ? d.historique : []), etape] };
};

/** Ouverte par le gérant : « Vue » (seulement une demande encore « Envoyée » ; sinon la même, inchangée). */
export function marquerVue(d: DemandeProprietaire, o: { par: string; le: Horodatage }): DemandeProprietaire {
  return d.statut === 'envoyee' ? avecChangement(d, 'vue', o) : d;
}

/** Le gérant change l'état : Vue, Répondue ou Réglée (jamais « Envoyée »). Même état : inchangée. */
export function changerStatutDemande(d: DemandeProprietaire, statut: unknown, o: { par: string; le: Horodatage }): { ok: true; demande: DemandeProprietaire } | { ok: false; erreur: string } {
  if (!(STATUTS_GERANT as readonly unknown[]).includes(statut)) return { ok: false, erreur: 'État inconnu.' };
  if (d.statut === statut) return { ok: true, demande: d };
  return { ok: true, demande: avecChangement(d, statut as StatutDemandeProprietaire, o) };
}

/**
 * Réponse de la conciergerie, ajoutée à l'échange : la demande passe
 * « Répondue » (une demande déjà répondue ou réglée garde son état). Texte nettoyé, 2 000
 * caractères au plus ; 40 messages au plus par échange.
 */
export function repondreDemande(
  d: DemandeProprietaire,
  texte: unknown,
  o: { id: Id; par: string; le: Horodatage },
): { ok: true; demande: DemandeProprietaire } | { ok: false; erreur: string } {
  const t = nettoyerTexteDemande(texte);
  const e = erreurTexte(t, { min: 1, vide: 'Écrivez votre réponse.' });
  if (e) return { ok: false, erreur: e };
  const echanges = Array.isArray(d.echanges) ? d.echanges : [];
  if (echanges.length >= ECHANGES_MAX) return { ok: false, erreur: `Cet échange est déjà très long${NBSP}: appelez le propriétaire, puis marquez la demande réglée.` };
  const reponse: EchangeDemande = { id: o.id, auteur: 'conciergerie', texte: t, le: o.le, ...(o.par ? { par: o.par } : {}) };
  const suite = { ...d, echanges: [...echanges, reponse] };
  // Déjà répondue : l'état ne change pas (pas de doublon dans l'historique) ; réglée : elle le reste.
  return { ok: true, demande: d.statut === 'reglee' || d.statut === 'repondue' ? { ...suite, majLe: o.le } : avecChangement(suite, 'repondue', o) };
}
