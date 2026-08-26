/**
 * Flux de réservations — la voie certifiée par Channex.
 *
 * Channex impose DEUX chemins complémentaires :
 *  - le webhook, immédiat, pour la réactivité ;
 *  - ce flux de rattrapage, toutes les 15 à 20 minutes, parce qu'un webhook
 *    peut échouer et qu'une réservation perdue est un surbooking.
 *
 * L'ACQUITTEMENT est obligatoire. Sans lui, Channex renvoie indéfiniment la
 * même réservation dans le flux — et la certification échoue.
 *
 * Un seul appel couvre TOUTES les propriétés. Interroger propriété par
 * propriété multiplie les requêtes, ce que la certification sanctionne
 * explicitement.
 */

import * as channex from './channex.js';
import * as store from './store.js';
import { envoyerMessage } from './telegram.js';
import { enFrancais } from './dates.js';

export async function releverReservations(): Promise<{
  lues: number;
  notifiees: number;
  acquittees: number;
}> {
  let lues = 0;
  let notifiees = 0;
  let acquittees = 0;

  let revisions: channex.RevisionReservation[] = [];
  try {
    revisions = await channex.fluxReservations();
  } catch (err) {
    console.error('[reservations] flux illisible :', err);
    return { lues: 0, notifiees: 0, acquittees: 0 };
  }

  for (const r of revisions) {
    lues++;

    // On acquitte TOUJOURS, même ce qu'on ne sait pas traiter : sinon la
    // révision revient à chaque passage et bloque le flux derrière elle.
    const acquitter = async () => {
      try {
        await channex.acquitterReservation(r.revisionId);
        acquittees++;
      } catch (err) {
        console.error(`[reservations] acquittement de ${r.revisionId} impossible :`, err);
      }
    };

    if (await store.reservationDejaVue(r.revisionId)) {
      await acquitter();
      continue;
    }

    const cible = r.proprieteId ? await store.logementParChannexId(r.proprieteId) : null;
    if (!cible) {
      console.warn(`[reservations] propriété inconnue : ${r.proprieteId}`);
      await store.marquerReservationVue({
        revisionId: r.revisionId,
        bookingId: r.bookingId,
        conciergerieId: null,
        logementId: null,
        statut: r.statut,
        arrivee: r.arrivee,
        depart: r.depart,
      });
      await acquitter();
      continue;
    }

    const { logement, conciergerie } = cible;
    const proprietaire = await store.proprietaireDe(conciergerie.id);

    if (proprietaire) {
      const annulee = /cancel/i.test(r.statut);
      const voyageur = r.voyageur || 'Voyageur';
      const arrivee = r.arrivee ? enFrancais(r.arrivee) : '?';
      const depart = r.depart ? enFrancais(r.depart) : '?';
      const montant = r.montant != null ? ` — ${r.montant} €` : '';

      const texte = annulee
        ? `Annulation — ${logement.nom}\n` +
          `${voyageur}, du ${arrivee} au ${depart} (${r.canal}).\n` +
          `Le ménage du ${depart} n'a plus lieu d'être : dis-moi si je dois le retirer.`
        : `Nouvelle réservation — ${logement.nom}\n` +
          `${voyageur}, du ${arrivee} au ${depart} (${r.canal})${montant}` +
          (r.personnes ? `, ${r.personnes} pers.` : '') +
          `.\nMénage à prévoir le ${depart}.`;

      await envoyerMessage(proprietaire, texte).catch(() => undefined);
      notifiees++;
    }

    await store.marquerReservationVue({
      revisionId: r.revisionId,
      bookingId: r.bookingId,
      conciergerieId: conciergerie.id,
      logementId: logement.id,
      statut: r.statut,
      arrivee: r.arrivee,
      depart: r.depart,
    });
    await acquitter();
  }

  return { lues, notifiees, acquittees };
}
