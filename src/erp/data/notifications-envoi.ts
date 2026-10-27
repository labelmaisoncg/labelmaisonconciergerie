/**
 * Notifications de l'app installable, côté serveur : appareils abonnés,
 * envoi, surveillance d'un passage. Sans Node ni variable d'environnement
 * (les clés serveur sont passées par api/_erp-notifications.ts), donc
 * vérifiable comme le reste de l'ERP (verifier-notifications.ts).
 *
 * - Appareils : collection technique « connecteurs » (lisible des seuls
 *   gérants, cf. supabase/erp-connecteurs-gerants.sql), un enregistrement
 *   par appareil : `notifications-appareil-<empreinte de l'adresse>`.
 * - Journal des envois (idempotence) : `connecteurs/notifications-journal`.
 * - `surveiller(base, travail)` photographie la base avant et après une
 *   synchronisation, un événement Repull ou un passage de l'agent, et envoie
 *   ce qui est nouveau (notifications.ts). Un échec d'envoi ne fait jamais
 *   échouer le travail surveillé.
 */
import { COLLECTION_ANNONCES_EQUIPE, deciderEnvoiAnnonce, idAnnonceValide, MESSAGE_ANNONCE_RESERVEE, peutAnnoncer } from './annonces-equipe.js';
import { estActive, nettoyerPreferences, notificationsEntre, preferencesPourRole, varianteAEnvoyer, type GroupeNotification, type Instantane, type PreferencesNotifications } from './notifications.js';
import type { FilMessages, Logement, Reservation } from './types';
import { deB64url, empreinte, endpointAccepte, envoyerPush, type AbonnementPush, type ClesVapid, type ResultatEnvoi } from './web-push.js';

/** Ce dont les notifications ont besoin de la base de l'ERP (BaseErp en production). */
export interface BaseNotifications {
  lire<T>(collection: string, ids?: string[]): Promise<T[]>;
  ecrire(collection: string, elements: { id: string }[], auteur?: string): Promise<void>;
}

const COLLECTION = 'connecteurs';
const PREFIXE_APPAREIL = 'notifications-appareil-';
const ID_JOURNAL = 'notifications-journal';
const AUTEUR = 'Notifications';
/** Clés gardées dans le journal d'idempotence (les plus récentes). */
const TAILLE_JOURNAL = 800;

export interface Appareil {
  id: string;
  type: 'notifications-appareil';
  endpoint: string;
  keys: { p256dh: string; auth: string };
  preferences: PreferencesNotifications;
  /** « iPhone », « Android », « Ordinateur » : pour s'y retrouver. */
  nom?: string;
  /** Compte qui a activé les notifications sur cet appareil. */
  par?: string;
  /**
   * Rôle de ce compte dans l'espace, posé par le serveur (abonnement, réglage,
   * état) : hors gérant, les types réservés (prix) ne partent pas. Absent
   * (appareil abonné avant) : traité comme non gérant jusqu'à sa mise à jour.
   */
  role?: string;
  creeLe: string;
  majLe: string;
  /** Abonnement disparu (404/410) ou désactivé : plus aucun envoi. */
  expire?: boolean;
}

interface Journal {
  id: typeof ID_JOURNAL;
  envoyees: { cle: string; le: string }[];
}

export async function idAppareil(endpoint: string): Promise<string> {
  return `${PREFIXE_APPAREIL}${(await empreinte(endpoint)).slice(0, 32)}`;
}

/** Appareils abonnés et encore valables. */
export async function lireAppareils(base: BaseNotifications): Promise<Appareil[]> {
  const tous = await base.lire<Appareil>(COLLECTION);
  return tous.filter((a) => typeof a?.id === 'string' && a.id.startsWith(PREFIXE_APPAREIL) && !a.expire && typeof a.endpoint === 'string');
}

/** Un appareil par son adresse d'abonnement (même expiré). */
export async function lireAppareil(base: BaseNotifications, endpoint: string): Promise<Appareil | undefined> {
  const [a] = await base.lire<Appareil>(COLLECTION, [await idAppareil(endpoint)]);
  return a;
}

