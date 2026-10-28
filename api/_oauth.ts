// =============================================================================
// OAuth 2.1 du connecteur Claude (codes, jetons d'accès, jetons de
// rafraîchissement). Règles d'entrée : src/erp/data/oauth-regles.ts.
//
// Rien de secret n'est gardé en clair : la collection technique `connecteurs`
// de erp.enregistrements ne contient que des EMPREINTES (SHA-256) des codes et
// des jetons, qui sont des valeurs aléatoires de 256 bits. « Déconnecter
// Claude » pose une date de révocation : tout jeton émis avant est refusé.
//
// Une autorisation par ESPACE : le code et les jetons sont rangés dans la
// base de l'espace du gérant qui a autorisé (`base` en paramètre), avec cet
// espace ; ceux d'un autre espace que Label Maison portent son identifiant
// (avecEspace, oauth-regles.ts), pour que /api/oauth-token et /api/crm-mcp
// sachent où les chercher. L'empreinte couvre la valeur complète : changer
// le préfixe donne un jeton inconnu partout. Anciens jetons, sans espace :
// Label Maison.
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import crypto from 'node:crypto';
import { ID_LABEL_MAISON } from '../src/erp/data/espaces.js';
import type { BaseErp } from '../src/erp/data/repull-synchro.js';
import { avecEspace, espaceDuJeton, type DemandeAutorisation } from '../src/erp/data/oauth-regles.js';

const COLLECTION = 'connecteurs';
const REVOCATION = 'oauth-revocation';
const DUREE_CODE_MS = 10 * 60_000;
const DUREE_ACCES_S = 7 * 24 * 3600;
const DUREE_RAFRAICH_MS = 90 * 24 * 3600_000;
const AUTEUR = 'ERP';

const empreinte = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const aleatoire = () => crypto.randomBytes(32).toString('base64url');
const idCode = (code: string) => `oauth-code-${empreinte(code)}`;
const idJeton = (jeton: string) => `oauth-jeton-${empreinte(jeton)}`;
/** Espace d'un code ou d'un jeton rangé (ancien, sans espace : Label Maison). */
const espaceDe = (e: { espace?: unknown }) => (typeof e.espace === 'string' ? e.espace.toLowerCase() : ID_LABEL_MAISON);

interface Code {
  id: string;
  type: 'code';
  client: string;
  redirection: string;
  defi: string;
  par: string;
  /** Espace de l'autorisation (absent sur les anciens codes : Label Maison). */
  espace?: string;
  creeLe: string;
  expire: string;
  utilise?: boolean;
}

interface Jeton {
  id: string;
  type: 'acces' | 'rafraich';
  /** Une famille par autorisation : la rotation la garde, une réutilisation la révoque entière. */
  famille: string;
  client: string;
  par: string;
  /** Espace de l'autorisation (absent sur les anciens jetons : Label Maison). */
  espace?: string;
  creeLe: string;
  expire: string;
  revoque?: boolean;
}

/** Erreur OAuth renvoyée telle quelle au client (RFC 6749 §5.2). */
export class ErreurOAuth extends Error {
  constructor(
    readonly code: 'invalid_request' | 'invalid_grant' | 'unsupported_grant_type' | 'invalid_client',
    message: string,
  ) {
    super(message);
  }
}

export interface Jetons {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: 'crm';
}

function egales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Lit un enregistrement et la date de révocation en une seule requête. */
async function lireAvecRevocation<T>(base: BaseErp, id: string): Promise<{ element?: T; revoqueAvant: number }> {
  const lus = await base.lire<{ id: string; avant?: string }>(COLLECTION, [id, REVOCATION]);
  const revocation = lus.find((l) => l.id === REVOCATION);
  return {
    element: lus.find((l) => l.id === id) as T | undefined,
    revoqueAvant: revocation?.avant ? Date.parse(revocation.avant) || 0 : 0,
  };
}

/**
 * Code d'autorisation à usage unique (10 min), lié au client, à l'adresse de
 * retour, au défi PKCE et à l'espace du gérant (`base` : la base de cet espace).
 */
