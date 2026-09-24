/**
 * Invitations — l'authentification des conciergeries.
 *
 * Un bot Telegram est public. Sans mécanisme d'enrôlement, la seule barrière
 * serait une liste de `chat_id` en variable d'environnement, à éditer et
 * redéployer à chaque nouvelle cliente : intenable.
 *
 * Ici, l'éditeur émet une invitation depuis sa propre conversation. La cliente
 * ouvre `t.me/<bot>?start=<code>`, Telegram envoie le code au bot, et son
 * `chat_id` est rattaché. Le code est à usage unique et se périme en 30 jours.
 *
 * Réservé au rôle « editeur » : une conciergerie ne peut pas en inviter
 * d'autres, sinon n'importe quelle cliente pourrait ouvrir des comptes.
 */

import * as store from '../store.js';
import type { Outil } from './index.js';

const NOM_BOT = process.env.TELEGRAM_BOT_USERNAME || 'Labelmaison_bot';

const inviter: Outil = {
  definition: {
    name: 'inviter_conciergerie',
    description:
      "Crée une invitation pour une nouvelle conciergerie cliente et renvoie le " +
      'lien à lui transmettre. Réservé à l\'éditeur. À utiliser quand on te ' +
      "demande d'ajouter, d'inscrire ou d'inviter une conciergerie.",
    input_schema: {
      type: 'object',
      properties: {
        nom: { type: 'string', description: 'Nom de la conciergerie invitée.' },
        email: { type: 'string', description: 'Son e-mail, facultatif.' },
      },
      required: ['nom'],
      additionalProperties: false,
    },
  },
  ecriture: true,
  executer: async (args, ctx) => {
    if (!(await store.estEditeur(ctx.chatId))) {
      return {
        refuse: true,
        raison:
          "Seul l'éditeur peut inviter une conciergerie. Explique-le sans donner " +
          'de détail sur le fonctionnement interne.',
      };
    }

    const code = await store.creerInvitation(
      String(args.nom),
      args.email ? String(args.email) : null,
      String(ctx.chatId),
    );

    return {
      conciergerie: args.nom,
      lien: `https://t.me/${NOM_BOT}?start=${code}`,
      code,
      valide_jours: 30,
      consigne:
        "Donne le lien tel quel, en précisant qu'il est à usage unique et " +
        "personnel à cette conciergerie. Elle n'a qu'à l'ouvrir : le rattachement " +
        'est automatique, elle n’a ni compte ni mot de passe à créer.',
    };
  },
};

export const OUTILS_INVITATIONS: Outil[] = [inviter];
