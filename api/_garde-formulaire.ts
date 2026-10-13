// =============================================================================
// Garde des formulaires publics du site (/api/contact, /api/dossier-proprietaire) :
// provenance du site, frein au nombre d'envois, échappement HTML des e-mails.
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

/** Pages autorisées à envoyer : le site, les aperçus Vercel de CE projet, le poste de développement. */
export const ORIGINES_SITE = /^https?:\/\/((www\.)?labelmaisoncg\.fr|(www\.)?labelmaisoncgexperience\.fr|labelmaisonconciergerie-[a-z0-9-]+\.vercel\.app|localhost(:\d+)?)(\/|$)/i;

/**
 * Frein, pas un mur : un navigateur envoie toujours Origin sur un POST, ce qui
 * écarte les autres sites et les robots naïfs (un script peut forger l'en-tête ;
 * pour plus, Turnstile ou une règle du pare-feu Vercel).
 */
export function provenanceSite(req: any): boolean {
  return ORIGINES_SITE.test(String(req.headers?.origin || req.headers?.referer || ''));
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