/** Abonnement envoyé par le navigateur, vérifié (service connu, clés au bon format). */
export function abonnementValide(x: unknown): AbonnementPush | null {
  const a = x as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  const endpoint = typeof a?.endpoint === 'string' ? a.endpoint.trim() : '';
  const p256dh = typeof a?.keys?.p256dh === 'string' ? a.keys.p256dh.trim() : '';
  const auth = typeof a?.keys?.auth === 'string' ? a.keys.auth.trim() : '';
  if (!endpoint || endpoint.length > 1000 || !endpointAccepte(endpoint)) return null;
  if (deB64url(p256dh).length !== 65 || deB64url(auth).length < 16 || auth.length > 64) return null;
  return { endpoint, keys: { p256dh, auth } };
}

/** Enregistre (ou met à jour) l'appareil qui vient d'autoriser les notifications. */
export async function enregistrerAppareil(
  base: BaseNotifications,
  o: { abonnement: AbonnementPush; preferences?: unknown; nom?: string; par?: string; role?: string; maintenant?: Date },
): Promise<Appareil> {
  const le = (o.maintenant ?? new Date()).toISOString();
  const avant = await lireAppareil(base, o.abonnement.endpoint);
  const nom = o.nom ? String(o.nom).slice(0, 40) : avant?.nom;
  const par = o.par ?? avant?.par;
  const role = o.par ? o.role : (o.role ?? avant?.role);
  const appareil: Appareil = {
    id: await idAppareil(o.abonnement.endpoint),
    type: 'notifications-appareil',
    endpoint: o.abonnement.endpoint,
    keys: o.abonnement.keys,
    preferences: o.preferences !== undefined ? nettoyerPreferences(o.preferences) : (avant?.preferences ?? {}),
    ...(nom ? { nom } : {}),
    ...(par ? { par } : {}),
    ...(role ? { role } : {}),
    creeLe: avant?.creeLe ?? le,
    majLe: le,
  };
  await base.ecrire(COLLECTION, [appareil], AUTEUR);
  return appareil;
}

/** Préférences d'un appareil déjà abonné (null : inconnu ou désactivé). */
export async function reglerAppareil(base: BaseNotifications, endpoint: string, preferences: unknown, role?: string): Promise<Appareil | null> {
  const a = await lireAppareil(base, endpoint);
  if (!a || a.expire) return null;
  const suivant: Appareil = { ...a, preferences: nettoyerPreferences(preferences), ...(role ? { role } : {}), majLe: new Date().toISOString() };
  await base.ecrire(COLLECTION, [suivant], AUTEUR);
  return suivant;
}

/**
 * Rôle du compte qui utilise cet appareil, tenu à jour à l'ouverture des
 * réglages (appareil abonné avant que le rôle soit gardé, ou rôle changé).
 * N'écrit que s'il change.
 */
export async function majRoleAppareil(base: BaseNotifications, a: Appareil, role: string | undefined): Promise<void> {
  if (!role || a.expire || a.role === role) return;
  const suivant: Appareil = { ...a, role, majLe: new Date().toISOString() };
  await base.ecrire(COLLECTION, [suivant], AUTEUR);
}

/** Cet appareil ne reçoit plus rien (désactivation, ou abonnement disparu). */
export async function oublierAppareil(base: BaseNotifications, endpoint: string): Promise<void> {
  const a = await lireAppareil(base, endpoint);
  if (a && !a.expire) {
    const suivant: Appareil = { ...a, expire: true, majLe: new Date().toISOString() };
    await base.ecrire(COLLECTION, [suivant], AUTEUR);
  }
}

export interface BilanEnvoi {
  /** Notifications parties (au moins un appareil). */
  envoyees: number;
  /** Déjà parties lors d'un passage précédent. */
  dejaParties: number;
  /** Abonnements disparus, désormais ignorés. */
  expires: number;
}

export type Envoyeur = (a: AbonnementPush, contenu: unknown, cles: ClesVapid, o: { urgente?: boolean }) => Promise<ResultatEnvoi>;

/**
 * Envoie chaque groupe une seule fois (journal), à chaque appareil la
 * variante la plus importante qu'il a activée. Ne lève jamais.
 */
