/**
 * Types du moteur d'analyse des biens. Pur TypeScript, sans React.
 */
import type { Centimes, DateISO, Id, Logement, PorteurRecommandation } from '../data/types';
import type { CleKpi, NiveauKpi } from './seuils';

export type Recommandation = 'developper' | 'garder' | 'surveiller' | 'renegocier' | 'sortir';
export type GraviteDefaut = 'faible' | 'moyenne' | 'haute';
export type SourceDefaut =
  | 'reservations'
  | 'avis'
  | 'incidents'
  | 'linge'
  | 'mandat'
  | 'conformite'
  | 'finance'
  | 'operations'
  | 'messagerie';

export interface KpiBien {
  cle: CleKpi;
  libelle: string;
  /** Valeur brute (unité de SEUILS) ; undefined si pas assez de données. */
  valeur?: number;
  /** Valeur lisible, ex. « 72 % » ou « 84,00 € ». */
  affichage: string;
  /** Précision affichée sous la valeur, ex. « 38 avis » ou « médiane 79 € ». */
  detail?: string;
  niveau?: NiveauKpi;
  explication: string;
}

export interface Finances {
  /** Nombre de jours de la fenêtre où le bien était sous mandat. */
  jours: number;
  nuits: number;
  revenuBrut: Centimes;
  revenuHebergement: Centimes;
  commission: Centimes;
  fraisMenage: Centimes;
  /** Chiffre d'affaires Label Maison : commission + frais de ménage. */
  ca: Centimes;
  coutMenage: Centimes;
  charges: Centimes;
  coutIncidents: Centimes;
  /** Quote-part des frais de structure (logiciels, assurance, produits, transport). */
  structure: Centimes;
  marge: Centimes;
  sejours: number;
}

export interface MoisMarge {
  /** 'YYYY-MM' */
  mois: string;
  ca: Centimes;
  couts: Centimes;
  marge: Centimes;
  avecDonnees: boolean;
  /** Mois en cours, incomplet. */
  partiel: boolean;
}

export interface Defaut {
  code: string;
  gravite: GraviteDefaut;
  titre: string;
  detail: string;
  source: SourceDefaut;
}

export interface Amelioration {
  code: string;
  titre: string;
  pourquoi: string;
  impactEstime: { texte: string; centimesMois?: Centimes; sur?: 'revenu_bien' | 'marge_label_maison' };
  cout: 'faible' | 'moyen' | 'eleve';
  porteur: PorteurRecommandation;
  /** Défauts à l'origine de la suggestion. */
  defauts: string[];
}

export interface AnalyseBien {
  logement: Logement;
  date: DateISO;
  /** 90 derniers jours (ou depuis le début du mandat). */
  f90: Finances;
  /** 12 derniers mois, dans la limite des données disponibles. */
  f12: Finances;
  occupation90: number;
  adr90: Centimes;
  revpar90: Centimes;
  note12?: number;
  nbAvis12: number;
  margeMois: Centimes;
  margePct?: number;
  margeParNuit?: Centimes;
  commissionPct?: number;
  interventions12: { missions: number; incidents: number; controles: number };
  kpis: KpiBien[];
  mois: MoisMarge[];
  rentable: boolean;
  verdictRentabilite: string;
  defauts: Defaut[];
  recommandation: Recommandation;
  justification: string[];
  ameliorations: Amelioration[];
  /** Score 0-100 (voir parc.ts). Rempli par analyserParc. */
  score?: number;
}

export interface ContexteParc {
  medianeAdr: Centimes;
  medianeRevpar: Centimes;
  medianeOccupation: number;
  medianeMargeMois: Centimes;
  /** Frais de structure du parc par logement actif et par jour. */
  structureParJour: number;
  /** Date de la première réservation connue : avant, pas de données. */
  debutDonnees: DateISO;
}

export interface LigneParc {
  analyse: AnalyseBien;
  score: number;
  rang: number;
  proprietaireId: Id;
}
