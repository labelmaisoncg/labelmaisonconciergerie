/**
 * Prévisionnel (A14) : occupation et revenu des 30, 60 et 90 prochains
 * jours, par logement et pour tout le parc.
 *
 * Méthode (une ligne à l'écran) : déjà réservé, plus les nuits encore
 * libres multipliées par leur chance d'être réservées selon le délai, au
 * rythme habituel du logement.
 * - Chance d'une nuit libre à J jours : occ × (1 − c(J)) ÷ (1 − occ × c(J)),
 *   où occ est l'occupation du logement sur 90 jours et c(J) la part des
 *   réservations d'habitude déjà prises à ce délai (COURBE_REMPLISSAGE).
 * - Revenu d'une nuit projetée : revenu moyen versé par nuit vendue sur
 *   365 jours (payé par le voyageur, moins la commission de la plateforme).
 * - Nuits fermées par le propriétaire (lues sur les plateformes) : ni
 *   disponibles, ni projetées.
 * Sans historique suffisant (10 nuits vendues sur 365 jours), seul le
 * déjà réservé compte.
 *
 * Module pur ; imports en « .js » : il tourne aussi côté serveur.
 */
import { REGLES_PRIX, ecartJours, partDejaReservee, plusJours, profilPrix } from './prix-conseils.js';
import type { Centimes, DateISO, Id, Logement, Reservation } from './types';

export const HORIZONS_PREVISION = [30, 60, 90] as const;
export type HorizonPrevision = (typeof HORIZONS_PREVISION)[number];

export const METHODE_PREVISION = 'Déjà réservé, plus les nuits libres au rythme habituel de réservation.';

export interface Prevision {
  jours: HorizonPrevision;
  nuitsDisponibles: number;
  nuitsReservees: number;
  /** Nuits libres attendues en plus (projection, peut être décimal). */
  nuitsProjetees: number;
  /** Déjà réservé ÷ disponible (0..1). */
  occupationReservee: number;
  /** (Déjà réservé + projeté) ÷ disponible (0..1). */
  occupation: number;
  /** Versé par les plateformes sur les séjours déjà réservés (au prorata des nuits). */
  revenuReserve: Centimes;
  /** Revenu réservé + nuits projetées × revenu moyen par nuit. */
  revenu: Centimes;
}

export interface Previsionnel {
  horizons: Prevision[];
  /** La projection a pu être faite (historique suffisant) pour au moins un logement. */
  projection: boolean;
}

const active = (r: Reservation) => r.statut !== 'annulee';

/** Chance qu'une nuit encore libre à `delai` jours soit réservée, pour une occupation habituelle `occ`. */
export function chanceReservation(occ: number, delai: number): number {
  const c = partDejaReservee(delai);
  const deja = occ * c;
  if (deja >= 1) return 0;
  return Math.min(1, Math.max(0, (occ * (1 - c)) / (1 - deja)));
}

/** Logement suivi sur les 90 prochains jours : actif, ou déjà réservé. */
function enLocationAVenir(l: Logement, resas: readonly Reservation[], aujourdhui: DateISO): boolean {
  if (l.statut === 'sorti') return false;
  const fin = plusJours(aujourdhui, 90);
  return l.statut === 'actif' || resas.some((r) => r.depart > aujourdhui && r.arrivee < fin);
}

