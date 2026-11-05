/**
 * Connexion de Claude au CRM par OAuth 2.1 (code d'autorisation + PKCE) :
 * règles partagées par les routes serveur (api/) et la page d'autorisation de
 * l'ERP. Aucune dépendance Node : s'exécute aussi dans le navigateur.
 *
 * Parcours : claude.ai découvre le serveur d'autorisation (middleware.ts,
 * /.well-known/…), s'enregistre (/api/oauth-register), envoie le gérant sur
 * /erp/autoriser-claude, puis échange le code contre un jeton (/api/oauth-token).
 *
 * Chaque autorisation appartient à l'ESPACE du gérant qui l'a donnée : le
 * code, les jetons et les liens d'agenda d'un autre espace que Label Maison
 * portent l'identifiant de cet espace (avecEspace), et ne sont cherchés que
 * dans sa base. Label Maison garde la forme d'avant (valeur seule).
 *
 * Seul un gérant qui se connecte avec SON compte autorise Claude : jamais un
 * compte technique (estCompteTechnique), dont le serveur se sert pour lire et
 * écrire la base.
 */
import { EMAIL_SERVEUR, ID_LABEL_MAISON, estLabelMaison, idEspaceValide } from './espaces.js';

export const ORIGINE_SITE = 'https://www.labelmaisoncg.fr';

/** Adresse comparée : minuscules, sans aucun espace (copier-coller, saisie). */
const adresseComparee = (email: unknown): string => (typeof email === 'string' ? email.replace(/\s+/g, '').toLowerCase() : '');

/**
 * Compte technique : le compte serveur (EMAIL_SERVEUR) ou le compte d'équipe,
 * dont l'adresse vient de la configuration (`emailEquipe` : configuration().email
 * côté serveur, EMAIL_EQUIPE dans l'application ; VITE_ERP_EMAIL_EQUIPE ou
 * equipe@labelmaisoncg.fr). Le serveur lit et écrit la base avec eux (site →
 * CRM, synchronisation, agent, connecteur) : ils restent, mais ne connectent
 * jamais Claude et ne comptent pas comme membres de l'équipe.
 */
export function estCompteTechnique(email: unknown, emailEquipe: string): boolean {
  const a = adresseComparee(email);
  return !!a && (a === adresseComparee(EMAIL_SERVEUR) || a === adresseComparee(emailEquipe));
}

/** Refus de « Autoriser » pour un compte technique (route /api/erp-connecteur-claude). */
export const MESSAGE_AUTORISER_COMPTE_TECHNIQUE =
  'Le compte technique ne peut pas connecter Claude : connectez-vous à l’ERP avec votre propre compte de gérant, puis relancez la connexion depuis Claude.';
/** Code ou jeton d'une autorisation donnée avec un compte technique (invalid_grant). */
export const MESSAGE_OAUTH_COMPTE_TECHNIQUE = 'Connexion faite avec le compte technique : reconnectez Claude avec votre propre compte de gérant.';
/** Écrans « Connecter à Claude » et « Autoriser », ouverts avec un compte technique. */
export const PHRASE_COMPTE_TECHNIQUE = 'Vous êtes connecté avec le compte technique : connectez-vous avec votre propre compte pour relier Claude.';

/**
 * « Connecté par … » sous l'état de la connexion : `par` (adresses des gérants
 * dont une connexion est active, rendues par le serveur), `moi` (l'adresse de
 * la personne connectée), `nom` (le nom que l'ERP connaît pour une adresse,
 * sinon l'adresse). null : personne à nommer.
 */
export function connectePar(par: readonly string[], moi: string, nom: (email: string) => string): string | null {
  const vous = adresseComparee(moi);
  const vus = new Set<string>();
  let parVous = false;
  const autres: string[] = [];
  for (const brut of par) {
    const a = adresseComparee(brut);
    if (!a || vus.has(a)) continue;
    vus.add(a);
    if (a === vous) parVous = true;
    else autres.push(nom(a));
  }
  const noms = [...(parVous ? ['vous'] : []), ...autres];
  if (!noms.length) return null;
  const liste = noms.length === 1 ? noms[0] : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
  return `Connecté par ${liste}`;
}

/** Valeur aléatoire d'un code, d'un jeton ou d'une clé d'agenda (256 bits en base64url). */
const ALEATOIRE = /^[A-Za-z0-9_-]{43}$/;

/**
 * Code, jeton ou clé d'agenda d'un espace : « <identifiant de l'espace>.<valeur> » ;
 * Label Maison : la valeur seule, comme avant les espaces.
 */
