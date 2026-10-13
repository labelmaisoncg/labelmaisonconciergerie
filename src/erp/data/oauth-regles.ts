/**
 * Connexion de Claude au CRM par OAuth 2.1 (code d'autorisation + PKCE) :
 * règles partagées par les routes serveur (api/) et la page d'autorisation de
 * l'ERP. Aucune dépendance Node : s'exécute aussi dans le navigateur.
 *
 * Parcours : claude.ai découvre le serveur d'autorisation (middleware.ts,
 * /.well-known/…), s'enregistre (/api/oauth-register), envoie le gérant sur
 * /erp/autoriser-claude, puis échange le code contre un jeton (/api/oauth-token).
 */

export const ORIGINE_SITE = 'https://www.labelmaisoncg.fr';
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
