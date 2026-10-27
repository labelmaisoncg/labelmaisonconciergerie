/**
 * Accès des propriétaires à leur espace, sans compte ni SQL :
 *
 * - le gérant invite (ou le propriétaire demande un lien avec son adresse) :
 *   le serveur crée un jeton aléatoire de 32 octets, l'envoie par e-mail et
 *   n'en garde que l'empreinte SHA-256 (7 jours pour une invitation, 1 heure
 *   pour un lien demandé) ;
 * - le lien ne sert qu'une fois : il ouvre une session, cookie HttpOnly signé
 *   HMAC-SHA256 avec PROPRIETAIRE_SECRET (30 jours) ;
 * - chaque requête revérifie l'accès en base : retirer l'accès (ou changer
 *   d'adresse) augmente la version et ferme aussitôt toutes les sessions ;
 * - l'accès appartient à l'espace qui l'a créé (Label Maison, Sens…) : le
 *   lien et la session le portent (src/erp/data/acces-externe.ts).
 *
 * Les fonctions sur les accès sont génériques : l'espace opérations s'en
 * sert aussi (même forme d'accès, autre collection).
 *
 * Web Crypto (navigateur, Node 18+) ; imports en « .js » pour Node.
 */
import { ID_LABEL_MAISON } from './espaces.js';
import {
  ACCES_RETIRE,
  enteteCookieExterne,
  espaceDe,
  lireCookieExterne,
  lireSessionExterne,
  sessionExterneValide,
  signerSessionExterne,
  type AccesExterne,
  type LienAccesExterne,
} from './acces-externe.js';
import { b64url, empreinte } from './web-push.js';
import type { AccesProprietaire } from './types-proprietaire';

export const NOM_COOKIE = 'lm_proprio';
/** Le cookie ne part qu'avec les appels de l'espace propriétaire. */
export const CHEMIN_COOKIE = '/api/espace-proprietaire';
export const DUREE_SESSION_S = 30 * 24 * 3600;
export const DUREE_INVITATION_MS = 7 * 24 * 3600_000;
export const DUREE_CONNEXION_MS = 3600_000;
/** Liens en cours gardés par accès, pour chaque sorte (invitations, connexions) : une demande ne chasse pas l'invitation. */
export const LIENS_MAX = 3;
export const LONGUEUR_SECRET_MIN = 32;

export const secretValide = (s: string | undefined): s is string => typeof s === 'string' && s.length >= LONGUEUR_SECRET_MIN;
export const emailValide = (e: unknown): e is string => typeof e === 'string' && e.length <= 254 && /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/.test(e);
export const normaliserEmail = (e: unknown): string => String(e ?? '').trim().toLowerCase();

/** Web Crypto du navigateur ou de Node (global à partir de Node 19, module avant). */
async function webCrypto(): Promise<Crypto> {
  const g = (globalThis as { crypto?: Crypto }).crypto;
  if (g?.subtle) return g;
  return ((await import('node:crypto' as string)) as { webcrypto: Crypto }).webcrypto;
}

/* ------------------------------------------------------------------ jeton */

export async function nouveauJeton(): Promise<string> {
  return b64url((await webCrypto()).getRandomValues(new Uint8Array(32)));
}

/** 32 octets en base64url : 43 caractères. */
export const jetonBienForme = (j: unknown): j is string => typeof j === 'string' && /^[A-Za-z0-9_-]{43}$/.test(j);

export const empreinteJeton = (jeton: string): Promise<string> => empreinte(jeton);

const iso = (ms: number) => new Date(ms).toISOString();
const valable = (l: LienAccesExterne, maintenantMs: number) => !l.utiliseLe && Date.parse(l.expireLe) > maintenantMs;

/**
 * Ajoute un lien. Les liens utilisés ou expirés tombent, et chaque sorte est
 * plafonnée à part (LIENS_MAX invitations, LIENS_MAX liens de connexion) :
 * « Recevoir mon lien », que peut demander quiconque connaît l'adresse, ne
 * chasse jamais une invitation encore valable, seulement d'anciens liens de
 * connexion.
 */
export function avecNouveauLien<T extends AccesExterne = AccesProprietaire>(acces: T, empreinteLien: string, motif: LienAccesExterne['motif'], maintenantMs: number): T {
  const lien: LienAccesExterne = {
    empreinte: empreinteLien,
    motif,
    creeLe: iso(maintenantMs),
    expireLe: iso(maintenantMs + (motif === 'invitation' ? DUREE_INVITATION_MS : DUREE_CONNEXION_MS)),
  };
  const liens = [...(acces.liens ?? []).filter((l) => valable(l, maintenantMs)), lien];
  const invitation = (l: LienAccesExterne) => l.motif === 'invitation';
  const gardes = new Set([...liens.filter(invitation).slice(-LIENS_MAX), ...liens.filter((l) => !invitation(l)).slice(-LIENS_MAX)]);
  return { ...acces, liens: liens.filter((l) => gardes.has(l)) };
}

/**
 * Invitation (ou nouvelle invitation) du gérant, dans son espace. Une autre
 * adresse ferme les sessions ouvertes et oublie les liens envoyés à
 * l'ancienne. `espace` absent : Label Maison (base d'avant les espaces).
 */
