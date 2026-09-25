/**
 * Appels de la messagerie au serveur (fonctions Vercel) avec le jeton de la
 * session : les clés Repull et Claude ne quittent jamais Vercel.
 *
 * - /api/erp-repull-messages : envoyer une réponse au voyageur (Repull)
 * - /api/erp-agent           : état de l'agent IA, « Lancer l'agent maintenant »
 */
import { obtenirClient } from '../../../data/supabase';

/** Erreur du serveur, avec son code quand il en donne un (hors_plateforme, budget...). */
export class ErreurServeur extends Error {
  constructor(
    message: string,
    readonly statut: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function appelerServeur<T>(chemin: string, methode: 'GET' | 'POST', corps?: unknown): Promise<T> {
  const { data } = await obtenirClient().auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new ErreurServeur('Votre session a expiré : reconnectez-vous à l’ERP.', 401);
  let r: Response;
  try {
    r = await fetch(chemin, {
      method: methode,
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      ...(corps !== undefined ? { body: JSON.stringify(corps) } : {}),
      cache: 'no-store',
    });
  } catch {
    throw new ErreurServeur('Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.', 0);
  }
  const json = (await r.json().catch(() => ({}))) as T & { ok?: boolean; erreur?: string; code?: string };
  if (!r.ok || json.ok === false) throw new ErreurServeur(json.erreur ?? `Une erreur est survenue (${r.status}). Réessayez dans un instant.`, r.status, json.code);
  return json;
}

/** Nom de la plateforme d'un envoi (« Booking.com »). */
export function nomPlateformeEnvoi(canal: string | undefined): string {
  const c = (canal ?? '').toLowerCase();
  if (c.startsWith('booking')) return 'Booking.com';
  return { airbnb: 'Airbnb', vrbo: 'Vrbo', sms: 'SMS', email: 'e-mail', website: 'le site', direct: 'le site' }[c] ?? 'la plateforme';
}
