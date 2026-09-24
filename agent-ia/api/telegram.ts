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
import {
  accuserClic,
  envoyerAvecBoutons,
  envoyerMessage,
  indiquerFrappe,
  retirerBoutons,
  telechargerFichier,
} from '../src/telegram.js';
import type { TelegramUpdate } from '../src/telegram.js';
import { transcrire, transcriptionDisponible } from '../src/transcription.js';
import { executerActionConfirmee } from '../src/tools/actions.js';
import * as store from '../src/store.js';

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

  const chatId = update?.message?.chat.id ?? update?.callback_query?.message?.chat.id;
  if (!chatId) return res.status(200).json({ ok: true });

  const texteBrut = update.message?.text;
  if (!(await autorise(chatId, texteBrut))) {
    // On ne répond rien : un inconnu ne doit pas savoir que le bot est actif.
    // Le chat_id est journalisé pour pouvoir l'ajouter si c'est quelqu'un de légitime.
    console.warn(`[telegram] chat_id non autorisé : ${chatId}`);
    return res.status(200).json({ ok: true });
  }

  // Accusé de réception immédiat, traitement derrière.
  res.status(200).json({ ok: true });
  waitUntil(update.callback_query ? traiterClic(update) : traiterMessage(update));
}

/**
 * Trois portes, dans cet ordre :
 *  1. la liste d'amorçage (variable d'environnement), pour l'éditeur avant
 *     qu'aucune conciergerie n'existe ;
 *  2. la table `membres`, pour les conciergeries déjà rattachées ;
 *  3. un `/start <code>` porteur d'une invitation valide — c'est le seul cas
 *     où un inconnu peut entrer, et le code fait office de preuve.
 */
async function autorise(chatId: number | string, texte?: string): Promise<boolean> {
  if (chatAutorise(chatId)) return true;
  if (await store.conciergerieParChat(chatId)) return true;
  return Boolean(codeInvitation(texte));
}

/** Extrait le code d'un `/start ABCD…` envoyé par Telegram au premier contact. */
function codeInvitation(texte?: string): string | null {
  const m = /^\/start\s+([A-Z0-9]{8,24})\s*$/i.exec((texte ?? '').trim());
  return m ? m[1]!.toUpperCase() : null;
}

/**
 * Rattachement d'une nouvelle conciergerie. Renvoie true si le message était
 * une invitation et a été traité — auquel cas il n'y a rien d'autre à faire.
 */
async function traiterInvitation(chatId: number | string, texte: string): Promise<boolean> {
  const code = codeInvitation(texte);
  if (!code) return false;

  const deja = await store.conciergerieParChat(chatId);
  if (deja) {
    await envoyerMessage(chatId, `Vous êtes déjà rattaché à ${deja.nom}. Que puis-je faire pour vous ?`);
    return true;
  }

  const invitation = await store.consommerInvitation(code, chatId);
  if (!invitation) {
    await envoyerMessage(
      chatId,
      "Ce lien d'invitation n'est plus valable : il a déjà servi, ou il a expiré. " +
        'Demandez-en un nouveau à Label Maison.',
    );
    return true;
  }

  // La conciergerie côté Channex n'est créée qu'au premier besoin réel : ici on
  // se contente d'ouvrir la fiche et de rattacher la personne.
  let conciergerieId = invitation.conciergerieId;
  if (!conciergerieId) {
    const c = await store.creerConciergerie(invitation.nomConciergerie, null, chatId);
    conciergerieId = c.id;
    await store.lierInvitation(code, c.id);
  } else {
    await store.rattacherMembre(conciergerieId, chatId);
  }

  console.log(`[telegram] invitation consommée : ${invitation.nomConciergerie} → ${chatId}`);
  await envoyerMessage(
    chatId,
    `Bienvenue, ${invitation.nomConciergerie}.\n\n` +
      "Je suis votre assistant : réservations, ménages, arrivées, départs, et les " +
      'messages de vos voyageurs.\n\n' +
      "Pour commencer, connectons votre compte Airbnb. Dites-moi simplement " +
      '« connecte mon Airbnb » et je vous envoie le lien.',
  );
  return true;
}

async function traiterMessage(update: TelegramUpdate): Promise<void> {
  const message = update.message!;
  const chatId = message.chat.id;

  try {
    await indiquerFrappe(chatId);

    const texte = await extraireTexte(message);
    if (!texte) return;

    // Un `/start <code>` est un enrôlement, pas une conversation : on le traite
    // à part et on s'arrête là.
    if (await traiterInvitation(chatId, texte)) return;

    const conciergerie = await store.conciergerieParChat(chatId);
    const fil = await store.historique(chatId);
    const messages = fil.map((m) => ({ role: m.role, content: m.contenu })) as any[];
    messages.push({ role: 'user', content: texte });

    await store.ajouterAuFil(chatId, conciergerie?.id ?? null, 'user', texte);

    const ctx: any = { chatId };
    const reponse = await repondre(messages, ctx);

    // On persiste les tours COMPLETS, blocs d'outils compris. Sans eux, le
    // modèle rejoue au message suivant des étapes déjà faites — et crée des
    // doublons chez Channex.
    const apres = await store.conciergerieParChat(chatId);
    for (const tour of reponse.tours) {
      await store.ajouterAuFil(chatId, apres?.id ?? null, tour.role as any, tour.content);
    }

    if (reponse.actionEnAttente) {
      await envoyerAvecBoutons(chatId, reponse.texte, [
        { libelle: '✅ Confirmer', donnee: `ok:${reponse.actionEnAttente.id}` },
        { libelle: '❌ Annuler', donnee: `non:${reponse.actionEnAttente.id}` },
      ]);
    } else {
      await envoyerMessage(chatId, reponse.texte);
    }
  } catch (err) {
    console.error('[telegram] erreur de traitement :', err);
    await envoyerMessage(
      chatId,
      "Je n'ai pas réussi à traiter ta demande. Réessaie dans un instant.",
    ).catch(() => undefined);
  }
}

/** Clic sur « Confirmer » ou « Annuler ». C'est ici, et seulement ici, qu'une
 *  écriture de calendrier part réellement vers les plateformes. */
async function traiterClic(update: TelegramUpdate): Promise<void> {
  const clic = update.callback_query!;
  const chatId = clic.message?.chat.id;
  if (!chatId) return;

  const [verdict, actionId] = (clic.data ?? '').split(':');

  try {
    await accuserClic(clic.id);
    if (clic.message?.message_id) await retirerBoutons(chatId, clic.message.message_id);

    if (verdict === 'non') {
      const refusee = await store.retirerAction(actionId!, 'refusee');
      await envoyerMessage(chatId, refusee ? "Annulé, je n'ai rien modifié." : 'Cette demande a déjà été traitée.');
      return;
    }

    const action = await store.retirerAction(actionId!, 'confirmee');
    if (!action) {
      await envoyerMessage(chatId, 'Cette demande a expiré ou a déjà été traitée. Redemande-la-moi.');
      return;
    }

    const resultat = await executerActionConfirmee(action.outil, {
      ...action.arguments,
      __chatId: String(chatId),
    });
    await store.journaliser(action.conciergerieId, String(chatId), action.outil, action.arguments, resultat);
    await envoyerMessage(chatId, resultat);
  } catch (err) {
    console.error('[telegram] erreur sur confirmation :', err);
    await envoyerMessage(chatId, "L'action a échoué. Rien n'a été modifié, à vérifier de ton côté.").catch(
      () => undefined,
    );
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
