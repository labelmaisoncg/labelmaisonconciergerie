// =============================================================================
// Accès externes à l'ERP, côté serveur : propriétaires (/espace-proprietaire)
// et opérations. Liens à usage unique, cookie de session signé, et surtout
// l'ESPACE : chaque accès est créé, lu et revérifié dans la base de l'espace
// qui l'a créé (Label Maison, Sens…), jamais ailleurs.
//
// Base d'avant les espaces (supabase/erp-espaces.sql pas encore passé) :
// Label Maison seul, exactement comme avant.
//
// Règles pures (session, lien) : src/erp/data/acces-externe.ts ; jetons et
// liens : src/erp/data/proprietaire-acces.ts (génériques).
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
//
// Variables d'environnement (projet Vercel du site) :
//   PROPRIETAIRE_SECRET  sessions des propriétaires (32 caractères au moins)
//   OPERATIONS_SECRET    sessions des opérations
//   ACCES_SECRET         secours commun aux deux (le genre est signé dans la
//                        session : un cookie d'un genre ne vaut pas pour l'autre)
//   RESEND_API_KEY       envoi des liens ; CONTACT_FROM_EMAIL : expéditeur de
//                        Label Maison. Un autre espace envoie seulement s'il a
//                        son expéditeur (config.email.expediteur de l'espace),
//                        sinon le gérant copie le lien.
//   SITE_URL             (facultative) site des liens envoyés, origine https ;
//                        par défaut https://www.labelmaisoncg.fr. Jamais
//                        l'Origin ni le Host de la demande.
// =============================================================================

import { Resend } from 'resend';
import {
  accesToujoursDeLaFiche,
  enteteCookieExterne,
  espaceDe,
  lienAcces,
  lienDeConnexionRecent,
  lireCookieExterne,
  lireSessionExterne,
  sessionExterneValide,
  signerSessionExterne,
  type AccesExterne,
  type GenreAcces,
  type SessionExterne,
} from '../src/erp/data/acces-externe.js';
import { estLabelMaison } from '../src/erp/data/espaces.js';
import { CONTACTS_LABEL_MAISON } from '../src/erp/data/proprietaire.js';
import { DUREE_SESSION_S, normaliserEmail, secretValide, utiliserLien, type RefusLien } from '../src/erp/data/proprietaire-acces.js';
import type { BaseErp } from '../src/erp/data/repull-synchro.js';
import type { ContactsConciergerie } from '../src/erp/data/types-proprietaire';
import { baseErp, configuration } from './_erp-repull.js';
import { espacesActifs, type FicheEspace } from './_erp-espaces.js';
import { origineDe } from './_garde-formulaire.js';

export interface ReglagesGenre {
  /** Collection des accès dans erp.enregistrements. */
  collection: string;
  /** Page ouverte par le lien. */
  page: string;
  /** Route : le cookie ne part qu'avec ses appels. */
  api: string;
  cookie: string;
  /** Variables du secret de session, dans l'ordre. */
  secrets: string[];
  /** « espace propriétaire » (e-mails, messages). */
  libelle: string;
  /** Fiche de la personne dans son espace : c'est son adresse qui fait foi (accesToujoursDeLaFiche). */
  fiche: { collection: string; id: (a: AccesExterne) => string; email: (f: any) => unknown };
}

export const GENRES: Record<GenreAcces, ReglagesGenre> = {
  proprietaire: {
    collection: 'accesProprietaires',
    page: '/espace-proprietaire',
    api: '/api/espace-proprietaire',
    cookie: 'lm_proprio',
    secrets: ['PROPRIETAIRE_SECRET', 'ACCES_SECRET'],
    libelle: 'espace propriétaire',
    fiche: { collection: 'proprietaires', id: (a) => String((a as { proprietaireId?: unknown }).proprietaireId ?? a.id), email: (f) => f?.contact?.email },
  },
  operations: {
    collection: 'accesOperations',
    page: '/espace-operations',
    api: '/api/espace-operations',
    cookie: 'lm_operations',
    secrets: ['OPERATIONS_SECRET', 'ACCES_SECRET'],
    libelle: 'espace opérations',
    fiche: { collection: 'equipe', id: (a) => String((a as { membreId?: unknown }).membreId ?? a.id), email: (f) => f?.email },
  },
};

