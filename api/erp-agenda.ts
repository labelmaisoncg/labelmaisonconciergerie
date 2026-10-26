// =============================================================================
// /api/erp-agenda — liens d'abonnement à l'agenda des relances, pour les
// gérants connectés à l'ERP (CRM → Plus → « Relances dans l'agenda ») :
//
//   GET                                       → { ok, liens }
//   POST { action: 'creer', filtre }           → { ok, webcal, https }  montré cette fois seulement
//   POST { action: 'couper' }                  → { ok }                 tous les liens révoqués
//
// Authentification : Authorization: Bearer <jeton de session Supabase>, rôle gérant.
// Espace Label Maison seulement pour l'instant (les liens ne portent pas d'espace).
// =============================================================================

import type { FiltreAgenda } from '../src/erp/data/agenda-crm.js';
import { verifierMembre } from '../src/erp/data/repull-synchro.js';
import { baseErp, configuration, lireCorps, repondre } from './_erp-repull.js';
import { adressesAgenda, couperLiensAgenda, creerLienAgenda, etatAgenda, FILTRES } from './_agenda.js';
import { espaceDemande, refuserHorsLabelMaison } from './_erp-espaces.js';

const INDISPONIBLE = 'Agenda indisponible pour le moment. Réessayez dans un instant.';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  }
  const entete = String(req.headers?.authorization || '');
  const jeton = /^Bearer\s+/i.test(entete) ? entete.replace(/^Bearer\s+/i, '').trim() : '';
  if (!jeton) return repondre(res, 401, { ok: false, erreur: 'Session expirée : reconnectez-vous à l’ERP.' });
  const membre = await verifierMembre(jeton, { espace: espaceDemande(req) });
  if (!membre.ok || membre.role !== 'gerant') {
    if (!membre.ok) console.warn('[erp-agenda]', membre.statut, membre.erreur);
    return repondre(res, 403, { ok: false, erreur: 'Seul un gérant peut abonner un agenda au CRM.' });
  }
  if (refuserHorsLabelMaison(res, membre.espace, 'Agenda des relances')) return;
  const c = configuration();
  if (!c.motDePasse) {
    console.error('[erp-agenda] ERP_PASSWORD absent : base inaccessible.');
    return repondre(res, 503, { ok: false, erreur: INDISPONIBLE });
  }
  try {
    const base = baseErp(c);
    if (req.method === 'GET') return repondre(res, 200, { ok: true, ...(await etatAgenda(base)) });
    const corps = lireCorps(req);
    if (corps.action === 'creer') {
      const filtre = String(corps.filtre ?? 'tous') as FiltreAgenda;
      if (!FILTRES.includes(filtre)) return repondre(res, 400, { ok: false, erreur: 'Choix inconnu.' });
      const cle = await creerLienAgenda(base, filtre, membre.email);
      return repondre(res, 200, { ok: true, ...adressesAgenda(cle) });
    }
    if (corps.action === 'couper') {
      await couperLiensAgenda(base);
      return repondre(res, 200, { ok: true });
    }
    return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
  } catch (e) {
    console.error('[erp-agenda]', e);
    return repondre(res, 502, { ok: false, erreur: INDISPONIBLE });
  }
}
