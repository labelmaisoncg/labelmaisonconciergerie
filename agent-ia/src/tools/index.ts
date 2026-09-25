/**
 * Registre des outils exposés à Claude.
 *
 * Cette couche est agnostique du modèle ET du canal : un outil ne sait ni qui
 * l'appelle (Claude, un autre modèle) ni d'où vient la demande (Telegram,
 * WhatsApp). C'est ce qui permet de changer l'un ou l'autre sans toucher à la
 * logique métier.
 *
 * RÈGLE DE SÉCURITÉ : le contexte (`chatId`) est injecté par le code, jamais
 * fourni par le modèle. Tous les identifiants Repull et base en découlent.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { OUTILS_ONBOARDING } from './onboarding.js';
import { OUTILS_EXPLOITATION } from './exploitation.js';
import { OUTILS_CONNAISSANCES } from './connaissances.js';
import { OUTILS_MEMOIRE } from './memoire.js';
import { OUTILS_INVITATIONS } from './invitations.js';
import * as store from '../store.js';

/** Ce que le code sait de l'appelant, et que le modèle ne peut pas falsifier. */
export type Contexte = {
  chatId: string | number;
  /**
   * Rempli par un outil en écriture quand il a déposé une action en attente.
   * La couche Telegram y lit de quoi afficher les boutons de confirmation.
   */
  actionEnAttente?: { id: string; recap: string };
};

export type Outil = {
  definition: Anthropic.Tool;
  executer: (args: Record<string, unknown>, ctx: Contexte) => Promise<unknown>;
  /** true = prépare une écriture. Passe par la confirmation par bouton. */
  ecriture?: boolean;
};

const tous: Outil[] = [
  ...OUTILS_ONBOARDING,
  ...OUTILS_EXPLOITATION,
  ...OUTILS_CONNAISSANCES,
  ...OUTILS_MEMOIRE,
  ...OUTILS_INVITATIONS,
  // Pas d'outil de calendrier ni de tarifs : les plateformes restent comme à
  // l'origine (actions.ts et tarifs.ts sont gardés mais non exposés).
];

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
    // Contrôle des rôles, côté code — le modèle ne peut ni le voir ni le
    // contourner. Propriétaire et éditeur : tout. Équipe : lecture seule.
    // Prestataire (ou rôle inconnu) : aucun outil, faute d'outil dédié à son
    // seul planning pour l'instant.
    const role = await store.roleDe(ctx.chatId);
    if (!role || role === 'prestataire') {
      return {
        refuse: true,
        raison:
          "Cet accès ne permet pas de consulter ni de modifier la conciergerie. " +
          'Explique-le poliment et invite la personne à se rapprocher de la conciergerie.',
      };
    }
    if (outil.ecriture && !store.peutEcrire(role)) {
      return {
        refuse: true,
        raison:
          "Seul le propriétaire de la conciergerie peut faire cette modification. " +
          'Explique-le poliment ; les consultations restent possibles.',
      };
    }
    return await outil.executer(args, ctx);
  } catch (err) {
    console.error(`[outils] ${nom} a échoué :`, err);
    return { erreur: err instanceof Error ? err.message : 'Erreur inattendue.' };
  }
}
