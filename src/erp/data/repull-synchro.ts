/**
 * Synchronisation Repull → ERP, côté serveur (fonctions Vercel
 * api/erp-repull-sync.ts et api/erp-repull-webhook.ts).
 *
 * Tout ce que les propriétaires ont connecté dans Repull (Airbnb,
 * Booking.com...) est recopié dans erp.enregistrements : annonces →
 * logements, réservations, avis (note du voyageur), conversations et
 * messages → fils de la messagerie. Les onglets ouverts de l'ERP reçoivent
 * les lignes en direct (Supabase Realtime).
 *
 * Principes :
 * - idempotent : un élément n'est écrit que s'il a réellement changé
 *   (comparaison canonique), relancer ne fait rien ;
 * - fusion sans écrasement (voir repull.ts) : l'existant est relu d'abord ;
 * - jamais de suppression ;
 * - borné dans le temps (échéance) : au-delà, on s'arrête proprement après
 *   avoir écrit ce qui est fait, le passage suivant reprend (bilan.complet
 *   = false) ;
 * - économe en appels : l'offre gratuite de Repull compte 1 000 appels par
 *   mois pour tout le compte (agent IA compris). L'ERP s'en réserve une part
 *   (REPULL_BUDGET_ERP, 400 par défaut), comptée appel par appel dans l'état
 *   de synchronisation ; une fois la part épuisée, plus aucun appel jusqu'au
 *   mois suivant. Passage incrémental (updated_since), pages de 100, messages
 *   relus seulement pour les conversations dont le dernier message a bougé,
 *   annonces une fois par jour, avis et pays des voyageurs une fois par
 *   semaine ;
 * - réseau injecté (fetch) : l'auto-contrôle (verifier-repull.ts) simule
 *   Repull et PostgREST en mémoire.
 *
 * Écriture : PostgREST du projet Supabase de Label Maison, avec la session du
 * compte d'équipe (même mot de passe que ERP_PASSWORD, comme middleware.ts).
 * Aucune clé service_role : les règles RLS s'appliquent comme pour l'équipe.
 *
 * Imports relatifs avec « .js » : ce fichier tourne aussi sous Node (ESM) dans
 * les fonctions Vercel, qui exigent l'extension.
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js';
import {
  ACTION_JOURNAL_REPULL,
  AUTEUR_REPULL,
  ID_PROPRIETAIRE_A_RENSEIGNER,
  appliquerAvis,
  canalReservation,
  statutLogement,
  canonique,
  dateParis,
  horodatageParis,
  idRepull,
  identiques,
  instant,
  proprietaireARenseigner,
  versFil,
  versLogement,
  versReservation,
  type RepullConversation,
  type RepullGuest,
  type RepullListing,
  type RepullMessage,
  type RepullPage,
  type RepullReservation,
  type RepullReview,
} from './repull.js';
import type { FilMessages, Id, Journal, Logement, Reservation } from './types';

type Fetch = typeof fetch;

export const BASE_REPULL = 'https://api.repull.dev';
/** Date de départ d'un passage complet (updated_since : ordre stable, reprise possible). */
const DEPUIS_TOUJOURS = '2000-01-01T00:00:00Z';
/** Marge gardée avant l'échéance pour écrire et répondre. */
const MARGE_MS = 6_000;
const TAILLE_PAGE = 100;
const LOT_ECRITURE = 200;
const DELAI_REQUETE_MS = 15_000;

/* ================================================================ Repull */

