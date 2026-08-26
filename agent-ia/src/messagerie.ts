/**
 * Messagerie voyageur — l'agent répond aux clients des conciergeries.
 *
 * C'est le seul endroit où l'agent parle à quelqu'un d'autre que la
 * conciergerie. Une réponse ratée ne coûte pas un ménage mal planifié : elle
 * coûte un avis à trois étoiles sur l'annonce d'une cliente qui paie. D'où
 * trois garde-fous, dans l'ordre d'importance :
 *
 * 1. Interdiction absolue d'inventer. Tout vient de la fiche logement et de la
 *    base de connaissances. Rien dedans → escalade, jamais d'improvisation.
 * 2. Interdiction d'engager de l'argent. Remboursement, geste commercial,
 *    remise, changement de prix : escalade systématique.
 * 3. Copie de chaque réponse au propriétaire. Il ne valide pas, mais il voit
 *    tout en temps réel et peut reprendre la main.
 *
 * Channex n'expose aucun webhook sur les nouveaux messages : c'est une boucle
 * d'interrogation, appelée par le cron.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from './config.js';
import { comptabiliser } from './cout.js';
import * as channex from './channex.js';
import * as store from './store.js';
import { envoyerMessage } from './telegram.js';

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

/** Haiku, pas Opus : ici c'est le VOLUME qui fait le coût. Une conciergerie de
 *  dix logements reçoit facilement cent messages par jour, là où la
 *  propriétaire en pose quarante. Cinq fois moins cher sur le chemin le plus
 *  emprunté, et plus rapide — ce qui compte pour le délai de réponse Airbnb. */
const MODELE = 'claude-haiku-4-5';

const DECISION = {
  type: 'json_schema' as const,
  name: 'reponse_voyageur',
  schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['repondre', 'escalader'],
        description: "repondre si l'information est disponible ; escalader sinon.",
      },
      texte: {
        type: 'string',
        description: "La réponse au voyageur, dans SA langue. Vide si escalade.",
      },
      raison: {
        type: 'string',
        description: "Pourquoi escalader. Vide si on répond.",
      },
    },
    required: ['action', 'texte', 'raison'],
    additionalProperties: false,
  },
};

const consigne = (
  logement: store.Logement,
  savoir: store.Connaissance[],
  style: { profil: string | null; exemples: string[] },
): string => {
  const fiche = [
    `Logement : ${logement.nom}${logement.ville ? `, ${logement.ville}` : ''}`,
    logement.heureArrivee && `Arrivée à partir de : ${logement.heureArrivee}`,
    logement.heureDepart && `Départ avant : ${logement.heureDepart}`,
    logement.cleBoite && `Boîte à clés : ${logement.cleBoite}`,
    logement.wifiNom && `Wifi : ${logement.wifiNom}${logement.wifiCode ? ` / ${logement.wifiCode}` : ''}`,
    logement.consignes && `Consignes : ${logement.consignes}`,
  ]
    .filter(Boolean)
    .join('\n');

  const base = savoir.length
    ? savoir.map((c) => `Q : ${c.question}\nR : ${c.reponse}`).join('\n\n')
    : '(base de connaissances vide)';

  const voix = style.profil
    ? `\n\nTU DOIS PARLER COMME LA CONCIERGERIE.\nSon style : ${style.profil}` +
      (style.exemples.length
        ? `\n\nSes vraies réponses passées, à imiter dans le ton et la longueur :\n` +
          style.exemples.map((e) => `« ${e} »`).join('\n')
        : '')
    : '';

  return `Tu réponds à un voyageur au nom d'une conciergerie de location courte durée.

FICHE DU LOGEMENT — la seule vérité factuelle dont tu disposes :
${fiche}

QUESTIONS FRÉQUENTES ET RÉPONSES VALIDÉES :
${base}${voix}

RÈGLES ABSOLUES :
- N'invente RIEN. Si l'information n'est ni dans la fiche ni dans les questions
  fréquentes, escalade. Ne devine jamais un horaire, un code ou un équipement.
- N'engage jamais d'argent : remboursement, geste commercial, remise, réduction,
  modification de prix, dédommagement → escalade.
- Un litige, une réclamation, un incident, un problème de sécurité → escalade.
- Une demande de dérogation aux règles (arrivée anticipée, départ tardif,
  animal, personne en plus) → escalade : ce n'est pas à toi de l'accorder.
- RÉPONDS DANS LA LANGUE DU VOYAGEUR.
- Sois bref. Un voyageur veut une réponse, pas une lettre.`;
};

