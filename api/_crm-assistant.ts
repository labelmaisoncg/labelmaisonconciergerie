// =============================================================================
// Assistant CRM (A11), appelé par api/erp-agent.ts :
//
//   POST { action: 'crm_relance', contactId, canal: 'sms' | 'email' }
//     → { ok, relance: { canal, objet?, texte } }
//     Brouillon de relance rédigé par l'IA, au ton de la conciergerie. RIEN
//     N'EST ENVOYÉ : l'équipe relit, copie et envoie elle-même (l'ERP
//     n'envoie ni e-mail ni SMS).
//
// Membres gérant ou opérations (même contrôle que les autres actions de la
// route) ; chaque appel compte dans le plafond mensuel de l'IA de l'espace ;
// 20 brouillons par quart d'heure et par membre au plus. Le contact est relu
// dans la base de l'espace. Détail : src/erp/data/crm-relance.ts (règles et
// garde-fous : crm-assistant.ts). Un fichier préfixé par « _ » n'est pas
// exposé comme route par Vercel.
// =============================================================================

import { ErreurAssistant, texteErreurAssistant } from '../src/erp/data/agent-assistant.js';
import { preparerRelance } from '../src/erp/data/crm-relance.js';
import { optionsAssistant } from './_erp-agent.js';
import { configurationEspace } from './_erp-espaces.js';
import { repondre, type ConfigRepullErp } from './_erp-repull.js';
import { freinEnvois } from './_garde-formulaire.js';

export const ACTIONS_CRM = new Set(['crm_relance']);

/** Brouillons par membre : 20 par quart d'heure (par instance du serveur). */
const tropDeBrouillons = freinEnvois(20, 15 * 60_000);

/** Répond à une action de l'assistant CRM pour le membre `par` (son e-mail, pour le journal) dans `espace`. */
export async function repondreCrm(res: any, _action: string, corps: Record<string, unknown>, espace: string | undefined, par: string) {
  let c: ConfigRepullErp;
  try {
    c = await configurationEspace(espace);
  } catch (e) {
    return repondre(res, 503, { ok: false, erreur: e instanceof Error ? e.message : String(e) });
  }
  // Le CRM n'a pas besoin des plateformes : seulement de la base de l'espace (compte d'équipe ou serveur).
  if (!c.motDePasse) return repondre(res, 503, { ok: false, erreur: 'Le serveur n’est pas encore relié à la base de l’ERP : réessayez plus tard.' });
  if (tropDeBrouillons(`${c.espace ?? ''}:${par}`)) return repondre(res, 429, { ok: false, code: 'occupe', erreur: 'Beaucoup de brouillons d’un coup : patientez quelques minutes.' });
  try {
    const relance = await preparerRelance(optionsAssistant(c, par), corps.contactId, corps.canal);
    return repondre(res, 200, { ok: true, relance });
  } catch (e) {
    if (e instanceof ErreurAssistant) return repondre(res, e.statut, { ok: false, erreur: e.message, code: e.code });
    console.error('[erp-agent] assistant CRM', e);
    return repondre(res, 502, { ok: false, erreur: texteErreurAssistant(e) });
  }
}
