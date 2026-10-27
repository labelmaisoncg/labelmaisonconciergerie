/**
 * Routing Middleware — protection de /linge (mot de passe) et de /erp
 * (compte personnel : e-mail et mot de passe).
 *
 * Le registre du linge contient des données internes (noms de logements,
 * prestataires, messages bruts de l'équipe conservés comme pièces d'audit).
 * Il ne doit pas être accessible publiquement, contrairement au reste du site.
 * Il garde un mot de passe partagé et son propre cookie.
 *
 * L'ERP (/erp) demande l'adresse e-mail et le mot de passe d'un compte
 * Supabase membre de l'ERP (erp.membres, ou erp.qui_suis_je une fois les
 * espaces en place). La connexion se fait dans le navigateur, directement
 * auprès de Supabase (ses limites de tentatives s'appliquent à l'adresse IP
 * de la personne, pas à celle de Vercel) ; la page envoie ensuite les jetons à
 * /erp/connexion, qui vérifie le compte et l'appartenance à l'ERP, puis pose :
 *   - erp_session : cookie signé (v2), lié à l'identifiant du compte, 30 jours ;
 *   - erp_relais : cookie de 5 minutes réservé à /erp/session, qui remet la
 *     session Supabase à l'application (connexionAutomatique) une seule fois.
 * Les anciens cookies (mot de passe partagé) ne valent plus rien : chacun se
 * reconnecte une fois avec son adresse. Le compte d'équipe
 * (equipe@labelmaisoncg.fr, mot de passe = ERP_PASSWORD) reste un compte comme
 * les autres. « Mot de passe oublié ? » et les liens d'invitation ou de
 * récupération reçus par e-mail sont traités sur la même page.
 *
 * Pas de `WWW-Authenticate` / Basic auth ici : le navigateur affiche alors sa
 * propre fenêtre grise, hors charte, sans libellé exploitable et impossible à
 * quitter proprement. On sert à la place une vraie page de connexion, et la
 * session tient dans un cookie signé.
 *
 * Variables d'environnement à définir dans Vercel (Settings → Environment
 * Variables), pour Production ET Preview :
 *   LINGE_PASSWORD  mot de passe du registre du linge (obligatoire)
 *   ERP_PASSWORD    clé de signature des sessions de l'ERP (obligatoire) ; c'est
 *                   aussi le mot de passe du compte Supabase d'équipe, dont se
 *                   servent les fonctions serveur (api/). Le navigateur ne
 *                   reçoit plus jamais la session de ce compte.
 *
 * Après ajout ou modification, il faut REDÉPLOYER : la valeur est injectée au
 * build, un simple enregistrement dans l'interface Vercel ne suffit pas.
 *
 * Si la variable d'une zone n'est pas définie, l'accès est refusé — jamais ouvert.
 *
 * Contrôle : scripts/verifier-connexion-erp.ts.
 *
 * L'ERP est une application React : une fois connecté, toute sous-route
 * /erp/... sans extension est réécrite vers la coquille servie sous /erp
 * (cleanUrls désactive les rewrites de vercel.json, cf. scripts/spa-shells.mjs).
 * Toujours viser l'URL propre : avec cleanUrls, Vercel répond 404 à
 * /erp/index.html, et toute sous-route ouverte directement tombait en 404.
 */

export const config = {
  matcher: [
    '/linge',
    '/linge/:path*',
    '/erp',
    '/erp/:path*',
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/:path*',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-authorization-server/:path*',
  ],
};

/* ------------------------------------------- connecteur Claude (OAuth 2.1) */
// Découverte OAuth du connecteur MCP du CRM (/api/crm-mcp) : métadonnées
// publiques, sans secret (RFC 9728 et RFC 8414). Servies ici car les
// rewrites de vercel.json sont ignorés (cleanUrls). Mêmes adresses que
// src/erp/data/oauth-regles.ts.

const SITE = 'https://www.labelmaisoncg.fr';

const META_RESSOURCE_CRM = {
  resource: `${SITE}/api/crm-mcp`,
  authorization_servers: [SITE],
  bearer_methods_supported: ['header'],
  scopes_supported: ['crm'],
  resource_name: 'CRM Label Maison',
};

