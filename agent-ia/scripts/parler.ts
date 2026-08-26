/**
 * Banc d'essai local : discuter avec l'agent sans avoir déployé le webhook.
 *
 * Le chemin entrant (Telegram → Vercel) n'existe pas encore, mais le chemin
 * sortant si : on lance la conversation depuis le terminal, et les réponses de
 * l'agent arrivent dans le vrai fil Telegram. C'est l'expérience réelle, à
 * l'inverse près de qui tape.
 *
 *   npm run parler                          conversation d'onboarding scriptée
 *   npm run parler -- "ton message"         un message libre
 *   npm run parler -- --muet "..."          sans envoyer sur Telegram
 */

import type Anthropic from '@anthropic-ai/sdk';
import { repondre } from '../src/agent.ts';
import { envoyerMessage } from '../src/telegram.ts';
import { depenseDuJour } from '../src/cout.ts';

const args = process.argv.slice(2);
const muet = args.includes('--muet');
const libres = args.filter((a) => !a.startsWith('--'));

const CHAT_ID = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(',')[0]?.trim();
if (!CHAT_ID) {
  console.error('TELEGRAM_ALLOWED_CHAT_IDS vide dans .env.local');
  process.exit(1);
}

/** Conversation d'onboarding par défaut, jouée comme le ferait une cliente. */
const SCENARIO = [
  'bonjour',
  'Conciergerie du Lac',
  "j'ai un logement, le Studio des Halles, à Sens",
  'ok connecte airbnb',
  'et booking ?',
];

const messages: Anthropic.MessageParam[] = [];
const aJouer = libres.length > 0 ? libres : SCENARIO;

for (const entree of aJouer) {
  console.log(`\n\x1b[36m› ${entree}\x1b[0m`);
  messages.push({ role: 'user', content: entree });

  const reponse = await repondre(messages, { chatId: CHAT_ID });
  messages.push({ role: 'assistant', content: reponse });

  console.log(reponse);
  if (!muet) {
    await envoyerMessage(CHAT_ID, `› ${entree}`);
    await envoyerMessage(CHAT_ID, reponse);
  }
}

console.log(`\n\x1b[33mCoût de la session : ${depenseDuJour().toFixed(4)} €\x1b[0m`);