/** Site des liens envoyés (invitation, connexion, relances), sauf variable SITE_URL. */
export const SITE_PAR_DEFAUT = 'https://www.labelmaisoncg.fr';

/** Secret de session du genre ('' : aucun valable). */
export function secretAcces(genre: GenreAcces): string {
  for (const v of GENRES[genre].secrets) {
    const s = (process.env[v] || '').trim();
    if (secretValide(s)) return s;
  }
  return '';
}

export function cookieSession(genre: GenreAcces, valeur: string, maxAgeS: number = DUREE_SESSION_S): string {
  return enteteCookieExterne(GENRES[genre].cookie, GENRES[genre].api, valeur, maxAgeS);
}

export const cookieSessionEfface = (genre: GenreAcces): string => cookieSession(genre, '', 0);

/** Base d'un espace (compte serveur, ou compte d'équipe pour Label Maison). */
export const baseAcces = (espace: string): BaseErp => baseErp(configuration(), espaceDe(espace));

/** Fiche d'un espace actif (nom, réglages) ; undefined : inconnu ou fermé. */
export async function ficheEspace(espace: string): Promise<FicheEspace | undefined> {
  const id = espaceDe(espace);
  return (await espacesActifs()).find((e) => e.id === id);
}

type ConfigLibre = Record<string, unknown> | null | undefined;
const texte = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/**
 * Label Maison seulement si l'espace l'est EXPLICITEMENT (sa fiche, ou son id
 * quand la fiche n'a pas pu être lue) : une fiche introuvable n'est jamais
 * Label Maison par défaut.
 */
const espaceLabelMaison = (fiche: FicheEspace | undefined, espace?: string): boolean =>
  fiche ? estLabelMaison(fiche.id) : typeof espace === 'string' && estLabelMaison(espace);

/**
 * Contacts montrés aux propriétaires : ceux de Label Maison pour Label Maison ;
 * pour un autre espace, ceux de sa fiche (config.contacts), sinon aucun.
 */
export function contactsEspace(fiche: FicheEspace | undefined, espace?: string): ContactsConciergerie | undefined {
  if (espaceLabelMaison(fiche, espace)) return CONTACTS_LABEL_MAISON;
  if (!fiche) return undefined;
  const c = ((fiche.config as ConfigLibre)?.contacts ?? null) as ConfigLibre;
  const email = texte(c?.email);
  const telephone = texte(c?.telephone);
  if (!email && !telephone) return undefined;
  const chiffres = (telephone ?? '').replace(/[^\d+]/g, '');
  return {
    nom: fiche.nom,
    email: email ?? '',
    telephone: telephone ?? '',
    lienTelephone: chiffres ? `tel:${chiffres}` : '',
    whatsapp: texte(c?.whatsapp) ?? '',
    adresse: texte(c?.adresse) ?? '',
    site: texte(c?.site) ?? '',
  };
}

/**
 * Expéditeur des e-mails d'un espace ; undefined : pas d'envoi (le gérant
 * copie le lien). Fiche introuvable (panne, espace fermé) : pas d'envoi,
 * jamais au nom de Label Maison.
 */
export function expediteurEspace(fiche: FicheEspace | undefined, espace?: string): { from: string; replyTo?: string } | undefined {
  if (espaceLabelMaison(fiche, espace)) {
    return { from: process.env.CONTACT_FROM_EMAIL || 'Label Maison Conciergerie <onboarding@resend.dev>', replyTo: CONTACTS_LABEL_MAISON.email };
  }
  if (!fiche) return undefined;
  const e = ((fiche.config as ConfigLibre)?.email ?? null) as ConfigLibre;
  const from = texte(e?.expediteur);
  return from ? { from, replyTo: texte(e?.repondreA) } : undefined;
}

/**
 * Site des liens envoyés : variable SITE_URL (origine https), sinon
 * SITE_PAR_DEFAUT. JAMAIS l'Origin ni le Host de la demande : une page tierce
 * ferait sinon envoyer par le vrai site un lien vers chez elle, et y lirait
 * le jeton.
 */
