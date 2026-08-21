#!/usr/bin/env node
/**
 * Configure (ou inspecte, ou retire) le webhook Telegram.
 *
 *   npm run set-webhook -- https://mon-agent.vercel.app
 *   npm run webhook-info
 *   npm run set-webhook -- --delete
 *
 * Le secret_token posé ici est renvoyé par Telegram dans l'en-tête
 * X-Telegram-Bot-Api-Secret-Token à chaque appel : c'est ce qui empêche
 * quelqu'un qui connaîtrait l'URL de fabriquer de faux messages.
 */

import { lireEnv } from './env.mjs';

const env = lireEnv();
const { TELEGRAM_BOT_TOKEN, TELEGRAM_SECRET_TOKEN } = env;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN absent de .env.local');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const args = process.argv.slice(2);

if (args.includes('--info')) {
  const { result } = await (await fetch(`${API}/getWebhookInfo`)).json();
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (args.includes('--delete')) {
  const r = await (await fetch(`${API}/deleteWebhook`, { method: 'POST' })).json();
  console.log(r.ok ? 'Webhook retiré.' : `Échec : ${r.description}`);
  process.exit(r.ok ? 0 : 1);
}

const base = args.find((a) => a.startsWith('https://'));
if (!base) {
  console.error('Usage : npm run set-webhook -- https://mon-agent.vercel.app');
  process.exit(1);
}

if (!TELEGRAM_SECRET_TOKEN) {
  console.error('TELEGRAM_SECRET_TOKEN absent de .env.local.');
  console.error('Génère-le avec : openssl rand -hex 32');
  process.exit(1);
}

const url = `${base.replace(/\/$/, '')}/api/telegram`;

const reponse = await fetch(`${API}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url,
    secret_token: TELEGRAM_SECRET_TOKEN,
    allowed_updates: ['message', 'callback_query'],
    // Évite de rejouer les messages accumulés pendant que le bot était hors ligne.
    drop_pending_updates: true,
  }),
});

const resultat = await reponse.json();
if (!resultat.ok) {
  console.error(`Échec : ${resultat.description}`);
  process.exit(1);
}

console.log(`Webhook configuré sur ${url}`);
console.log('Vérification : npm run webhook-info');
