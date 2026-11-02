/**
 * Accès externes à l'ERP (propriétaires, opérations) : règles pures communes
 * au serveur (api/_acces-externe.ts) et aux pages.
 *
 * Deux façons d'entrer :
 * - **par compte** (propriétaires, octobre 2026) : l'invitation du gérant porte
 *   un code à usage unique, « …/espace-proprietaire#creer=<adresse>&code=<code>
 *   &espace=<uuid> » (après #, jamais envoyé aux serveurs). La personne crée
 *   son compte Supabase (adresse et mot de passe), confirme son adresse, puis
 *   l'activation relie l'accès à SON compte (uid) et consomme le code. Ensuite
 *   elle entre avec son adresse et son mot de passe : le serveur retrouve
 *   l'accès par l'uid, jamais par la seule adresse (un autre compte à la même
 *   adresse n'obtient rien). Le jeton Supabase ne sert qu'à prouver l'identité
 *   auprès de notre serveur ; la session de l'espace, c'est le cookie.
 * - **par lien à usage unique** (opérations, en attendant la même mécanique) :
 *   « …#espace=<uuid>&jeton=<jeton> ».
 *
 * Chaque accès appartient à l'espace qui l'a créé (Label Maison, Sens…) :
 * - le lien porte l'espace (l'espace n'est pas secret ; un ancien lien sans
 *   espace vaut Label Maison) ;
 * - la session signée porte le genre, la personne, l'espace, la version et,
 *   pour une session par compte, l'uid : un cookie dont on change l'espace
 *   (ou le genre) n'est plus valable, et l'accès est relu dans la base de CET
 *   espace à chaque appel.
 *
 * Imports en « .js » : ce module tourne aussi sous Node (fonctions Vercel).
 */
import { ID_LABEL_MAISON, idEspaceValide } from './espaces.js';
import { b64url, deB64url, empreinte } from './web-push.js';

export type GenreAcces = 'proprietaire' | 'operations';

/** Accès retiré : la même phrase partout (lien, session, action), espace propriétaire et opérations. */
export const ACCES_RETIRE = 'Votre accès a été retiré. Contactez votre conciergerie.';
export const GENRES_ACCES: GenreAcces[] = ['proprietaire', 'operations'];

/** Site fixe des pages des espaces (le même que URL_RETOUR_MOT_DE_PASSE de l'ERP et SITE_PAR_DEFAUT du serveur). */
export const SITE_FIXE = 'https://www.labelmaisoncg.fr';
export const PAGES_ACCES: Record<GenreAcces, string> = { proprietaire: '/espace-proprietaire', operations: '/espace-operations' };

/**
 * Page où reviennent les e-mails de Supabase (confirmation de l'adresse, mot de
 * passe oublié) : à autoriser dans Authentication → URL Configuration →
 * Redirect URLs, sans joker.
 */
export const urlRetourAcces = (genre: GenreAcces): string => `${SITE_FIXE}${PAGES_ACCES[genre]}`;

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
  /** Compte Supabase (auth.users.id) relié par l'activation ; gardé pour mémoire après un retrait. */
  uid?: string;
  /** Compte créé, adresse confirmée, accès relié : la personne entre avec son adresse et son mot de passe. */
  compteActif?: boolean;
  /** Date de l'activation (compte relié). */
  activeLe?: string;
}

/** Espace d'un accès, d'un lien ou d'une session : Label Maison si absent ou illisible. */
export function espaceDe(espace: unknown): string {
  return idEspaceValide(espace) ? espace.toLowerCase() : ID_LABEL_MAISON;
}

