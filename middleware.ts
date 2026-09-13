/**
 * Routing Middleware — protection de /linge par mot de passe.
 *
 * Le registre du linge contient des données internes (noms de logements,
 * prestataires, messages bruts de l'équipe conservés comme pièces d'audit).
 * Il ne doit pas être accessible publiquement, contrairement au reste du site.
 *
 * Pas de `WWW-Authenticate` / Basic auth ici : le navigateur affiche alors sa
 * propre fenêtre grise, hors charte, sans libellé exploitable et impossible à
 * quitter proprement. On sert à la place une vraie page de connexion, et la
 * session tient dans un cookie signé.
 *
 * Variable d'environnement à définir dans Vercel (Settings → Environment
 * Variables), pour Production ET Preview :
 *   LINGE_PASSWORD  mot de passe (obligatoire)
 *
 * Après ajout ou modification, il faut REDÉPLOYER : la valeur est injectée au
 * build, un simple enregistrement dans l'interface Vercel ne suffit pas.
 *
 * Si LINGE_PASSWORD n'est pas défini, l'accès est refusé — jamais ouvert.
 */

export const config = {
  matcher: ['/linge', '/linge/:path*'],
};

const COOKIE = 'linge_session';
const DUREE = 60 * 60 * 24 * 30; // 30 jours
const CONNEXION = '/linge/connexion';
const DECONNEXION = '/linge/deconnexion';

/* ------------------------------------------------------------------ outils */

const encodeur = new TextEncoder();

