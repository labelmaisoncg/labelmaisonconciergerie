// =============================================================================
// /api/erp-agent — agent IA de la messagerie (réponses aux voyageurs).
//
//   GET  ?action=etat          état : agent actif, clés présentes (oui/non,
//                              jamais leur valeur), dernier passage
//   POST { action: 'lancer' }  « Lancer l'agent maintenant » (bouton)
//   GET|POST avec Authorization: Bearer CRON_SECRET → passage planifié
//     (cron Vercel quotidien, et pg_cron de Supabase toutes les 30 min :
//     supabase/erp-agent-cron.sql), dans chaque espace actif à son tour
//
// Authentification des membres : Authorization: Bearer <jeton de session
// Supabase>, gérant ou opérations de l'espace de l'en-tête x-erp-espace
// (Label Maison à défaut). Détail du passage (réglages, garde-fous,
// idempotence, plafond d'un autre espace) : src/erp/data/agent-messagerie.ts.
// =============================================================================

import { lancerAgent, lireEtatPublic, type PassageAgent } from '../src/erp/data/agent-messagerie.js';
import { verifierMembre } from '../src/erp/data/repull-synchro.js';
import { REGLAGES_AGENT_DEFAUT } from '../src/erp/data/reglages.js';
import { estLabelMaison } from '../src/erp/data/espaces.js';
import type { ReglagesAgent } from '../src/erp/data/types';
import { configurationAgent, optionsAgent } from './_erp-agent.js';
import { baseErp, configuration, egalConstant, lireCorps, repondre, variableManquante, type ConfigRepullErp } from './_erp-repull.js';
import { configurationEspace, espaceDemande, espacesActifs } from './_erp-espaces.js';
import { surveiller } from './_erp-notifications.js';
import { notificationsOpsDuJour } from './_operations-notifications.js';

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
  let espace: string | undefined;
  if (planifie) {
    // App « Opérations » : remplacements qui commencent, contrôles qualité du jour.
    // Au premier passage de l'agent à partir de 7 h à Paris (rien avant, même
    // le réveil de minuit l'été) ; borné à 8 s, jamais bloquant.
    const operations = await notificationsOpsDuJour({ limite: Date.now() + 8_000 }).catch(() => ({}));
    if (Object.keys(operations).length) console.log('[erp-agent] operations', JSON.stringify(operations));
  }
  if (!planifie) {
    const membre = await verifierMembre(jeton, { espace: espaceDemande(req) });
    if (!membre.ok) return repondre(res, membre.statut, { ok: false, erreur: membre.erreur });
    espace = membre.espace;
  }

  const corps = req.method === 'POST' ? lireCorps(req) : {};
  const action = String((req.method === 'GET' ? req.query?.action : corps.action) ?? (planifie ? 'lancer' : 'etat'));
  const a = configurationAgent();

  if (action === 'etat' && req.method === 'GET') {
    let ce: ConfigRepullErp = c;
    try {
      ce = await configurationEspace(espace);
    } catch (e) {
      return repondre(res, 200, { ok: true, cles: { ia: !!a.cleIA, telegram: false, planification: !!c.secretCron, repull: false }, modele: a.modele, etat: null, actif: false, avertissement: e instanceof Error ? e.message : String(e) });
    }
    // Booléens seulement : aucune valeur de variable ne quitte le serveur.
    const cles = {
      ia: !!a.cleIA,
      telegram: !!a.telegram && estLabelMaison(ce.espace),
      planification: !!c.secretCron,
      repull: !variableManquante(ce),
    };
    if (!cles.repull) return repondre(res, 200, { ok: true, cles, modele: a.modele, etat: null, actif: false });
    try {
      const base = baseErp(ce);
      const [etat, reglages] = await Promise.all([lireEtatPublic({ base }), base.lire<ReglagesAgent>('reglages', ['agent'])]);
      return repondre(res, 200, { ok: true, cles, modele: a.modele, etat, actif: (reglages[0] ?? REGLAGES_AGENT_DEFAUT).actif === true });
    } catch (e) {
      return repondre(res, 200, { ok: true, cles, modele: a.modele, etat: null, avertissement: e instanceof Error ? e.message : String(e) });
    }
  }

  if (action !== 'lancer' || (!planifie && req.method !== 'POST')) return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
  const manque = variableManquante(c);
  if (manque) return repondre(res, 503, { ok: false, erreur: manque });

  if (planifie) {
    // Chaque espace actif à son tour (un agent en pause ne coûte qu'une lecture).
    let espaces;
    try {
      espaces = await espacesActifs(c);
    } catch (e) {
      console.error('[erp-agent] espaces illisibles', e);
      return repondre(res, 500, { ok: false, erreur: e instanceof Error ? e.message : String(e) });
    }
    // Label Maison seul (avant les espaces) : même passage et même réponse qu'avant.
    if (espaces.length === 1 && estLabelMaison(espaces[0].id)) {
      try {
        const passage = await passer(c, 'planifie', debut + BUDGET_TEMPS_MS, debut);
        return repondre(res, 200, { ok: passage.statut !== 'erreur', passage });
      } catch (e) {
        console.error('[erp-agent] échec', e);
        return repondre(res, 500, { ok: false, erreur: e instanceof Error ? e.message : String(e) });
      }
    }
    const passages: Record<string, string> = {};
    for (const [i, fiche] of espaces.entries()) {
      const reste = debut + BUDGET_TEMPS_MS - Date.now();
      if (reste < 5_000) break;
      try {
        const ce = estLabelMaison(fiche.id) ? c : await configurationEspace(fiche.id, fiche);
        if (variableManquante(ce)) continue;
        passages[fiche.code] = (await passer(ce, 'planifie', Date.now() + Math.floor(reste / (espaces.length - i)), debut)).statut;
      } catch (e) {
        console.error('[erp-agent] espace', fiche.code, e);
        passages[fiche.code] = 'erreur';
      }
    }
    return repondre(res, 200, { ok: !Object.values(passages).includes('erreur'), espaces: passages });
  }

  try {
    const ce = await configurationEspace(espace);
    const manqueEspace = variableManquante(ce);
    if (manqueEspace) return repondre(res, 503, { ok: false, erreur: manqueEspace });
    const passage = await passer(ce, 'manuel', debut + BUDGET_TEMPS_MS, debut);
    return repondre(res, 200, { ok: passage.statut !== 'erreur', passage });
  } catch (e) {
    console.error('[erp-agent] échec', e);
    return repondre(res, 500, { ok: false, erreur: e instanceof Error ? e.message : String(e) });
  }
}

/** Un passage de l'agent dans l'espace de `c`. Notifications : l'agent a répondu, ou passe la main. */
function passer(c: ConfigRepullErp, declencheur: 'planifie' | 'manuel', echeance: number, debut: number): Promise<PassageAgent> {
  return surveiller(baseErp(c), () => lancerAgent(optionsAgent(c, declencheur, echeance)), {
    limite: Math.min(echeance + 6_000, debut + 58_000),
  });
}
