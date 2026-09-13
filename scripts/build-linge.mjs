/**
 * Génère public/linge/registre.json à partir de gestion/linge/registre.jsonl.
 *
 * La source de vérité reste le .jsonl versionné dans gestion/ — qui n'est PAS
 * servi par le site. Seule sa projection JSON atterrit dans public/linge/,
 * derrière le mot de passe du middleware.
 *
 * Lancé automatiquement par `npm run build`, avant vite.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(racine, 'gestion/linge/registre.jsonl');
const cible = resolve(racine, 'public/linge/registre.json');

const ecrire = async (entrees, avertissements) => {
  await mkdir(dirname(cible), { recursive: true });
  await writeFile(
    cible,
    JSON.stringify(
      { genere_le: new Date().toISOString(), entrees, avertissements },
      null,
      2,
    ) + '\n',
    'utf8',
  );
};

if (!existsSync(source)) {
  console.warn(`[linge] ${source} introuvable — registre vide généré.`);
  await ecrire([], ['Fichier source introuvable.']);
  process.exit(0);
}

const brut = await readFile(source, 'utf8');
const lignes = brut.split('\n').map((l) => l.trim()).filter(Boolean);

const entrees = [];
const avertissements = [];

lignes.forEach((ligne, i) => {
  try {
    const entree = JSON.parse(ligne);
    // Normalisation défensive : la page suppose ces deux tableaux présents.
    entree.linge_recupere ??= [];
    entree.linge_depose ??= [];
    if (!entree.date) avertissements.push(`Ligne ${i + 1} : date manquante.`);
    entrees.push(entree);
  } catch {
    avertissements.push(`Ligne ${i + 1} : JSON illisible, ignorée.`);
  }
});

entrees.sort((a, b) => String(b.date).localeCompare(String(a.date)));

await ecrire(entrees, avertissements);

console.log(
  `[linge] ${entrees.length} entrée(s) → public/linge/registre.json` +
    (avertissements.length ? ` (${avertissements.length} avertissement(s))` : ''),
);
