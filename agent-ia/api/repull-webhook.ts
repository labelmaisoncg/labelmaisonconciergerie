/**
 * Webhook Repull — réservations, messages voyageurs et annonces en temps réel.
 *
 * C'est ce flux qui transforme l'agent : sans lui, il répond quand on
 * l'interroge ; avec lui, il prévient de lui-même. Une annulation à 22 h et le
 * propriétaire l'apprend dans la seconde, avec le ménage du lendemain déjà
 * remis en question ; une question de voyageur reçoit sa réponse sans
 * attendre le prochain passage du cron.
 *
 * Sécurité : chaque livraison est signée (en-tête `X-Repull-Signature`,
 * `t=<horodatage>,v1=<hex>`). On recalcule HMAC-SHA256(secret, `${t}.${corps brut}`)
 * avec le secret de l'abonnement (`REPULL_WEBHOOK_SECRET`), on compare à temps
 * constant, et on refuse un horodatage de plus de 5 minutes — sans quoi une
 * livraison capturée pourrait être rejouée. Sans cette vérification,
 * n'importe qui connaissant l'URL pourrait fabriquer de fausses réservations.
 */

import { createHmac } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { importerAnnonce } from '../src/comptes.js';
import { egalTempsConstant } from '../src/config.js';
import { traiterFilParId } from '../src/messagerie.js';
import * as repull from '../src/repull.js';
import { cleDeVersion, traiterReservation } from '../src/reservations.js';
import * as store from '../src/store.js';

/** La signature porte sur le corps EXACT reçu : pas question de le laisser parser. */
export const config = { api: { bodyParser: false } };

const TOLERANCE_S = 5 * 60;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  const brut = await corpsBrut(req);
  if (!signatureValide(brut, req.headers['x-repull-signature'], process.env.REPULL_WEBHOOK_SECRET)) {
    console.warn('[repull-webhook] signature invalide — rejeté.');
    return res.status(401).json({ ok: false });
  }

  let evenement: any;
  try {
    evenement = JSON.parse(brut);
  } catch {
    return res.status(200).json({ ok: true });
  }

  // Repull attend un 2xx rapide, sans quoi il retente : on accuse réception
  // tout de suite et on traite en tâche de fond.
  res.status(200).json({ ok: true });
  const idEvenement = String(req.headers['x-repull-event-id'] ?? evenement?.eventId ?? '');
  waitUntil(traiter(evenement, idEvenement));
}

/** Le corps tel qu'il a été signé, octet pour octet. */
async function corpsBrut(req: any): Promise<string> {
  const morceaux: Buffer[] = [];
  try {
    for await (const m of req) morceaux.push(typeof m === 'string' ? Buffer.from(m) : m);
  } catch {
    // Flux déjà consommé par l'environnement : on retombe sur `req.body`.
  }
  if (morceaux.length) return Buffer.concat(morceaux).toString('utf8');
  const b = req.body;
  if (Buffer.isBuffer(b)) return b.toString('utf8');
  if (typeof b === 'string') return b;
  // Corps déjà parsé : la signature ne correspondra sans doute pas, et c'est
  // voulu — mieux vaut refuser que valider un JSON reconstitué.
  return b ? JSON.stringify(b) : '';
}

export function signatureValide(brut: string, entete: unknown, secret: string | undefined): boolean {
  if (!secret) return false;
  const parties = new Map<string, string>();
  for (const morceau of String(entete ?? '').split(',')) {
    const i = morceau.indexOf('=');
    if (i > 0) parties.set(morceau.slice(0, i).trim(), morceau.slice(i + 1).trim());
  }
  const t = parties.get('t');
  const v1 = parties.get('v1');
  if (!t || !v1) return false;

  // Anti-rejeu : trop vieux, ou venu du futur.
  const age = Math.floor(Date.now() / 1000) - Number(t);
  if (!Number.isFinite(age) || Math.abs(age) > TOLERANCE_S) return false;

  const attendu = createHmac('sha256', secret).update(`${t}.${brut}`).digest('hex');
  return egalTempsConstant(attendu, v1);
}

async function traiter(evenement: any, idEvenement: string): Promise<void> {
  // Le nom de l'événement est dans `event` (pas `type`, malgré certains exemples).
  const nom: string = evenement?.event ?? evenement?.type ?? '';
  const donnees = evenement?.data ?? {};
  try {
    if (nom === 'reservation.created' || nom === 'reservation.updated' || nom === 'reservation.cancelled') {
      const instantane = donnees.object ?? {};
      if (instantane.id == null) return;
      // L'instantané du webhook est volontairement léger (ni voyageur ni
      // montant) : on relit la réservation complète. Sa version sert de clé,
      // la même que celle du rattrapage — rien n'est notifié deux fois.
      const complete = await repull.reservationParId(String(instantane.id));
      const resa: repull.Reservation = complete ?? {
        id: String(instantane.id),
        ref: String(instantane.uid ?? instantane.id),
        canal: instantane.channel ?? 'plateforme',
        logementId: String(instantane.listingId),
        arrivee: instantane.checkinDate,
        depart: instantane.checkoutDate,
        voyageur: null,
        personnes: null,
        montant: null,
        statut: nom === 'reservation.cancelled' ? 'cancelled' : String(instantane.status ?? 'confirmed'),
        majLe: null,
        reserveeLe: null,
      };
      const cle = cleDeVersion(resa) ?? `evt:${idEvenement}`;
      await traiterReservation(resa, cle);
      return;
    }

    if (nom === 'reservation.message.received') {
      // Seuls les messages du voyageur appellent une réponse.
      if (donnees.from?.type && donnees.from.type !== 'guest') return;
      if (donnees.threadId == null) return;
      await traiterFilParId(String(donnees.threadId));
      return;
    }

    if (nom === 'listing.created') {
      // Une annonce qui arrive d'un compte déjà rattaché : on crée le
      // logement tout de suite, sans attendre que la conciergerie demande.
      const annonce = donnees.object ?? {};
      const compte = evenement.account ?? {};
      const canal: repull.Canal | null =
        compte.provider === 'airbnb' ? 'airbnb' : /^booking/i.test(String(compte.provider ?? '')) ? 'booking' : null;
      if (!canal || !compte.externalAccountId || annonce.id == null) return;
      const proprietaire = (await store.comptesAttribues(canal)).get(String(compte.externalAccountId));
      if (!proprietaire) return;
      await importerAnnonce(proprietaire, {
        id: String(annonce.id),
        nom: annonce.name ?? 'Annonce à nommer',
        ville: annonce.address?.city ?? null,
      });
      return;
    }

    // Les autres événements (ping de test compris) sont acceptés et ignorés.
  } catch (err) {
    console.error(`[repull-webhook] traitement de ${nom || 'événement inconnu'} échoué :`, err);
  }
}
