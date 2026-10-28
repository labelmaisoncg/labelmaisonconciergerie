// =============================================================================
// /api/erp-agent — agent IA de la messagerie (réponses aux voyageurs).
//
//   GET  ?action=etat          état : agent actif, clés présentes (oui/non,
//                              jamais leur valeur), dernier passage
//   POST { action: 'lancer' }  « Lancer l'agent maintenant » (bouton)
//   POST { action: 'brouillon' | 'traduire' | 'traduire_texte', ... }
//                              assistant de réponse : réponse proposée (rien
//                              n'est envoyé), traductions (api/_erp-agent-assistant.ts)
//   POST { action: 'crm_relance', ... } brouillon de relance du CRM (rien
//                              n'est envoyé : api/_crm-assistant.ts)
//   POST { action: 'reponse_avis', ... } réponse proposée à un avis de
//                              voyageur (copiée par l'équipe, jamais publiée :
//                              api/_erp-avis.ts)
//   GET|POST avec Authorization: Bearer CRON_SECRET → passage planifié
//     (cron Vercel quotidien, et pg_cron de Supabase toutes les 30 min :
//     supabase/erp-agent-cron.sql), dans chaque espace actif à son tour ;
//     après l'agent : messages automatiques dus et avis à préparer
//     (api/_erp-programmes.ts, src/erp/data/passage-programmes.ts) ;
//     il prépare aussi, à partir du 1er, les brouillons des factures
//     mensuelles des propriétaires (api/_factures-mensuelles.ts) et envoie, à
//     partir de 7 h, le briefing du matin (api/_briefing.ts) ; il efface les
//     check-ins en ligne arrivés au bout de leur conservation (api/_sejour.ts)
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
import { ACTIONS_ASSISTANT, repondreAssistant } from './_erp-agent-assistant.js';
import { ACTIONS_AVIS, repondreAvis } from './_erp-avis.js';
import { briefingDuJour } from './_briefing.js';
import { ACTIONS_CRM, repondreCrm } from './_crm-assistant.js';
import { ACTIONS_ANNONCES, repondreAnnonces } from './_erp-annonces.js';
import { baseErp, configuration, egalConstant, lireCorps, repondre, variableManquante, type ConfigRepullErp } from './_erp-repull.js';
import { configurationEspace, espaceDemande, espacesActifs } from './_erp-espaces.js';
import { facturesMensuellesDuJour } from './_factures-mensuelles.js';
import { surveiller } from './_erp-notifications.js';
import { notificationsOpsDuJour } from './_operations-notifications.js';
import { programmesPlanifies } from './_erp-programmes.js';
import { passagePrixDuJour } from './_prix-conseils.js';
import { purgeCheckinsDuJour } from './_sejour.js';

/** Durée maximale de la fonction (vercel.json) moins une marge pour écrire et répondre. */
const BUDGET_TEMPS_MS = 52_000;
/** Part du temps gardée, dans chaque espace, pour les messages automatiques et les avis (après l'agent). */
const RESERVE_PROGRAMMES_MS = 10_000;

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
  let email = '';
  if (planifie) {
    // Quatre travaux indépendants, lancés ensemble (8 s au plus en tout, jamais bloquants),
    // pour laisser à l'agent des voyageurs l'essentiel du temps du passage :
    // - app « Opérations » : remplacements qui commencent, contrôles qualité du jour, au
    //   premier passage à partir de 7 h à Paris (rien avant, même le réveil de minuit l'été) ;
    // - prix conseillés (un calcul et une notification par jour, à partir de 8 h) et anomalies
    //   graves : lecture de la base seulement, aucun prix n'est jamais envoyé aux plateformes ;
    // - factures mensuelles des propriétaires : brouillons du mois terminé, à partir du 1er
    //   (une fois par mois et par espace ; ensuite une seule lecture) ;
    // - briefing du matin : une notification par jour et par espace, de 7 h à midi, aux
    //   appareils qui l'ont activée (texte calculé sans IA) ;
    // - check-in en ligne : efface les check-ins (fiches de police comprises) 6 mois après
    //   le départ, tout de suite pour une réservation annulée (api/_sejour.ts).
    const [operations, prix, factures, briefing, checkins] = await Promise.all([
      notificationsOpsDuJour({ limite: Date.now() + 8_000 }).catch(() => ({})),
      passagePrixDuJour({ limite: Date.now() + 6_000 }).catch(() => ({})),
      facturesMensuellesDuJour({ limite: Date.now() + 6_000 }).catch(() => ({})),
      briefingDuJour({ limite: Date.now() + 6_000 }).catch(() => ({})),
      purgeCheckinsDuJour({ limite: Date.now() + 5_000 }).catch(() => ({})),
    ]);
    if (Object.keys(operations).length) console.log('[erp-agent] operations', JSON.stringify(operations));
    if (Object.keys(prix).length) console.log('[erp-agent] prix', JSON.stringify(prix));
    if (Object.keys(factures).length) console.log('[erp-agent] factures', JSON.stringify(factures));
    if (Object.keys(briefing).length) console.log('[erp-agent] briefing', JSON.stringify(briefing));
    if (Object.keys(checkins).length) console.log('[erp-agent] check-ins effacés', JSON.stringify(checkins));
  }
  if (!planifie) {
    const membre = await verifierMembre(jeton, { espace: espaceDemande(req) });
    if (!membre.ok) return repondre(res, membre.statut, { ok: false, erreur: membre.erreur });
    espace = membre.espace;
    email = membre.email;
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

  // Assistant de réponse : membres seulement (jamais le passage planifié), rien n'est envoyé au voyageur.
  if (ACTIONS_ASSISTANT.has(action)) {
    if (planifie || req.method !== 'POST') return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
    return repondreAssistant(res, action, corps, espace, email);
  }
  // Réponse à un avis (api/_erp-avis.ts) : membres seulement, rien n'est publié sur la plateforme.
  if (ACTIONS_AVIS.has(action)) return planifie || req.method !== 'POST' ? repondre(res, 400, { ok: false, erreur: 'Action inconnue.' }) : repondreAvis(res, corps, espace, email);
  // Assistant CRM : brouillon de relance, membres seulement, rien n'est envoyé.
  if (ACTIONS_CRM.has(action)) return planifie || req.method !== 'POST' ? repondre(res, 400, { ok: false, erreur: 'Action inconnue.' }) : repondreCrm(res, action, corps, espace, email);

  if (ACTIONS_ANNONCES.has(action)) return repondreAnnonces(res, !planifie && req.method === 'POST', corps, espace, email);
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
        const passage = await passer(c, 'planifie', debut + BUDGET_TEMPS_MS - RESERVE_PROGRAMMES_MS, debut);
        const programmes = await programmesPlanifies(c, debut + BUDGET_TEMPS_MS);
        return repondre(res, 200, { ok: passage.statut !== 'erreur', passage, ...(programmes ? { programmes: programmes.statut } : {}) });
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
        const part = Math.floor(reste / (espaces.length - i));
        const fin = Date.now() + part;
        passages[fiche.code] = (await passer(ce, 'planifie', fin - Math.min(RESERVE_PROGRAMMES_MS, Math.floor(part / 3)), debut)).statut;
        await programmesPlanifies(ce, fin);
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