/** base64url sans remplissage — sûr dans une valeur de cookie. */
function base64url(octets: Uint8Array): string {
  let bin = '';
  for (const o of octets) bin += String.fromCharCode(o);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Comparaison à temps constant : ne fuit pas la longueur du préfixe correct. */
function egal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Signature HMAC-SHA256 de l'échéance, clé = le mot de passe lui-même.
 * Conséquence utile : changer LINGE_PASSWORD invalide toutes les sessions.
 */
async function signer(donnee: string, secret: string): Promise<string> {
  const cle = await crypto.subtle.importKey(
    'raw',
    encodeur.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cle, encodeur.encode(donnee));
  return base64url(new Uint8Array(sig));
}

async function fabriquerJeton(secret: string): Promise<string> {
  const exp = String(Math.floor(Date.now() / 1000) + DUREE);
  return `${exp}.${await signer(exp, secret)}`;
}

async function jetonValide(jeton: string, secret: string): Promise<boolean> {
  const point = jeton.indexOf('.');
  if (point === -1) return false;
  const exp = jeton.slice(0, point);
  if (!/^\d+$/.test(exp) || Number(exp) < Math.floor(Date.now() / 1000)) return false;
  return egal(jeton.slice(point + 1), await signer(exp, secret));
}

function lireCookie(request: Request, nom: string): string {
  const brut = request.headers.get('cookie') || '';
  for (const morceau of brut.split(';')) {
    const sep = morceau.indexOf('=');
    if (sep !== -1 && morceau.slice(0, sep).trim() === nom) {
      return decodeURIComponent(morceau.slice(sep + 1).trim());
    }
  }
  return '';
}

const echapper = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Une destination de retour n'est acceptée que si elle reste dans /linge.
 * Sans ce filtre, `suite` serait une redirection ouverte offerte à n'importe qui.
 */
function suiteSure(valeur: string): string {
  return /^\/linge(\/[^\s]*)?$/.test(valeur) && valeur !== CONNEXION && valeur !== DECONNEXION
    ? valeur
    : '/linge';
}

/* -------------------------------------------------------------------- vues */

const ENTETES_HTML = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

function page(titre: string, corps: string, statut: number, entetes: HeadersInit = {}): Response {
  return new Response(
    `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${echapper(titre)} — Label Maison Conciergerie</title>
<link rel="icon" href="/images/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant:wght@500;600&family=Figtree:wght@400;500;600;700&display=swap">
<style>
  :root{
    --ground:#FBF9F4;--surface:#FFFFFF;--ink:#2C2418;--ink-2:#7A7264;--ink-3:#9C9484;
    --line:rgba(40,34,22,.10);--line-2:rgba(40,34,22,.16);--champagne:#D5C69F;
    --gold:#A97C30;--gold-dark:#7C561D;--gold-wash:#FAF5E9;--brun:#403118;
    --crit:#B0322F;--crit-wash:#FBEEED;
    --f-sans:"Figtree",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    --f-serif:"Cormorant","Cormorant Garamond",Georgia,serif;
  }
  @media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
    --ground:#191410;--surface:#221B14;--ink:#F4ECDA;--ink-2:#B7AB91;--ink-3:#8C8269;
    --line:rgba(213,198,159,.14);--line-2:rgba(213,198,159,.22);--champagne:#6B5A37;
    --gold:#C39A4A;--gold-dark:#DCC07C;--gold-wash:#2A2216;--brun:#E2D7BD;
    --crit:#DD817A;--crit-wash:#2E1A18;
  }}
  *{box-sizing:border-box}
  html,body{height:100%}
  body{
    margin:0;background:var(--ground);color:var(--ink);font-family:var(--f-sans);
    font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased;
    display:flex;align-items:center;justify-content:center;padding:24px;
  }
  .carte{width:100%;max-width:390px}
  .brandlogo{display:inline-flex;align-items:center;gap:.55em;line-height:1;font-family:var(--f-serif);font-size:24px}
  .bl-key{display:block;width:3.1em;height:auto;flex:none;filter:drop-shadow(0 2px 8px rgba(120,90,30,.22))}
  .bl-key.on-dark{display:none}
  @media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .bl-key.on-light{display:none}
    :root:not([data-theme="light"]) .bl-key.on-dark{display:block}}
  .bl-divider{width:1px;height:1.9em;flex:none;background:linear-gradient(180deg,transparent,var(--champagne),transparent)}
  .bl-text{display:flex;flex-direction:column}
  .bl-name{font-weight:600;letter-spacing:.06em;color:var(--brun);white-space:nowrap}
  .bl-sub{font-family:var(--f-sans);font-size:.4em;font-weight:600;letter-spacing:.3em;color:var(--ink-3)}
  .panneau{
    margin-top:26px;background:var(--surface);border:1px solid var(--line-2);
    border-radius:12px;padding:30px 26px 26px;
    box-shadow:0 1px 2px rgba(40,34,22,.04),0 12px 32px -18px rgba(40,34,22,.30);
  }
  .kicker{font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin:0 0 6px}
  h1{font-family:var(--f-serif);font-weight:600;font-size:30px;line-height:1.1;margin:0 0 8px;color:var(--ink)}
  .lede{margin:0 0 22px;font-size:13.5px;color:var(--ink-2)}
  label{display:block;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin-bottom:7px}
  input[type=password]{
    width:100%;padding:11px 13px;font:inherit;color:var(--ink);
    background:var(--ground);border:1px solid var(--line-2);border-radius:8px;
  }
  input[type=password]:focus{outline:2px solid var(--gold);outline-offset:1px;border-color:transparent}
  button{
    width:100%;margin-top:16px;padding:12px 16px;font:inherit;font-weight:600;letter-spacing:.02em;
    color:#fff;background:var(--gold);border:0;border-radius:8px;cursor:pointer;
  }
  button:hover{background:var(--gold-dark);color:var(--ground)}
  button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  .erreur{
    margin:0 0 18px;padding:10px 12px;border-radius:8px;font-size:13.5px;
    background:var(--crit-wash);border:1px solid var(--crit);color:var(--crit);
  }
  .note{margin:18px 0 0;padding-top:14px;border-top:1px solid var(--line);font-size:12px;color:var(--ink-3)}
  .note code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px}
  .pied{margin-top:18px;text-align:center;font-size:12px;color:var(--ink-3)}
  .pied a{color:var(--gold-dark)}
</style>
</head>
<body>
<div class="carte">
  <span class="brandlogo">
    <img class="bl-key on-light" src="/images/key-gold-deep.png" alt="" width="586" height="223">
    <img class="bl-key on-dark" src="/images/key-gold.png" alt="" width="586" height="223">
    <span class="bl-divider"></span>
    <span class="bl-text">
      <span class="bl-name">LABEL MAISON</span>
      <span class="bl-sub">CONCIERGERIE</span>
    </span>
  </span>
  <div class="panneau">${corps}</div>
  <p class="pied"><a href="/">← Retour au site</a></p>
</div>
</body>
</html>`,
    { status: statut, headers: { ...ENTETES_HTML, ...entetes } },
  );
}

function pageConnexion(suite: string, erreur: string, statut: number, entetes: HeadersInit = {}): Response {
  return page(
    'Registre du linge',
    `<p class="kicker">Document interne</p>
     <h1>Registre du linge</h1>
     <p class="lede">Accès réservé à l'équipe Label Maison.</p>
     ${erreur ? `<p class="erreur">${echapper(erreur)}</p>` : ''}
     <form method="post" action="${CONNEXION}">
       <input type="hidden" name="suite" value="${echapper(suite)}">
       <label for="mdp">Mot de passe</label>
       <input id="mdp" type="password" name="motdepasse" autocomplete="current-password"
              autofocus required spellcheck="false" autocapitalize="off">
       <button type="submit">Entrer</button>
     </form>`,
    statut,
    entetes,
  );
}

/**
 * 503 : la protection est mal configurée côté Vercel. Message distinct du refus
 * de mot de passe à dessein — sans ça, « variable absente » et « mot de passe
 * faux » sont indiscernables et le diagnostic est impossible.
 */
function pageMalConfiguree(): Response {
  return page(
    'Accès indisponible',
    `<p class="kicker">Configuration</p>
     <h1>Accès indisponible</h1>
     <p class="lede">La protection du registre n'est pas configurée, l'accès est donc
     refusé par sécurité.</p>
     <p class="note">À faire : Vercel → Settings → Environment Variables → ajouter
     <code>LINGE_PASSWORD</code> (Production + Preview), puis <strong>redéployer</strong>
     (la valeur est injectée au build).</p>`,
    503,
  );
}

/* --------------------------------------------------------------- middleware */

export default async function middleware(request: Request): Promise<Response | undefined> {
  // trim() : un copier-coller dans l'interface Vercel embarque très souvent un
  // espace ou un retour à la ligne final, invisible et impossible à retaper.
  const motDePasse = (process.env.LINGE_PASSWORD || '').trim();
  if (!motDePasse) return pageMalConfiguree();

  const url = new URL(request.url);
  const chemin = url.pathname.replace(/\/+$/, '') || '/linge';
  const connecte = await jetonValide(lireCookie(request, COOKIE), motDePasse);

  const cookieVide =
    `${COOKIE}=; Path=/linge; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

  if (chemin === DECONNEXION) {
    return pageConnexion('/linge', '', 200, { 'Set-Cookie': cookieVide });
  }

  if (chemin === CONNEXION) {
    if (request.method !== 'POST') {
      return connecte
        ? new Response(null, { status: 303, headers: { Location: '/linge', 'Cache-Control': 'no-store' } })
        : pageConnexion('/linge', '', 200);
    }
    const champs = new URLSearchParams(await request.text());
    const suite = suiteSure(champs.get('suite') || '/linge');
    if (!egal(champs.get('motdepasse') || '', motDePasse)) {
      return pageConnexion(suite, 'Mot de passe incorrect.', 401);
    }
    const jeton = await fabriquerJeton(motDePasse);
    return new Response(null, {
      status: 303,
      headers: {
        Location: suite,
        'Cache-Control': 'no-store',
        'Set-Cookie':
          `${COOKIE}=${jeton}; Path=/linge; Max-Age=${DUREE}; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  if (connecte) return undefined; // la requête suit son cours vers le fichier statique

  // Les appels de données ne doivent pas récupérer du HTML de connexion : le
  // fetch() de la page échouerait sur un JSON.parse au lieu de dire « expiré ».
  if (/\.(json|txt|csv|xml)$/.test(chemin)) {
    return new Response('Session expirée ou absente.', {
      status: 401,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  return pageConnexion(chemin + url.search, '', 401, { 'Set-Cookie': cookieVide });
}
