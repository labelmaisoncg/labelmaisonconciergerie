/**
 * Base de connaissances : les questions récurrentes des voyageurs et leurs
 * réponses. C'est elle qui alimente la messagerie voyageur.
 *
 * Stockée en LIGNES, jamais en bloc de texte. Aujourd'hui l'agent reçoit tout
 * en contexte — simple et exact. Le jour où le volume de messages rend ça trop
 * coûteux, on ne sélectionnera que les entrées pertinentes, sans rien réécrire.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as repull from '../repull.js';
import * as store from '../store.js';
import { ANTHROPIC_API_KEY } from '../config.js';
import { comptabiliser } from '../cout.js';
import type { Outil } from './index.js';

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

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

/**
 * Apprentissage du ton.
 *
 * Personne ne sait décrire sa propre façon d'écrire. En revanche, ses vraies
 * réponses passées la contiennent. On lit donc les conversations déjà tenues
 * avec les voyageurs, on en extrait ce que la conciergerie a réellement écrit,
 * et on en tire un profil.
 *
 * Le détail qui fait la différence : on conserve aussi une dizaine de réponses
 * telles quelles. Une consigne du type « sois chaleureux mais bref » ne
 * reproduit pas une voix ; des exemples authentiques, oui.
 */
const apprendreStyle: Outil = {
  definition: {
    name: 'apprendre_style',
    description:
      "Analyse les conversations passées avec les voyageurs pour apprendre la " +
      'façon d\'écrire de la conciergerie, et s\'en servir ensuite pour répondre ' +
      "à sa place. À proposer une fois les comptes connectés — sans historique, " +
      'il ne trouvera rien.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  ecriture: true,
  executer: async (_args, ctx) => {
    const c = await store.conciergerieParChat(ctx.chatId);
    if (!c) return { erreur: 'Aucun compte connecté pour le moment.' };

    const logements = await store.logements(c.id);
    const reponses: string[] = [];

    for (const l of logements) {
      if (!l.repullListingId) continue;
      try {
        const fils = await repull.filsDeMessages(l.repullListingId);
        for (const fil of fils.slice(0, 30)) {
          const messages = await repull.messagesDuFil(fil.id);
          for (const m of messages) {
            // Trop court : « ok », « merci » — ça n'apprend rien.
            if (m.auteur === 'hote' && m.texte.trim().length > 25) reponses.push(m.texte.trim());
          }
        }
      } catch (err) {
        console.warn(`[style] historique illisible pour ${l.nom} :`, err);
      }
    }

    if (reponses.length < 5) {
      return {
        insuffisant: true,
        trouve: reponses.length,
        explication:
          "Pas assez de réponses passées pour en tirer un style fiable (moins de cinq). " +
          "Soit les comptes viennent d'être connectés et l'historique n'est pas encore " +
          'remonté, soit les échanges sont trop courts. Propose de réessayer plus tard, ' +
          'ou de décrire le ton souhaité à la main.',
      };
    }

    const echantillon = reponses.slice(0, 40);
    const analyse = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1200,
      messages: [
        {
          role: 'user',
          content:
            "Voici de vraies réponses écrites par une conciergerie à ses voyageurs. " +
            'Décris sa façon d\'écrire en cinq à huit lignes, de façon assez précise ' +
            "pour qu'on puisse l'imiter : tutoiement ou vouvoiement, longueur des " +
            'phrases, niveau de formalité, emoji ou non, formules d\'ouverture et de ' +
            'clôture récurrentes, tics de langage. Décris seulement, ne juge pas.\n\n' +
            echantillon.map((r) => `— ${r}`).join('\n'),
        },
      ],
    });
    comptabiliser('claude-opus-5', analyse.usage);

    const bloc = analyse.content.find((b) => b.type === 'text');
    const profil = bloc && 'text' in bloc ? bloc.text.trim() : '';
    if (!profil) return { erreur: "L'analyse n'a rien produit." };

    // Dix exemples suffisent à porter la voix, et gardent le prompt léger.
    await store.enregistrerStyle(c.id, profil, echantillon.slice(0, 10));

    return {
      appris: true,
      reponses_analysees: echantillon.length,
      profil,
      consigne:
        "Résume le style en une phrase à l'utilisateur et demande-lui de confirmer " +
        'que ça lui ressemble.',
    };
  },
};

export const OUTILS_CONNAISSANCES: Outil[] = [importer, consulter, apprendreStyle];
