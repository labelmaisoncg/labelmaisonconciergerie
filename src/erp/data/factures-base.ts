/**
 * Numérotation d'une facture par la base (navigateur, production) :
 * erp.numeroter_facture(p_id) avec l'en-tête de l'espace ouvert. La base
 * vérifie que le compte est gérant de l'espace, verrouille le compteur et
 * attribue le numéro suivant (idempotente : une facture déjà numérotée garde
 * le sien). Le navigateur ne calcule jamais le numéro en production
 * (factures-mensuelles.ts, validerAvecLaBase).
 */
import { ENTETE_ESPACE, espaceDesDonnees } from './espaces';
import type { ErreurBaseFacture } from './factures-mensuelles';
import { obtenirClient } from './supabase';

export async function numeroterFactureBase(id: string): Promise<{ data: unknown; error: ErreurBaseFacture | null; status?: number }> {
  try {
    let appel = obtenirClient().rpc('numeroter_facture', { p_id: id });
    const espace = espaceDesDonnees();
    if (espace) appel = appel.setHeader(ENTETE_ESPACE, espace);
    const { data, error, status } = await appel;
    return { data, error: error ? { message: error.message, code: error.code, details: error.details, hint: error.hint } : null, status };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) }, status: 0 };
  }
}
