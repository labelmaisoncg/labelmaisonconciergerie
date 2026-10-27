// =============================================================================
// Assistant de réponse de la messagerie (appelé par api/erp-agent.ts) :
//
//   POST { action: 'brouillon', filId }
//     → { ok, proposition: { texte, texteFr?, langue?, intention?, confiance?, attention? } }
//     Réponse proposée par l'agent pour le dernier message du voyageur. Rien
//     n'est envoyé : l'équipe la relit et l'envoie elle-même.
//   POST { action: 'traduire', filId, messageId }   → { ok, texte }
//     Message du voyageur en français (gardé sur le message).
//   POST { action: 'traduire_texte', texte, langue } → { ok, texte }
//     Réponse de l'équipe dans la langue du voyageur, avant l'envoi.
//
// Membres gérant ou opérations seulement (même contrôle que les autres
// actions de la route) ; chaque appel à l'IA compte dans le plafond mensuel
// de l'espace. Détail : src/erp/data/agent-assistant.ts.
// =============================================================================

import { ErreurAssistant, proposerReponse, texteErreurAssistant, traduireMessage, traduireTexte } from '../src/erp/data/agent-assistant.js';
import { optionsAssistant } from './_erp-agent.js';
import { repondre, variableManquante, type ConfigRepullErp } from './_erp-repull.js';
import { configurationEspace } from './_erp-espaces.js';

export const ACTIONS_ASSISTANT = new Set(['brouillon', 'traduire', 'traduire_texte']);

/** Répond à une action de l'assistant pour le membre `par` (son e-mail, pour le journal) dans `espace`. */
export async function repondreAssistant(res: any, action: string, corps: Record<string, unknown>, espace: string | undefined, par: string) {
  let c: ConfigRepullErp;
  try {
    c = await configurationEspace(espace);
  } catch (e) {
    return repondre(res, 503, { ok: false, erreur: e instanceof Error ? e.message : String(e) });
  }
  const manque = variableManquante(c);
  if (manque) return repondre(res, 503, { ok: false, erreur: manque });
  const o = optionsAssistant(c, par);
  try {
    if (action === 'brouillon') {
      return repondre(res, 200, { ok: true, proposition: await proposerReponse(o, String(corps.filId ?? '')) });
    }
    if (action === 'traduire') {
      const r = await traduireMessage(o, String(corps.filId ?? ''), String(corps.messageId ?? ''));
      return repondre(res, 200, { ok: true, texte: r.texte });
    }
    const r = await traduireTexte(o, String(corps.texte ?? ''), String(corps.langue ?? ''));
    return repondre(res, 200, { ok: true, texte: r.texte });
  } catch (e) {
    if (e instanceof ErreurAssistant) return repondre(res, e.statut, { ok: false, erreur: e.message, code: e.code });
    console.error('[erp-agent] assistant', action, e);
    return repondre(res, 502, { ok: false, erreur: texteErreurAssistant(e) });
  }
}
