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
import { MODELE_AGENT_DEFAUT, lancerAgent, type DeclencheurAgent, type OptionsAgent, type PassageAgent } from '../src/erp/data/agent-messagerie.js';
import { baseErp, type ConfigRepullErp } from './_erp-repull.js';

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

/** Options d'un passage de l'agent, depuis les variables d'environnement. */
export function optionsAgent(c: ConfigRepullErp, declencheur: DeclencheurAgent, echeance: number): OptionsAgent {
  const a = configurationAgent();
  if (a.cleIA && (!client || client.cle !== a.cleIA)) {
    client = { cle: a.cleIA, ia: new Anthropic({ apiKey: a.cleIA, maxRetries: 1, timeout: 25_000 }) };
  }
  return {
    cle: c.cle,
    base: baseErp(c),
    echeance,
    budgetMois: c.budgetMois,
    quotaMois: c.quotaMois,
    declencheur,
    ia: a.cleIA && client ? client.ia : null,
    modele: a.modele,
    telegram: a.telegram,
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
