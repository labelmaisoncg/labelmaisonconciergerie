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
// =============================================================================

import { Resend } from 'resend';
import {
  enteteCookieExterne,
  espaceDe,
  lienAcces,
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
import { DUREE_SESSION_S, secretValide, utiliserLien, type RefusLien } from '../src/erp/data/proprietaire-acces.js';
import type { BaseErp } from '../src/erp/data/repull-synchro.js';
import type { ContactsConciergerie } from '../src/erp/data/types-proprietaire';
import { baseErp, configuration } from './_erp-repull.js';
import { espacesActifs, type FicheEspace } from './_erp-espaces.js';
import { ORIGINES_SITE } from './_garde-formulaire.js';

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
}

export const GENRES: Record<GenreAcces, ReglagesGenre> = {
  proprietaire: {
    collection: 'accesProprietaires',
    page: '/espace-proprietaire',
    api: '/api/espace-proprietaire',
    cookie: 'lm_proprio',
    secrets: ['PROPRIETAIRE_SECRET', 'ACCES_SECRET'],
    libelle: 'espace propriétaire',
  },
  operations: {
    collection: 'accesOperations',
    page: '/espace-operations',
    api: '/api/espace-operations',
    cookie: 'lm_operations',
    secrets: ['OPERATIONS_SECRET', 'ACCES_SECRET'],
    libelle: 'espace opérations',
  },
};

export const SITE_PAR_DEFAUT = 'https://labelmaisoncg.fr';

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
 * Contacts montrés aux propriétaires : ceux de Label Maison pour Label Maison ;
 * pour un autre espace, ceux de sa fiche (config.contacts), sinon aucun.
 */
export function contactsEspace(fiche: FicheEspace | undefined): ContactsConciergerie | undefined {
  if (!fiche || estLabelMaison(fiche.id)) return CONTACTS_LABEL_MAISON;
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

/** Expéditeur des e-mails d'un espace ; undefined : pas d'envoi (le gérant copie le lien). */
export function expediteurEspace(fiche: FicheEspace | undefined): { from: string; replyTo?: string } | undefined {
  if (!fiche || estLabelMaison(fiche.id)) {
    return { from: process.env.CONTACT_FROM_EMAIL || 'Label Maison Conciergerie <onboarding@resend.dev>', replyTo: CONTACTS_LABEL_MAISON.email };
  }
  const e = ((fiche.config as ConfigLibre)?.email ?? null) as ConfigLibre;
  const from = texte(e?.expediteur);
  return from ? { from, replyTo: texte(e?.repondreA) } : undefined;
}

/** Adresse du site pour les liens (celle de la page qui appelle, si c'est le site). */
export function adresseSite(req: any): string {
  const origine = String(req.headers?.origin || '').replace(/\/+$/, '');
  return origine && ORIGINES_SITE.test(`${origine}/`) && /^https:\/\//.test(origine) ? origine : SITE_PAR_DEFAUT;
}

/** Lien à usage unique d'un accès : « …#espace=<uuid>&jeton=<jeton> ». */
export const lienDAcces = (req: any, genre: GenreAcces, espace: string, jeton: string): string => lienAcces(adresseSite(req), GENRES[genre].page, espace, jeton);

/**
 * Session du cookie, revérifiée dans la base de SON espace : accès actif,
 * même version, même espace. null : pas de session, cookie falsifié,
 * accès retiré, ou espace devenu inaccessible.
 */
export async function sessionAcces<T extends AccesExterne>(
  req: any,
  genre: GenreAcces,
): Promise<{ session: SessionExterne; acces: T; base: BaseErp; espace: string } | null> {
  const secret = secretAcces(genre);
  if (!secret) return null;
  const s = await lireSessionExterne(secret, lireCookieExterne(req.headers?.cookie, GENRES[genre].cookie), genre, Math.floor(Date.now() / 1000));
  if (!s) return null;
  try {
    const base = baseAcces(s.e);
    const acces = (await base.lire<T>(GENRES[genre].collection, [s.p]))[0];
    return sessionExterneValide(s, acces) ? { session: s, acces: acces as T, base, espace: s.e } : null;
  } catch (e) {
    console.warn('[acces-externe] session illisible', genre, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Ouvre une session avec un lien : l'accès est cherché dans l'espace du
 * lien seulement (un ancien lien sans espace : Label Maison).
 */
export async function entrerAvecLien<T extends AccesExterne>(
  genre: GenreAcces,
  jeton: unknown,
  espaceDuLien: unknown,
  maintenantMs: number = Date.now(),
): Promise<{ ok: true; acces: T; cookie: string; espace: string } | { ok: false; raison: RefusLien }> {
  const espace = espaceDe(espaceDuLien);
  let liste: T[];
  let base: BaseErp;
  try {
    base = baseAcces(espace);
    liste = await base.lire<T>(GENRES[genre].collection);
  } catch {
    return { ok: false, raison: 'inconnu' };
  }
  const r = await utiliserLien(
    liste.filter((a) => espaceDe(a.espace) === espace),
    jeton,
    maintenantMs,
  );
  if (!r.ok) return r;
  await base.ecrire(GENRES[genre].collection, [r.acces], `acces-${genre}`);
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
 * Accès d'une adresse dans chaque espace actif (base d'avant les espaces :
 * Label Maison seul). Un espace illisible est passé, jamais une erreur.
 */
export async function accesParEmail<T extends AccesExterne>(genre: GenreAcces, email: string): Promise<{ fiche: FicheEspace; acces: T; base: BaseErp }[]> {
  const res: { fiche: FicheEspace; acces: T; base: BaseErp }[] = [];
  for (const fiche of await espacesActifs()) {
    try {
      const base = baseAcces(fiche.id);
      const acces = (await base.lire<T>(GENRES[genre].collection)).find((a) => a?.email === email && a.statut !== 'retire' && espaceDe(a.espace) === fiche.id);
      if (acces) res.push({ fiche, acces, base });
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