export function adresseSite(): string {
  const o = origineDe((process.env.SITE_URL || '').trim());
  return o.startsWith('https://') ? o : SITE_PAR_DEFAUT;
}

/** Lien à usage unique d'un accès : « <site>/<page>#espace=<uuid>&jeton=<jeton> » (la demande n'y change rien). */
export const lienDAcces = (_req: unknown, genre: GenreAcces, espace: string, jeton: string): string => lienAcces(adresseSite(), GENRES[genre].page, espace, jeton);

/** Fiche de la personne de l'accès, dans la base de son espace ; undefined : introuvable. */
async function ficheDeLAcces(base: BaseErp, genre: GenreAcces, acces: AccesExterne): Promise<{ email: unknown } | undefined> {
  const r = GENRES[genre].fiche;
  const id = r.id(acces);
  if (!id) return undefined;
  const f = (await base.lire<Record<string, unknown>>(r.collection, [id]))[0];
  return f ? { email: r.email(f) } : undefined;
}

/** Accès (nouvelle invitation) avec l'adresse de la fiche relevée maintenant (voir accesToujoursDeLaFiche). */
export function avecEmailFiche<T extends AccesExterne>(genre: GenreAcces, acces: T, fiche: unknown): T {
  return { ...acces, emailFiche: normaliserEmail(GENRES[genre].fiche.email(fiche) ?? '') };
}

/**
 * Pourquoi une session est refusée : `absente` (pas de cookie valable,
 * espace illisible), `retire` (accès retiré, fiche supprimée ou adresse
 * changée dans la fiche), `expiree` (nouvelle invitation à une autre adresse
 * depuis : la version a changé).
 */
export type RefusSession = 'absente' | 'retire' | 'expiree';

/**
 * Session du cookie, revérifiée dans la base de SON espace : accès actif,
 * même version, même espace, et adresse toujours celle de la fiche ; sinon
 * la raison du refus (l'écran dit « Votre accès a été retiré » quand c'est le cas).
 */
export async function lireSessionAcces<T extends AccesExterne>(
  req: any,
  genre: GenreAcces,
): Promise<{ ok: true; session: SessionExterne; acces: T; base: BaseErp; espace: string } | { ok: false; raison: RefusSession }> {
  const secret = secretAcces(genre);
  if (!secret) return { ok: false, raison: 'absente' };
  const s = await lireSessionExterne(secret, lireCookieExterne(req.headers?.cookie, GENRES[genre].cookie), genre, Math.floor(Date.now() / 1000));
  if (!s) return { ok: false, raison: 'absente' };
  try {
    const base = baseAcces(s.e);
    const acces = (await base.lire<T>(GENRES[genre].collection, [s.p]))[0];
    if (!acces || acces.statut === 'retire') return { ok: false, raison: 'retire' };
    if (!sessionExterneValide(s, acces)) return { ok: false, raison: 'expiree' };
    if (!accesToujoursDeLaFiche(acces, await ficheDeLAcces(base, genre, acces))) return { ok: false, raison: 'retire' };
    return { ok: true, session: s, acces: acces as T, base, espace: s.e };
  } catch (e) {
    console.warn('[acces-externe] session illisible', genre, e instanceof Error ? e.message : e);
    return { ok: false, raison: 'absente' };
  }
}

/** Session du cookie (voir lireSessionAcces) ; null : refusée, quelle qu'en soit la raison. */
export async function sessionAcces<T extends AccesExterne>(
  req: any,
  genre: GenreAcces,
): Promise<{ session: SessionExterne; acces: T; base: BaseErp; espace: string } | null> {
  const r = await lireSessionAcces<T>(req, genre);
  if (!r.ok) return null;
  const { ok: _ok, ...s } = r;
  return s;
}

/**
 * Ouvre une session avec un lien : l'accès est cherché dans l'espace du
 * lien seulement (un ancien lien sans espace : Label Maison). Le lien est
 * marqué utilisé par une écriture CONDITIONNELLE (accès inchangé depuis sa
 * lecture) : présenté deux fois en même temps, il n'ouvre qu'une session.
 */
