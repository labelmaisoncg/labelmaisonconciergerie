/**
 * Routing Middleware — protection de /linge et /erp par mot de passe.
 *
 * Le registre du linge contient des données internes (noms de logements,
 * prestataires, messages bruts de l'équipe conservés comme pièces d'audit).
 * Il ne doit pas être accessible publiquement, contrairement au reste du site.
 * L'ERP (/erp) suit exactement le même modèle, avec son propre mot de passe
 * et son propre cookie : ouvrir l'un n'ouvre pas l'autre.
 *
 * Pas de `WWW-Authenticate` / Basic auth ici : le navigateur affiche alors sa
 * propre fenêtre grise, hors charte, sans libellé exploitable et impossible à
 * quitter proprement. On sert à la place une vraie page de connexion, et la
 * session tient dans un cookie signé.
 *
 * Variables d'environnement à définir dans Vercel (Settings → Environment
 * Variables), pour Production ET Preview :
 *   LINGE_PASSWORD  mot de passe du registre du linge (obligatoire)
 *   ERP_PASSWORD    mot de passe de l'ERP (obligatoire)
 *
 * Après ajout ou modification, il faut REDÉPLOYER : la valeur est injectée au
 * build, un simple enregistrement dans l'interface Vercel ne suffit pas.
 *
 * Si la variable d'une zone n'est pas définie, l'accès est refusé — jamais ouvert.
 *
 * L'ERP est une application React : une fois connecté, toute sous-route
 * /erp/... sans extension est réécrite vers la coquille servie sous /erp
 * (cleanUrls désactive les rewrites de vercel.json, cf. scripts/spa-shells.mjs).
 * Toujours viser l'URL propre : avec cleanUrls, Vercel répond 404 à
 * /erp/index.html, et toute sous-route ouverte directement tombait en 404.
 */

export const config = {
  matcher: ['/linge', '/linge/:path*', '/erp', '/erp/:path*'],
};

const DUREE = 60 * 60 * 24 * 30; // 30 jours

/** Une zone protégée : racine, secret, cookie et libellés de ses pages. */
interface Zone {
  racine: string;
  cookie: string;
  connexion: string;
  deconnexion: string;
  /** Accès statique à process.env : Vercel n'injecte que les lectures littérales. */
  motDePasse: () => string | undefined;
  variable: string;
  titre: string;
  sousTitre: string;
  bouton: string;
  sousTitreIndisponible: string;
  objet: string;
  /** Séparateur du <title> : l'ERP n'utilise pas de tiret cadratin. */
  separateurTitre: string;
  /** Réécrire les sous-routes vers la coquille SPA. */
  coquille?: string;
}

const LINGE: Zone = {
  racine: '/linge',
  cookie: 'linge_session',
  connexion: '/linge/connexion',
  deconnexion: '/linge/deconnexion',
  motDePasse: () => process.env.LINGE_PASSWORD,
  variable: 'LINGE_PASSWORD',
  titre: 'Registre du linge',
  sousTitre: 'Label Maison Conciergerie — accès interne',
  bouton: 'Accéder au registre',
  sousTitreIndisponible: 'Label Maison Conciergerie — registre du linge',
  objet: 'du registre',
  separateurTitre: ' — ',
};

const ERP: Zone = {
  racine: '/erp',
  cookie: 'erp_session',
  connexion: '/erp/connexion',
  deconnexion: '/erp/deconnexion',
  motDePasse: () => process.env.ERP_PASSWORD,
  variable: 'ERP_PASSWORD',
  titre: 'ERP Label Maison',
  sousTitre: 'Outil interne de gestion · accès réservé',
  bouton: 'Accéder à l’ERP',
  sousTitreIndisponible: 'Label Maison Conciergerie · ERP',
  objet: 'de l’ERP',
  separateurTitre: ' · ',
  coquille: '/erp',
};

function zoneDe(chemin: string): Zone {
  return chemin === ERP.racine || chemin.startsWith(`${ERP.racine}/`) ? ERP : LINGE;
}

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
 * Conséquence utile : changer le mot de passe d'une zone invalide toutes ses sessions.
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
 * Une destination de retour n'est acceptée que si elle reste dans la zone.
 * Sans ce filtre, `suite` serait une redirection ouverte offerte à n'importe qui.
 */
function suiteSure(zone: Zone, valeur: string): string {
  return new RegExp(`^${zone.racine}(\\/[^\\s]*)?$`).test(valeur) &&
    valeur !== zone.connexion &&
    valeur !== zone.deconnexion
    ? valeur
    : zone.racine;
}

/* -------------------------------------------------------------------- vues */

const ENTETES_HTML = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

const ICONE_CADENAS =
  '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="4.2" y="10.4" width="15.6" height="9.9" rx="2.6"/>' +
  '<path d="M8.1 10.4V7.2a3.9 3.9 0 0 1 7.8 0v3.2"/></svg>';

const ICONE_CLE =
  '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="8.2" cy="15.8" r="3.6"/><path d="M10.9 13.2 20 4.1"/>' +
  '<path d="M17.2 6.9l2.1 2.1"/><path d="M14.6 9.5l2.1 2.1"/></svg>';

