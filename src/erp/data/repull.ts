/**
 * Repull → ERP : conversion des données Repull (API unifiée Airbnb,
 * Booking.com, Vrbo...) en éléments de l'ERP, et fusion avec ce que l'équipe
 * a déjà saisi. Fonctions pures, sans réseau : utilisées par la
 * synchronisation serveur (repull-synchro.ts, api/erp-repull-*.ts) et par
 * l'auto-contrôle (verifier-repull.ts).
 *
 * Règle de fusion (« fusionner sans écraser ») :
 * - les champs dont Repull est la source (dates, statut, montants, voyageur,
 *   messages, notes d'avis...) sont remplacés à chaque passage ;
 * - les champs propres à l'ERP (propriétaire, mandat, checklist, serrure,
 *   dotation de linge, numéro d'enregistrement, statut du fil...) ne sont
 *   jamais touchés une fois l'élément créé ;
 * - une valeur absente chez Repull ne vide jamais une valeur de l'ERP ;
 * - rien n'est supprimé : une réservation annulée passe « annulee », une
 *   annonce archivée passe le logement « sorti ».
 *
 * Identifiants déterministes : `repull-<id Repull>`. Un logement créé à la
 * main peut être relié à son annonce en renseignant `repull.id` : il est alors
 * mis à jour au lieu d'être dupliqué.
 *
 * Ce module ne doit importer que des types et des constantes (il tourne aussi
 * côté serveur, hors de Vite).
 */
import { CHECKLIST_LANCEMENT } from './constantes.js';
import type {
  Annonce,
  Canal,
  CanalReservation,
  Centimes,
  DateISO,
  DescriptifLogement,
  FicheLogement,
  FilMessages,
  Horodatage,
  Id,
  Logement,
  Message,
  OrigineRepull,
  Proprietaire,
  Reservation,
  StatutLogement,
  StatutReservation,
  TarifsLogement,
  TypeLogement,
} from './types';

/* --------------------------------------------------- charges utiles Repull */
// Sous-ensemble des schémas de l'OpenAPI Repull (1.0.0) réellement lus ici.

