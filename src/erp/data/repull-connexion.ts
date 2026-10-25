/**
 * Connexion des plateformes depuis l'ERP (page Logements → Connexions), côté
 * serveur (api/erp-repull-connexion.ts).
 *
 * Parcours : le gérant connecte Airbnb, Booking.com, VRBO ou son logiciel de
 * gestion par Repull Connect (page hébergée par Repull, retour sur l'ERP),
 * puis choisit les logements à gérer parmi ceux trouvés. L'offre Repull
 * limite le nombre d'annonces actives (gratuite : 3) : la limite est
 * vérifiée ici, et les annonces non choisies sont désactivées chez Repull
 * (elles ne comptent plus dans la limite, rien n'est supprimé). Seuls les
 * logements choisis entrent ensuite dans l'ERP (repull-synchro.ts).
 *
 * Chaque appel Repull passe par le compteur mensuel de l'ERP (repull/etat).
 * Les réponses sont gardées dans un enregistrement repull/connexions pour
 * ne pas refaire les mêmes appels à chaque ouverture de la page.
 *
 * Endpoints Repull (OpenAPI) :
 *   GET    /v1/connect/providers        plateformes et logiciels disponibles
 *   GET    /v1/connect                  comptes connectés
 *   POST   /v1/connect/airbnb|booking   page de connexion hébergée ({ url })
 *   POST   /v1/connect                  sélecteur hébergé, restreint à un fournisseur
 *   DELETE /v1/connect/{provider}       déconnexion d'un compte (Airbnb, Booking.com)
 *   GET    /v1/listings?status=all      toutes les annonces, désactivées comprises
 *   POST   /v1/listings/status          activation / désactivation par lot
 *   GET    /v1/usage/tier               offre du compte (free, starter, custom)
 *
 * Booking.com : la page hébergée guide tout (désigner le fournisseur de
 * connectivité dans l'Extranet, coller le numéro d'établissement, relier les
 * chambres) ; ses appels (verify, rooms, map-rooms) sont faits par la page
 * elle-même avec le jeton de session, sans notre clé.
 *
 * Imports relatifs avec « .js » : ce fichier tourne sous Node (ESM).
 */
import { horodatageParis } from './repull.js';
import type { RepullListing } from './repull.js';
import {
  BUDGET_ERP_DEFAUT,
  BaseErp,
  BudgetEpuise,
  ClientRepull,
  COLLECTION_ETAT,
  DelaiEcoule,
  ErreurRepull,
  ID_SELECTION,
  QUOTA_MOIS_DEFAUT,
  imputerAppels,
  lancer,
  lireEtat,
  lireSelection,
  type BilanRepull,
  type PhaseRepull,
  type SelectionRepull,
} from './repull-synchro.js';
import type { FilMessages, Logement, Reservation } from './types';

type Fetch = typeof fetch;

/** Nombre d'annonces actives permis par offre Repull (OpenAPI, « Plan Limits »). */
export const LIMITES_OFFRE: Record<string, number | null> = { free: 3, starter: 50, custom: null };
/** Limite retenue quand l'offre est inconnue (REPULL_LIMITE_LOGEMENTS sinon). */
export const LIMITE_DEFAUT = 3;
export const ID_CONNEXIONS = 'connexions';

/** Plateformes présentées en premier, dans cet ordre. */
export const PLATEFORMES_PRINCIPALES = ['airbnb', 'booking', 'vrbo'] as const;

const MINUTE = 60_000;
const CACHE_ETAT_MS = 5 * MINUTE;
const CACHE_OFFRE_MS = 24 * 60 * MINUTE;
const CACHE_FOURNISSEURS_MS = 7 * 24 * 60 * MINUTE;
const PHASES_APRES_CHOIX: PhaseRepull[] = ['annonces', 'reservations', 'avis', 'conversations'];

/* ================================================================== types */

export interface FournisseurRepull {
  id: string;
  nom: string;
  categorie: 'ota' | 'pms' | string;
  /** oauth, credentials, activation, claim */
  mode?: string;
  /** live, beta, coming-soon */
  statut?: string;
  logo?: string;
}

export interface ConnexionPlateforme {
  id: string;
  fournisseur: string;
  statut: 'active' | 'inactive' | 'error' | string;
  /** Identifiant du compte chez la plateforme (hôte Airbnb, établissement Booking.com). */
  compte?: string;
  nom?: string;
  avatar?: string;
  depuis?: string;
  /**
   * Booking.com : rattaché à l'ancien mode « fournisseur de connectivité », pas à
   * un compte Extranet. L'ERP n'utilise pas ce mode : Booking y refuse l'accès (497),
   * rien n'en arrive.
   */
  ancienMode?: boolean;
}

export interface AnnonceDecouverte {
  id: string;
  nom: string;
  ville?: string;
  photo?: string;
  /** active, inactive, archived (chez Repull). */
  statutRepull: string;
  plateformes: string[];
  selectionnee: boolean;
  /** Déjà dans l'ERP (logement relié à cette annonce). */
  importee: boolean;
  logementId?: string;
}

export interface DepassementOffre {
  actives?: number;
  limite?: number;
  message: string;
}

export interface EtatConnexions {
  ok: true;
  fournisseurs: FournisseurRepull[];
  connexions: ConnexionPlateforme[];
  annonces: AnnonceDecouverte[];
  selection: string[];
  selectionMajLe?: string;
  /** Nombre maximal de logements (null : illimité). */
  limite: number | null;
  offre?: string;
  sourceLimite: 'repull' | 'variable' | 'defaut';
  depassement?: DepassementOffre;
  /** Messages à afficher sans bloquer (budget épuisé, lecture partielle...). */
  avertissements: string[];
  luLe?: string;
  appels: { mois: number; budget: number };
}

export interface ResultatConnecter {
  ok: true;
  url: string;
  expireLe?: string;
}

export interface ResultatSelection {
  ok: boolean;
  selection: string[];
  logements: number;
  reservations: number;
  conversations: number;
  /** Passage de synchronisation interrompu (temps ou appels) : la suite viendra. */
  partiel: boolean;
  message?: string;
  bilan?: BilanRepull;
}

export interface ResultatDeconnecter {
  ok: true;
  annoncesDesactivees: string[];
}

