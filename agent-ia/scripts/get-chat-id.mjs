#!/usr/bin/env node
/**
 * Récupère le chat_id des personnes qui ont écrit au bot, pour alimenter
 * TELEGRAM_ALLOWED_CHAT_IDS.
 *
 * ⚠️ À lancer AVANT `npm run set-webhook` : dès qu'un webhook est configuré,
 * Telegram cesse de servir getUpdates. Si c'est déjà fait, retirer le webhook
 * avec `npm run set-webhook -- --delete`, relever le chat_id, puis le remettre.
 *
 * Usage : npm run chat-id
 */

import { lireEnv } from './env.mjs';

const { TELEGRAM_BOT_TOKEN } = lireEnv();
if (!TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN absent de .env.local');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const infoWebhook = await (await fetch(`${API}/getWebhookInfo`)).json();
if (infoWebhook.result?.url) {
  console.error(`\n⚠️  Un webhook est actif (${infoWebhook.result.url}).`);
  console.error('   getUpdates ne renverra rien tant qu\'il est en place.');
  console.error('   → npm run set-webhook -- --delete, puis relance cette commande.\n');
  process.exit(1);
}

const { ok, result, description } = await (await fetch(`${API}/getUpdates`)).json();
if (!ok) {
  console.error(`Erreur Telegram : ${description}`);
  process.exit(1);
}

if (result.length === 0) {
  console.log('\nAucun message reçu.');
  console.log('→ Ouvre Telegram, écris au bot, puis relance cette commande.\n');
  process.exit(0);
}

const vus = new Map();
for (const u of result) {
  const m = u.message ?? u.edited_message;
  if (!m) continue;
  vus.set(m.chat.id, {
    nom: [m.chat.first_name, m.chat.last_name].filter(Boolean).join(' ') || '(sans nom)',
    pseudo: m.chat.username ? `@${m.chat.username}` : '(sans pseudo)',
    dernier: m.text ?? '(non textuel)',
  });
}

console.log('\nExpéditeurs vus par le bot :\n');
for (const [id, info] of vus) {
  console.log(`  chat_id : ${id}`);
  console.log(`  nom     : ${info.nom} ${info.pseudo}`);
  console.log(`  message : ${info.dernier}\n`);
}
console.log('À reporter dans .env.local :');
console.log(`TELEGRAM_ALLOWED_CHAT_IDS=${[...vus.keys()].join(',')}\n`);
