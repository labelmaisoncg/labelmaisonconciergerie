/**
 * Routing Middleware — protection par mot de passe de /linge uniquement.
 *
 * Le registre du linge contient des données internes (noms de logements,
 * prestataires, messages bruts de l'équipe conservés comme pièces d'audit).
 * Il ne doit pas être accessible publiquement, contrairement au reste du site.
 *
 * Deux variables d'environnement à définir dans Vercel (Settings → Environment
 * Variables), pour Production ET Preview :
 *   LINGE_USER      identifiant  (optionnel, défaut : "labelmaison")
 *   LINGE_PASSWORD  mot de passe (obligatoire)
 *
 * Si LINGE_PASSWORD n'est pas défini, l'accès est refusé — jamais ouvert.
 */

export const config = {
  matcher: ['/linge', '/linge/:path*'],
};

const REALM = 'Label Maison — registre du linge';

function refuser(): Response {
  return new Response('Authentification requise.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

/** Comparaison à temps constant : ne fuit pas la longueur du préfixe correct. */
function egal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** base64 → UTF-8 (atob seul casse les mots de passe accentués). */
function decodeBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export default function middleware(request: Request): Response | undefined {
  const utilisateur = process.env.LINGE_USER || 'labelmaison';
  const motDePasse = process.env.LINGE_PASSWORD;

  if (!motDePasse) return refuser();

  const entete = request.headers.get('authorization') || '';
  if (!entete.startsWith('Basic ')) return refuser();

  let identifiants: string;
  try {
    identifiants = decodeBase64(entete.slice(6).trim());
  } catch {
    return refuser();
  }

  const sep = identifiants.indexOf(':');
  if (sep === -1) return refuser();

  const userOk = egal(identifiants.slice(0, sep), utilisateur);
  const passOk = egal(identifiants.slice(sep + 1), motDePasse);

  // Les deux sont évalués systématiquement : pas de court-circuit qui
  // révélerait si c'est l'identifiant ou le mot de passe qui est faux.
  if (!userOk || !passOk) return refuser();

  // Authentifié — la requête suit son cours vers le fichier statique.
  return undefined;
}
