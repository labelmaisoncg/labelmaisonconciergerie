/**
 * Webhook Telegram — porte d'entrée de l'agent.
 *
 * Chaîne : Telegram → cette fonction → Claude → outils → réponse dans le fil.
 *
 * Point délicat : Telegram considère le webhook en échec s'il ne reçoit pas un
 * 200 rapidement, et rejoue alors le message — l'agent répondrait deux fois. On
 * accuse donc réception immédiatement et on traite en tâche de fond via
 * `waitUntil`, qui empêche Vercel de geler la fonction après la réponse HTTP.
 */

import { waitUntil } from '@vercel/functions';
import { repondre } from '../src/agent.js';
import { chatAutorise, configManquante, secretValide } from '../src/config.js';
import { envoyerMessage, indiquerFrappe, telechargerFichier } from '../src/telegram.js';
import type { TelegramUpdate } from '../src/telegram.js';
import { transcrire, transcriptionDisponible } from '../src/transcription.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const manque = configManquante();
  if (manque.length > 0) {
    console.error('[telegram] configuration incomplète :', manque.join(', '));
    // 200 volontaire : inutile que Telegram rejoue un message qu'on ne saura
    // pas mieux traiter au second essai.
    return res.status(200).json({ ok: true });
  }

  if (!secretValide(req.headers['x-telegram-bot-api-secret-token'])) {
    console.warn('[telegram] secret invalide — requête rejetée.');
    return res.status(401).json({ ok: false });
  }

  let update: TelegramUpdate;
  try {
    update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(200).json({ ok: true });
  }

  const message = update?.message;
  if (!message) return res.status(200).json({ ok: true });

  const chatId = message.chat.id;

  if (!chatAutorise(chatId)) {
    // On ne répond rien : un inconnu ne doit pas savoir que le bot est actif.
    // Le chat_id est journalisé pour pouvoir l'ajouter à la whitelist si c'est
    // quelqu'un de légitime.
    console.warn(
      `[telegram] chat_id non autorisé : ${chatId} (${message.from?.username ?? 'sans pseudo'})`,
    );
    return res.status(200).json({ ok: true });
  }

  // Accusé de réception immédiat, traitement derrière.
  res.status(200).json({ ok: true });
  waitUntil(traiter(update));
}

async function traiter(update: TelegramUpdate): Promise<void> {
  const message = update.message!;
  const chatId = message.chat.id;

  try {
    await indiquerFrappe(chatId);

    const texte = await extraireTexte(message);
    if (!texte) return;

    const reponse = await repondre([{ role: 'user', content: texte }], { chatId });
    await envoyerMessage(chatId, reponse);
  } catch (err) {
    console.error('[telegram] erreur de traitement :', err);
    await envoyerMessage(
      chatId,
      "Je n'ai pas réussi à traiter ta demande. Réessaie dans un instant.",
    ).catch(() => undefined);
  }
}

/** Texte tapé, ou vocal transcrit. */
async function extraireTexte(message: NonNullable<TelegramUpdate['message']>): Promise<string | null> {
  if (message.text) return message.text;

  const audio = message.voice ?? message.audio;
  if (!audio) {
    await envoyerMessage(
      message.chat.id,
      'Je ne traite que le texte et les messages vocaux pour le moment.',
    );
    return null;
  }

  if (!transcriptionDisponible()) {
    await envoyerMessage(
      message.chat.id,
      "Les vocaux ne sont pas encore activés — il manque la clé OpenAI. Écris-moi en texte.",
    );
    return null;
  }

  const fichier = await telechargerFichier(audio.file_id);
  const transcription = await transcrire(fichier);
  console.log(`[telegram] vocal de ${audio.duration}s transcrit : ${transcription}`);

  if (!transcription) {
    await envoyerMessage(message.chat.id, "Je n'ai rien compris à ce vocal. Tu peux répéter ?");
    return null;
  }
  return transcription;
}
