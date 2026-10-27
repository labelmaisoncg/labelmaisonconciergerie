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

const COQUILLES = { '/erp': coquilleErp, '/espace-operations': coquilleOperations };

for (const route of routes) {
  const dir = join(dist, route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), COQUILLES[route] ? COQUILLES[route](html) : html);
}

console.log(`[spa-shells] ${routes.length} routes générées : ${routes.join(', ')}`);
