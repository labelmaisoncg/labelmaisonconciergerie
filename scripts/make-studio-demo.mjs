// Fabrique la vidéo de démonstration avant/après du studio (9:16, prête à poster).
//
//   node scripts/make-studio-demo.mjs <photo-avant> [rendu-apres]
//
// Sans rendu « après », le script appelle le moteur d'image configuré dans .env
// (FAL_KEY) exactement comme le fait /api/studio-generate, puis monte la vidéo
// avec ffmpeg : plan sur l'avant, balayage, plan sur l'après, signature de la
// maison en bas. Sortie : public/videos/studio-demo.mp4 (+ poster .jpg).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = join(ROOT, 'public/videos');
const TMP = join(ROOT, 'node_modules/.cache/studio-demo');
const L = 1080;
const H = 1920;

const [, , avantArg, apresArg] = process.argv;
if (!avantArg) {
  console.error('Usage : node scripts/make-studio-demo.mjs <photo-avant> [rendu-apres]');
  process.exit(1);
}
mkdirSync(TMP, { recursive: true });
mkdirSync(SORTIE, { recursive: true });

// --- .env pour la clé du moteur d'image -------------------------------------
for (const l of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
  const i = l.indexOf('=');
  if (i > 0) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}

const PROMPT =
  'Photorealistic interior photograph of THIS EXACT room after a high-end renovation. ' +
  'Style: contemporary chic French interior, warm neutral palette, pale oak floor, ' +
  'handleless cabinetry, stone worktop, brushed brass fittings, linen curtains, ' +
  'sculptural lighting, a few refined pieces. Keep the existing architecture strictly ' +
  'identical: same camera viewpoint, same framing, same walls, same window and door ' +
  'positions, same ceiling height, same proportions. Only finishes, furniture, textiles, ' +
  'lighting and decoration are upgraded. Tidy staging, natural daylight from the existing ' +
  'window, luxurious but credible materials, professional real-estate photography, 35mm lens, ' +
  'sharp, realistic, magazine quality. No people, no text, no logo, no watermark, ' +
  'no added or removed walls.';

