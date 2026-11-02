/**
 * Compte Supabase d'une personne des espaces extérieurs (propriétaires ;
 * opérations plus tard, même mécanique) : création (adresse et mot de passe,
 * confirmation par e-mail), connexion, mot de passe oublié, et le code
 * d'invitation gardé sur l'appareil jusqu'à l'activation.
 *
 * Le client Supabase d'ici n'a pas de session durable (persistSession: false,
 * rangement propre à chaque genre) : le jeton ne sert qu'à prouver l'identité
 * auprès de notre serveur (actions « activer » et « entrer » de la route de
 * l'espace), puis la session locale est fermée (fermerSessionExterne). La
 * session de l'espace, c'est le cookie posé par le serveur. La personne ne
 * lit jamais la base par ce client : les règles RLS ne lui ouvrent rien
 * (recettes des fichiers supabase/*.sql).
 *
 * Règles pures (liens, code gardé, mot de passe) : acces-externe.ts.
 * Module du navigateur seulement (pas importé par le serveur).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  CLES_INVITATION_ACCES,
  MESSAGE_NON_CONFIRME,
  MOT_DE_PASSE_MIN,
  codeAccesPour,
  interpreterInscription,
  invitationAccesAGarder,
  lireInvitationAccesGardee,
  lireRetourLienExterne,
  urlRetourAcces,
  type GenreAcces,
  type InvitationAccesGardee,
  type RetourLienExterne,
} from './acces-externe';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

/* ------------------------------------------------------- lien reçu */

/**
 * Lien reçu par e-mail au chargement de la page, lu AVANT que le client
 * Supabase ne nettoie l'adresse. Invitation ou erreur : retirés de l'adresse
 * aussitôt (historique, partage d'écran) ; les jetons de Supabase, c'est le
 * client qui les retire en les lisant.
 */
export const RETOUR_LIEN_EXTERNE: RetourLienExterne = (() => {
  if (typeof window === 'undefined') return { nature: 'rien' };
  const r = lireRetourLienExterne(window.location.hash);
  if (r.nature === 'creer' || r.nature === 'erreur') window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  return r;
})();

/** Retire ce qui reste du fragment (« # » seul laissé par Supabase, que location.hash rend vide, ou un lien lu en démonstration). */
export function nettoyerAdresse(): void {
  if (typeof window !== 'undefined' && window.location.href.includes('#')) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
}

/* ---------------------------------------------------------- client */

const clients = new Map<GenreAcces, SupabaseClient>();

/** Client Supabase du genre (créé au premier appel) : session en mémoire seulement, lien reçu lu dans l'adresse. */
function client(genre: GenreAcces): SupabaseClient {
  let c = clients.get(genre);
  if (!c) {
    c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: true, flowType: 'implicit', storageKey: `lm-${genre}-auth` },
    });
    clients.set(genre, c);
  }
  return c;
}

/* --------------------------------------------------------- erreurs */

const TRADUCTIONS: [RegExp, string][] = [
  [/invalid login credentials|invalid_credentials/i, 'Adresse ou mot de passe incorrect.'],
  [/email not confirmed|email_not_confirmed/i, MESSAGE_NON_CONFIRME],
  [/rate limit|too many|over_email_send_rate_limit|over_request_rate_limit/i, 'Trop de tentatives. Patientez une minute avant de réessayer.'],
  [/password should be at least|weak password|weak_password/i, `Mot de passe trop simple : ${MOT_DE_PASSE_MIN} caractères au moins, mélangez lettres, chiffres et signes.`],
  [/same password|different from the old|same_password/i, 'Choisissez un mot de passe différent de l’ancien.'],
  [/auth session missing|session.*(expired|missing)|refresh_token_not_found/i, 'Ce lien a expiré ou a déjà servi. Demandez un nouveau lien avec « Mot de passe oublié ? ».'],
  [/signup.?disabled|signups? not allowed/i, 'La création de compte n’est pas ouverte pour le moment. Contactez votre conciergerie.'],
  [/email_address_not_authorized|not authorized/i, 'L’e-mail de confirmation ne peut pas partir pour le moment. Contactez votre conciergerie.'],
  [/email_address_invalid|invalid format|unable to validate email/i, 'Adresse e-mail invalide.'],
  [/failed to fetch|network|load failed/i, 'Connexion impossible. Vérifiez votre accès à internet.'],
];

function traduire(e: unknown): string {
  const err = (e ?? {}) as { code?: unknown; message?: unknown };
  const texte = `${String(err.code ?? '')} ${String(err.message ?? (typeof e === 'string' ? e : ''))}`;
  return TRADUCTIONS.find(([re]) => re.test(texte))?.[1] ?? 'Une erreur est survenue. Réessayez dans un instant.';
}

export type ResultatCompte = { ok: true; jeton: string } | { ok: false; erreur: string };

/* --------------------------------------------------------- comptes */

