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

/** Accès retiré : la même phrase partout (lien, session, action), espace propriétaire et opérations. */
export const ACCES_RETIRE = 'Votre accès a été retiré. Contactez votre conciergerie.';
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
  /** Adresse de la fiche (propriétaire, membre de l'équipe) relevée à l'invitation ('' : fiche sans adresse). */
  emailFiche?: string;
}

/** Espace d'un accès, d'un lien ou d'une session : Label Maison si absent ou illisible. */
export function espaceDe(espace: unknown): string {
  return idEspaceValide(espace) ? espace.toLowerCase() : ID_LABEL_MAISON;
}

const adresse = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/**
 * L'accès vaut toujours pour la personne de la fiche : si le gérant a mis une
 * autre adresse dans la fiche (personne partie) sans « Retirer », l'ancienne
 * adresse ne reçoit plus de lien et sa session tombe.
 * - fiche introuvable : non ;
 * - adresse de la fiche = celle de l'accès : oui ;
 * - sinon : oui seulement si c'est encore l'adresse relevée à l'invitation ;
 * - accès d'avant ce relevé : oui seulement si la fiche n'a pas d'adresse.
 */
export function accesToujoursDeLaFiche(acces: AccesExterne, fiche: { email?: unknown } | undefined): boolean {
  if (!fiche) return false;
  const actuelle = adresse(fiche.email);
  if (actuelle && actuelle === adresse(acces.email)) return true;
  return typeof acces.emailFiche === 'string' ? actuelle === adresse(acces.emailFiche) : actuelle === '';
}

/** Délai entre deux liens de connexion demandés pour un même accès (« Recevoir mon lien »). */
export const DELAI_ENTRE_LIENS_MS = 2 * 60_000;

/** Un lien de connexion a déjà été envoyé à cet accès il y a moins de DELAI_ENTRE_LIENS_MS. */
export function lienDeConnexionRecent(acces: AccesExterne, maintenantMs: number): boolean {
  return (acces.liens ?? []).some((l) => l?.motif === 'connexion' && maintenantMs - Date.parse(l.creeLe) < DELAI_ENTRE_LIENS_MS);
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

/* ---------------------------------------------- page de connexion */

/** Espace retenu sur l'appareil pour la page de connexion : id et nom, rien d'autre. */
export interface EspaceRetenu {
  espace: string;
  nom?: string;
}

/** Valeur gardée dans le navigateur, relue sans confiance (illisible : rien). */
export function lireEspaceRetenu(valeur: unknown): EspaceRetenu | undefined {
  try {
    const x = (typeof valeur === 'string' ? JSON.parse(valeur) : null) as Partial<EspaceRetenu> | null;
    if (!x || !idEspaceValide(x.espace)) return undefined;
    const nom = typeof x.nom === 'string' ? x.nom.trim().slice(0, 80) : '';
    return { espace: x.espace.toLowerCase(), ...(nom ? { nom } : {}) };
  } catch {
    return undefined;
  }
}

/** À retenir après un lien ou une session : même espace sans nom (lien pas encore ouvert), le nom connu est gardé. */
export function espaceARetenir(nouveau: EspaceRetenu, avant: EspaceRetenu | undefined): EspaceRetenu {
  const nom = nouveau.nom ?? (avant?.espace === nouveau.espace ? avant.nom : undefined);
  return { espace: espaceDe(nouveau.espace), ...(nom ? { nom } : {}) };
}

/**
 * Au nom de qui parle la page de connexion : l'espace du lien, sinon celui
 * retenu sur l'appareil. Label Maison : sa marque et son numéro ; un autre :
 * son nom s'il est connu ; inconnu : personne (« votre conciergerie »).
 */
export function marqueConnexion(espaceLien: string | undefined, retenu: EspaceRetenu | undefined): { nom?: string; labelMaison: boolean } {
  const espace = idEspaceValide(espaceLien) ? espaceLien.toLowerCase() : retenu?.espace;
  if (!espace) return { labelMaison: false };
  if (espace === ID_LABEL_MAISON) return { nom: 'Label Maison', labelMaison: true };
  return { ...(retenu?.espace === espace && retenu.nom ? { nom: retenu.nom } : {}), labelMaison: false };
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
