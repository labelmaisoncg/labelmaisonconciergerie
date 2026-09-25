/**
 * Client de l'API Repull.
 *
 * Repull est la source de vérité pour les annonces, les réservations, les
 * calendriers et les messages voyageurs, sur Airbnb, Booking.com et les autres
 * plateformes. Un seul espace Repull — le nôtre, celui de l'éditeur. Les
 * conciergeries clientes n'ont jamais de compte Repull : elles autorisent leur
 * compte Airbnb ou Booking via Repull Connect, et leurs annonces arrivent dans
 * notre espace.
 *
 * Le cloisonnement entre conciergeries n'existe donc PAS côté Repull : il est
 * dans notre base (`comptes_plateformes`, `logements.repull_listing_id`). Ce
 * client ne reçoit jamais d'identifiant venant du modèle.
 *
 * Référence : https://api.repull.dev (OpenAPI 3.0.3). Clé : `REPULL_API_KEY`,
 * lue dans l'environnement et nulle part ailleurs.
 */

import { compterAppelRepull } from './store.js';

const BASE = 'https://api.repull.dev';
const CLE = () => process.env.REPULL_API_KEY || '';

export type Canal = 'airbnb' | 'booking';

export const NOM_CANAL: Record<Canal, string> = { airbnb: 'Airbnb', booking: 'Booking.com' };

/** Repull écrit « booking » ou « booking.com » selon l'objet : on accepte les deux. */
const estCanal = (valeur: unknown, canal: Canal): boolean =>
  canal === 'airbnb' ? valeur === 'airbnb' : /^booking/i.test(String(valeur ?? ''));

/**
 * Budget mensuel d'appels de l'agent. L'offre gratuite Repull donne 1 000
 * appels par mois, partagés avec la synchronisation de l'ERP (≈ 400) : l'agent
 * en garde 600 par défaut. `REPULL_BUDGET_MENSUEL` le relève (offre payante).
 * Les réponses aux voyageurs passent toujours : seules les lectures sont
 * coupées une fois le budget atteint.
 */
const BUDGET_MENSUEL = () => Number(process.env.REPULL_BUDGET_MENSUEL || 600);

/** Délai maximal d'un appel. Au-delà, on abandonne plutôt que de geler le cron. */
const DELAI_MS = 20_000;
/** Nouveaux essais sur 429 et sur erreur passagère (502/503/504). */
const ESSAIS_MAX = 3;

/**
 * Erreur Repull, avec l'enveloppe standard de l'API : `code` stable,
 * `message`, et `fix` — la marche à suivre, écrite pour être lue telle quelle.
 */