/** Mémoire des dernières réponses Repull (repull/connexions). */
interface CacheConnexions {
  id: typeof ID_CONNEXIONS;
  fournisseurs?: FournisseurRepull[];
  fournisseursLuLe?: string;
  offre?: string;
  offreLuLe?: string;
  connexions?: ConnexionPlateforme[];
  annonces?: AnnonceBrute[];
  luLe?: string;
  depassement?: DepassementOffre;
}

/** Annonce telle que gardée en mémoire (sans ce qui dépend de l'ERP). */
type AnnonceBrute = Pick<AnnonceDecouverte, 'id' | 'nom' | 'ville' | 'photo' | 'statutRepull' | 'plateformes'>;

/** Erreur à montrer telle quelle (français), avec le statut HTTP à renvoyer. */
export class ErreurConnexion extends Error {
  constructor(
    message: string,
    readonly statut = 400,
  ) {
    super(message);
  }
}

export interface ContexteConnexion {
  cle: string;
  base: BaseErp;
  /** Instant (ms) à ne pas dépasser. */
  echeance: number;
  budgetMois?: number;
  quotaMois?: number;
  /** REPULL_LIMITE_LOGEMENTS (quand l'offre n'est pas connue). */
  limiteVariable?: number;
  maintenant?: () => Date;
  fetch?: Fetch;
  baseRepull?: string;
  attendre?: (ms: number) => Promise<void>;
  /** Appels Repull faits sous ce contexte (bilan de l'agent IA). */
  compteur?: { appels: number };
}

/* ================================================================ outils */

const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const age = (horodatage: string | undefined, maintenant: Date) => (horodatage ? maintenant.getTime() - Date.parse(horodatage) : Infinity);

/** Nom de plateforme Repull → identifiant court (booking.com → booking). */
export function plateformeCourte(p: unknown): string {
  const s = texte(p).toLowerCase();
  if (s.startsWith('booking')) return 'booking';
  if (s.startsWith('vrbo') || s.startsWith('homeaway') || s.startsWith('abritel')) return 'vrbo';
  return s;
}

/** Limite de logements : offre Repull connue, sinon REPULL_LIMITE_LOGEMENTS, sinon 3. */
export function limiteLogements(offre: string | undefined, variable?: number): { limite: number | null; source: EtatConnexions['sourceLimite'] } {
  const t = (offre ?? '').toLowerCase();
  if (t && t in LIMITES_OFFRE) return { limite: LIMITES_OFFRE[t], source: 'repull' };
  if (variable !== undefined && Number.isFinite(variable) && variable > 0) return { limite: Math.floor(variable), source: 'variable' };
  return { limite: LIMITE_DEFAUT, source: 'defaut' };
}

/** Texte de la limite, pour les messages (« l’offre gratuite (3 logements) »). */
export function libelleOffre(offre: string | undefined, limite: number | null): string {
  const nom = { free: 'l’offre gratuite', starter: 'l’offre Starter', custom: 'votre offre' }[(offre ?? 'free').toLowerCase()] ?? 'votre offre';
  return limite === null ? nom : `${nom} (${limite} logement${limite > 1 ? 's' : ''})`;
}

function versAnnonce(l: RepullListing): AnnonceBrute {
  const plateformes = [...new Set((l.channels ?? []).map((c) => plateformeCourte(c.platform)).filter(Boolean))];
  return {
    id: String(l.id),
    nom: texte(l.name) || `Logement ${l.id}`,
    ...(texte(l.address?.city) ? { ville: texte(l.address?.city) } : {}),
    ...(texte(l.thumbnailUrl) ? { photo: texte(l.thumbnailUrl) } : {}),
    statutRepull: texte(l.status) || 'active',
    plateformes,
  };
}

function versFournisseur(p: Record<string, unknown>): FournisseurRepull | null {
  const id = texte(p.id);
  if (!id) return null;
  return {
    id,
    nom: texte(p.displayName) || id,
    categorie: texte(p.category) || 'pms',
    ...(texte(p.connectPattern) ? { mode: texte(p.connectPattern) } : {}),
    ...(texte(p.status) ? { statut: texte(p.status) } : {}),
    ...(texte(p.logoUrl) ? { logo: texte(p.logoUrl) } : {}),
  };
}

/** Connexion Booking.com « Extranet login » (booking_extranet) : le seul mode Booking que l'ERP utilise. */
const estExtranet = (provider: unknown) => /^booking[\s_-]*extranet/i.test(texte(provider));

interface ConnexionExtranet {
  id: string;
  compte?: string;
  /** Création de la connexion (ms). */
  depuis: number;
}

function connexionsExtranet(l: Record<string, unknown>[]): ConnexionExtranet[] {
  return l
    .filter((c) => estExtranet(c?.provider))
    .map((c) => ({ id: texte(c.id), ...(texte(c.externalAccountId) ? { compte: texte(c.externalAccountId) } : {}), depuis: Date.parse(texte(c.createdAt)) }));
}

/**
 * Connexion Extranet d'un établissement Booking.com (/v1/channels/booking/properties) :
 * même connectionId, ou établissement créé après elle, par son import (Repull lui donne
 * alors un connectionId à lui). Aucune : il vient de l'ancien mode « fournisseur de
 * connectivité ».
 */
function extranetDe(p: Record<string, unknown>, extranets: ConnexionExtranet[]): ConnexionExtranet | undefined {
  const id = texte(p.connectionId);
  const cree = Date.parse(texte(p.createdAt));
  return extranets.find((x) => !!id && x.id === id) ?? extranets.find((x) => Number.isFinite(cree) && Number.isFinite(x.depuis) && cree >= x.depuis);
}

function versConnexion(c: Record<string, unknown>): ConnexionPlateforme | null {
  const fournisseur = plateformeCourte(c.provider);
  if (!fournisseur) return null;
  const hote = (c.host ?? {}) as Record<string, unknown>;
  return {
    id: texte(c.id) || `${fournisseur}-${texte(c.externalAccountId)}`,
    fournisseur,
    statut: texte(c.status) || 'active',
    ...(texte(c.externalAccountId) ? { compte: texte(c.externalAccountId) } : {}),
    ...(texte(hote.displayNameLong) || texte(hote.displayName) ? { nom: texte(hote.displayNameLong) || texte(hote.displayName) } : {}),
    ...(texte(hote.avatarUrl) ? { avatar: texte(hote.avatarUrl) } : {}),
    ...(texte(c.createdAt) ? { depuis: texte(c.createdAt) } : {}),
    ...(fournisseur === 'booking' && !estExtranet(c.provider) ? { ancienMode: true } : {}),
  };
}

