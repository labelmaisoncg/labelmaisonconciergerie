// =============================================================================
// /api/erp-connecteur-claude — connecteur Claude du CRM, pour les gérants
// connectés à l'ERP (CRM → Plus → « Connecter à Claude »).
//
//   GET                         → { ok, fixee, existe } ou { ok, fixee: true, url }
//   POST { action: 'creer' }    → { ok, url }  adresse NOUVELLE, montrée cette fois seulement
//                                  (l'éventuelle ancienne cesse de fonctionner)
//
// La clé n'est jamais stockée (empreinte seulement, api/_erp-mcp.ts).
// Authentification : Authorization: Bearer <jeton de session Supabase>, rôle gérant.
// =============================================================================

import { verifierMembre } from '../src/erp/data/repull-synchro.js';
import { baseErp, configuration, lireCorps, repondre } from './_erp-repull.js';
import { cleFixee, creerCleConnecteur, etatConnecteur, URL_CONNECTEUR } from './_erp-mcp.js';

const INDISPONIBLE = 'Connecteur indisponible pour le moment. Réessayez dans un instant.';

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
    if (req.method === 'GET') return repondre(res, 200, { ok: true, ...(await etatConnecteur(base)) });
    if (lireCorps(req).action !== 'creer') return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
    const fixee = cleFixee();
    if (fixee) return repondre(res, 200, { ok: true, fixee: true, url: URL_CONNECTEUR(fixee) });
    return repondre(res, 200, { ok: true, fixee: false, url: URL_CONNECTEUR(await creerCleConnecteur(base)) });
  } catch (e) {
    console.error('[erp-connecteur-claude]', e);
    return repondre(res, 502, { ok: false, erreur: INDISPONIBLE });
  }
}
