// =============================================================================
// /api/erp-connecteur-claude — adresse du connecteur Claude du CRM, pour les
// gérants connectés à l'ERP (CRM → Plus → « Connecter à Claude »).
//
//   GET  → { ok, url }  (crée la clé à la première demande)
//   POST { action: 'renouveler' } → { ok, url }  (nouvelle adresse, l'ancienne est coupée)
//
// Authentification : Authorization: Bearer <jeton de session Supabase>, rôle gérant.
// =============================================================================

import { verifierMembre } from '../src/erp/data/repull-synchro.js';
import { baseErp, configuration, lireCorps, repondre } from './_erp-repull.js';
import { cleConnecteurCrm, renouvelerCleConnecteur, URL_CONNECTEUR } from './_erp-mcp.js';

const INDISPONIBLE = 'Adresse indisponible pour le moment. Réessayez dans un instant.';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  }
  const entete = String(req.headers?.authorization || '');
  const jeton = /^Bearer\s+/i.test(entete) ? entete.replace(/^Bearer\s+/i, '').trim() : '';
  if (!jeton) return repondre(res, 401, { ok: false, erreur: 'Session expirée : reconnectez-vous à l’ERP.' });
  const membre = await verifierMembre(jeton);
  if (!membre.ok || membre.role !== 'gerant') {
    if (!membre.ok) console.warn('[erp-connecteur-claude]', membre.statut, membre.erreur);
    return repondre(res, 403, { ok: false, erreur: 'Seul un gérant peut connecter Claude au CRM.' });
  }
  const c = configuration();
  if (!c.motDePasse) {
    console.error('[erp-connecteur-claude] ERP_PASSWORD absent : base inaccessible.');
    return repondre(res, 503, { ok: false, erreur: INDISPONIBLE });
  }
  try {
    const base = baseErp(c);
    const renouveler = req.method === 'POST' && lireCorps(req).action === 'renouveler';
    const cle = renouveler ? await renouvelerCleConnecteur(base) : await cleConnecteurCrm(base, { creer: true });
    return repondre(res, 200, { ok: true, url: URL_CONNECTEUR(cle) });
  } catch (e) {
    console.error('[erp-connecteur-claude]', e);
    return repondre(res, 502, { ok: false, erreur: INDISPONIBLE });
  }
}