/** Message français d'une erreur, avec la marche à suivre de Repull quand elle existe. */
export function messageErreur(e: unknown, o: { budgetMois?: number; appelsMois?: number } = {}): string {
  if (e instanceof ErreurConnexion) return e.message;
  if (e instanceof BudgetEpuise) {
    return `Les appels Repull de ce mois sont épuisés${o.budgetMois ? ` (${o.appelsMois ?? o.budgetMois} / ${o.budgetMois})` : ''}. Tout reprend le 1er du mois prochain. Pour aller plus vite, augmentez REPULL_BUDGET_ERP dans Vercel ou passez à l’offre Repull supérieure.`;
  }
  if (e instanceof ErreurRepull) {
    if (e.statut === 402 && e.code === 'listings_limit_exceeded') return messageDepassement(e).message;
    return e.correctif ? `${e.message} Repull précise : « ${e.correctif} »` : e.message;
  }
  return e instanceof Error ? e.message : String(e);
}

function messageDepassement(e: ErreurRepull): DepassementOffre {
  const actives = Number(e.infos.active_listings);
  const limite = Number(e.infos.limit);
  const ok = (n: number) => Number.isFinite(n) && n >= 0;
  return {
    ...(ok(actives) ? { actives } : {}),
    ...(ok(limite) ? { limite } : {}),
    message:
      `Vos comptes ont ${ok(actives) ? actives : 'plus de'} logements actifs chez Repull, ${libelleOffre(texte(e.infos.tier) || 'free', ok(limite) ? limite : LIMITE_DEFAUT)} en permet ${ok(limite) ? limite : LIMITE_DEFAUT}. ` +
      'Choisissez ci-dessous ceux à garder : les autres seront mis de côté, sans rien supprimer. Ou passez à l’offre Starter sur repull.dev.',
  };
}

/* ================================================================ mémoire */

async function lireCache(base: BaseErp): Promise<CacheConnexions> {
  const [lu] = await base.lire<CacheConnexions>(COLLECTION_ETAT, [ID_CONNEXIONS]);
  return { ...(lu ?? {}), id: ID_CONNEXIONS };
}

async function ecrireCache(base: BaseErp, c: CacheConnexions): Promise<void> {
  await base.ecrire(COLLECTION_ETAT, [c]);
}

/**
 * Travail avec un client Repull borné par le reste de la part mensuelle ;
 * les appels faits sont ajoutés au compteur, même en cas d'échec.
 */
export async function avecClient<T>(ctx: ContexteConnexion, travail: (c: ClientRepull) => Promise<T>): Promise<T> {
  const maintenant = ctx.maintenant ?? (() => new Date());
  const budgetMois = ctx.budgetMois ?? BUDGET_ERP_DEFAUT;
  const quotaMois = ctx.quotaMois ?? QUOTA_MOIS_DEFAUT;
  const etat = await lireEtat(ctx.base, maintenant(), budgetMois, quotaMois);
  const restant = etat.budgetMois - etat.appelsMois;
  if (restant <= 0) throw new BudgetEpuise();
  const client = new ClientRepull({ cle: ctx.cle, fetch: ctx.fetch, base: ctx.baseRepull, echeance: ctx.echeance, budget: restant, attendre: ctx.attendre });
  try {
    return await travail(client);
  } finally {
    if (ctx.compteur) ctx.compteur.appels += client.appels;
    await imputerAppels(ctx.base, maintenant(), client.appels, budgetMois, quotaMois);
  }
}

async function toutesLesAnnonces(client: ClientRepull): Promise<AnnonceBrute[]> {
  const res: AnnonceBrute[] = [];
  for await (const page of client.pages<RepullListing>('/v1/listings', { status: 'all', include: 'thumbnail' })) {
    for (const l of page) if (l?.id !== undefined && l?.id !== null) res.push(versAnnonce(l));
  }
  return res;
}

async function rafraichirFournisseurs(client: ClientRepull, cache: CacheConnexions, maintenant: Date): Promise<void> {
  const r = await client.get<{ data?: Record<string, unknown>[] }>('/v1/connect/providers');
  const liste = (Array.isArray(r?.data) ? r.data : []).map(versFournisseur).filter((x): x is FournisseurRepull => !!x);
  cache.fournisseurs = liste;
  cache.fournisseursLuLe = maintenant.toISOString();
}

async function rafraichirOffre(client: ClientRepull, cache: CacheConnexions, maintenant: Date): Promise<void> {
  const t = await client.get<{ tier?: string }>('/v1/usage/tier');
  if (texte(t?.tier)) cache.offre = texte(t.tier).toLowerCase();
  cache.offreLuLe = maintenant.toISOString();
}

/* ================================================================ actions */

/** Plateformes et logiciels proposés par Repull (gardés une semaine). */
export async function lireFournisseurs(ctx: ContexteConnexion, forcer = false): Promise<FournisseurRepull[]> {
  const maintenant = (ctx.maintenant ?? (() => new Date()))();
  const cache = await lireCache(ctx.base);
  if (!forcer && cache.fournisseurs?.length && age(cache.fournisseursLuLe, maintenant) < CACHE_FOURNISSEURS_MS) return cache.fournisseurs;
  await avecClient(ctx, (c) => rafraichirFournisseurs(c, cache, maintenant));
  await ecrireCache(ctx.base, cache);
  return cache.fournisseurs ?? [];
}

/**
 * Comptes connectés, annonces trouvées (désactivées comprises), choix
 * enregistré et limite de l'offre. Relu chez Repull au plus toutes les
 * 5 minutes, sauf `forcer` (retour de la page de connexion, bouton).
 */
