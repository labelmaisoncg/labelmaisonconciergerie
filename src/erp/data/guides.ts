/**
 * Guides du logement (vidéo, photo, document, lien) et questions fréquentes :
 * règles communes à l'agent IA (serveur) et à la Messagerie (navigateur).
 *
 * Un guide marqué « accès » (clé, code) suit la règle des codes : il ne part
 * qu'aux voyageurs confirmés, dans les 48 h avant l'arrivée ou sur place.
 * Un fichier déposé part en lien signé, valable 7 jours.
 *
 * Ce module ne dépend que de la configuration (il tourne aussi côté serveur).
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js';
import type { GuideLogement, QuestionFrequente } from './types';

/** Durée d'un lien vers un fichier déposé, envoyé à un voyageur. */
export const DUREE_LIEN_GUIDE_S = 7 * 24 * 3600;
/** Guides joints à une même réponse, au plus. */
export const MAX_GUIDES_PAR_REPONSE = 2;
/** Taille d'un fichier de guide déposé (Mo) : au-delà, passer par un lien (YouTube, Drive…). */
export const TAILLE_MAX_GUIDE_MO = 50;

const PREFIXE_STOCKAGE = 'stockage://';
const HTTPS = /^https:\/\/[^\s"'<>]+$/i;

/** Adresse https valable pour un guide. */
export const estLienGuide = (u: string | undefined): u is string => !!u && HTTPS.test(u.trim());
/** Fichier déposé dans l'espace privé. */
export const estFichierGuide = (u: string | undefined): u is string => !!u && u.startsWith(PREFIXE_STOCKAGE);

/** Le guide a-t-il de quoi être envoyé (lien https ou fichier déposé) ? */
export function guideEnvoyable(g: GuideLogement): boolean {
  return !!g.titre?.trim() && (estLienGuide(g.media?.url) || estFichierGuide(g.media?.fichier));
}

/** Type d'un fichier choisi (vidéo, photo, document) d'après son type ou son extension. */
export function typeFichier(nom: string, mime = ''): GuideLogement['media']['type'] {
  if (mime.startsWith('video/') || /\.(mp4|mov|m4v|webm|3gp)$/i.test(nom)) return 'video';
  if (mime.startsWith('image/') || /\.(jpe?g|png|heic|webp|gif)$/i.test(nom)) return 'photo';
  return 'document';
}

export const LIBELLE_TYPE_GUIDE: Record<GuideLogement['media']['type'], string> = {
  video: 'Vidéo',
  photo: 'Photo',
  document: 'Document',
  lien: 'Lien',
};

/**
 * Guides à joindre d'après les ids choisis par l'agent : ids inconnus ou en
 * double ignorés, 2 au plus, guides d'accès retirés si les codes ne sont pas
 * encore communicables.
 */
export function guidesAJoindre(
  ids: readonly string[] | undefined,
  guides: readonly GuideLogement[] | undefined,
  codesOk: boolean,
): { joints: GuideLogement[]; retires: GuideLogement[] } {
  const parId = new Map((guides ?? []).filter(guideEnvoyable).map((g) => [g.id, g]));
  const joints: GuideLogement[] = [];
  const retires: GuideLogement[] = [];
  for (const id of new Set(ids ?? [])) {
    const g = parId.get(id);
    if (!g) continue;
    if (g.acces && !codesOk) retires.push(g);
    else if (joints.length < MAX_GUIDES_PAR_REPONSE) joints.push(g);
  }
  return { joints, retires };
}

/** Signe un fichier déposé : adresse temporaire, ou null (fichier illisible, pas de droits). */
export type SignerFichier = (fichier: string, secondes: number) => Promise<string | null>;

/** Adresse à envoyer pour un guide : le lien tel quel, ou un lien signé de 7 jours pour un fichier déposé. */
export async function lienGuide(g: GuideLogement, signer?: SignerFichier): Promise<string | null> {
  if (estLienGuide(g.media?.url)) return g.media.url!.trim();
  if (estFichierGuide(g.media?.fichier) && signer) {
    const l = await signer(g.media.fichier!, DUREE_LIEN_GUIDE_S).catch(() => null);
    return l && HTTPS.test(l) ? l : null;
  }
  return null;
}

/** Réponse avec les guides en fin de message : « Titre : lien », un par ligne. */
export function texteAvecGuides(texte: string, liens: { titre: string; lien: string }[]): string {
  if (!liens.length) return texte;
  return `${texte.trimEnd()}\n\n${liens.map((l) => `${l.titre.trim()} : ${l.lien}`).join('\n')}`;
}

/** Questions fréquentes complètes (question et réponse), dans l'ordre. */
export function questionsValides(q: readonly QuestionFrequente[] | undefined): QuestionFrequente[] {
  return (q ?? []).filter((x) => x.question?.trim() && x.reponse?.trim());
}

/**
 * Lien signé d'un fichier de l'espace privé, côté serveur (Supabase Storage) :
 * `stockage://<bucket>/<chemin>`. Le compte et l'espace (en-tête x-erp-espace
 * dans `entetes`) sont choisis par api/_erp-repull.ts (signeurFichiersErp).
 */
export async function signerFichierStockage(
  o: { jeton: () => Promise<string>; entetes?: Record<string, string>; url?: string; cleAnon?: string; fetch?: typeof fetch },
  fichier: string,
  secondes: number,
): Promise<string | null> {
  if (!estFichierGuide(fichier)) return null;
  const reste = fichier.slice(PREFIXE_STOCKAGE.length);
  const i = reste.indexOf('/');
  if (i <= 0) return null;
  const espace = reste.slice(0, i);
  const chemin = reste.slice(i + 1);
  if (!chemin || chemin.split('/').some((x) => x === '..' || x === '.')) return null;
  const url = (o.url ?? SUPABASE_URL).replace(/\/+$/, '');
  try {
    const r = await (o.fetch ?? fetch)(`${url}/storage/v1/object/sign/${encodeURIComponent(espace)}/${chemin.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: { ...o.entetes, apikey: o.cleAnon ?? SUPABASE_ANON_KEY, Authorization: `Bearer ${await o.jeton()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: secondes }),
    });
    if (!r.ok) return null;
    const d = (await r.json().catch(() => ({}))) as { signedURL?: string; signedUrl?: string };
    const relatif = d.signedURL ?? d.signedUrl;
    if (!relatif) return null;
    return /^https:\/\//.test(relatif) ? relatif : `${url}/storage/v1${relatif.startsWith('/') ? '' : '/'}${relatif}`;
  } catch {
    return null;
  }
}
