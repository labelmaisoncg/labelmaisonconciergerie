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
 *   d'adresse) augmente la version et ferme aussitôt toutes les sessions.
 *
 * Web Crypto (navigateur, Node 18+) ; imports en « .js » pour Node.
 */
import { b64url, deB64url, empreinte } from './web-push.js';
import type { AccesProprietaire, LienAccesProprietaire } from './types-proprietaire';

export const NOM_COOKIE = 'lm_proprio';
/** Le cookie ne part qu'avec les appels de l'espace propriétaire. */
export const CHEMIN_COOKIE = '/api/espace-proprietaire';
export const DUREE_SESSION_S = 30 * 24 * 3600;
export const DUREE_INVITATION_MS = 7 * 24 * 3600_000;
export const DUREE_CONNEXION_MS = 3600_000;
/** Liens en cours gardés par propriétaire (une demande ne chasse pas l'invitation). */
export const LIENS_MAX = 3;
export const LONGUEUR_SECRET_MIN = 32;

export const secretValide = (s: string | undefined): s is string => typeof s === 'string' && s.length >= LONGUEUR_SECRET_MIN;
export const emailValide = (e: unknown): e is string => typeof e === 'string' && e.length <= 254 && /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/.test(e);
export const normaliserEmail = (e: unknown): string => String(e ?? '').trim().toLowerCase();

const utf8 = (t: string) => new TextEncoder().encode(t);

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
const valable = (l: LienAccesProprietaire, maintenantMs: number) => !l.utiliseLe && Date.parse(l.expireLe) > maintenantMs;

/** Ajoute un lien (les liens utilisés ou expirés tombent, 3 au plus). */
export function avecNouveauLien(acces: AccesProprietaire, empreinteLien: string, motif: LienAccesProprietaire['motif'], maintenantMs: number): AccesProprietaire {
  const lien: LienAccesProprietaire = {
    empreinte: empreinteLien,
    motif,
    creeLe: iso(maintenantMs),
    expireLe: iso(maintenantMs + (motif === 'invitation' ? DUREE_INVITATION_MS : DUREE_CONNEXION_MS)),
  };
  return { ...acces, liens: [...(acces.liens ?? []).filter((l) => valable(l, maintenantMs)), lien].slice(-LIENS_MAX) };
}

/**
 * Invitation (ou nouvelle invitation) du gérant. Une autre adresse ferme les
 * sessions ouvertes et oublie les liens envoyés à l'ancienne.
 */
export function inviter(
  precedent: AccesProprietaire | undefined,
  o: { proprietaireId: string; email: string; par: string; maintenantMs: number },
): AccesProprietaire {
  const email = normaliserEmail(o.email);
  if (!precedent) {
    return { id: o.proprietaireId, proprietaireId: o.proprietaireId, email, statut: 'invite', inviteLe: iso(o.maintenantMs), invitePar: o.par, version: 1, liens: [] };
  }
  const autreAdresse = precedent.email !== email;
  const { retireLe: _retire, ...reste } = precedent;
  return {
    ...reste,
    id: o.proprietaireId,
    proprietaireId: o.proprietaireId,
    email,
    statut: precedent.statut === 'actif' && !autreAdresse ? 'actif' : 'invite',
    inviteLe: iso(o.maintenantMs),
    invitePar: o.par,
    version: autreAdresse && precedent.statut === 'actif' ? precedent.version + 1 : precedent.version,
    liens: autreAdresse ? [] : (precedent.liens ?? []),
  };
}

/** Retrait : plus de lien, toutes les sessions fermées. */
export function retirer(acces: AccesProprietaire, maintenantMs: number): AccesProprietaire {
  return { ...acces, statut: 'retire', retireLe: iso(maintenantMs), version: (acces.version ?? 1) + 1, liens: [] };
}

export type RefusLien = 'inconnu' | 'expire' | 'utilise' | 'retire';

/** Utilise un lien : l'accès devient actif, le lien ne servira plus. */
export async function utiliserLien(
  acces: readonly AccesProprietaire[],
  jeton: unknown,
  maintenantMs: number,
): Promise<{ ok: true; acces: AccesProprietaire } | { ok: false; raison: RefusLien }> {
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
  retire: 'Votre accès à l’espace propriétaire a été retiré. Contactez Label Maison.',
};

/* ---------------------------------------------------------------- session */

export interface SessionProprietaire {
  /** Propriétaire. */
  p: string;
  /** Version de l'accès au moment de la connexion. */
  v: number;
  /** Fin de validité, en secondes. */
  exp: number;
}

const cle = async (secret: string) =>
  (await webCrypto()).subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export async function signerSession(secret: string, s: SessionProprietaire): Promise<string> {
  const corps = b64url(utf8(JSON.stringify({ p: s.p, v: s.v, exp: s.exp })));
  const signature = new Uint8Array(await (await webCrypto()).subtle.sign('HMAC', await cle(secret), utf8(corps)));
  return `${corps}.${b64url(signature)}`;
}

/** Session lue dans le cookie : signature vérifiée (temps constant), pas expirée. */
export async function lireSession(secret: string, valeur: unknown, maintenantS: number): Promise<SessionProprietaire | null> {
  if (typeof valeur !== 'string' || valeur.length > 600) return null;
  const [corps, signature, ...reste] = valeur.split('.');
  if (!corps || !signature || reste.length) return null;
  const sig = deB64url(signature);
  if (sig.length !== 32) return null;
  const ok = await (await webCrypto()).subtle.verify('HMAC', await cle(secret), new Uint8Array(sig), utf8(corps)).catch(() => false);
  if (!ok) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(deB64url(corps))) as Partial<SessionProprietaire>;
    if (typeof s.p !== 'string' || !s.p || typeof s.v !== 'number' || typeof s.exp !== 'number') return null;
    if (s.exp <= maintenantS) return null;
    return { p: s.p, v: s.v, exp: s.exp };
  } catch {
    return null;
  }
}

/** La session correspond toujours à un accès actif, de même version. */
export function sessionEncoreValide(s: SessionProprietaire, acces: AccesProprietaire | undefined): acces is AccesProprietaire {
  return !!acces && acces.id === s.p && acces.proprietaireId === s.p && acces.statut === 'actif' && acces.version === s.v;
}

export function enteteCookie(valeur: string, maxAgeS: number): string {
  return `${NOM_COOKIE}=${valeur}; Path=${CHEMIN_COOKIE}; Max-Age=${maxAgeS}; HttpOnly; Secure; SameSite=Lax`;
}

export const cookieEfface = (): string => enteteCookie('', 0);

export function lireCookie(entete: unknown, nom: string = NOM_COOKIE): string | undefined {
  for (const morceau of String(entete ?? '').split(';')) {
    const i = morceau.indexOf('=');
    if (i > 0 && morceau.slice(0, i).trim() === nom) return morceau.slice(i + 1).trim();
  }
  return undefined;
}
