import { obtenirClient } from '../../../data/supabase';

export const INDISPONIBLE = 'Connecteur indisponible pour le moment. Réessayez dans un instant.';

export interface ReponseConnecteur {
  ok?: boolean;
  erreur?: string;
  connexions?: number;
  derniere?: string;
  redirection?: string;
}

/** Route des gérants /api/erp-connecteur-claude, avec la session de l'ERP. */
export async function appelerConnecteur(corps?: Record<string, unknown>): Promise<ReponseConnecteur> {
  const { data } = await obtenirClient().auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new Error('Votre session a expiré : reconnectez-vous à l’ERP.');
  let r: Response;
  try {
    r = await fetch('/api/erp-connecteur-claude', {
      method: corps ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${jeton}`, ...(corps ? { 'Content-Type': 'application/json' } : {}) },
      ...(corps ? { body: JSON.stringify(corps) } : {}),
      cache: 'no-store',
    });
  } catch {
    throw new Error(INDISPONIBLE);
  }
  const json = (await r.json().catch(() => ({}))) as ReponseConnecteur;
  if (!r.ok || !json.ok) throw new Error(json.erreur ?? INDISPONIBLE);
  return json;
}