export async function lireEtatConnexions(ctx: ContexteConnexion, o: { forcer?: boolean } = {}): Promise<EtatConnexions> {
  const maintenant = (ctx.maintenant ?? (() => new Date()))();
  const cache = await lireCache(ctx.base);
  const avertissements: string[] = [];
  const perime = o.forcer || !cache.luLe || age(cache.luLe, maintenant) >= CACHE_ETAT_MS;

  if (perime) {
    try {
      await avecClient(ctx, async (client) => {
        if (!cache.fournisseurs?.length || age(cache.fournisseursLuLe, maintenant) >= CACHE_FOURNISSEURS_MS) {
          await rafraichirFournisseurs(client, cache, maintenant).catch((e) => {
            if (e instanceof BudgetEpuise) throw e;
          });
        }
        if (!cache.offre || age(cache.offreLuLe, maintenant) >= CACHE_OFFRE_MS) {
          await rafraichirOffre(client, cache, maintenant).catch((e) => {
            if (e instanceof BudgetEpuise) throw e;
          });
        }
        delete cache.depassement;
        try {
          const connexions: ConnexionPlateforme[] = [];
          const brutes: Record<string, unknown>[] = [];
          for await (const page of client.pages<Record<string, unknown>>('/v1/connect')) {
            for (const c of page) {
              if (c) brutes.push(c);
              const x = c && versConnexion(c);
              if (x) connexions.push(x);
            }
          }
          const extranets = connexionsExtranet(brutes);
          // Booking.com : un établissement rattaché n'apparaît pas toujours dans
          // /v1/connect ; la liste qui fait foi est /v1/channels/booking/properties
          // (un établissement « unmapped » attend encore l'association des chambres).
          // Ceux de l'ancien mode « fournisseur de connectivité » y restent aussi :
          // ils sont marqués, pour ne pas passer pour une partie du compte Extranet.
          try {
            const proprietes = await client.get<unknown>('/v1/channels/booking/properties');
            const liste = Array.isArray(proprietes)
              ? proprietes
              : Array.isArray((proprietes as { data?: unknown[] })?.data)
                ? (proprietes as { data: unknown[] }).data
                : [];
            for (const brut of liste) {
              const b = (brut ?? {}) as Record<string, unknown>;
              const hotel = texte(b.hotelId);
              if (!hotel) continue;
              const statut = b.mappingStatus === 'unmapped' ? 'chambres' : b.active === false || texte(b.suspendedAt) ? 'inactive' : 'active';
              const deja = connexions.find((c) => c.fournisseur === 'booking' && (c.compte === hotel || c.id === texte(b.connectionId)));
              if (deja) {
                deja.statut = statut === 'active' ? deja.statut : statut;
                deja.compte = deja.compte ?? hotel;
              } else {
                connexions.push({
                  id: texte(b.connectionId) || `booking-${hotel}`,
                  fournisseur: 'booking',
                  statut,
                  compte: hotel,
                  nom: `Établissement ${hotel}`,
                  ...(texte(b.createdAt) ? { depuis: texte(b.createdAt) } : {}),
                  ...(extranetDe(b, extranets) ? {} : { ancienMode: true }),
                });
              }
            }
          } catch (e) {
            if (e instanceof BudgetEpuise) throw e;
            // Pas d'établissement Booking, ou lecture refusée : on garde /v1/connect seul.
          }
          cache.connexions = connexions;
        } catch (e) {
          if (!(e instanceof ErreurRepull && e.statut === 402)) throw e;
          cache.depassement = messageDepassement(e);
        }
        try {
          cache.annonces = await toutesLesAnnonces(client);
        } catch (e) {
          if (!(e instanceof ErreurRepull && e.statut === 402)) throw e;
          // Trop d'annonces actives pour l'offre : Repull refuse la liste. On garde la dernière connue.
          cache.depassement = messageDepassement(e);
        }
        cache.luLe = maintenant.toISOString();
      });
      await ecrireCache(ctx.base, cache);
    } catch (e) {
      if (e instanceof BudgetEpuise) {
        const etat = await lireEtat(ctx.base, maintenant, ctx.budgetMois ?? BUDGET_ERP_DEFAUT, ctx.quotaMois ?? QUOTA_MOIS_DEFAUT);
        avertissements.push(messageErreur(e, { budgetMois: etat.budgetMois, appelsMois: etat.appelsMois }) + ' Les informations affichées datent de la dernière lecture.');
      } else if (cache.luLe) {
        avertissements.push(`${messageErreur(e)} Les informations affichées datent de la dernière lecture.`);
      } else {
        throw e;
      }
    }
  }
  return composerEtat(ctx, cache, avertissements, maintenant);
}

async function composerEtat(ctx: ContexteConnexion, cache: CacheConnexions, avertissements: string[], maintenant: Date): Promise<EtatConnexions> {
  const [selection, logements, etat] = await Promise.all([
    lireSelection(ctx.base),
    ctx.base.lire<Logement>('logements'),
    lireEtat(ctx.base, maintenant, ctx.budgetMois ?? BUDGET_ERP_DEFAUT, ctx.quotaMois ?? QUOTA_MOIS_DEFAUT),
  ]);
  const parAnnonce = new Map<string, Logement>();
  for (const l of logements) if (l.repull?.id && !parAnnonce.has(l.repull.id)) parAnnonce.set(l.repull.id, l);
  const choisies = new Set(selection?.annonces ?? []);
  const annonces: AnnonceDecouverte[] = (cache.annonces ?? [])
    .filter((a) => a.statutRepull !== 'archived')
    .map((a) => {
      const l = parAnnonce.get(a.id);
      const importee = !!l && !l.repull?.horsSelection;
      return { ...a, selectionnee: choisies.has(a.id), importee, ...(l ? { logementId: l.id } : {}) };
    })
    .sort((a, b) => Number(b.selectionnee) - Number(a.selectionnee) || a.nom.localeCompare(b.nom, 'fr'));
  const { limite, source } = limiteLogements(cache.offre, ctx.limiteVariable);
  return {
    ok: true,
    fournisseurs: cache.fournisseurs ?? [],
    connexions: cache.connexions ?? [],
    annonces,
    selection: [...choisies],
    ...(selection?.majLe ? { selectionMajLe: selection.majLe } : {}),
    limite: cache.depassement?.limite ?? limite,
    ...(cache.offre ? { offre: cache.offre } : {}),
    sourceLimite: cache.depassement?.limite !== undefined ? 'repull' : source,
    ...(cache.depassement ? { depassement: cache.depassement } : {}),
    avertissements,
    ...(cache.luLe ? { luLe: cache.luLe } : {}),
    appels: { mois: etat.appelsMois, budget: etat.budgetMois },
  };
}

/**
 * Page de connexion Repull pour un fournisseur. Airbnb et Booking.com ont
 * leur propre parcours ; les autres passent par le sélecteur hébergé,
 * restreint à ce seul fournisseur (formulaires d'identifiants compris).
 */
export type AccesAirbnb = 'full_access' | 'messaging';

