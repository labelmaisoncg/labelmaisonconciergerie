/**
 * Accès à la base Supabase de Label Maison : client, authentification,
 * espaces et membres, fichiers (photos), et lecture des erreurs.
 *
 * Toutes les tables vivent dans le schéma `erp` (supabase/erp-installation.sql,
 * puis supabase/erp-espaces.sql). Chaque lecture et écriture vise l'espace
 * ouvert (espaces.ts) ; base pas encore préparée : comme avant, sans espace.
 * La synchronisation des données elle-même est dans synchro.ts.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SCHEMA_ERP, SUPABASE_ANON_KEY, SUPABASE_URL, URL_RETOUR_MOT_DE_PASSE } from './config';
import {
  erreurBaseHistorique,
  espaceDesDonnees,
  idEspaceValide,
  lireEspacesMembre,
  lireInvitationEspace,
  lireRefusAcces,
  prefixeFichiers,
  type Espace,
  type EspaceMembre,
  type InvitationEspace,
  type RefusAcces,
} from './espaces';
import {
  CLE_INVITATION,
  EMAIL_VALIDE,
  codeInvitationValide,
  codePourCompte,
  invitationAGarder,
  lireInvitationGardee,
  normaliserEmailInvitation,
  type InvitationGardee,
} from './invitation';
import type { RoleUtilisateur, Utilisateur } from './types';

/* ----------------------------------------------------------------- client */

/** Client typé sans schéma généré : les lignes sont lues et écrites en JSON. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClientErp = SupabaseClient<any, any, any>;

let client: ClientErp | null = null;

/* ------------------------------------- code d'invitation gardé sur l'appareil */

/** Invitation gardée sur cet appareil (lien « Créer mon compte » ouvert ici), null : aucune. */
export function invitationGardee(): InvitationGardee | null {
  try {
    return lireInvitationGardee(window.localStorage.getItem(CLE_INVITATION));
  } catch {
    return null;
  }
}

function garderInvitation(email: string, code: string) {
  try {
    window.localStorage.setItem(CLE_INVITATION, JSON.stringify(invitationAGarder(email, code)));
  } catch {
    /* navigation privée : le code ne vit que le temps de la page */
  }
}

export function oublierInvitation() {
  try {
    window.localStorage.removeItem(CLE_INVITATION);
  } catch {
    /* rien à effacer */
  }
}

/** Code d'invitation gardé pour ce compte (même adresse), sinon undefined. */
export const codeInvitationDe = (email: string): string | undefined => codePourCompte(invitationGardee(), email);

/** Adresse d'un jeton Supabase (affichage seulement : la base vérifie le jeton). */
function emailDuJeton(jwt: string): string {
  try {
    const b = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const e = (JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))))) as { email?: unknown }).email;
    return typeof e === 'string' && e.length < 200 ? e.trim().toLowerCase() : '';
  } catch {
    return '';
  }
}

export interface RetourLien {
  recuperation: boolean;
  erreur?: string;
  /** Lien « Créer mon compte » : l'adresse invitée ('' si illisible). */
  creer?: string;
  /**
   * Lien reçu par e-mail qui concerne un compte (« Créer mon compte »,
   * confirmation d'adresse…), retiré de l'adresse avant que le client ne le
   * lise : jamais de changement de compte sans un geste. hash : le lien tel
   * quel, pour le rejouer sur la page d'accès.
   */
  lien?: { hash: string; email: string; jetons: boolean };
}

/**
 * Lien reçu par e-mail : lu AVANT que le client Supabase ne nettoie l'adresse
 * (#access_token=...&type=recovery, #creer=...&code=..., ou #error=... si expiré).
 */
