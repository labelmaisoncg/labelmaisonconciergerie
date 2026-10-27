// =============================================================================
// Réponse aux avis des voyageurs (appelé par api/erp-agent.ts, une ligne) :
//
//   POST { action: 'reponse_avis', reservationId }
//     → { ok, reponse: { texte, source: 'ia' | 'modele', note?, lecture? } }
//     Réponse publique proposée pour l'avis du séjour, à relire et copier.
//     Rien n'est publié sur la plateforme : l'ERP n'écrit jamais chez Airbnb
//     ou Booking.com (ni réponse d'avis, ni prix, ni calendrier, ni annonce).
//
// Membres gérant ou opérations seulement (verifierMembre dans erp-agent.ts :
// un compte en lecture est refusé) ; chaque appel à l'IA compte dans le
// plafond mensuel de l'espace. Détail : src/erp/data/avis-serveur.ts.
// =============================================================================

import { ErreurAssistant, texteErreurAssistant } from '../src/erp/data/agent-assistant.js';
import { preparerReponseAvis } from '../src/erp/data/avis-serveur.js';
import { optionsAssistant } from './_erp-agent.js';
import { repondre, variableManquante, type ConfigRepullErp } from './_erp-repull.js';
import { configurationEspace } from './_erp-espaces.js';

export const ACTIONS_AVIS = new Set(['reponse_avis']);

/** Répond à « reponse_avis » pour le membre `par` (son e-mail, pour le journal) dans `espace`. */
export async function repondreAvis(res: any, corps: Record<string, unknown>, espace: string | undefined, par: string) {
  let c: ConfigRepullErp;
  try {
    c = await configurationEspace(espace);
  } catch (e) {
    return repondre(res, 503, { ok: false, erreur: e instanceof Error ? e.message : String(e) });
  }
  const manque = variableManquante(c);
  if (manque) return repondre(res, 503, { ok: false, erreur: manque });
  try {
    return repondre(res, 200, { ok: true, reponse: await preparerReponseAvis(optionsAssistant(c, par), String(corps.reservationId ?? '')) });
  } catch (e) {
    if (e instanceof ErreurAssistant) return repondre(res, e.statut, { ok: false, erreur: e.message, code: e.code });
    console.error('[erp-agent] avis', e);
    return repondre(res, 502, { ok: false, erreur: texteErreurAssistant(e) });
  }
}
