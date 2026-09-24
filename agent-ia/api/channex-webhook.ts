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
import * as channex from '../src/channex.js';
import { egalTempsConstant } from '../src/config.js';
import { envoyerMessage } from '../src/telegram.js';
import { enFrancais } from '../src/dates.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  const attendu = process.env.CHANNEX_WEBHOOK_SECRET;
  // Comparaison à temps constant, comme pour le secret Telegram.
  if (!egalTempsConstant(attendu, String(req.query?.cle ?? ''))) {
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

/**
 * ⚠️ NOMS DE CHAMPS À VÉRIFIER SUR LE STAGING CHANNEX. Selon la configuration
 * du webhook (option « send data »), un événement de réservation peut ne
 * porter que des identifiants — `property_id`, `booking_id`, `revision_id` —
 * sans voyageur ni dates. Dans ce cas on relit la réservation par son
 * identifiant (`channex.reservationParId`) avant de notifier.
 */
async function traiter(corps: any): Promise<void> {
  try {
    const evenement: string = corps?.event ?? corps?.type ?? '';
    const p = corps?.payload ?? corps?.data?.attributes ?? corps ?? {};
    const proprieteId: string | undefined = p.property_id ?? corps?.property_id;
    if (!proprieteId) {
      console.warn('[channex-webhook] événement sans property_id, ignoré :', evenement);
      return;
    }

    // Même révision déjà vue (webhook rejoué, ou déjà relevée par le flux de
    // rattrapage) : on ne renotifie pas.
    const revisionId: string | null = p.revision_id ?? p.booking_revision_id ?? null;
    if (revisionId && (await store.reservationDejaVue(revisionId))) return;

    // Retrouver la conciergerie à partir du logement : le webhook ne dit pas
    // à qui appartient la propriété, c'est notre base qui le sait.
    const cible = await store.logementParChannexId(proprieteId);
    if (!cible) {
      console.warn(`[channex-webhook] propriété inconnue : ${proprieteId}`);
      return;
    }
    const { logement, conciergerie } = cible;

    const proprietaire = await store.proprietaireDe(conciergerie.id);
    if (!proprietaire) return;

    // Charge utile réduite aux identifiants : on complète par la réservation.
    const bookingId: string | null = p.booking_id ?? null;
    let resa: channex.Reservation | null = null;
    if ((!p.arrival_date || !p.customer) && bookingId) {
      resa = await channex.reservationParId(String(bookingId));
    }

    const voyageur =
      [p.customer?.name, p.customer?.surname].filter(Boolean).join(' ') || resa?.voyageur || '';
    const dateArrivee: string | null = p.arrival_date ?? resa?.arrivee ?? null;
    const dateDepart: string | null = p.departure_date ?? resa?.depart ?? null;
    const arrivee = dateArrivee ? enFrancais(dateArrivee) : '?';
    const depart = dateDepart ? enFrancais(dateDepart) : '?';
    const canal = p.ota_name ?? p.ota ?? resa?.canal ?? 'plateforme';
    const somme = p.amount ?? resa?.montant;
    const montant = somme != null ? ` — ${somme} €` : '';
    const statut: string = p.status ?? resa?.statut ?? '';

    const annulation = /cancel/i.test(evenement) || /cancel/i.test(statut);
    const modification = /modif/i.test(evenement);

    const texte = annulation
      ? `Annulation — ${logement.nom}\n` +
        `${voyageur || 'Voyageur'}, du ${arrivee} au ${depart} (${canal}).\n` +
        `Le ménage du ${depart} n'a plus lieu d'être : dis-moi si je dois le retirer.`
      : modification
        ? `Réservation modifiée — ${logement.nom}\n` +
          `${voyageur || 'Voyageur'}, désormais du ${arrivee} au ${depart} (${canal}).`
        : `Nouvelle réservation — ${logement.nom}\n` +
          `${voyageur || 'Voyageur'}, du ${arrivee} au ${depart} (${canal})${montant}.\n` +
          `Ménage à prévoir le ${depart}.`;

    await envoyerMessage(proprietaire, texte);

    // Enregistrée : le flux de rattrapage l'acquittera sans la renotifier.
    if (revisionId) {
      await store.marquerReservationVue({
        revisionId,
        bookingId: bookingId ? String(bookingId) : null,
        conciergerieId: conciergerie.id,
        logementId: logement.id,
        statut: statut || evenement || 'inconnu',
        arrivee: dateArrivee,
        depart: dateDepart,
      });
    }
    await store.journaliser(conciergerie.id, proprietaire, `channex:${evenement}`, p, { notifie: true });
  } catch (err) {
    console.error('[channex-webhook] traitement échoué :', err);
  }
}