function lireRetourLien(): RetourLien {
  if (typeof window === 'undefined') return { recuperation: false };
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return { recuperation: false };
  const p = new URLSearchParams(hash);
  const effacer = () => window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  if (p.has('creer')) {
    // Lien d'invitation « Créer mon compte » : l'adresse et le code, retirés de l'adresse aussitôt ; le code reste sur l'appareil.
    effacer();
    const email = normaliserEmailInvitation(p.get('creer'));
    const valable = EMAIL_VALIDE.test(email) && email.length <= 200;
    const code = p.get('code');
    if (valable && codeInvitationValide(code)) garderInvitation(email, code);
    return { recuperation: false, creer: valable ? email : '', ...(valable ? { lien: { hash: `#${hash}`, email, jetons: false } } : {}) };
  }
  const code = p.get('error_code') ?? p.get('error');
  if (code) {
    const expire = /expired|otp/i.test(code + (p.get('error_description') ?? ''));
    return {
      recuperation: false,
      erreur: expire
        ? 'Ce lien a expiré ou a déjà servi. Demandez un nouveau lien avec « Mot de passe oublié ? », ou refaites « Créer mon compte ».'
        : 'Ce lien n’est pas valide. Demandez un nouveau lien avec « Mot de passe oublié ? », ou refaites « Créer mon compte ».',
    };
  }
  const acces = p.get('access_token');
  if (acces && p.get('refresh_token') && p.get('type') !== 'recovery') {
    effacer();
    return { recuperation: false, lien: { hash: `#${hash}`, email: emailDuJeton(acces), jetons: true } };
  }
  return { recuperation: p.get('type') === 'recovery' };
}

/** État du lien reçu par e-mail au chargement de la page. */
export const RETOUR_LIEN = lireRetourLien();

/** Client unique de l'ERP (créé au premier appel). */
export function obtenirClient(): ClientErp {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      db: { schema: SCHEMA_ERP },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit',
        storageKey: 'lm-erp-auth',
      },
    });
    if (RETOUR_LIEN.erreur && typeof window !== 'undefined') {
      // Nettoie l'adresse : le message est déjà mémorisé dans RETOUR_LIEN.
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
  }
  return client;
}

/* ---------------------------------------------------------------- erreurs */

/** Forme commune des erreurs PostgREST / Auth / Storage. */
export interface ErreurBase {
  message?: string;
  code?: string;
  status?: number;
  details?: string;
  hint?: string;
}

export type GenreErreur = 'base_absente' | 'reseau' | 'droits' | 'session' | 'autre';

/** Classe une erreur pour afficher le bon écran (base non installée, hors ligne...). */
export function genreErreur(e: unknown, status?: number): GenreErreur {
  const err = (e ?? {}) as ErreurBase;
  const code = String(err.code ?? '');
  const message = String(err.message ?? e ?? '');
  const statut = status ?? err.status;
  // Schéma non exposé (PGRST106), table absente (PGRST205, 42P01), fonction absente (42883).
  if (['PGRST106', 'PGRST205', 'PGRST202', '42P01', '3F000', '42883'].includes(code)) return 'base_absente';
  if (/schema must be one of|invalid schema|could not find the table|does not exist/i.test(message)) return 'base_absente';
  if (['PGRST301', 'PGRST302', 'PGRST303'].includes(code) || /jwt|token/i.test(message) || statut === 401) return 'session';
  if (code === '42501' || statut === 403 || /row-level security|permission denied/i.test(message)) return 'droits';
  if (statut === 0 || /failed to fetch|fetcherror|networkerror|load failed|network request failed|typeerror/i.test(message)) return 'reseau';
  return 'autre';
}

/** Message court, en français, pour l'utilisateur. */
export function messageErreur(e: unknown, status?: number): string {
  switch (genreErreur(e, status)) {
    case 'base_absente':
      return 'La base de données n’est pas encore installée.';
    case 'reseau':
      return 'Connexion à la base impossible (réseau).';
    case 'droits':
      return 'Votre compte n’a pas le droit de faire cette modification.';
    case 'session':
      return 'Votre session a expiré. Reconnectez-vous.';
    default: {
      const m = (e as ErreurBase)?.message;
      return m ? `Erreur de la base : ${m}` : 'Erreur inattendue de la base.';
    }
  }
}

/* ------------------------------------------------------ authentification */

const TRADUCTIONS_AUTH: [RegExp, string][] = [
  [/invalid login credentials/i, 'Adresse ou mot de passe incorrect.'],
  [/email not confirmed/i, 'Adresse e-mail non confirmée : ouvrez le lien reçu par e-mail, ou demandez à un gérant.'],
  [/rate limit|too many/i, 'Trop de tentatives. Patientez une minute avant de réessayer.'],
  [/password should be at least|weak password/i, 'Mot de passe trop court : 8 caractères au moins.'],
  [/same password|different from the old/i, 'Choisissez un mot de passe différent de l’ancien.'],
  [/user not found/i, 'Aucun compte avec cette adresse.'],
  [/auth session missing|session.*(expired|missing)/i, 'Ce lien a expiré ou a déjà servi. Demandez un nouveau lien avec « Mot de passe oublié ? ».'],
  [/failed to fetch|network/i, 'Connexion impossible. Vérifiez votre accès à internet.'],
];

