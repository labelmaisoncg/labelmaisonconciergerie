// Génère les icônes de l'app ERP installable (public/erp-app/) à partir de la
// clé de la marque (brand-assets/cle). À relancer seulement si le logo change :
//   node scripts/icones-erp.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const sortie = join(racine, 'public/erp-app');
const cleOr = join(racine, 'brand-assets/cle/cle-or-brillante.png');
const cleSilhouette = join(racine, 'brand-assets/cle/cle-or.png');
const BRUN = { r: 0x40, g: 0x31, b: 0x18, alpha: 1 };

mkdirSync(sortie, { recursive: true });

/** Clé or centrée sur un carré brun plein (les systèmes arrondissent eux-mêmes). */
async function icone(nom, taille, part) {
  const largeur = Math.round(taille * part);
  const cle = await sharp(cleOr).trim().resize({ width: largeur }).toBuffer();
  await sharp({ create: { width: taille, height: taille, channels: 4, background: BRUN } })
    .composite([{ input: cle, gravity: 'center' }])
    .png()
    .toFile(join(sortie, nom));
}

/** Petite icône de la barre d'état (Android) : silhouette blanche sur fond transparent. */
async function badge(nom, taille) {
  const largeur = Math.round(taille * 0.86);
  const forme = await sharp(cleSilhouette).trim().resize({ width: largeur }).ensureAlpha().toBuffer();
  const blanc = await sharp(forme).linear(0, 255).toBuffer();
  await sharp({ create: { width: taille, height: taille, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: blanc, gravity: 'center' }])
    .png()
    .toFile(join(sortie, nom));
}

await icone('icone-192.png', 192, 0.76);
await icone('icone-512.png', 512, 0.76);
// Zone sûre des icônes « maskable » : un cercle de 80 % ; la clé reste dedans.
await icone('icone-maskable-512.png', 512, 0.62);
await icone('apple-touch-icon.png', 180, 0.76);
await badge('badge-96.png', 96);
console.log('[icones-erp] icônes écrites dans public/erp-app/');
