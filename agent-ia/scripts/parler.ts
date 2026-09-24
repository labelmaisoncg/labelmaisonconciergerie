/**
 * Banc d'essai local : discuter avec l'agent sans avoir déployé le webhook.
 *
 * Le chemin entrant (Telegram → Vercel) n'existe pas encore, mais le chemin
 * sortant si : on lance la conversation depuis le terminal, et les réponses de
 * l'agent arrivent dans le vrai fil Telegram.
 *
 *   npm run parler                       conversation d'onboarding scriptée
 *   npm run parler -- "ton message"      un ou plusieurs messages libres
 *   npm run parler -- --muet "..."       sans rien envoyer sur Telegram
 */

import type Anthropic from '@anthropic-ai/sdk';
import { repondre } from '../src/agent.ts';
import { envoyerMessage } from '../src/telegram.ts';
import { depenseDuJour } from '../src/cout.ts';
import * as store from '../src/store.ts';

const args = process.argv.slice(2);
const muet = args.includes('--muet');
const libres = args.filter((a) => !a.startsWith('--'));

const CHAT_ID = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(',')[0]?.trim();
if (!CHAT_ID) {
  console.error('TELEGRAM_ALLOWED_CHAT_IDS vide dans .env.local');
  process.exit(1);
}

const SCENARIO = [
  'bonjour',
  'Conciergerie du Lac',
  "j'ai un logement, le Studio des Halles, à Sens",
  'ok connecte airbnb',
  'le code de la boite a cles est 4589 et le wifi Halles-Guest / halles2026, arrivee 16h depart 11h',
  "combien j'ai de menages aujourd'hui ?",
];

const aJouer = libres.length > 0 ? libres : SCENARIO;

for (const entree of aJouer) {
  console.log(`\n\x1b[36m› ${entree}\x1b[0m`);

  const conciergerie = await store.conciergerieParChat(CHAT_ID);
  const fil = await store.historique(CHAT_ID);
  const messages = fil.map((m) => ({ role: m.role, content: m.contenu })) as Anthropic.MessageParam[];
  messages.push({ role: 'user', content: entree });
  await store.ajouterAuFil(CHAT_ID, conciergerie?.id ?? null, 'user', entree);

  const ctx: any = { chatId: CHAT_ID };
  const reponse = await repondre(messages, ctx);

  const apres = await store.conciergerieParChat(CHAT_ID);
  for (const tour of reponse.tours) {
    await store.ajouterAuFil(CHAT_ID, apres?.id ?? null, tour.role as any, tour.content);
  }

  console.log(reponse.texte);
  if (reponse.actionEnAttente) console.log('\x1b[35m  [confirmation par bouton attendue]\x1b[0m');
  if (!muet) {
    await envoyerMessage(CHAT_ID, `› ${entree}`);
    await envoyerMessage(CHAT_ID, reponse.texte);
  }
}

console.log(`\n\x1b[33mCoût de la session : ${depenseDuJour().toFixed(4)} €\x1b[0m`);
process.exit(0);