export async function entrerAvecLien<T extends AccesExterne>(
  genre: GenreAcces,
  jeton: unknown,
  espaceDuLien: unknown,
  maintenantMs: number = Date.now(),
): Promise<{ ok: true; acces: T; cookie: string; espace: string } | { ok: false; raison: RefusLien }> {
  const espace = espaceDe(espaceDuLien);
  let liste: { element: T; version: string }[];
  let base: BaseErp;
  try {
    base = baseAcces(espace);
    liste = (await base.lireVersions<T>(GENRES[genre].collection)).filter((x) => espaceDe(x.element.espace) === espace);
  } catch {
    return { ok: false, raison: 'inconnu' };
  }
  const r = await utiliserLien(
    liste.map((x) => x.element),
    jeton,
    maintenantMs,
  );
  if (!r.ok) return r;
  // Adresse changée dans la fiche sans « Retirer » : le lien ne vaut plus.
  if (!accesToujoursDeLaFiche(r.acces, await ficheDeLAcces(base, genre, r.acces))) return { ok: false, raison: 'retire' };
  const lu = liste.find((x) => x.element.id === r.acces.id);
  if (!lu || !(await base.remplacerSi(GENRES[genre].collection, r.acces, lu.version, `acces-${genre}`))) return { ok: false, raison: 'utilise' };
  const valeur = await signerSessionExterne(secretAcces(genre), {
    k: genre,
    p: r.acces.id,
    e: espace,
    v: r.acces.version,
    exp: Math.floor(maintenantMs / 1000) + DUREE_SESSION_S,
  });
  return { ok: true, acces: r.acces, cookie: cookieSession(genre, valeur), espace };
}

/**
 * Accès d'une adresse à qui envoyer un lien de connexion, dans chaque espace
 * actif (base d'avant les espaces : Label Maison seul). Passés : accès
 * retiré, adresse qui n'est plus celle de la fiche, lien déjà envoyé il y a
 * moins de 2 minutes (DELAI_ENTRE_LIENS_MS, gardé dans l'accès : vaut pour
 * toutes les instances du serveur). Un espace illisible est passé, jamais une
 * erreur. `version` : pour écrire le nouveau lien sans écraser un usage
 * simultané (BaseErp.remplacerSi).
 */
export async function accesParEmail<T extends AccesExterne>(
  genre: GenreAcces,
  email: string,
  maintenantMs: number = Date.now(),
): Promise<{ fiche: FicheEspace; acces: T; base: BaseErp; version: string }[]> {
  const res: { fiche: FicheEspace; acces: T; base: BaseErp; version: string }[] = [];
  for (const fiche of await espacesActifs()) {
    try {
      const base = baseAcces(fiche.id);
      const lu = (await base.lireVersions<T>(GENRES[genre].collection)).find(
        ({ element: a }) => a?.email === email && a.statut !== 'retire' && espaceDe(a.espace) === fiche.id,
      );
      if (!lu || lienDeConnexionRecent(lu.element, maintenantMs)) continue;
      if (!accesToujoursDeLaFiche(lu.element, await ficheDeLAcces(base, genre, lu.element))) continue;
      res.push({ fiche, acces: lu.element, base, version: lu.version });
    } catch (e) {
      console.warn('[acces-externe] espace illisible', fiche.code, e instanceof Error ? e.message : e);
    }
  }
  return res;
}

/** E-mail au nom de l'espace ; faux sans clé Resend ou sans expéditeur pour cet espace. */
export async function envoyerEmailEspace(fiche: FicheEspace | undefined, m: { to: string; sujet: string; html: string; text: string }): Promise<boolean> {
  const cle = (process.env.RESEND_API_KEY || '').trim();
  const exp = expediteurEspace(fiche);
  if (!cle || !exp) return false;
  try {
    const { error } = await new Resend(cle).emails.send({ from: exp.from, to: [m.to], ...(exp.replyTo ? { replyTo: exp.replyTo } : {}), subject: m.sujet, html: m.html, text: m.text });
    if (error) console.error('[acces-externe] Resend :', error.message ?? error);
    return !error;
  } catch (e) {
    console.error('[acces-externe] Resend :', e instanceof Error ? e.message : e);
    return false;
  }
}
