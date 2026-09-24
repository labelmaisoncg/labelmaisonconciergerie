import { AUJOURDHUI, ajouterJours } from '../../../data/format';
import { estActive, mandatDuLogement, netProprietaire } from '../../../data/selectors';
import type { ErpDonnees, Id, Mandat, StatutMandat } from '../../../data/types';

/** Net reversé au propriétaire sur les séjours terminés ces 12 derniers mois. */
export function revenuNet12Mois(d: Pick<ErpDonnees, 'reservations' | 'mandats' | 'logements'>, proprietaireId: Id): number {
  const debut = ajouterJours(AUJOURDHUI, -365);
  const ids = new Set(d.logements.filter((l) => l.proprietaireId === proprietaireId).map((l) => l.id));
  return d.reservations
    .filter((r) => ids.has(r.logementId) && estActive(r) && r.depart >= debut && r.depart <= AUJOURDHUI)
    .reduce((s, r) => s + netProprietaire(r, mandatDuLogement(d.mandats, r.logementId)), 0);
}

const PRIORITE: StatutMandat[] = ['signe', 'envoye', 'brouillon', 'resilie'];

/** Statut de mandat le plus favorable d'un propriétaire (signé avant envoyé, etc.). */
export function statutMandatPrincipal(mandats: Mandat[], proprietaireId: Id): StatutMandat | undefined {
  const siens = mandats.filter((m) => m.proprietaireId === proprietaireId);
  return PRIORITE.find((s) => siens.some((m) => m.statut === s));
}
