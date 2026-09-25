// =============================================================================
// GET|POST /api/erp-repull-sync — synchronisation Repull → ERP.
//
// Recopie dans la base de l'ERP tout ce que les propriétaires ont connecté dans
// Repull (Airbnb, Booking.com...) : annonces → logements, réservations, avis,
// conversations et messages. Détail et règles : src/erp/data/repull-synchro.ts.
//
// Qui peut l'appeler :
//   - le cron Vercel (quotidien, vercel.json) : Authorization: Bearer CRON_SECRET ;
//   - un membre connecté de l'ERP (bouton « Synchroniser maintenant ») :
//     Authorization: Bearer <jeton de session Supabase>, vérifié auprès de
//     Supabase puis dans erp.membres (gérant ou opérations).
//
// Économie d'appels (offre gratuite Repull : 1 000 appels par mois pour tout
// le compte) : part mensuelle de l'ERP (REPULL_BUDGET_ERP, 400 par défaut),
// et pas plus d'une synchronisation manuelle toutes les 10 minutes (le bilan
// précédent est renvoyé à la place).
//
// Quand le passage apporte des messages, l'agent IA de la messagerie passe
// juste après (api/_erp-agent.ts), si ANTHROPIC_API_KEY est présente.
// =============================================================================

import { lancer, texteErreur, verifierMembre, type DeclencheurRepull } from '../src/erp/data/repull-synchro.js';
import { baseErp, configuration, egalConstant, repondre, variableManquante } from './_erp-repull.js';
import { agentApresSynchro } from './_erp-agent.js';

/** Durée maximale de la fonction (vercel.json) moins une marge pour écrire et répondre. */
const BUDGET_TEMPS_MS = 50_000;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  }
  const debut = Date.now();
  const c = configuration();

  const entete = String(req.headers?.authorization || '');
  const jeton = /^Bearer\s+/i.test(entete) ? entete.replace(/^Bearer\s+/i, '').trim() : '';
  if (!jeton) return repondre(res, 401, { ok: false, erreur: 'Authentification requise.' });

  let declencheur: DeclencheurRepull;
  if (c.secretCron && egalConstant(jeton, c.secretCron)) {
    declencheur = 'cron';
  } else {
    const membre = await verifierMembre(jeton);
    if (!membre.ok) return repondre(res, membre.statut, { ok: false, erreur: membre.erreur });
    declencheur = 'manuel';
  }

  const manque = variableManquante(c);
  if (manque) return repondre(res, 503, { ok: false, erreur: manque });

  try {
    const r = await lancer({
      cle: c.cle,
      base: baseErp(c),
      declencheur,
      echeance: debut + BUDGET_TEMPS_MS,
      budgetMois: c.budgetMois,
      quotaMois: c.quotaMois,
      lireQuota: declencheur === 'manuel',
    });
    if (declencheur === 'cron') console.log('[erp-repull-sync]', r.statut, JSON.stringify(r.bilan ?? {}).slice(0, 2000));
    // De nouveaux messages sont arrivés : l'agent IA passe tout de suite (dans le temps qui reste).
    const agent = r.statut === 'fait' ? await agentApresSynchro(c, r.bilan?.messages ?? 0, debut + 55_000) : null;
    return repondre(res, 200, agent ? { ...r, agent } : r);
  } catch (e) {
    console.error('[erp-repull-sync] échec', e);
    return repondre(res, 500, { ok: false, erreur: texteErreur(e) });
  }
}
