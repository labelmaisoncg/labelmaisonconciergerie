/**
 * Calendrier mensuel de l'ERP (module Réservations, vue « Mois ») : un mois
 * d'un logement calculé sur les réservations du store, pour le composant
 * partagé src/erp/calendrier. Même grille de jours que l'espace
 * propriétaire (calendrierMois, sans borne de période : aucun jour « hors »),
 * mais les séjours gardent l'identifiant de la réservation et le nom complet
 * du voyageur : l'équipe voit les noms. Lecture seule, rien ne part vers
 * Repull. Vérifié par verifier-calendrier.ts.
 */
import type { MoisCalendrier, SejourCalendrier } from '../calendrier/calendrier-mois';
import { calendrierMois, ecartJoursISO, moisSuivant, moisValide } from './proprietaire';
import type { Id, Reservation } from './types';

export function calendrierMoisReservations(reservations: readonly Reservation[], logementId: Id, mois: string): MoisCalendrier {
  // Les jours (nuits réservées, arrivées, départs, chiffres) : la même règle que l'espace propriétaire.
  const base = calendrierMois(reservations, logementId, mois);
  if (!moisValide(mois)) return { mois, ...base, sejours: [] };
  const debut = `${mois}-01`;
  const fin = `${moisSuivant(mois)}-01`;
  const sejours: SejourCalendrier[] = reservations
    .filter((r) => r && r.logementId === logementId && r.statut !== 'annulee' && typeof r.arrivee === 'string' && typeof r.depart === 'string' && r.arrivee < r.depart)
    .filter((r) => r.arrivee < fin && r.depart > debut)
    .sort((a, b) => a.arrivee.localeCompare(b.arrivee))
    .map((r) => ({
      id: r.id,
      arrivee: r.arrivee,
      depart: r.depart,
      nuits: Math.max(1, ecartJoursISO(r.arrivee, r.depart)),
      voyageur: String(r.voyageur?.nom ?? '').replace(/\s+/g, ' ').trim() || 'Voyageur',
      nbPersonnes: Math.max(0, Math.round(Number(r.voyageur?.nbPersonnes) || 0)),
      canal: r.canal,
    }));
  return { mois, jours: base.jours, nuitsReservees: base.nuitsReservees, nuitsLibres: base.nuitsLibres, occupation: base.occupation, sejours };
}