export async function envoyerNotifications(
  base: BaseNotifications,
  groupes: GroupeNotification[],
  o: {
    cles: ClesVapid | null;
    maintenant?: Date;
    envoyer?: Envoyeur;
    /** Notification d'essai : ni journal ni préférences. */
    essai?: boolean;
    /** Un seul appareil (adresse d'abonnement). */
    seulement?: string;
  },
): Promise<BilanEnvoi> {
  const bilan: BilanEnvoi = { envoyees: 0, dejaParties: 0, expires: 0 };
  const cles = o.cles;
  if (!cles || !groupes.length) return bilan;
  try {
    const [appareils, journalLu] = await Promise.all([lireAppareils(base), o.essai ? Promise.resolve([]) : base.lire<Journal>(COLLECTION, [ID_JOURNAL])]);
    const cibles = o.seulement ? appareils.filter((a) => a.endpoint === o.seulement) : appareils;
    if (!cibles.length) return bilan;
    const journal: Journal = Array.isArray(journalLu[0]?.envoyees) ? journalLu[0] : { id: ID_JOURNAL, envoyees: [] };
    const deja = new Set(journal.envoyees.map((e) => e.cle));
    const envoyer: Envoyeur = o.envoyer ?? ((a, c, k, x) => envoyerPush(a, c, k, x));
    const le = (o.maintenant ?? new Date()).toISOString();
    const expires = new Set<string>();
    const parties: string[] = [];
    for (const g of groupes) {
      if (!o.essai && deja.has(g.cle)) {
        bilan.dejaParties++;
        continue;
      }
      let partie = false;
      for (const a of cibles) {
        if (expires.has(a.id)) continue;
        const v = o.essai ? g.variantes[0] : varianteAEnvoyer(g, preferencesPourRole(a.preferences, a.role), a.role);
        if (!v) continue;
        const r = await envoyer({ endpoint: a.endpoint, keys: a.keys }, { titre: v.titre, corps: v.corps, url: v.url, tag: g.cle, type: v.type }, cles, { urgente: g.urgente });
        if (r.ok) partie = true;
        else if (r.expire) expires.add(a.id);
      }
      // Gardée même si aucun appareil ne la voulait : on ne la reproposera pas plus tard.
      parties.push(g.cle);
      if (partie) bilan.envoyees++;
    }
    const ecritures: { id: string }[] = [];
    if (!o.essai && parties.length) {
      const suivant: Journal = { id: ID_JOURNAL, envoyees: [...journal.envoyees, ...parties.map((cle) => ({ cle, le }))].slice(-TAILLE_JOURNAL) };
      ecritures.push(suivant);
    }
    for (const a of cibles) {
      if (!expires.has(a.id)) continue;
      const suivant: Appareil = { ...a, expire: true, majLe: le };
      ecritures.push(suivant);
    }
    bilan.expires = expires.size;
    if (ecritures.length) await base.ecrire(COLLECTION, ecritures, AUTEUR);
  } catch (e) {
    console.warn('[notifications] envoi impossible', e instanceof Error ? e.message : e);
  }
  return bilan;
}

/* ------------------------------------------------ annonces à l'équipe */

/** Réponse de l'action « annoncer » (api/erp-notifications.ts). */
export interface ReponseAnnonce {
  statut: number;
  corps: { ok: boolean; erreur?: string; code?: string; envoyees?: number; dejaPartie?: boolean; appareils?: number };
}

/**
 * « Prévenir aussi par notification » (Annonces à l'équipe) : le gérant de
 * l'espace seulement. L'annonce est RELUE dans la base de l'espace (jamais le
 * texte envoyé par le navigateur) ; une annonce retirée, absente ou abîmée ne
 * part pas ; clé `annonce-<id>` dans le journal : jamais deux fois. Envoyée
 * aux appareils de l'espace qui acceptent le type « annonce ».
 */
