// Regénère api/_studio-watermark.ts depuis le logo de la marque.
//
// Les fonctions serverless Vercel ne voient pas public/ : la tuile de filigrane
// appliquée à l'aperçu gratuit du Studio est donc embarquée en base64 dans le
// code. Lancer `node scripts/make-studio-watermark.mjs` après un changement de
// logo.

import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LARGEUR = 190; // largeur du logo dans la tuile
const MARGE = 60; // espace entre deux motifs
const OPACITE = 0.42;

const logo = sharp(join(root, 'public/images/logo-label-maison.png'))
  .resize({ width: LARGEUR })
  .ensureAlpha();
const { data, info } = await logo.toBuffer({ resolveWithObject: true });

// Logo en blanc : on ne garde que sa silhouette (canal alpha), atténuée.
const alpha = await sharp(data).extractChannel('alpha').linear(OPACITE, 0).toBuffer();
const blanc = await sharp({
  create: { width: LARGEUR, height: info.height, channels: 3, background: '#ffffff' },
})
  .joinChannel(alpha)
  .png()
  .toBuffer();

const tuile = await sharp(blanc)
  .extend({
    top: MARGE,
    bottom: MARGE,
    left: MARGE,
    right: MARGE,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ compressionLevel: 9, palette: true })
  .toBuffer();

const lignes = tuile.toString('base64').match(/.{1,100}/g).join('\n');
writeFileSync(
  join(root, 'api/_studio-watermark.ts'),
  `// Tuile de filigrane « Label Maison Conciergerie » (PNG blanc semi-transparent,
// ${LARGEUR + MARGE * 2} x ${info.height + MARGE * 2}) générée depuis public/images/logo-label-maison.png.
// Embarquée en base64 : les fonctions serverless Vercel n'ont pas accès à public/.
// Regénérer : voir scripts/make-studio-watermark.mjs
export const WATERMARK_TILE_PNG = Buffer.from(
  \`
${lignes}
\`.replace(/\\s/g, ''),
  'base64',
);
`,
);

console.log(`[watermark] tuile ${LARGEUR + MARGE * 2}x${info.height + MARGE * 2} — ${tuile.length} octets`);
