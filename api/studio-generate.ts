// =============================================================================
// POST /api/studio-generate — aperçu GRATUIT du rendu « version luxe ».
//
// Le navigateur envoie la photo de la pièce et l'ambiance choisie. On génère le
// rendu HD côté serveur, on le met de côté (Supabase Storage ou URL du
// fournisseur) et on ne renvoie au client qu'un aperçu volontairement dégradé
// (basse résolution + flou + filigrane) accompagné du scellé chiffré qui servira
// au déblocage après paiement. Le HD, lui, ne quitte pas le serveur.
// =============================================================================

import sharp from 'sharp';
import {
  AMBIANCES,
  OFFRES,
  StudioError,
  fabriquerApercu,
  genererRendu,
  ipClient,
  lireCorps,
  lireCredits,
  nettoyerPrecisions,
  repondreErreur,
  sceller,
  verifierQuota,
  type AmbianceKey,
} from './_studio';

type Corps = { photo?: string; ambiance?: string; precisions?: string; jeton?: string };

const TAILLE_MAX_OCTETS = 8 * 1024 * 1024;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { photo, ambiance, precisions, jeton } = lireCorps<Corps>(req);

    const amb = String(ambiance || '') as AmbianceKey;
    if (!AMBIANCES[amb]) throw new StudioError(400, 'Ambiance inconnue.');

    const correspondance = /^data:(image\/(?:jpeg|jpg|png|webp|heic|heif));base64,(.+)$/i.exec(
      String(photo || ''),
    );
    if (!correspondance) throw new StudioError(400, 'Photo manquante ou format non pris en charge (JPG, PNG).');

    const brut = Buffer.from(correspondance[2], 'base64');
    if (brut.length > TAILLE_MAX_OCTETS) throw new StudioError(413, 'Photo trop lourde (8 Mo maximum).');

    // Un aperçu gratuit par visiteur (garde-fou best effort : mémoire d'instance).
    // Les détenteurs du pack « 3 rendus » présentent leur jeton de crédits signé
    // et ne sont pas soumis à ce quota — ils ont déjà payé.
    const credits = jeton ? lireCredits(jeton) : null;
    if (!credits || credits.r <= 0) {
      const maxGratuit = Number(process.env.STUDIO_GRATUIT_PAR_JOUR || 2);
      verifierQuota(
        `gen:${ipClient(req)}`,
        maxGratuit,
        'Vous avez déjà utilisé votre aperçu gratuit. Débloquez un rendu HD pour continuer.',
      );
    }

    // On redimensionne avant d'envoyer au modèle : moins cher, plus rapide,
    // et suffisant pour que le rendu conserve l'architecture de la pièce.
    let source: Buffer;
    try {
      source = await sharp(brut)
        .rotate()
        .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
    } catch {
      throw new StudioError(400, 'Image illisible. Essayez une autre photo (JPG ou PNG).');
    }

    const { hd, scelle } = await genererRendu(
      source.toString('base64'),
      'image/jpeg',
      amb,
      nettoyerPrecisions(precisions),
    );
    const apercu = await fabriquerApercu(hd);

    return res.status(200).json({
      ok: true,
      apercu,
      scelle: sceller(scelle),
      ambiance: amb,
      offres: Object.fromEntries(
        Object.entries(OFFRES).map(([k, o]) => [k, { label: o.label, centimes: o.centimes, rendus: o.rendus }]),
      ),
    });
  } catch (err) {
    return repondreErreur(res, err);
  }
}