async function genererApres(cheminAvant) {
  const cle = process.env.FAL_KEY;
  if (!cle) throw new Error('FAL_KEY absente de .env');
  const source = await sharp(cheminAvant)
    .rotate()
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
  const modele = process.env.STUDIO_FAL_MODEL || 'fal-ai/nano-banana/edit';
  console.log(`[demo] génération du rendu via ${modele}…`);
  const rep = await fetch(`https://fal.run/${modele}`, {
    method: 'POST',
    headers: { Authorization: `Key ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: PROMPT,
      image_urls: [`data:image/jpeg;base64,${source.toString('base64')}`],
      num_images: 1,
      output_format: 'jpeg',
    }),
  });
  const json = await rep.json();
  if (!rep.ok) throw new Error(`fal.ai ${rep.status} : ${JSON.stringify(json).slice(0, 300)}`);
  const url = json?.images?.[0]?.url;
  if (!url) throw new Error('aucune image renvoyée');
  const bin = Buffer.from(await (await fetch(url)).arrayBuffer());
  const dest = join(TMP, 'apres.jpg');
  writeFileSync(dest, bin);
  return dest;
}

/**
 * Met une image au format 1080x1920 sans rien déformer :
 *  - photo verticale : on recadre (cover) ;
 *  - photo horizontale : on l'affiche en entier, posée sur un fond flouté tiré
 *    de la photo elle-même — sinon on perdrait la moitié de la pièce.
 * Les captures d'écran de téléphone arrivent souvent avec des bandes noires :
 * on les retire d'abord.
 */
async function cadrer(chemin, dest) {
  let image = sharp(chemin).rotate();
  try {
    const rogne = await image.clone().trim({ background: '#000000', threshold: 14 }).toBuffer();
    const { width, height } = await sharp(rogne).metadata();
    if (width > 400 && height > 400) image = sharp(rogne);
  } catch {
    /* rien à rogner */
  }

  const source = await image.jpeg({ quality: 96 }).toBuffer();
  const { width, height } = await sharp(source).metadata();

  if (height / width >= H / L) {
    await sharp(source).resize(L, H, { fit: 'cover', position: 'attention' }).jpeg({ quality: 94 }).toFile(dest);
    return dest;
  }

  const fond = await sharp(source)
    .resize(L, H, { fit: 'cover', position: 'centre' })
    .blur(45)
    .modulate({ brightness: 0.62 })
    .toBuffer();
  const premierPlan = await sharp(source).resize({ width: L }).toBuffer();
  const hauteurPP = (await sharp(premierPlan).metadata()).height;
  await sharp(fond)
    .composite([{ input: premierPlan, top: Math.round((H - hauteurPP) / 2), left: 0 }])
    .jpeg({ quality: 94 })
    .toFile(dest);
  return dest;
}

/** Bandeau bas : dégradé + lockup blanc de la marque. */
async function signature() {
  const LARGEUR_LOGO = 300;
  const logo = sharp(join(ROOT, 'public/images/logo-label-maison.png'))
    .resize({ width: LARGEUR_LOGO })
    .ensureAlpha();
  const { data, info } = await logo.toBuffer({ resolveWithObject: true });
  const alpha = await sharp(data).extractChannel('alpha').toBuffer();
  const blanc = await sharp({ create: { width: LARGEUR_LOGO, height: info.height, channels: 3, background: '#ffffff' } })
    .joinChannel(alpha)
    .png()
    .toBuffer();

  const degrade = Buffer.from(
    `<svg width="${L}" height="${H}" xmlns="http://www.w3.org/2000/svg">
       <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0.72" stop-color="#140f04" stop-opacity="0"/>
         <stop offset="1" stop-color="#140f04" stop-opacity="0.9"/>
       </linearGradient></defs>
       <rect width="${L}" height="${H}" fill="url(#g)"/>
       <text x="${L / 2}" y="${H - 58}" text-anchor="middle" fill="#E6CD93"
             font-family="Georgia, serif" font-size="30" letter-spacing="6">labelmaisoncg.fr</text>
     </svg>`,
  );

  return sharp({ create: { width: L, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: degrade, top: 0, left: 0 },
      { input: blanc, top: H - 130 - info.height, left: Math.round((L - LARGEUR_LOGO) / 2) },
    ])
    .png()
    .toFile(join(TMP, 'signature.png'));
}

/** Pastille « AVANT » ou « APRÈS ». */
async function pastille(texte, couleur, fichier) {
  const largeur = 90 + texte.length * 26;
  const svg = Buffer.from(
    `<svg width="${largeur}" height="88" xmlns="http://www.w3.org/2000/svg">
       <rect width="${largeur}" height="88" rx="44" fill="${couleur}"/>
       <text x="${largeur / 2}" y="57" text-anchor="middle" fill="#ffffff"
             font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="bold"
             letter-spacing="5">${texte}</text>
     </svg>`,
  );
  await sharp(svg).png().toFile(join(TMP, fichier));
  return { largeur };
}

const avant = await cadrer(avantArg, join(TMP, 'avant.jpg'));
const apres = await cadrer(apresArg || (await genererApres(avantArg)), join(TMP, 'apres-cadre.jpg'));
await signature();
await pastille('AVANT', 'rgba(44,36,24,0.72)', 'pastille-avant.png');
await pastille('APRÈS', 'rgba(124,86,29,0.85)', 'pastille-apres.png');

// --- Montage ----------------------------------------------------------------
const DUREE = 8;
const DEBUT_BALAYAGE = 2.2;
const BALAYAGE = 1.3;
const mp4 = join(SORTIE, 'studio-demo.mp4');

const filtre = [
  `[0:v]fps=30,format=rgba,setsar=1[a]`,
  `[1:v]fps=30,format=rgba,setsar=1[b]`,
  `[a][b]xfade=transition=wiperight:duration=${BALAYAGE}:offset=${DEBUT_BALAYAGE}[fond]`,
  `[fond][2:v]overlay=0:0[sig]`,
  // pastille AVANT : visible jusqu'au balayage ; pastille APRÈS : à partir du balayage
  `[sig][3:v]overlay=60:150:enable='lt(t,${DEBUT_BALAYAGE + BALAYAGE})'[p1]`,
  `[p1][4:v]overlay=W-w-60:150:enable='gte(t,${DEBUT_BALAYAGE})'[v]`,
].join(';');

execFileSync(
  'ffmpeg',
  [
    '-y', '-loglevel', 'error',
    '-loop', '1', '-t', String(DUREE), '-i', avant,
    '-loop', '1', '-t', String(DUREE), '-i', apres,
    '-i', join(TMP, 'signature.png'),
    '-i', join(TMP, 'pastille-avant.png'),
    '-i', join(TMP, 'pastille-apres.png'),
    '-filter_complex', filtre,
    '-map', '[v]',
    '-t', String(DUREE),
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-crf', '20', '-movflags', '+faststart',
    mp4,
  ],
  { stdio: 'inherit' },
);

// Poster : la première image de l'après, pour l'affichage avant lecture.
await sharp(apres).resize({ width: 720 }).jpeg({ quality: 82, mozjpeg: true })
  .toFile(join(SORTIE, 'studio-demo-poster.jpg'));

const taille = Math.round(readFileSync(mp4).length / 1024);
console.log(`[demo] ${mp4.replace(ROOT + '/', '')} — ${taille} Ko, ${DUREE}s, ${L}x${H}`);
