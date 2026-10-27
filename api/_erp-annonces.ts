// =============================================================================
// Textes des annonces (cahier A6), appelés par api/erp-agent.ts :
//
//   POST { action: 'textes_annonce', logementId }
//     → { ok, textes: { titres, description, remarques, sources, ecartes } }
//     Trois titres et une description rédigés par l'agent, relus par les
//     garde-fous (rien d'inventé, ni coordonnée, ni code, ni adresse ; limites
//     d'Airbnb et de Booking.com). Rien n'est publié : l'équipe copie les
//     textes et les colle elle-même sur la plateforme.
//
// Membres gérant ou opérations seulement (même contrôle que les autres
// actions de la route, jamais le passage planifié) ; l'appel compte dans le
// plafond mensuel de l'IA de l'espace. Détail : src/erp/data/annonce-ia.ts,
// src/erp/annonces/textes.ts.
// =============================================================================

import { ErreurAssistant, texteErreurAssistant } from '../src/erp/data/agent-assistant.js';
import { ACTION_TEXTES_ANNONCE, proposerTextesAnnonceIA } from '../src/erp/data/annonce-ia.js';
import { optionsAssistant } from './_erp-agent.js';
import { repondre, variableManquante, type ConfigRepullErp } from './_erp-repull.js';
import { configurationEspace } from './_erp-espaces.js';

export const ACTIONS_ANNONCES = new Set([ACTION_TEXTES_ANNONCE]);

/** Répond à une action des annonces pour le membre `par` (son e-mail) dans `espace` ; `permis` : un membre, en POST. */
export async function repondreAnnonces(res: any, permis: boolean, corps: Record<string, unknown>, espace: string | undefined, par: string) {
  if (!permis) return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
  let c: ConfigRepullErp;
  try {
    c = await configurationEspace(espace);
  } catch (e) {
    return repondre(res, 503, { ok: false, erreur: e instanceof Error ? e.message : String(e) });
  }
  const manque = variableManquante(c);
  if (manque) return repondre(res, 503, { ok: false, erreur: manque });
  try {
    const textes = await proposerTextesAnnonceIA(optionsAssistant(c, par), String(corps.logementId ?? ''));
    return repondre(res, 200, { ok: true, textes });
  } catch (e) {
    if (e instanceof ErreurAssistant) return repondre(res, e.statut, { ok: false, erreur: e.message, code: e.code });
    console.error('[erp-agent] textes annonce', e);
    return repondre(res, 502, { ok: false, erreur: texteErreurAssistant(e) });
  }
}