/** Fournisseur Repull « Booking.com Extranet login » : lecture + messagerie. */
export const BOOKING_EXTRANET = 'booking-extranet-login';

export async function demarrerConnexion(
  ctx: ContexteConnexion,
  fournisseur: string,
  urlRetour: string,
  accesAirbnb?: AccesAirbnb,
): Promise<ResultatConnecter> {
  const f = texte(fournisseur).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_.-]{0,40}$/.test(f)) throw new ErreurConnexion('Plateforme inconnue.');
  const cache = await lireCache(ctx.base);
  const r = await avecClient(ctx, async (client) => {
    // Seuls Airbnb (messagerie) et Booking.com (Extranet login) : un logiciel
    // de gestion ou un autre mode donnerait à la clé des droits d'écriture.
    if (f !== 'airbnb' && f !== 'booking') {
      throw new ErreurConnexion('Seuls Airbnb et Booking.com se connectent depuis l’ERP, en lecture et messagerie.');
    }
    // Airbnb : messagerie UNIQUEMENT, toujours. L'ERP ne doit jamais pouvoir
    // modifier le calendrier, les prix ni les annonces Airbnb ; ce niveau
    // d'accès ne l'autorise pas, et Repull masque alors ce choix sur sa page.
    if (f === 'airbnb') {
      void accesAirbnb;
      return client.post<{ url?: string; expiresAt?: string }>('/v1/connect/airbnb', {
        redirectUrl: urlRetour,
        locale: 'fr',
        accessType: 'messaging',
      });
    }
    // Booking.com : connexion « Extranet login » UNIQUEMENT. Repull y lit les
    // réservations, les messages et les avis, et répond aux voyageurs ; il
    // n'écrit jamais prix, disponibilités, chambres ni contenu. Rien ne change
    // dans l'Extranet : pas de fournisseur de connectivité à désigner, donc
    // Booking ne ferme pas le logement. (Le mode « partenaire de connectivité »
    // prend la main sur le calendrier : Booking ferme la vente jusqu'à recevoir
    // des prix. Il n'est plus jamais proposé.)
    return client.post<{ url?: string; expiresAt?: string }>('/v1/connect', {
      redirectUrl: urlRetour,
      allowedProviders: [BOOKING_EXTRANET],
      locale: 'fr',
      state: 'booking',
    });
  });
  if (!texte(r?.url) || !/^https:\/\//.test(texte(r.url))) throw new ErreurConnexion('Repull n’a pas renvoyé de page de connexion. Réessayez dans un instant.', 502);
  // Au retour, tout sera relu.
  delete cache.luLe;
  await ecrireCache(ctx.base, cache);
  return { ok: true, url: texte(r.url), ...(texte(r.expiresAt) ? { expireLe: texte(r.expiresAt) } : {}) };
}

/**
 * Enregistre le choix des logements : limite de l'offre vérifiée, annonces
 * non choisies désactivées chez Repull (puis les choisies activées), choix
 * gardé dans repull/selection, puis passage de synchronisation immédiat
 * pour que logements, réservations, conversations et avis arrivent.
 */
export async function enregistrerSelection(ctx: ContexteConnexion, idsBruts: unknown, auteur: string): Promise<ResultatSelection> {
  if (!Array.isArray(idsBruts)) throw new ErreurConnexion('Choix illisible : rechargez la page.');
  const ids = [...new Set(idsBruts.map((x) => texte(x)).filter(Boolean))];
  const maintenant = ctx.maintenant ?? (() => new Date());
  const cache = await lireCache(ctx.base);
  const avant = await lireSelection(ctx.base);

  // Limite de l'offre (vérifiée avant tout appel quand l'offre est connue).
  const verifierLimite = () => {
    const { limite } = limiteLogements(cache.offre, ctx.limiteVariable);
    const max = cache.depassement?.limite ?? limite;
    if (max !== null && ids.length > max) {
      const trop = ids.length - max;
      throw new ErreurConnexion(
        `${libelleOffre(cache.offre, max).replace(/^./, (c) => c.toUpperCase())} permet ${max} logement${max > 1 ? 's' : ''} : vous en avez choisi ${ids.length}. ` +
          `Retirez-en ${trop}, ou passez à l’offre Starter pour en ajouter d’autres.`,
      );
    }
    return max;
  };
  let limite = verifierLimite();

  await avecClient(ctx, async (client) => {
    if (!cache.offre || age(cache.offreLuLe, maintenant()) >= CACHE_OFFRE_MS) {
      await rafraichirOffre(client, cache, maintenant()).catch((e) => {
        if (e instanceof BudgetEpuise) throw e;
      });
      limite = verifierLimite();
    }
    let annonces: AnnonceBrute[];
    try {
      annonces = await toutesLesAnnonces(client);
    } catch (e) {
      if (!(e instanceof ErreurRepull && e.statut === 402) || !cache.annonces?.length) throw e;
      annonces = cache.annonces; // liste refusée tant que l'offre est dépassée : la dernière connue suffit
    }
    const parId = new Map(annonces.map((a) => [a.id, a]));
    const inconnues = ids.filter((id) => !parId.has(id) || parId.get(id)!.statutRepull === 'archived');
    if (inconnues.length) {
      throw new ErreurConnexion(
        `${inconnues.length > 1 ? 'Ces logements ne sont' : 'Ce logement n’est'} plus disponible${inconnues.length > 1 ? 's' : ''} chez Repull : rechargez la page, puis choisissez de nouveau.`,
      );
    }
    const choisis = new Set(ids);
    const aDesactiver = annonces.filter((a) => a.statutRepull === 'active' && !choisis.has(a.id)).map((a) => a.id);
    const aActiver = ids.filter((id) => parId.get(id)!.statutRepull !== 'active');
    // D'abord désactiver (toujours permis, même au-delà de la limite), puis activer.
    for (let i = 0; i < aDesactiver.length; i += 500) {
      await client.post('/v1/listings/status', { listingIds: aDesactiver.slice(i, i + 500), active: false });
    }
    if (aActiver.length) {
      try {
        await client.post('/v1/listings/status', { listingIds: aActiver, active: true });
      } catch (e) {
        if (e instanceof ErreurRepull && e.statut === 402) {
          const lim = Number(e.infos.limit);
          throw new ErreurConnexion(
            `Repull refuse d’activer ces logements : ${libelleOffre(cache.offre, Number.isFinite(lim) ? lim : limite)} est atteinte. Retirez un logement de votre choix, ou passez à l’offre Starter.`,
            402,
          );
        }
        throw e;
      }
    }
    const statuts = new Map<string, string>([...aDesactiver.map((id) => [id, 'inactive'] as const), ...aActiver.map((id) => [id, 'active'] as const)]);
    cache.annonces = annonces.map((a) => (statuts.has(a.id) ? { ...a, statutRepull: statuts.get(a.id)! } : a));
    delete cache.depassement;
  });

  const selection: SelectionRepull = { id: ID_SELECTION, annonces: ids, limite, majLe: horodatageParis(maintenant()), majPar: auteur };
  await ctx.base.ecrire(COLLECTION_ETAT, [selection]);
  await ecrireCache(ctx.base, cache);

  // Passage immédiat : complet si de nouveaux logements arrivent (toutes leurs réservations).
  const nouveaux = ids.some((id) => !(avant?.annonces ?? []).includes(id));
  const r = await lancer({
    cle: ctx.cle,
    base: ctx.base,
    declencheur: 'manuel',
    echeance: ctx.echeance,
    budgetMois: ctx.budgetMois,
    quotaMois: ctx.quotaMois,
    fetch: ctx.fetch,
    baseRepull: ctx.baseRepull,
    attendre: ctx.attendre,
    maintenant,
    forcer: { mode: nouveaux ? 'complet' : 'incremental', phases: PHASES_APRES_CHOIX },
  });

  // Totaux dans l'ERP pour les logements choisis (lecture de la base, sans appel Repull).
  const [logements, reservations, fils] = await Promise.all([
    ctx.base.lire<Logement>('logements'),
    ctx.base.lire<Reservation>('reservations'),
    ctx.base.lire<FilMessages>('filsMessages'),
  ]);
  const choisis = new Set(ids);
  const idsLogements = new Set(logements.filter((l) => l.repull?.id && choisis.has(l.repull.id)).map((l) => l.id));
  const bilan = r.bilan;
  return {
    ok: r.ok && r.statut === 'fait',
    selection: ids,
    logements: idsLogements.size,
    reservations: reservations.filter((x) => idsLogements.has(x.logementId) && x.statut !== 'annulee').length,
    conversations: fils.filter((f) => idsLogements.has(f.logementId)).length,
    partiel: r.statut !== 'fait' || !!(bilan && !bilan.complet),
    ...(r.message ? { message: r.message } : {}),
    ...(bilan ? { bilan } : {}),
  };
}