const META_SERVEUR_OAUTH = {
  issuer: SITE,
  authorization_endpoint: `${SITE}/erp/autoriser-claude`,
  token_endpoint: `${SITE}/api/oauth-token`,
  registration_endpoint: `${SITE}/api/oauth-register`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
  scopes_supported: ['crm'],
};

function metadonneesOAuth(chemin: string): Response | null {
  const meta = /^\/\.well-known\/oauth-protected-resource(\/api\/crm-mcp)?\/?$/.test(chemin)
    ? META_RESSOURCE_CRM
    : /^\/\.well-known\/oauth-authorization-server(\/.*)?$/.test(chemin)
      ? META_SERVEUR_OAUTH
      : null;
  if (!meta) return null;
  return new Response(JSON.stringify(meta), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

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
  /** Lien « Retour au site » sous la carte (pas pour l'ERP, devenu une app). */
  retourSite: boolean;
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
  retourSite: true,
};

const ERP: Zone = {
  racine: '/erp',
  cookie: 'erp_session',
  connexion: '/erp/connexion',
  deconnexion: '/erp/deconnexion',
  motDePasse: () => process.env.ERP_PASSWORD,
  variable: 'ERP_PASSWORD',
  titre: 'ERP Label Maison',
  sousTitre: 'Outil interne de gestion',
  bouton: 'Accéder à l’ERP',
  sousTitreIndisponible: 'Label Maison Conciergerie · ERP',
  objet: 'de l’ERP',
  separateurTitre: ' · ',
  coquille: '/erp',
  retourSite: false,
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

/** Pages internes jamais affichées dans le cadre d'un autre site (détournement de clic). */
const ANTI_CADRE = {
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'",
};

const ENTETES_HTML = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  ...ANTI_CADRE,
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

const ICONE_MAIL =
  '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="3.2" y="5.6" width="17.6" height="12.8" rx="2.4"/>' +
  '<path d="m4 7.2 8 5.6 8-5.6"/></svg>';

/** Coquille commune : badge, titre, sous-titre, panneau. */
function page(
  titre: string,
  sousTitre: string,
  panneau: string,
  statut: number,
  entetes: HeadersInit = {},
  separateurTitre = ' — ',
  retourSite = true,
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
    --ink:#2C2418; --ink-2:#7A7264; --ink-3:#676050;
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

  .champ + label{margin-top:16px}
  .lien{
    width:auto; margin:12px auto 0; padding:8px 10px; min-height:32px; display:flex;
    background:none; color:var(--ink-2); font-size:14.5px; font-weight:500;
  }
  .lien:hover{background:none; color:var(--gold); text-decoration:underline}
  .info{
    margin:0 0 18px; padding:11px 14px; border-radius:11px; font-size:14px;
    background:var(--field); border:1px solid var(--line-2); color:var(--ink);
  }
  .intro{margin:0 0 16px; font-size:15px; color:var(--ink)}
  button:disabled{opacity:.6; cursor:progress}
  [hidden]{display:none!important}

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
  ${retourSite ? '<p class="pied"><a href="/">← Retour au site</a></p>' : ''}
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
  if (zone === ERP) return pageConnexionErp(suite, erreur, statut, entetes);
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
    zone.retourSite,
  );
}

/** Données de la page de connexion de l'ERP, lues par son script (jamais de secret). */
function donneesPageErp(suite: string): string {
  return JSON.stringify({
    url: SUPABASE_ERP_URL,
    cle: SUPABASE_ERP_ANON,
    suite,
    connexion: ERP.connexion,
    retour: URL_RETOUR_ERP,
    stockage: STOCKAGE_SESSION_APP,
  }).replace(/</g, '\\u003c');
}

/**
 * Connexion à l'ERP : adresse e-mail et mot de passe d'un compte personnel.
 * Le script se connecte auprès de Supabase, envoie les jetons à
 * /erp/connexion (vérification du compte et de l'appartenance à l'ERP), puis
 * ouvre l'application. Il traite aussi « Mot de passe oublié ? » et les liens
 * reçus par e-mail (#access_token=…&type=recovery | invite | signup).
 */
function pageConnexionErp(suite: string, erreur: string, statut: number, entetes: HeadersInit = {}): Response {
  return page(
    ERP.titre,
    ERP.sousTitre,
    `<p id="erreur" class="erreur" role="alert"${erreur ? '' : ' hidden'}>${echapper(erreur)}</p>
     <p id="info" class="info" role="status" hidden></p>
     <form id="f-connexion" novalidate>
       <label for="email">Adresse e-mail</label>
       <div class="champ">
         ${ICONE_MAIL}
         <input id="email" type="email" name="email" placeholder="vous@exemple.fr"
                autocomplete="username" inputmode="email" autocapitalize="off"
                spellcheck="false" required>
       </div>
       <label for="mdp">Mot de passe</label>
       <div class="champ">
         ${ICONE_CADENAS}
         <input id="mdp" type="password" name="motdepasse" placeholder="Votre mot de passe"
                autocomplete="current-password" spellcheck="false" autocapitalize="off" required>
       </div>
       <button type="submit">${ICONE_CLE} ${echapper(ERP.bouton)}</button>
       <button type="button" class="lien" id="oubli">Mot de passe oublié ?</button>
     </form>
     <form id="f-nouveau" novalidate hidden>
       <p class="intro">Choisissez votre mot de passe : 8 caractères au moins.</p>
       <label for="nouveau">Nouveau mot de passe</label>
       <div class="champ">
         ${ICONE_CADENAS}
         <input id="nouveau" type="password" name="nouveau" placeholder="8 caractères au moins"
                autocomplete="new-password" minlength="8" spellcheck="false" autocapitalize="off" required>
       </div>
       <button type="submit">${ICONE_CLE} Enregistrer et ouvrir l’ERP</button>
     </form>
     <hr class="separateur">
     <p class="note">Accès réservé à l'équipe Label Maison.</p>
     <script>
     (function () {
       var C = ${donneesPageErp(suite)};
       var $ = function (id) { return document.getElementById(id); };
       var boiteErreur = $('erreur'), boiteInfo = $('info');
       var fConnexion = $('f-connexion'), fNouveau = $('f-nouveau');
       var champEmail = $('email'), champMdp = $('mdp'), champNouveau = $('nouveau');

       function dire(texte, ton) {
         boiteErreur.hidden = true; boiteInfo.hidden = true;
         if (!texte) return;
         var boite = ton === 'info' ? boiteInfo : boiteErreur;
         boite.textContent = texte; boite.hidden = false;
       }
       function occuper(form, oui) {
         var b = form.querySelectorAll('button');
         for (var i = 0; i < b.length; i++) b[i].disabled = oui;
       }
       // Mêmes traductions que l'application (src/erp/data/supabase.ts).
       function traduire(d, statut) {
         var m = String((d && (d.error_description || d.msg || d.message || d.error)) || '');
         if (statut === 429 || /rate limit|too many/i.test(m)) return 'Trop de tentatives. Patientez une minute avant de réessayer.';
         if (/invalid login credentials|invalid_grant/i.test(m)) return 'Adresse ou mot de passe incorrect.';
         if (/email not confirmed/i.test(m)) return 'Adresse e-mail non confirmée : ouvrez le lien reçu par e-mail, ou demandez à un gérant.';
         if (/password should be at least|weak password/i.test(m)) return 'Mot de passe trop court : 8 caractères au moins.';
         if (/same password|different from the old/i.test(m)) return 'Choisissez un mot de passe différent de l’ancien.';
         if (/session|jwt|token/i.test(m)) return 'Ce lien a expiré ou a déjà servi. Demandez un nouveau lien avec « Mot de passe oublié ? ».';
         return 'La connexion n’a pas abouti. Réessayez dans un instant.';
       }
       function supabase(chemin, options) {
         options.headers = Object.assign({ apikey: C.cle, 'Content-Type': 'application/json' }, options.headers || {});
         return fetch(C.url + chemin, options).then(function (r) {
           return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, statut: r.status, d: d }; });
         });
       }
       // Jetons Supabase → session de l'ERP (vérifiée par le serveur), puis l'application.
       function ouvrir(acces, rafraichir) {
         return fetch(C.connexion, {
           method: 'POST', credentials: 'same-origin',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ access_token: acces, refresh_token: rafraichir, suite: C.suite })
         }).then(function (r) {
           return r.json().catch(function () { return {}; }).then(function (d) {
             if (!r.ok || !d.ok) throw new Error(d.erreur || 'La connexion n’a pas abouti. Réessayez dans un instant.');
             // L'application reprend la session de ce compte (pas une session restée sur l'appareil).
             try { localStorage.removeItem(C.stockage); } catch (e) {}
             location.replace(d.suite || '/erp');
           });
         });
       }
       function echec(e) {
         dire(e && e.message && !/fetch|network|load failed/i.test(e.message) ? e.message : 'Connexion impossible. Vérifiez votre accès à internet.');
       }

       fConnexion.addEventListener('submit', function (ev) {
         ev.preventDefault();
         var email = champEmail.value.trim(), mdp = champMdp.value;
         if (!email || !mdp) { dire('Saisissez votre adresse e-mail et votre mot de passe.'); (email ? champMdp : champEmail).focus(); return; }
         dire(''); occuper(fConnexion, true);
         supabase('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: email, password: mdp }) })
           .then(function (r) {
             if (!r.ok || !r.d.access_token) throw new Error(traduire(r.d, r.statut));
             return ouvrir(r.d.access_token, r.d.refresh_token);
           })
           .catch(function (e) { echec(e); occuper(fConnexion, false); champMdp.select(); });
       });

       $('oubli').addEventListener('click', function () {
         var email = champEmail.value.trim();
         if (!email) { dire('Saisissez d’abord votre adresse e-mail, puis touchez « Mot de passe oublié ? ».'); champEmail.focus(); return; }
         occuper(fConnexion, true);
         supabase('/auth/v1/recover?redirect_to=' + encodeURIComponent(C.retour), { method: 'POST', body: JSON.stringify({ email: email }) })
           .then(function (r) {
             if (r.statut === 429) throw new Error(traduire(r.d, 429));
             dire('Si cette adresse a un compte, un lien pour choisir un mot de passe vient de lui être envoyé. Pensez à regarder dans les indésirables.', 'info');
           })
           .catch(echec)
           .then(function () { occuper(fConnexion, false); });
       });

       // Lien reçu par e-mail : les jetons sont après « # », jamais envoyés au serveur.
       var h = new URLSearchParams(location.hash.replace(/^#/, ''));
       if (location.hash.length > 1) history.replaceState(history.state, '', location.pathname + location.search);
       var acces = h.get('access_token'), rafraichir = h.get('refresh_token'), type = h.get('type');
       if (h.get('error_code') || h.get('error')) {
         dire(/expired|otp/i.test((h.get('error_code') || '') + (h.get('error_description') || ''))
           ? 'Ce lien a expiré ou a déjà servi. Demandez un nouveau lien avec « Mot de passe oublié ? ».'
           : 'Ce lien n’est pas valide. Demandez un nouveau lien avec « Mot de passe oublié ? ».');
       } else if (acces && rafraichir && (type === 'recovery' || type === 'invite')) {
         fConnexion.hidden = true; fNouveau.hidden = false; champNouveau.focus();
         fNouveau.addEventListener('submit', function (ev) {
           ev.preventDefault();
           var mdp = champNouveau.value;
           if (mdp.length < 8) { dire('Mot de passe trop court : 8 caractères au moins.'); champNouveau.focus(); return; }
           dire(''); occuper(fNouveau, true);
           supabase('/auth/v1/user', { method: 'PUT', headers: { Authorization: 'Bearer ' + acces }, body: JSON.stringify({ password: mdp }) })
             .then(function (r) {
               if (!r.ok) throw new Error(traduire(r.d, r.statut));
               return ouvrir(acces, rafraichir);
             })
             .catch(function (e) { echec(e); occuper(fNouveau, false); });
         });
       } else if (acces && rafraichir) {
         // Adresse confirmée (type=signup, magiclink…) : la session est déjà ouverte.
         dire('Connexion…', 'info');
         ouvrir(acces, rafraichir).catch(echec);
       } else if (!champEmail.value) {
         champEmail.focus();
       }
     })();
     </script>`,
    statut,
    entetes,
    ERP.separateurTitre,
    ERP.retourSite,
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
    zone.retourSite,
  );
}

/* ------------------------------------------------ session ERP (Supabase) */

/**
 * Comptes personnels : la page se connecte auprès de Supabase, /erp/connexion
 * vérifie le compte (GET /auth/v1/user) et son appartenance à l'ERP, puis pose
 * la session (erp_session, liée à l'identifiant du compte) et le relais
 * (erp_relais) que l'application échange une fois contre sa propre session
 * Supabase sur /erp/session. Le navigateur ne reçoit jamais la session du
 * compte d'équipe. Adresse et clé « anon » : valeurs publiques du projet.
 */
const SUPABASE_ERP_URL = 'https://ftfwnomkbjtlpijdevgx.supabase.co';
const SUPABASE_ERP_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0Zndub21rYmp0bHBpamRldmd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NDE0ODEsImV4cCI6MjEwMzMxNzQ4MX0.rKk8o84gAIw4Acz-kQM8w1Eb3yoc-Ec1cIuaJk6G5qs';
/** Retour des liens « mot de passe oublié » (= URL_RETOUR_MOT_DE_PASSE de l'application). */
const URL_RETOUR_ERP = 'https://www.labelmaisoncg.fr/erp';
/** Clé de la session Supabase de l'application (storageKey, src/erp/data/supabase.ts). */
const STOCKAGE_SESSION_APP = 'lm-erp-auth';

const COOKIE_RELAIS = 'erp_relais';
const DUREE_RELAIS = 300; // 5 minutes : le temps que l'application s'ouvre
const VERSION_SESSION = 'v2';
const ID_COMPTE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ENTETES_JSON = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const repondreJson = (corps: unknown, statut = 200, entetes?: Headers): Response => {
  const h = entetes ?? new Headers();
  for (const [k, v] of Object.entries(ENTETES_JSON)) h.set(k, v);
  return new Response(JSON.stringify(corps), { status: statut, headers: h });
};

/** Session de l'ERP : « v2.<compte>.<échéance>.<signature> ». Contexte signé distinct du linge et du relais. */
async function fabriquerSessionErp(compte: string, secret: string): Promise<string> {
  const exp = String(Math.floor(Date.now() / 1000) + DUREE);
  return `${VERSION_SESSION}.${compte}.${exp}.${await signer(`erp-session|${VERSION_SESSION}|${compte}|${exp}`, secret)}`;
}

/** Identifiant du compte si la session est valide, sinon null (ancien format compris). */
async function compteDeSession(jeton: string, secret: string): Promise<string | null> {
  const [version, compte, exp, sig, ...reste] = jeton.split('.');
  if (reste.length || version !== VERSION_SESSION || !compte || !exp || !sig) return null;
  if (!ID_COMPTE.test(compte) || !/^\d+$/.test(exp) || Number(exp) < Math.floor(Date.now() / 1000)) return null;
  return egal(sig, await signer(`erp-session|${VERSION_SESSION}|${compte}|${exp}`, secret)) ? compte : null;
}

function texteVersBase64url(texte: string): string {
  return base64url(encodeur.encode(texte));
}

function base64urlVersTexte(valeur: string): string | null {
  try {
    const b64 = valeur.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** Relais : « <compte>.<jeton de rafraîchissement>.<signature> », lié au compte de la session. */
async function fabriquerRelais(compte: string, rafraichir: string, secret: string): Promise<string> {
  const r = texteVersBase64url(rafraichir);
  return `${compte}.${r}.${await signer(`erp-relais|${compte}|${r}`, secret)}`;
}

async function lireRelais(valeur: string, compte: string, secret: string): Promise<string | null> {
  const [c, r, sig, ...reste] = valeur.split('.');
  if (reste.length || !c || !r || !sig || !egal(c, compte)) return null;
  if (!egal(sig, await signer(`erp-relais|${c}|${r}`, secret))) return null;
  return base64urlVersTexte(r);
}

const cookieSessionErp = (valeur: string, duree = DUREE) =>
  `${ERP.cookie}=${valeur}; Path=${ERP.racine}; Max-Age=${duree}; HttpOnly; Secure; SameSite=Lax`;
const cookieRelais = (valeur: string, duree = DUREE_RELAIS) =>
  `${COOKIE_RELAIS}=${valeur}; Path=/erp/session; Max-Age=${duree}; HttpOnly; Secure; SameSite=Strict`;

/**
 * Demande venue de la page elle-même : même origine (en-tête Origin, ou
 * Sec-Fetch-Site à défaut). Défense contre une connexion forcée depuis un
 * autre site (CSRF de connexion).
 */
function memeOrigine(request: Request, url: URL): boolean {
  const origine = request.headers.get('origin');
  if (origine) return origine === url.origin;
  return request.headers.get('sec-fetch-site') === 'same-origin';
}

const entetesSupabase = (jeton: string): Record<string, string> => ({
  apikey: SUPABASE_ERP_ANON,
  Authorization: `Bearer ${jeton}`,
});

/**
 * Le compte est-il membre de l'ERP ? erp.qui_suis_je (espaces) ; sur la base
 * d'avant les espaces (fonction absente), sa ligne dans erp.membres (les
 * règles RLS ne montrent que la sienne à un non-membre). null : la base n'a
 * pas répondu comme prévu.
 */
async function membreErp(jeton: string, email: string): Promise<boolean | null> {
  const r = await fetch(`${SUPABASE_ERP_URL}/rest/v1/rpc/qui_suis_je`, {
    method: 'POST',
    headers: { ...entetesSupabase(jeton), 'Content-Type': 'application/json', 'Content-Profile': 'erp', 'Accept-Profile': 'erp' },
    body: '{}',
  });
  if (r.ok) {
    const d = (await r.json().catch(() => null)) as { espaces?: unknown } | null;
    return Array.isArray(d?.espaces) && d!.espaces.length > 0;
  }
  const t = await r.text().catch(() => '');
  if (r.status !== 404 && !/PGRST202|42883|qui_suis_je/.test(t)) return null;
  const m = await fetch(`${SUPABASE_ERP_URL}/rest/v1/membres?select=role&email=eq.${encodeURIComponent(email)}&limit=1`, {
    headers: { ...entetesSupabase(jeton), 'Accept-Profile': 'erp' },
  });
  if (!m.ok) return null;
  const lignes = (await m.json().catch(() => null)) as unknown;
  return Array.isArray(lignes) && lignes.length > 0;
}

/** POST /erp/connexion : jetons Supabase de la page → session de l'ERP et relais. */
async function connexionErp(request: Request, url: URL, secret: string): Promise<Response> {
  if (!memeOrigine(request, url)) return repondreJson({ ok: false, erreur: 'Demande refusée : utilisez la page de connexion de l’ERP.' }, 403);
  if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) {
    return repondreJson({ ok: false, erreur: 'Demande refusée.' }, 415);
  }
  const brut = await request.text().catch(() => '');
  if (brut.length > 16_384) return repondreJson({ ok: false, erreur: 'Demande refusée.' }, 413);
  let corps: { access_token?: unknown; refresh_token?: unknown; suite?: unknown } = {};
  try {
    corps = JSON.parse(brut) ?? {};
  } catch {
    /* corps illisible : refusé plus bas */
  }
  const acces = typeof corps.access_token === 'string' && corps.access_token.length <= 8192 ? corps.access_token : '';
  const rafraichir = typeof corps.refresh_token === 'string' && corps.refresh_token.length <= 2048 ? corps.refresh_token : '';
  if (!acces || !rafraichir) return repondreJson({ ok: false, erreur: 'Connexion incomplète : réessayez.' }, 400);
  const suite = suiteSure(ERP, typeof corps.suite === 'string' ? corps.suite : ERP.racine);

  try {
    const u = await fetch(`${SUPABASE_ERP_URL}/auth/v1/user`, { headers: entetesSupabase(acces) });
    const compte = (await u.json().catch(() => ({}))) as { id?: unknown; email?: unknown };
    const id = typeof compte.id === 'string' ? compte.id.toLowerCase() : '';
    const email = typeof compte.email === 'string' ? compte.email.trim().toLowerCase() : '';
    if (!u.ok || !ID_COMPTE.test(id) || !email) {
      return repondreJson({ ok: false, erreur: 'Session refusée : reconnectez-vous.' }, 401);
    }
    const membre = await membreErp(acces, email);
    if (membre === null) return repondreJson({ ok: false, erreur: 'La base de l’ERP ne répond pas. Réessayez dans un instant.' }, 502);
    if (!membre) {
      return repondreJson({ ok: false, erreur: 'Ce compte n’a pas accès à l’ERP. Demandez à un gérant de vous ajouter.' }, 403);
    }
    const entetes = new Headers();
    entetes.append('Set-Cookie', cookieSessionErp(await fabriquerSessionErp(id, secret)));
    entetes.append('Set-Cookie', cookieRelais(await fabriquerRelais(id, rafraichir, secret)));
    return repondreJson({ ok: true, suite }, 200, entetes);
  } catch {
    return repondreJson({ ok: false, erreur: 'Connexion impossible. Réessayez dans un instant.' }, 502);
  }
}

/**
 * POST /erp/session (connexionAutomatique de l'application) : remet une fois la
 * session Supabase du compte qui vient de se connecter, à partir du relais.
 * Sans relais : 409, l'application affiche sa propre connexion. Jamais la
 * session du compte d'équipe.
 */
async function sessionRelais(request: Request, compte: string, secret: string): Promise<Response> {
  const entetes = new Headers();
  entetes.append('Set-Cookie', cookieRelais('', 0));
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return repondreJson({ ok: false, status: 403 }, 403, entetes);
  const rafraichir = await lireRelais(lireCookie(request, COOKIE_RELAIS), compte, secret);
  if (!rafraichir) return repondreJson({ ok: false, status: 409 }, 409, entetes);
  try {
    const r = await fetch(`${SUPABASE_ERP_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ERP_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rafraichir }),
    });
    const d = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; user?: { id?: string } };
    if (!r.ok || !d.access_token || !d.refresh_token || String(d.user?.id ?? '').toLowerCase() !== compte) {
      return repondreJson({ ok: false, status: 409 }, 409, entetes);
    }
    return repondreJson({ ok: true, access_token: d.access_token, refresh_token: d.refresh_token }, 200, entetes);
  } catch {
    return repondreJson({ ok: false, status: 0 }, 502, entetes);
  }
}

/* --------------------------------------------------------------- middleware */

export default async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/.well-known/')) {
    return metadonneesOAuth(url.pathname) ?? new Response('Introuvable.', { status: 404 });
  }
  const zone = zoneDe(url.pathname);

  // trim() : un copier-coller dans l'interface Vercel embarque très souvent un
  // espace ou un retour à la ligne final, invisible et impossible à retaper.
  const motDePasse = (zone.motDePasse() || '').trim();
  if (!motDePasse) return pageMalConfiguree(zone);

  const chemin = url.pathname.replace(/\/+$/, '') || zone.racine;
  // ERP : session personnelle (v2, liée au compte) ; linge : mot de passe partagé.
  const compte = zone === ERP ? await compteDeSession(lireCookie(request, zone.cookie), motDePasse) : null;
  const connecte = zone === ERP ? !!compte : await jetonValide(lireCookie(request, zone.cookie), motDePasse);

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
    if (zone === ERP) return connexionErp(request, url, motDePasse);
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

  if (zone === ERP && chemin === '/erp/session') {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    if (!compte) return repondreJson({ ok: false, status: 401 }, 401);
    return sessionRelais(request, compte, motDePasse);
  }

  if (connecte) {
    // Sous-route d'application (pas un fichier) : on sert la coquille SPA, le
    // routeur React prend le relais côté client.
    const dernier = chemin.slice(chemin.lastIndexOf('/') + 1);
    if (zone.coquille && chemin !== zone.racine && !dernier.includes('.')) {
      return new Response(null, {
        headers: { 'x-middleware-rewrite': new URL(zone.coquille, request.url).toString(), ...ANTI_CADRE },
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
