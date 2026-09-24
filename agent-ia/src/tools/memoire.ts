/**
 * Mémoire longue de l'agent.
 *
 * L'historique de conversation ne remonte que sur une vingtaine de messages :
 * au-delà, tout disparaît. Ces outils permettent à l'agent de retenir
 * explicitement ce qui mérite de survivre — et, tout aussi important, de
 * corriger ce qu'il a mal retenu.
 *
 * À ne pas confondre avec `connaissances`, qui sert à répondre aux VOYAGEURS.
 * Ici, c'est ce que l'agent sait de la CONCIERGERIE : ses préférences, ses
 * habitudes, et les corrections qu'elle lui a faites.
 */

import * as store from '../store.js';
import type { Outil } from './index.js';

const retenir: Outil = {
  definition: {
    name: 'retenir',
    description:
      "Mémorise durablement une information sur la conciergerie. Appelle-le de ta " +
      "propre initiative dès que tu apprends quelque chose qui te sera utile dans " +
      'un mois : une préférence (« elle ne veut jamais être dérangée le dimanche »), ' +
      'une habitude (« le ménage de Massy est toujours fait par Fatima »), ou une ' +
      'correction qu\'on vient de te faire (« ce n\'est pas Étigny mais Etigny-le-Bas »). ' +
      "Ne mémorise PAS ce qui est déjà en base — les logements, les codes, les " +
      "réservations — ni ce qui sera périmé demain.",
    input_schema: {
      type: 'object',
      properties: {
        contenu: {
          type: 'string',
          description: 'Le fait à retenir, formulé de façon autonome et compréhensible seul.',
        },
        categorie: {
          type: 'string',
          enum: ['preference', 'correction', 'fait', 'habitude'],
        },
      },
      required: ['contenu', 'categorie'],
      additionalProperties: false,
    },
    strict: true,
  },
  ecriture: true,
  executer: async (args, ctx) => {
    const c = await store.conciergerieParChat(ctx.chatId);
    if (!c) return { erreur: 'Rien à mémoriser : aucun compte connecté.' };
    await store.retenir(c.id, String(args.contenu), String(args.categorie));
    return { retenu: args.contenu };
  },
};

const oublier: Outil = {
  definition: {
    name: 'oublier',
    description:
      "Supprime un souvenir devenu faux ou qu'on te demande d'oublier. Une mémoire " +
      "qu'on ne peut pas corriger est pire que pas de mémoire du tout.",
    input_schema: {
      type: 'object',
      properties: {
        recherche: {
          type: 'string',
          description: 'Quelques mots du souvenir à supprimer.',
        },
      },
      required: ['recherche'],
      additionalProperties: false,
    },
    strict: true,
  },
  ecriture: true,
  executer: async (args, ctx) => {
    const c = await store.conciergerieParChat(ctx.chatId);
    if (!c) return { erreur: 'Aucun compte connecté.' };
    const n = await store.oublier(c.id, String(args.recherche));
    return n > 0 ? { oublies: n } : { rien_trouve: String(args.recherche) };
  },
};

export const OUTILS_MEMOIRE: Outil[] = [retenir, oublier];
