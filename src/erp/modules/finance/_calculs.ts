/**
 * Calculs propres au module Finance, construits sur data/selectors.ts.
 *
 * Deux notions à ne jamais confondre :
 * - revenu brut géré : ce que paient les voyageurs, encaissé pour le compte
 *   des propriétaires. Ce n'est PAS le chiffre d'affaires de Label Maison ;
 * - chiffre d'affaires Label Maison : commissions de gestion + frais de ménage.
 */
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AUJOURDHUI, debutMois, debutMoisSuivant } from '../../data/format';
import {
  baseCommissionnable,
  commissionLabelMaison,
  commissionReservation,
  estActive,
  mandatDuLogement,
  nuitsDansFenetre,
  revenuBrut,
  type Fenetre,
} from '../../data/selectors';
import type { Centimes, ErpDonnees, Id, Mission } from '../../data/types';

export type Donnees = Pick<ErpDonnees, 'reservations' | 'mandats' | 'missions' | 'charges' | 'logements'>;

/** Périodes 'YYYY-MM' des n derniers mois, du plus ancien au mois courant. */
export function derniersMois(n = 12, date = AUJOURDHUI): string[] {
  const res: string[] = [];
  let [a, m] = date.slice(0, 7).split('-').map(Number);
  for (let i = 0; i < n; i++) {
    res.unshift(`${a}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      a -= 1;
    }
  }
  return res;
}

export function fenetrePeriode(periode: string): Fenetre {
  const debut = `${periode}-01`;
  return { debut, fin: debutMoisSuivant(debut) };
}

/** 12 mois glissants, mois courant inclus. */
export function fenetre12Mois(date = AUJOURDHUI): Fenetre {
  return { debut: `${derniersMois(12, date)[0]}-01`, fin: debutMoisSuivant(debutMois(date)) };
}

/** '2026-09' → « sept. 26 ». */
export const libelleMoisCourt = (periode: string) => format(parseISO(`${periode}-01`), 'MMM yy', { locale: fr });

const dansFenetre = (date: string, f: Fenetre) => date >= f.debut && date < f.fin;

/** Frais de ménage encaissés : séjours dont le départ tombe dans la fenêtre. */
export function fraisMenageEncaisses(d: Pick<Donnees, 'reservations'>, f: Fenetre, logementId?: Id): Centimes {
  return d.reservations
    .filter((r) => estActive(r) && dansFenetre(r.depart, f) && (!logementId || r.logementId === logementId))
    .reduce((s, r) => s + r.fraisMenageCentimes, 0);
}

/** Missions de ménage et de linge validées (seules payables : pas de validation, pas de paiement). */
export function missionsPayables(missions: Mission[], f: Fenetre, logementId?: Id): Mission[] {
  return missions.filter(
    (m) =>
      (m.type === 'menage' || m.type === 'linge') &&
      m.statut === 'validee' &&
      dansFenetre(m.date, f) &&
      (!logementId || m.logementId === logementId),
  );
}

export function coutMenage(d: Pick<Donnees, 'missions'>, f: Fenetre, logementId?: Id): Centimes {
  return missionsPayables(d.missions, f, logementId).reduce((s, m) => s + m.tarifCentimes, 0);
}

export function chargesFenetre(d: Pick<Donnees, 'charges'>, f: Fenetre, logementId?: Id): Centimes {
  return d.charges
    .filter((c) => dansFenetre(c.date, f) && (logementId === undefined || c.logementId === logementId))
    .reduce((s, c) => s + c.montantCentimes, 0);
}

/** Base commissionnable proratisée (pour le taux de commission effectif). */
export function baseFenetre(d: Pick<Donnees, 'reservations'>, f: Fenetre, logementId?: Id): Centimes {
  return d.reservations
    .filter((r) => estActive(r) && (!logementId || r.logementId === logementId))
    .reduce((s, r) => s + (r.nuits ? Math.round((baseCommissionnable(r) * nuitsDansFenetre(r, f)) / r.nuits) : 0), 0);
}

export interface Synthese {
  brut: Centimes;
  commission: Centimes;
  fraisMenage: Centimes;
  /** Chiffre d'affaires Label Maison = commission + frais de ménage. */
  ca: Centimes;
  coutMenage: Centimes;
  charges: Centimes;
  marge: Centimes;
  base: Centimes;
  /** Taux de commission effectif (0..1) sur la base commissionnable. */
  tauxEffectif: number;
}

export function synthese(d: Donnees, f: Fenetre): Synthese {
  const brut = revenuBrut(d.reservations, f);
  const commission = commissionLabelMaison(d.reservations, d.mandats, f);
  const fraisMenage = fraisMenageEncaisses(d, f);
  const cout = coutMenage(d, f);
  const charges = chargesFenetre(d, f);
  const base = baseFenetre(d, f);
  const ca = commission + fraisMenage;
  return {
    brut,
    commission,
    fraisMenage,
    ca,
    coutMenage: cout,
    charges,
    marge: ca - cout - charges,
    base,
    tauxEffectif: base ? commission / base : 0,
  };
}

export function serieMensuelle(d: Donnees, n = 12) {
  return derniersMois(n).map((p) => ({ periode: p, libelle: libelleMoisCourt(p), ...synthese(d, fenetrePeriode(p)) }));
}

export interface LigneRentabilite {
  logementId: Id;
  nom: string;
  statut: string;
  commissionPct?: number;
  brut: Centimes;
  commission: Centimes;
  fraisMenage: Centimes;
  coutMenage: Centimes;
  charges: Centimes;
  marge: Centimes;
  /** Marge / CA Label Maison (0..1). */
  tauxMarge: number;
}

export function rentabiliteParLogement(d: Donnees, f: Fenetre): LigneRentabilite[] {
  return d.logements.map((l) => {
    const mandat = mandatDuLogement(d.mandats, l.id);
    const resas = d.reservations.filter((r) => r.logementId === l.id && estActive(r));
    const commission = resas.reduce(
      (s, r) => s + (r.nuits ? Math.round((commissionReservation(r, mandat) * nuitsDansFenetre(r, f)) / r.nuits) : 0),
      0,
    );
    const fraisMenage = fraisMenageEncaisses(d, f, l.id);
    const cout = coutMenage(d, f, l.id);
    const charges = chargesFenetre(d, f, l.id);
    const ca = commission + fraisMenage;
    const marge = ca - cout - charges;
    return {
      logementId: l.id,
      nom: l.nom,
      statut: l.statut,
      commissionPct: mandat?.commissionPct,
      brut: revenuBrut(resas, f),
      commission,
      fraisMenage,
      coutMenage: cout,
      charges,
      marge,
      tauxMarge: ca ? marge / ca : 0,
    };
  });
}
