/**
 * Accès externes à l'ERP (propriétaires, opérations), sans compte : règles
 * pures communes au serveur (api/_acces-externe.ts) et aux pages.
 *
 * Chaque accès appartient à l'espace qui l'a créé (Label Maison, Sens…) :
 * - le lien porte l'espace : « …#espace=<uuid>&jeton=<jeton> » (l'espace
 *   n'est pas secret ; un ancien lien sans espace vaut Label Maison) ;
 * - la session signée porte le genre, la personne, l'espace et la version :
 *   un cookie dont on change l'espace (ou le genre) n'est plus valable, et
 *   l'accès est relu dans la base de CET espace à chaque appel.
 *
 * Imports en « .js » : ce module tourne aussi sous Node (fonctions Vercel).
 */
import { ID_LABEL_MAISON, idEspaceValide } from './espaces.js';
import { b64url, deB64url } from './web-push.js';

export type GenreAcces = 'proprietaire' | 'operations';
export const GENRES_ACCES: GenreAcces[] = ['proprietaire', 'operations'];

/** Lien à usage unique : seule son empreinte (SHA-256) est gardée. */
export interface LienAccesExterne {
  empreinte: string;
  motif: 'invitation' | 'connexion';
  creeLe: string;
  expireLe: string;
  utiliseLe?: string;
}

/** Ce que tout accès externe porte, quel que soit son genre. */
export interface AccesExterne {
  id: string;
  email: string;
  statut: 'invite' | 'actif' | 'retire';
  version: number;
  liens: LienAccesExterne[];
  /** Espace qui a créé l'accès ; absent (accès d'avant les espaces) : Label Maison. */
  espace?: string;
  derniereConnexion?: string;
}

/** Espace d'un accès, d'un lien ou d'une session : Label Maison si absent ou illisible. */
export function espaceDe(espace: unknown): string {
  return idEspaceValide(espace) ? espace.toLowerCase() : ID_LABEL_MAISON;
}

/* ------------------------------------------------------------------ lien */

/** Lien envoyé : page + « #espace=…&jeton=… » (après #, jamais envoyé aux serveurs). */
export function lienAcces(site: string, page: string, espace: string, jeton: string): string {
  return `${site.replace(/\/+$/, '')}${page}#espace=${espaceDe(espace)}&jeton=${jeton}`;
}

/** Lecture du fragment d'un lien ; sans espace (ancien lien) : Label Maison. */
export function lireLienAcces(fragment: string): { jeton?: string; espace: string } {
  const p = new URLSearchParams(String(fragment ?? '').replace(/^#/, ''));
  const jeton = p.get('jeton') ?? undefined;
  return { ...(jeton ? { jeton } : {}), espace: espaceDe(p.get('espace')) };
}

/* -------------------------------------------------------------- session */

export interface SessionExterne {
  /** Genre de l'accès. */
  k: GenreAcces;
  /** Personne (id de l'accès). */
  p: string;
  /** Espace de l'accès. */
  e: string;
  /** Version de l'accès au moment de la connexion. */
  v: number;
  /** Fin de validité, en secondes. */
  exp: number;
}

const utf8 = (t: string) => new TextEncoder().encode(t);

/** Web Crypto du navigateur ou de Node (global à partir de Node 19, module avant). */
async function webCrypto(): Promise<Crypto> {
  const g = (globalThis as { crypto?: Crypto }).crypto;
  if (g?.subtle) return g;
  return ((await import('node:crypto' as string)) as { webcrypto: Crypto }).webcrypto;
}

const cle = async (secret: string) =>
  (await webCrypto()).subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

/** Valeur du cookie : corps base64url + « . » + HMAC-SHA256 du corps. */
export async function signerSessionExterne(secret: string, s: SessionExterne): Promise<string> {
  const corps = b64url(utf8(JSON.stringify({ k: s.k, p: s.p, e: espaceDe(s.e), v: s.v, exp: s.exp })));
  const signature = new Uint8Array(await (await webCrypto()).subtle.sign('HMAC', await cle(secret), utf8(corps)));
  return `${corps}.${b64url(signature)}`;
}

/**
 * Session lue dans le cookie : signature vérifiée (temps constant), pas
 * expirée, du genre attendu. Une session d'avant les espaces (sans genre ni
 * espace) est une session propriétaire de Label Maison.
 */
export async function lireSessionExterne(secret: string, valeur: unknown, genre: GenreAcces, maintenantS: number): Promise<SessionExterne | null> {
  if (typeof valeur !== 'string' || valeur.length > 700) return null;
  const [corps, signature, ...reste] = valeur.split('.');
  if (!corps || !signature || reste.length) return null;
  const sig = deB64url(signature);
  if (sig.length !== 32) return null;
  const ok = await (await webCrypto()).subtle.verify('HMAC', await cle(secret), new Uint8Array(sig), utf8(corps)).catch(() => false);
  if (!ok) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(deB64url(corps))) as Partial<SessionExterne>;
    const k = s.k ?? 'proprietaire';
    if (k !== genre || typeof s.p !== 'string' || !s.p || typeof s.v !== 'number' || typeof s.exp !== 'number') return null;
    if (s.e !== undefined && !idEspaceValide(s.e)) return null;
    if (s.exp <= maintenantS) return null;
    return { k, p: s.p, e: espaceDe(s.e), v: s.v, exp: s.exp };
  } catch {
    return null;
  }
}

/** La session correspond toujours à cet accès : même personne, même espace, actif, même version. */
export function sessionExterneValide(s: SessionExterne, acces: AccesExterne | undefined): acces is AccesExterne {
  return !!acces && acces.id === s.p && espaceDe(acces.espace) === s.e && acces.statut === 'actif' && acces.version === s.v;
}

/* --------------------------------------------------------------- cookie */

export function enteteCookieExterne(nom: string, chemin: string, valeur: string, maxAgeS: number): string {
  return `${nom}=${valeur}; Path=${chemin}; Max-Age=${maxAgeS}; HttpOnly; Secure; SameSite=Lax`;
}

export function lireCookieExterne(entete: unknown, nom: string): string | undefined {
  for (const morceau of String(entete ?? '').split(';')) {
    const i = morceau.indexOf('=');
    if (i > 0 && morceau.slice(0, i).trim() === nom) return morceau.slice(i + 1).trim();
  }
  return undefined;
}
