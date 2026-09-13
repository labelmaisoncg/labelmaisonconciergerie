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

if (routes.length === 0) {
  console.error('[spa-shells] aucune route trouvée dans src/app/App.tsx.');
  process.exit(1);
}

const html = readFileSync(shell, 'utf8');
for (const route of routes) {
  const dir = join(dist, route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}

console.log(`[spa-shells] ${routes.length} routes générées : ${routes.join(', ')}`);