export async function creerCode(base: BaseErp, d: DemandeAutorisation, par: string, espace: string = ID_LABEL_MAISON): Promise<string> {
  const code = avecEspace(espace, aleatoire());
  const element: Code = {
    id: idCode(code),
    type: 'code',
    client: d.client_id,
    redirection: d.redirect_uri,
    defi: d.code_challenge,
    par,
    espace: espace.toLowerCase(),
    creeLe: new Date().toISOString(),
    expire: new Date(Date.now() + DUREE_CODE_MS).toISOString(),
  };
  await base.ecrire(COLLECTION, [element], AUTEUR);
  return code;
}

async function emettre(base: BaseErp, client: string, par: string, famille: string, espace: string): Promise<Jetons> {
  const acces = avecEspace(espace, aleatoire());
  const rafraich = avecEspace(espace, aleatoire());
  const maintenant = Date.now();
  const creeLe = new Date(maintenant).toISOString();
  const elements: Jeton[] = [
    { id: idJeton(acces), type: 'acces', famille, client, par, espace, creeLe, expire: new Date(maintenant + DUREE_ACCES_S * 1000).toISOString() },
    { id: idJeton(rafraich), type: 'rafraich', famille, client, par, espace, creeLe, expire: new Date(maintenant + DUREE_RAFRAICH_MS).toISOString() },
  ];
  await base.ecrire(COLLECTION, elements, AUTEUR);
  return { access_token: acces, token_type: 'Bearer', expires_in: DUREE_ACCES_S, refresh_token: rafraich, scope: 'crm' };
}

/**
 * grant_type=authorization_code : vérifie le code, PKCE et l'adresse de
 * retour, puis émet les jetons. `base` : celle de l'espace du code
 * (espaceDuJeton) ; un code rangé pour un autre espace est refusé.
 */
export async function echangerCode(
  base: BaseErp,
  p: { code: string; code_verifier: string; redirect_uri: string; client_id?: string },
): Promise<Jetons> {
  if (!p.code || !p.code_verifier || !p.redirect_uri) throw new ErreurOAuth('invalid_request', 'code, code_verifier et redirect_uri sont requis.');
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(p.code_verifier)) throw new ErreurOAuth('invalid_request', 'code_verifier invalide.');
  const espace = espaceDuJeton(p.code);
  // Un code émis avant « Déconnecter Claude » ne vaut plus rien.
  const { element: c, revoqueAvant } = espace ? await lireAvecRevocation<Code>(base, idCode(p.code)) : { element: undefined, revoqueAvant: 0 };
  if (!c || c.type !== 'code' || c.utilise || espaceDe(c) !== espace || Date.parse(c.expire) < Date.now() || Date.parse(c.creeLe) < revoqueAvant) {
    throw new ErreurOAuth('invalid_grant', 'Code inconnu, expiré ou déjà utilisé.');
  }
  if (c.redirection !== p.redirect_uri) throw new ErreurOAuth('invalid_grant', 'redirect_uri différente de celle de la demande.');
  if (p.client_id && p.client_id !== c.client) throw new ErreurOAuth('invalid_grant', 'Code émis pour un autre client.');
  const defi = crypto.createHash('sha256').update(p.code_verifier).digest('base64url');
  if (!egales(defi, c.defi)) throw new ErreurOAuth('invalid_grant', 'Vérification PKCE échouée.');
  await base.ecrire(COLLECTION, [{ ...c, utilise: true } as Code], AUTEUR);
  return emettre(base, c.client, c.par, crypto.randomBytes(12).toString('hex'), espaceDe(c));
}

/** grant_type=refresh_token : rotation (l'ancien jeton de rafraîchissement est révoqué). `base` : celle de l'espace du jeton. */
export async function rafraichir(base: BaseErp, p: { refresh_token: string; client_id?: string }): Promise<Jetons> {
  if (!p.refresh_token) throw new ErreurOAuth('invalid_request', 'refresh_token requis.');
  const espace = espaceDuJeton(p.refresh_token);
  const lu = espace ? await lireAvecRevocation<Jeton>(base, idJeton(p.refresh_token)) : { element: undefined, revoqueAvant: 0 };
  // Rangé pour un autre espace : inconnu ici (jamais de révocation croisée).
  const j = lu.element && espaceDe(lu.element) === espace ? lu.element : undefined;
  // Jeton déjà échangé puis présenté de nouveau : il a pu être volé. Toute sa famille est révoquée (OAuth 2.1).
  if (j?.type === 'rafraich' && j.revoque && j.famille) await revoquerFamille(base, j.famille);
  if (!j || j.type !== 'rafraich' || j.revoque || Date.parse(j.expire) < Date.now() || Date.parse(j.creeLe) < lu.revoqueAvant) {
    throw new ErreurOAuth('invalid_grant', 'Jeton de rafraîchissement inconnu, expiré ou révoqué.');
  }
  if (p.client_id && p.client_id !== j.client) throw new ErreurOAuth('invalid_grant', 'Jeton émis pour un autre client.');
  await base.ecrire(COLLECTION, [{ ...j, revoque: true } as Jeton], AUTEUR);
  return emettre(base, j.client, j.par, j.famille ?? crypto.randomBytes(12).toString('hex'), espaceDe(j));
}

