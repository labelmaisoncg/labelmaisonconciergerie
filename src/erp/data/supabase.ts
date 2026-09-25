/**
 * Accès à la base Supabase de Label Maison : client, authentification,
 * membres de l'équipe, fichiers (photos), et lecture des erreurs.
 *
 * Toutes les tables vivent dans le schéma `erp` (supabase/erp-installation.sql).
 * La synchronisation des données elle-même est dans synchro.ts.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SCHEMA_ERP, SUPABASE_ANON_KEY, SUPABASE_URL, URL_RETOUR_MOT_DE_PASSE } from './config';
import type { RoleUtilisateur, Utilisateur } from './types';

/* ----------------------------------------------------------------- client */

/** Client typé sans schéma généré : les lignes sont lues et écrites en JSON. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClientErp = SupabaseClient<any, any, any>;

let client: ClientErp | null = null;

/**
 * Lien de récupération de mot de passe : lu AVANT que le client Supabase ne
 * nettoie l'adresse (#access_token=...&type=recovery, ou #error=... si expiré).
 */
function lireRetourLien(): { recuperation: boolean; erreur?: string } {
  if (typeof window === 'undefined') return { recuperation: false };
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return { recuperation: false };
  const p = new URLSearchParams(hash);
  const code = p.get('error_code') ?? p.get('error');
  if (code) {
    const expire = /expired|otp/i.test(code + (p.get('error_description') ?? ''));
    return {
      recuperation: false,
      erreur: expire
        ? 'Ce lien a expiré ou a déjà servi. Demandez un nouveau lien avec « Mot de passe oublié ».'
        : 'Ce lien n’est pas valide. Demandez un nouveau lien avec « Mot de passe oublié ».',
    };
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
  [/invalid login credentials/i, 'Mot de passe incorrect.'],
  [/email not confirmed/i, 'Adresse e-mail non confirmée. Demandez à un gérant de confirmer le compte dans Supabase.'],
  [/rate limit|too many/i, 'Trop de tentatives. Patientez une minute avant de réessayer.'],
  [/password should be at least|weak password/i, 'Mot de passe trop court : 8 caractères au minimum.'],
  [/same password|different from the old/i, 'Choisissez un mot de passe différent de l’ancien.'],
  [/user not found/i, 'Aucun compte avec cette adresse.'],
  [/auth session missing|session.*(expired|missing)/i, 'Lien expiré. Demandez un nouveau lien à un gérant.'],
  [/failed to fetch|network/i, 'Connexion impossible. Vérifiez votre accès à internet.'],
];

function traduireAuth(message: string | undefined): string {
  const m = message ?? '';
  return TRADUCTIONS_AUTH.find(([re]) => re.test(m))?.[1] ?? (m ? `Erreur : ${m}` : 'Erreur inattendue.');
}

export type ResultatAuth = { ok: true } | { ok: false; erreur: string };

export async function seConnecter(email: string, motDePasse: string): Promise<ResultatAuth> {
  try {
    const { error } = await obtenirClient().auth.signInWithPassword({ email: email.trim(), password: motDePasse });
    return error ? { ok: false, erreur: traduireAuth(error.message) } : { ok: true };
  } catch (e) {
    return { ok: false, erreur: traduireAuth((e as Error)?.message) };
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

export async function changerMotDePasse(motDePasse: string): Promise<ResultatAuth> {
  try {
    const { error } = await obtenirClient().auth.updateUser({ password: motDePasse });
    return error ? { ok: false, erreur: traduireAuth(error.message) } : { ok: true };
  } catch (e) {
    return { ok: false, erreur: traduireAuth((e as Error)?.message) };
  }
}

export async function seDeconnecter(): Promise<void> {
  try {
    await obtenirClient().auth.signOut();
  } catch {
    /* hors ligne : la session locale est tout de même effacée par Supabase */
  }
}

/* ---------------------------------------------------------------- membres */

export interface Membre {
  email: string;
  nom: string | null;
  role: RoleUtilisateur;
}

export const ROLES_VALIDES: RoleUtilisateur[] = ['gerant', 'operations', 'prestataire', 'lecture'];

/** Membre → Utilisateur de l'ERP (l'id est l'adresse en minuscules). */
export function versUtilisateur(m: Membre): Utilisateur {
  const email = m.email.trim().toLowerCase();
  const nom = m.nom?.trim() || email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return { id: email, nom, email, role: ROLES_VALIDES.includes(m.role) ? m.role : 'lecture' };
}

export type LectureMembres = { ok: true; membres: Utilisateur[] } | { ok: false; erreur: unknown; status?: number };

/** Membres visibles : toute l'équipe pour un membre, sa seule ligne sinon (règles RLS). */
export async function lireMembres(): Promise<LectureMembres> {
  const { data, error, status } = await obtenirClient().from('membres').select('email,nom,role').order('email');
  if (error) return { ok: false, erreur: error, status };
  return { ok: true, membres: ((data ?? []) as Membre[]).map(versUtilisateur) };
}

export async function enregistrerMembre(u: Pick<Utilisateur, 'email' | 'nom' | 'role'>): Promise<ErreurBase | null> {
  const { error } = await obtenirClient()
    .from('membres')
    .upsert({ email: u.email.trim().toLowerCase(), nom: u.nom.trim(), role: u.role }, { onConflict: 'email' });
  return error;
}

export async function retirerMembre(email: string): Promise<ErreurBase | null> {
  const { error } = await obtenirClient().from('membres').delete().eq('email', email.trim().toLowerCase());
  return error;
}

/* -------------------------------------------------------------- fichiers */

/** Espace de stockage privé créé par erp-installation.sql. */
export const BUCKET_FICHIERS = 'erp-fichiers';
/** Préfixe des fichiers stockés dans Supabase (résolus en liens signés à l'affichage). */
export const PREFIXE_STOCKAGE = 'stockage://';

export const estFichierStocke = (url?: string): url is string => !!url && url.startsWith(PREFIXE_STOCKAGE);

/** Envoie un fichier dans l'espace privé ; renvoie l'adresse « stockage://... » à enregistrer. */
export async function televerser(dossier: string, fichier: File): Promise<{ url: string } | { erreur: string }> {
  const extension = (fichier.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  const chemin = `${dossier}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${extension}`;
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
