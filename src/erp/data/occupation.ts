/**
 * Occupation : quels logements comptent, et combien de nuits.
 *
 * Règle (octobre 2026) : un logement compte sur une période s'il est actif,
 * OU s'il a des nuits réservées dans la période, quel que soit son statut.
 * Avant, seuls les logements « actifs » comptaient : une annonce que notre
 * service de connexion dit « inactive » est rangée « En pause » alors qu'elle
 * prend encore des réservations, et l'Accueil affichait 0 % d'occupation
 * avec des séjours réservés. Même règle partout : Accueil (data/selectors,
 * tableau-de-bord/calculs), connecteur Claude (cm-mcp) et contrôle
 * d'intégrité (anomalies).
 *
 * Module pur, imports de types seulement : il tourne aussi côté serveur.
 */
import type { DateISO, Id, Logement, Reservation } from './types';

/** Fenêtre [debut, fin[ en dates ISO. */
export interface FenetreOccupation {
  debut: DateISO;
  fin: DateISO;
}

const JOUR_MS = 86_400_000;
const enMs = (d: DateISO) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const ecart = (de: DateISO, a: DateISO) => Math.round((enMs(a) - enMs(de)) / JOUR_MS);

const active = (r: Reservation) => r.statut !== 'annulee';

/** Nuits d'un séjour comprises dans la fenêtre. */
export function nuitsDans(r: Pick<Reservation, 'arrivee' | 'depart'>, f: FenetreOccupation): number {
  const debut = r.arrivee > f.debut ? r.arrivee : f.debut;
  const fin = r.depart < f.fin ? r.depart : f.fin;
  return Math.max(0, ecart(debut, fin));
}

/** Logements qui comptent sur la période : actifs, ou avec des nuits réservées dedans. */
export function logementsEnLocation<L extends Pick<Logement, 'id' | 'statut'>>(logements: readonly L[], reservations: readonly Reservation[], f: FenetreOccupation): L[] {
  const avecNuits = new Set<Id>();
  for (const r of reservations) if (active(r) && nuitsDans(r, f) > 0) avecNuits.add(r.logementId);
  return logements.filter((l) => l.statut === 'actif' || avecNuits.has(l.id));
}

export interface MesureOccupation {
  /** Nuits réservées ÷ nuits des logements comptés (0..1). */
  taux: number;
  /** Logements comptés. */
  logements: number;
  nuitsVendues: number;
  nuitsDisponibles: number;
  /** Nuits réservées sur des logements inconnus (séjour rattaché à un logement absent). */
  nuitsOrphelines: number;
}

/** Occupation d'une période, avec la règle commune (logementsEnLocation). */
export function mesurerOccupation(logements: readonly Pick<Logement, 'id' | 'statut'>[], reservations: readonly Reservation[], f: FenetreOccupation): MesureOccupation {
  const comptes = logementsEnLocation(logements, reservations, f);
  const ids = new Set(comptes.map((l) => l.id));
  const connus = new Set(logements.map((l) => l.id));
  let nuitsVendues = 0;
  let nuitsOrphelines = 0;
  for (const r of reservations) {
    if (!active(r)) continue;
    const n = nuitsDans(r, f);
    if (!n) continue;
    if (ids.has(r.logementId)) nuitsVendues += n;
    else if (!connus.has(r.logementId)) nuitsOrphelines += n;
  }
  const nuitsDisponibles = comptes.length * Math.max(0, ecart(f.debut, f.fin));
  return { taux: nuitsDisponibles ? nuitsVendues / nuitsDisponibles : 0, logements: comptes.length, nuitsVendues, nuitsDisponibles, nuitsOrphelines };
}
