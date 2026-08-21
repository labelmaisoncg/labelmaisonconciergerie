/** Lecture minimale de .env.local, pour éviter une dépendance de plus. */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function lireEnv() {
  const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
  let brut = '';
  try {
    brut = readFileSync(join(racine, '.env.local'), 'utf8');
  } catch {
    console.error('.env.local introuvable — copie .env.example et remplis-le.');
    process.exit(1);
  }

  const env = {};
  for (const ligne of brut.split('\n')) {
    const nette = ligne.trim();
    if (!nette || nette.startsWith('#')) continue;
    const separateur = nette.indexOf('=');
    if (separateur === -1) continue;
    env[nette.slice(0, separateur).trim()] = nette.slice(separateur + 1).trim();
  }
  return { ...env, ...process.env };
}
