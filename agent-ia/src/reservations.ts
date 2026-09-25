/**
 * Réservations — alertes au propriétaire.
 *
 * Deux chemins mènent ici :
 *  - le webhook Repull (`api/repull-webhook.ts`), immédiat ;
 *  - le rattrapage du cron, toutes les 15 minutes, qui relit ce qui a changé
 *    chez Repull : un webhook peut se perdre, et une réservation passée sous
 *    silence, c'est un ménage oublié.
 *
 * Les deux calculent la même clé de version (`<id>@<updatedAt>`) : ce que l'un
 * a signalé, l'autre ne le resignale pas. Et on ne dérange le propriétaire que
 * pour ce qui compte — nouvelle réservation, dates changées, annulation — pas
 * pour une mise à jour de coordonnées ou de paiement.
 */

import * as repull from './repull.js';
import * as store from './store.js';
import { envoyerMessage } from './telegram.js';
import { aujourdhui, enFrancais } from './dates.js';

/** Clé d'une version précise de la réservation. */
export const cleDeVersion = (r: repull.Reservation): string | null => (r.majLe ? `${r.id}@${r.majLe}` : null);

/**
 * Traite une réservation telle que Repull la donne maintenant. `cle` identifie
 * la version (ou l'événement, à défaut). Rend true si le propriétaire a été
 * prévenu.
 */
export async function traiterReservation(r: repull.Reservation, cle: string): Promise<boolean> {
  if (await store.reservationDejaVue(cle)) return false;

  // Une demande en attente de l'hôte ou du paiement du voyageur n'est pas
  // encore une réservation : on ne la note pas, elle sera « nouvelle » le jour
  // où elle sera confirmée.
  if (/pending/i.test(r.statut)) return false;

  const cible = await store.logementParRepullId(r.logementId);
  if (!cible) {
    // Annonce qui n'appartient (encore) à aucune conciergerie : on la note
    // quand même, pour ne pas la relire à chaque passage.
    await store.marquerReservationVue({
      cle,
      bookingId: r.id,
      conciergerieId: null,
      logementId: null,
      statut: r.statut,
      arrivee: r.arrivee ?? null,
      depart: r.depart ?? null,
    });
    return false;
  }
  const { logement, conciergerie } = cible;

  const avant = await store.derniereVueReservation(r.id);
  const annulee = repull.estAnnulee(r);
  const dejaAnnulee = avant ? /cancel/i.test(avant.statut) : false;
  const datesChangees = avant ? avant.arrivee !== r.arrivee || avant.depart !== r.depart : false;

  const voyageur = r.voyageur || 'Voyageur';
  const arrivee = r.arrivee ? enFrancais(r.arrivee) : '?';
  const depart = r.depart ? enFrancais(r.depart) : '?';
  const montant = r.montant != null ? ` — ${r.montant} €` : '';

  // Garde-fous contre l'avalanche : quand un compte vient d'être connecté,
  // Repull importe tout son historique. Un séjour déjà terminé, ou une
  // réservation prise il y a plus de deux jours et jamais vue, n'est pas une
  // nouvelle : on la note sans rien dire.
  const passee = Boolean(r.depart && r.depart < aujourdhui());
  const recente = !r.reserveeLe || Date.now() - Date.parse(r.reserveeLe) < 2 * 86_400_000;

  let texte: string | null = null;
  if (passee || (!avant && !recente)) {
    texte = null;
  } else if (annulee) {
    if (!dejaAnnulee) {
      texte =
        `Annulation — ${logement.nom}\n` +
        `${voyageur}, du ${arrivee} au ${depart} (${r.canal}).\n` +
        `Le ménage du ${depart} n'a plus lieu d'être : dis-moi si je dois le retirer.`;
    }
  } else if (!avant || dejaAnnulee) {
    texte =
      `Nouvelle réservation — ${logement.nom}\n` +
      `${voyageur}, du ${arrivee} au ${depart} (${r.canal})${montant}` +
      (r.personnes ? `, ${r.personnes} pers.` : '') +
      `.\nMénage à prévoir le ${depart}.`;
  } else if (datesChangees) {
    texte =
      `Réservation modifiée — ${logement.nom}\n` +
      `${voyageur}, désormais du ${arrivee} au ${depart} (${r.canal}).` +
      (avant.depart !== r.depart && avant.depart ? `\nLe ménage passe du ${enFrancais(avant.depart)} au ${depart}.` : '');
  }

  let notifie = false;
  if (texte) {
    const proprietaire = await store.proprietaireDe(conciergerie.id);
    if (proprietaire) {
      await envoyerMessage(proprietaire, texte).catch(() => undefined);
      notifie = true;
    }
  }

  await store.marquerReservationVue({
    cle,
    bookingId: r.id,
    conciergerieId: conciergerie.id,
    logementId: logement.id,
    statut: r.statut,
    arrivee: r.arrivee ?? null,
    depart: r.depart ?? null,
  });
  if (notifie) {
    await store
      .journaliser(conciergerie.id, null, 'reservation', { id: r.id, statut: r.statut }, { notifie: true })
      .catch((err) => console.error('[reservations] journalisation impossible :', err));
  }
  return notifie;
}

/**
 * Rattrapage : tout ce qui a changé chez Repull depuis 35 minutes, toutes
 * conciergeries confondues, en une seule lecture paginée. La fenêtre déborde
 * volontairement la cadence du cron (15 min) : un passage raté est couvert par
 * le suivant.
 */
const FENETRE_MINUTES = 35;

export async function releverReservations(): Promise<{ lues: number; notifiees: number }> {
  let resas: repull.Reservation[];
  try {
    resas = await repull.modifieesDepuis(new Date(Date.now() - FENETRE_MINUTES * 60_000));
  } catch (err) {
    console.error('[reservations] lecture impossible :', err);
    return { lues: 0, notifiees: 0 };
  }

  let notifiees = 0;
  for (const r of resas) {
    const cle = cleDeVersion(r);
    if (!cle) continue;
    try {
      if (await traiterReservation(r, cle)) notifiees++;
    } catch (err) {
      console.error(`[reservations] réservation ${r.id} non traitée :`, err);
    }
  }
  return { lues: resas.length, notifiees };
}