const adresse = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/** Identifiant d'un compte Supabase (auth.users.id) : un UUID. */
export const uidValide = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Adresse e-mail bien formée (même règle que les invitations de l'équipe). */
export const adresseBienFormee = (e: unknown): e is string => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

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

/** Délai entre deux liens de connexion demandés pour un même accès (« Recevoir mon lien », opérations). */
export const DELAI_ENTRE_LIENS_MS = 2 * 60_000;

/** Un lien de connexion a déjà été envoyé à cet accès il y a moins de DELAI_ENTRE_LIENS_MS. */
export function lienDeConnexionRecent(acces: AccesExterne, maintenantMs: number): boolean {
  return (acces.liens ?? []).some((l) => l?.motif === 'connexion' && maintenantMs - Date.parse(l.creeLe) < DELAI_ENTRE_LIENS_MS);
}

/* ------------------------------------------------------------------ lien */

/** Lien envoyé (opérations) : page + « #espace=…&jeton=… » (après #, jamais envoyé aux serveurs). */
export function lienAcces(site: string, page: string, espace: string, jeton: string): string {
  return `${site.replace(/\/+$/, '')}${page}#espace=${espaceDe(espace)}&jeton=${jeton}`;
}

/** Lecture du fragment d'un lien ; sans espace (ancien lien) : Label Maison. */
export function lireLienAcces(fragment: string): { jeton?: string; espace: string } {
  const p = new URLSearchParams(String(fragment ?? '').replace(/^#/, ''));
  const jeton = p.get('jeton') ?? undefined;
  return { ...(jeton ? { jeton } : {}), espace: espaceDe(p.get('espace')) };
}

/* ------------------------------------------- compte : lien « Créer mon compte » */

/** Forme d'un code d'invitation (le serveur tire 32 octets en base64url : 43 caractères ; même règle que l'équipe). */
export const CODE_ACCES = /^[A-Za-z0-9_-]{20,100}$/;
export const codeAccesValide = (code: unknown): code is string => typeof code === 'string' && CODE_ACCES.test(code);

/** Durée d'une invitation à créer son compte (le code est gardé sur l'appareil le même temps). */
export const DUREE_INVITATION_ACCES_MS = 7 * 24 * 3600_000;

/**
 * Lien de l'invitation : la page de l'espace, l'adresse invitée, le code à
 * usage unique et l'espace, après « # » (jamais envoyés au serveur du site).
 * Même forme que « Créer mon compte » de l'équipe.
 */
export function lienCreationAcces(site: string, page: string, email: string, code: string, espace: string): string {
  return `${site.replace(/\/+$/, '')}${page}#creer=${encodeURIComponent(adresse(email))}&code=${encodeURIComponent(code)}&espace=${espaceDe(espace)}`;
}

/** Ce que porte un lien « Créer mon compte » ; undefined : pas un tel lien. Adresse illisible : ''. */
export function lireLienCreation(fragment: string): { email: string; code?: string; espace: string } | undefined {
  const p = new URLSearchParams(String(fragment ?? '').replace(/^#/, ''));
  if (!p.has('creer')) return undefined;
  const email = adresse(p.get('creer'));
  const code = p.get('code');
  return { email: adresseBienFormee(email) ? email : '', ...(codeAccesValide(code) ? { code } : {}), espace: espaceDe(p.get('espace')) };
}

/**
 * Lien reçu par e-mail, lu AVANT que le client Supabase ne nettoie l'adresse :
 * invitation (« #creer=… »), retour de Supabase (« #access_token=…&type=… »,
 * recovery pour un mot de passe oublié, sinon la confirmation de l'adresse),
 * ou erreur de Supabase (« #error=… », lien expiré).
 */
export type RetourLienExterne =
  | { nature: 'rien' }
  | { nature: 'creer'; email: string; code?: string; espace: string }
  | { nature: 'recuperation' }
  | { nature: 'confirmation' }
  | { nature: 'erreur'; message: string };

export function lireRetourLienExterne(hash: unknown): RetourLienExterne {
  const h = String(hash ?? '').replace(/^#/, '');
  if (!h) return { nature: 'rien' };
  const creer = lireLienCreation(h);
  if (creer) return { nature: 'creer', ...creer };
  const p = new URLSearchParams(h);
  const code = p.get('error_code') ?? p.get('error');
  if (code) {
    const expire = /expired|otp/i.test(code + (p.get('error_description') ?? ''));
    return {
      nature: 'erreur',
      message: expire
        ? 'Ce lien a expiré ou a déjà servi. Demandez un nouveau lien avec « Mot de passe oublié ? », ou demandez à votre conciergerie de renvoyer l’invitation.'
        : 'Ce lien n’est pas valide. Demandez un nouveau lien avec « Mot de passe oublié ? », ou demandez à votre conciergerie de renvoyer l’invitation.',
    };
  }
  if (p.get('access_token')) return p.get('type') === 'recovery' ? { nature: 'recuperation' } : { nature: 'confirmation' };
  return { nature: 'rien' };
}

/* --------------------------------------- compte : code gardé sur l'appareil */

/** Clé de stockage du code d'invitation sur l'appareil, par genre. */
export const CLES_INVITATION_ACCES: Record<GenreAcces, string> = { proprietaire: 'lm_proprio_invitation', operations: 'lm_operations_invitation' };

export interface InvitationAccesGardee {
  email: string;
  code: string;
  espace: string;
  /** Échéance (ms) au-delà de laquelle le code n'est plus proposé. */
  expire: number;
}

export const invitationAccesAGarder = (l: { email: string; code: string; espace: string }, maintenant: number = Date.now()): InvitationAccesGardee => ({
  email: adresse(l.email),
  code: l.code,
  espace: espaceDe(l.espace),
  expire: maintenant + DUREE_INVITATION_ACCES_MS,
});

/** Lecture tolérante de ce qui est gardé (null : rien de valable, ou échu). */
export function lireInvitationAccesGardee(brut: unknown, maintenant: number = Date.now()): InvitationAccesGardee | null {
  if (typeof brut !== 'string' || !brut) return null;
  try {
    const x = JSON.parse(brut) as Partial<InvitationAccesGardee>;
    const email = adresse(x?.email);
    if (!adresseBienFormee(email) || !codeAccesValide(x?.code) || typeof x?.expire !== 'number' || x.expire <= maintenant) return null;
    return { email, code: x.code, espace: espaceDe(x.espace), expire: x.expire };
  } catch {
    return null;
  }
}

/** Code à présenter pour ce compte : seulement s'il a été gardé pour la même adresse. */
export const codeAccesPour = (gardee: InvitationAccesGardee | null, email: string): { code: string; espace: string } | undefined =>
  gardee && gardee.email === adresse(email) ? { code: gardee.code, espace: gardee.espace } : undefined;

/* ----------------------------------------------------- compte : mot de passe */

export const MOT_DE_PASSE_MIN = 12;
/** Limite de Supabase (bcrypt). */
export const MOT_DE_PASSE_MAX = 72;

/** Indicateur simple : 0 trop court, 1 faible, 2 correct, 3 solide. */
export function forceMotDePasse(motDePasse: string): { niveau: 0 | 1 | 2 | 3; libelle: string } {
  const m = String(motDePasse ?? '');
  if (m.length < MOT_DE_PASSE_MIN) return { niveau: 0, libelle: `${MOT_DE_PASSE_MIN} caractères au moins` };
  const sortes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(m)).length;
  const repete = /^(.+?)\1+$/.test(m);
  if (repete || (sortes <= 1 && m.length < 16)) return { niveau: 1, libelle: 'Faible' };
  if ((m.length >= 16 && sortes >= 3) || m.length >= 20) return { niveau: 3, libelle: 'Solide' };
  return { niveau: 2, libelle: 'Correct' };
}

/** Ce qui ne va pas dans un mot de passe choisi (undefined : acceptable). */
export function motDePasseRefuse(motDePasse: string, confirmation: string): string | undefined {
  if (motDePasse.length < MOT_DE_PASSE_MIN) return `Mot de passe trop court : ${MOT_DE_PASSE_MIN} caractères au moins.`;
  if (motDePasse.length > MOT_DE_PASSE_MAX) return `Mot de passe trop long : ${MOT_DE_PASSE_MAX} caractères au plus.`;
  if (forceMotDePasse(motDePasse).niveau < 2) return 'Mot de passe trop simple : mélangez lettres, chiffres et signes, ou allongez-le.';
  if (motDePasse !== confirmation) return 'Les deux mots de passe sont différents.';
  return undefined;
}

/* --------------------------------------------- compte : activation et entrée */

/** Compte Supabase vérifié par le serveur (GET /auth/v1/user). */
export interface CompteVerifie {
  uid: string;
  email: string;
  /** Adresse confirmée (email_confirmed_at). */
  confirme: boolean;
}

export type RefusActivation = 'inconnu' | 'expire' | 'utilise' | 'retire' | 'autre_adresse' | 'non_confirme';

/**
 * Active un accès avec le code de son invitation et le compte Supabase de la
 * personne : code présent et valable (7 jours, pas encore servi), accès pas
 * retiré, adresse du compte confirmée et égale à celle de l'accès. L'accès
 * devient actif, relié à CE compte (uid), et le code est effacé : il ne
 * servira plus. Tout autre cas : refus, avec sa raison (le serveur répond la
 * même phrase pour inconnu, expiré, servi et autre adresse).
 */
export async function activerAccesAvecCompte<T extends AccesExterne>(
  acces: readonly T[],
  code: unknown,
  compte: CompteVerifie,
  maintenantMs: number,
): Promise<{ ok: true; acces: T } | { ok: false; raison: RefusActivation }> {
  if (!codeAccesValide(code) || !uidValide(compte?.uid)) return { ok: false, raison: 'inconnu' };
  const h = await empreinte(code);
  const a = acces.find((x) => (x?.liens ?? []).some((l) => l?.empreinte === h && l.motif === 'invitation'));
  const lien = a?.liens.find((l) => l.empreinte === h);
  if (!a || !lien) return { ok: false, raison: 'inconnu' };
  if (a.statut === 'retire') return { ok: false, raison: 'retire' };
  if (lien.utiliseLe) return { ok: false, raison: 'utilise' };
  if (!(Date.parse(lien.expireLe) > maintenantMs)) return { ok: false, raison: 'expire' };
  if (!compte.confirme) return { ok: false, raison: 'non_confirme' };
  if (!adresse(compte.email) || adresse(compte.email) !== adresse(a.email)) return { ok: false, raison: 'autre_adresse' };
  const quand = new Date(maintenantMs).toISOString();
  return { ok: true, acces: { ...a, statut: 'actif', uid: compte.uid.toLowerCase(), compteActif: true, activeLe: quand, derniereConnexion: quand, liens: [] } };
}

export type RefusEntree = 'inconnu' | 'invite' | 'retire';

/**
 * Accès ouvert à un compte, par son uid seulement (jamais par l'adresse) :
 * actif et relié. Plusieurs (un par espace) : celui de l'espace préféré, sinon
 * le premier. Aucun : la raison la plus utile à la personne (invitation à
 * ouvrir, accès retiré, rien).
 */
export function accesDuCompte<T extends AccesExterne>(acces: readonly T[], uid: unknown, espacePrefere?: unknown): { ok: true; acces: T } | { ok: false; raison: RefusEntree } {
  if (!uidValide(uid)) return { ok: false, raison: 'inconnu' };
  const siens = acces.filter((a) => !!a && typeof a.uid === 'string' && a.uid.toLowerCase() === uid.toLowerCase());
  const ouverts = siens.filter((a) => a.statut === 'actif' && a.compteActif === true);
  if (ouverts.length) {
    const prefere = idEspaceValide(espacePrefere) ? espaceDe(espacePrefere) : undefined;
    return { ok: true, acces: ouverts.find((a) => prefere && espaceDe(a.espace) === prefere) ?? ouverts[0] };
  }
  if (siens.some((a) => a.statut === 'invite')) return { ok: false, raison: 'invite' };
  if (siens.some((a) => a.statut === 'retire')) return { ok: false, raison: 'retire' };
  return { ok: false, raison: 'inconnu' };
}

/** Phrases du serveur pour les comptes (les mêmes quoi qu'il manque, sauf ce que la personne doit faire) ; espace insécable avant « ? » et « : ». */
export const MESSAGE_SESSION_REFUSEE = 'Connexion refusée : reconnectez-vous avec votre adresse e-mail et votre mot de passe.';
export const MESSAGE_NON_CONFIRME = 'Confirmez d’abord votre adresse e-mail : ouvrez le lien reçu après la création de votre compte.';
export const MESSAGE_INVITATION_PERIMEE =
  'Ce lien d’invitation n’est plus valable (déjà utilisé, remplacé, expiré ou pour une autre adresse) : demandez à votre conciergerie de le renvoyer.';
export const MESSAGES_ENTREE: Record<RefusEntree, string> = {
  inconnu: 'Ce compte n’a pas accès à un espace propriétaire. Vous avez reçu une invitation ? Ouvrez son lien sur cet appareil, puis connectez-vous.',
  invite: 'Votre invitation vous attend : ouvrez son lien sur cet appareil, puis connectez-vous.',
  retire: ACCES_RETIRE,
};

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
  /** Compte relié (uid) pour une session ouverte par compte ; absente pour une session par lien. */
  u?: string;
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
  const corps = b64url(utf8(JSON.stringify({ k: s.k, p: s.p, e: espaceDe(s.e), v: s.v, exp: s.exp, ...(uidValide(s.u) ? { u: s.u.toLowerCase() } : {}) })));
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
    if (s.u !== undefined && !uidValide(s.u)) return null;
    if (s.exp <= maintenantS) return null;
    return { k, p: s.p, e: espaceDe(s.e), v: s.v, exp: s.exp, ...(s.u ? { u: s.u.toLowerCase() } : {}) };
  } catch {
    return null;
  }
}

/**
 * La session correspond toujours à cet accès : même personne, même espace,
 * actif, même version ; et le même compte : une session par compte vaut pour
 * l'accès relié à cet uid seulement, une session par lien (sans uid) ne vaut
 * plus dès que l'accès est relié à un compte.
 */
export function sessionExterneValide(s: SessionExterne, acces: AccesExterne | undefined): acces is AccesExterne {
  if (!acces || acces.id !== s.p || espaceDe(acces.espace) !== s.e || acces.statut !== 'actif' || acces.version !== s.v) return false;
  if (s.u) return typeof acces.uid === 'string' && acces.uid.toLowerCase() === s.u && acces.compteActif === true;
  return !acces.compteActif;
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