/** Coquille commune : badge, titre, sous-titre, panneau. */
function page(
  titre: string,
  sousTitre: string,
  panneau: string,
  statut: number,
  entetes: HeadersInit = {},
  separateurTitre = ' — ',
): Response {
  return new Response(
    `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="color-scheme" content="light">
<meta name="robots" content="noindex, nofollow">
<title>${echapper(titre)}${separateurTitre}Label Maison Conciergerie</title>
<link rel="icon" href="/images/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Playfair+Display:wght@500;600&display=swap">
<style>
  :root{
    /* Fond beige crème, carte en ivoire plus clair : le contraste des deux
       donne le relief sans avoir à charger en or. */
    --ground:#EAE1CF; --surface:#FDFBF6; --field:#F6F1E6;
    --ink:#2C2418; --ink-2:#7A7264; --ink-3:#9C9484;
    --line:rgba(40,34,22,.10); --line-2:rgba(40,34,22,.15);
    --gold:#A97C30; --gold-soft:rgba(169,124,48,.16);
    --brun:#2C2418; --brun-hover:#403118; --sur-brun:#F7F2E6;
    --crit:#B0322F; --crit-wash:#FBEEED;
    --f-sans:"Figtree",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    --f-serif:"Playfair Display",Georgia,serif;
    --ombre:0 1px 2px rgba(40,34,22,.04), 0 18px 44px -26px rgba(40,34,22,.34);
  }

  /* Palette unique : pas de variante sombre automatique, le fond reste beige. */
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{
    margin:0; min-height:100vh; background:var(--ground); color:var(--ink);
    font-family:var(--f-sans); font-size:15px; line-height:1.55;
    -webkit-font-smoothing:antialiased;
    display:flex; align-items:center; justify-content:center; padding:32px 20px;
  }
  .carte{width:100%; max-width:420px; text-align:center}

  .badge{
    width:76px; height:76px; margin:0 auto 22px; border-radius:20px;
    background:var(--brun); display:flex; align-items:center; justify-content:center;
    box-shadow:var(--ombre);
  }
  .badge img{width:44px; height:auto; display:block}

  h1{
    font-family:var(--f-serif); font-weight:600; font-size:38px; line-height:1.08;
    letter-spacing:-.01em; margin:0 0 8px; color:var(--ink);
  }
  .sous-titre{margin:0 0 30px; font-size:15px; color:var(--ink-3)}

  .panneau{
    background:var(--surface); border:1px solid var(--line-2);
    border-radius:16px; padding:28px 26px 24px; text-align:left; box-shadow:var(--ombre);
  }

  label{display:block; font-size:14.5px; font-weight:500; color:var(--ink-2); margin-bottom:9px}

  .champ{position:relative; display:flex; align-items:center}
  .champ .ic{
    position:absolute; left:15px; width:20px; height:20px;
    color:var(--ink-3); pointer-events:none;
  }
  .champ input{
    width:100%; padding:15px 16px 15px 46px; font:inherit; font-size:16px; color:var(--ink);
    background:var(--field); border:1px solid var(--line-2); border-radius:11px;
    transition:border-color .15s, box-shadow .15s;
  }
  .champ input::placeholder{color:var(--ink-3)}
  .champ input:focus{
    outline:none; border-color:var(--gold); box-shadow:0 0 0 4px var(--gold-soft);
  }
  .champ:focus-within .ic{color:var(--gold)}

  button{
    width:100%; margin-top:14px; padding:15px 18px;
    display:inline-flex; align-items:center; justify-content:center; gap:10px;
    font:inherit; font-size:16px; font-weight:600; letter-spacing:.01em;
    color:var(--sur-brun); background:var(--brun);
    border:0; border-radius:11px; cursor:pointer; transition:background .15s;
  }
  button .ic{width:19px; height:19px}
  button:hover{background:var(--brun-hover)}
  button:focus-visible{outline:2px solid var(--gold); outline-offset:3px}

  .erreur{
    margin:0 0 18px; padding:11px 14px; border-radius:11px; font-size:14px;
    background:var(--crit-wash); border:1px solid var(--crit); color:var(--crit);
  }

  .separateur{margin:22px 0 0; border:0; border-top:1px solid var(--line)}
  .note{margin:16px 0 0; text-align:center; font-size:13.5px; color:var(--ink-3)}
  .note code{
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12.5px; color:var(--ink-2);
  }
  .pied{margin:22px 0 0; font-size:13px; color:var(--ink-3)}
  .pied a{color:var(--ink-3); text-decoration:none}
  .pied a:hover{color:var(--gold); text-decoration:underline}

  @media (max-width:420px){ h1{font-size:32px} .panneau{padding:24px 20px 20px} }
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>
<div class="carte">
  <div class="badge"><img src="/images/key-gold.png" alt="Label Maison Conciergerie" width="586" height="223"></div>
  <h1>${echapper(titre)}</h1>
  <p class="sous-titre">${echapper(sousTitre)}</p>
  <div class="panneau">${panneau}</div>
  <p class="pied"><a href="/">← Retour au site</a></p>
</div>
</body>
</html>`,
    { status: statut, headers: { ...ENTETES_HTML, ...entetes } },
  );
}