export function inviter(
  precedent: AccesProprietaire | undefined,
  o: { proprietaireId: string; email: string; par: string; maintenantMs: number; espace?: string },
): AccesProprietaire {
  const email = normaliserEmail(o.email);
  const espace = espaceDe(o.espace ?? precedent?.espace);
  if (!precedent) {
    return { id: o.proprietaireId, proprietaireId: o.proprietaireId, espace, email, statut: 'invite', inviteLe: iso(o.maintenantMs), invitePar: o.par, version: 1, liens: [] };
  }
  const autreAdresse = precedent.email !== email;
  const { retireLe: _retire, ...reste } = precedent;
  return {
    ...reste,
    id: o.proprietaireId,
    proprietaireId: o.proprietaireId,
    espace,
    email,
    statut: precedent.statut === 'actif' && !autreAdresse ? 'actif' : 'invite',
    inviteLe: iso(o.maintenantMs),
    invitePar: o.par,
    version: autreAdresse && precedent.statut === 'actif' ? precedent.version + 1 : precedent.version,
    liens: autreAdresse ? [] : (precedent.liens ?? []),
  };
}

/** Retrait : plus de lien, toutes les sessions fermées. */
export function retirer<T extends AccesExterne = AccesProprietaire>(acces: T, maintenantMs: number): T {
  return { ...acces, statut: 'retire', retireLe: iso(maintenantMs), version: (acces.version ?? 1) + 1, liens: [] };
}

export type RefusLien = 'inconnu' | 'expire' | 'utilise' | 'retire';

/** Utilise un lien : l'accès devient actif, le lien ne servira plus. */
export async function utiliserLien<T extends AccesExterne = AccesProprietaire>(
  acces: readonly T[],
  jeton: unknown,
  maintenantMs: number,
): Promise<{ ok: true; acces: T } | { ok: false; raison: RefusLien }> {
  if (!jetonBienForme(jeton)) return { ok: false, raison: 'inconnu' };
  const h = await empreinteJeton(jeton);
  const a = acces.find((x) => (x?.liens ?? []).some((l) => l.empreinte === h));
  const lien = a?.liens.find((l) => l.empreinte === h);
  if (!a || !lien) return { ok: false, raison: 'inconnu' };
  if (a.statut === 'retire') return { ok: false, raison: 'retire' };
  if (lien.utiliseLe) return { ok: false, raison: 'utilise' };
  if (!(Date.parse(lien.expireLe) > maintenantMs)) return { ok: false, raison: 'expire' };
  const quand = iso(maintenantMs);
  return {
    ok: true,
    acces: { ...a, statut: 'actif', derniereConnexion: quand, liens: a.liens.map((l) => (l === lien ? { ...l, utiliseLe: quand } : l)) },
  };
}

export const MESSAGES_REFUS: Record<RefusLien, string> = {
  inconnu: 'Ce lien n’est pas valable. Demandez un nouveau lien avec votre adresse e-mail.',
  expire: 'Ce lien a expiré. Demandez un nouveau lien avec votre adresse e-mail.',
  utilise: 'Ce lien a déjà servi. Demandez un nouveau lien avec votre adresse e-mail.',
  retire: ACCES_RETIRE,
};

/* ---------------------------------------------------------------- session */

export interface SessionProprietaire {
  /** Propriétaire. */
  p: string;
  /** Version de l'accès au moment de la connexion. */
  v: number;
  /** Fin de validité, en secondes. */
  exp: number;
  /** Espace de l'accès ; absent : Label Maison. */
  e?: string;
}

export async function signerSession(secret: string, s: SessionProprietaire): Promise<string> {
  return signerSessionExterne(secret, { k: 'proprietaire', p: s.p, e: espaceDe(s.e), v: s.v, exp: s.exp });
}

/** Session lue dans le cookie : signature vérifiée (temps constant), pas expirée, d'un propriétaire. */
export async function lireSession(secret: string, valeur: unknown, maintenantS: number): Promise<SessionProprietaire | null> {
  const s = await lireSessionExterne(secret, valeur, 'proprietaire', maintenantS);
  return s ? { p: s.p, v: s.v, exp: s.exp, e: s.e } : null;
}

/** La session correspond toujours à un accès actif, de même version, dans le même espace. */
export function sessionEncoreValide(s: SessionProprietaire, acces: AccesProprietaire | undefined): acces is AccesProprietaire {
  return (
    !!acces &&
    acces.proprietaireId === s.p &&
    sessionExterneValide({ k: 'proprietaire', p: s.p, e: espaceDe(s.e ?? ID_LABEL_MAISON), v: s.v, exp: s.exp }, acces)
  );
}

export function enteteCookie(valeur: string, maxAgeS: number): string {
  return enteteCookieExterne(NOM_COOKIE, CHEMIN_COOKIE, valeur, maxAgeS);
}

export const cookieEfface = (): string => enteteCookie('', 0);

export function lireCookie(entete: unknown, nom: string = NOM_COOKIE): string | undefined {
  return lireCookieExterne(entete, nom);
}