function traduireAuth(message: string | undefined): string {
  const m = message ?? '';
  return TRADUCTIONS_AUTH.find(([re]) => re.test(m))?.[1] ?? (m ? `Erreur : ${m}` : 'Erreur inattendue.');
}

export type ResultatAuth = { ok: true } | { ok: false; erreur: string };

async function connexionSimple(email: string, motDePasse: string): Promise<ResultatAuth> {
  try {
    const { error } = await obtenirClient().auth.signInWithPassword({ email: email.trim(), password: motDePasse });
    return error ? { ok: false, erreur: traduireAuth(error.message) } : { ok: true };
  } catch (e) {
    return { ok: false, erreur: traduireAuth((e as Error)?.message) };
  }
}

/** Activation en cours : le chargement de l'ERP l'attend avant de vérifier l'accès. */
let activationEnCours: Promise<unknown> | null = null;
export const attendreActivation = (): Promise<unknown> => activationEnCours ?? Promise.resolve();

/** Dernière activation : code refusé (déjà servi, remplacé, expiré). Lu par l'écran « Accès non autorisé ». */
let codeRefuse = false;
export const lienInvitationRefuse = (): boolean => codeRefuse;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Active l'accès du compte connecté avec le code de son invitation, comme
 * /erp/connexion (middleware.ts) : le mot de passe saisi devient celui du
 * compte (un mot de passe posé avant par quelqu'un d'autre ne vaut plus),
 * les autres sessions du compte sont fermées, puis erp.activer relie le
 * compte et consomme le code ; la session est renouvelée (les jetons d'avant
 * l'activation ne valent rien). activee : faux si le code n'a pas servi
 * (déjà servi, expiré, autre adresse : l'accès ordinaire décide ensuite).
 * Compte déjà membre : le code (resté sur l'appareil, ou reçu d'un autre
 * espace) ne sert pas, rien n'est fermé ni lié (comme /erp/connexion).
 */
export async function activerAvecCode(code: string, motDePasse: string): Promise<{ ok: true; activee: boolean } | { ok: false; erreur: string }> {
  const precedente = activationEnCours;
  const travail = (async () => {
    const c = obtenirClient();
    try {
      const deja = await quiSuisJe();
      if (deja.ok && deja.mode === 'espaces' && deja.espaces.some((e) => e.role !== 'prestataire')) {
        oublierInvitation();
        return { ok: true as const, activee: false };
      }
      const u = await c.auth.updateUser({ password: motDePasse });
      if (u.error && !/same.?password|different from the old/i.test(`${u.error.code ?? ''} ${u.error.message}`)) {
        return { ok: false as const, erreur: traduireAuth(u.error.message) };
      }
      // Sans cette fermeture, qui aurait ouvert une session avant garderait la main : on n'active pas.
      const fermeture = await c.auth.signOut({ scope: 'others' }).catch((e: unknown) => ({ error: e }));
      if (fermeture.error) return { ok: false as const, erreur: 'Connexion impossible. Réessayez dans un instant.' };
      const { error } = await c.rpc('activer', { p_code: code });
      if (error) {
        // Base d'avant les espaces, ou code refusé : il ne servira plus ; l'accès ordinaire décide.
        if (erreurBaseHistorique(error) || error.code === '42501') {
          oublierInvitation();
          codeRefuse = error.code === '42501';
          return { ok: true as const, activee: false };
        }
        return { ok: false as const, erreur: messageErreur(error) };
      }
      oublierInvitation();
      codeRefuse = false;
      // Jeton émis après l'activation (à la seconde près) : la base ne reconnaît que lui.
      await pause(1100);
      await c.auth.refreshSession();
      return { ok: true as const, activee: true };
    } catch (e) {
      return { ok: false as const, erreur: traduireAuth((e as Error)?.message) };
    }
  })();
  if (!precedente) activationEnCours = travail;
  try {
    return await travail;
  } finally {
    if (activationEnCours === travail) activationEnCours = null;
  }
}

/**
 * Connexion par mot de passe ; avec un code d'invitation gardé pour cette
 * adresse, l'accès est activé dans la foulée, avant tout chargement.
 */
export async function seConnecter(email: string, motDePasse: string): Promise<ResultatAuth> {
  codeRefuse = false;
  const code = codeInvitationDe(email);
  if (!code) return connexionSimple(email, motDePasse);
  let fin: () => void = () => undefined;
  // Posée AVANT la connexion : le chargement déclenché par la session l'attend.
  const garde = new Promise<void>((r) => (fin = r));
  activationEnCours = garde;
  try {
    const r = await connexionSimple(email, motDePasse);
    if (!r.ok) return r;
    const a = await activerAvecCode(code, motDePasse);
    return a.ok ? { ok: true } : a;
  } finally {
    fin();
    if (activationEnCours === garde) activationEnCours = null;
  }
}

/**
 * Connexion automatique : la page d'accès a déjà vérifié ERP_PASSWORD, le
 * serveur (middleware) ouvre la session du compte d'équipe. Renvoie false si
 * ce n'est pas possible (formulaire de mot de passe en secours).
 */
export async function connexionAutomatique(): Promise<boolean> {
  try {
    const r = await fetch('/erp/session', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) return false;
    const d = (await r.json()) as { access_token?: string; refresh_token?: string };
    if (!d.access_token || !d.refresh_token) return false;
    const { error } = await obtenirClient().auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token });
    return !error;
  } catch {
    return false;
  }
}