/**
 * Déconnecte un compte (Airbnb, Booking.com ; les autres logiciels se
 * déconnectent chez eux, Repull l'explique dans son message). Les annonces
 * désactivées par Repull sortent du choix.
 */
export async function deconnecter(ctx: ContexteConnexion, fournisseur: string, compte?: string): Promise<ResultatDeconnecter> {
  const f = texte(fournisseur).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_.-]{0,40}$/.test(f)) throw new ErreurConnexion('Plateforme inconnue.');
  const r = await avecClient(ctx, async (client) => {
    try {
      return await client.supprimer<{ listingsDeactivated?: unknown[] }>(`/v1/connect/${encodeURIComponent(f)}`, { accountId: texte(compte) || undefined });
    } catch (e) {
      if (e instanceof ErreurRepull && e.statut === 501) {
        throw new ErreurConnexion(
          `Ce logiciel se déconnecte depuis son propre site, pas depuis l’ERP.${e.correctif ? ` Repull explique : « ${e.correctif} »` : ''}`,
          501,
        );
      }
      if (e instanceof ErreurRepull && e.statut === 404) throw new ErreurConnexion('Ce compte n’est déjà plus connecté.', 404);
      throw e;
    }
  });
  const desactivees = (Array.isArray(r?.listingsDeactivated) ? r.listingsDeactivated : []).map(texte).filter(Boolean);
  const sel = await lireSelection(ctx.base);
  if (sel && desactivees.some((id) => sel.annonces.includes(id))) {
    const suivant: SelectionRepull = { ...sel, annonces: sel.annonces.filter((id) => !desactivees.includes(id)) };
    await ctx.base.ecrire(COLLECTION_ETAT, [suivant]);
  }
  const cache = await lireCache(ctx.base);
  delete cache.luLe;
  await ecrireCache(ctx.base, cache);
  return { ok: true, annoncesDesactivees: desactivees };
}

/* ============================================================ diagnostic */

export interface LigneDiagnostic {
  /** Ce qui a été demandé à Repull, en clair. */
  question: string;
  appel: string;
  ok: boolean;
  statut: number;
  /** Réponse résumée en français. */
  resume: string;
  /** Extrait brut (tronqué), pour l'équipe technique. */
  brut: string;
  /** L'appel a répondu, mais la réponse montre un problème (ex. données hors des logements choisis). */
  alerte?: boolean;
}

export interface ResultatDiagnostic {
  ok: true;
  lignes: LigneDiagnostic[];
  appels: number;
  le: string;
}

const tronquer = (v: unknown, n = 1500) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v, null, 1);
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

const liste = (v: unknown): Record<string, unknown>[] => {
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  const d = (v as { data?: unknown })?.data;
  return Array.isArray(d) ? (d as Record<string, unknown>[]) : [];
};

const nb = (n: number, un: string, plusieurs = `${un}s`) => `${n} ${n > 1 ? plusieurs : un}`;

/** « fournisseur de connectivité », espaces insécables : un guillemet n'est jamais seul en bout de ligne. */
const MODE_CONNECTIVITE = '«\u00a0fournisseur de connectivité\u00a0»';

/** « 25 oct. 2026 à 18:20 », à l'heure de Paris. */
function dateHeureParis(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const jour = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  const h = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(d);
  return `${jour} à ${h}`;
}

/**
 * Bloc « import » d'une connexion Extranet (/v1/connect) en clair : état, réservations
 * trouvées (étape « reservations »), logements vus. null : pas de bloc.
 */
