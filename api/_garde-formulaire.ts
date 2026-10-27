// =============================================================================
// Garde des formulaires publics du site (/api/contact, /api/dossier-proprietaire) :
// provenance du site, frein au nombre d'envois, échappement HTML des e-mails.
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

/**
 * Le site en production, et rien d'autre : pas de motif sur *.vercel.app
 * (n'importe qui peut y publier une page dont le nom commence pareil).
 */
export const ORIGINES_SITE = /^https:\/\/(www\.)?(labelmaisoncg|labelmaisoncgexperience)\.fr(\/|$)/i;

const POSTE_LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

/** Origine d'une adresse (« https://hote[:port] », minuscules) ; '' si illisible. */
export function origineDe(adresse: unknown): string {
  try {
    const u = new URL(String(adresse ?? ''));
    return /^https?:$/.test(u.protocol) ? u.origin.toLowerCase() : '';
  } catch {
    return '';
  }
}

/**
 * Aperçus autorisés : variable ORIGINES_APERCU du projet Vercel, origines
 * EXACTES séparées par des virgules (« https://mon-apercu.vercel.app »).
 */
export function originesApercu(): string[] {
  return String(process.env.ORIGINES_APERCU || '')
    .split(',')
    .map((o) => origineDe(o.trim()))
    .filter((o) => o.startsWith('https://'));
}

/** Page du site, aperçu déclaré, ou poste de développement (jamais sur Vercel en ligne). */
export function origineAutorisee(adresse: unknown): boolean {
  const o = origineDe(adresse);
  if (!o) return false;
  if (ORIGINES_SITE.test(o) || originesApercu().includes(o)) return true;
  const env = process.env.VERCEL_ENV;
  return (!env || env === 'development') && POSTE_LOCAL.test(o);
}

/**
 * Frein, pas un mur : un navigateur envoie toujours Origin sur un POST, ce qui
 * écarte les autres sites et les robots naïfs (un script peut forger l'en-tête ;
 * pour plus, Turnstile ou une règle du pare-feu Vercel).
 */
export function provenanceSite(req: any): boolean {
  return origineAutorisee(req.headers?.origin || req.headers?.referer || '');
}

export const adresseIp = (req: any): string => String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();

/** Au plus `max` envois par adresse IP sur la fenêtre (par instance du serveur). */
export function freinEnvois(max: number, fenetreMs: number) {
  const envois = new Map<string, number[]>();
  return (ip: string): boolean => {
    const maintenant = Date.now();
    const recents = (envois.get(ip) ?? []).filter((t) => maintenant - t < fenetreMs);
    recents.push(maintenant);
    envois.set(ip, recents);
    if (envois.size > 5000) envois.clear();
    return recents.length > max;
  };
}

export const echapperHtml = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
