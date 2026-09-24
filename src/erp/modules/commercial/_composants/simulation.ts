/** Estimation de revenus d'un bien pour le rendez-vous propriétaire. */
import type { Centimes, TypeLogement } from '../../../data/types';

export interface ParametresSimulation {
  ville: string;
  type: TypeLogement;
  capacite: number;
  prixNuitEuros: number;
  /** 0..100 */
  occupationPct: number;
  /** Frais de service de la plateforme côté hôte, 0..100. */
  plateformePct: number;
  /** Commission Label Maison proposée, 0..100. */
  commissionPct: number;
  dureeSejourNuits: number;
  fraisMenageEuros: number;
}

export interface ResultatSimulation {
  nuits: number;
  sejours: number;
  revenuBrut: Centimes;
  fraisPlateforme: Centimes;
  /** Base commissionnable : brut − frais plateforme. */
  base: Centimes;
  commission: Centimes;
  netProprietaire: Centimes;
  fraisMenageVoyageurs: Centimes;
}

export function simuler(p: ParametresSimulation, commissionPct = p.commissionPct): ResultatSimulation {
  const nuits = Math.round((365 * Math.min(100, Math.max(0, p.occupationPct))) / 100);
  const revenuBrut = Math.round(nuits * p.prixNuitEuros * 100);
  const fraisPlateforme = Math.round((revenuBrut * p.plateformePct) / 100);
  const base = revenuBrut - fraisPlateforme;
  const commission = Math.round((base * commissionPct) / 100);
  const sejours = p.dureeSejourNuits > 0 ? Math.round(nuits / p.dureeSejourNuits) : 0;
  return {
    nuits,
    sejours,
    revenuBrut,
    fraisPlateforme,
    base,
    commission,
    netProprietaire: base - commission,
    fraisMenageVoyageurs: Math.round(sejours * p.fraisMenageEuros * 100),
  };
}

export const PARAMETRES_DEFAUT: ParametresSimulation = {
  ville: 'Évry-Courcouronnes',
  type: 'T2',
  capacite: 4,
  prixNuitEuros: 75,
  occupationPct: 65,
  plateformePct: 15,
  commissionPct: 18,
  dureeSejourNuits: 3,
  fraisMenageEuros: 45,
};

/** Taux comparés : ancien barème, cible basse, cible haute (SPEC §2.9). */
export const TAUX_COMPARES = [10, 18, 20] as const;
