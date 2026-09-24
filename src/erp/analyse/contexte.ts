/**
 * Références du parc (médianes, frais de structure) servant à comparer un
 * bien aux autres. Mis en cache par jeu de données et par date.
 */
import { fenetreJours, logementsActifs } from '../data/selectors';
import type { DateISO, ErpDonnees } from '../data/types';
import { borner, debutObservation, finances, mediane } from './calculs';
import type { ContexteParc } from './types';

const cache = new WeakMap<ErpDonnees, Map<DateISO, ContexteParc>>();

export function contexteParc(d: ErpDonnees, date: DateISO): ContexteParc {
  const parDate = cache.get(d) ?? new Map<DateISO, ContexteParc>();
  cache.set(d, parDate);
  const connu = parDate.get(date);
  if (connu) return connu;

  const actifs = logementsActifs(d.logements);
  const debutDonnees = d.reservations.reduce((min, r) => (r.arrivee < min ? r.arrivee : min), date);
  const f90 = fenetreJours(90, date);
  const structure90 = d.charges
    .filter((c) => !c.logementId && c.date >= f90.debut && c.date < f90.fin)
    .reduce((s, c) => s + c.montantCentimes, 0);
  const base: ContexteParc = {
    medianeAdr: 0,
    medianeRevpar: 0,
    medianeOccupation: 0,
    medianeMargeMois: 0,
    structureParJour: actifs.length ? structure90 / 90 / actifs.length : 0,
    debutDonnees,
  };
  const mesures = actifs
    .map((l) => finances(d, l, borner(f90, debutObservation(d, l, base)), base))
    .filter((f) => f.jours >= 30);
  const ctx: ContexteParc = {
    ...base,
    medianeOccupation: mediane(mesures.map((f) => f.nuits / f.jours)),
    medianeAdr: Math.round(mediane(mesures.filter((f) => f.nuits).map((f) => f.revenuHebergement / f.nuits))),
    medianeRevpar: Math.round(mediane(mesures.map((f) => f.revenuHebergement / f.jours))),
    medianeMargeMois: Math.round(mediane(mesures.map((f) => (f.marge * 30) / f.jours))),
  };
  parDate.set(date, ctx);
  return ctx;
}