async function revoquerFamille(base: BaseErp, famille: string): Promise<void> {
  const tous = await base.lire<Jeton>(COLLECTION);
  const actifs = tous.filter((t) => t.famille === famille && !t.revoque);
  if (actifs.length) await base.ecrire(COLLECTION, actifs.map((t) => ({ ...t, revoque: true })), AUTEUR);
  cache.clear();
}

// Jetons d'accès gardés 1 min par instance : valides (une déconnexion prend
// effet en 1 min au plus) et refusés (un jeton révoqué que Claude rejoue ne
// relit pas la base à chaque appel).
const DUREE_CACHE_MS = 60_000;
const cache = new Map<string, { par: string | null; client?: string; jusqua: number }>();

/**
 * Jeton d'accès valide ? Renvoie le membre qui a autorisé Claude et le client
 * OAuth (trace des actions de Claude). `base` : celle de l'espace du jeton
 * (espaceDuJeton) ; un jeton rangé pour un autre espace est refusé.
 */
export async function accesValide(base: BaseErp, jeton: string): Promise<{ par: string; client?: string } | null> {
  const espace = espaceDuJeton(jeton);
  if (!espace) return null;
  const id = idJeton(jeton);
  const enCache = cache.get(id);
  if (enCache && enCache.jusqua > Date.now()) return enCache.par ? { par: enCache.par, ...(enCache.client ? { client: enCache.client } : {}) } : null;
  const { element: j, revoqueAvant } = await lireAvecRevocation<Jeton>(base, id);
  const expire = j ? Date.parse(j.expire) : 0;
  const valide = !!j && j.type === 'acces' && !j.revoque && espaceDe(j) === espace && expire >= Date.now() && Date.parse(j.creeLe) >= revoqueAvant;
  if (cache.size > 1000) cache.clear();
  cache.set(id, { par: valide ? j!.par : null, ...(valide && j!.client ? { client: j!.client } : {}), jusqua: valide ? Math.min(Date.now() + DUREE_CACHE_MS, expire) : Date.now() + DUREE_CACHE_MS });
  return valide ? { par: j!.par, ...(j!.client ? { client: j!.client } : {}) } : null;
}

/** Connexions en cours dans l'espace de `base` (une par application autorisée), pour la fenêtre « Connecter à Claude ». */
export async function etatConnexions(base: BaseErp): Promise<{ connexions: number; derniere?: string }> {
  const tous = await base.lire<Partial<Jeton> & { id: string; avant?: string }>(COLLECTION);
  const revoqueAvant = Date.parse(tous.find((t) => t.id === REVOCATION)?.avant ?? '') || 0;
  const actifs = tous.filter(
    (t): t is Jeton =>
      t.type === 'rafraich' && !t.revoque && Date.parse(t.expire ?? '') > Date.now() && Date.parse(t.creeLe ?? '') >= revoqueAvant,
  );
  const derniere = actifs.map((t) => t.creeLe).sort().pop();
  return { connexions: actifs.length, ...(derniere ? { derniere } : {}) };
}

/** « Déconnecter Claude » : tous les jetons émis jusqu'ici dans l'espace de `base` sont refusés (les autres espaces gardent les leurs). */
export async function deconnecterTout(base: BaseErp): Promise<void> {
  await base.ecrire(COLLECTION, [{ id: REVOCATION, avant: new Date().toISOString() } as { id: string }], AUTEUR);
  cache.clear();
}

/** Tests : oublie les jetons gardés en mémoire. */
export function oublierJetonsGardes(): void {
  cache.clear();
}
