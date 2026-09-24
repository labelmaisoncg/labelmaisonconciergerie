/**
 * Outils du module Réservations : couleurs de canal, chevauchements, statut
 * d'une nouvelle réservation. Les montants passent par data/selectors.
 */
import { AUJOURDHUI, ajouterJours, ecartJours } from '../../../data/format';
import { estActive } from '../../../data/selectors';
import type { CanalReservation, DateISO, Id, Reservation, StatutReservation } from '../../../data/types';

/** Couleur de barre par canal (toujours doublée du libellé dans la légende). */
export const COULEUR_CANAL: Record<CanalReservation, { fond: string; texte: string; bord: string }> = {
  airbnb: { fond: '#E9DCD6', texte: '#8A2F2A', bord: '#C0564D' },
  booking: { fond: '#DCE6F2', texte: '#1F4E82', bord: '#2B6CB0' },
  direct: { fond: '#F1E6CF', texte: '#5A4214', bord: '#A97C30' },
  autre: { fond: '#ECEAE6', texte: '#403A33', bord: '#8C857B' },
};

export const CANAUX: CanalReservation[] = ['airbnb', 'booking', 'direct', 'autre'];

/** Nuits (dates ISO) d'un séjour : arrivée incluse, départ exclu. */
export function nuitsDuSejour(arrivee: DateISO, depart: DateISO): DateISO[] {
  const n = Math.max(0, ecartJours(arrivee, depart));
  return Array.from({ length: n }, (_, i) => ajouterJours(arrivee, i));
}

export interface Conflit {
  reservation: Reservation;
  nuits: DateISO[];
}

/** Réservations non annulées du logement qui occupent au moins une des nuits demandées. */
export function conflits(
  reservations: Reservation[],
  logementId: Id,
  arrivee: DateISO,
  depart: DateISO,
  ignorerId?: Id,
): Conflit[] {
  const demandees = nuitsDuSejour(arrivee, depart);
  return reservations
    .filter((r) => r.logementId === logementId && estActive(r) && r.id !== ignorerId)
    .map((r) => ({ reservation: r, nuits: demandees.filter((n) => n >= r.arrivee && n < r.depart) }))
    .filter((c) => c.nuits.length > 0);
}

/** Statut d'un séjour selon AUJOURDHUI. */
export function statutSelonDates(arrivee: DateISO, depart: DateISO): StatutReservation {
  if (depart <= AUJOURDHUI) return 'terminee';
  if (arrivee <= AUJOURDHUI) return 'en_cours';
  return 'confirmee';
}
