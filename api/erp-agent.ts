// =============================================================================
// /api/erp-agent — agent IA de la messagerie (réponses aux voyageurs).
//
//   GET  ?action=etat          état : agent actif, clés présentes (oui/non,
//                              jamais leur valeur), dernier passage
//   POST { action: 'lancer' }  « Lancer l'agent maintenant » (bouton)
//   GET|POST avec Authorization: Bearer CRON_SECRET → passage planifié
//     (cron Vercel quotidien, et pg_cron de Supabase toutes les 30 min :
//     supabase/erp-agent-cron.sql)
//
// Authentification des membres : Authorization: Bearer <jeton de session
// Supabase>, gérant ou opérations. Détail du passage (réglages, garde-fous,
// idempotence) : src/erp/data/agent-messagerie.ts.
// =============================================================================

import { lancerAgent, lireEtatPublic } from '../src/erp/data/agent-messagerie.js';
import { verifierMembre } from '../src/erp/data/repull-synchro.js';
import { REGLAGES_AGENT_DEFAUT } from '../src/erp/data/reglages.js';
import type { ReglagesAgent } from '../src/erp/data/types';
import { configurationAgent, optionsAgent } from './_erp-agent.js';
import { baseErp, configuration, egalConstant, lireCorps, repondre, variableManquante } from './_erp-repull.js';

/** Durée maximale de la fonction (vercel.json) moins une marge pour écrire et répondre. */
const BUDGET_TEMPS_MS = 52_000;

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
  const planifie = !!c.secretCron && egalConstant(jeton, c.secretCron);
  if (!planifie) {
    const membre = await verifierMembre(jeton);
    if (!membre.ok) return repondre(res, membre.statut, { ok: false, erreur: membre.erreur });
  }

  const corps = req.method === 'POST' ? lireCorps(req) : {};
  const action = String((req.method === 'GET' ? req.query?.action : corps.action) ?? (planifie ? 'lancer' : 'etat'));
  const a = configurationAgent();

  if (action === 'etat' && req.method === 'GET') {
    // Booléens seulement : aucune valeur de variable ne quitte le serveur.
    const cles = {
      ia: !!a.cleIA,
      telegram: !!a.telegram,
      planification: !!c.secretCron,
      repull: !variableManquante(c),
    };
    if (!cles.repull) return repondre(res, 200, { ok: true, cles, modele: a.modele, etat: null, actif: false });
    try {
      const base = baseErp(c);
      const [etat, reglages] = await Promise.all([lireEtatPublic({ base }), base.lire<ReglagesAgent>('reglages', ['agent'])]);
      return repondre(res, 200, { ok: true, cles, modele: a.modele, etat, actif: (reglages[0] ?? REGLAGES_AGENT_DEFAUT).actif === true });
    } catch (e) {
      return repondre(res, 200, { ok: true, cles, modele: a.modele, etat: null, avertissement: e instanceof Error ? e.message : String(e) });
    }
  }

  if (action !== 'lancer' || (!planifie && req.method !== 'POST')) return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
  const manque = variableManquante(c);
  if (manque) return repondre(res, 503, { ok: false, erreur: manque });

  try {
    const passage = await lancerAgent(optionsAgent(c, planifie ? 'planifie' : 'manuel', debut + BUDGET_TEMPS_MS));
    return repondre(res, 200, { ok: passage.statut !== 'erreur', passage });
  } catch (e) {
    console.error('[erp-agent] échec', e);
    return repondre(res, 500, { ok: false, erreur: e instanceof Error ? e.message : String(e) });
  }
}