/** Erreur Repull, avec un message en français prêt à afficher. */
export class ErreurRepull extends Error {
  constructor(
    message: string,
    readonly statut: number,
    readonly code?: string,
    /** Marche à suivre donnée par Repull (error.fix), en anglais. */
    readonly correctif?: string,
    /** Champs complémentaires de l'erreur (limit, active_listings, valid_values...). */
    readonly infos: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** Le temps imparti est écoulé : le passage s'arrête, le suivant reprendra. */
export class DelaiEcoule extends Error {
  constructor() {
    super('Temps imparti écoulé');
  }
}

/** La part mensuelle d'appels Repull de l'ERP est atteinte : plus aucun appel. */
export class BudgetEpuise extends Error {
  constructor() {
    super('Part mensuelle des appels Repull de l’ERP épuisée.');
  }
}

interface EnveloppeErreur {
  error?: { code?: string; message?: string; fix?: string; retry_after?: number; scope?: string; resetsAt?: string; tier?: string } & Record<string, unknown>;
}

function messageRepull(statut: number, code: string | undefined, brut: string | undefined): string {
  if (statut === 401) return 'Clé Repull refusée : vérifiez REPULL_API_KEY dans Vercel (Settings → Environment Variables), puis redéployez.';
  if (statut === 402) return 'Forfait Repull dépassé (nombre d’annonces actives) : passez à l’offre supérieure sur repull.dev ou désactivez des annonces.';
  if (statut === 429 && code === 'daily_limit_exceeded') return 'Quota quotidien du compte Repull atteint : la synchronisation reprendra demain.';
  if (statut === 429 && code === 'quota') return 'Quota mensuel du compte Repull atteint (offre gratuite : 1 000 appels) : la synchronisation reprendra le mois prochain, ou passez à l’offre supérieure sur repull.dev.';
  if (statut === 429) return 'Repull limite le nombre d’appels : nouvel essai dans une minute.';
  if (statut === 403 && code === 'listing_inactive') return 'Annonce désactivée chez Repull.';
  if (statut === 403) return 'Accès refusé par Repull pour cette ressource.';
  if (statut === 404) return 'Élément introuvable chez Repull.';
  if (statut === 0) return 'Repull injoignable (réseau).';
  return `Erreur Repull ${statut}${brut ? ` : ${brut}` : ''}.`;
}

export interface OptionsClientRepull {
  cle: string;
  base?: string;
  fetch?: Fetch;
  /** Instant (ms) au-delà duquel on n'attend plus (429, nouvel essai). */
  echeance: number;
  /** Nombre maximal d'appels pour ce passage (reste de la part mensuelle). */
  budget?: number;
  attendre?: (ms: number) => Promise<void>;
}

/**
 * Client minimal de l'API Repull : pagination par curseur, 429 et erreurs
 * passagères. Chaque requête envoyée est comptée (`appels`) : c'est ce
 * nombre qui s'impute sur la part mensuelle de l'ERP. Nouveaux essais
 * limités à un seul, pour ne pas brûler le quota.
 */
export class ClientRepull {
  private readonly f: Fetch;
  private readonly base: string;
  private readonly attendre: (ms: number) => Promise<void>;
  appels = 0;

  constructor(private readonly o: OptionsClientRepull) {
    this.f = o.fetch ?? fetch;
    this.base = (o.base ?? BASE_REPULL).replace(/\/+$/, '');
    this.attendre = o.attendre ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  get echeance(): number {
    return this.o.echeance;
  }

  /** Appels encore permis pour ce passage. */
  get restant(): number {
    return this.o.budget === undefined ? Infinity : Math.max(0, this.o.budget - this.appels);
  }

  async get<T>(chemin: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    return this.requete<T>('GET', chemin, params);
  }

  /** POST JSON (connexions, activation des annonces, envoi d'un message). */
  async post<T>(
    chemin: string,
    corps: unknown,
    params: Record<string, string | number | boolean | undefined> = {},
    entetes: Record<string, string> = {},
  ): Promise<T> {
    return this.requete<T>('POST', chemin, params, corps, entetes);
  }

  async supprimer<T>(chemin: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    return this.requete<T>('DELETE', chemin, params);
  }

  /**
   * Une requête comptée ; un seul nouvel essai (débit, réseau, 5xx). Un envoi
   * qui crée quelque chose (message au voyageur) porte un en-tête
   * Idempotency-Key : le nouvel essai ne peut alors rien créer deux fois.
   */
  async requete<T>(
    methode: 'GET' | 'POST' | 'DELETE' | 'PATCH',
    chemin: string,
    params: Record<string, string | number | boolean | undefined> = {},
    envoi?: unknown,
    entetes: Record<string, string> = {},
  ): Promise<T> {
    const url = new URL(this.base + chemin);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    for (let essai = 1; ; essai++) {
      if (Date.now() > this.o.echeance) throw new DelaiEcoule();
      if (this.restant <= 0) throw new BudgetEpuise();
      let r: Response;
      const abandon = new AbortController();
      const minuterie = setTimeout(() => abandon.abort(), DELAI_REQUETE_MS);
      try {
        this.appels++;
        r = await this.f(url.toString(), {
          method: methode,
          headers: {
            Authorization: `Bearer ${this.o.cle}`,
            Accept: 'application/json',
            ...(envoi !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...entetes,
          },
          ...(envoi !== undefined ? { body: JSON.stringify(envoi) } : {}),
          signal: abandon.signal,
        });
      } catch {
        clearTimeout(minuterie);
        if (essai < 2) {
          await this.patienter(1500);
          continue;
        }
        throw new ErreurRepull(messageRepull(0, undefined, undefined), 0);
      }
      clearTimeout(minuterie);
      if (r.ok) return (r.status === 204 ? {} : await r.json().catch(() => ({}))) as T;
      const corps = (await r.json().catch(() => ({}))) as EnveloppeErreur;
      let code = corps.error?.code;
      // 429 de quota (mois ou jour : champs tier / scope / resetsAt) : attendre ne sert à rien.
      const quota = r.status === 429 && (code === 'daily_limit_exceeded' || !!corps.error?.scope || !!corps.error?.resetsAt || !!corps.error?.tier);
      if (quota && code !== 'daily_limit_exceeded') code = 'quota';
      // 429 de débit (fenêtre glissante) : attendre ce que Repull demande, un seul nouvel essai.
      if (r.status === 429 && !quota && essai < 2) {
        const s = Number(corps.error?.retry_after ?? r.headers.get('retry-after') ?? 2);
        await this.patienter((Number.isFinite(s) && s > 0 ? s : 2) * 1000 + Math.floor(Math.random() * 250));
        continue;
      }
      if (r.status >= 500 && essai < 2) {
        await this.patienter(1500);
        continue;
      }
      const { code: _c, message: brut, fix, ...infos } = corps.error ?? {};
      throw new ErreurRepull(messageRepull(r.status, code, brut), r.status, code, typeof fix === 'string' ? fix : undefined, infos);
    }
  }

  private async patienter(ms: number) {
    if (Date.now() + ms > this.o.echeance) throw new DelaiEcoule();
    await this.attendre(ms);
  }

  /** Parcourt toutes les pages (curseur `pagination.nextCursor`). */
  async *pages<T>(chemin: string, params: Record<string, string | number | boolean | undefined> = {}): AsyncGenerator<T[]> {
    let curseur: string | undefined;
    for (let n = 0; n < 10_000; n++) {
      const page = await this.get<RepullPage<T>>(chemin, { limit: TAILLE_PAGE, ...params, cursor: curseur });
      yield Array.isArray(page?.data) ? page.data : [];
      const suivant = page?.pagination?.nextCursor;
      if (!page?.pagination?.hasMore || !suivant || suivant === curseur) return;
      curseur = suivant;
    }
  }
}

/* ============================================================ base ERP */

export interface OptionsBase {
  url?: string;
  cleAnon?: string;
  fetch?: Fetch;
  /** Jeton d'accès du compte d'équipe ; `renouveler` : l'ancien a été refusé. */
  jeton: (renouveler?: boolean) => Promise<string>;
}

/** Accès à erp.enregistrements par PostgREST (schéma erp). */
export class BaseErp {
  private readonly f: Fetch;
  private readonly url: string;
  private readonly cleAnon: string;
  ecritures = 0;

  constructor(private readonly o: OptionsBase) {
    this.f = o.fetch ?? fetch;
    this.url = (o.url ?? SUPABASE_URL).replace(/\/+$/, '');
    this.cleAnon = o.cleAnon ?? SUPABASE_ANON_KEY;
  }

  private async requete(chemin: string, init: RequestInit & { entetes?: Record<string, string> }): Promise<Response> {
    for (let essai = 1; ; essai++) {
      const jeton = await this.o.jeton(essai > 1);
      const r = await this.f(`${this.url}/rest/v1/${chemin}`, {
        ...init,
        headers: { apikey: this.cleAnon, Authorization: `Bearer ${jeton}`, ...init.entetes },
      });
      if (r.status === 401 && essai === 1) continue;
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        if (r.status === 401 || r.status === 403) throw new Error(`Écriture refusée par la base (${r.status}) : le compte d’équipe est-il bien membre gérant ? ${t.slice(0, 200)}`);
        if (/PGRST106|PGRST205|schema/i.test(t)) throw new Error('Base de l’ERP non installée (supabase/erp-installation.sql).');
        throw new Error(`Base de l’ERP : erreur ${r.status} ${t.slice(0, 200)}`);
      }
      return r;
    }
  }

  /** Éléments d'une collection (tous, ou seulement ces ids). */
  async lire<T>(collection: string, ids?: string[]): Promise<T[]> {
    const res: T[] = [];
    const filtres = ids ? decouper(ids, 80).map((l) => `&id=in.(${l.map((i) => `"${i.replace(/"/g, '')}"`).join(',')})`) : [''];
    for (const filtre of filtres) {
      for (let depart = 0; ; depart += 1000) {
        const r = await this.requete(
          `enregistrements?select=id,donnees&collection=eq.${encodeURIComponent(collection)}${filtre}&order=id&limit=1000&offset=${depart}`,
          { method: 'GET', entetes: { 'Accept-Profile': 'erp' } },
        );
        const lignes = (await r.json()) as { id: string; donnees: unknown }[];
        for (const l of lignes) {
          if (l?.donnees && typeof l.donnees === 'object' && !Array.isArray(l.donnees)) res.push({ ...(l.donnees as object), id: l.id } as T);
        }
        if (lignes.length < 1000) break;
      }
    }
    return res;
  }

  /** Upsert par lots (collection + id), fusion côté base. */
  async ecrire(collection: string, elements: { id: string }[]): Promise<void> {
    for (const lot of decouper(elements, LOT_ECRITURE)) {
      await this.requete('enregistrements?on_conflict=collection,id', {
        method: 'POST',
        entetes: {
          'Content-Type': 'application/json',
          'Content-Profile': 'erp',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(lot.map((e) => ({ collection, id: e.id, donnees: e, maj_par: `${AUTEUR_REPULL}#serveur` }))),
      });
      this.ecritures += lot.length;
    }
  }
}

function decouper<T>(liste: T[], taille: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) res.push(liste.slice(i, i + taille));
  return res;
}

/* ============================================== comptes (serveur uniquement) */

export interface OptionsAuth {
  url?: string;
  cleAnon?: string;
  fetch?: Fetch;
}

/**
 * Session du compte d'équipe (grant « password », comme sessionErp de
 * middleware.ts). Gardée en mémoire tant que l'instance vit, pour ne pas
 * rouvrir une session à chaque webhook.
 */
export function fabriqueJetonEquipe(email: string, motDePasse: string, o: OptionsAuth = {}) {
  let cache: { jeton: string; expire: number } | null = null;
  return async (renouveler = false): Promise<string> => {
    if (!renouveler && cache && cache.expire > Date.now() + 60_000) return cache.jeton;
    const r = await (o.fetch ?? fetch)(`${(o.url ?? SUPABASE_URL).replace(/\/+$/, '')}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: o.cleAnon ?? SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: motDePasse }),
    });
    const d = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
    if (!r.ok || !d.access_token) {
      cache = null;
      throw new Error(
        `Connexion du compte d’équipe (${email}) refusée par Supabase (${r.status}) : son mot de passe doit être égal à ERP_PASSWORD.`,
      );
    }
    cache = { jeton: d.access_token, expire: Date.now() + (d.expires_in ?? 3600) * 1000 };
    return d.access_token;
  };
}

export type ResultatMembre = { ok: true; email: string; role: string } | { ok: false; statut: number; erreur: string };

/**
 * Vérifie un jeton de session de l'ERP : compte Supabase valide ET membre
 * de l'équipe autorisé à écrire (gérant ou opérations, table erp.membres).
 */
export async function verifierMembre(jeton: string, o: OptionsAuth = {}): Promise<ResultatMembre> {
  const f = o.fetch ?? fetch;
  const url = (o.url ?? SUPABASE_URL).replace(/\/+$/, '');
  const cle = o.cleAnon ?? SUPABASE_ANON_KEY;
  const u = await f(`${url}/auth/v1/user`, { headers: { apikey: cle, Authorization: `Bearer ${jeton}` } }).catch(() => null);
  if (!u || !u.ok) return { ok: false, statut: 401, erreur: 'Session expirée : reconnectez-vous à l’ERP.' };
  const moi = (await u.json().catch(() => ({}))) as { email?: string };
  const email = (moi.email ?? '').trim().toLowerCase();
  if (!email) return { ok: false, statut: 401, erreur: 'Session sans adresse e-mail.' };
  const m = await f(`${url}/rest/v1/membres?select=email,role`, {
    headers: { apikey: cle, Authorization: `Bearer ${jeton}`, 'Accept-Profile': 'erp' },
  }).catch(() => null);
  const lignes = m && m.ok ? ((await m.json().catch(() => [])) as { email?: string; role?: string }[]) : [];
  const ligne = lignes.find((l) => (l.email ?? '').trim().toLowerCase() === email);
  if (!ligne) return { ok: false, statut: 403, erreur: 'Ce compte n’est pas membre de l’équipe (erp.membres).' };
  if (ligne.role !== 'gerant' && ligne.role !== 'operations') {
    return { ok: false, statut: 403, erreur: 'Seuls les gérants et les opérations peuvent lancer la synchronisation.' };
  }
  return { ok: true, email, role: ligne.role };
}

/* ========================================================= synchronisation */

export type ModeRepull = 'complet' | 'incremental';
/** agent : relevé léger des conversations par l'agent IA (agent-messagerie.ts). */
export type DeclencheurRepull = 'cron' | 'manuel' | 'webhook' | 'agent';

export interface Compteur {
  crees: number;
  modifies: number;
}

export interface BilanRepull {
  mode: ModeRepull;
  declencheur: DeclencheurRepull;
  debut: string;
  fin?: string;
  logements: Compteur;
  reservations: Compteur;
  fils: Compteur;
  /** Messages nouvellement importés. */
  messages: number;
  /** Réservations dont la note ou le commentaire voyageur a changé. */
  avis: number;
  proprietaireCree: boolean;
  ignores: {
    reservationsEnAttente: number;
    reservationsSansLogement: number;
    filsSansLogement: number;
    avisSansReservation: number;
    /** Réservations, conversations et avis des logements non choisis (page Connexions). */
    horsSelection?: number;
  };
  /** Logements retirés du choix, mis en pause dans l'ERP (jamais supprimés). */
  misEnPause?: number;
  /** Phases menées à leur terme (annonces, reservations, avis, conversations, pays). */
  phases: PhaseRepull[];
  /** Faux : temps ou part d'appels atteint, un nouveau passage terminera. */
  complet: boolean;
  erreurs: string[];
  /** Appels Repull de ce passage (imputés sur la part mensuelle de l'ERP). */
  appelsRepull: number;
  ecritures: number;
}

export type PhaseRepull = 'annonces' | 'reservations' | 'avis' | 'conversations' | 'pays';

/** Une collection lue une fois, puis comparée à ce qui est stocké pour n'écrire que les changements. */
class Registre<T extends { id: string }> {
  readonly elements = new Map<string, T>();
  private readonly stocke = new Map<string, string>();

  constructor(
    readonly collection: string,
    lus: T[] = [],
  ) {
    for (const e of lus) {
      this.elements.set(e.id, e);
      this.stocke.set(e.id, canonique(e));
    }
  }

  get(id: string | undefined): T | undefined {
    return id ? this.elements.get(id) : undefined;
  }

  poser(e: T) {
    this.elements.set(e.id, e);
  }

  /** Éléments à écrire (nouveaux ou modifiés depuis la lecture ou la dernière écriture). */
  aEcrire(): { element: T; nouveau: boolean }[] {
    const res: { element: T; nouveau: boolean }[] = [];
    for (const e of this.elements.values()) {
      const avant = this.stocke.get(e.id);
      if (avant === undefined || avant !== canonique(e)) res.push({ element: e, nouveau: avant === undefined });
    }
    return res;
  }

  async ecrire(base: BaseErp, compteur?: Compteur): Promise<void> {
    const liste = this.aEcrire();
    if (!liste.length) return;
    await base.ecrire(
      this.collection,
      liste.map((x) => x.element),
    );
    for (const { element, nouveau } of liste) {
      this.stocke.set(element.id, canonique(element));
      if (compteur) compteur[nouveau ? 'crees' : 'modifies']++;
    }
  }
}

export interface OptionsSynchroRepull {
  repull: ClientRepull;
  base: BaseErp;
  mode: ModeRepull;
  declencheur: DeclencheurRepull;
  maintenant?: () => Date;
  /** Phases à mener (toutes par défaut) : l'économie d'appels saute les moins urgentes. */
  phases?: PhaseRepull[];
  /**
   * Annonces Repull choisies sur la page Connexions : seules celles-ci (et
   * leurs réservations, conversations, avis) entrent dans l'ERP. Absent :
   * pas de filtre (lancer() n'appelle jamais la session sans choix).
   */
  selection?: ReadonlySet<string>;
}

/** Correspondance id Repull → id ERP, en préférant un élément relié à la main (id non « repull-... »). */
function indexer<T extends { id: string; repull?: { id: string } }>(elements: Iterable<T>): Map<string, Id> {
  const m = new Map<string, Id>();
  for (const e of elements) {
    const r = e.repull?.id;
    if (!r) continue;
    const deja = m.get(r);
    if (!deja || (deja === idRepull(r) && e.id !== deja)) m.set(r, e.id);
  }
  return m;
}

/**
 * Une passe de synchronisation. Les collections sont lues à la demande, une
 * seule fois ; chaque phase écrit ce qu'elle a changé avant la suivante.
 */
export class SessionRepull {
  readonly bilan: BilanRepull;
  private readonly repull: ClientRepull;
  private readonly base: BaseErp;
  private readonly maintenant: () => Date;
  private logements?: Registre<Logement>;
  private reservations?: Registre<Reservation>;
  private fils?: Registre<FilMessages>;
  private logementParRepull = new Map<string, Id>();
  private reservationParRepull = new Map<string, Id>();
  private reservationParCode = new Map<string, Id>();
  private proprietaireVerifie = false;
  /** Annonces inconnues déjà demandées à Repull pendant ce passage. */
  private annoncesDemandees = new Set<string>();

  constructor(private readonly o: OptionsSynchroRepull) {
    this.repull = o.repull;
    this.base = o.base;
    this.maintenant = o.maintenant ?? (() => new Date());
    this.bilan = {
      mode: o.mode,
      declencheur: o.declencheur,
      debut: horodatageParis(this.maintenant()),
      logements: { crees: 0, modifies: 0 },
      reservations: { crees: 0, modifies: 0 },
      fils: { crees: 0, modifies: 0 },
      messages: 0,
      avis: 0,
      proprietaireCree: false,
      ignores: { reservationsEnAttente: 0, reservationsSansLogement: 0, filsSansLogement: 0, avisSansReservation: 0, horsSelection: 0 },
      misEnPause: 0,
      phases: [],
      complet: true,
      erreurs: [],
      appelsRepull: 0,
      ecritures: 0,
    };
  }

  private get aujourdhui() {
    return dateParis(this.maintenant());
  }

  /** L'annonce fait-elle partie des logements choisis ? (sans id : on ne sait pas, on laisse passer) */
  private retenue(idAnnonce: unknown): boolean {
    const sel = this.o.selection;
    if (!sel || idAnnonce === undefined || idAnnonce === null || idAnnonce === '') return true;
    return sel.has(String(idAnnonce));
  }

  /** Annonce Repull d'un logement de l'ERP (pour filtrer conversations et avis). */
  private annonceDuLogement(logementId: Id | undefined): string | undefined {
    return logementId ? this.logements?.get(logementId)?.repull?.id : undefined;
  }

  private horsSelection() {
    this.bilan.ignores.horsSelection = (this.bilan.ignores.horsSelection ?? 0) + 1;
  }

  /**
   * Logement retiré du choix : mis en pause, jamais supprimé (réservations,
   * historique et saisies de l'équipe restent). Un logement « sorti » le reste.
   */
  private async mettreHorsSelection(idAnnonce: string, statutRepull?: string): Promise<void> {
    const logements = await this.chargerLogements();
    const existant = logements.get(this.logementParRepull.get(idAnnonce));
    if (!existant || !existant.repull) return;
    const statut: Logement['statut'] = existant.statut === 'sorti' ? 'sorti' : 'pause';
    if (existant.repull.horsSelection && existant.statut === statut) return;
    logements.poser({ ...existant, statut, repull: { ...existant.repull, ...(statutRepull ? { statut: statutRepull } : {}), horsSelection: true } });
    this.bilan.misEnPause = (this.bilan.misEnPause ?? 0) + 1;
  }

  /** Reste-t-il assez de temps pour continuer ? Sinon, le passage est marqué partiel. */
  private tempsRestant(besoinMs = MARGE_MS): boolean {
    if (this.repull.echeance - Date.now() > besoinMs) return true;
    this.bilan.complet = false;
    return false;
  }

  /* ---------------------------------------------------------- chargement */

  private async chargerLogements(): Promise<Registre<Logement>> {
    if (!this.logements) {
      this.logements = new Registre('logements', await this.base.lire<Logement>('logements'));
      this.logementParRepull = indexer(this.logements.elements.values());
    }
    return this.logements;
  }

  private async chargerReservations(): Promise<Registre<Reservation>> {
    if (!this.reservations) {
      this.reservations = new Registre('reservations', await this.base.lire<Reservation>('reservations'));
      this.reservationParRepull = indexer(this.reservations.elements.values());
      for (const r of this.reservations.elements.values()) if (r.repull?.code) this.reservationParCode.set(r.repull.code, r.id);
    }
    return this.reservations;
  }

  private async chargerFils(): Promise<Registre<FilMessages>> {
    if (!this.fils) this.fils = new Registre('filsMessages', await this.base.lire<FilMessages>('filsMessages'));
    return this.fils;
  }

  /** Fiche « Propriétaire à renseigner », créée une seule fois, jamais modifiée ensuite. */
  private async assurerProprietaire(): Promise<void> {
    if (this.proprietaireVerifie) return;
    const deja = await this.base.lire('proprietaires', [ID_PROPRIETAIRE_A_RENSEIGNER]);
    if (!deja.length) {
      await this.base.ecrire('proprietaires', [proprietaireARenseigner(this.aujourdhui)]);
      this.bilan.proprietaireCree = true;
    }
    this.proprietaireVerifie = true;
  }

  /* ------------------------------------------------------------ annonces */

  /** Une annonce Repull → logement (en mémoire ; écrit par ecrireLogements). */
  private async poserAnnonce(l: RepullListing, avecEquipements: boolean): Promise<Id> {
    const logements = await this.chargerLogements();
    const id = this.logementParRepull.get(String(l.id)) ?? idRepull(l.id);
    const existant = logements.get(id);
    let annonce = l;
    // Équipements : un appel par annonce, seulement à la création (économie d'appels).
    if (avecEquipements && !existant && l.status === 'active' && !l.amenities && this.repull.restant > 20 && this.tempsRestant(20_000)) {
      try {
        const detail = await this.repull.get<RepullListing>(`/v1/listings/${encodeURIComponent(l.id)}`, { include: 'amenities' });
        if (Array.isArray(detail?.amenities)) annonce = { ...l, amenities: detail.amenities };
      } catch (e) {
        if (e instanceof DelaiEcoule) throw e;
        /* équipements facultatifs : on continue sans */
      }
    }
    const logement = versLogement(annonce, existant, { id, aujourdhui: this.aujourdhui, proprietaireId: ID_PROPRIETAIRE_A_RENSEIGNER });
    // De nouveau choisi après avoir été retiré : le statut suit de nouveau l'annonce.
    if (existant?.repull?.horsSelection) logement.statut = statutLogement(l.status);
    logements.poser(logement);
    this.logementParRepull.set(String(l.id), id);
    return id;
  }

  private async ecrireLogements(): Promise<void> {
    const logements = await this.chargerLogements();
    const aEcrire = logements.aEcrire();
    if (aEcrire.some((x) => x.nouveau && x.element.proprietaireId === ID_PROPRIETAIRE_A_RENSEIGNER)) await this.assurerProprietaire();
    await logements.ecrire(this.base, this.bilan.logements);
  }

  /** Toutes les annonces (actives, désactivées, archivées). */
  async phaseAnnonces(): Promise<void> {
    await this.chargerLogements();
    for await (const page of this.repull.pages<RepullListing>('/v1/listings', { status: 'all', include: 'content,details,thumbnail' })) {
      for (const l of page) {
        if (l?.id === undefined || l?.id === null) continue;
        if (this.retenue(l.id)) await this.poserAnnonce(l, true);
        else await this.mettreHorsSelection(String(l.id), l.status);
      }
      if (!this.tempsRestant()) break;
    }
    await this.ecrireLogements();
  }

  /** Une annonce précise (webhook listing.*, ou réservation sur une annonce encore inconnue). */
  async importerAnnonce(idAnnonce: string, repli?: Partial<RepullListing>): Promise<Id | undefined> {
    if (!this.retenue(idAnnonce)) {
      // Logement non choisi : aucun appel ; s'il avait été importé, il passe en pause.
      await this.mettreHorsSelection(idAnnonce, repli?.status);
      await this.ecrireLogements();
      this.horsSelection();
      return undefined;
    }
    let l: RepullListing | undefined;
    try {
      l = await this.repull.get<RepullListing>(`/v1/listings/${encodeURIComponent(idAnnonce)}`, { include: 'amenities,content,details' });
    } catch (e) {
      if (!(e instanceof ErreurRepull) || (e.statut !== 403 && e.statut !== 404) || !repli) throw e;
      // Annonce désactivée ou supprimée : on applique ce que dit l'événement.
      l = { ...repli, id: idAnnonce } as RepullListing;
    }
    const id = await this.poserAnnonce(l, false);
    await this.ecrireLogements();
    return id;
  }

  /* -------------------------------------------------------- réservations */

  private async poserReservation(r: RepullReservation, pays?: string): Promise<'ok' | 'attente' | 'sans_logement' | 'hors_selection'> {
    const reservations = await this.chargerReservations();
    await this.chargerLogements();
    if (!this.retenue(r.listingId)) {
      this.horsSelection();
      return 'hors_selection';
    }
    let logementId = this.logementParRepull.get(String(r.listingId ?? ''));
    // Annonce encore inconnue (créée depuis le dernier relevé des annonces) : un appel, une fois.
    if (!logementId && r.listingId && !this.annoncesDemandees.has(String(r.listingId))) {
      this.annoncesDemandees.add(String(r.listingId));
      try {
        logementId = await this.importerAnnonce(String(r.listingId));
      } catch (e) {
        if (e instanceof DelaiEcoule || e instanceof BudgetEpuise) throw e;
        /* annonce illisible (désactivée) : réservation comptée « sans logement » */
      }
    }
    const id = this.reservationParRepull.get(String(r.id)) ?? idRepull(r.id);
    const existant = reservations.get(id);
    if (!logementId) logementId = existant?.logementId;
    if (!logementId) {
      this.bilan.ignores.reservationsSansLogement++;
      return 'sans_logement';
    }
    const res = versReservation(r, existant, { id, logementId, aujourdhui: this.aujourdhui, pays });
    if (!res) {
      this.bilan.ignores.reservationsEnAttente++;
      return 'attente';
    }
    reservations.poser(res);
    this.reservationParRepull.set(String(r.id), id);
    if (res.repull?.code) this.reservationParCode.set(res.repull.code, id);
    return 'ok';
  }

  /**
   * Réservations modifiées depuis `depuis` (ordre updatedAt croissant : un
   * passage interrompu reprend sans trou). Écriture à chaque page.
   */
  async phaseReservations(): Promise<void> {
    const reservations = await this.chargerReservations();
    await this.chargerLogements();
    let depuis = DEPUIS_TOUJOURS;
    if (this.o.mode === 'incremental') {
      for (const r of reservations.elements.values()) {
        const m = r.repull?.majLe;
        if (m && instant(m) > instant(depuis)) depuis = m;
      }
    }
    for await (const page of this.repull.pages<RepullReservation>('/v1/reservations', { updated_since: depuis })) {
      for (const r of page) if (r?.id !== undefined && r?.id !== null) await this.poserReservation(r);
      await reservations.ecrire(this.base, this.bilan.reservations);
      if (!this.tempsRestant()) break;
    }
    await reservations.ecrire(this.base, this.bilan.reservations);
  }

  /** Une réservation précise (webhook reservation.*). */
  async importerReservation(idReservation: string, repli?: { status?: string; cancelled?: boolean }): Promise<void> {
    const reservations = await this.chargerReservations();
    let r: RepullReservation;
    try {
      r = await this.repull.get<RepullReservation>(`/v1/reservations/${encodeURIComponent(idReservation)}`);
    } catch (e) {
      if (!(e instanceof ErreurRepull) || (e.statut !== 403 && e.statut !== 404)) throw e;
      // Plus lisible (annonce désactivée) : une annulation annoncée s'applique quand même.
      const existant = reservations.get(this.reservationParRepull.get(idReservation) ?? idRepull(idReservation));
      if (existant && repli?.cancelled && existant.statut !== 'annulee') {
        reservations.poser({ ...existant, statut: 'annulee', repull: { ...(existant.repull ?? { id: idReservation }), statut: 'cancelled' } });
        await reservations.ecrire(this.base, this.bilan.reservations);
      }
      return;
    }
    const existant = reservations.get(this.reservationParRepull.get(String(r.id)) ?? idRepull(r.id));
    let pays: string | undefined;
    const idVoyageur = r.primaryGuest?.id ?? r.guestId;
    if (!existant?.voyageur.pays && idVoyageur) {
      try {
        pays = (await this.repull.get<RepullGuest>(`/v1/guests/${encodeURIComponent(idVoyageur)}`)).country || undefined;
      } catch (e) {
        if (e instanceof DelaiEcoule) throw e;
      }
    }
    await this.poserReservation(r, pays);
    await reservations.ecrire(this.base, this.bilan.reservations);
  }

  /** Pays des voyageurs (fiches voyageurs Repull), pour les réservations qui ne l'ont pas. */
  async phasePays(): Promise<void> {
    const reservations = await this.chargerReservations();
    const manquants = new Set<string>();
    for (const r of reservations.elements.values()) if (!r.voyageur?.pays && r.repull?.voyageurId) manquants.add(r.repull.voyageurId);
    if (!manquants.size || !this.tempsRestant(15_000)) return;
    const pays = new Map<string, string>();
    for await (const page of this.repull.pages<RepullGuest>('/v1/guests', { has_reservation: true })) {
      for (const g of page) if (g?.id && manquants.has(String(g.id)) && g.country) pays.set(String(g.id), g.country);
      if (pays.size >= manquants.size || !this.tempsRestant(10_000)) break;
    }
    for (const r of reservations.elements.values()) {
      const p = r.repull?.voyageurId ? pays.get(r.repull.voyageurId) : undefined;
      if (p && !r.voyageur.pays) reservations.poser({ ...r, voyageur: { ...r.voyageur, pays: p } });
    }
    await reservations.ecrire(this.base, this.bilan.reservations);
  }

  /* --------------------------------------------------------------- avis */

  private async poserAvis(a: RepullReview): Promise<void> {
    const reservations = await this.chargerReservations();
    const id =
      (a.reservationId ? this.reservationParRepull.get(String(a.reservationId)) ?? idRepull(a.reservationId) : undefined) ??
      undefined;
    const res =
      reservations.get(id) ?? reservations.get(a.reservationConfirmationCode ? this.reservationParCode.get(a.reservationConfirmationCode) : undefined);
    if (!res) {
      this.bilan.ignores.avisSansReservation++;
      return;
    }
    await this.chargerLogements();
    if (!this.retenue(this.annonceDuLogement(res.logementId) ?? a.listingId)) {
      this.horsSelection();
      return;
    }
    const suivant = appliquerAvis(res, a);
    if (!identiques(suivant, res)) {
      reservations.poser(suivant);
      this.bilan.avis++;
    }
  }

  /** Avis des voyageurs → note et commentaire des réservations. */
  async phaseAvis(): Promise<void> {
    const reservations = await this.chargerReservations();
    for await (const page of this.repull.pages<RepullReview>('/v1/reviews', { reviewerRole: 'guest', status: 'all' })) {
      for (const a of page) if (a?.id) await this.poserAvis(a);
      if (!this.tempsRestant()) break;
    }
    await reservations.ecrire(this.base, this.bilan.reservations);
  }

  /** Un avis précis (webhook review.*). */
  async importerAvis(idAvis: string): Promise<void> {
    const a = await this.repull.get<RepullReview>(`/v1/reviews/${encodeURIComponent(idAvis)}`);
    await this.poserAvis(a);
    await (await this.chargerReservations()).ecrire(this.base, this.bilan.reservations);
  }

  /* ------------------------------------------------------- conversations */

  /** Messages d'une conversation, du plus récent au plus ancien, jusqu'au premier déjà connu. */
  private async messages(idConversation: string, connus: Set<string>): Promise<RepullMessage[]> {
    const res: RepullMessage[] = [];
    for await (const page of this.repull.pages<RepullMessage>(`/v1/conversations/${encodeURIComponent(idConversation)}/messages`, { order: 'desc' })) {
      let rejoint = false;
      for (const m of page) {
        if (!m?.id) continue;
        if (connus.has(idRepull(m.id))) rejoint = true;
        res.push(m);
      }
      if (rejoint || res.length >= 2000) break;
    }
    return res;
  }

  /**
   * Conversations : seules celles dont le dernier message a bougé sont
   * relues (un appel par conversation), les autres sont sautées.
   */
  async phaseConversations(): Promise<void> {
    const fils = await this.chargerFils();
    const reservations = await this.chargerReservations();
    await this.chargerLogements();
    const filParRepull = indexer(fils.elements.values());
    boucle: for await (const page of this.repull.pages<RepullConversation>('/v1/conversations')) {
      for (const conv of page) {
        if (!conv?.id) continue;
        const id = filParRepull.get(String(conv.id)) ?? idRepull(conv.id);
        const existant = fils.get(id);
        // Repère : l'instant du dernier message (celui que versFil garde dans repull.majLe).
        const repere = conv.lastMessageAt || conv.updatedAt;
        if (existant?.repull?.majLe && repere && instant(repere) <= instant(existant.repull.majLe)) continue;
        const idRes = conv.reservationId ? this.reservationParRepull.get(String(conv.reservationId)) : undefined;
        const res = reservations.get(idRes);
        const logementId = res?.logementId ?? (conv.listingId ? this.logementParRepull.get(String(conv.listingId)) : undefined) ?? existant?.logementId;
        if (!this.retenue(conv.listingId ?? this.annonceDuLogement(logementId))) {
          this.horsSelection();
          continue;
        }
        if (!logementId) {
          this.bilan.ignores.filsSansLogement++;
          continue;
        }
        if (!this.tempsRestant(8_000)) break boucle;
        const connus = new Set((existant?.messages ?? []).map((m) => m.id));
        const msgs = await this.messages(String(conv.id), connus);
        const fil = versFil(conv, msgs, existant, {
          id,
          logementId,
          reservationId: res?.id,
          canal: res?.canal ?? canalReservation(conv.platform),
          voyageur: res?.voyageur.nom,
        });
        this.bilan.messages += fil.messages.filter((m) => !connus.has(m.id)).length;
        fils.poser(fil);
      }
      await fils.ecrire(this.base, this.bilan.fils);
    }
    await fils.ecrire(this.base, this.bilan.fils);
  }

  /* -------------------------------------------------------------- bilan */

  /** Note une phase menée à son terme. */
  noterPhase(p: PhaseRepull) {
    if (!this.bilan.phases.includes(p)) this.bilan.phases.push(p);
  }

  /** Écrit la ligne de journal qui résume le passage (lue par Paramètres → Intégrations). */
  async journaliser(forcer = false, texteLibre?: string): Promise<void> {
    const b = this.bilan;
    const rien = !b.logements.crees && !b.logements.modifies && !b.reservations.crees && !b.reservations.modifies && !b.fils.crees && !b.fils.modifies;
    // Webhooks : une ligne seulement quand quelque chose de nouveau est arrivé.
    if (!forcer && (b.declencheur === 'webhook' || b.declencheur === 'agent') && !b.logements.crees && !b.reservations.crees && !b.fils.crees) return;
    const origine = { cron: 'automatique (quotidienne)', manuel: 'lancée depuis l’ERP', webhook: 'temps réel (webhook)', agent: 'relevé des messages par l’agent IA' }[b.declencheur];
    const c = (x: Compteur, un: string, f = false) => `${un} : ${x.crees} ${f ? 'créée' : 'créé'}${x.crees > 1 ? 's' : ''}, ${x.modifies} ${f ? 'modifiée' : 'modifié'}${x.modifies > 1 ? 's' : ''}`;
    const morceaux = [
      c(b.logements, 'Logements'),
      c(b.reservations, 'Réservations', true),
      `${c(b.fils, 'Conversations', true)} (${b.messages} message${b.messages > 1 ? 's' : ''})`,
      `Avis : ${b.avis}`,
    ];
    const notes: string[] = [];
    if (b.proprietaireCree) notes.push('fiche « Propriétaire à renseigner » créée');
    if (b.misEnPause) notes.push(`${b.misEnPause} logement(s) retiré(s) de votre choix, mis en pause`);
    if (b.ignores.reservationsEnAttente) notes.push(`${b.ignores.reservationsEnAttente} réservation(s) en attente de confirmation non importée(s)`);
    if (b.ignores.reservationsSansLogement) notes.push(`${b.ignores.reservationsSansLogement} réservation(s) sur une annonce inconnue`);
    if (b.ignores.filsSansLogement) notes.push(`${b.ignores.filsSansLogement} conversation(s) sans logement`);
    if (!b.complet) notes.push('passage partiel : la suite viendra au prochain passage');
    for (const e of b.erreurs) notes.push(`erreur : ${e}`);
    const details = texteLibre ?? `${rien ? 'Aucun changement. ' : ''}${morceaux.join(' · ')}.${notes.length ? ` ${notes.join(' ; ')}.` : ''}`;
    const horodatage = horodatageParis(this.maintenant());
    const ligne: Journal = {
      id: `repull-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      horodatage,
      auteur: AUTEUR_REPULL,
      action: ACTION_JOURNAL_REPULL,
      entite: 'repull',
      entiteId: b.declencheur,
      details: `Synchronisation ${b.mode === 'complet' ? 'complète' : 'ciblée'}, ${origine}. ${details}`,
    };
    await this.base.ecrire('journal', [ligne]);
  }

  terminer(): BilanRepull {
    this.bilan.fin = horodatageParis(this.maintenant());
    this.bilan.appelsRepull = this.repull.appels;
    this.bilan.ecritures = this.base.ecritures;
    return this.bilan;
  }
}

/** Erreur lisible pour le bilan (français). */
export function texteErreur(e: unknown): string {
  if (e instanceof ErreurRepull || e instanceof BudgetEpuise) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Un passage : annonces, réservations, avis, conversations, puis pays des
 * voyageurs (dans cet ordre de priorité), dans la limite du temps et de la
 * part d'appels. Les phases absentes de `o.phases` sont sautées.
 */
export async function synchroniser(o: OptionsSynchroRepull): Promise<BilanRepull> {
  const s = new SessionRepull(o);
  const voulues = o.phases ?? ['annonces', 'reservations', 'avis', 'conversations', 'pays'];
  const phases: [PhaseRepull, () => Promise<void>][] = [
    ['annonces', () => s.phaseAnnonces()],
    ['reservations', () => s.phaseReservations()],
    ['avis', () => s.phaseAvis()],
    ['conversations', () => s.phaseConversations()],
    ['pays', () => s.phasePays()],
  ];
  for (const [nom, phase] of phases) {
    if (!voulues.includes(nom)) continue;
    try {
      await phase();
      if (s.bilan.complet) s.noterPhase(nom);
    } catch (e) {
      if (e instanceof DelaiEcoule || e instanceof BudgetEpuise) {
        s.bilan.complet = false;
        if (e instanceof BudgetEpuise) s.bilan.erreurs.push(e.message);
        break;
      }
      s.bilan.erreurs.push(texteErreur(e));
      // Clé refusée, forfait ou quota dépassé : inutile de poursuivre.
      if (e instanceof ErreurRepull && (e.statut === 401 || e.statut === 402 || e.statut === 429)) break;
    }
    if (!s.bilan.complet) break;
  }
  try {
    await s.journaliser();
  } catch (e) {
    s.bilan.erreurs.push(texteErreur(e));
  }
  return s.terminer();
}

/* ================================================================ webhooks */

/** Enveloppe d'un événement Repull (champ `event`, pas `type`). */
export interface EvenementRepull {
  event?: string;
  eventId?: string;
  timestamp?: string;
  account?: { id?: number; provider?: string; externalAccountId?: string } | null;
  data?: Record<string, unknown> & { object?: Record<string, unknown> };
}

/** Événements à souscrire pour l'ERP (doc : docs/erp/README.md). */
export const EVENEMENTS_ERP = [
  'reservation.created',
  'reservation.updated',
  'reservation.cancelled',
  'reservation.request.created',
  'reservation.request.updated',
  'reservation.message.received',
  'reservation.alteration.responded',
  'listing.created',
  'listing.updated',
  'listing.deleted',
  'listing.suspended',
  'listing.reactivated',
  'review.created',
  'review.responded',
  'account.created',
  'account.disconnected',
] as const;

const chaine = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : undefined);

/**
 * Traite un événement : l'élément concerné est relu chez Repull (source de
 * vérité) puis fusionné. Un compte nouvellement connecté déclenche un
 * passage complet.
 */
export async function traiterEvenement(ev: EvenementRepull, o: Omit<OptionsSynchroRepull, 'mode' | 'declencheur'>): Promise<BilanRepull & { ignore?: string }> {
  const nom = ev.event ?? '';
  const data = ev.data ?? {};
  const objet = (data.object ?? {}) as Record<string, unknown>;

  if (nom === 'account.created') return synchroniser({ ...o, mode: 'complet', declencheur: 'webhook' });

  const s = new SessionRepull({ ...o, mode: 'incremental', declencheur: 'webhook' });
  let ignore: string | undefined;
  try {
    if (nom.startsWith('reservation.') && nom !== 'reservation.message.received' && !nom.startsWith('reservation.alteration.')) {
      const id = chaine(objet.id);
      if (id) await s.importerReservation(id, { status: chaine(objet.status), cancelled: nom === 'reservation.cancelled' });
      else ignore = 'réservation sans identifiant';
    } else if (nom === 'reservation.alteration.responded') {
      const id = chaine(objet.reservationId);
      if (id) await s.importerReservation(id);
    } else if (nom === 'reservation.message.received' || nom.startsWith('inquiry.')) {
      await s.phaseConversations();
    } else if (nom.startsWith('listing.')) {
      const id = chaine(objet.id) ?? chaine(data.id);
      const statut = nom === 'listing.deleted' ? 'archived' : nom === 'listing.suspended' ? 'inactive' : undefined;
      if (id) await s.importerAnnonce(id, { status: statut ?? chaine(objet.status), name: chaine(objet.name) });
      else ignore = 'annonce sans identifiant';
    } else if (nom.startsWith('review.')) {
      const id = chaine(objet.id);
      if (id) await s.importerAvis(id);
    } else if (nom === 'account.disconnected') {
      const fournisseur = chaine(data.provider) ?? ev.account?.provider ?? 'plateforme';
      await s.journaliser(
        true,
        `Compte ${fournisseur} déconnecté de Repull${chaine(data.reason) ? ` (${chaine(data.reason)})` : ''} : plus rien n’arrive de ce compte tant que le propriétaire ne l’a pas reconnecté.`,
      );
      return { ...s.terminer(), ignore: undefined };
    } else {
      // calendar.updated (l'ERP ne tient pas de calendrier de prix), paiements, IA, ping...
      ignore = nom || 'événement inconnu';
    }
  } catch (e) {
    if (e instanceof DelaiEcoule) s.bilan.complet = false;
    else {
      if (e instanceof BudgetEpuise) s.bilan.complet = false;
      s.bilan.erreurs.push(texteErreur(e));
    }
  }
  if (!ignore) {
    try {
      await s.journaliser();
    } catch (e) {
      s.bilan.erreurs.push(texteErreur(e));
    }
  }
  return { ...s.terminer(), ignore };
}

/* ================================== état, part d'appels et lancement d'un passage */

/**
 * État de la synchronisation, une ligne de erp.enregistrements hors des
 * collections de l'ERP (le store l'ignore au chargement et en temps réel) :
 * compteur d'appels du mois, dernier bilan, date du dernier passage de
 * chaque phase, quota réel du compte Repull quand il a été relevé.
 */
export const COLLECTION_ETAT = 'repull';
export const ID_ETAT = 'etat';
/** Part mensuelle des appels Repull réservée à l'ERP (le reste va à l'agent IA). */
export const BUDGET_ERP_DEFAUT = 400;
/** Quota mensuel du compte Repull (offre gratuite), pour l'affichage. */
export const QUOTA_MOIS_DEFAUT = 1000;
/** Intervalle minimal entre deux synchronisations lancées depuis l'ERP. */
export const INTERVALLE_MANUEL_MS = 10 * 60_000;

const HEURE = 3_600_000;
const JOUR = 24 * HEURE;

export interface QuotaRepull {
  tier?: string;
  limite?: number | null;
  utilise?: number;
  restant?: number | null;
  reinitialiseLe?: string;
  /** Relevé le (horodatage ERP). */
  luLe: string;
}

export interface EtatRepull {
  id: typeof ID_ETAT;
  /** Mois du compteur, 'YYYY-MM' (Paris). */
  mois: string;
  /** Appels Repull faits par l'ERP ce mois-ci. */
  appelsMois: number;
  /** Part mensuelle de l'ERP (REPULL_BUDGET_ERP). */
  budgetMois: number;
  /** Quota mensuel du compte, tous usages confondus (affichage). */
  quotaMois: number;
  derniereSynchro?: string;
  dernierBilan?: BilanRepull;
  /** Dernier passage complet (toutes les réservations relues). */
  dernierComplet?: string;
  /** Dernier passage mené à terme, par phase. */
  dernieresPhases?: Partial<Record<PhaseRepull, string>>;
  /** Quota réel lu chez Repull (GET /v1/usage/tier, bouton seulement). */
  quota?: QuotaRepull;
  /** Dernier événement webhook traité. */
  dernierWebhook?: { evenement: string; recuLe: string; erreurs: string[] };
}

const moisParis = (d: Date) => dateParis(d).slice(0, 7);

/** Choix des logements (page Connexions), même collection que l'état. */
export const ID_SELECTION = 'selection';

export interface SelectionRepull {
  id: typeof ID_SELECTION;
  /** Annonces Repull choisies (ids). */
  annonces: string[];
  /** Limite de l'offre au moment du choix. */
  limite: number | null;
  majLe: string;
  majPar: string;
}

/** Choix enregistré, ou null si personne n'a encore choisi. */
export async function lireSelection(base: BaseErp): Promise<SelectionRepull | null> {
  const [lu] = await base.lire<SelectionRepull>(COLLECTION_ETAT, [ID_SELECTION]);
  return lu && Array.isArray(lu.annonces) ? { ...lu, annonces: lu.annonces.map(String) } : null;
}

/** Appels faits hors d'un passage (page Connexions) : ajoutés au compteur du mois. */
export async function imputerAppels(
  base: BaseErp,
  maintenant: Date,
  appels: number,
  budgetMois = BUDGET_ERP_DEFAUT,
  quotaMois = QUOTA_MOIS_DEFAUT,
): Promise<EtatRepull> {
  const frais = await lireEtat(base, maintenant, budgetMois, quotaMois);
  if (appels <= 0) return frais;
  const suivant: EtatRepull = { ...frais, appelsMois: frais.appelsMois + appels };
  await base.ecrire(COLLECTION_ETAT, [suivant]);
  return suivant;
}

/** État lu en base, compteur remis à zéro au changement de mois. */
export async function lireEtat(base: BaseErp, maintenant: Date, budgetMois = BUDGET_ERP_DEFAUT, quotaMois = QUOTA_MOIS_DEFAUT): Promise<EtatRepull> {
  const [lu] = await base.lire<EtatRepull>(COLLECTION_ETAT, [ID_ETAT]);
  const mois = moisParis(maintenant);
  const etat: EtatRepull = { ...(lu ?? {}), id: ID_ETAT, mois, appelsMois: 0, budgetMois, quotaMois };
  if (lu && lu.mois === mois && Number.isFinite(lu.appelsMois)) etat.appelsMois = lu.appelsMois;
  if (lu?.quota && lu.mois !== mois) delete etat.quota;
  return etat;
}

/**
 * Phases dues selon leur fréquence : réservations et conversations à chaque
 * passage ; annonces une fois par jour (ou dès qu'une réservation cite une
 * annonce inconnue) ; avis et pays des voyageurs une fois par semaine (avis :
 * une fois par jour depuis le bouton).
 */
export function phasesDues(etat: EtatRepull, declencheur: DeclencheurRepull, maintenant: Date): PhaseRepull[] {
  const t = maintenant.getTime();
  const depuis = (p: PhaseRepull) => {
    const x = etat.dernieresPhases?.[p];
    return x ? t - instant(x) : Infinity;
  };
  const res: PhaseRepull[] = [];
  if (depuis('annonces') >= 20 * HEURE) res.push('annonces');
  res.push('reservations');
  if (depuis('avis') >= (declencheur === 'manuel' ? JOUR : 6.5 * JOUR)) res.push('avis');
  res.push('conversations');
  if (depuis('pays') >= 6.5 * JOUR) res.push('pays');
  return res;
}

export interface OptionsLancement {
  cle: string;
  base: BaseErp;
  declencheur: DeclencheurRepull;
  /** Instant (ms) à ne pas dépasser. */
  echeance: number;
  budgetMois?: number;
  quotaMois?: number;
  fetch?: Fetch;
  baseRepull?: string;
  attendre?: (ms: number) => Promise<void>;
  maintenant?: () => Date;
  intervalleManuelMs?: number;
  /** Webhook : l'événement à traiter (sinon, passage planifié ou manuel). */
  evenement?: EvenementRepull;
  /** Relever le quota réel du compte (un appel de plus : bouton seulement). */
  lireQuota?: boolean;
  /**
   * Passage demandé juste après un nouveau choix de logements : pas
   * d'intervalle minimal, mode et phases imposés (annonces comprises).
   */
  forcer?: { mode: ModeRepull; phases: PhaseRepull[] };
}

export interface ResultatLancement {
  ok: boolean;
  /**
   * fait : passage mené ; limite : trop tôt après le précédent ; budget :
   * part du mois épuisée ; selection : aucun logement choisi, rien importé.
   */
  statut: 'fait' | 'limite' | 'budget' | 'selection';
  message?: string;
  bilan?: BilanRepull;
  etat: EtatRepull;
}

const heureMinute = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(d);

/**
 * Lance un passage en respectant l'intervalle minimal (bouton) et la part
 * mensuelle d'appels, puis enregistre l'état (compteur, bilan, phases).
 */
export async function lancer(o: OptionsLancement): Promise<ResultatLancement> {
  const maintenant = o.maintenant ?? (() => new Date());
  const budgetMois = o.budgetMois ?? BUDGET_ERP_DEFAUT;
  const quotaMois = o.quotaMois ?? QUOTA_MOIS_DEFAUT;
  const etat = await lireEtat(o.base, maintenant(), budgetMois, quotaMois);

  // Rien n'entre dans l'ERP tant que les logements n'ont pas été choisis (et aucun appel).
  const selection = await lireSelection(o.base);
  if (!selection) {
    return {
      ok: true,
      statut: 'selection',
      message: 'Choisissez vos logements : rien n’est importé tant que vous ne les avez pas choisis (Logements → Connexions).',
      bilan: etat.dernierBilan,
      etat,
    };
  }
  const choisies = new Set(selection.annonces);

  const intervalle = o.intervalleManuelMs ?? INTERVALLE_MANUEL_MS;
  if (o.declencheur === 'manuel' && !o.forcer && etat.derniereSynchro) {
    const ecoule = maintenant().getTime() - instant(etat.derniereSynchro);
    if (ecoule >= 0 && ecoule < intervalle) {
      const prochaine = new Date(instant(etat.derniereSynchro) + intervalle);
      return {
        ok: true,
        statut: 'limite',
        message: `Synchronisation déjà faite il y a ${Math.max(1, Math.round(ecoule / 60_000))} min : la prochaine est possible à ${heureMinute(prochaine)} (économie des appels Repull). Résultat du dernier passage ci-dessous.`,
        bilan: etat.dernierBilan,
        etat,
      };
    }
  }

  const restant = etat.budgetMois - etat.appelsMois;
  if (restant <= 0) {
    const message = `Part mensuelle des appels Repull de l’ERP épuisée (${etat.appelsMois} / ${etat.budgetMois}) : plus aucune synchronisation avant le 1er du mois prochain. Augmentez REPULL_BUDGET_ERP ou passez à l’offre Repull supérieure.`;
    if (o.declencheur === 'cron') {
      try {
        const s = new SessionRepull({ repull: new ClientRepull({ cle: o.cle, echeance: o.echeance, budget: 0 }), base: o.base, mode: 'incremental', declencheur: 'cron', maintenant });
        await s.journaliser(true, message);
      } catch {
        /* journal facultatif */
      }
    }
    return { ok: false, statut: 'budget', message, bilan: etat.dernierBilan, etat };
  }

  const client = new ClientRepull({ cle: o.cle, fetch: o.fetch, base: o.baseRepull, echeance: o.echeance, budget: restant, attendre: o.attendre });
  let bilan: BilanRepull;
  let evenement: string | undefined;
  if (o.evenement) {
    evenement = o.evenement.event ?? 'inconnu';
    bilan = await traiterEvenement(o.evenement, { repull: client, base: o.base, maintenant, selection: choisies });
  } else {
    // Passage complet (toutes les réservations relues) une fois par semaine par le cron.
    const complet = o.declencheur === 'cron' && (!etat.dernierComplet || maintenant().getTime() - instant(etat.dernierComplet) >= 6.5 * JOUR);
    bilan = await synchroniser({
      repull: client,
      base: o.base,
      mode: o.forcer?.mode ?? (complet ? 'complet' : 'incremental'),
      declencheur: o.declencheur,
      maintenant,
      phases: o.forcer?.phases ?? phasesDues(etat, o.declencheur, maintenant()),
      selection: choisies,
    });
  }

  // Quota réel du compte (tous usages) : un appel, seulement depuis le bouton.
  let quota = etat.quota;
  if (o.lireQuota && client.restant > 0 && !bilan.erreurs.length) {
    try {
      const t = await client.get<{
        tier?: string;
        limits?: { monthlyRequests?: number | null };
        used?: { monthly?: number };
        remaining?: { monthly?: number | null };
        resetsAt?: string;
      }>('/v1/usage/tier');
      quota = {
        tier: t.tier,
        limite: t.limits?.monthlyRequests,
        utilise: t.used?.monthly,
        restant: t.remaining?.monthly,
        reinitialiseLe: t.resetsAt,
        luLe: horodatageParis(maintenant()),
      };
    } catch {
      /* affichage seulement */
    }
  }
  bilan.appelsRepull = client.appels;

  // Relecture juste avant d'écrire : un autre passage a pu compter ses appels entre-temps.
  const frais = await lireEtat(o.base, maintenant(), budgetMois, quotaMois);
  const fin = bilan.fin ?? horodatageParis(maintenant());
  const suivant: EtatRepull = {
    ...frais,
    appelsMois: frais.appelsMois + client.appels,
    dernieresPhases: { ...(frais.dernieresPhases ?? {}), ...Object.fromEntries(bilan.phases.map((p) => [p, fin])) },
    ...(quota ? { quota } : {}),
  };
  if (evenement) {
    suivant.dernierWebhook = { evenement, recuLe: fin, erreurs: bilan.erreurs };
  } else {
    suivant.derniereSynchro = fin;
    suivant.dernierBilan = bilan;
    if (bilan.mode === 'complet' && bilan.complet && bilan.phases.includes('reservations')) suivant.dernierComplet = fin;
  }
  await o.base.ecrire(COLLECTION_ETAT, [suivant]);
  return {
    ok: !bilan.erreurs.length,
    statut: 'fait',
    message: bilan.erreurs.length ? bilan.erreurs.join(' ') : undefined,
    bilan,
    etat: suivant,
  };
}

/**
 * Relevé léger des conversations (agent IA) : seulement la phase
 * « conversations » (un appel pour la liste, un de plus par conversation dont
 * le dernier message a bougé), compté dans la part mensuelle de l'ERP. Ne
 * touche ni au dernier bilan ni à la date de la dernière synchronisation.
 */
export async function releverConversations(o: Omit<OptionsLancement, 'declencheur' | 'evenement' | 'lireQuota' | 'forcer' | 'intervalleManuelMs'>): Promise<BilanRepull | null> {
  const maintenant = o.maintenant ?? (() => new Date());
  const budgetMois = o.budgetMois ?? BUDGET_ERP_DEFAUT;
  const quotaMois = o.quotaMois ?? QUOTA_MOIS_DEFAUT;
  const selection = await lireSelection(o.base);
  if (!selection) return null;
  const etat = await lireEtat(o.base, maintenant(), budgetMois, quotaMois);
  const restant = etat.budgetMois - etat.appelsMois;
  if (restant <= 0) throw new BudgetEpuise();
  const client = new ClientRepull({ cle: o.cle, fetch: o.fetch, base: o.baseRepull, echeance: o.echeance, budget: restant, attendre: o.attendre });
  const s = new SessionRepull({ repull: client, base: o.base, mode: 'incremental', declencheur: 'agent', maintenant, selection: new Set(selection.annonces) });
  try {
    await s.phaseConversations();
  } catch (e) {
    if (e instanceof DelaiEcoule || e instanceof BudgetEpuise) s.bilan.complet = false;
    else s.bilan.erreurs.push(texteErreur(e));
  } finally {
    await imputerAppels(o.base, maintenant(), client.appels, budgetMois, quotaMois);
  }
  try {
    await s.journaliser();
  } catch {
    /* journal facultatif */
  }
  return s.terminer();
}
