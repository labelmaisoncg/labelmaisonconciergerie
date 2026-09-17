// =============================================================================
// Label Maison Studio — briques communes aux fonctions /api/studio-*.
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel : ce
// module sert uniquement de bibliothèque interne.
//
// Principe du paywall : le rendu HD ne quitte JAMAIS le serveur avant qu'un
// paiement Stripe soit confirmé. Le navigateur ne reçoit que deux choses à
// l'issue de la génération gratuite :
//   1. un aperçu dégradé (basse résolution + flou + filigrane, fabriqué ici) ;
//   2. un « scellé » : l'emplacement du rendu HD chiffré en AES-256-GCM avec
//      STUDIO_SECRET. Illisible côté client, il revient au serveur au moment du
//      déblocage, qui vérifie d'abord le paiement auprès de Stripe.
// Ce scellé évite d'avoir à stocker quoi que ce soit entre les deux appels
// (les fonctions serverless n'ont pas de mémoire partagée).
// =============================================================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { Resend } from 'resend';
import { WATERMARK_TILE_PNG } from './_studio-watermark.js';

// -----------------------------------------------------------------------------
// Ambiances proposées dans le studio
// -----------------------------------------------------------------------------
export type AmbianceKey = 'contemporain' | 'haussmannien' | 'boheme' | 'minimaliste';

export const AMBIANCES: Record<AmbianceKey, { label: string; style: string }> = {
  contemporain: {
    label: 'Contemporain chic',
    style:
      'contemporary chic French interior, warm neutral palette, walnut and brushed brass accents, ' +
      'designer sofa, linen curtains, sculptural lighting',
  },
  haussmannien: {
    label: 'Haussmannien',
    style:
      'classic Parisian Haussmann interior, herringbone oak parquet, white mouldings and cornices, ' +
      'marble fireplace, velvet armchairs, tall mirror',
  },
  boheme: {
    label: 'Bohème doux',
    style:
      'soft bohemian interior, natural textures, rattan and light oak, woven rugs, ' +
      'earthy off-white palette, abundant greenery, layered textiles',
  },
  minimaliste: {
    label: 'Minimaliste lumineux',
    style:
      'bright minimalist interior, off-white walls, pale oak floor, very few but refined pieces, ' +
      'clean lines, generous negative space, soft daylight',
  },
};