export class ErreurRepull extends Error {
  constructor(
    readonly statut: number,
    readonly code: string,
    message: string,
    readonly correctif: string | null,
  ) {
    super(message);
    this.name = 'ErreurRepull';
  }
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Options = {
  corps?: unknown;
  /** Rend un nouvel essai sans danger : Repull rejoue la réponse stockée. */
  cleIdempotence?: string;
};

async function appel<T = any>(
  methode: 'GET' | 'POST' | 'PUT' | 'PATCH',
  chemin: string,
  options: Options = {},
): Promise<T> {
  // Plateformes jamais modifiées : on lit, on répond aux voyageurs, on ouvre
  // une connexion. Calendriers, prix et annonces restent gérés à la main.
  const chemin0 = chemin.split('?')[0] ?? chemin;
  const permis = methode === 'GET'
    || (methode === 'POST' && (/^\/v1\/conversations\/[^/]+\/messages$/.test(chemin0) || /^\/v1\/connect\/[a-z0-9_-]+$/i.test(chemin0)));
  if (!permis) {
    throw new ErreurRepull(403, 'lecture_seule', `[repull] écriture refusée (${methode} ${chemin0}) : l'agent ne modifie ni calendrier, ni prix, ni annonce.`, null);
  }
  if (!CLE()) {
    throw new ErreurRepull(0, 'cle_absente', '[repull] REPULL_API_KEY absente : aucun appel possible.', null);
  }
  // Une écriture sans clé d'idempotence n'est jamais rejouée : après un délai
  // dépassé, elle a pu partir, et la renvoyer ferait un doublon chez le voyageur.
  const rejouable = methode === 'GET' || Boolean(options.cleIdempotence);

  for (let essai = 1; ; essai++) {
    // Chaque tentative compte dans le quota Repull, nouvel essai compris.
    const utilises = await compterAppelRepull().catch(() => 0);
    if (methode === 'GET' && utilises > BUDGET_MENSUEL()) {
      throw new ErreurRepull(
        0,
        'budget_mensuel',
        `[repull] budget mensuel atteint (${utilises - 1}/${BUDGET_MENSUEL()} appels) : lectures suspendues jusqu'au 1er du mois.`,
        'Passer à une offre Repull payante et relever REPULL_BUDGET_MENSUEL dans Vercel.',
      );
    }
    let reponse: Response;
    try {
      reponse = await fetch(`${BASE}${chemin}`, {
        method: methode,
        headers: {
          Authorization: `Bearer ${CLE()}`,
          Accept: 'application/json',
          ...(options.corps !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(options.cleIdempotence ? { 'Idempotency-Key': options.cleIdempotence } : {}),
        },
        ...(options.corps !== undefined ? { body: JSON.stringify(options.corps) } : {}),
        signal: AbortSignal.timeout(DELAI_MS),
      });
    } catch (err) {
      if (rejouable && essai < ESSAIS_MAX) {
        await attendre(500 * essai);
        continue;
      }
      const cause = err instanceof Error && err.name === 'TimeoutError' ? 'délai dépassé' : String(err);
      throw new ErreurRepull(0, 'reseau', `[repull] ${methode} ${chemin} → ${cause}`, null);
    }

    const texte = await reponse.text();
    let json: any = null;
    try {
      json = texte ? JSON.parse(texte) : {};
    } catch {
      json = null;
    }

    if (reponse.ok) return (json ?? {}) as T;

    const e = json?.error ?? {};
    const passagere = reponse.status === 429 || reponse.status === 502 || reponse.status === 503 || reponse.status === 504;
    // 402 (plafond d'annonces) n'est PAS passager : attendre n'y change rien.
    if (passagere && rejouable && essai < ESSAIS_MAX) {
      const secondes = Number(e.retry_after ?? reponse.headers.get('retry-after') ?? essai);
      // Recommandation Repull : Retry-After, plus un peu d'aléa pour ne pas
      // revenir tous en même temps. Plafonné : une fonction serverless ne peut
      // pas patienter une minute.
      await attendre(Math.min(Number.isFinite(secondes) ? secondes : essai, 10) * 1000 + Math.random() * 250);
      continue;
    }

    const code = String(e.code ?? `http_${reponse.status}`);
    const message = String(e.message ?? texte.slice(0, 300));
    throw new ErreurRepull(
      reponse.status,
      code,
      `[repull] ${methode} ${chemin} → ${reponse.status} ${code} : ${message}` + (e.fix ? ` (correctif : ${e.fix})` : ''),
      e.fix ?? null,
    );
  }
}

/**
 * Parcourt une liste paginée par curseur (`pagination.nextCursor` /
 * `hasMore`), avec un plafond de pages pour borner le coût d'un passage de
 * cron. Accepte aussi les rares routes qui rendent un tableau nu.
 */
async function toutesLesPages<T = any>(
  chemin: string,
  parametres: Record<string, string> = {},
  pagesMax = 10,
): Promise<T[]> {
  const lignes: T[] = [];
  let curseur: string | null = null;
  for (let page = 1; page <= pagesMax; page++) {
    const p = new URLSearchParams(parametres);
    if (curseur) p.set('cursor', curseur);
    const requete = p.toString();
    const r = await appel('GET', requete ? `${chemin}?${requete}` : chemin);
    if (Array.isArray(r)) return r as T[];
    lignes.push(...((r.data ?? []) as T[]));
    curseur = r.pagination?.hasMore ? (r.pagination.nextCursor ?? null) : null;
    if (!curseur) return lignes;
    if (page === pagesMax) {
      console.warn(`[repull] ${chemin} : plus de ${pagesMax} pages, la suite n'est pas lue.`);
    }
  }
  return lignes;
}

// --- Comptes connectés (Repull Connect) ---

export type CompteConnecte = { compteId: string; actif: boolean };

/**
 * Comptes reliés à notre espace : hôtes Airbnb (id d'hôte, celui qu'attend le
 * filtre `account_id` des annonces) ou établissements Booking.com (hotel id).
 * Un espace peut porter plusieurs comptes par plateforme — un par conciergerie
 * au moins.
 */
export async function comptesConnectes(canal: Canal): Promise<CompteConnecte[]> {
  if (canal === 'airbnb') {
    const r = await appel('GET', '/v1/connect/airbnb');
    const comptes: any[] = r.accounts ?? [];
    if (comptes.length) {
      return comptes.map((c) => ({ compteId: String(c.externalAccountId), actif: c.connected === true }));
    }
    return r.connected && r.externalAccountId
      ? [{ compteId: String(r.externalAccountId), actif: r.status === 'active' }]
      : [];
  }
  const etablissements = await toutesLesPages('/v1/channels/booking/properties', {}, 5);
  return etablissements.map((e: any) => ({ compteId: String(e.hotelId), actif: e.active !== false }));
}

/**
 * Lien de connexion hébergé par Repull. La conciergerie y autorise l'accès avec
 * SES identifiants Airbnb, ou désigne Repull comme fournisseur de connectivité
 * dans son extranet Booking — sans jamais créer de compte Repull. Au terme du
 * parcours, Repull la renvoie vers `retour`.
 */
export async function lienConnexion(canal: Canal, retour: string): Promise<string> {
  const r = await appel('POST', `/v1/connect/${canal}`, {
    // Airbnb : messagerie seulement, le calendrier et les prix ne sont pas modifiables.
    corps: { redirectUrl: retour, locale: 'fr', ...(canal === 'airbnb' ? { accessType: 'messaging' } : {}) },
  });
  if (!r.url) throw new ErreurRepull(0, 'lien_absent', `[repull] Repull n'a pas rendu de lien de connexion ${NOM_CANAL[canal]}.`, null);
  return String(r.url);
}

// --- Annonces (listings) ---

export type AnnonceResumee = { id: string; nom: string; ville: string | null };

/** Les annonces qu'un compte connecté a amenées dans notre espace. */
export async function annoncesDuCompte(canal: Canal, compteId: string): Promise<AnnonceResumee[]> {
  if (canal === 'airbnb') {
    const lignes = await toutesLesPages('/v1/channels/airbnb/listings', { account_id: compteId }, 5);
    return lignes.map((a: any) => ({ id: String(a.listingId), nom: a.name ?? 'Annonce Airbnb', ville: a.city ?? null }));
  }
  // Booking : un établissement porte une annonce Repull par chambre, une fois
  // les chambres associées dans le parcours Connect.
  const etablissements = await toutesLesPages('/v1/channels/booking/properties', {}, 5);
  return etablissements
    .filter((e: any) => String(e.hotelId) === compteId)
    .flatMap((e: any) =>
      (e.listings ?? []).map((a: any) => ({
        id: String(a.listingId),
        nom: a.name ?? a.roomName ?? 'Annonce Booking.com',
        ville: a.city ?? null,
      })),
    );
}

/** Canaux actifs d'une annonce. Sert à la santé des connexions. */
export async function canauxDe(annonceId: string): Promise<{ airbnb: boolean; booking: boolean }> {
  const a = await appel('GET', `/v1/listings/${encodeURIComponent(annonceId)}`);
  const canaux: any[] = a.channels ?? [];
  const actif = (canal: Canal) => canaux.some((c) => estCanal(c.platform, canal) && c.active !== false);
  return { airbnb: actif('airbnb'), booking: actif('booking') };
}

// --- Réservations ---

export type Reservation = {
  id: string;
  ref: string;
  canal: string;
  logementId: string;
  arrivee: string;
  depart: string;
  voyageur: string | null;
  personnes: number | null;
  montant: number | null;
  statut: string;
  /** Avance à chaque modification : c'est la « version » de la réservation. */
  majLe: string | null;
  /** Date de réservation sur la plateforme (à défaut, d'arrivée chez Repull). */
  reserveeLe: string | null;
};

export const estAnnulee = (r: Pick<Reservation, 'statut'>): boolean => /cancel/i.test(r.statut);

const versReservation = (b: any): Reservation => {
  const invite = b.primaryGuest ?? {};
  const nom = b.guestName ?? ([invite.firstName, invite.lastName].filter(Boolean).join(' ') || null);
  const occ = b.occupancy ?? {};
  const personnes = occ.total ?? (occ.adults != null ? occ.adults + (occ.children ?? 0) : null);
  const total = b.financials?.totalPrice ?? (b.totalPrice != null ? Number(b.totalPrice) : null);
  return {
    id: String(b.id),
    ref: b.confirmationCode ?? String(b.id),
    canal: b.source ?? b.platform ?? 'inconnu',
    logementId: String(b.listingId),
    arrivee: b.checkIn,
    depart: b.checkOut,
    voyageur: nom,
    personnes: personnes ?? null,
    montant: total != null && Number.isFinite(Number(total)) ? Number(total) : null,
    statut: b.status ?? 'inconnu',
    majLe: b.updatedAt ?? null,
    reserveeLe: b.bookedAt ?? b.createdAt ?? null,
  };
};

const lireReservations = async (filtres: Record<string, string>): Promise<Reservation[]> =>
  (await toutesLesPages('/v1/reservations', { limit: '100', include_total: 'false', ...filtres }, 5)).map(
    versReservation,
  );

/** Réservations d'un logement dont l'ARRIVÉE tombe dans [du, au]. */
export const reservations = (annonceId: string, du: string, au: string): Promise<Reservation[]> =>
  lireReservations({ listingId: annonceId, check_in_after: du, check_in_before: au });

/**
 * Réservations qui OCCUPENT au moins une nuit de la plage [du, au] (bornes
 * incluses, en nuits). Une réservation occupe les nuits arrivée..départ-1 :
 * elle chevauche la plage si arrivée <= au ET départ > du.
 *
 * À la différence de `reservations()`, qui ne filtre que sur la date
 * d'arrivée, celle-ci voit aussi un séjour commencé AVANT la plage — c'est
 * indispensable avant de rouvrir des dates à la vente. Les annulations sont
 * écartées : elles ne bloquent plus rien.
 */
export async function reservationsChevauchant(annonceId: string, du: string, au: string): Promise<Reservation[]> {
  const lendemain = new Date(`${du}T12:00:00Z`);
  lendemain.setUTCDate(lendemain.getUTCDate() + 1);
  const resas = await lireReservations({
    listingId: annonceId,
    check_in_before: au,
    check_out_after: lendemain.toISOString().slice(0, 10),
  });
  return resas
    // Filet de sécurité si l'API ignorait un des filtres de date.
    .filter((b) => b.arrivee <= au && b.depart > du)
    .filter((b) => !estAnnulee(b));
}

/** Une réservation par son identifiant Repull. null si introuvable. */
export async function reservationParId(id: string): Promise<Reservation | null> {
  try {
    return versReservation(await appel('GET', `/v1/reservations/${encodeURIComponent(id)}`));
  } catch (err) {
    console.error(`[repull] réservation ${id} illisible :`, err);
    return null;
  }
}

/** Départs d'une date donnée : un départ = un ménage. Les annulations n'en sont pas. */
export async function departsDu(annonceId: string, date: string): Promise<Reservation[]> {
  const resas = await lireReservations({ listingId: annonceId, check_out_after: date, check_out_before: date });
  return resas.filter((r) => r.depart === date && !estAnnulee(r));
}

/**
 * Toutes les réservations créées, modifiées ou annulées depuis un instant,
 * tous logements confondus : le filet de rattrapage du webhook. Borne
 * inclusive, livraison « au moins une fois » — le dédoublonnage est à la charge
 * de l'appelant.
 */
export const modifieesDepuis = (instant: Date): Promise<Reservation[]> =>
  lireReservations({ updated_since: instant.toISOString() });

// --- Calendriers : disponibilités et prix ---

/** Repull refuse plus de 731 dates par écriture — la limite d'Airbnb. */
const DATES_MAX = 731;

const joursDe = (du: string, au: string): string[] => {
  const jours: string[] = [];
  for (let d = new Date(`${du}T12:00:00Z`); d.toISOString().slice(0, 10) <= au; d.setUTCDate(d.getUTCDate() + 1)) {
    jours.push(d.toISOString().slice(0, 10));
  }
  return jours;
};

type Reglages = { available?: boolean; price?: number; minNights?: number };

/**
 * Une écriture = un jeu de réglages sur une liste de dates, poussé par Repull
 * vers TOUTES les plateformes connectées dans la foulée. Un refus d'une
 * plateforme n'est pas avalé : il remonte en avertissement.
 */
async function ecrireCalendrier(annonceId: string, dates: string[], reglages: Reglages): Promise<string | null> {
  const avertissements: string[] = [];
  for (let i = 0; i < dates.length; i += DATES_MAX) {
    const r = await appel('PUT', `/v1/availability/${encodeURIComponent(annonceId)}`, {
      corps: { dates: dates.slice(i, i + DATES_MAX), ...reglages },
    });
    if (r.synced?.authErrors) avertissements.push('une plateforme doit être reconnectée');
    if (r.warning) avertissements.push(String(r.warning));
    else if (r.synced?.failed) avertissements.push(`${r.synced.failed} plateforme(s) ont refusé la mise à jour`);
  }
  return avertissements.length ? avertissements.join(' ; ') : null;
}

export type PlageDisponibilite = { annonceId: string; du: string; au: string; disponible: boolean };

/**
 * Disponibilités. Les plages de même logement et de même sens sont regroupées
 * en une seule écriture : un appel par logement, pas un par plage. Rend
 * l'avertissement éventuel des plateformes, null si tout est passé.
 */
export async function definirDisponibilites(plages: PlageDisponibilite[]): Promise<string | null> {
  const groupes = new Map<string, { annonceId: string; disponible: boolean; dates: string[] }>();
  for (const p of plages) {
    const cle = `${p.annonceId}|${p.disponible}`;
    const g = groupes.get(cle) ?? { annonceId: p.annonceId, disponible: p.disponible, dates: [] };
    g.dates.push(...joursDe(p.du, p.au));
    groupes.set(cle, g);
  }
  const avertissements: string[] = [];
  for (const g of groupes.values()) {
    const a = await ecrireCalendrier(g.annonceId, [...new Set(g.dates)], { available: g.disponible });
    if (a) avertissements.push(a);
  }
  return avertissements.length ? avertissements.join(' ; ') : null;
}

export type PlageTarif = {
  annonceId: string;
  du: string;
  au: string;
  prixParNuit?: number;
  sejourMinimum?: number;
  /** true = fermé à la vente. La réouverture passe par `definirDisponibilites`. */
  venteArretee?: boolean;
};

/**
 * Prix, séjour minimum et fermeture à la vente. Repull n'accepte qu'un jeu de
 * réglages par écriture : les plages aux réglages identiques sont regroupées,
 * les autres partent chacune dans leur appel.
 *
 * Les interdictions d'arrivée ou de départ n'existent pas dans le calendrier
 * unifié de Repull (seulement sur les routes propres à Booking.com) : elles ne
 * sont pas proposées.
 */
export async function definirTarifs(plages: PlageTarif[]): Promise<string | null> {
  const groupes = new Map<string, { annonceId: string; reglages: Reglages; dates: string[] }>();
  for (const p of plages) {
    const reglages: Reglages = {
      ...(p.prixParNuit != null ? { price: p.prixParNuit } : {}),
      ...(p.sejourMinimum != null ? { minNights: p.sejourMinimum } : {}),
      ...(p.venteArretee === true ? { available: false } : {}),
    };
    if (Object.keys(reglages).length === 0) continue;
    const cle = `${p.annonceId}|${JSON.stringify(reglages)}`;
    const g = groupes.get(cle) ?? { annonceId: p.annonceId, reglages, dates: [] };
    g.dates.push(...joursDe(p.du, p.au));
    groupes.set(cle, g);
  }
  const avertissements: string[] = [];
  for (const g of groupes.values()) {
    const a = await ecrireCalendrier(g.annonceId, [...new Set(g.dates)], g.reglages);
    if (a) avertissements.push(a);
  }
  return avertissements.length ? avertissements.join(' ; ') : null;
}

// --- Messagerie voyageurs ---

export type FilMessages = {
  id: string;
  logementId: string | null;
  canal: string;
  reservationRef: string | null;
  ferme: boolean;
  dernierMessageLe: string | null;
};

export type MessageVoyageur = {
  id: string;
  auteur: 'voyageur' | 'hote';
  texte: string;
  envoyeLe: string;
};

const versFil = (t: any): FilMessages => ({
  id: String(t.id),
  logementId: t.listingId != null ? String(t.listingId) : null,
  canal: t.platform ?? 'inconnu',
  reservationRef: t.reservationId != null ? String(t.reservationId) : null,
  ferme: t.status === 'archived',
  dernierMessageLe: t.lastMessageAt ?? null,
});

/**
 * Tous les fils de messages de l'espace, sur plusieurs pages. L'API ne filtre
 * pas par logement : on filtre ici quand on en demande un.
 */
const FILS_PAR_PAGE = '100';
const PAGES_MAX = 5;

export async function filsDeMessages(annonceId?: string): Promise<FilMessages[]> {
  const fils = (await toutesLesPages('/v1/conversations', { limit: FILS_PAR_PAGE }, PAGES_MAX)).map(versFil);
  return annonceId ? fils.filter((f) => f.logementId === annonceId) : fils;
}

/** Un fil par son identifiant Repull. null si introuvable. */
export async function filParId(id: string): Promise<FilMessages | null> {
  try {
    return versFil(await appel('GET', `/v1/conversations/${encodeURIComponent(id)}`));
  } catch (err) {
    console.error(`[repull] fil ${id} illisible :`, err);
    return null;
  }
}

/**
 * Messages d'un fil, TOUJOURS rendus du plus ancien au plus récent.
 *
 * Repull rend par défaut les plus récents d'abord (`order=desc`). On garde cet
 * ordre pour ne lire que les derniers, puis on remet dans l'ordre chronologique
 * — le tri final sert de filet si l'API ignorait le paramètre d'ordre.
 */
const MESSAGES_PAR_FIL = 30;

export async function messagesDuFil(filId: string): Promise<MessageVoyageur[]> {
  const p = new URLSearchParams({ order: 'desc', limit: String(MESSAGES_PAR_FIL) });
  const r = await appel('GET', `/v1/conversations/${encodeURIComponent(filId)}/messages?${p}`);
  const messages: MessageVoyageur[] = (r.data ?? []).map((m: any) => ({
    id: String(m.id),
    // Repull normalise `direction` : `inbound` vient du voyageur. Un message
    // système de la plateforme (`senderType` system, airbnb…) n'est pas une
    // question à laquelle répondre.
    auteur:
      m.direction === 'inbound' && !/^(system|airbnb|booking|vrbo)/i.test(String(m.senderType ?? ''))
        ? 'voyageur'
        : 'hote',
    texte: m.body ?? '',
    envoyeLe: m.sentAt ?? '',
  }));
  // reverse() d'abord : l'API rend du plus récent au plus ancien, et le tri
  // (stable) conserve cet ordre inversé pour deux messages de même horodatage.
  const instant = (m: MessageVoyageur) => Date.parse(m.envoyeLe) || 0;
  return messages.reverse().sort((x, y) => instant(x) - instant(y));
}

/**
 * Répond dans le fil, sur la plateforme d'origine. La clé d'idempotence rend un
 * nouvel essai sans danger : le voyageur ne reçoit jamais deux fois le même
 * message. Rend le texte réellement livré quand la plateforme l'a réécrit
 * (Airbnb retire liens, e-mails et numéros de téléphone), null sinon.
 */
export async function repondreAuFil(filId: string, texte: string, cleIdempotence: string): Promise<string | null> {
  const r = await appel('POST', `/v1/conversations/${encodeURIComponent(filId)}/messages`, {
    corps: { message: texte },
    cleIdempotence,
  });
  return r.contentRewritten ? String(r.deliveredContent ?? '') : null;
}
