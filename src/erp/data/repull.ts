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
  houseRules?: string | null;
}

/** GET /v1/listings, GET /v1/listings/{id}. */
export interface RepullListing {
  id: string;
  name?: string;
  address?: { street?: string | null; city?: string | null };
  thumbnailUrl?: string | null;
  status?: 'active' | 'inactive' | 'archived' | string;
  channels?: RepullCanalAnnonce[];
  amenities?: RepullAmenity[];
  content?: RepullListingContent | null;
  details?: RepullListingDetails | null;
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
    ibanMasque: '',
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
  const arrivee = heure(d?.checkInTimeStart);
  if (arrivee) fiche.heureArrivee = arrivee;
  const depart = heure(d?.checkOutTime);
  if (depart) fiche.heureDepart = depart;
  if (!texte(fiche.regles) && texte(c?.houseRules)) fiche.regles = texte(c?.houseRules);
  if (!texte(fiche.acces) && texte(d?.directions)) fiche.acces = texte(d?.directions);
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

  // Statut : seulement quand l'annonce change d'état chez Repull.
  if (existant && l.status && l.status !== existant.repull?.statut) suivant.statut = statutLogement(l.status);

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
 * avis Repull, identifiant Channex, et tout champ ajouté par l'équipe.
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
 * « équipe ».
 */
export function versFil(conv: RepullConversation, messages: RepullMessage[], existant: FilMessages | undefined, ctx: ContexteFil): FilMessages {
  const connus = new Map<string, Message>((existant?.messages ?? []).map((m) => [m.id, m]));
  const nouveaux: Message[] = [];
  for (const brut of messages) {
    if (!brut?.id || !instant(brut.sentAt)) continue;
    const m = versMessage(brut);
    if (!connus.has(m.id)) nouveaux.push(m);
    connus.set(m.id, m);
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
