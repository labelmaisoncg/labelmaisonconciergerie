// =============================================================================
// /api/erp-connecteur-claude — adresse du connecteur Claude du CRM, pour les
// gérants connectés à l'ERP (bouton « Connecter à Claude » de la page CRM).
//
//   GET  (Authorization: Bearer <jeton de session Supabase>) → { ok, url }
// =============================================================================

import { verifierMembre } from '../src/erp/data/repull-synchro.js';
import { repondre } from './_erp-repull.js';
import { cleConnecteurCrm, URL_CONNECTEUR } from './_erp-mcp.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  }
  const entete = String(req.headers?.authorization || '');
  const jeton = /^Bearer\s+/i.test(entete) ? entete.replace(/^Bearer\s+/i, '').trim() : '';
  if (!jeton) return repondre(res, 401, { ok: false, erreur: 'Session expirée : reconnectez-vous à l’ERP.' });
  const membre = await verifierMembre(jeton);
  if (!membre.ok) return repondre(res, membre.statut, { ok: false, erreur: membre.erreur });
  if (membre.role !== 'gerant') return repondre(res, 403, { ok: false, erreur: 'Seul un gérant peut connecter Claude au CRM.' });
  const cle = cleConnecteurCrm();
  if (!cle) return repondre(res, 503, { ok: false, erreur: 'ERP_PASSWORD manquant dans Vercel : le connecteur ne peut pas fonctionner.' });
  return repondre(res, 200, { ok: true, url: URL_CONNECTEUR(cle) });
}
