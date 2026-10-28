/**
 * Appels de la page Connexions et de « Relier à une annonce » au serveur
 * (api/erp-repull-connexion.ts), avec le jeton de la session : la clé du
 * service de connexion ne quitte jamais Vercel. L'espace ouvert part avec
 * chaque appel (en-tête x-erp-espace).
 */
import { entetesServeur } from '../../../data/espaces';
import { obtenirClient } from '../../../data/supabase';
import type { EtatConnexions } from '../../../data/repull-connexion';

export const API_CONNEXIONS = '/api/erp-repull-connexion';

/** Noms des plateformes, tels qu'affichés. */
export const NOMS_PLATEFORMES: Record<string, string> = { airbnb: 'Airbnb', booking: 'Booking.com', vrbo: 'Vrbo' };

/** Réponse incomplète du serveur (ancienne version en cache, erreur réseau…) : jamais de plantage. */
export function normaliserEtat(e: Partial<EtatConnexions> | null | undefined): EtatConnexions {
  const liste = <T,>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : []);
  return {
    ...(e ?? {}),
    ok: true,
    fournisseurs: liste(e?.fournisseurs),
    connexions: liste(e?.connexions),
    annonces: liste(e?.annonces).map((a) => ({ ...a, plateformes: liste(a?.plateformes) })),
    selection: liste(e?.selection),
    limite: e?.limite === undefined ? 3 : e.limite,
    sourceLimite: e?.sourceLimite ?? 'defaut',
    avertissements: liste(e?.avertissements),
    appels: e?.appels ?? { mois: 0, budget: 0 },
  };
}

/** Erreur du serveur, avec son code quand il en donne un (sans_connexion…). */
export class ErreurConnexions extends Error {
  constructor(
    message: string,
    readonly statut: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function appelerConnexions<T>(methode: 'GET' | 'POST', params: Record<string, string>, corps?: unknown): Promise<T> {
  const { data } = await obtenirClient().auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new ErreurConnexions('Votre session a expiré : reconnectez-vous à l’ERP.', 401);
  let r: Response;
  try {
    r = await fetch(`${API_CONNEXIONS}?${new URLSearchParams(params)}`, {
      method: methode,
      headers: entetesServeur(jeton),
      ...(corps !== undefined ? { body: JSON.stringify(corps) } : {}),
      cache: 'no-store',
    });
  } catch {
    throw new ErreurConnexions('Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.', 0);
  }
  const json = (await r.json().catch(() => ({}))) as T & { ok?: boolean; erreur?: string; code?: string };
  if (!r.ok || json.ok === false) throw new ErreurConnexions(json.erreur ?? `Une erreur est survenue (${r.status}). Réessayez dans un instant.`, r.status, json.code);
  return json;
}
