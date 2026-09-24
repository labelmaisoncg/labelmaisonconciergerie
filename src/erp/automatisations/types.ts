/**
 * Types du moteur d'automatisations. Pur TypeScript, sans React.
 */
import type { DateISO, ElementDe, ErpDonnees, Horodatage, Id, NomCollection } from '../data/types';

export type Declencheur = 'reservation' | 'mission' | 'quotidien' | 'mensuel' | 'document' | 'message' | 'logement';

/** Domaine d'une règle, dans l'ordre d'exécution du moteur. */
export type DomaineAuto = 'referentiel' | 'reservations' | 'operations' | 'prestataires' | 'finance' | 'pilotage';

export const ORDRE_DOMAINES: DomaineAuto[] = ['referentiel', 'reservations', 'operations', 'prestataires', 'finance', 'pilotage'];

export const LIBELLES_DOMAINES: Record<DomaineAuto, string> = {
  referentiel: 'Référentiel',
  reservations: 'Réservations',
  operations: 'Opérations',
  prestataires: 'Prestataires',
  finance: 'Finance',
  pilotage: 'Pilotage',
};

export type NiveauEvenement = 'info' | 'action' | 'alerte';

export interface EvenementAuto {
  /** Identifiant déterministe : le même constat produit le même id (dédoublonnage). */
  id: string;
  regle: string;
  horodatage: Horodatage;
  niveau: NiveauEvenement;
  message: string;
  entite: string;
  entiteId: Id;
}

/** Création ou remplacement complet d'un élément (upsert par id). */
export type Changement = {
  [C in NomCollection]: { collection: C; operation: 'creer' | 'modifier'; element: ElementDe<C>; resume: string };
}[NomCollection];

export interface ContexteAuto {
  /** Date du jour (AUJOURDHUI en démo). */
  date: DateISO;
  /** Horodatage courant (MAINTENANT en démo). */
  maintenant: Horodatage;
}

export interface ResultatRegle {
  changements: Changement[];
  evenements: EvenementAuto[];
}

export interface Regle {
  cle: string;
  nom: string;
  /** Langage clair : « Quand X, alors Y ». */
  description: string;
  /** Référence à la règle métier (SPEC §2.x). */
  spec?: string;
  domaine: DomaineAuto;
  declencheur: Declencheur;
  actifParDefaut: boolean;
  executer: (donnees: ErpDonnees, contexte: ContexteAuto) => ResultatRegle;
}