/**
 * « Créer mon compte » : inscription auprès de Supabase, lien de confirmation
 * vers la page de l'espace (site fixe). Un compte déjà créé à cette adresse
 * (Supabase le signale au navigateur : utilisateur factice sans identité,
 * aucun e-mail envoyé) : `existe`, la personne se connecte. Supabase rend une
 * session seulement si la confirmation d'adresse est coupée dans ses
 * réglages : on la remet alors tout de suite au serveur (jeton), qui exige
 * quand même une adresse confirmée.
 */
export async function creerCompteExterne(genre: GenreAcces, email: string, motDePasse: string): Promise<{ ok: true; existe?: boolean; jeton?: string } | { ok: false; erreur: string }> {
  try {
    const { data, error } = await client(genre).auth.signUp({ email: email.trim().toLowerCase(), password: motDePasse, options: { emailRedirectTo: urlRetourAcces(genre) } });
    const suite = interpreterInscription(data, error);
    if (suite.etat === 'erreur') return { ok: false, erreur: traduire(error) };
    if (suite.etat === 'session') return { ok: true, jeton: suite.jeton };
    return suite.etat === 'existe' ? { ok: true, existe: true } : { ok: true };
  } catch (e) {
    return { ok: false, erreur: traduire(e) };
  }
}

/** Connexion par adresse et mot de passe : le jeton à remettre au serveur. */
export async function seConnecterExterne(genre: GenreAcces, email: string, motDePasse: string): Promise<ResultatCompte> {
  try {
    const { data, error } = await client(genre).auth.signInWithPassword({ email: email.trim().toLowerCase(), password: motDePasse });
    if (error) return { ok: false, erreur: traduire(error) };
    return data.session?.access_token ? { ok: true, jeton: data.session.access_token } : { ok: false, erreur: traduire(undefined) };
  } catch (e) {
    return { ok: false, erreur: traduire(e) };
  }
}

/** Session posée par un lien reçu (confirmation, mot de passe oublié) ; null : aucune. */
export async function sessionExterne(genre: GenreAcces): Promise<{ jeton: string; email: string } | null> {
  try {
    const { data } = await client(genre).auth.getSession();
    const s = data.session;
    return s?.access_token ? { jeton: s.access_token, email: String(s.user?.email ?? '').trim().toLowerCase() } : null;
  } catch {
    return null;
  }
}

/** « Mot de passe oublié ? » : Supabase envoie un lien qui ramène sur la page de l'espace. Même réponse qu'un compte existe ou non. */
export async function envoyerLienMotDePasseExterne(genre: GenreAcces, email: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  try {
    const { error } = await client(genre).auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: urlRetourAcces(genre) });
    if (error && /rate limit|too many|over_/i.test(`${error.code ?? ''} ${error.message}`)) return { ok: false, erreur: traduire(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erreur: traduire(e) };
  }
}

/**
 * Nouveau mot de passe (lien de récupération ouvert) : les autres sessions du
 * compte se ferment (qui l'aurait ouvert avant n'a plus la main ; Supabase le
 * fait au changement de mot de passe, on le demande aussi). La page se
 * reconnecte ensuite avec ce mot de passe : le serveur n'active qu'ainsi.
 */
export async function changerMotDePasseExterne(genre: GenreAcces, motDePasse: string): Promise<ResultatCompte> {
  try {
    const { error } = await client(genre).auth.updateUser({ password: motDePasse });
    if (error) return { ok: false, erreur: traduire(error) };
    await client(genre).auth.signOut({ scope: 'others' }).catch(() => undefined);
    const s = await sessionExterne(genre);
    return s ? { ok: true, jeton: s.jeton } : { ok: false, erreur: traduire({ message: 'auth session missing' }) };
  } catch (e) {
    return { ok: false, erreur: traduire(e) };
  }
}

/** Ferme la session Supabase locale : rien ne reste dans le navigateur, la session de l'espace est le cookie. */
export async function fermerSessionExterne(genre: GenreAcces): Promise<void> {
  try {
    await client(genre).auth.signOut({ scope: 'local' });
  } catch {
    /* rien à fermer */
  }
}

/* ---------------------------------- code d'invitation gardé sur l'appareil */

export function invitationAccesGardee(genre: GenreAcces): InvitationAccesGardee | null {
  try {
    return lireInvitationAccesGardee(window.localStorage.getItem(CLES_INVITATION_ACCES[genre]));
  } catch {
    return null;
  }
}

export function garderInvitationAcces(genre: GenreAcces, l: { email: string; code: string; espace: string }): void {
  try {
    window.localStorage.setItem(CLES_INVITATION_ACCES[genre], JSON.stringify(invitationAccesAGarder(l)));
  } catch {
    /* navigation privée : le code ne vit que le temps de la page */
  }
}

export function oublierInvitationAcces(genre: GenreAcces): void {
  try {
    window.localStorage.removeItem(CLES_INVITATION_ACCES[genre]);
  } catch {
    /* rien à effacer */
  }
}

/** Code gardé pour ce compte (même adresse), avec son espace ; sinon undefined. */
export const codeInvitationAccesDe = (genre: GenreAcces, email: string): { code: string; espace: string } | undefined => codeAccesPour(invitationAccesGardee(genre), email);
