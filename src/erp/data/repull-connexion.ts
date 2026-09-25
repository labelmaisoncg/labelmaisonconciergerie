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
          for await (const page of client.pages<Record<string, unknown>>('/v1/connect')) {
            for (const c of page) {
              const x = c && versConnexion(c);
              if (x) connexions.push(x);
            }
          }
          // Booking.com : un établissement rattaché n'apparaît pas toujours dans
          // /v1/connect ; la liste qui fait foi est /v1/channels/booking/properties
          // (un établissement « unmapped » attend encore l'association des chambres).
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

export async function demarrerConnexion(
  ctx: ContexteConnexion,
  fournisseur: string,
  urlRetour: string,
  accesAirbnb?: AccesAirbnb,
): Promise<ResultatConnecter> {
  const f = texte(fournisseur).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_.-]{0,40}$/.test(f)) throw new ErreurConnexion('Plateforme inconnue.');
  const maintenant = (ctx.maintenant ?? (() => new Date()))();
  const cache = await lireCache(ctx.base);
  const r = await avecClient(ctx, async (client) => {
    if (f !== 'airbnb' && f !== 'booking') {
      if (!cache.fournisseurs?.length) await rafraichirFournisseurs(client, cache, maintenant);
      const connu = cache.fournisseurs?.find((p) => p.id === f || plateformeCourte(p.id) === f);
      if (cache.fournisseurs?.length && !connu) throw new ErreurConnexion('Cette plateforme n’est pas proposée par Repull.');
      if (connu?.statut === 'coming-soon') throw new ErreurConnexion(`${connu.nom} n’est pas encore disponible chez Repull.`);
      return client.post<{ url?: string; expiresAt?: string }>('/v1/connect', {
        redirectUrl: urlRetour,
        allowedProviders: [connu?.id ?? f],
        locale: 'fr',
        state: f,
      });
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
    // Booking.com : la page hébergée ouverte par /v1/connect/booking répond
    // « Unsupported provider: booking » (constaté en production). On passe par
    // le sélecteur hébergé, restreint à l'identifiant EXACT du registre Repull
    // (« booking.com » ou autre), qui mène au parcours Booking de Repull.
    if (!cache.fournisseurs?.length) await rafraichirFournisseurs(client, cache, maintenant).catch(() => undefined);
    const idBooking = cache.fournisseurs?.find((p) => plateformeCourte(p.id) === 'booking')?.id;
    if (idBooking) {
      return client.post<{ url?: string; expiresAt?: string }>('/v1/connect', {
        redirectUrl: urlRetour,
        allowedProviders: [idBooking],
        locale: 'fr',
        state: 'booking',
      });
    }
    return client.post<{ url?: string; expiresAt?: string }>('/v1/connect/booking', { redirectUrl: urlRetour, locale: 'fr' });
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

/**
 * Photographie de ce que Repull sait du compte : clé, connexions, Airbnb,
 * Booking.com (établissements et association des chambres), annonces.
 * Sept appels au plus, comptés dans le budget. Aucune donnée secrète renvoyée.
 */
export async function diagnostiquer(ctx: ContexteConnexion): Promise<ResultatDiagnostic> {
  const lignes: LigneDiagnostic[] = [];
  let appels = 0;
  await avecClient(ctx, async (client) => {
    const essai = async (question: string, appel: string, resumer: (r: unknown) => string, params: Record<string, string> = {}) => {
      try {
        const r = await client.get<unknown>(appel, params);
        lignes.push({ question, appel, ok: true, statut: 200, resume: resumer(r), brut: tronquer(r) });
      } catch (e) {
        if (e instanceof BudgetEpuise || e instanceof DelaiEcoule) throw e;
        const statut = e instanceof ErreurRepull ? e.statut : 0;
        lignes.push({ question, appel, ok: false, statut, resume: messageErreur(e), brut: tronquer(e instanceof ErreurRepull ? { code: e.code, fix: e.correctif, ...e.infos } : String(e)) });
      }
    };
    await essai('La clé Repull est-elle acceptée ?', '/v1/health/auth', () => 'Oui, la clé Repull de Vercel est valide.');
    await essai('Quelles connexions Repull voit-il ?', '/v1/connect', (r) => {
      const l = liste(r);
      return l.length ? `${l.length} connexion(s) : ${l.map((c) => `${texte(c.provider)} (${texte(c.status) || '?'})`).join(', ')}.` : 'Aucune connexion enregistrée chez Repull.';
    });
    await essai('Airbnb est-il connecté ?', '/v1/connect/airbnb', (r) => {
      const x = (r ?? {}) as Record<string, unknown>;
      const comptes = Array.isArray(x.accounts) ? (x.accounts as Record<string, unknown>[]) : [];
      if (!x.connected && !comptes.length) return 'Non : aucun compte Airbnb relié à Repull.';
      return `Oui : ${comptes.length || 1} compte(s) Airbnb${comptes.length ? ` (${comptes.map((c) => texte(c.name) || texte(c.externalAccountId)).join(', ')})` : ''}.`;
    });
    await essai('Booking.com : quels établissements ?', '/v1/channels/booking/properties', (r) => {
      const l = liste(r);
      if (!l.length) return 'Aucun établissement Booking.com chez Repull : l’étape « numéro d’établissement » sur la page Repull n’est pas terminée.';
      return l
        .map((p) => {
          const n = Array.isArray(p.listings) ? p.listings.length : 0;
          const etat = p.mappingStatus === 'unmapped' ? 'chambres PAS encore associées' : `${n} chambre(s) associée(s)`;
          return `Établissement ${texte(p.hotelId)} : ${etat}${p.active === false ? ', inactif' : ''}${texte(p.suspensionReason) ? `, suspendu (${texte(p.suspensionReason)})` : ''}.`;
        })
        .join(' ');
    });
    await essai('Quels logements Repull a-t-il ?', '/v1/listings', (r) => {
      const l = liste(r);
      return l.length ? `${l.length} logement(s) vu(s) (premiers) : ${l.slice(0, 5).map((a) => texte(a.name) || texte(a.title) || texte(a.id)).join(', ')}.` : 'Aucun logement chez Repull pour l’instant.';
    }, { status: 'all', limit: '10' });
    await essai('Repull a-t-il reçu des réservations ?', '/v1/reservations', (r) => {
      const l = liste(r);
      const total = Number((r as { pagination?: { total?: number } })?.pagination?.total ?? l.length);
      if (!l.length) {
        return 'Aucune réservation chez Repull. Booking n’envoie en général que les réservations faites ou modifiées APRÈS le changement de fournisseur : les suivantes arriveront toutes seules.';
      }
      return `${total} réservation(s). Dernières : ${l
        .slice(0, 5)
        .map((x) => `${texte(x.guestName) || texte((x.guest as Record<string, unknown>)?.name) || 'voyageur'} (${texte(x.checkIn) || texte(x.check_in) || '?'}, ${texte(x.status) || '?'}, ${texte(x.platform) || '?'})`)
        .join(' ; ')}.`;
    }, { limit: '5' });
    await essai('Booking.com : des réservations attendent-elles dans sa file ?', '/v1/channels/booking/reservations', (r) => {
      const l = liste(r);
      const l2 = l.length ? l : Array.isArray((r as { reservations?: unknown[] })?.reservations) ? ((r as { reservations: Record<string, unknown>[] }).reservations) : [];
      return l2.length
        ? `${l2.length} réservation(s) Booking en attente, pas encore récupérée(s) par Repull.`
        : 'La file Booking est vide : Booking n’a transmis aucune réservation à Repull.';
    }, { type: 'new' });
    await essai('Repull a-t-il reçu des conversations ?', '/v1/conversations', (r) => {
      const l = liste(r);
      return l.length ? `${l.length} conversation(s) récentes (plateformes : ${[...new Set(l.map((c) => texte(c.platform) || '?'))].join(', ')}).` : 'Aucune conversation chez Repull pour l’instant.';
    }, { limit: '5' });
    appels = client.appels;
  });
  return { ok: true, lignes, appels, le: (ctx.maintenant ?? (() => new Date()))().toISOString() };
}

/* ============================================================ calendrier */

export interface ResultatCalendrier {
  ok: true;
  annonce: string;
  /** Seule plateforme écrite : jamais Airbnb. */
  plateforme: 'booking';
  ouvertes: number;
  gardeesFermees: number;
  du: string;
  au: string;
  reponse: string;
}

const JOUR_MS = 86_400_000;
const isoJour = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * Ouvre le calendrier d'une annonce à la réservation SUR BOOKING.COM
 * UNIQUEMENT : prix par nuit et durée minimale sur `jours` jours (731 au
 * plus). Écrit par /v1/channels/booking/availability, qui ne touche jamais
 * Airbnb ni aucune autre plateforme (le PUT /v1/availability générique
 * pousserait vers toutes les plateformes reliées).
 *   1. GET /v1/channels/booking/properties/{annonce}/rooms : chambre(s) et
 *      plan(s) tarifaire(s) Booking de l'annonce ;
 *   2. PUT type « rates » : prix + durée minimale sur les périodes ouvertes ;
 *   3. PUT type « availability » : 1 chambre à vendre, vente rouverte.
 * Les nuits de `bloquees` (réservations connues) ne sont pas envoyées :
 * elles restent fermées.
 */
export async function ouvrirCalendrier(
  ctx: ContexteConnexion,
  entree: { annonce: unknown; prix: unknown; minNuits: unknown; jours: unknown; bloquees: unknown },
): Promise<ResultatCalendrier> {
  const annonce = texte(entree.annonce);
  if (!/^\d{1,12}$/.test(annonce)) throw new ErreurConnexion('Logement inconnu : rechargez la page.');
  const prix = Math.round(Number(entree.prix) * 100) / 100;
  if (!Number.isFinite(prix) || prix < 10 || prix > 5000) throw new ErreurConnexion('Indiquez un prix par nuit entre 10 € et 5 000 €.');
  const minNuits = Math.floor(Number(entree.minNuits) || 1);
  if (minNuits < 1 || minNuits > 30) throw new ErreurConnexion('La durée minimale doit être comprise entre 1 et 30 nuits.');
  const jours = Math.min(731, Math.max(1, Math.floor(Number(entree.jours) || 365)));
  const bloquees = new Set(
    (Array.isArray(entree.bloquees) ? entree.bloquees : []).map((x) => texte(x)).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)),
  );
  const maintenant = (ctx.maintenant ?? (() => new Date()))();
  const depart = Date.parse(`${isoJour(maintenant.getTime())}T00:00:00Z`);
  const dates: string[] = [];
  for (let i = 0; i < jours; i++) {
    const j = isoJour(depart + i * JOUR_MS);
    if (!bloquees.has(j)) dates.push(j);
  }
  if (!dates.length) throw new ErreurConnexion('Aucune nuit à ouvrir sur cette période.');
  // Périodes continues de nuits ouvertes (bornes incluses, format Booking).
  const periodes: { start: string; end: string }[] = [];
  for (const j of dates) {
    const der = periodes[periodes.length - 1];
    if (der && Date.parse(`${j}T00:00:00Z`) - Date.parse(`${der.end}T00:00:00Z`) === JOUR_MS) der.end = j;
    else periodes.push({ start: j, end: j });
  }
  const r = await avecClient(ctx, async (client) => {
    const salles = await client.get<{ hotelId?: string; rooms?: { roomId?: string | null; rates?: { rateId?: string | null }[] }[] }>(
      `/v1/channels/booking/properties/${annonce}/rooms`,
    );
    const hotel = texte(salles?.hotelId);
    const couples: { roomId: string; rateId: string }[] = [];
    for (const salle of salles?.rooms ?? []) {
      for (const tarif of salle?.rates ?? []) {
        if (texte(salle.roomId) && texte(tarif?.rateId)) couples.push({ roomId: texte(salle.roomId), rateId: texte(tarif.rateId) });
      }
    }
    if (!hotel || !couples.length) {
      throw new ErreurConnexion('Ce logement n’est pas relié à Booking.com (chambre ou plan tarifaire introuvable) : rien n’a été envoyé.');
    }
    const prixEnvoyes = await client.requete<unknown>('PUT', '/v1/channels/booking/availability', {}, {
      type: 'rates',
      property_id: hotel,
      verify: false,
      updates: couples.flatMap((c) =>
        periodes.map((d) => ({ ...c, dateRange: d, price: prix, currency: 'EUR', restrictions: { minStay: minNuits } })),
      ),
    });
    const ouverture = await client.requete<unknown>('PUT', '/v1/channels/booking/availability', {}, {
      type: 'availability',
      property_id: hotel,
      updates: couples.flatMap((c) => periodes.map((d) => ({ ...c, dateRange: d, availableRooms: 1, closed: false }))),
    });
    return { hotel, prix: prixEnvoyes, ouverture };
  });
  return {
    ok: true,
    annonce,
    plateforme: 'booking',
    ouvertes: dates.length,
    gardeesFermees: jours - dates.length,
    du: dates[0],
    au: dates[dates.length - 1],
    reponse: JSON.stringify(r ?? {}).slice(0, 1500),
  };
}
