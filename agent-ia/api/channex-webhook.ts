/**
 * Webhook Channex — réservations en temps réel.
 *
 * C'est ce flux qui transforme l'agent : sans lui, il répond quand on
 * l'interroge ; avec lui, il prévient de lui-même. Une annulation à 22 h et le
 * propriétaire l'apprend dans la seconde, avec le ménage du lendemain déjà
 * remis en question.
 *
 * Sécurité : le secret partagé est passé en query (`?cle=`), la seule méthode
 * dont on soit sûr qu'elle traverse la configuration de webhook de Channex.
 * Sans lui, n'importe qui connaissant l'URL peut fabriquer de fausses
 * réservations et déclencher des alertes.
 */

import { waitUntil } from '@vercel/functions';
import * as store from '../src/store.js';
import { envoyerMessage } from '../src/telegram.js';
import { enFrancais } from '../src/dates.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  const attendu = process.env.CHANNEX_WEBHOOK_SECRET;
  if (!attendu || String(req.query?.cle ?? '') !== attendu) {
    console.warn('[channex-webhook] secret invalide — rejeté.');
    return res.status(401).json({ ok: false });
  }

  let corps: any;
  try {
    corps = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(200).json({ ok: true });
  }

  // Channex attend un 200 rapide, comme Telegram.
  res.status(200).json({ ok: true });
  waitUntil(traiter(corps));
}

async function traiter(corps: any): Promise<void> {
  try {
    const evenement: string = corps?.event ?? corps?.type ?? '';
    const p = corps?.payload ?? corps?.data?.attributes ?? corps ?? {};
    const proprieteId: string | undefined = p.property_id;
    if (!proprieteId) {
      console.warn('[channex-webhook] événement sans property_id, ignoré :', evenement);
      return;
    }

    // Retrouver la conciergerie à partir du logement : le webhook ne dit pas
    // à qui appartient la propriété, c'est notre base qui le sait.
    const toutes = await store.toutesConciergeries();
    let cible: { c: (typeof toutes)[number]; l: store.Logement } | null = null;
    for (const c of toutes) {
      const logements = await store.logements(c.id);
      const l = logements.find((x) => x.channexPropertyId === proprieteId);
      if (l) {
        cible = { c, l };
        break;
      }
    }
    if (!cible) {
      console.warn(`[channex-webhook] propriété inconnue : ${proprieteId}`);
      return;
    }

    const proprietaire = cible.c.chatIds[0];
    if (!proprietaire) return;

    const voyageur = [p.customer?.name, p.customer?.surname].filter(Boolean).join(' ');
    const arrivee = p.arrival_date ? enFrancais(p.arrival_date) : '?';
    const depart = p.departure_date ? enFrancais(p.departure_date) : '?';
    const canal = p.ota_name ?? p.ota ?? 'plateforme';
    const montant = p.amount != null ? ` — ${p.amount} €` : '';

    const annulation = /cancel/i.test(evenement) || p.status === 'cancelled';
    const modification = /modif/i.test(evenement);

    const texte = annulation
      ? `Annulation — ${cible.l.nom}\n` +
        `${voyageur || 'Voyageur'}, du ${arrivee} au ${depart} (${canal}).\n` +
        `Le ménage du ${depart} n'a plus lieu d'être : dis-moi si je dois le retirer.`
      : modification
        ? `Réservation modifiée — ${cible.l.nom}\n` +
          `${voyageur || 'Voyageur'}, désormais du ${arrivee} au ${depart} (${canal}).`
        : `Nouvelle réservation — ${cible.l.nom}\n` +
          `${voyageur || 'Voyageur'}, du ${arrivee} au ${depart} (${canal})${montant}.\n` +
          `Ménage à prévoir le ${depart}.`;

    await envoyerMessage(proprietaire, texte);
    await store.journaliser(cible.c.id, proprietaire, `channex:${evenement}`, p, { notifie: true });
  } catch (err) {
    console.error('[channex-webhook] traitement échoué :', err);
  }
}
