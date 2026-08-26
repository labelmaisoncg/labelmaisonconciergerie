/**
 * Base de connaissances : les questions récurrentes des voyageurs et leurs
 * réponses. C'est elle qui alimente la messagerie voyageur.
 *
 * Stockée en LIGNES, jamais en bloc de texte. Aujourd'hui l'agent reçoit tout
 * en contexte — simple et exact. Le jour où le volume de messages rend ça trop
 * coûteux, on ne sélectionnera que les entrées pertinentes, sans rien réécrire.
 */

import * as store from '../store.js';
import type { Outil } from './index.js';

const importer: Outil = {
  definition: {
    name: 'importer_connaissances',
    description:
      "Enregistre des questions-réponses types pour répondre aux voyageurs. " +
      "Quand la conciergerie t'envoie son livret d'accueil, une liste de questions " +
      'fréquentes ou un texte en vrac, découpe-le toi-même en paires ' +
      'question/réponse et appelle cet outil. Une paire par information ' +
      "distincte — mieux vaut trente entrées précises qu'une seule fourre-tout.",
    input_schema: {
      type: 'object',
      properties: {
        logement: {
          type: 'string',
          description: 'Limiter ces réponses à un logement. Omettre si valable pour tous.',
        },
        entrees: {
          type: 'array',
          description: 'Les paires question/réponse.',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string', description: "La question telle qu'un voyageur la poserait." },
              reponse: { type: 'string', description: 'La réponse à donner.' },
            },
            required: ['question', 'reponse'],
            additionalProperties: false,
          },
        },
      },
      required: ['entrees'],
      additionalProperties: false,
    },
  },
  ecriture: true,
  executer: async (args, ctx) => {
    const c = await store.conciergerieParChat(ctx.chatId);
    if (!c) return { erreur: 'Aucune conciergerie enregistrée.' };

    let logementId: string | null = null;
    if (args.logement) {
      const l = await store.logementParNom(c.id, String(args.logement));
      if (!l) return { erreur: `Logement introuvable : ${args.logement}` };
      logementId = l.id;
    }

    const entrees = (args.entrees as Array<{ question: string; reponse: string }>) ?? [];
    const n = await store.ajouterConnaissances(c.id, logementId, entrees);
    const total = (await store.connaissances(c.id)).length;

    return {
      ajoutees: n,
      portee: logementId ? String(args.logement) : 'tous les logements',
      total_base: total,
    };
  },
};

const consulter: Outil = {
  definition: {
    name: 'consulter_connaissances',
    description:
      'Liste ce que la base de connaissances contient déjà. Utile pour dire à la ' +
      "conciergerie ce qui manque encore, ou pour vérifier avant d'ajouter un doublon.",
    input_schema: {
      type: 'object',
      properties: { logement: { type: 'string', description: 'Limiter à un logement.' } },
      required: [],
      additionalProperties: false,
    },
  },
  executer: async (args, ctx) => {
    const c = await store.conciergerieParChat(ctx.chatId);
    if (!c) return { erreur: 'Aucune conciergerie enregistrée.' };

    let logementId: string | undefined;
    if (args.logement) {
      const l = await store.logementParNom(c.id, String(args.logement));
      if (!l) return { erreur: `Logement introuvable : ${args.logement}` };
      logementId = l.id;
    }

    const entrees = await store.connaissances(c.id, logementId);
    return {
      total: entrees.length,
      questions: entrees.map((e) => e.question),
      ...(entrees.length === 0
        ? { note: "La base est vide : l'agent ne pourra pas répondre aux voyageurs." }
        : {}),
    };
  },
};

export const OUTILS_CONNAISSANCES: Outil[] = [importer, consulter];
