// Génère un fichier dist/<route>/index.html pour chaque route React.
//
// Pourquoi : vercel.json active "cleanUrls" (indispensable pour les ~1 330 pages
// statiques de public/), et dans ce mode Vercel ignore le tableau "rewrites" —
// donc le fallback SPA (/(.*) -> /index.html) ne s'applique jamais et toutes les
// routes React renvoient un 404 en accès direct. En écrivant un vrai fichier à
// chaque route, c'est le système de fichiers qui répond, puis react-router prend
// le relais côté client.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const shell = join(dist, 'index.html');

if (!existsSync(shell)) {
  console.error('[spa-shells] dist/index.html introuvable — lancer vite build avant.');
  process.exit(1);
}

const app = readFileSync(join(root, 'src/app/App.tsx'), 'utf8');
const routes = [...app.matchAll(/<Route\s+path="(\/[^"*]+)"/g)]
  .map((m) => m[1].replace(/\/$/, ''))
  .filter(Boolean);

// ERP interne : sa route est « /erp/* » (exclue par la regex ci-dessus). On
// écrit la coquille de /erp explicitement ; le middleware réécrit toutes les
// sous-routes /erp/... vers ce fichier après authentification.
if (!routes.includes('/erp')) routes.push('/erp');

if (routes.length === 0) {
  console.error('[spa-shells] aucune route trouvée dans src/app/App.tsx.');
  process.exit(1);
}

const html = readFileSync(shell, 'utf8');

/**
 * App installée tenue en portrait, comme une app du téléphone. Android suit
 * le manifeste (« orientation »: « portrait ») ; l'iPhone l'ignore et ne
 * permet pas de bloquer la rotation : en paysage, l'app installée sur un
 * iPhone montre « Tournez votre téléphone » à la place de l'écran. Rien ne
 * change dans le navigateur, sur ordinateur ni sur iPad.
 */
function ecranPortrait(page, remplacer) {
  const style = [
    '    <style>',
    '      .lm-portrait { display: none; }',
    // Safari de l'iPhone seulement (Android suit le manifeste ; son clavier ouvert ne doit pas passer pour du paysage).
    '      @supports (-webkit-touch-callout: none) {',
    '        @media (display-mode: standalone) and (orientation: landscape) and (max-height: 500px) and (max-width: 1000px) and (pointer: coarse) {',
    '          .lm-portrait { position: fixed; inset: 0; z-index: 2147483647; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; background: #fbfaf8; color: #14110e; text-align: center; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }',
    '          .lm-portrait svg { width: 40px; height: 40px; margin-bottom: 8px; }',
    '          .lm-portrait strong { font-size: 17px; font-weight: 600; }',
    '          .lm-portrait span { font-size: 15px; color: rgba(20, 17, 14, 0.68); }',
    '          html, body { overflow: hidden; }',
    // L'app reste montée (rien ne se perd), mais hors de portée du lecteur d'écran et du clavier.
    '          #root { visibility: hidden; }',
    '        }',
    '      }',
    '    </style>',
  ].join('\n');
  const ecran = [
    '<body>',
    '    <div class="lm-portrait" role="status">',
    '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
    '      <strong>Tournez votre téléphone</strong>',
    '      <span>L’app s’utilise à la verticale.</span>',
    '    </div>',
  ].join('\n');
  return remplacer(remplacer(page, /<\/head>/, `${style}\n  </head>`), /<body>/, ecran);
}

/**
 * Coquille de l'ERP : pas de traduction automatique du navigateur dès le
 * premier octet (elle réécrit le texte sous React et fait planter
 * l'application), et tout ce qu'il faut pour l'installer comme une app
 * (manifeste, icône, plein écran, encoche de l'iPhone). Manifeste, icônes et
 * service worker sont servis hors de /erp (public/erp-app, public/erp-sw.js) :
 * le navigateur les charge sans session.
 */
