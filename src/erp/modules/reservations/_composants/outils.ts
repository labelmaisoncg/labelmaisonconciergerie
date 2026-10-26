/**
 * Outils du module Réservations : teintes de plateforme, état d'un séjour en
 * mots, plage de dates, chevauchements, statut d'une nouvelle réservation.
 * Les montants passent par data/selectors.
 */
import { AUJOURDHUI, ajouterJours, ecartJours, jourMois, pluriel } from '../../../data/format';
import { estActive } from '../../../data/selectors';
import type { CanalReservation, Centimes, DateISO, Id, Reservation, StatutReservation } from '../../../data/types';

/**
 * Teinte par plateforme, uniquement des jetons de la charte (jamais les
 * couleurs danger ou info) : `plein` pour un séjour à venir ou en cours,
 * `lavis` + `encre` pour un séjour passé. Toujours doublée d'un libellé.
 */
export const TEINTE_CANAL: Record<CanalReservation, { plein: string; texte: string; lavis: string; encre: string; lettre: string }> = {
  airbnb: { plein: 'var(--lm-encre)', texte: 'var(--lm-surface)', lavis: 'var(--lm-neutre-lavis)', encre: 'var(--lm-encre)', lettre: 'A' },
  booking: { plein: 'var(--lm-sarcelle)', texte: 'var(--lm-surface)', lavis: 'var(--lm-sarcelle-lavis)', encre: 'var(--lm-sarcelle)', lettre: 'B' },
  direct: { plein: 'var(--lm-or-texte)', texte: 'var(--lm-surface)', lavis: 'var(--lm-or-lavis)', encre: 'var(--lm-or-texte)', lettre: 'D' },
  autre: { plein: 'var(--lm-violet)', texte: 'var(--lm-surface)', lavis: 'var(--lm-violet-lavis)', encre: 'var(--lm-violet)', lettre: '·' },
};

export const CANAUX: CanalReservation[] = ['airbnb', 'booking', 'direct', 'autre'];

/** Ce que l'hôte reçoit de la plateforme : payé par le voyageur moins la commission de la plateforme. */
export function recu(r: Reservation): Centimes {
  return r.montantBrutCentimes - r.commissionPlateformeCentimes;
}

/** « 12–15 nov. », « 28 sept. – 3 oct. », avec l'année quand ce n'est pas l'année en cours. */
export function plageDates(arrivee: DateISO, depart: DateISO, reference: DateISO = AUJOURDHUI): string {
  const annee = depart.slice(0, 4) !== reference.slice(0, 4) ? ` ${depart.slice(0, 4)}` : '';
  if (arrivee.slice(0, 7) === depart.slice(0, 7)) return `${Number(arrivee.slice(8))}–${jourMois(depart)}${annee}`;
  return `${jourMois(arrivee)} – ${jourMois(depart)}${annee}`;
}

export type MomentSejour = 'a_venir' | 'en_cours' | 'passe' | 'annule';

/** Où en est le séjour : le jour du départ, le voyageur est encore « en cours » (il part dans la journée). */
export function momentSejour(r: Pick<Reservation, 'statut' | 'arrivee' | 'depart'>, aujourdhui: DateISO = AUJOURDHUI): MomentSejour {
  if (r.statut === 'annulee') return 'annule';
  if (r.arrivee > aujourdhui) return 'a_venir';
  if (r.depart >= aujourdhui) return 'en_cours';
  return 'passe';
}

/** L'état du séjour en quelques mots : « Arrive dans 3 j », « Sur place », « Part aujourd'hui », « Parti ». */
export function etatSejour(r: Pick<Reservation, 'statut' | 'arrivee' | 'depart'>, aujourdhui: DateISO = AUJOURDHUI): string {
  if (r.statut === 'annulee') return 'Annulé';
  const avant = ecartJours(aujourdhui, r.arrivee);
  if (avant > 1) return `Arrive dans ${avant} j`;
  if (avant === 1) return 'Arrive demain';
  if (avant === 0) return 'Arrive aujourd’hui';
  const reste = ecartJours(aujourdhui, r.depart);
  if (reste > 1) return 'Sur place';
  if (reste === 1) return 'Part demain';
  if (reste === 0) return 'Part aujourd’hui';
  return 'Parti';
}

/** « 3 nuits · 2 voyageurs » */
export function nuitsVoyageurs(r: Pick<Reservation, 'nuits' | 'voyageur'>): string {
  return `${pluriel(r.nuits, 'nuit')} · ${pluriel(r.voyageur.nbPersonnes, 'voyageur')}`;
}

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