export function avecEspace(espace: string, valeur: string): string {
  return estLabelMaison(espace) ? valeur : `${espace.toLowerCase()}.${valeur}`;
}

/**
 * Espace d'un code, d'un jeton ou d'une clé d'agenda. Sans préfixe : Label
 * Maison (forme d'avant). null : forme invalide, dont un préfixe Label Maison
 * (jamais émis) ou en majuscules. Le préfixe seul ne prouve rien : seule
 * l'empreinte de la valeur COMPLÈTE est gardée, dans la base de cet espace.
 */
export function espaceDuJeton(jeton: unknown): string | null {
  if (typeof jeton !== 'string') return null;
  if (ALEATOIRE.test(jeton)) return ID_LABEL_MAISON;
  const espace = jeton.slice(0, 36);
  if (jeton.charAt(36) !== '.' || !ALEATOIRE.test(jeton.slice(37))) return null;
  if (!idEspaceValide(espace) || espace !== espace.toLowerCase() || estLabelMaison(espace)) return null;
  return espace;
}
/** Adresse du connecteur à coller dans Claude (ne contient aucun secret). */
export const ADRESSE_CONNECTEUR = `${ORIGINE_SITE}/api/crm-mcp`;
/** Métadonnées de la ressource protégée (RFC 9728), servies par le middleware. */
export const META_RESSOURCE = `${ORIGINE_SITE}/.well-known/oauth-protected-resource/api/crm-mcp`;

/**
 * Adresses de retour acceptées : Claude sur le web (claude.ai, claude.com) et
 * les applications installées sur l'ordinateur (Claude Desktop, Claude Code),
 * qui écoutent sur localhost. Toute autre adresse est refusée : le code
 * d'autorisation ne peut partir que vers Claude.
 */
export function redirectionPermise(uri: unknown): uri is string {
  if (typeof uri !== 'string' || uri.length > 500) return false;
  if (/^https:\/\/(claude\.ai|claude\.com)\/api\/mcp\/auth_callback$/.test(uri)) return true;
  try {
    const u = new URL(uri);
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && !u.username && !u.password && !u.hash;
  } catch {
    return false;
  }
}

/**
 * Qui demande l'accès, pour la page d'autorisation : le nom d'hôte de
 * l'adresse de retour (exigé par la spécification MCP), et s'il s'agit d'une
 * application de l'ordinateur (localhost), qui mérite un avertissement.
 */
export function demandeur(uri: string): { hote: string; local: boolean } {
  try {
    const u = new URL(uri);
    return { hote: u.hostname, local: u.protocol === 'http:' };
  } catch {
    return { hote: uri, local: false };
  }
}

export interface DemandeAutorisation {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  state?: string;
}

/**
 * Contrôle d'une demande d'autorisation (paramètres de l'adresse envoyée par
 * Claude). Renvoie la demande nettoyée, ou la raison du refus.
 */
export function lireDemande(p: Record<string, unknown>): { ok: true; demande: DemandeAutorisation } | { ok: false; raison: string } {
  const texte = (v: unknown) => (typeof v === 'string' ? v : '');
  if (texte(p.response_type) && texte(p.response_type) !== 'code') return { ok: false, raison: 'type de réponse non pris en charge' };
  const client_id = texte(p.client_id);
  // Identifiant issu de l'inscription, ou adresse d'un document de métadonnées (CIMD).
  if (!/^[\x21-\x7e]{1,300}$/.test(client_id)) return { ok: false, raison: 'identifiant de client absent ou invalide' };
  const redirect_uri = texte(p.redirect_uri);
  if (!redirectionPermise(redirect_uri)) return { ok: false, raison: 'adresse de retour non autorisée' };
  // PKCE obligatoire (OAuth 2.1), méthode S256 seulement.
  if (texte(p.code_challenge_method) !== 'S256') return { ok: false, raison: 'PKCE S256 requis' };
  const code_challenge = texte(p.code_challenge);
  if (!/^[A-Za-z0-9_-]{43}$/.test(code_challenge)) return { ok: false, raison: 'défi PKCE invalide' };
  const ressource = texte(p.resource);
  if (ressource && ressource.replace(/\/+$/, '') !== ADRESSE_CONNECTEUR) return { ok: false, raison: 'ressource inconnue' };
  const state = texte(p.state);
  if (state.length > 1000) return { ok: false, raison: 'paramètre state trop long' };
  return { ok: true, demande: { client_id, redirect_uri, code_challenge, ...(state ? { state } : {}) } };
}

/** Retour vers Claude après la décision du gérant. */
export function adresseRetour(redirect_uri: string, params: Record<string, string | undefined>): string {
  const u = new URL(redirect_uri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, v);
  return u.toString();
}
