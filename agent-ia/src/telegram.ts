/**
 * Client minimal de la Bot API Telegram.
 * https://core.telegram.org/bots/api
 */

import { TELEGRAM_BOT_TOKEN } from './config.js';

const API = () => `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/** Limite dure de Telegram : 4096 caractères par message. */
const MAX_LONGUEUR = 4096;

async function appel<T = unknown>(methode: string, corps: unknown): Promise<T> {
  const reponse = await fetch(`${API()}/${methode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  const json = (await reponse.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) {
    throw new Error(`[telegram] ${methode} a échoué : ${json.description ?? 'raison inconnue'}`);
  }
  return json.result as T;
}

/** Découpe sur les sauts de ligne pour ne pas casser un message au milieu d'un mot. */
const decouper = (texte: string): string[] => {
  if (texte.length <= MAX_LONGUEUR) return [texte];
  const morceaux: string[] = [];
  let reste = texte;
  while (reste.length > MAX_LONGUEUR) {
    let coupe = reste.lastIndexOf('\n', MAX_LONGUEUR);
    if (coupe < MAX_LONGUEUR / 2) coupe = MAX_LONGUEUR;
    morceaux.push(reste.slice(0, coupe));
    reste = reste.slice(coupe).trimStart();
  }
  if (reste) morceaux.push(reste);
  return morceaux;
};

/**
 * Envoi en texte brut, volontairement sans parse_mode.
 * Le MarkdownV2 de Telegram exige d'échapper une quinzaine de caractères et fait
 * échouer tout le message à la moindre erreur — pour un agent qui rédige
 * librement, le risque ne vaut pas le gras. Le prompt système lui demande donc
 * d'écrire sans markdown.
 */
export async function envoyerMessage(chatId: number | string, texte: string): Promise<void> {
  for (const morceau of decouper(texte)) {
    await appel('sendMessage', { chat_id: chatId, text: morceau });
  }
}

/** Affiche « en train d'écrire… » pendant que Claude réfléchit. Expire après 5 s. */
export async function indiquerFrappe(chatId: number | string): Promise<void> {
  try {
    await appel('sendChatAction', { chat_id: chatId, action: 'typing' });
  } catch {
    // Purement cosmétique : ne doit jamais faire échouer une réponse.
  }
}

/** Télécharge un fichier envoyé par l'utilisateur (vocal, photo…). */
export async function telechargerFichier(fileId: string): Promise<ArrayBuffer> {
  const { file_path } = await appel<{ file_path: string }>('getFile', { file_id: fileId });
  const reponse = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file_path}`);
  if (!reponse.ok) throw new Error(`[telegram] téléchargement échoué : ${reponse.status}`);
  return reponse.arrayBuffer();
}

// --- Types partiels des mises à jour, limités à ce qu'on exploite ---

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    chat: { id: number; type: string; first_name?: string; username?: string };
    from?: { id: number; first_name?: string; username?: string };
    text?: string;
    voice?: { file_id: string; duration: number; mime_type?: string };
    audio?: { file_id: string; duration: number; mime_type?: string };
  };
};