function coquilleErp(page) {
  const remplacer = (texte, motif, par) => {
    if (!motif.test(texte)) console.warn(`[spa-shells] /erp : motif introuvable ${motif}`);
    return texte.replace(motif, par);
  };
  let p = remplacer(page, /<html lang="fr">/, '<html lang="fr" translate="no" class="notranslate">');
  p = remplacer(p, /<meta name="viewport" content="[^"]*"\s*\/?>/, '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />');
  p = remplacer(p, /<meta name="theme-color" content="[^"]*"\s*\/?>/, '<meta name="theme-color" content="#fbfaf8" />');
  p = remplacer(p, /<link rel="apple-touch-icon" href="[^"]*"\s*\/?>/, '<link rel="apple-touch-icon" href="/erp-app/apple-touch-icon.png" />');
  p = ecranPortrait(p, remplacer);
  return p.replace(
    '<head>',
    [
      '<head>',
      '    <meta name="google" content="notranslate" />',
      '    <link rel="manifest" href="/erp-app/manifest.webmanifest" />',
      '    <meta name="mobile-web-app-capable" content="yes" />',
      '    <meta name="apple-mobile-web-app-capable" content="yes" />',
      '    <meta name="apple-mobile-web-app-title" content="Label Maison" />',
      '    <meta name="apple-mobile-web-app-status-bar-style" content="default" />',
    ].join('\n'),
  );
}

/**
 * Coquille de l'espace opérations : l'app « Opérations » s'installe depuis
 * cette page (manifeste et service worker à part, portée /espace-operations,
 * servis hors de toute zone protégée : public/operations-app,
 * public/operations-sw.js). Le zoom reste permis.
 */
function coquilleOperations(page) {
  const remplacer = (texte, motif, par) => {
    if (!motif.test(texte)) console.warn(`[spa-shells] /espace-operations : motif introuvable ${motif}`);
    return texte.replace(motif, par);
  };
  let p = remplacer(page, /<html lang="fr">/, '<html lang="fr" translate="no" class="notranslate">');
  p = remplacer(p, /<meta name="viewport" content="[^"]*"\s*\/?>/, '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />');
  p = remplacer(p, /<meta name="theme-color" content="[^"]*"\s*\/?>/, '<meta name="theme-color" content="#fbfaf8" />');
  p = remplacer(p, /<link rel="apple-touch-icon" href="[^"]*"\s*\/?>/, '<link rel="apple-touch-icon" href="/erp-app/apple-touch-icon.png" />');
  p = ecranPortrait(p, remplacer);
  return p.replace(
    '<head>',
    [
      '<head>',
      '    <meta name="google" content="notranslate" />',
      '    <link rel="manifest" href="/operations-app/manifest.webmanifest" />',
      '    <meta name="mobile-web-app-capable" content="yes" />',
      '    <meta name="apple-mobile-web-app-capable" content="yes" />',
      '    <meta name="apple-mobile-web-app-title" content="Opérations" />',
      '    <meta name="apple-mobile-web-app-status-bar-style" content="default" />',
    ].join('\n'),
  );
}

