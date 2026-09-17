// =============================================================================
// POST /api/studio-checkout — ouvre une session Stripe Checkout (paiement
// unique, pas d'abonnement) pour débloquer le rendu HD.
//
// Le scellé du rendu est lié au paiement de deux façons :
//   • client_reference_id = empreinte(scellé) → au retour, on vérifie que la
//     session payée correspond bien AU rendu qu'on s'apprête à livrer ;
//   • metadata scelle_0..n → le webhook peut retrouver le rendu tout seul,
//     même si le visiteur ferme son onglet.
// =============================================================================

import {
  OFFRES,
  StudioError,
  desceller,
  empreinte,
  encoderFormulaire,
  lireCorps,
  origine,
  prixLisible,
  repondreErreur,
  scelleVersMetadata,
  stripe,
  AMBIANCES,
  type OffreKey,
} from './_studio';

type Corps = { scelle?: string; offre?: string; email?: string };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { scelle, offre, email } = lireCorps<Corps>(req);

    const cle = String(offre || 'unique') as OffreKey;
    if (!OFFRES[cle]) throw new StudioError(400, 'Offre inconnue.');
    if (!scelle) throw new StudioError(400, 'Aucun rendu à débloquer.');

    const contenu = desceller(scelle); // valide le scellé (et son ambiance)
    const produit = OFFRES[cle];
    const ambiance = AMBIANCES[contenu.amb]?.label || '';
    const base = origine(req);

    const params: Record<string, string | number> = {
      mode: 'payment',
      locale: 'fr',
      client_reference_id: empreinte(scelle),
      success_url: `${base}/studio?paiement=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/studio?paiement=annule`,
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][unit_amount]': produit.centimes,
      'line_items[0][price_data][product_data][name]': `Label Maison Studio — ${produit.label}`,
      'line_items[0][price_data][product_data][description]':
        `Ambiance ${ambiance} · ${prixLisible(produit.centimes)} en paiement unique · ` +
        'rendu à titre indicatif, non contractuel.',
      'metadata[offre]': cle,
      'metadata[ambiance]': contenu.amb,
    };
    if (email) params.customer_email = email;

    for (const [k, v] of Object.entries(scelleVersMetadata(scelle))) params[`metadata[${k}]`] = v;

    const session = await stripe('checkout/sessions', {
      methode: 'POST',
      corps: encoderFormulaire(params),
    });

    return res.status(200).json({ ok: true, url: session.url, id: session.id });
  } catch (err) {
    return repondreErreur(res, err);
  }
}