function resumeImport(c: Record<string, unknown> | undefined): { texte: string; alerte: boolean } | null {
  const imp = c?.import;
  if (!imp || typeof imp !== 'object') return null;
  const i = imp as Record<string, unknown>;
  const chiffre = (v: unknown) => (texte(v) && Number.isFinite(Number(v)) ? Number(v) : undefined);
  const etape = (Array.isArray(i.stages) ? (i.stages as Record<string, unknown>[]) : []).find((e) => texte(e?.name) === 'reservations');
  const attendues = chiffre(etape?.expected);
  const lues = chiffre(etape?.done);
  const echecs = chiffre(etape?.failed) ?? 0;
  const logements = chiffre((i.counts as Record<string, unknown> | undefined)?.listings);
  const le = (v: unknown) => (texte(v) ? ` le ${dateHeureParis(texte(v))}` : '');
  const vus = logements === undefined ? [] : [nb(logements, 'logement vu', 'logements vus')];
  const phrase = (debut: string, details: string[]) => `${debut}${details.length ? ` : ${details.join(', ')}` : ''}.`;
  const statut = texte(i.status).toLowerCase();
  if (/fail|error/.test(`${statut} ${texte(i.outcome).toLowerCase()}`)) {
    return { texte: `L’import Booking a échoué${le(i.completedAt || i.lastActivityAt)}${texte(i.reason) ? ` (${texte(i.reason)})` : ''}.`, alerte: true };
  }
  if (statut === 'completed') {
    const trouvees = attendues ?? lues;
    return {
      texte: phrase(`Import Booking terminé${le(i.completedAt)}`, [
        ...(trouvees === undefined ? [] : [nb(trouvees, 'réservation trouvée', 'réservations trouvées')]),
        ...vus,
        ...(echecs ? [nb(echecs, 'réservation en échec', 'réservations en échec')] : []),
      ]),
      alerte: echecs > 0,
    };
  }
  return {
    texte: phrase(`Import Booking en cours${texte(i.startedAt) ? ` depuis${le(i.startedAt)}` : ''}`, [
      ...(attendues === undefined ? [] : [`${nb(lues ?? 0, 'réservation lue', 'réservations lues')} sur ${attendues}`]),
      ...vus,
    ]),
    alerte: false,
  };
}

/**
 * File Booking.com (/v1/channels/booking/reservations, format OTA de Booking) :
 * réservations en attente, et établissements refusés par Booking (avertissement
 * 497 « You do not have access to hotel:<id> », numéro vide s'il manque).
 */
function lireFileBooking(r: unknown): { reservations: number; refuses: string[] } {
  let ota = 0;
  const refuses = new Set<string>();
  const parcourir = (v: unknown, profondeur: number): void => {
    if (!v || typeof v !== 'object' || profondeur > 12) return;
    if (Array.isArray(v)) return v.forEach((x) => parcourir(x, profondeur + 1));
    const o = v as Record<string, unknown>;
    if (texte(o.Code) === '497') refuses.add(/hotel\s*:?\s*(\d+)/i.exec(texte(o.ShortText))?.[1] ?? '');
    for (const [k, x] of Object.entries(o)) {
      if (k === 'HotelReservation') ota += Array.isArray(x) ? x.length : 1;
      parcourir(x, profondeur + 1);
    }
  };
  parcourir(r, 0);
  const l = liste(r);
  const json = l.length ? l : Array.isArray((r as { reservations?: unknown[] })?.reservations) ? (r as { reservations: unknown[] }).reservations : [];
  return { reservations: ota || json.length, refuses: [...refuses] };
}

/**
 * Photographie de ce que Repull sait du compte : clé, connexions, Airbnb,
 * Booking.com (établissements et association des chambres), annonces.
 * Huit appels au plus, comptés dans le budget. Aucune donnée secrète renvoyée.
 */