function pageConnexion(
  zone: Zone,
  suite: string,
  erreur: string,
  statut: number,
  entetes: HeadersInit = {},
): Response {
  return page(
    zone.titre,
    zone.sousTitre,
    `${erreur ? `<p class="erreur">${echapper(erreur)}</p>` : ''}
     <form method="post" action="${zone.connexion}">
       <input type="hidden" name="suite" value="${echapper(suite)}">
       <label for="mdp">Mot de passe</label>
       <div class="champ">
         ${ICONE_CADENAS}
         <input id="mdp" type="password" name="motdepasse" placeholder="Entrez le mot de passe"
                autocomplete="current-password" autofocus required
                spellcheck="false" autocapitalize="off">
       </div>
       <button type="submit">${ICONE_CLE} ${echapper(zone.bouton)}</button>
     </form>
     <script>
       // Lien reçu par e-mail (mot de passe oublié de l'ERP) : l'adresse porte
       // des jetons après « # », que le navigateur n'envoie jamais au serveur.
       // On les garde pour la page suivante, sinon le lien serait perdu ici.
       (function () {
         var h = location.hash, s = document.querySelector('input[name=suite]');
         if (h && h.length > 1 && s && s.value.indexOf('#') < 0) s.value = s.value.replace(/\\/?$/, '/') + h;
       })();
     </script>
     <hr class="separateur">
     <p class="note">Accès réservé à l'équipe Label Maison.</p>`,
    statut,
    entetes,
    zone.separateurTitre,
  );
}

/**
 * 503 : la protection est mal configurée côté Vercel. Message distinct du refus
 * de mot de passe à dessein — sans ça, « variable absente » et « mot de passe
 * faux » sont indiscernables et le diagnostic est impossible.
 */
function pageMalConfiguree(zone: Zone): Response {
  return page(
    'Accès indisponible',
    zone.sousTitreIndisponible,
    `<p style="margin:0;color:var(--ink-2)">La protection ${zone.objet} n'est pas
     configurée : l'accès est refusé par sécurité plutôt que laissé ouvert.</p>
     <hr class="separateur">
     <p class="note">Vercel → Settings → Environment Variables → ajouter
     <code>${zone.variable}</code> (Production + Preview), puis <strong>redéployer</strong> :
     la valeur est injectée au build.</p>`,
    503,
    {},
    zone.separateurTitre,
  );
}

/* --------------------------------------------------------------- middleware */

export default async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);
  const zone = zoneDe(url.pathname);

  // trim() : un copier-coller dans l'interface Vercel embarque très souvent un
  // espace ou un retour à la ligne final, invisible et impossible à retaper.
  const motDePasse = (zone.motDePasse() || '').trim();
  if (!motDePasse) return pageMalConfiguree(zone);

  const chemin = url.pathname.replace(/\/+$/, '') || zone.racine;
  const connecte = await jetonValide(lireCookie(request, zone.cookie), motDePasse);

  const cookieVide =
    `${zone.cookie}=; Path=${zone.racine}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

  if (chemin === zone.deconnexion) {
    return pageConnexion(zone, zone.racine, '', 200, { 'Set-Cookie': cookieVide });
  }

  if (chemin === zone.connexion) {
    if (request.method !== 'POST') {
      return connecte
        ? new Response(null, { status: 303, headers: { Location: zone.racine, 'Cache-Control': 'no-store' } })
        : pageConnexion(zone, zone.racine, '', 200);
    }
    const champs = new URLSearchParams(await request.text());
    const suite = suiteSure(zone, champs.get('suite') || zone.racine);
    if (!egal(champs.get('motdepasse') || '', motDePasse)) {
      return pageConnexion(zone, suite, 'Mot de passe incorrect.', 401);
    }
    const jeton = await fabriquerJeton(motDePasse);
    return new Response(null, {
      status: 303,
      headers: {
        Location: suite,
        'Cache-Control': 'no-store',
        'Set-Cookie':
          `${zone.cookie}=${jeton}; Path=${zone.racine}; Max-Age=${DUREE}; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  if (connecte) {
    // Sous-route d'application (pas un fichier) : on sert la coquille SPA, le
    // routeur React prend le relais côté client.
    const dernier = chemin.slice(chemin.lastIndexOf('/') + 1);
    if (zone.coquille && chemin !== zone.racine && !dernier.includes('.')) {
      return new Response(null, {
        headers: { 'x-middleware-rewrite': new URL(zone.coquille, request.url).toString() },
      });
    }
    return undefined; // la requête suit son cours vers le fichier statique
  }

  // Les appels de données ne doivent pas récupérer du HTML de connexion : le
  // fetch() de la page échouerait sur un JSON.parse au lieu de dire « expiré ».
  if (/\.(json|txt|csv|xml)$/.test(chemin)) {
    return new Response('Session expirée ou absente.', {
      status: 401,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  return pageConnexion(zone, chemin + url.search, '', 401, { 'Set-Cookie': cookieVide });
}