/**
 * Traite les messages voyageurs en attente pour une conciergerie.
 * Renvoie le nombre de réponses envoyées.
 */
export async function traiterMessagesVoyageurs(
  conciergerie: store.Conciergerie & { chatIds: string[] },
): Promise<{ repondus: number; escalades: number }> {
  const logements = await store.logements(conciergerie.id);
  let repondus = 0;
  let escalades = 0;

  for (const logement of logements) {
    if (!logement.channexPropertyId) continue;

    let fils: channex.FilMessages[] = [];
    try {
      fils = await channex.filsDeMessages(logement.channexPropertyId);
    } catch (err) {
      console.error(`[messagerie] fils illisibles pour ${logement.nom} :`, err);
      continue;
    }

    for (const fil of fils) {
      if (fil.ferme) continue;

      const messages = await channex.messagesDuFil(fil.id);
      const dernier = messages.at(-1);
      // On ne répond que si le DERNIER message vient du voyageur : sinon la
      // conciergerie a déjà répondu elle-même, ou c'est notre propre message.
      if (!dernier || dernier.auteur !== 'voyageur') continue;
      if (await store.dejaTraite(fil.id, dernier.id)) continue;

      const [savoir] = await Promise.all([store.connaissances(conciergerie.id, logement.id)]);

      const historique = messages
        .slice(-10)
        .map((m) => `${m.auteur === 'voyageur' ? 'Voyageur' : 'Hôte'} : ${m.texte}`)
        .join('\n');

      let decision: { action: string; texte: string; raison: string };
      try {
        const reponse = await client.messages.create({
          model: MODELE,
          max_tokens: 1500,
          system: [
            {
              type: 'text',
              text: consigne(logement, savoir, {
                profil: conciergerie.styleProfil,
                exemples: conciergerie.styleExemples,
              }),
              // La fiche et la base ne bougent pas d'un message à l'autre :
              // mises en cache, elles coûtent dix fois moins cher en lecture.
              cache_control: { type: 'ephemeral' },
            },
          ],
          output_config: { format: DECISION },
          messages: [{ role: 'user', content: `Conversation :\n${historique}\n\nRéponds au dernier message.` }],
        });
        comptabiliser(MODELE, reponse.usage);
        const bloc = reponse.content.find((b) => b.type === 'text');
        decision = JSON.parse(bloc && 'text' in bloc ? bloc.text : '{}');
      } catch (err) {
        console.error('[messagerie] génération impossible :', err);
        continue;
      }

      const proprietaire = conciergerie.chatIds[0];

      if (decision.action === 'escalader' || !decision.texte?.trim()) {
        escalades++;
        await store.marquerTraite(fil.id, dernier.id, conciergerie.id, '(escaladé)');
        if (proprietaire) {
          await envoyerMessage(
            proprietaire,
            `Message voyageur que je ne traite pas seul — ${logement.nom}\n\n` +
              `Il écrit : ${dernier.texte}\n\n` +
              `Raison : ${decision.raison || 'information absente de la fiche'}\n\n` +
              `À toi de répondre.`,
          ).catch(() => undefined);
        }
        continue;
      }

      try {
        await channex.repondreAuFil(fil.id, decision.texte);
        await store.marquerTraite(fil.id, dernier.id, conciergerie.id, decision.texte);
        await store.journaliser(
          conciergerie.id,
          null,
          'repondre_voyageur',
          { fil: fil.id, question: dernier.texte },
          { reponse: decision.texte },
        );
        repondus++;

        // Copie au propriétaire : il ne valide pas, mais il voit tout.
        if (proprietaire) {
          await envoyerMessage(
            proprietaire,
            `Répondu à un voyageur — ${logement.nom}\n\n` +
              `Il : ${dernier.texte}\n` +
              `Moi : ${decision.texte}`,
          ).catch(() => undefined);
        }
      } catch (err) {
        console.error('[messagerie] envoi impossible :', err);
      }
    }
  }

  return { repondus, escalades };
}