export interface RepullPagination {
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

export interface RepullPage<T> {
  data: T[];
  pagination?: RepullPagination;
}

export interface RepullCanalAnnonce {
  platform?: string;
  externalId?: string;
  active?: boolean;
  syncEnabled?: boolean;
}

export interface RepullAmenity {
  amenityKey: string;
  category?: string | null;
  isPresent: boolean;
  instruction?: string | null;
}

export interface RepullListingDetails {
  propertyType?: string | null;
  propertyTypeCategory?: string | null;
  roomTypeCategory?: string | null;
  bedrooms?: number | null;
  bathrooms?: string | null;
  beds?: number | null;
  personCapacity?: number | null;
  checkInTimeStart?: string | null;
  checkInTimeEnd?: string | null;
  checkOutTime?: string | null;
  wifiNetwork?: string | null;
  wifiPassword?: string | null;
  houseManual?: string | null;
  directions?: string | null;
  propertySize?: unknown;
}

export interface RepullListingContent {
  name?: string | null;
  summary?: string | null;
  description?: string | null;
  space?: string | null;
  guestAccess?: string | null;
  neighborhoodOverview?: string | null;
  transit?: string | null;
  gettingAround?: string | null;
  houseRules?: string | null;
}

/** ListingContentPhoto (?include=photos), dans l'ordre d'affichage. */
export interface RepullListingPhoto {
  url?: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  sortOrder?: number;
}

/** ListingRoom (?include=rooms). */
export interface RepullListingRoom {
  type?: string;
  name?: string | null;
  number?: number | null;
  beds?: { type?: string; quantity?: number }[];
}

/** ListingPolicies (?include=policies). */
export interface RepullListingPolicies {
  cancellationPolicy?: string | null;
  houseRules?: string | null;
  checkIn?: { method?: string | null; instructions?: string | null; from?: string | null; until?: string | null };
  checkOut?: { until?: string | null };
  allowsPets?: boolean | null;
  allowsSmoking?: boolean | null;
  allowsEvents?: boolean | null;
  allowsChildren?: boolean | null;
  allowsInfants?: boolean | null;
  childrenMinAge?: number | null;
  quietHours?: { start?: string; end?: string } | null;
  securityDeposit?: number | null;
}

/** ListingRules (?include=rules). */
export interface RepullListingRules {
  minNights?: number | null;
  maxNights?: number | null;
  advanceNoticeHours?: number | null;
  instantBook?: string | null;
}

/** ListingPricingSettings (?include=pricing) : prix de base, en unités de la devise. */
export interface RepullListingPricing {
  currency?: string | null;
  basePrice?: number | null;
  weekendPrice?: number | null;
  cleaningFee?: number | null;
  extraGuestFee?: number | null;
  guestsIncluded?: number | null;
  securityDeposit?: number | null;
  weeklyDiscountPercent?: number | null;
  monthlyDiscountPercent?: number | null;
}

/** ListingFee (?include=fees). */
export interface RepullListingFee {
  type?: string;
  name?: string | null;
  amount?: number;
  amountType?: 'flat' | 'percent' | string;
  chargedPer?: 'stay' | 'night' | 'guest' | 'guest_night' | string;
  optional?: boolean;
}

/** GET /v1/listings/{id}/photos. */
export interface RepullPhotos {
  listingId?: string;
  photos?: { url?: string; path?: string; size?: number; createdAt?: string }[];
}

/** GET /v1/availability/{propertyId}?from&to : prix et disponibilité par jour (lecture seule). */
export interface RepullDisponibilite {
  propertyId?: string;
  currency?: string;
  days?: { date?: string; available?: boolean; price?: number; minNights?: number; availableUnits?: number }[];
}

/** GET /v1/listings, GET /v1/listings/{id}. */
export interface RepullListing {
  id: string;
  name?: string;
  /** Titre vu par les voyageurs (name est le surnom interne de l'hôte). */
  publicName?: string | null;
  address?: { street?: string | null; city?: string | null };
  thumbnailUrl?: string | null;
  status?: 'active' | 'inactive' | 'archived' | string;
  channels?: RepullCanalAnnonce[];
  amenities?: RepullAmenity[];
  content?: RepullListingContent | null;
  details?: RepullListingDetails | null;
  photos?: RepullListingPhoto[];
  rooms?: RepullListingRoom[];
  policies?: RepullListingPolicies | null;
  rules?: RepullListingRules | null;
  pricing?: RepullListingPricing | null;
  fees?: RepullListingFee[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RepullLigneMontant {
  name?: string;
  type?: string;
  amount?: number;
  vat?: number;
  quantity?: number;
}

export interface RepullFinancials {
  totalPrice?: number;
  currency?: string;
  paymentStatus?: string;
  cancellationPolicy?: string;
  host?: {
    accommodation?: number;
    discounts?: RepullLigneMontant[];
    guestFees?: RepullLigneMontant[];
    hostFees?: RepullLigneMontant[];
    taxes?: RepullLigneMontant[];
    revenue?: number;
  };
  guest?: {
    totalPrice?: number;
    fees?: RepullLigneMontant[];
    taxes?: RepullLigneMontant[];
  };
}

/** GET /v1/reservations, GET /v1/reservations/{id}. */
export interface RepullReservation {
  id: string;
  listingId?: string;
  guestId?: string;
  checkIn: string;
  checkOut: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  status?: 'confirmed' | 'pending' | 'cancelled' | 'completed' | string;
  statusDetail?: string;
  pendingReason?: string;
  source?: string | null;
  platform?: string | null;
  confirmationCode?: string;
  primaryGuest?: { id?: string; firstName?: string; lastName?: string; email?: string; phone?: string; language?: string };
  occupancy?: { adults?: number; children?: number; infants?: number; pets?: number; total?: number };
  financials?: RepullFinancials;
  /** Obsolète chez Repull (chaîne décimale) : repli seulement. */
  totalPrice?: string;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
  bookedAt?: string;
  guestName?: string;
}

/** GET /v1/guests. */
export interface RepullGuest {
  id: string;
  displayName?: string;
  displayNameLong?: string;
  country?: string;
  language?: string;
}

/** GET /v1/conversations. */
export interface RepullConversation {
  id: string;
  platform?: string;
  externalThreadId?: string;
  guestId?: string;
  listingId?: string;
  reservationId?: string;
  subject?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** GET /v1/conversations/{id}/messages. */
export interface RepullMessage {
  id: string;
  externalMessageId?: string;
  direction?: 'inbound' | 'outbound' | string;
  senderType?: string;
  senderName?: string;
  channel?: string;
  body?: string;
  attachments?: { id?: string; url?: string; type?: string; contentType?: string }[];
  isAutomated?: boolean;
  aiGenerated?: boolean;
  sentAt?: string;
}

/** GET /v1/reviews. */
export interface RepullReview {
  id: string;
  platform?: string;
  listingId?: string;
  reservationId?: string;
  reservationConfirmationCode?: string;
  guestName?: string;
  reviewerRole?: 'guest' | 'host' | string;
  rating?: number | null;
  publicReview?: string;
  privateFeedback?: string;
  submittedAt?: string;
  updatedAt?: string;
}

/* ------------------------------------------------------------------ outils */

export const PREFIXE_REPULL = 'repull-';
/** Propriétaire d'attente des logements importés (à rattacher par l'équipe). */
export const ID_PROPRIETAIRE_A_RENSEIGNER = 'repull-proprietaire-a-renseigner';
/** Auteur des écritures et du journal. */
export const AUTEUR_REPULL = 'Synchronisation Repull';
/** Action du journal qui résume chaque synchronisation (lue par l'écran Paramètres). */
export const ACTION_JOURNAL_REPULL = 'Synchronisation Repull';

export const idRepull = (id: string | number): Id => `${PREFIXE_REPULL}${id}`;

/** Date du jour à Paris, 'YYYY-MM-DD'. */
export function dateParis(maintenant: Date = new Date()): DateISO {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(maintenant);
}

/** Horodatage ISO à l'heure de Paris, au format de l'ERP (« 2026-09-25T14:03:00+02:00 »). */
export function horodatageParis(d: Date = new Date()): Horodatage {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const deux = (n: number) => String(n).padStart(2, '0');
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const ecart = Math.round((local - Math.floor(d.getTime() / 1000) * 1000) / 60000);
  const abs = Math.abs(ecart);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${ecart < 0 ? '-' : '+'}${deux(Math.floor(abs / 60))}:${deux(abs % 60)}`;
}

/** Horodatage Repull (UTC) → horodatage de l'ERP ; '' si illisible. */
export function versHorodatageErp(v: unknown): Horodatage {
  const t = Date.parse(texte(v));
  return Number.isFinite(t) ? horodatageParis(new Date(t)) : '';
}

/** Instant (ms) d'un horodatage, 0 si illisible : les formats UTC et Paris se comparent ainsi. */
export const instant = (v: unknown): number => {
  const t = Date.parse(typeof v === 'string' ? v : '');
  return Number.isFinite(t) ? t : 0;
};

/** Nuits entre deux dates 'YYYY-MM-DD' (0 si illisible). */
export function nuitsEntre(arrivee: DateISO, depart: DateISO): number {
  const a = Date.parse(`${arrivee}T00:00:00Z`);
  const b = Date.parse(`${depart}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.round((b - a) / 86_400_000)) : 0;
}

const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const nombre = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const centimes = (euros: number): Centimes => Math.round(euros * 100);
const date10 = (v: unknown): DateISO => texte(v).slice(0, 10);

/**
 * Sérialisation stable (clés triées, `undefined` retirés) : Postgres (jsonb)
 * ne garde pas l'ordre des clés, une comparaison JSON naïve verrait des
 * changements partout.
 */
export function canonique(v: unknown): string {
  const trier = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(trier);
    if (x && typeof x === 'object') {
      return Object.fromEntries(
        Object.keys(x as Record<string, unknown>)
          .sort()
          .filter((k) => (x as Record<string, unknown>)[k] !== undefined)
          .map((k) => [k, trier((x as Record<string, unknown>)[k])]),
      );
    }
    return x;
  };
  return JSON.stringify(trier(v === undefined ? null : JSON.parse(JSON.stringify(v))));
}

export const identiques = (a: unknown, b: unknown): boolean => canonique(a) === canonique(b);

/** « 15:00 », « 3 PM », « 15h30 » → « HH:MM » ; undefined si illisible (« flexible »). */
export function heure(v: unknown): string | undefined {
  const s = texte(v).toLowerCase();
  const m = /^(\d{1,2})(?:[:h.](\d{2}))?\s*(am|pm)?$/.exec(s.replace(/\s+/g, ' '));
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return undefined;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Plateforme Repull → canal d'annonce de l'ERP (null : plateforme non suivie). */
export function canalAnnonce(plateforme: unknown): Canal | null {
  const p = texte(plateforme).toLowerCase();
  if (p === 'airbnb') return 'airbnb';
  if (p === 'booking' || p === 'booking.com') return 'booking';
  return null;
}

/** Source Repull d'une réservation ou d'une conversation → canal de l'ERP. */
export function canalReservation(source: unknown): CanalReservation {
  const s = texte(source).toLowerCase();
  if (s === 'airbnb') return 'airbnb';
  if (s === 'booking' || s === 'booking.com') return 'booking';
  if (s === 'direct' || s === 'website' || s === 'email') return 'direct';
  return 'autre';
}

/* ---------------------------------------------------------- propriétaire */

/**
 * Le type Logement exige un propriétaire : les annonces importées sont
 * rattachées à une fiche d'attente, sans aucune donnée personnelle inventée.
 */
export function proprietaireARenseigner(aujourdhui: DateISO): Proprietaire {
  return {
    id: ID_PROPRIETAIRE_A_RENSEIGNER,
    type: 'particulier',
    nom: 'Propriétaire à renseigner',
    contact: { email: '', telephone: '' },
    adresse: '',
    notes:
      'Fiche créée par la synchronisation Repull : les logements importés y sont rattachés en attendant. ' +
      'Rattachez chaque logement à son vrai propriétaire (fiche du logement, onglet Vue d’ensemble).',
    creeLe: aujourdhui,
  };
}

/* --------------------------------------------------------------- logements */

/** Type de logement déduit de la fiche Repull (création seulement ; l'équipe corrige). */
export function typeLogement(d: RepullListingDetails | null | undefined): TypeLogement {
  const cat = `${texte(d?.propertyTypeCategory)} ${texte(d?.propertyType)}`.toLowerCase();
  if (/house|villa|cabin|cottage|townhouse|chalet|maison|bungalow|farm/.test(cat)) return 'maison';
  const ch = nombre(d?.bedrooms);
  if (ch === undefined) return 'autre';
  if (ch <= 0) return 'studio';
  if (ch === 1) return 'T2';
  if (ch === 2) return 'T3';
  return 'T4';
}

/** Surface en m² si Repull la donne ({ value, unit }). */
export function surfaceM2(taille: unknown): number | undefined {
  if (!taille || typeof taille !== 'object') return undefined;
  const t = taille as { value?: unknown; unit?: unknown };
  const v = typeof t.value === 'string' ? Number(t.value) : nombre(t.value);
  if (v === undefined || !Number.isFinite(v) || v <= 0) return undefined;
  const u = texte(t.unit).toLowerCase();
  if (/sq\s*ft|square\s*f|ft/.test(u)) return Math.round(v * 0.092903);
  return Math.round(v);
}

/** Statut Repull d'une annonce → statut du logement. */
export function statutLogement(statut: unknown): StatutLogement {
  if (statut === 'archived') return 'sorti';
  if (statut === 'inactive') return 'pause';
  return 'actif';
}

/** Libellé lisible d'un équipement Repull (« air_conditioning » → « Air conditioning »). */
const libelleEquipement = (cle: string): string => {
  const s = cle.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export interface ContexteLogement {
  /** Identifiant à utiliser pour un nouveau logement. */
  id: Id;
  aujourdhui: DateISO;
  /** Propriétaire d'un nouveau logement (fiche d'attente). */
  proprietaireId: Id;
}

/** Nouvel élément vierge, aux valeurs par défaut de la création manuelle (EditionLogement). */
function logementVierge(l: RepullListing, ctx: ContexteLogement): Logement {
  return {
    id: ctx.id,
    nom: texte(l.name) || `Annonce Repull ${l.id}`,
    adresse: '',
    ville: '',
    codePostal: '',
    type: typeLogement(l.details),
    surfaceM2: 0,
    capacite: 0,
    chambres: 0,
    lits: [],
    statut: statutLogement(l.status),
    proprietaireId: ctx.proprietaireId,
    residencePrincipale: false,
    serrure: 'boite_a_cles',
    fiche: { wifiNom: '', wifiCode: '', heureArrivee: '16:00', heureDepart: '11:00', acces: '', parking: '', regles: '', equipements: [] },
    dotationLinge: [],
    annonces: [],
    checklistLancement: CHECKLIST_LANCEMENT.map((c) => ({ ...c, fait: false })),
  };
}

/**
 * Annonce Repull → logement de l'ERP, fusionné avec l'existant.
 *
 * Repull fait foi pour : nom, adresse, ville, capacité, chambres, surface,
 * wifi, horaires d'arrivée / départ, annonces Airbnb et Booking.com (état de
 * connexion), photo (sauf photo déposée par l'équipe), et le statut quand
 * l'annonce change d'état chez Repull (archivée → sorti, désactivée → pause,
 * réactivée → actif). Règles de la maison, accès et équipements ne sont
 * remplis que s'ils sont vides. Tout le reste appartient à l'ERP.
 */
export function versLogement(l: RepullListing, existant: Logement | undefined, ctx: ContexteLogement): Logement {
  const base = existant ?? logementVierge(l, ctx);
  const d = l.details ?? undefined;
  const c = l.content ?? undefined;
  const suivant: Logement = { ...base };

  const nom = texte(l.name) || texte(c?.name);
  if (nom) suivant.nom = nom;
  if (texte(l.address?.street)) suivant.adresse = texte(l.address?.street);
  if (texte(l.address?.city)) suivant.ville = texte(l.address?.city);
  const capacite = nombre(d?.personCapacity);
  if (capacite !== undefined && capacite > 0) suivant.capacite = capacite;
  const chambres = nombre(d?.bedrooms);
  if (chambres !== undefined && chambres >= 0) suivant.chambres = chambres;
  const surface = surfaceM2(d?.propertySize);
  if (surface !== undefined) suivant.surfaceM2 = surface;

  const fiche: FicheLogement = { ...base.fiche, equipements: [...(base.fiche?.equipements ?? [])] };
  if (texte(d?.wifiNetwork)) fiche.wifiNom = texte(d?.wifiNetwork);
  if (texte(d?.wifiPassword)) fiche.wifiCode = texte(d?.wifiPassword);
  const pol = l.policies ?? undefined;
  const arrivee = heure(d?.checkInTimeStart) ?? heure(pol?.checkIn?.from);
  if (arrivee) fiche.heureArrivee = arrivee;
  const depart = heure(d?.checkOutTime) ?? heure(pol?.checkOut?.until);
  if (depart) fiche.heureDepart = depart;
  const regles = texte(c?.houseRules) || texte(pol?.houseRules);
  if (!texte(fiche.regles) && regles) fiche.regles = regles;
  const acces = texte(d?.directions) || texte(pol?.checkIn?.instructions);
  if (!texte(fiche.acces) && acces) fiche.acces = acces;
  // Livret d'accueil de l'annonce : « À savoir » seulement s'il est vide (l'équipe garde la main).
  if (!texte(fiche.aSavoir) && texte(d?.houseManual)) fiche.aSavoir = borne(d?.houseManual, 2000);
  if (!fiche.equipements.length && l.amenities?.length) {
    fiche.equipements = l.amenities.filter((a) => a.isPresent && texte(a.amenityKey)).map((a) => libelleEquipement(a.amenityKey));
  }
  suivant.fiche = fiche;

  // Annonces : Airbnb et Booking.com viennent de Repull, les autres (direct) restent.
  if (Array.isArray(l.channels)) {
    const parCanal = new Map<Canal, Annonce>();
    for (const ch of l.channels) {
      const canal = canalAnnonce(ch.platform);
      if (!canal) continue;
      const avant = parCanal.get(canal) ?? base.annonces.find((a) => a.canal === canal);
      const url =
        avant?.url || (canal === 'airbnb' && texte(ch.externalId) ? `https://www.airbnb.fr/rooms/${texte(ch.externalId)}` : undefined);
      const connecte = !!ch.active || !!parCanal.get(canal)?.connecte;
      parCanal.set(canal, { canal, ...(url ? { url } : {}), connecte });
    }
    const annonces = base.annonces.filter((a) => !parCanal.has(a.canal));
    for (const a of parCanal.values()) annonces.push(a);
    annonces.sort((a, b) => ordreCanal(a.canal) - ordreCanal(b.canal));
    suivant.annonces = annonces;
  }

  // Photo : celle de l'annonce, sauf si l'équipe a déposé la sienne.
  if (texte(l.thumbnailUrl) && !(base.photoUrl ?? '').startsWith('stockage://')) suivant.photoUrl = texte(l.thumbnailUrl);
  // Galerie : les photos de l'annonce quand la plateforme les renvoie (sinon celles déjà lues).
  const photos = photosAnnonce(l.photos);
  if (photos.length) suivant.photos = photos;
  const descriptif = versDescriptif(l, base.descriptif);
  if (descriptif) suivant.descriptif = descriptif;
  else delete suivant.descriptif;

  // Statut : seulement quand l'annonce change d'état chez Repull (un logement
  // relié à la main garde le sien au premier passage).
  if (existant?.repull?.statut && l.status && l.status !== existant.repull.statut) suivant.statut = statutLogement(l.status);

  const canaux = Array.isArray(l.channels)
    ? l.channels
        .filter((ch) => texte(ch.platform) && texte(ch.externalId))
        .map((ch) => ({ plateforme: texte(ch.platform), idExterne: texte(ch.externalId), actif: !!ch.active }))
    : base.repull?.canaux;
  const origine: OrigineRepull = {
    id: String(l.id),
    majLe: l.updatedAt ?? base.repull?.majLe,
    statut: l.status ?? base.repull?.statut,
    canaux,
    // Relevé des photos et note de lecture (repull-synchro) : ils survivent au passage des annonces.
    ...(base.repull?.photosLuesLe ? { photosLuesLe: base.repull.photosLuesLe } : {}),
    ...(base.repull?.lecture ? { lecture: base.repull.lecture } : {}),
  };
  suivant.repull = origine;
  return suivant;
}

const ordreCanal = (c: Canal) => ['airbnb', 'booking', 'direct'].indexOf(c);

/* ------------------------------------------------------------ réservations */

/** Statut Repull → statut de l'ERP (confirmée / en cours / terminée selon les dates). */
export function statutReservation(r: Pick<RepullReservation, 'status' | 'checkIn' | 'checkOut'>, aujourdhui: DateISO): StatutReservation | null {
  if (r.status === 'cancelled') return 'annulee';
  if (r.status === 'completed') return 'terminee';
  if (r.status === 'confirmed') {
    const arrivee = date10(r.checkIn);
    const depart = date10(r.checkOut);
    if (depart && depart <= aujourdhui) return 'terminee';
    if (arrivee && arrivee <= aujourdhui) return 'en_cours';
    return 'confirmee';
  }
  // pending (demande à accepter, paiement ou vérification en attente) : pas
  // d'équivalent dans l'ERP ; la réservation entre quand elle est confirmée.
  return null;
}

export interface Montants {
  brut: Centimes;
  commissionPlateforme: Centimes;
  menage: Centimes;
}

const somme = (lignes: RepullLigneMontant[] | undefined, avecTva = false): number =>
  (lignes ?? []).reduce((s, x) => s + (nombre(x.amount) ?? 0) + (avecTva ? nombre(x.vat) ?? 0 : 0), 0);

/**
 * Montants de l'ERP (centimes) à partir du bloc financier Repull :
 * - brut = versement hôte + commission plateforme (côté hôte : hébergement
 *   + ménage − remises), à défaut hébergement − remises + ménage, à défaut
 *   le total payé par le voyageur ;
 * - commission plateforme = frais facturés à l'hôte (TVA comprise) ;
 * - ménage = lignes « cleaning » facturées au voyageur.
 * null quand Repull ne donne aucun montant (l'existant est alors conservé).
 */
export function montantsReservation(r: Pick<RepullReservation, 'financials' | 'totalPrice'>): Montants | null {
  const f = r.financials;
  const h = f?.host;
  const menage = (f?.guest?.fees ?? []).filter((x) => texte(x.type).toLowerCase() === 'cleaning').reduce((s, x) => s + (nombre(x.amount) ?? 0), 0);
  const commission = somme(h?.hostFees, true);
  const revenu = nombre(h?.revenue);
  const hebergement = nombre(h?.accommodation);
  const total = nombre(f?.totalPrice) ?? nombre(f?.guest?.totalPrice) ?? (r.totalPrice ? Number(r.totalPrice) : undefined);
  let brut: number;
  let com = commission;
  if (revenu !== undefined) brut = revenu + commission;
  else if (hebergement !== undefined) brut = hebergement - somme(h?.discounts) + menage;
  else if (total !== undefined && Number.isFinite(total)) {
    brut = total;
    com = 0;
  } else return null;
  return { brut: centimes(brut), commissionPlateforme: centimes(com), menage: centimes(menage) };
}

/** Nom affiché du voyageur. */
export function nomVoyageur(r: Pick<RepullReservation, 'guestName' | 'primaryGuest'>): string {
  const p = r.primaryGuest;
  return texte(r.guestName) || [texte(p?.firstName), texte(p?.lastName)].filter(Boolean).join(' ') || 'Voyageur';
}

export interface ContexteReservation {
  id: Id;
  logementId: Id;
  aujourdhui: DateISO;
  /** Pays du voyageur (fiche voyageur Repull), s'il est connu. */
  pays?: string;
}

/**
 * Réservation Repull → réservation de l'ERP, fusionnée avec l'existant.
 * null : réservation en attente (demande, paiement) jamais importée.
 *
 * Repull fait foi pour : logement, canal, voyageur (nom, nombre, pays connu),
 * dates, nuits, statut, montants. Restent à l'ERP : note et commentaire hors
 * avis Repull, pays saisi par l'équipe, et tout champ ajouté par l'équipe.
 */
export function versReservation(r: RepullReservation, existant: Reservation | undefined, ctx: ContexteReservation): Reservation | null {
  const statut = statutReservation(r, ctx.aujourdhui) ?? existant?.statut ?? null;
  if (!statut) return null;
  const arrivee = date10(r.checkIn) || existant?.arrivee || '';
  const depart = date10(r.checkOut) || existant?.depart || '';
  const occ = r.occupancy;
  const nb =
    nombre(occ?.total) ||
    (nombre(occ?.adults) ?? 0) + (nombre(occ?.children) ?? 0) ||
    existant?.voyageur.nbPersonnes ||
    1;
  const m = montantsReservation(r);
  const pays = texte(ctx.pays) || existant?.voyageur.pays;
  const suivant: Reservation = {
    ...(existant ?? {}),
    id: existant?.id ?? ctx.id,
    logementId: ctx.logementId,
    canal: canalReservation(r.source ?? r.platform),
    voyageur: { ...(existant?.voyageur ?? {}), nom: nomVoyageur(r), nbPersonnes: nb, ...(pays ? { pays } : {}) },
    arrivee,
    depart,
    nuits: nuitsEntre(arrivee, depart),
    statut,
    montantBrutCentimes: m?.brut ?? existant?.montantBrutCentimes ?? 0,
    commissionPlateformeCentimes: m?.commissionPlateforme ?? existant?.commissionPlateformeCentimes ?? 0,
    fraisMenageCentimes: m ? m.menage : existant?.fraisMenageCentimes ?? 0,
    repull: {
      ...(existant?.repull ?? {}),
      id: String(r.id),
      majLe: r.updatedAt ?? existant?.repull?.majLe,
      statut: r.status ?? existant?.repull?.statut,
      statutDetail: r.statusDetail,
      code: texte(r.confirmationCode) || existant?.repull?.code,
      devise: texte(r.financials?.currency) || texte(r.currency) || existant?.repull?.devise,
      voyageurId: texte(r.primaryGuest?.id) || texte(r.guestId) || existant?.repull?.voyageurId,
      // Lecture seule : sert à repérer une réservation faite le jour même de l'arrivée (anomalies.ts).
      reserveeLe: texte(r.bookedAt) || texte(r.createdAt) || existant?.repull?.reserveeLe,
    },
  };
  return suivant;
}

/* -------------------------------------------------------------------- avis */

/** Note sur 5 (Booking.com note sur 10), à une décimale. */
export function noteSur5(note: unknown): number | undefined {
  const n = nombre(note);
  if (n === undefined || n < 0) return undefined;
  // Booking.com note sur 10 ; Airbnb et Vrbo sur 5.
  const sur5 = n > 5 ? n / 2 : n;
  return Math.round(Math.min(5, sur5) * 10) / 10;
}

/** Avis d'un voyageur → note et commentaire de la réservation. */
export function appliquerAvis(res: Reservation, avis: RepullReview): Reservation {
  if (avis.reviewerRole && avis.reviewerRole !== 'guest') return res;
  const note = noteSur5(avis.rating);
  const public_ = texte(avis.publicReview);
  const prive = texte(avis.privateFeedback);
  const commentaire = [public_, prive ? `Message privé : ${prive}` : ''].filter(Boolean).join('\n\n');
  const suivant = { ...res };
  if (note !== undefined) suivant.noteVoyageur = note;
  if (commentaire) suivant.commentaireVoyageur = commentaire;
  return suivant;
}

/* ---------------------------------------------------------------- messages */

/** Message Repull → message de l'ERP. */
export function versMessage(m: RepullMessage): Message {
  const entrant = m.direction === 'inbound';
  const pieces = (m.attachments ?? []).map((a) => texte(a.url)).filter(Boolean);
  const corps = texte(m.body);
  return {
    id: idRepull(m.id),
    auteur: entrant ? 'voyageur' : m.aiGenerated || m.isAutomated ? 'agent' : 'hote',
    texte: [corps, ...pieces.map((u) => `Pièce jointe : ${u}`)].filter(Boolean).join('\n') || '(message vide)',
    envoyeLe: versHorodatageErp(m.sentAt),
  };
}

const parDate = (a: Message, b: Message) => instant(a.envoyeLe) - instant(b.envoyeLe) || a.id.localeCompare(b.id);

export interface ContexteFil {
  id: Id;
  logementId: Id;
  reservationId?: Id;
  canal: CanalReservation;
  /** Nom du voyageur (réservation liée, sinon premier message entrant). */
  voyageur?: string;
}

/**
 * Conversation Repull + ses messages → fil de l'ERP, fusionné avec l'existant.
 *
 * Messages : union par identifiant (les messages saisis dans l'ERP restent),
 * ordre chronologique. Statut et prise en charge restent à l'ERP, sauf un
 * nouveau message du voyageur : fil rouvert et « en attente » (si l'agent IA
 * n'a pas la main) ; une réponse de l'hôte sur un fil en attente le passe
 * « équipe », et sur un fil transmis (escalade) le rouvre comme répondu.
 */
export function versFil(conv: RepullConversation, messages: RepullMessage[], existant: FilMessages | undefined, ctx: ContexteFil): FilMessages {
  const connus = new Map<string, Message>((existant?.messages ?? []).map((m) => [m.id, m]));
  const nouveaux: Message[] = [];
  for (const brut of messages) {
    if (!brut?.id || !instant(brut.sentAt)) continue;
    const m = versMessage(brut);
    const avant = connus.get(m.id);
    if (!avant) nouveaux.push(m);
    // Envoyé depuis l'ERP : Repull le voit comme un envoi de l'hôte (aiGenerated
    // faux) ; l'auteur « agent », l'heure et la trace d'envoi de l'ERP restent.
    connus.set(m.id, avant ? { ...avant, ...m, auteur: avant.auteur === 'agent' ? 'agent' : m.auteur, envoyeLe: avant.envoi ? avant.envoyeLe : m.envoyeLe } : m);
  }
  const liste = [...connus.values()].sort(parDate);
  const dernier = liste[liste.length - 1];
  const avant = instant(existant?.dernierMessageLe);
  const entrantRecent = nouveaux.some((m) => m.auteur === 'voyageur' && instant(m.envoyeLe) > avant);
  const premierEntrant = messages.find((m) => m.direction === 'inbound' && texte(m.senderName));

  let statut = existant?.statut ?? 'ouvert';
  let traitePar = existant?.traitePar ?? (dernier?.auteur === 'voyageur' ? 'en_attente' : 'humain');
  if (existant && nouveaux.length) {
    if (dernier?.auteur === 'voyageur' && entrantRecent) {
      if (statut === 'clos') statut = 'ouvert';
      if (traitePar !== 'agent') traitePar = 'en_attente';
    } else if (dernier && dernier.auteur !== 'voyageur' && traitePar === 'en_attente') {
      traitePar = 'humain';
    }
    // L'équipe a répondu directement sur la plateforme à une conversation transmise :
    // répondue, comme une réponse envoyée depuis l'ERP (messagerie-envoi.ts). Jamais le
    // retour d'un message parti de l'ERP (message d'attente de l'agent sans identifiant Repull).
    const norme = (t: string) => t.normalize('NFKC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
    const renvoiErp = (m: Message) => (existant?.messages ?? []).some((x) => !!x.envoi && norme(x.texte) === norme(m.texte));
    // Seulement un vrai envoi de l'hôte sur la plateforme (ni message système, ni automatique, ni IA).
    const reponsesHote = new Set(messages.filter((b) => b?.id && b.direction === 'outbound' && !b.aiGenerated && !b.isAutomated).map((b) => idRepull(b.id)));
    if (statut === 'escalade' && dernier && reponsesHote.has(dernier.id) && nouveaux.some((m) => m.id === dernier.id) && instant(dernier.envoyeLe) > avant && !renvoiErp(dernier)) {
      statut = 'ouvert';
      traitePar = 'humain';
    }
  }

  return {
    ...(existant ?? {}),
    id: existant?.id ?? ctx.id,
    ...(ctx.reservationId ? { reservationId: ctx.reservationId } : existant?.reservationId ? { reservationId: existant.reservationId } : {}),
    logementId: ctx.logementId,
    canal: ctx.canal,
    voyageur: texte(ctx.voyageur) || texte(premierEntrant?.senderName) || existant?.voyageur || 'Voyageur',
    statut,
    messages: liste,
    dernierMessageLe:
      dernier?.envoyeLe || versHorodatageErp(conv.lastMessageAt) || existant?.dernierMessageLe || versHorodatageErp(conv.createdAt) || horodatageParis(),
    traitePar,
    repull: {
      ...(existant?.repull ?? {}),
      id: String(conv.id),
      majLe: texte(conv.lastMessageAt) || texte(conv.updatedAt) || existant?.repull?.majLe,
    },
  };
}

/** Horodatage le plus récent. */
export const plusRecent = (a: Horodatage | undefined, b: Horodatage | undefined): Horodatage | undefined =>
  !a ? b : !b ? a : instant(a) >= instant(b) ? a : b;

/** Réservations et conversations écartées par un passage (bilan.ignores). */
export interface EcartsRepull {
  reservationsEnAttente?: number;
  reservationsSansLogement?: number;
  filsSansLogement?: number;
  reservationsHorsSelection?: number;
  filsHorsSelection?: number;
}

/**
 * Ce que le passage a écarté, en clair (journal et message du bouton) : sans
 * cela, « rien de nouveau » cache des réservations bien reçues de Repull mais
 * laissées de côté (logement non choisi, annonce inconnue, en attente).
 */
export function ecartsBilan(b: { ignores?: EcartsRepull }): string[] {
  const i = b.ignores ?? {};
  const nb = (x: number, un: string) => `${x} ${un}${x > 1 ? 's' : ''}`;
  const phrases: string[] = [];
  const r = i.reservationsHorsSelection ?? 0;
  const f = i.filsHorsSelection ?? 0;
  if (r || f) {
    const qui = [r ? nb(r, 'réservation') : '', f ? nb(f, 'conversation') : ''].filter(Boolean).join(' et ');
    const une = r + f === 1;
    phrases.push(
      une
        ? `${qui} concerne un logement non choisi : elle n’entre pas dans l’ERP. Pour l’ajouter : Logements → Connexions.`
        : `${qui} concernent des logements non choisis : elles n’entrent pas dans l’ERP. Pour les ajouter : Logements → Connexions.`,
    );
  }
  const x = i.reservationsEnAttente ?? 0;
  if (x) phrases.push(`${nb(x, 'réservation')} en attente de confirmation, ${x > 1 ? 'importées' : 'importée'} une fois ${x > 1 ? 'confirmées' : 'confirmée'}.`);
  const y = i.reservationsSansLogement ?? 0;
  if (y) phrases.push(`${nb(y, 'réservation')} sur une annonce inconnue.`);
  const z = i.filsSansLogement ?? 0;
  if (z) phrases.push(`${nb(z, 'conversation')} sans logement.`);
  return phrases;
}

/** Nombre de jours de prix lus à l'avance (fiche logement). */
export const JOURS_TARIFS = 60;
/** Photos gardées par logement (galerie de la fiche). */
export const MAX_PHOTOS = 24;

/** Adresses de photos : https seulement, sans doublon, 24 au plus. */
function adressesPhotos(liste: { url?: unknown }[]): string[] {
  const vues = new Set<string>();
  for (const p of liste) {
    const u = typeof p?.url === 'string' ? p.url.trim() : '';
    if (/^https:\/\/[^\s"'<>]+$/i.test(u)) vues.add(u);
    if (vues.size >= MAX_PHOTOS) break;
  }
  return [...vues];
}

/* Lectures propres aux plateformes (Booking.com, Airbnb) : la forme exacte
 * n'est pas décrite par Repull (« ce que la plateforme renvoie »), d'où une
 * lecture prudente qui ne garde que ce qui est sûr. */

const IMAGE_HTTPS = /^https:\/\/[^\s"'<>]+$/i;
/** Adresse qui ressemble à une image (extension, ou CDN photo connu). */
const RESSEMBLE_IMAGE = /\.(jpe?g|png|webp|avif)(\?|$)|bstatic\.com|muscache\.com|\/images?\//i;

/** Rang d'une clé de photo : la plus grande taille d'abord, les vignettes en dernier. */
function rangCle(cle: string): number {
  const k = cle.toLowerCase();
  if (/thumb|square|small|mini|60|100|150|300/.test(k)) return 50;
  const ordre = ['original', 'max', 'large', '1280', '1024', 'xl', 'url', 'src', 'href', 'standard', 'medium'];
  const i = ordre.findIndex((o) => k.includes(o));
  return i === -1 ? 40 : i;
}

/** L'adresse d'une photo : chaîne https, ou la meilleure adresse https d'un objet photo. */
function adressePhoto(x: unknown, profondeur = 0): string | undefined {
  if (typeof x === 'string') {
    const u = x.trim();
    return IMAGE_HTTPS.test(u) && RESSEMBLE_IMAGE.test(u) ? u : undefined;
  }
  if (!x || typeof x !== 'object' || Array.isArray(x) || profondeur > 3) return undefined;
  const o = x as Record<string, unknown>;
  for (const k of Object.keys(o).sort((a, b) => rangCle(a) - rangCle(b))) {
    const v = o[k];
    const u = typeof v === 'string' ? (IMAGE_HTTPS.test(v.trim()) && (rangCle(k) < 40 || RESSEMBLE_IMAGE.test(v)) ? v.trim() : undefined) : adressePhoto(v, profondeur + 1);
    if (u) return u;
  }
  return undefined;
}

/** Première liste trouvée sous « photos », « images », « data »… (ou la réponse elle-même). */
function listePhotos(r: unknown, profondeur = 0): unknown[] {
  if (Array.isArray(r)) return r;
  if (!r || typeof r !== 'object' || profondeur > 3) return [];
  const o = r as Record<string, unknown>;
  for (const k of ['photos', 'images', 'pictures', 'data', 'items', 'results']) {
    const v = o[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') {
      const l = listePhotos(v, profondeur + 1);
      if (l.length) return l;
    }
  }
  return [];
}

/**
 * Photos d'une réponse dont la forme varie selon la plateforme (Booking.com
 * « content?type=photos », Airbnb « listings/{id}/photos ») : une adresse
 * https par photo, la plus grande taille, sans doublon, 24 au plus.
 */
export function photosDepuisContenu(r: unknown): string[] {
  const vues = new Set<string>();
  for (const p of listePhotos(r)) {
    const u = adressePhoto(p);
    if (u) vues.add(u);
    if (vues.size >= MAX_PHOTOS) break;
  }
  return [...vues];
}

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const nombreTexte = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(v) ? Number(v) : NaN);

/**
 * Prix par nuit lus chez Booking.com (« listings/{id}/pricing », relais de
 * getRoomRateAvailability, forme libre). Pour chaque jour daté : le prix
 * « price » le plus bas parmi les tarifs ouverts (sinon le plus bas des
 * « priceN »), entre 5 et 10 000 ; libre si des chambres restent à vendre
 * (ou si Booking.com ne le dit pas). Jours hors de [du, au[ écartés.
 */
export function tarifsDepuisBooking(r: unknown, luLe: Horodatage, du: DateISO, au: DateISO): TarifsLogement | undefined {
  // Par jour : prix « price » et « priceN » des tarifs ouverts, chambres à vendre.
  const jours = new Map<string, { standard?: number; autre?: number; aVendre?: number }>();
  const ferme = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true';
  const visiter = (x: unknown, date: string | undefined, profondeur: number) => {
    if (profondeur > 14 || !x || typeof x !== 'object') return;
    if (Array.isArray(x)) {
      for (const e of x) visiter(e, date, profondeur + 1);
      return;
    }
    const o = x as Record<string, unknown>;
    let d = date;
    for (const k of ['date', 'value', '@value', '@_value', '_value', 'day']) {
      const v = o[k];
      if (typeof v === 'string' && DATE_ISO.test(v.trim())) {
        d = v.trim();
        break;
      }
    }
    if (d) {
      const j = jours.get(d) ?? {};
      const entrees = Object.entries(o).map(([k, v]) => [k.toLowerCase().replace(/^[@_]+/, ''), v] as const);
      // Un tarif fermé (closed, stop_sell) ne donne pas de prix pour ce jour.
      const tarifFerme = entrees.some(([k, v]) => (k === 'closed' || k === 'stop_sell' || k === 'stopsell') && ferme(v));
      for (const [k, v] of entrees) {
        const n = nombreTexte(v);
        if (/^price\d*$/.test(k) && n >= 5 && n <= 10_000 && !tarifFerme) {
          if (k === 'price') j.standard = Math.min(j.standard ?? Infinity, n);
          else j.autre = Math.min(j.autre ?? Infinity, n);
        } else if (/^rooms?_?to_?sell$/.test(k) && Number.isFinite(n)) {
          j.aVendre = Math.max(j.aVendre ?? 0, n);
        }
      }
      jours.set(d, j);
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') visiter(v, d, profondeur + 1);
  };
  visiter(r, undefined, 0);
  const res = [...jours.entries()]
    .filter(([date, j]) => date >= du && date < au && (j.standard ?? j.autre) !== undefined)
    .map(([date, j]) => ({ date, prixCentimes: Math.round((j.standard ?? j.autre)! * 100), libre: j.aVendre === undefined || j.aVendre > 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!res.length) return undefined;
  const devise = typeof (r as { currency?: unknown })?.currency === 'string' ? String((r as { currency: string }).currency).trim() : '';
  return { devise: devise || 'EUR', luLe, jours: res };
}

/** Photos déposées chez Repull (GET /v1/listings/{id}/photos). */
export function versPhotos(r: RepullPhotos | null | undefined): string[] {
  return adressesPhotos(Array.isArray(r?.photos) ? r!.photos : []);
}

/** Photos de l'annonce (?include=photos), dans l'ordre d'affichage de la plateforme. */
export function photosAnnonce(liste: RepullListingPhoto[] | null | undefined): string[] {
  if (!Array.isArray(liste)) return [];
  const ordre = (p: RepullListingPhoto) => (typeof p?.sortOrder === 'number' && Number.isFinite(p.sortOrder) ? p.sortOrder : Infinity);
  return adressesPhotos(liste.map((p, i) => ({ p, i })).sort((a, b) => ordre(a.p) - ordre(b.p) || a.i - b.i).map((x) => x.p));
}

/* ---------------------------------------------------------- descriptif */

/** Longueur gardée par texte d'annonce (fiche et contexte de l'agent). */
export const MAX_TEXTE_ANNONCE = 1500;

const borne = (v: unknown, max = MAX_TEXTE_ANNONCE): string | undefined => {
  const t = texte(v).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n');
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};
const oui = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const entierPositif = (v: unknown): number | undefined => {
  const n = nombre(v);
  return n !== undefined && n >= 0 ? Math.round(n) : undefined;
};
const prixCentimes = (v: unknown): Centimes | undefined => {
  const n = nombre(v);
  return n !== undefined && n >= 0 ? centimes(n) : undefined;
};
/** Objet sans clé vide (undefined, objet vide, liste vide) ; undefined s'il ne reste rien. */
function compact<T extends object>(o: T): T | undefined {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === '') continue;
    if (Array.isArray(v) && !v.length) continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) continue;
    r[k] = v;
  }
  return Object.keys(r).length ? (r as T) : undefined;
}

const LITS: Record<string, [string, string]> = {
  king_bed: ['lit king size', 'lits king size'],
  queen_bed: ['lit queen size', 'lits queen size'],
  double_bed: ['lit double', 'lits doubles'],
  single_bed: ['lit simple', 'lits simples'],
  sofa_bed: ['canapé-lit', 'canapés-lits'],
  couch: ['canapé', 'canapés'],
  bunk_bed: ['lit superposé', 'lits superposés'],
  crib: ['lit bébé', 'lits bébé'],
  toddler_bed: ['lit enfant', 'lits enfant'],
  air_mattress: ['matelas gonflable', 'matelas gonflables'],
  floor_mattress: ['matelas au sol', 'matelas au sol'],
  small_double_bed: ['petit lit double', 'petits lits doubles'],
  hammock: ['hamac', 'hamacs'],
  water_bed: ['lit à eau', 'lits à eau'],
};
const PIECES: Record<string, string> = {
  bedroom: 'Chambre',
  living_room: 'Salon',
  common_space: 'Espace commun',
  common_spaces: 'Espace commun',
  office: 'Bureau',
  kitchen: 'Cuisine',
};
const ANNULATION: Record<string, string> = {
  flexible: 'Flexible',
  moderate: 'Modérée',
  firm: 'Ferme',
  limited: 'Limitée',
  strict: 'Stricte',
  strict_14_with_grace_period: 'Stricte',
  super_strict_30: 'Très stricte',
  super_strict_60: 'Très stricte',
  non_refundable: 'Non remboursable',
};
const ARRIVEE: Record<string, string> = {
  lockbox: 'Boîte à clés',
  smartlock: 'Serrure connectée',
  keypad: 'Digicode',
  doorman: 'Gardien',
  host_greets: 'Accueil sur place',
  building_staff: 'Personnel de l’immeuble',
};
const FRAIS: Record<string, string> = {
  pet: 'Animal',
  linen: 'Linge',
  resort: 'Frais de séjour',
  management: 'Frais de gestion',
  community: 'Frais de résidence',
  extra_guest: 'Voyageur supplémentaire',
};
const PAR: Record<string, string> = { stay: 'par séjour', night: 'par nuit', guest: 'par voyageur', guest_night: 'par voyageur et par nuit' };

/** Clé en clair (« strict_14 » → « Strict 14 ») quand elle n'est pas connue. */
const enClair = (cle: string) => {
  const t = cle.replace(/[_-]+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
};

function versCouchage(rooms: RepullListingRoom[]): { piece: string; lits: string }[] {
  const res: { piece: string; lits: string }[] = [];
  for (const r of rooms) {
    const lits = (Array.isArray(r?.beds) ? r.beds : [])
      .map((b) => {
        const n = entierPositif(b?.quantity) ?? 1;
        const type = texte(b?.type).toLowerCase();
        if (!n || !type) return '';
        const [un, plusieurs] = LITS[type] ?? [enClair(type).toLowerCase(), enClair(type).toLowerCase()];
        return `${n} ${n > 1 ? plusieurs : un}`;
      })
      .filter(Boolean);
    if (!lits.length) continue;
    const type = texte(r?.type).toLowerCase();
    const num = entierPositif(r?.number);
    const piece = texte(r?.name) || `${PIECES[type] ?? 'Autre pièce'}${type === 'bedroom' && num ? ` ${num}` : ''}`;
    res.push({ piece, lits: lits.join(', ') });
    if (res.length >= 20) break;
  }
  return res;
}

function versFrais(fees: RepullListingFee[], devise: string): string[] {
  const res: string[] = [];
  for (const f of fees) {
    const type = texte(f?.type).toLowerCase();
    // Le ménage est déjà dans les prix de base.
    if (!type || type === 'cleaning') continue;
    const montant = nombre(f?.amount);
    if (montant === undefined || montant < 0) continue;
    const nom = FRAIS[type] ?? (texte(f?.name) || enClair(type));
    const valeur =
      f.amountType === 'percent'
        ? `${String(Math.round(montant * 10) / 10).replace('.', ',')} %`
        : `${(Math.round(montant * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${devise === 'EUR' ? '€' : devise}`;
    const par = PAR[texte(f?.chargedPer)] ?? '';
    res.push(`${nom} : ${valeur}${par ? ` ${par}` : ''}${f.optional ? ' (en option)' : ''}`);
    if (res.length >= 10) break;
  }
  return res;
}

/**
 * Ce que l'annonce dit du logement. Chaque partie (textes, couchage,
 * conditions, séjour, prix, frais) n'est remplacée que quand Repull la
 * renvoie : un relevé sans ?include=… garde la dernière lecture.
 */
export function versDescriptif(l: RepullListing, avant: DescriptifLogement | undefined): DescriptifLogement | undefined {
  const r: DescriptifLogement = { ...(avant ?? {}) };
  const titre = borne(l.publicName, 200);
  if (titre) r.titre = titre;
  else if ('publicName' in l) delete r.titre;

  if ('content' in l) {
    const c = l.content ?? undefined;
    const textes = c
      ? compact({
          resume: borne(c.summary),
          description: borne(c.description),
          espace: borne(c.space),
          accesVoyageurs: borne(c.guestAccess),
          quartier: borne(c.neighborhoodOverview),
          transports: borne(c.transit) ?? borne(c.gettingAround),
        })
      : undefined;
    if (textes) r.textes = textes;
    else delete r.textes;
  }
  if (Array.isArray(l.rooms)) {
    const couchage = versCouchage(l.rooms);
    if (couchage.length) r.couchage = couchage;
    else delete r.couchage;
  }
  if ('details' in l) {
    const sdb = Number.parseFloat(texte(l.details?.bathrooms).replace(',', '.'));
    if (Number.isFinite(sdb) && sdb > 0) r.sallesDeBain = sdb;
    else delete r.sallesDeBain;
  }
  if ('policies' in l) {
    const p = l.policies ?? undefined;
    const annulation = texte(p?.cancellationPolicy).toLowerCase();
    const methode = texte(p?.checkIn?.method).toLowerCase();
    const calme = heure(p?.quietHours?.start) && heure(p?.quietHours?.end) ? { debut: heure(p?.quietHours?.start)!, fin: heure(p?.quietHours?.end)! } : undefined;
    const conditions = p
      ? compact({
          animaux: oui(p.allowsPets),
          fumeur: oui(p.allowsSmoking),
          fetes: oui(p.allowsEvents),
          enfants: oui(p.allowsChildren),
          bebes: oui(p.allowsInfants),
          ageMinEnfants: entierPositif(p.childrenMinAge) || undefined,
          calme,
          annulation: annulation ? ANNULATION[annulation] ?? enClair(annulation) : undefined,
          arrivee: methode && methode !== 'other' ? ARRIVEE[methode] ?? enClair(methode) : undefined,
          arriveeJusqua: heure(p.checkIn?.until),
        })
      : undefined;
    if (conditions) r.conditions = conditions;
    else delete r.conditions;
  }
  if ('rules' in l) {
    const u = l.rules ?? undefined;
    const direct = texte(u?.instantBook).toLowerCase();
    const sejour = u
      ? compact({
          nuitsMin: entierPositif(u.minNights) || undefined,
          nuitsMax: entierPositif(u.maxNights) || undefined,
          preavisHeures: entierPositif(u.advanceNoticeHours),
          reservationInstantanee: direct ? !['off', 'none', 'false', 'disabled', 'no'].includes(direct) : undefined,
        })
      : undefined;
    if (sejour) r.sejour = sejour;
    else delete r.sejour;
  }
  const devise = texte(l.pricing?.currency) || 'EUR';
  if ('pricing' in l) {
    const x = l.pricing ?? undefined;
    const prix = x
      ? compact({
          nuit: prixCentimes(x.basePrice),
          weekend: prixCentimes(x.weekendPrice),
          menage: prixCentimes(x.cleaningFee),
          voyageurSupplementaire: prixCentimes(x.extraGuestFee) || undefined,
          voyageursInclus: entierPositif(x.guestsIncluded) || undefined,
          caution: prixCentimes(x.securityDeposit ?? l.policies?.securityDeposit) || undefined,
          remiseSemainePct: nombre(x.weeklyDiscountPercent) || undefined,
          remiseMoisPct: nombre(x.monthlyDiscountPercent) || undefined,
        })
      : undefined;
    if (prix) r.prix = { devise, ...prix };
    else delete r.prix;
  }
  if (Array.isArray(l.fees)) {
    const frais = versFrais(l.fees, devise);
    if (frais.length) r.frais = frais;
    else delete r.frais;
  }
  return compact(r);
}

/** Prix par nuit lus sur les plateformes (centimes) ; jours sans prix ou mal datés écartés. */
export function versTarifs(r: RepullDisponibilite | null | undefined, luLe: Horodatage): TarifsLogement | undefined {
  const jours = (Array.isArray(r?.days) ? r!.days : [])
    .filter((j) => typeof j?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.date) && typeof j.price === 'number' && Number.isFinite(j.price) && j.price >= 0)
    .map((j) => ({ date: j.date as string, prixCentimes: Math.round((j.price as number) * 100), libre: j.available === true }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!jours.length) return undefined;
  return { devise: (typeof r?.currency === 'string' && r.currency.trim()) || 'EUR', luLe, jours };
}