export async function annoncerAEquipe(
  base: BaseNotifications,
  o: { role: string | undefined; id: unknown; cles: ClesVapid | null; maintenant?: Date; envoyer?: Envoyeur },
): Promise<ReponseAnnonce> {
  if (!peutAnnoncer(o.role)) return { statut: 403, corps: { ok: false, code: 'gerant', erreur: MESSAGE_ANNONCE_RESERVEE } };
  if (!idAnnonceValide(o.id)) return { statut: 400, corps: { ok: false, code: 'id', erreur: 'Annonce inconnue.' } };
  if (!o.cles) return { statut: 503, corps: { ok: false, code: 'inactif', erreur: 'Notifications pas encore activées sur le serveur.' } };
  const [enregistree] = await base.lire<unknown>(COLLECTION_ANNONCES_EQUIPE, [o.id]);
  const decision = deciderEnvoiAnnonce({ role: o.role, id: o.id, enregistree });
  if (!decision.ok) return { statut: decision.statut, corps: { ok: false, code: decision.code, erreur: decision.erreur } };
  // Comme à l'envoi : préférences de l'appareil selon le rôle de son compte.
  const appareils = (await lireAppareils(base)).filter((a) => estActive(preferencesPourRole(a.preferences, a.role), 'annonce')).length;
  const bilan = await envoyerNotifications(base, [decision.groupe], { cles: o.cles, maintenant: o.maintenant, envoyer: o.envoyer });
  if (bilan.dejaParties) return { statut: 200, corps: { ok: true, dejaPartie: true, envoyees: 0, appareils } };
  if (bilan.envoyees) return { statut: 200, corps: { ok: true, envoyees: bilan.envoyees, appareils } };
  if (!appareils) return { statut: 200, corps: { ok: true, envoyees: 0, appareils: 0 } };
  return { statut: 502, corps: { ok: false, code: 'envoi', erreur: 'Le service de notifications ne l’a pas acceptée.' } };
}

/** Rejette après `ms` (une lecture lente ne doit pas faire dépasser la durée de la fonction). */
function avecDelai<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resoudre, rejeter) => {
    const t = setTimeout(() => rejeter(new Error('délai dépassé')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resoudre(v);
      },
      (e) => {
        clearTimeout(t);
        rejeter(e);
      },
    );
  });
}

/** Ce que les notifications comparent : réservations, conversations, logements. */
export async function photographier(base: BaseNotifications): Promise<Instantane> {
  const [reservations, fils, logements] = await Promise.all([
    base.lire<Reservation>('reservations'),
    base.lire<FilMessages>('filsMessages'),
    base.lire<Logement>('logements'),
  ]);
  return { reservations, fils, logements };
}

/**
 * Lance `travail` et envoie ensuite les notifications de ce qu'il a changé.
 * Sans clés serveur : `travail` seul, aucune lecture de plus. Un échec de
 * lecture ou d'envoi est journalisé et ignoré ; une erreur de `travail` est
 * relancée telle quelle (après la notification `enEchec`, s'il y en a une).
 */
export async function surveiller<T>(
  base: BaseNotifications,
  travail: () => Promise<T>,
  o: {
    cles: ClesVapid | null;
    maintenant?: () => Date;
    /** Notifications en plus, d'après le résultat (synchronisation en échec…). */
    apres?: (resultat: T, instantane: Instantane | null) => GroupeNotification[];
    enEchec?: (erreur: unknown) => GroupeNotification[];
    envoyer?: Envoyeur;
    delaiMs?: number;
    /** Instant (ms) à ne pas dépasser : trop tard après le travail, on n'envoie rien. */
    limite?: number;
  },
): Promise<T> {
  const cles = o.cles;
  if (!cles) return travail();
  const maintenant = o.maintenant ?? (() => new Date());
  const delai = o.delaiMs ?? 4_000;
  const aTemps = () => !o.limite || Date.now() + delai * 2 < o.limite;
  const avant = await avecDelai(photographier(base), delai).catch(() => null);
  let resultat: T;
  try {
    resultat = await travail();
  } catch (e) {
    const groupes = o.enEchec?.(e) ?? [];
    if (groupes.length && aTemps()) await avecDelai(envoyerNotifications(base, groupes, { cles, maintenant: maintenant(), envoyer: o.envoyer }), delai).catch(() => undefined);
    throw e;
  }
  try {
    if (!aTemps()) {
      console.warn('[notifications] plus assez de temps après le passage : notifications de ce passage abandonnées.');
      return resultat;
    }
    const apres = await avecDelai(photographier(base), delai).catch(() => null);
    const groupes = [...(avant && apres ? notificationsEntre(avant, apres, maintenant()) : []), ...(o.apres?.(resultat, apres) ?? [])];
    if (groupes.length) await avecDelai(envoyerNotifications(base, groupes, { cles, maintenant: maintenant(), envoyer: o.envoyer }), delai * 1.5);
  } catch (e) {
    console.warn('[notifications] passage sans notification', e instanceof Error ? e.message : e);
  }
  return resultat;
}
