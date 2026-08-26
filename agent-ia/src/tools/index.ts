/**
 * Registre des outils exposés à Claude.
 *
 * Cette couche est agnostique du modèle ET du canal : un outil ne sait ni qui
 * l'appelle (Claude, un autre modèle) ni d'où vient la demande (Telegram,
 * WhatsApp). C'est ce qui permettra de changer l'un ou l'autre sans toucher à
 * la logique métier.
 *
 * RÈGLE DE SÉCURITÉ : le contexte (`chat_id`) est injecté par le code, jamais
 * fourni par le modèle. Les identifiants Channex en découlent. Voir
 * `tools/onboarding.ts`.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { OUTILS_ONBOARDING } from './onboarding.js';

/** Ce que le code sait de l'appelant, et que le modèle ne peut pas falsifier. */
export type Contexte = {
  chatId: string | number;
};

export type Outil = {
  definition: Anthropic.Tool;
  executer: (args: Record<string, unknown>, ctx: Contexte) => Promise<unknown>;
  /** true = écrit quelque part. Déclenchera la confirmation par bouton en phase 2. */
  ecriture?: boolean;
};

const tous: Outil[] = [...OUTILS_ONBOARDING];

export const OUTILS: Record<string, Outil> = Object.fromEntries(
  tous.map((o) => [o.definition.name, o]),
);

export const definitionsOutils = (): Anthropic.Tool[] => tous.map((o) => o.definition);

export async function executerOutil(
  nom: string,
  args: Record<string, unknown>,
  ctx: Contexte,
): Promise<unknown> {
  const outil = OUTILS[nom];
  if (!outil) return { erreur: `Outil inconnu : ${nom}` };
  try {
    return await outil.executer(args, ctx);
  } catch (err) {
    console.error(`[outils] ${nom} a échoué :`, err);
    return { erreur: err instanceof Error ? err.message : 'Erreur inattendue.' };
  }
}
