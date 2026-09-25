// =============================================================================
// POST /api/erp-repull-messages — répondre à un voyageur depuis l'ERP.
//
//   POST { action: 'envoyer', filId, texte }
//     → { ok: true, message, fil, canal, reecrit, info }
//
// Le message part vraiment chez le voyageur (Airbnb, Booking.com...) par
// Repull, avec une clé d'idempotence (pas de double envoi), puis il est écrit
// dans le fil de l'ERP. Un fil sans conversation Repull répond 409 (code
// hors_plateforme) : l'ERP garde alors le message chez lui.
//
// Authentification : Authorization: Bearer <jeton de session Supabase>,
// membre gérant ou opérations (la lecture seule ne peut pas écrire aux
// voyageurs). L'appel Repull est compté dans la part mensuelle de l'ERP.
// Détail : src/erp/data/messagerie-envoi.ts.
// =============================================================================

import { ErreurEnvoi, envoyerMessage, messageEchecEnvoi } from '../src/erp/data/messagerie-envoi.js';
import { BudgetEpuise, ErreurRepull, verifierMembre } from '../src/erp/data/repull-synchro.js';
import { baseErp, configuration, lireCorps, repondre, variableManquante } from './_erp-repull.js';

const BUDGET_TEMPS_MS = 50_000;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  }
  const debut = Date.now();
  const c = configuration();

  const entete = String(req.headers?.authorization || '');
  const jeton = /^Bearer\s+/i.test(entete) ? entete.replace(/^Bearer\s+/i, '').trim() : '';
  if (!jeton) return repondre(res, 401, { ok: false, erreur: 'Session expirée : reconnectez-vous à l’ERP.' });
  const membre = await verifierMembre(jeton);
  if (!membre.ok) return repondre(res, membre.statut, { ok: false, erreur: membre.erreur });

  const manque = variableManquante(c);
  if (manque) return repondre(res, 503, { ok: false, erreur: manque });

  const corps = lireCorps(req);
  if (String(corps.action ?? 'envoyer') !== 'envoyer') return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
  const filId = String(corps.filId ?? '').trim();
  if (!filId) return repondre(res, 400, { ok: false, erreur: 'Conversation non précisée.' });

  const ctx = { cle: c.cle, base: baseErp(c), echeance: debut + BUDGET_TEMPS_MS, budgetMois: c.budgetMois, quotaMois: c.quotaMois };
  try {
    const r = await envoyerMessage(ctx, { filId, texte: String(corps.texte ?? ''), auteur: 'hote', par: membre.email });
    return repondre(res, 200, r);
  } catch (e) {
    const erreur = messageEchecEnvoi(e, ctx);
    if (e instanceof ErreurEnvoi) return repondre(res, e.statut, { ok: false, erreur, code: e.code });
    if (e instanceof BudgetEpuise) return repondre(res, 429, { ok: false, erreur, code: 'budget' });
    console.error('[erp-repull-messages]', e instanceof ErreurRepull ? `${e.statut} ${e.code ?? ''} ${e.correctif ?? ''}` : e);
    return repondre(res, 502, { ok: false, erreur, code: 'repull' });
  }
}
