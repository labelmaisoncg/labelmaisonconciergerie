// =============================================================================
// POST /api/studio-webhook — notification Stripe « checkout.session.completed ».
//
// Rôle : envoyer le rendu HD par e-mail et enregistrer le prospect côté
// conciergerie, même si le visiteur ferme son onglet juste après avoir payé.
// La livraison à l'écran, elle, passe par /api/studio-unlock.
//
// Vérification : on contrôle la signature Stripe quand le corps brut est
// disponible, puis — dans tous les cas — on relit la session directement chez
// Stripe. C'est cette relecture qui fait foi ; un faux appel ne peut donc rien
// débloquer.
// =============================================================================

import crypto from 'node:crypto';
import {
  StudioError,
  desceller,
  envoyerRendu,
  recupererHd,
  repondreErreur,
  scelleDepuisMetadata,
  stripe,
  verifierQuota,
  type OffreKey,
} from './_studio';

function corpsBrut(req: any): string {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  return JSON.stringify(req.body ?? {});
}

function signatureValide(brut: string, entete: string, secret: string): boolean {
  const parties = Object.fromEntries(
    entete.split(',').map((p) => {
      const [k, ...reste] = p.split('=');
      return [k.trim(), reste.join('=')];
    }),
  ) as Record<string, string>;
  if (!parties.t || !parties.v1) return false;
  const attendue = crypto.createHmac('sha256', secret).update(`${parties.t}.${brut}`).digest('hex');
  const a = Buffer.from(attendue);
  const b = Buffer.from(parties.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const brut = corpsBrut(req);
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const entete = String(req.headers['stripe-signature'] || '');

    if (secret && entete && !signatureValide(brut, entete, secret)) {
      // Le corps peut avoir été reparsé par la plateforme : on ne rejette pas,
      // mais on trace — la relecture de la session chez Stripe reste la garantie.
      console.warn('[studio] signature Stripe non vérifiable sur ce corps.');
    }

    let evenement: any;
    try {
      evenement = JSON.parse(brut);
    } catch {
      throw new StudioError(400, 'Corps d’événement illisible.');
    }

    if (evenement?.type !== 'checkout.session.completed') {
      return res.status(200).json({ ok: true, ignore: evenement?.type });
    }

    const sessionId = evenement?.data?.object?.id;
    if (!sessionId) throw new StudioError(400, 'Session absente de l’événement.');
    verifierQuota(`hook:${sessionId}`, 2, 'Événement déjà traité.');

    // Source de vérité : Stripe, pas la charge utile reçue.
    const session = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (session?.payment_status !== 'paid') {
      return res.status(200).json({ ok: true, ignore: 'non payé' });
    }

    const email = session?.customer_details?.email || session?.customer_email;
    const scelle = scelleDepuisMetadata(session?.metadata);
    if (!email || !scelle) {
      console.warn('[studio] session payée sans e-mail ou sans scellé', sessionId);
      return res.status(200).json({ ok: true, ignore: 'données insuffisantes' });
    }

    const contenu = desceller(scelle);
    const hd = await recupererHd(contenu);
    await envoyerRendu({
      email,
      amb: contenu.amb,
      hd,
      offre: (session?.metadata?.offre || 'unique') as OffreKey,
      sessionId,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return repondreErreur(res, err);
  }
}