/** Nettoie la demande libre du visiteur avant de l'injecter dans la consigne. */
export function nettoyerPrecisions(texte: unknown): string {
  return String(texte ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/["`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

/**
 * Consigne envoyée au modèle : rénovation crédible, architecture conservée.
 * Calibrage validé en conditions réelles (même point de vue, mêmes ouvertures,
 * mobilier remplacé, lumière naturelle). Les demandes libres du visiteur sont
 * ajoutées à la fin, subordonnées aux contraintes qui précèdent.
 */
export function promptRendu(amb: AmbianceKey, precisions = ''): string {
  const { style } = AMBIANCES[amb];
  const souhait = nettoyerPrecisions(precisions);
  return (
    `Photorealistic interior photograph of THIS EXACT room after a high-end renovation. Style: ${style}. ` +
    'Keep the existing architecture strictly identical: same camera viewpoint, same framing, same walls, ' +
    'same window and door positions, same ceiling height, same proportions, same floor layout. ' +
    'Only the finishes, furniture, textiles, lighting and decoration are upgraded. ' +
    'Replace worn or mismatched furniture with elegant designer pieces, add layered rugs, curtains, ' +
    'greenery and warm decorative lighting. Tidy staging, natural daylight coming from the existing windows, ' +
    'luxurious but credible materials, professional real-estate photography, 35mm lens, sharp, realistic, ' +
    'high dynamic range, magazine quality. ' +
    'No people, no text, no logo, no watermark, no surreal or impossible elements, no added or removed walls.' +
    (souhait
      ? ` Additional wishes from the owner, to honour only where they remain compatible with the constraints above: '${souhait}'.`
      : '')
  );
}

// -----------------------------------------------------------------------------
// Erreurs porteuses d'un code HTTP
// -----------------------------------------------------------------------------
export class StudioError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function repondreErreur(res: any, err: unknown) {
  const status = err instanceof StudioError ? err.status : 500;
  const message =
    err instanceof StudioError ? err.message : 'Erreur serveur inattendue. Réessayez dans un instant.';
  if (!(err instanceof StudioError)) console.error('[studio]', err);
  return res.status(status).json({ ok: false, error: message });
}

export function lireCorps<T>(req: any): T {
  try {
    return (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}) as T;
  } catch {
    throw new StudioError(400, 'Requête invalide.');
  }
}

export function ipClient(req: any): string {
  const fwd = String(req.headers['x-forwarded-for'] || '');
  return fwd.split(',')[0].trim() || req.socket?.remoteAddress || 'inconnue';
}

export function origine(req: any): string {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'labelmaisoncgexperience.fr');
  return `${proto}://${host}`;
}

// -----------------------------------------------------------------------------
// Scellé : chiffrement AES-256-GCM de l'emplacement du rendu HD
// -----------------------------------------------------------------------------
export type Scelle = {
  /**
   * « url » : fichier hébergé par le fournisseur d'images ; « sb » : Supabase
   * Storage ; « fs » : disque local, réservé au mode démo de développement.
   */
  k: 'url' | 'sb' | 'fs';
  v: string;
  amb: AmbianceKey;
  t: number;
};

function cleSecrete(): Buffer {
  const secret = process.env.STUDIO_SECRET;
  if (!secret || secret.length < 16) {
    throw new StudioError(
      500,
      'STUDIO_SECRET manquante côté serveur (32 caractères aléatoires minimum).',
    );
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export function sceller(payload: Scelle): string {
  const iv = crypto.randomBytes(12);
  const chiffreur = crypto.createCipheriv('aes-256-gcm', cleSecrete(), iv);
  const corps = Buffer.concat([chiffreur.update(JSON.stringify(payload), 'utf8'), chiffreur.final()]);
  return Buffer.concat([iv, chiffreur.getAuthTag(), corps]).toString('base64url');
}

export function desceller(token: string): Scelle {
  try {
    const brut = Buffer.from(String(token || ''), 'base64url');
    const dechiffreur = crypto.createDecipheriv('aes-256-gcm', cleSecrete(), brut.subarray(0, 12));
    dechiffreur.setAuthTag(brut.subarray(12, 28));
    const clair = Buffer.concat([dechiffreur.update(brut.subarray(28)), dechiffreur.final()]);
    return JSON.parse(clair.toString('utf8')) as Scelle;
  } catch (err) {
    if (err instanceof StudioError) throw err;
    throw new StudioError(400, 'Rendu introuvable ou expiré. Relancez une génération.');
  }
}

/** Empreinte du scellé, transmise à Stripe pour lier un paiement à un rendu précis. */
export function empreinte(scelle: string): string {
  return crypto.createHash('sha256').update(String(scelle)).digest('hex').slice(0, 40);
}

// Stripe limite chaque valeur de metadata à 500 caractères : on découpe le scellé.
const TAILLE_CHUNK = 450;

export function scelleVersMetadata(scelle: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const morceaux = scelle.match(new RegExp(`.{1,${TAILLE_CHUNK}}`, 'g')) || [];
  morceaux.forEach((m, i) => {
    meta[`scelle_${i}`] = m;
  });
  meta.scelle_n = String(morceaux.length);
  return meta;
}

export function scelleDepuisMetadata(meta: Record<string, string> | undefined): string {
  if (!meta) return '';
  const n = Number(meta.scelle_n || 0);
  let out = '';
  for (let i = 0; i < n; i += 1) out += meta[`scelle_${i}`] || '';
  return out;
}

// -----------------------------------------------------------------------------
// Garde-fou anti-abus (best effort : mémoire de l'instance serverless)
// -----------------------------------------------------------------------------
const compteurs = new Map<string, { n: number; debut: number }>();
const FENETRE_MS = 24 * 60 * 60 * 1000;

export function verifierQuota(cle: string, max: number, message: string) {
  const maintenant = Date.now();
  const courant = compteurs.get(cle);
  if (!courant || maintenant - courant.debut > FENETRE_MS) {
    compteurs.set(cle, { n: 1, debut: maintenant });
  } else if (courant.n >= max) {
    throw new StudioError(429, message);
  } else {
    courant.n += 1;
  }
  if (compteurs.size > 5000) compteurs.clear(); // borne mémoire
}

// -----------------------------------------------------------------------------
// Génération de l'image — fournisseur choisi par les variables d'environnement
// -----------------------------------------------------------------------------
type Sortie = { hd: Buffer; url: string | null };

async function viaFal(dataUrl: string, prompt: string): Promise<Sortie> {
  const modele = process.env.STUDIO_FAL_MODEL || 'fal-ai/nano-banana/edit';
  const entree: Record<string, unknown> = { prompt, num_images: 1, output_format: 'jpeg' };
  if (modele.includes('nano-banana')) entree.image_urls = [dataUrl];
  else entree.image_url = dataUrl;

  const rep = await fetch(`https://fal.run/${modele}`, {
    method: 'POST',
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(entree),
  });
  const json: any = await rep.json().catch(() => ({}));
  if (!rep.ok) {
    console.error('[studio] fal.ai', rep.status, JSON.stringify(json).slice(0, 600));
    throw new StudioError(502, `Génération refusée par fal.ai (${rep.status}).`);
  }
  const url = json?.images?.[0]?.url || json?.image?.url;
  if (!url) throw new StudioError(502, 'Le modèle n’a pas renvoyé d’image.');
  return { hd: await telecharger(url), url };
}

async function viaReplicate(dataUrl: string, prompt: string): Promise<Sortie> {
  const modele = process.env.STUDIO_REPLICATE_MODEL || 'black-forest-labs/flux-kontext-pro';
  const rep = await fetch(`https://api.replicate.com/v1/models/${modele}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=60',
    },
    body: JSON.stringify({
      input: { prompt, input_image: dataUrl, output_format: 'jpg', safety_tolerance: 2 },
    }),
  });
  const json: any = await rep.json().catch(() => ({}));
  if (!rep.ok) {
    console.error('[studio] Replicate', rep.status, JSON.stringify(json).slice(0, 600));
    throw new StudioError(502, `Génération refusée par Replicate (${rep.status}).`);
  }
  if (json?.status !== 'succeeded') {
    throw new StudioError(504, 'La génération a dépassé le temps imparti. Réessayez.');
  }
  const url = Array.isArray(json.output) ? json.output[0] : json.output;
  if (!url) throw new StudioError(502, 'Le modèle n’a pas renvoyé d’image.');
  return { hd: await telecharger(url), url };
}

async function viaGemini(b64: string, mime: string, prompt: string): Promise<Sortie> {
  const modele = process.env.STUDIO_GEMINI_MODEL || 'gemini-2.5-flash-image';
  const rep = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': String(process.env.GEMINI_API_KEY),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: b64 } }] }],
      }),
    },
  );
  const json: any = await rep.json().catch(() => ({}));
  if (!rep.ok) {
    console.error('[studio] Google', rep.status, JSON.stringify(json).slice(0, 600));
    throw new StudioError(502, `Génération refusée par Google (${rep.status}).`);
  }
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const image = parts.find((p: any) => p.inline_data?.data || p.inlineData?.data);
  const donnees = image?.inline_data?.data || image?.inlineData?.data;
  if (!donnees) throw new StudioError(502, 'Le modèle n’a pas renvoyé d’image.');
  return { hd: Buffer.from(donnees, 'base64'), url: null };
}

async function telecharger(url: string): Promise<Buffer> {
  const rep = await fetch(url);
  if (!rep.ok) throw new StudioError(502, 'Image générée inaccessible.');
  return Buffer.from(await rep.arrayBuffer());
}

/** Génère le rendu HD et renvoie l'image + l'emplacement durable à sceller. */
export async function genererRendu(
  photoB64: string,
  mime: string,
  amb: AmbianceKey,
  precisions = '',
): Promise<{ hd: Buffer; scelle: Scelle }> {
  const prompt = promptRendu(amb, precisions);
  const dataUrl = `data:${mime};base64,${photoB64}`;

  let sortie: Sortie;
  if (process.env.STUDIO_MOCK_LOCAL === '1' && process.env.NODE_ENV !== 'production') {
    // Doublure de développement : aucune API appelée, on « relooke » la photo
    // avec un simple traitement d'image pour dérouler tout le tunnel en local.
    // Inopérante en production (NODE_ENV y vaut toujours « production »).
    sortie = {
      hd: await sharp(Buffer.from(photoB64, 'base64'))
        .modulate({ brightness: 1.12, saturation: 1.18 })
        .tint('#F3E6CE')
        .sharpen()
        .jpeg({ quality: 92 })
        .toBuffer(),
      url: null,
    };
  } else if (process.env.FAL_KEY) sortie = await viaFal(dataUrl, prompt);
  else if (process.env.REPLICATE_API_TOKEN) sortie = await viaReplicate(dataUrl, prompt);
  else if (process.env.GEMINI_API_KEY) sortie = await viaGemini(photoB64, mime, prompt);
  else {
    throw new StudioError(
      500,
      'Aucun moteur d’image configuré (FAL_KEY, REPLICATE_API_TOKEN ou GEMINI_API_KEY).',
    );
  }

  // Normalisation : orientation, taille raisonnable, JPEG de qualité.
  const hd = await sharp(sortie.hd)
    .rotate()
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  const chemin = await deposerSurSupabase(hd);
  if (chemin) return { hd, scelle: { k: 'sb', v: chemin, amb, t: Date.now() } };
  if (sortie.url) return { hd, scelle: { k: 'url', v: sortie.url, amb, t: Date.now() } };

  const local = deposerEnLocal(hd);
  if (local) return { hd, scelle: { k: 'fs', v: local, amb, t: Date.now() } };

  throw new StudioError(
    500,
    'Stockage du rendu impossible : configurez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.',
  );
}

// -----------------------------------------------------------------------------
// Aperçu gratuit — dégradé côté serveur (le HD ne sort jamais d'ici)
// -----------------------------------------------------------------------------
export async function fabriquerApercu(hd: Buffer): Promise<string> {
  const base = await sharp(hd)
    .resize({ width: 900, withoutEnlargement: true })
    .blur(7)
    .modulate({ saturation: 0.97 })
    .toBuffer();
  const apercu = await sharp(base)
    .composite([{ input: WATERMARK_TILE_PNG, tile: true, blend: 'over' }])
    .jpeg({ quality: 60, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${apercu.toString('base64')}`;
}

// -----------------------------------------------------------------------------
// Supabase Storage (optionnel — sinon on garde l'URL du fournisseur)
// -----------------------------------------------------------------------------
function supabaseConfigure() {
  const url = process.env.SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return null;
  return { url: url.replace(/\/$/, ''), cle, bucket: process.env.SUPABASE_STUDIO_BUCKET || 'studio' };
}

async function deposerSurSupabase(hd: Buffer): Promise<string | null> {
  const sb = supabaseConfigure();
  if (!sb) return null;
  const chemin = `rendus/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
  const rep = await fetch(`${sb.url}/storage/v1/object/${sb.bucket}/${chemin}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sb.cle}`,
      'Content-Type': 'image/jpeg',
      'cache-control': '3600',
    },
    body: new Uint8Array(hd),
  });
  if (!rep.ok) {
    console.error('[studio] dépôt Supabase échoué', rep.status, await rep.text().catch(() => ''));
    return null;
  }
  return chemin;
}

/** Dépôt sur le disque de la machine de dev, pour le mode démo local. */
function deposerEnLocal(hd: Buffer): string | null {
  if (process.env.NODE_ENV === 'production') return null;
  try {
    const dossier = path.join(os.tmpdir(), 'label-maison-studio');
    fs.mkdirSync(dossier, { recursive: true });
    const fichier = path.join(dossier, `${crypto.randomUUID()}.jpg`);
    fs.writeFileSync(fichier, hd);
    return fichier;
  } catch {
    return null;
  }
}

/** Récupère le rendu HD scellé. Appelé uniquement après confirmation du paiement. */
export async function recupererHd(scelle: Scelle): Promise<Buffer> {
  if (scelle.k === 'url') return telecharger(scelle.v);
  if (scelle.k === 'fs') {
    if (process.env.NODE_ENV === 'production') throw new StudioError(500, 'Rendu indisponible.');
    return fs.readFileSync(scelle.v);
  }

  const sb = supabaseConfigure();
  if (!sb) throw new StudioError(500, 'Stockage Supabase non configuré côté serveur.');
  const rep = await fetch(`${sb.url}/storage/v1/object/sign/${sb.bucket}/${scelle.v}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sb.cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 600 }),
  });
  const json: any = await rep.json().catch(() => ({}));
  if (!rep.ok || !json?.signedURL) throw new StudioError(502, 'Rendu HD momentanément indisponible.');
  return telecharger(`${sb.url}/storage/v1${json.signedURL}`);
}

