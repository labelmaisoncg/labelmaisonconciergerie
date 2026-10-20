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
export function appelerConnecteur(corps?: Record<string, unknown>): Promise<ReponseConnecteur> {
  return appelerRouteGerant<ReponseConnecteur>('/api/erp-connecteur-claude', corps);
}

/** Une route réservée aux gérants, avec la session de l'ERP (GET sans corps, POST sinon). */
export async function appelerRouteGerant<T extends { ok?: boolean; erreur?: string }>(
  route: string,
  corps?: Record<string, unknown>,
  indisponible = INDISPONIBLE,
): Promise<T> {
  const { data } = await obtenirClient().auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new Error('Votre session a expiré : reconnectez-vous à l’ERP.');
  let r: Response;
  try {
    r = await fetch(route, {
      method: corps ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${jeton}`, ...(corps ? { 'Content-Type': 'application/json' } : {}) },
      ...(corps ? { body: JSON.stringify(corps) } : {}),
      cache: 'no-store',
    });
  } catch {
    throw new Error(indisponible);
  }
  const json = (await r.json().catch(() => ({}))) as T;
  if (!r.ok || !json.ok) throw new Error(json.erreur ?? indisponible);
  return json;
}
