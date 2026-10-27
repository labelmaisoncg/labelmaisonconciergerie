/**
 * Photos de l'espace opérations (incident signalé, point de contrôle) : la
 * personne n'a pas de session sur la base, le serveur dépose la photo dans
 * l'espace privé des fichiers de l'ERP, dans le dossier de son espace
 * (api/_erp-repull.ts : compte d'équipe pour Label Maison, compte serveur
 * avec l'en-tête de l'espace sinon) et ne rend que l'adresse « stockage://… »
 * à enregistrer.
 *
 * Imports en « .js » : ce module tourne sous Node (fonctions Vercel).
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js';
import { BUCKET_FICHIERS_ERP } from './espaces.js';

export const BUCKET = BUCKET_FICHIERS_ERP;
/** Dossier des photos déposées par l'espace opérations. */
export const DOSSIER_OPERATIONS = 'operations';
/** 3 Mo après réduction dans le navigateur (une photo de téléphone réduite en fait 300 à 600 Ko). */
export const TAILLE_MAX_PHOTO = 3 * 1024 * 1024;
export const TYPES_PHOTO: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * Adresse d'une photo déposée par l'espace opérations, dans cet espace et par
 * cette personne (dossier « operations/<membre>/ ») : jamais le fichier d'un
 * autre membre, d'un autre espace ou d'un autre dossier, même si son adresse
 * est connue. Sans membre : rien n'est accepté.
 */
export function photoOperations(url: unknown, prefixeEspace: string, membreId?: string): url is string {
  if (typeof url !== 'string' || url.length > 300 || typeof membreId !== 'string' || !/^[\w-]{1,80}$/.test(membreId)) return false;
  const debut = `stockage://${BUCKET}/${prefixeEspace}${DOSSIER_OPERATIONS}/${membreId}/`;
  if (!url.startsWith(debut)) return false;
  return /^[\w-]+\.(jpg|png|webp)$/.test(url.slice(debut.length)) && !url.includes('..');
}

/** Octets d'une image envoyée en base64 (taille et type vérifiés), sinon null. */
export function lirePhoto(donnees: unknown, type: unknown): { octets: Uint8Array; type: string; extension: string } | null {
  const t = String(type ?? '');
  const extension = TYPES_PHOTO[t];
  if (!extension || typeof donnees !== 'string' || donnees.length > Math.ceil((TAILLE_MAX_PHOTO * 4) / 3) + 4) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(donnees)) return null;
  const octets = Uint8Array.from(atob(donnees), (c) => c.charCodeAt(0));
  if (!octets.length || octets.length > TAILLE_MAX_PHOTO) return null;
  // Signature du format : JPEG FF D8, PNG 89 50 4E 47, WebP « RIFF….WEBP ».
  const debut = Array.from(octets.slice(0, 12));
  const ok =
    (extension === 'jpg' && debut[0] === 0xff && debut[1] === 0xd8) ||
    (extension === 'png' && debut[0] === 0x89 && debut[1] === 0x50 && debut[2] === 0x4e && debut[3] === 0x47) ||
    (extension === 'webp' && String.fromCharCode(...debut.slice(0, 4)) === 'RIFF' && String.fromCharCode(...debut.slice(8, 12)) === 'WEBP');
  return ok ? { octets, type: t, extension } : null;
}

/**
 * Dépose un fichier dans l'espace privé ; rend « stockage://… » ou null.
 * `entetes` : en-têtes en plus (x-erp-espace : l'espace du compte serveur).
 */
export async function deposerFichierStockage(
  o: { jeton: () => Promise<string>; entetes?: Record<string, string>; url?: string; cleAnon?: string; fetch?: typeof fetch },
  chemin: string,
  octets: Uint8Array,
  type: string,
): Promise<string | null> {
  if (!chemin || chemin.split('/').some((x) => !x || x === '..' || x === '.')) return null;
  const url = (o.url ?? SUPABASE_URL).replace(/\/+$/, '');
  try {
    const r = await (o.fetch ?? fetch)(`${url}/storage/v1/object/${BUCKET}/${chemin.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: { ...o.entetes, apikey: o.cleAnon ?? SUPABASE_ANON_KEY, Authorization: `Bearer ${await o.jeton()}`, 'Content-Type': type, 'x-upsert': 'false' },
      body: octets as unknown as BodyInit,
    });
    return r.ok ? `stockage://${BUCKET}/${chemin}` : null;
  } catch {
    return null;
  }
}