function prevoirLogement(l: Logement, resas: readonly Reservation[], aujourdhui: DateISO): { horizons: Prevision[]; projection: boolean } {
  const profil = profilPrix(l.id, resas, aujourdhui);
  const projection = profil.nuitsVendues >= REGLES_PRIX.nuitsHistoriqueMin && (profil.occupation ?? 0) > 0;
  // Revenu moyen versé par nuit vendue, 365 derniers jours.
  const depuis = plusJours(aujourdhui, -365);
  let verse = 0;
  let nuits = 0;
  for (const r of resas) {
    if (r.depart <= depuis || r.arrivee >= aujourdhui || !r.nuits) continue;
    verse += r.montantBrutCentimes - r.commissionPlateformeCentimes;
    nuits += r.nuits;
  }
  const parNuit = nuits ? verse / nuits : 0;
  const fermees = new Set((l.tarifs?.jours ?? []).filter((j) => j.libre === false).map((j) => j.date));
  const horizons = HORIZONS_PREVISION.map((jours): Prevision => {
    const fin = plusJours(aujourdhui, jours);
    let dispo = 0;
    let reservees = 0;
    let projetees = 0;
    for (let d = aujourdhui; d < fin; d = plusJours(d, 1)) {
      const reservee = resas.some((r) => r.arrivee <= d && d < r.depart);
      if (reservee) {
        reservees++;
        dispo++;
      } else if (!fermees.has(d)) {
        dispo++;
        if (projection) projetees += chanceReservation(profil.occupation!, ecartJours(aujourdhui, d));
      }
    }
    const revenuReserve = Math.round(
      resas.reduce((s, r) => {
        if (!r.nuits) return s;
        const a = r.arrivee > aujourdhui ? r.arrivee : aujourdhui;
        const b = r.depart < fin ? r.depart : fin;
        const n = Math.max(0, ecartJours(a, b));
        return s + ((r.montantBrutCentimes - r.commissionPlateformeCentimes) * n) / r.nuits;
      }, 0),
    );
    return {
      jours,
      nuitsDisponibles: dispo,
      nuitsReservees: reservees,
      nuitsProjetees: Math.round(projetees * 10) / 10,
      occupationReservee: dispo ? reservees / dispo : 0,
      occupation: dispo ? Math.min(1, (reservees + projetees) / dispo) : 0,
      revenuReserve,
      revenu: Math.round(revenuReserve + projetees * parNuit),
    };
  });
  return { horizons, projection };
}

/** Prévisionnel d'un logement (undefined : rien à montrer — pas en location, ni réservé, ni projetable). */
export function previsionLogement(l: Logement, reservations: readonly Reservation[], aujourdhui: DateISO): Previsionnel | undefined {
  const resas = reservations.filter((r) => r.logementId === l.id && active(r));
  if (!enLocationAVenir(l, resas, aujourdhui)) return undefined;
  const p = prevoirLogement(l, resas, aujourdhui);
  return p.horizons.some((h) => h.nuitsReservees > 0 || h.nuitsProjetees > 0) ? p : undefined;
}

/** Prévisionnel du parc : somme des logements suivis (undefined sans donnée). */
export function previsionParc(logements: readonly Logement[], reservations: readonly Reservation[], aujourdhui: DateISO): Previsionnel | undefined {
  const parLogement = new Map<Id, Reservation[]>();
  for (const r of reservations) if (active(r)) parLogement.set(r.logementId, [...(parLogement.get(r.logementId) ?? []), r]);
  const parts = logements
    .filter((l) => enLocationAVenir(l, parLogement.get(l.id) ?? [], aujourdhui))
    .map((l) => prevoirLogement(l, parLogement.get(l.id) ?? [], aujourdhui));
  if (!parts.length) return undefined;
  const horizons = HORIZONS_PREVISION.map((jours, i): Prevision => {
    const h = parts.map((p) => p.horizons[i]);
    const somme = (k: 'nuitsDisponibles' | 'nuitsReservees' | 'nuitsProjetees' | 'revenuReserve' | 'revenu') => h.reduce((s, x) => s + x[k], 0);
    const dispo = somme('nuitsDisponibles');
    return {
      jours,
      nuitsDisponibles: dispo,
      nuitsReservees: somme('nuitsReservees'),
      nuitsProjetees: Math.round(somme('nuitsProjetees') * 10) / 10,
      occupationReservee: dispo ? somme('nuitsReservees') / dispo : 0,
      occupation: dispo ? Math.min(1, (somme('nuitsReservees') + somme('nuitsProjetees')) / dispo) : 0,
      revenuReserve: somme('revenuReserve'),
      revenu: somme('revenu'),
    };
  });
  if (!horizons.some((x) => x.nuitsReservees > 0 || x.nuitsProjetees > 0)) return undefined;
  return { horizons, projection: parts.some((p) => p.projection) };
}
