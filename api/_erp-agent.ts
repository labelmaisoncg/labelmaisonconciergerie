// =============================================================================
// Agent IA de la messagerie — briques communes (api/erp-agent.ts, et la fin
// des synchronisations Repull : api/erp-repull-sync.ts, api/erp-repull-webhook.ts).
//
// Variables d'environnement (projet Vercel du site), en plus de celles de
// _erp-repull.ts :
//   ANTHROPIC_API_KEY   clé de l'API Claude — sans elle, l'agent ne répond pas
//   AGENT_MODELE        modèle des réponses (claude-haiku-4-5-20251001 par défaut)
//   TELEGRAM_BOT_TOKEN  bot Telegram qui prévient l'équipe (facultatif)
//   TELEGRAM_CHAT_ID    groupe ou conversation Telegram de l'équipe (facultatif)
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { MODELE_AGENT_DEFAUT, lancerAgent, type ClientIA, type DeclencheurAgent, type OptionsAgent, type PassageAgent } from '../src/erp/data/agent-messagerie.js';
import type { OptionsAssistant } from '../src/erp/data/agent-assistant.js';
import { estLabelMaison } from '../src/erp/data/espaces.js';
import { envoyerNotifications } from '../src/erp/data/notifications-envoi.js';
import { baseErp, signeurFichiersErp, type ConfigRepullErp } from './_erp-repull.js';
import { clesServeur } from './_erp-notifications.js';

export interface ConfigAgent {
  cleIA: string;
  modele: string;
  telegram: { jeton: string; chat: string } | null;
}

export function configurationAgent(): ConfigAgent {
  const jeton = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chat = (process.env.TELEGRAM_CHAT_ID || '').trim();
  return {
    cleIA: (process.env.ANTHROPIC_API_KEY || '').trim(),
    modele: (process.env.AGENT_MODELE || '').trim() || MODELE_AGENT_DEFAUT,
    telegram: jeton && chat ? { jeton, chat } : null,
  };
}

// Client Claude gardé tant que l'instance vit (un par clé).
let client: { cle: string; ia: Anthropic } | null = null;

/**
 * Options d'un passage de l'agent dans l'espace de `c` : clé Claude commune ;
 * Telegram pour Label Maison seulement ; plafond mensuel pour les autres.
 */
/** Client Claude de l'instance (créé à la première demande) ; null sans ANTHROPIC_API_KEY. */
function clientIA(a: ConfigAgent): ClientIA | null {
  if (a.cleIA && (!client || client.cle !== a.cleIA)) {
    client = { cle: a.cleIA, ia: new Anthropic({ apiKey: a.cleIA, maxRetries: 1, timeout: 25_000 }) };
  }
  return a.cleIA && client ? client.ia : null;
}

export function optionsAgent(c: ConfigRepullErp, declencheur: DeclencheurAgent, echeance: number): OptionsAgent {
  const a = configurationAgent();
  const ia = clientIA(a);
  const labelMaison = estLabelMaison(c.espace);
  return {
    cle: c.cle,
    workspace: c.workspace,
    origineCle: c.origineCle,
    base: baseErp(c),
    echeance,
    budgetMois: c.budgetMois,
    quotaMois: c.quotaMois,
    declencheur,
    ia,
    modele: a.modele,
    telegram: labelMaison ? a.telegram : null,
    signerFichier: signeurFichiersErp(c),
    // Contrôle des réponses en échec répété : notification aux appareils des gérants de l'espace (une fois).
    alerter: (g) => envoyerNotifications(baseErp(c), [g], { cles: clesServeur() }),
    ...(labelMaison ? {} : { nomEspace: c.nomEspace, plafondIAMois: c.plafondIAMois }),
  };
}

/**
 * Options de l'assistant de réponse (« Proposer une réponse », traductions)
 * dans l'espace de `c` : même clé Claude et même plafond mensuel que l'agent.
 */
export function optionsAssistant(c: ConfigRepullErp, par: string): OptionsAssistant {
  const a = configurationAgent();
  const labelMaison = estLabelMaison(c.espace);
  return {
    base: baseErp(c),
    ia: clientIA(a),
    modele: a.modele,
    signerFichier: signeurFichiersErp(c),
    par,
    ...(labelMaison ? {} : { nomEspace: c.nomEspace, plafondIAMois: c.plafondIAMois }),
  };
}

/**
 * Après une synchronisation qui a apporté des messages : l'agent passe tout
 * de suite, dans le temps qui reste (sinon le passage planifié suivant s'en charge).
 */
export async function agentApresSynchro(c: ConfigRepullErp, nouveauxMessages: number, echeance: number): Promise<PassageAgent | null> {
  if (nouveauxMessages <= 0 || !configurationAgent().cleIA || echeance - Date.now() < 20_000) return null;
  try {
    return await lancerAgent(optionsAgent(c, 'synchro', echeance));
  } catch (e) {
    console.error('[erp-agent] après synchronisation', e);
    return null;
  }
}
