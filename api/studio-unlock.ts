// =============================================================================
// POST /api/studio-unlock — livre le rendu HD, une fois le paiement confirmé.
//
// Rien n'est renvoyé sans un aller-retour avec Stripe : on interroge la session
// Checkout (source de vérité) et on exige que le paiement soit encaissé ET que
// la session corresponde bien au rendu demandé (client_reference_id).
// Deux cas d'accès :
//   • 1ᵉʳ déblocage : empreinte(scellé) === client_reference_id de la session ;
//   • rendus suivants du pack « 3 rendus » : jeton de crédits signé par nous,
//     rattaché à la même session payée, décrémenté à chaque déblocage.
// =============================================================================

import sharp from 'sharp';
import {
  AMBIANCES,
  OFFRES,
  StudioError,
  desceller,
  empreinte,
  envoyerRendu,
  lireCorps,
  lireCredits,
  recupererHd,
  repondreErreur,
  signerCredits,
  stripe,
  verifierQuota,
  type OffreKey,
} from './_studio.js';

type Corps = { session_id?: string; scelle?: string; jeton?: string };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { session_id: sessionId, scelle, jeton } = lireCorps<Corps>(req);
    if (!sessionId || !scelle) throw new StudioError(400, 'Requête incomplète.');

    // Garde-fou : une session payée ne sert pas de robinet illimité.
    verifierQuota(`unlock:${sessionId}`, 12, 'Trop de déblocages pour ce paiement.');

    const session = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (session?.payment_status !== 'paid') {
      throw new StudioError(402, 'Paiement non confirmé par Stripe.');
    }

    const offre = (session?.metadata?.offre || 'unique') as OffreKey;
    const total = OFFRES[offre]?.rendus || 1;

    // Droit d'accès : soit le rendu payé lui-même, soit un crédit du pack.
    const credits = jeton ? lireCredits(jeton) : null;
    const rendusRestants = credits && credits.s === sessionId ? credits.r : 0;
    const estLeRenduPaye = session?.client_reference_id === empreinte(scelle);

    if (!estLeRenduPaye && rendusRestants <= 0) {
      throw new StudioError(403, 'Ce rendu n’est pas couvert par votre paiement.');
    }

    const contenu = desceller(scelle);
    const hdBrut = await recupererHd(contenu);

    // On borne le poids de la réponse (limite de 4,5 Mo des fonctions Vercel).
    const hd =
      hdBrut.length > 2_600_000
        ? await sharp(hdBrut).resize({ width: 1800, withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toBuffer()
        : hdBrut;

    const email = session?.customer_details?.email || session?.customer_email || '';

    // Sans webhook configuré, c'est ici qu'on envoie le rendu par e-mail et
    // qu'on enregistre le prospect côté conciergerie. Avec webhook, Stripe s'en
    // charge (y compris si le visiteur a fermé son onglet) : pas de doublon.
    if (!process.env.STRIPE_WEBHOOK_SECRET && email && estLeRenduPaye) {
      try {
        await envoyerRendu({ email, amb: contenu.amb, hd, offre, sessionId });
      } catch (err) {
        console.error('[studio] envoi e-mail échoué', err);
      }
    }

    // Crédits restants du pack : un nouveau jeton signé, décrémenté.
    let nouveauJeton: string | null = null;
    if (total > 1) {
      const restants = estLeRenduPaye ? total - 1 : Math.max(0, rendusRestants - 1);
      nouveauJeton = signerCredits(sessionId, restants);
    }

    return res.status(200).json({
      ok: true,
      hd: `data:image/jpeg;base64,${hd.toString('base64')}`,
      ambiance: contenu.amb,
      ambianceLabel: AMBIANCES[contenu.amb]?.label || '',
      email,
      offre,
      jeton: nouveauJeton,
      rendusRestants: nouveauJeton ? lireCredits(nouveauJeton)?.r ?? 0 : 0,
    });
  } catch (err) {
    return repondreErreur(res, err);
  }
}