// -----------------------------------------------------------------------------
// Stripe (API REST — pas de SDK à embarquer)
// -----------------------------------------------------------------------------
export function encoderFormulaire(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

export async function stripe(
  chemin: string,
  options: { methode?: 'GET' | 'POST'; corps?: string } = {},
): Promise<any> {
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) throw new StudioError(500, 'Paiement indisponible : STRIPE_SECRET_KEY non configurée.');
  const rep = await fetch(`https://api.stripe.com/v1/${chemin}`, {
    method: options.methode || 'GET',
    headers: {
      Authorization: `Bearer ${cle}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: options.corps,
  });
  const json: any = await rep.json().catch(() => ({}));
  if (!rep.ok) {
    console.error('[studio] Stripe', rep.status, json?.error?.message);
    throw new StudioError(502, json?.error?.message || 'Stripe a refusé la requête.');
  }
  return json;
}

// -----------------------------------------------------------------------------
// Offres
// -----------------------------------------------------------------------------
export type OffreKey = 'unique' | 'trio';

export const OFFRES: Record<OffreKey, { label: string; centimes: number; rendus: number }> = {
  unique: {
    label: 'Rendu HD + vidéo avant/après',
    centimes: Number(process.env.STUDIO_PRIX_UNIQUE_CENTIMES || 999),
    rendus: 1,
  },
  trio: {
    label: 'Pack 3 rendus HD + vidéos avant/après',
    centimes: Number(process.env.STUDIO_PRIX_TRIO_CENTIMES || 2490),
    rendus: 3,
  },
};

export function prixLisible(centimes: number): string {
  return `${(centimes / 100).toFixed(2).replace('.', ',')} €`;
}

// -----------------------------------------------------------------------------
// Jeton de crédits (pack 3 rendus) — signé, jamais falsifiable côté client
// -----------------------------------------------------------------------------
export function signerCredits(sessionId: string, restants: number): string {
  const charge = Buffer.from(JSON.stringify({ s: sessionId, r: restants, t: Date.now() })).toString(
    'base64url',
  );
  const signature = crypto
    .createHmac('sha256', cleSecrete())
    .update(charge)
    .digest('base64url')
    .slice(0, 32);
  return `${charge}.${signature}`;
}

export function lireCredits(jeton: string): { s: string; r: number; t: number } | null {
  const [charge, signature] = String(jeton || '').split('.');
  if (!charge || !signature) return null;
  const attendue = crypto
    .createHmac('sha256', cleSecrete())
    .update(charge)
    .digest('base64url')
    .slice(0, 32);
  if (signature !== attendue) return null;
  try {
    const json = JSON.parse(Buffer.from(charge, 'base64url').toString('utf8'));
    if (Date.now() - json.t > 7 * 24 * 60 * 60 * 1000) return null;
    return json;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// E-mails (Resend) — rendu au client + notification interne (pipeline conciergerie)
// -----------------------------------------------------------------------------
const MARQUE_FROM = () =>
  process.env.CONTACT_FROM_EMAIL || 'Label Maison Conciergerie <onboarding@resend.dev>';
const INTERNE = () => process.env.CONTACT_TO_EMAIL || 'labelmaisonconciergerie@gmail.com';

export async function envoyerRendu(opts: {
  email: string;
  amb: AmbianceKey;
  hd: Buffer;
  offre: OffreKey;
  sessionId: string;
}) {
  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    console.warn('[studio] RESEND_API_KEY absente : e-mails non envoyés.');
    return;
  }
  const resend = new Resend(cle);
  const ambiance = AMBIANCES[opts.amb]?.label || opts.amb;
  const piece = {
    filename: `label-maison-studio-${opts.amb}.jpg`,
    content: opts.hd.toString('base64'),
  };

  await resend.emails.send({
    from: MARQUE_FROM(),
    to: opts.email,
    subject: 'Votre rendu HD — Label Maison Studio',
    html: `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F4F1EA;padding:24px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,.06)">
    <div style="background:#A97C30;color:#fff;padding:22px 24px">
      <p style="margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.85">Label Maison Studio</p>
      <h1 style="margin:6px 0 0;font-size:21px">Votre rendu HD est prêt</h1>
    </div>
    <div style="padding:22px 24px;color:#2C2418;font-size:15px;line-height:1.6">
      <p style="margin:0 0 12px">Merci pour votre confiance. Votre rendu <strong>${ambiance}</strong> en haute définition, sans filigrane, est joint à cet e-mail.</p>
      <p style="margin:0 0 12px">La vidéo avant/après se télécharge depuis la page du studio, dans l'onglet resté ouvert.</p>
      <p style="margin:0 0 12px;color:#7A7264;font-size:13px">Rendu à titre indicatif, non contractuel.</p>
      <p style="margin:18px 0 0">Envie de savoir ce que ce bien peut rapporter en location courte durée ? Répondez simplement à cet e-mail : nous estimons vos revenus gratuitement.</p>
      <p style="margin:18px 0 0;color:#7A7264;font-size:13px">Label Maison Conciergerie — Paris · Dubaï · Marrakech — +33 7 49 54 83 55</p>
    </div>
  </div>
</body></html>`,
    text: `Votre rendu HD (${ambiance}) est en pièce jointe. Rendu à titre indicatif, non contractuel.\nLabel Maison Conciergerie — +33 7 49 54 83 55`,
    attachments: [piece],
  });

  // Notification interne : le payeur devient un prospect conciergerie.
  await resend.emails.send({
    from: MARQUE_FROM(),
    to: INTERNE(),
    replyTo: opts.email,
    subject: `[Studio] Rendu payé — ${opts.email}`,
    html: `<!doctype html><html><body style="font-family:-apple-system,sans-serif;padding:20px">
  <h2 style="color:#A97C30;margin:0 0 10px">Nouveau client Label Maison Studio</h2>
  <ul style="font-size:15px;line-height:1.7;color:#2C2418">
    <li><strong>E-mail :</strong> ${opts.email}</li>
    <li><strong>Ambiance :</strong> ${ambiance}</li>
    <li><strong>Offre :</strong> ${OFFRES[opts.offre].label} (${prixLisible(OFFRES[opts.offre].centimes)})</li>
    <li><strong>Session Stripe :</strong> ${opts.sessionId}</li>
  </ul>
  <p style="font-size:14px;color:#7A7264">À recontacter pour une estimation de revenus en location courte durée.</p>
</body></html>`,
    text: `Studio — ${opts.email} · ${ambiance} · ${OFFRES[opts.offre].label} · ${opts.sessionId}`,
    attachments: [piece],
  });
}
