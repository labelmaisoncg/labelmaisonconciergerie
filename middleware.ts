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
 * Après ajout ou modification d'une variable, il faut REDÉPLOYER : les valeurs
 * sont injectées au build, un simple enregistrement dans l'interface Vercel ne
 * suffit pas.
 *
 * Si LINGE_PASSWORD n'est pas défini, l'accès est refusé — jamais ouvert.
 */

export const config = {
  matcher: ['/linge', '/linge/:path*'],
};

// ASCII strictement : une valeur d'en-tête HTTP est une ByteString (0-255).
// Le tiret cadratin « — » (U+2014) y faisait planter `new Response(...)`, donc
// le middleware entier, donc /linge répondait 500 quoi qu'on tape.
const REALM = 'Label Maison - registre du linge';

const ENTETES_COMMUNES = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

/** 401 : identifiants absents ou faux. Le navigateur affiche la fenêtre de connexion. */
function refuser(): Response {
  return new Response('Authentification requise.', {
    status: 401,
    headers: {
      ...ENTETES_COMMUNES,
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });
}

/**
 * 503 : la protection est mal configurée côté Vercel.
 * Message distinct du 401 à dessein — sans ça, « variable absente » et
 * « mot de passe faux » sont indiscernables et le diagnostic est impossible.
 * Pas de WWW-Authenticate ici : redemander un mot de passe qui ne pourra
 * jamais être vérifié ne ferait que boucler.
 */
function malConfigure(): Response {
  return new Response(
    "LINGE_PASSWORD n'est pas défini dans la configuration Vercel — " +
      "accès refusé par sécurité.\n" +
      'À faire : Vercel → Settings → Environment Variables → ajouter ' +
      'LINGE_PASSWORD (Production + Preview), puis redéployer.',
    { status: 503, headers: ENTETES_COMMUNES },
  );
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
  // trim() : un copier-coller dans l'interface Vercel embarque très souvent un
  // espace ou un retour à la ligne final, invisible et impossible à retaper.
  const utilisateur = (process.env.LINGE_USER || 'labelmaison').trim();
  const motDePasse = (process.env.LINGE_PASSWORD || '').trim();

  if (!motDePasse) return malConfigure();

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