export async function envoyerLienMotDePasse(email: string): Promise<ResultatAuth> {
  try {
    const { error } = await obtenirClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: URL_RETOUR_MOT_DE_PASSE });
    return error ? { ok: false, erreur: traduireAuth(error.message) } : { ok: true };
  } catch (e) {
    return { ok: false, erreur: traduireAuth((e as Error)?.message) };
  }
}

/**
 * « Créer mon compte » (secours de la page d'accès) : inscription auprès de
 * Supabase, lien de confirmation vers le site fixe. Personne n'est connecté
 * ici, même si Supabase rendait une session (confirmation coupée) : l'adresse
 * doit être confirmée par son lien. Même réponse qu'un compte existe ou non.
 */
export async function creerCompte(email: string, motDePasse: string): Promise<ResultatAuth> {
  try {
    const { data, error } = await obtenirClient().auth.signUp({ email: email.trim(), password: motDePasse, options: { emailRedirectTo: URL_RETOUR_MOT_DE_PASSE } });
    if (data?.session) await obtenirClient().auth.signOut({ scope: 'local' });
    if (!error || /already registered|already been registered|user_already_exists/i.test(`${error.code ?? ''} ${error.message}`)) return { ok: true };
    if (/signup_disabled|signups? not allowed/i.test(`${error.code ?? ''} ${error.message}`)) return { ok: false, erreur: 'La création de compte n’est pas ouverte pour le moment. Prévenez un gérant.' };
    if (/email_address_not_authorized|not authorized/i.test(`${error.code ?? ''} ${error.message}`)) return { ok: false, erreur: 'L’e-mail de confirmation ne peut pas partir pour le moment. Prévenez un gérant.' };
    if (/email_address_invalid|invalid format|unable to validate email/i.test(`${error.code ?? ''} ${error.message}`)) return { ok: false, erreur: 'Adresse e-mail invalide.' };
    return { ok: false, erreur: traduireAuth(error.message) };
  } catch (e) {
    return { ok: false, erreur: traduireAuth((e as Error)?.message) };
  }
}

export async function changerMotDePasse(motDePasse: string): Promise<ResultatAuth> {
  try {
    const { data, error } = await obtenirClient().auth.updateUser({ password: motDePasse });
    if (error) return { ok: false, erreur: traduireAuth(error.message) };
    // Lien de récupération d'un compte invité : le même geste active son accès.
    const code = data.user?.email ? codeInvitationDe(data.user.email) : undefined;
    if (code) {
      const a = await activerAvecCode(code, motDePasse);
      if (!a.ok) return a;
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, erreur: traduireAuth((e as Error)?.message) };
  }
}

/**
 * Base prête pour les invitations (erp.activer existe) ? false : base d'avant
 * les espaces (« Créer mon compte » fermé) ; null : on ne sait pas.
 */
