/**
 * Registre des outils exposés à Claude.
 *
 * Cette couche est volontairement agnostique du modèle ET du canal : un outil ne
 * sait ni qui l'appelle (Claude, un autre modèle) ni d'où vient la demande
 * (Telegram, WhatsApp). C'est ce qui permettra de changer l'un ou l'autre sans
 * toucher à la logique métier.
 *
 * Étape 1 : un seul outil, avec des données de test, pour valider la boucle
 * complète message → Claude → outil → réponse.
 * Étape 2 : `executer` tapera dans l'API Channex, les définitions ne bougeront pas.
 */

import type Anthropic from '@anthropic-ai/sdk';

export type Outil = {
  definition: Anthropic.Tool;
  executer: (args: Record<string, unknown>) => Promise<unknown>;
  /** true = écrit quelque part. Déclenchera la confirmation par bouton en phase 2. */
  ecriture?: boolean;
};

const menagesDuJour: Outil = {
  definition: {
    name: 'menages_du_jour',
    description:
      "Liste les ménages à effectuer pour une date donnée. Un ménage correspond " +
      "au départ d'un voyageur. Utilise cet outil dès que la question porte sur " +
      'les ménages, le planning de nettoyage ou la charge de travail du jour.',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: "Date au format AAAA-MM-JJ. Par défaut : aujourd'hui.",
        },
      },
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  executer: async (args) => {
    const date = typeof args.date === 'string' ? args.date : new Date().toISOString().slice(0, 10);
    // ÉTAPE 1 — données de test. Remplacé par un appel Channex à l'étape 2.
    return {
      date,
      _avertissement:
        'DONNÉES DE TEST — Channex n\'est pas encore branché. Préviens explicitement ' +
        "l'utilisateur que ces chiffres sont fictifs.",
      menages: [
        { logement: 'Massy', heure: '11:00', statut: 'à assigner' },
        { logement: 'Évry', heure: '14:00', statut: 'assigné', prestataire: 'exemple' },
      ],
    };
  },
};

export const OUTILS: Record<string, Outil> = {
  [menagesDuJour.definition.name]: menagesDuJour,
};

export const definitionsOutils = (): Anthropic.Tool[] =>
  Object.values(OUTILS).map((o) => o.definition);

export async function executerOutil(nom: string, args: Record<string, unknown>): Promise<unknown> {
  const outil = OUTILS[nom];
  if (!outil) return { erreur: `Outil inconnu : ${nom}` };
  try {
    return await outil.executer(args);
  } catch (err) {
    console.error(`[outils] ${nom} a échoué :`, err);
    return { erreur: err instanceof Error ? err.message : 'Erreur inattendue.' };
  }
}