// ---------------------------------------------------------------------------
// Balises SEO par route. Sans cela, chaque coquille recopie le <title>, la
// description et surtout la balise canonical de l'accueil : Google lit alors
// /proprietaires ou /studio comme une copie de « / » avant même d'exécuter le
// JavaScript (react-helmet-async ne corrige qu'après). On écrit donc, dans le
// HTML brut, les mêmes valeurs que le <Helmet> de chaque page, et un noindex
// pour les espaces privés.
// ---------------------------------------------------------------------------
const SITE = 'https://www.labelmaisoncg.fr';
const META = {
  '/': {
    title: 'Conciergerie Airbnb Paris & Essonne · Label Maison Conciergerie',
    description:
      'Label Maison gère votre location courte durée de A à Z à Paris, en Essonne et en Île-de-France : annonce, voyageurs, ménage hôtelier, revenus. Estimation gratuite.',
  },
  '/proprietaires': {
    title: 'Gestion de biens immobiliers clé en main · Label Maison Conciergerie',
    description:
      'Confiez la gestion de votre patrimoine immobilier à une conciergerie privée haut de gamme à Paris. Revenus optimisés, sérénité totale, performance prouvée.',
  },
  '/billetterie': {
    title: "Billetterie d'avion · Vols privés et première classe · Label Maison",
    description:
      'Réservation de vols premium : jets privés, première classe Emirates, Qatar Airways. Notre équipe orchestre vos voyages 24/7 avec discrétion.',
  },
  '/logement': {
    title: "Logements d'exception · Suites, villas et penthouses · Label Maison",
    description:
      'Studios élégants, suites avec jacuzzi, villas et penthouses : des lieux à la hauteur de votre style de vie. Service conciergerie inclus.',
  },
  '/transport': {
    title: 'Transport privé · Berlines, SUV, véhicules blindés · Label Maison',
    description:
      'Chauffeur privé à Paris et international : berlines de luxe, SUV premium, véhicules blindés. Disponibilité 24/7.',
  },
  '/activites': {
    title: 'Activités exclusives VIP · Paris, Dubaï, Marrakech · Label Maison',
    description:
      'Yacht privé Dubaï, croisière Seine, hammam royal Marrakech, shooting Tour Eiffel : expériences exclusives orchestrées sur mesure.',
  },
  '/shopping': {
    title: 'Personal Shopping · Horlogerie, mode, joaillerie · Label Maison',
    description:
      'Sourcing de pièces rares : Rolex, Hermès Birkin, Patek Philippe, Cartier. Authentification, négociation discrète, livraison sécurisée mondiale.',
  },
  '/cerclelabelmaison': {
    title: 'Le Cercle LabelMaison — Recommandez un propriétaire, gagnez 150 €',
    description:
      "Recommandez un propriétaire. Gagnez 150 €. Le programme d'affiliation de LabelMaison Conciergerie : aucune commission, aucun engagement, prime à la première réservation.",
  },
  '/studio': {
    title: 'Rendu déco luxe de votre chambre à partir d’une photo — Label Maison Studio',
    description:
      'Envoyez une photo de votre chambre ou salon : le studio Label Maison en génère la version luxe photoréaliste, sans travaux. Aperçu gratuit, rendu HD à 9,99 €.',
  },
  '/studio/conditions': {
    title: 'Conditions, remboursement et données — Label Maison Studio',
    description:
      'Conditions générales de vente, politique de remboursement, protection des données personnelles et mentions légales du service Label Maison Studio.',
    robots: 'noindex,follow',
  },
  '/mentions-legales': {
    title: 'Mentions légales — Label Maison Conciergerie',
    description:
      'Mentions légales du site Label Maison Conciergerie : éditeur, directeur de la publication, hébergeur et contact.',
    robots: 'noindex,follow',
  },
  '/politique-de-confidentialite': {
    title: 'Politique de confidentialité — Label Maison Conciergerie',
    description:
      'Vos données chez Label Maison Conciergerie : ce que nous collectons, pourquoi, combien de temps, nos prestataires, les cookies et vos droits RGPD.',
    robots: 'noindex,follow',
  },
};
// Espaces privés (connexion requise) : jamais dans l'index.
const PRIVEES = ['/erp', '/dossier-proprietaire', '/espace-proprietaire', '/espace-operations', '/sejour'];

const echap = (t) =>
  t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function coquilleSeo(page, route) {
  const m = META[route];
  const privee = PRIVEES.includes(route);
  if (!m && !privee) {
    console.warn(`[spa-shells] ${route} : pas de balises SEO dédiées (META), la coquille garde celles de l'accueil.`);
    return page;
  }
  const remplacer = (texte, motif, par) => {
    if (!motif.test(texte)) console.warn(`[spa-shells] ${route} : motif introuvable ${motif}`);
    return texte.replace(motif, par);
  };
  let p = page;
  const url = `${SITE}${route}`;
  if (privee) {
    p = remplacer(p, /<meta name="robots" content="[^"]*"\s*\/?>/, '<meta name="robots" content="noindex, nofollow" />');
    // Pas de canonical ni d'Open Graph pour une page privée : rien à partager ni à indexer.
    p = remplacer(p, /\s*<link rel="canonical" href="[^"]*"\s*\/?>/, '');
    return p;
  }
  const title = echap(m.title);
  const desc = echap(m.description);
  p = remplacer(p, /<title>[^<]*<\/title>/, `<title>${title}</title>`);
  p = remplacer(p, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${desc}" />`);
  p = remplacer(p, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`);
  p = remplacer(p, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${title}" />`);
  p = remplacer(p, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${desc}" />`);
  p = remplacer(p, /<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`);
  if (m.robots) {
    p = remplacer(p, /<meta name="robots" content="[^"]*"\s*\/?>/, `<meta name="robots" content="${m.robots}" />`);
  }
  return p;
}

const COQUILLES = { '/erp': coquilleErp, '/espace-operations': coquilleOperations };

for (const route of routes) {
  const dir = join(dist, route);
  mkdirSync(dir, { recursive: true });
  const base = COQUILLES[route] ? COQUILLES[route](html) : html;
  writeFileSync(join(dir, 'index.html'), route === '/' ? base : coquilleSeo(base, route));
}

console.log(`[spa-shells] ${routes.length} routes générées : ${routes.join(', ')}`);