export async function baseInvitations(): Promise<boolean | null> {
  try {
    const r = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/activer`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', 'Content-Profile': SCHEMA_ERP, 'Accept-Profile': SCHEMA_ERP },
      body: '{}',
    });
    if (r.status !== 404) return true;
    return !/PGRST202/.test(await r.text().catch(() => ''));
  } catch {
    return null;
  }
}

export async function seDeconnecter(): Promise<void> {
  codeRefuse = false;
  try {
    await obtenirClient().auth.signOut();
  } catch {
    /* hors ligne : la session locale est tout de même effacée par Supabase */
  }
}

/* ---------------------------------------------------------------- espaces */

export type Identite =
  | { ok: true; mode: 'espaces'; espaces: EspaceMembre[]; invitation: InvitationEspace | null; refus: RefusAcces }
  | { ok: true; mode: 'historique' }
  | { ok: false; erreur: unknown; status?: number };

/**
 * Espaces du compte connecté (erp.qui_suis_je). historique : base pas encore
 * passée aux espaces (supabase/erp-espaces.sql), tout se fait comme avant.
 */
export async function quiSuisJe(): Promise<Identite> {
  const { data, error, status } = await obtenirClient().rpc('qui_suis_je');
  if (error) return erreurBaseHistorique(error) ? { ok: true, mode: 'historique' } : { ok: false, erreur: error, status };
  return { ok: true, mode: 'espaces', espaces: lireEspacesMembre(data), invitation: lireInvitationEspace(data), refus: lireRefusAcces(data) };
}

/**
 * Crée l'espace de sa conciergerie avec l'invitation activée par ce compte
 * (erp.creer_espace : au nom donné par Label Maison, la personne en devient
 * gérante). Un nouvel appel rend le même espace. Erreur : le message clair
 * de la base.
 */
export async function creerEspace(nom: string): Promise<{ ok: true; espace: Espace } | { ok: false; erreur: string }> {
  try {
    const { data, error } = await obtenirClient().rpc('creer_espace');
    if (error) return { ok: false, erreur: error.message || 'Création impossible pour l’instant. Réessayez dans un instant.' };
    const e = (data ?? {}) as { id?: unknown; code?: unknown; nom?: unknown };
    if (!idEspaceValide(e.id)) return { ok: false, erreur: 'Réponse inattendue de la base. Réessayez dans un instant.' };
    return { ok: true, espace: { id: e.id.toLowerCase(), code: String(e.code ?? ''), nom: String(e.nom ?? nom) } };
  } catch {
    return { ok: false, erreur: 'Serveur injoignable : vérifiez la connexion et réessayez.' };
  }
}

/* ---------------------------------------------------------------- membres */

export interface Membre {
  email: string;
  nom: string | null;
  role: RoleUtilisateur;
  /** Compte relié (erp.membres.uid) ; lu pour savoir à qui l'invitation sert encore, jamais gardé. */
  uid?: string | null;
}

export const ROLES_VALIDES: RoleUtilisateur[] = ['gerant', 'operations', 'prestataire', 'lecture'];

/** Membre → Utilisateur de l'ERP (l'id est l'adresse en minuscules). */
export function versUtilisateur(m: Membre): Utilisateur {
  const email = m.email.trim().toLowerCase();
  const nom = m.nom?.trim() || email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const u: Utilisateur = { id: email, nom, email, role: ROLES_VALIDES.includes(m.role) ? m.role : 'lecture' };
  if (m.uid !== undefined) u.compteActif = !!m.uid;
  return u;
}

export type LectureMembres = { ok: true; membres: Utilisateur[] } | { ok: false; erreur: unknown; status?: number };

/** Membres visibles de l'espace ouvert : toute l'équipe pour un membre, sa seule ligne sinon (règles RLS). */
export async function lireMembres(): Promise<LectureMembres> {
  const espace = espaceDesDonnees();
  // Base des espaces : on lit aussi si le compte est relié (colonne absente sur la base d'avant).
  let requete = obtenirClient().from('membres').select(espace ? 'email,nom,role,uid' : 'email,nom,role');
  if (espace) requete = requete.eq('espace', espace);
  const { data, error, status } = await requete.order('email');
  if (error) return { ok: false, erreur: error, status };
  return { ok: true, membres: ((data ?? []) as unknown as Membre[]).map(versUtilisateur) };
}

export async function enregistrerMembre(u: Pick<Utilisateur, 'email' | 'nom' | 'role'>): Promise<ErreurBase | null> {
  const espace = espaceDesDonnees();
  const ligne: Record<string, string> = { email: u.email.trim().toLowerCase(), nom: u.nom.trim(), role: u.role };
  if (espace) ligne.espace = espace;
  const { error } = await obtenirClient()
    .from('membres')
    .upsert(ligne, { onConflict: espace ? 'espace,email' : 'email' });
  return error;
}

export async function retirerMembre(email: string): Promise<ErreurBase | null> {
  const espace = espaceDesDonnees();
  let requete = obtenirClient().from('membres').delete().eq('email', email.trim().toLowerCase());
  if (espace) requete = requete.eq('espace', espace);
  const { error } = await requete;
  return error;
}

/** Un enregistrement de l'espace ouvert (null : absent). */
export async function lireEnregistrement<T>(collection: string, id: string): Promise<T | null> {
  const espace = espaceDesDonnees();
  let requete = obtenirClient().from('enregistrements').select('donnees').eq('collection', collection).eq('id', id);
  if (espace) requete = requete.eq('espace', espace);
  const { data } = await requete.maybeSingle();
  return ((data as { donnees?: T } | null)?.donnees ?? null) as T | null;
}

/* -------------------------------------------------------------- fichiers */

/** Espace de stockage privé créé par erp-installation.sql. */
export const BUCKET_FICHIERS = 'erp-fichiers';
/** Préfixe des fichiers stockés dans Supabase (résolus en liens signés à l'affichage). */
export const PREFIXE_STOCKAGE = 'stockage://';

export const estFichierStocke = (url?: string): url is string => !!url && url.startsWith(PREFIXE_STOCKAGE);

/**
 * Envoie un fichier dans l'espace privé ; renvoie l'adresse « stockage://... »
 * à enregistrer. Rangé dans le dossier de l'espace (sauf Label Maison, dont
 * les chemins restent ceux d'avant).
 */
export async function televerser(dossier: string, fichier: File): Promise<{ url: string } | { erreur: string }> {
  const extension = (fichier.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  const chemin = `${prefixeFichiers()}${dossier}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${extension}`;
  try {
    const { error } = await obtenirClient().storage.from(BUCKET_FICHIERS).upload(chemin, fichier, {
      contentType: fichier.type || undefined,
      upsert: false,
    });
    if (error) {
      return {
        erreur: /bucket not found/i.test(error.message)
          ? 'Espace de stockage absent : relancez supabase/erp-installation.sql.'
          : `Envoi impossible : ${error.message}`,
      };
    }
    return { url: `${PREFIXE_STOCKAGE}${BUCKET_FICHIERS}/${chemin}` };
  } catch (e) {
    return { erreur: `Envoi impossible : ${(e as Error)?.message ?? 'erreur réseau'}` };
  }
}

const cacheLiens = new Map<string, { lien: string; expire: number }>();

/** Lien signé (1 h) vers un fichier « stockage://... » ; l'URL telle quelle sinon. */
/**
 * Lien à envoyer à un voyageur vers un fichier de l'espace privé (guide) :
 * signé pour `secondes` (7 jours pour un guide), sans cache. Une adresse web
 * est rendue telle quelle ; null si le lien ne peut pas être créé.
 */
export async function lienPartage(url: string, secondes: number): Promise<string | null> {
  if (!estFichierStocke(url)) return /^https:\/\//.test(url) ? url : null;
  const reste = url.slice(PREFIXE_STOCKAGE.length);
  const bucket = reste.slice(0, reste.indexOf('/'));
  const chemin = reste.slice(bucket.length + 1);
  try {
    const { data, error } = await obtenirClient().storage.from(bucket).createSignedUrl(chemin, secondes);
    return error || !data?.signedUrl ? null : data.signedUrl;
  } catch {
    return null;
  }
}

export async function lienFichier(url: string): Promise<string | null> {
  if (!estFichierStocke(url)) return url;
  const cache = cacheLiens.get(url);
  if (cache && cache.expire > Date.now()) return cache.lien;
  const reste = url.slice(PREFIXE_STOCKAGE.length);
  const bucket = reste.slice(0, reste.indexOf('/'));
  const chemin = reste.slice(bucket.length + 1);
  try {
    const { data, error } = await obtenirClient().storage.from(bucket).createSignedUrl(chemin, 3600);
    if (error || !data?.signedUrl) return null;
    cacheLiens.set(url, { lien: data.signedUrl, expire: Date.now() + 50 * 60 * 1000 });
    return data.signedUrl;
  } catch {
    return null;
  }
}
