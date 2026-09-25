/**
 * Veille autonome — l'agent qui parle sans qu'on lui parle.
 *
 * C'est ce qui sépare un moteur de questions-réponses d'un bras droit. À
 * intervalles réguliers, l'agent regarde l'état des choses et décide s'il y a
 * matière à ouvrir la bouche.
 *
 * RÈGLE CENTRALE : LE SILENCE EST LA NORME. Un agent qui sollicite pour rien
 * est pire qu'un agent muet — on finit par ne plus lire ses messages, et le
 * jour où il signale quelque chose d'important, il est déjà ignoré. Trois
 * garde-fous, tous nécessaires :
 *
 * 1. Le modèle reçoit la consigne explicite de ne rien dire dans le doute.
 * 2. Un sujet déjà signalé ne l'est pas deux fois avant une semaine.
 * 3. Rien n'est envoyé en dehors des heures ouvrées.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from './config.js';
import { comptabiliser } from './cout.js';
import * as repull from './repull.js';
import * as store from './store.js';
import { envoyerMessage } from './telegram.js';
import { aujourdhui, ajouterJours, enFrancais, heureParis } from './dates.js';

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

/** Pas de notification spontanée avant 9 h ni après 20 h. */
const DEBUT = 9;
const FIN = 20;

const DECISION = {
  type: 'json_schema' as const,
  name: 'veille',
  schema: {
    type: 'object',
    properties: {
      signaler: {
        type: 'boolean',
        description: 'true seulement si quelque chose mérite vraiment de déranger.',
      },
      sujet: {
        type: 'string',
        description:
          "Clé courte et stable identifiant le sujet, pour ne pas le répéter " +
          "(ex. « fiche-incomplete:Studio des Halles »). Vide si on ne signale rien.",
      },
      message: {
        type: 'string',
        description: 'Le message à envoyer, court et actionnable. Vide si on ne signale rien.',
      },
    },
    required: ['signaler', 'sujet', 'message'],
    additionalProperties: false,
  },
};

/** Photographie de l'état, sans jugement : c'est le modèle qui jugera. */
async function etatDeLaConciergerie(c: store.Conciergerie): Promise<string> {
  const logements = await store.logements(c.id);
  const demain = ajouterJours(aujourdhui(), 1);
  const lignes: string[] = [];

  lignes.push(`Conciergerie : ${c.nom}`);
  lignes.push(`Style d'écriture appris : ${c.styleProfil ? 'oui' : 'non'}`);

  const savoir = await store.connaissances(c.id);
  lignes.push(`Base de connaissances voyageurs : ${savoir.length} entrées`);

  if (logements.length === 0) {
    lignes.push('Aucun logement enregistré.');
    return lignes.join('\n');
  }

  for (const l of logements) {
    const manques = [
      !l.airbnbConnecte && 'Airbnb non connecté',
      !l.bookingConnecte && 'Booking non connecté',
      !l.cleBoite && 'pas de code de boîte à clés',
      !l.wifiCode && 'pas de code wifi',
      !l.heureArrivee && "pas d'heure d'arrivée",
      l.nom.includes('à nommer') && 'nom provisoire jamais corrigé',
    ].filter(Boolean);

    let activite = '';
    if (l.repullListingId && (l.airbnbConnecte || l.bookingConnecte)) {
      try {
        const [demainDeparts, semaine] = await Promise.all([
          repull.departsDu(l.repullListingId, demain),
          repull.reservations(l.repullListingId, aujourdhui(), ajouterJours(aujourdhui(), 7)),
        ]);
        activite =
          ` — ${semaine.length} réservation(s) sur 7 jours` +
          (demainDeparts.length ? `, ${demainDeparts.length} départ(s) demain` : '');
      } catch {
        activite = ' — lecture des réservations impossible';
      }
    }

    lignes.push(`- ${l.nom}${activite}${manques.length ? ` | manque : ${manques.join(', ')}` : ''}`);
  }

  return lignes.join('\n');
}

const CONSIGNE = `Tu veilles sur l'exploitation d'une conciergerie de locations
courte durée. On te montre l'état des choses. Tu décides s'il y a matière à
envoyer un message à la propriétaire, de ta propre initiative.

LE SILENCE EST LA NORME. Dans le doute, ne signale rien. Un agent qui dérange
pour peu finit par ne plus être lu, et le jour où il a vraiment quelque chose à
dire, personne ne l'écoute. Tu n'as AUCUNE obligation de trouver quelque chose.

Signale seulement si l'inaction a une conséquence concrète et proche :
- une connexion perdue, donc des réservations qu'on ne voit plus
- un départ demain sans que rien ne soit prêt
- une fiche logement vide alors que des voyageurs vont arriver
- une configuration restée en plan depuis longtemps et qui bloque le reste

NE SIGNALE PAS :
- ce qui est simplement « à faire un jour »
- une absence d'activité, qui est normale en basse saison
- ce qui relève du réglage de confort
- quoi que ce soit que tu ne pourrais pas formuler en une phrase actionnable

Si tu signales : un message court, direct, en texte brut sans markdown, qui dit
ce qui se passe et ce qu'il y a à faire. Pas de politesses.`;

/**
 * Un passage de veille pour une conciergerie.
 * Renvoie true si un message a été envoyé.
 */
export async function veiller(
  c: store.Conciergerie & { chatIds: string[] },
): Promise<boolean> {
  const proprietaire = c.chatIds[0];
  if (!proprietaire) return false;

  const h = heureParis();
  if (h < DEBUT || h >= FIN) return false;

  const etat = await etatDeLaConciergerie(c);
  const dejaVus = await store.souvenirs(c.id);

  let decision: { signaler: boolean; sujet: string; message: string };
  try {
    const reponse = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2000,
      output_config: { effort: 'low', format: DECISION },
      system: [{ type: 'text', text: CONSIGNE, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content:
            `Nous sommes le ${enFrancais(aujourdhui())}.\n\n` +
            `ÉTAT :\n${etat}\n\n` +
            (dejaVus.length
              ? `CE QUE TU SAIS D'ELLE :\n${dejaVus.map((s) => `- ${s.contenu}`).join('\n')}\n\n`
              : '') +
            'Y a-t-il quelque chose à signaler ?',
        },
      ],
    });
    comptabiliser('claude-opus-5', reponse.usage);
    const bloc = reponse.content.find((b) => b.type === 'text');
    decision = JSON.parse(bloc && 'text' in bloc ? bloc.text : '{}');
  } catch (err) {
    console.error('[veille] décision impossible :', err);
    return false;
  }

  if (!decision.signaler || !decision.message?.trim() || !decision.sujet?.trim()) return false;

  // Déjà dit récemment : on se tait. Sans ce filtre, la même alerte reviendrait
  // à chaque passage et l'agent deviendrait insupportable en deux jours.
  if (await store.dejaSignale(c.id, decision.sujet)) {
    console.log(`[veille] ${c.nom} : « ${decision.sujet} » déjà signalé, on se tait.`);
    return false;
  }

  await envoyerMessage(proprietaire, decision.message).catch(() => undefined);
  await store.noterInitiative(c.id, decision.sujet, decision.message);
  await store.journaliser(c.id, proprietaire, 'veille', { sujet: decision.sujet }, { message: decision.message });
  return true;
}