export async function diagnostiquer(ctx: ContexteConnexion): Promise<ResultatDiagnostic> {
  const lignes: LigneDiagnostic[] = [];
  let appels = 0;
  // Logements choisis : une réservation reçue par Repull sur un autre logement n'entre pas dans l'ERP.
  // Seuls les éléments qui indiquent leur logement comptent (une conversation sans logement est
  // rattachée par sa réservation pendant la synchronisation).
  const choisis = new Set((await lireSelection(ctx.base).catch(() => null))?.annonces ?? []);
  const surChoisis = (l: Record<string, unknown>[]): { texte: string; alerte: boolean } => {
    const situes = l.filter((x) => texte(x.listingId));
    if (!situes.length || !choisis.size) return { texte: '', alerte: false };
    const n = situes.filter((x) => choisis.has(texte(x.listingId))).length;
    if (n === situes.length) return { texte: situes.length > 1 ? ' Toutes sont sur vos logements choisis.' : ' Elle est sur vos logements choisis.', alerte: false };
    const autres = situes.length - n;
    return {
      texte: n
        ? ` ${n} sur ${situes.length} ${n > 1 ? 'sont' : 'est'} sur vos logements choisis ; ${autres > 1 ? 'les autres n’entrent' : 'l’autre n’entre'} pas dans l’ERP (étape « Choisissez les logements à gérer », plus haut).`
        : ` ${situes.length > 1 ? 'Aucune n’est sur vos logements choisis : elles n’entrent' : 'Elle n’est pas sur vos logements choisis : elle n’entre'} pas dans l’ERP. Cochez ${situes.length > 1 ? 'leur logement' : 'son logement'} plus haut, à l’étape « Choisissez les logements à gérer ».`,
      alerte: true,
    };
  };
  await avecClient(ctx, async (client) => {
    /** Ajoute la ligne de l'appel ; renvoie la réponse (undefined en cas d'échec). */
    const essai = async (question: string, appel: string, resumer: (r: unknown) => string | { texte: string; alerte: boolean }, params: Record<string, string> = {}): Promise<unknown> => {
      try {
        const r = await client.get<unknown>(appel, params);
        const x = resumer(r);
        const resume = typeof x === 'string' ? { texte: x, alerte: false } : x;
        lignes.push({ question, appel, ok: true, statut: 200, resume: resume.texte, brut: tronquer(r), ...(resume.alerte ? { alerte: true } : {}) });
        return r;
      } catch (e) {
        if (e instanceof BudgetEpuise || e instanceof DelaiEcoule) throw e;
        const statut = e instanceof ErreurRepull ? e.statut : 0;
        lignes.push({ question, appel, ok: false, statut, resume: messageErreur(e), brut: tronquer(e instanceof ErreurRepull ? { code: e.code, fix: e.correctif, ...e.infos } : String(e)) });
        return undefined;
      }
    };
    await essai('La clé Repull est-elle acceptée ?', '/v1/health/auth', () => 'Oui, la clé Repull de Vercel est valide.');
    const connect = liste(
      await essai('Quelles connexions Repull voit-il ?', '/v1/connect', (r) => {
        const l = liste(r);
        return l.length ? `${l.length} connexion(s) : ${l.map((c) => `${texte(c.provider)} (${texte(c.status) || '?'})`).join(', ')}.` : 'Aucune connexion enregistrée chez Repull.';
      }),
    );
    const extranets = connexionsExtranet(connect);
    const extranet = connect.find((c) => estExtranet(c.provider) && c.import) ?? connect.find((c) => estExtranet(c.provider));
    // Établissements Booking de l'ancien mode « fournisseur de connectivité » (ligne des établissements).
    let ancienMode: string[] = [];
    await essai('Airbnb est-il connecté ?', '/v1/connect/airbnb', (r) => {
      const x = (r ?? {}) as Record<string, unknown>;
      const comptes = Array.isArray(x.accounts) ? (x.accounts as Record<string, unknown>[]) : [];
      if (!x.connected && !comptes.length) return 'Non : aucun compte Airbnb relié à Repull.';
      return `Oui : ${comptes.length || 1} compte(s) Airbnb${comptes.length ? ` (${comptes.map((c) => texte(c.name) || texte(c.externalAccountId)).join(', ')})` : ''}.`;
    });
    await essai('Booking.com : quels établissements ?', '/v1/channels/booking/properties', (r) => {
      const l = liste(r);
      if (!l.length) return 'Aucun établissement Booking.com chez Repull : l’étape « numéro d’établissement » sur la page Repull n’est pas terminée.';
      const anciens = new Set(l.filter((p) => !extranetDe(p, extranets)).map((p) => texte(p.hotelId)));
      ancienMode = [...anciens].filter(Boolean);
      const phrases = l
        .map((p) => {
          const n = Array.isArray(p.listings) ? p.listings.length : 0;
          const etat = p.mappingStatus === 'unmapped' ? 'chambres PAS encore associées' : `${n} chambre(s) associée(s)`;
          return `Établissement ${texte(p.hotelId)} : ${etat}${p.active === false ? ', inactif' : ''}${texte(p.suspensionReason) ? `, suspendu (${texte(p.suspensionReason)})` : ''}${anciens.has(texte(p.hotelId)) ? ', ancien mode' : ''}.`;
        })
        .join(' ');
      if (!ancienMode.length) return phrases;
      const compte = extranets.find((x) => x.compte)?.compte;
      return {
        texte:
          `${phrases} ${nb(ancienMode.length, 'établissement est encore rattaché', 'établissements sont encore rattachés')} à l’ancien mode ${MODE_CONNECTIVITE}, ` +
          `${extranets.length ? `pas à votre compte Extranet${compte ? ` ${compte}` : ''}` : 'et aucun compte Extranet n’est connecté'} : rien n’en arrive dans l’ERP.`,
        alerte: true,
      };
    });
    await essai('Quels logements Repull a-t-il ?', '/v1/listings', (r) => {
      const l = liste(r);
      return l.length ? `${l.length} logement(s) vu(s) (premiers) : ${l.slice(0, 5).map((a) => texte(a.name) || texte(a.title) || texte(a.id)).join(', ')}.` : 'Aucun logement chez Repull pour l’instant.';
    }, { status: 'all', limit: '10' });
    await essai('Repull a-t-il reçu des réservations ?', '/v1/reservations', (r) => {
      const l = liste(r);
      const total = Number((r as { pagination?: { total?: number } })?.pagination?.total ?? l.length);
      if (!l.length) {
        // Connexion Extranet : son import dit combien de réservations Booking lui a données.
        const imp = resumeImport(extranet);
        const anciens = ancienMode.length
          ? ` ${ancienMode.length > 1 ? 'Les établissements de l’ancien mode n’en font' : 'L’établissement de l’ancien mode n’en fait'} pas partie : rien n’en arrivera.`
          : '';
        return {
          texte: `${imp ? `Aucune réservation chez Repull. ${imp.texte}` : 'Aucune réservation chez Repull pour l’instant.'}${anciens}`,
          alerte: !!imp?.alerte || !!anciens,
        };
      }
      const choix = surChoisis(l.slice(0, 5));
      return {
        texte: `${total} réservation(s). Dernières : ${l
          .slice(0, 5)
          .map((x) => `${texte(x.guestName) || texte((x.guest as Record<string, unknown>)?.name) || 'voyageur'} (${texte(x.checkIn) || texte(x.check_in) || '?'}, ${texte(x.status) || '?'}, ${texte(x.platform) || '?'})`)
          .join(' ; ')}.${choix.texte}`,
        alerte: choix.alerte,
      };
    }, { limit: '5' });
    await essai('Booking.com : des réservations attendent-elles dans sa file ?', '/v1/channels/booking/reservations', (r) => {
      const { reservations, refuses } = lireFileBooking(r);
      const enAttente = reservations ? `${reservations} réservation(s) Booking en attente, pas encore récupérée(s) par Repull.` : '';
      if (refuses.length) {
        // 497 : cette file passe par l'ancien mode « fournisseur de connectivité » ; vide, elle ne prouve rien.
        const numeros = refuses.filter(Boolean);
        return {
          texte:
            `${enAttente ? `${enAttente} ` : ''}Booking refuse l’accès à ${nb(refuses.length, 'établissement')} dans l’ancien mode ${MODE_CONNECTIVITE}, que l’ERP n’utilise volontairement pas` +
            `${numeros.length ? ` : ${numeros.join(', ')}` : ''}. Cette file ne dit donc rien de vos réservations.`,
          alerte: true,
        };
      }
      return enAttente || 'La file Booking est vide : Booking n’a transmis aucune réservation à Repull.';
    }, { type: 'new' });
    await essai('Repull a-t-il reçu des conversations ?', '/v1/conversations', (r) => {
      const l = liste(r);
      if (!l.length) return 'Aucune conversation chez Repull pour l’instant.';
      const choix = surChoisis(l);
      return { texte: `${l.length} conversation(s) récentes (plateformes : ${[...new Set(l.map((c) => texte(c.platform) || '?'))].join(', ')}).${choix.texte}`, alerte: choix.alerte };
    }, { limit: '5' });
    appels = client.appels;
  });
  return { ok: true, lignes, appels, le: (ctx.maintenant ?? (() => new Date()))().toISOString() };
}
