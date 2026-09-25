/**
 * Calculs propres au tableau de bord : périodes comparées, séries mensuelles.
 * Les indicateurs eux-mêmes viennent de data/selectors (jamais recalculés ici).
 */
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AUJOURDHUI, ajouterJours, debutMois, nombre } from '../../../data/format';
import {
  adr,
  commissionLabelMaison,
  fenetreJours,
  fenetreMois,
  logementsActifs,
  noteMoyenne,
  revenuBrut,
  revpar,
  tauxMissionsValideesAvecPhotos,
  nbMenagesPasses,
  nuitsVendues,
  tauxOccupation,
  type Fenetre,
} from '../../../data/selectors';
import type { ErpDonnees } from '../../../data/types';
import type { Delta } from '../../../ui';

export type CleHorizon = '30j' | 'mois' | '90j';

export const HORIZONS: { cle: CleHorizon; libelle: string; comparaison: string }[] = [
  { cle: '30j', libelle: '30 j', comparaison: 'vs 30 j précédents' },
  { cle: 'mois', libelle: 'Mois en cours', comparaison: 'vs mois précédent' },
  { cle: '90j', libelle: '90 j', comparaison: 'vs 90 j précédents' },
];

/** Mois précédant celui de `date` (premier jour). */
export function moisPrecedent(date: string): string {
  return debutMois(ajouterJours(debutMois(date), -1));
}

export function fenetresHorizon(h: CleHorizon): { courante: Fenetre; precedente: Fenetre } {
  if (h === 'mois') return { courante: fenetreMois(AUJOURDHUI), precedente: fenetreMois(moisPrecedent(AUJOURDHUI)) };
  const n = h === '30j' ? 30 : 90;
  return { courante: fenetreJours(n), precedente: fenetreJours(n, ajouterJours(AUJOURDHUI, -n)) };
}

export interface MesuresPeriode {
  occupation: number;
  revenuBrut: number;
  commission: number;
  adr: number;
  revpar: number;
  note: number | undefined;
  missionsValidees: number;
  /** Ménages passés sur la période (0 : taux sans objet). */
  menagesPasses: number;
  /** Nuits vendues sur la période (0 : prix moyen sans objet). */
  nuits: number;
}

export function mesurer(d: ErpDonnees, f: Fenetre): MesuresPeriode {
  const actifs = logementsActifs(d.logements);
  return {
    occupation: tauxOccupation(d.reservations, actifs, f),
    revenuBrut: revenuBrut(d.reservations, f),
    commission: commissionLabelMaison(d.reservations, d.mandats, f),
    adr: adr(d.reservations, f),
    revpar: revpar(d.reservations, actifs, f),
    note: noteMoyenne(d.reservations, f),
    missionsValidees: tauxMissionsValideesAvecPhotos(d.missions, f),
    menagesPasses: nbMenagesPasses(d.missions, f),
    nuits: nuitsVendues(d.reservations, f),
  };
}

type Mode = 'euros' | 'points' | 'note';

/** Variation formatée entre deux valeurs, pour le composant Stat. */
export function variation(
  courant: number | undefined,
  precedent: number | undefined,
  mode: Mode,
  libelle: string,
): Delta | undefined {
  if (courant === undefined || precedent === undefined) return undefined;
  let ecart: number;
  let texte: string;
  if (mode === 'points') {
    ecart = Math.round((courant - precedent) * 100);
    texte = `${ecart > 0 ? '+' : ''}${nombre(ecart)} pts`;
  } else if (mode === 'note') {
    ecart = Math.round((courant - precedent) * 10) / 10;
    texte = `${ecart > 0 ? '+' : ''}${nombre(ecart, 1)}`;
  } else {
    if (!precedent) return undefined;
    ecart = Math.round(((courant - precedent) / precedent) * 100);
    texte = `${ecart > 0 ? '+' : ''}${nombre(ecart)} %`;
  }
  const sens = ecart > 0 ? 'hausse' : ecart < 0 ? 'baisse' : 'stable';
  return { valeur: texte, sens, favorable: ecart > 0, libelle };
}

export interface PointMensuel {
  mois: string;
  libelle: string;
  revenuBrut: number;
  commission: number;
  note: number | undefined;
}

/** Les `n` derniers mois (mois en cours inclus), du plus ancien au plus récent. */
export function serieMensuelle(d: ErpDonnees, n = 6): PointMensuel[] {
  const debuts: string[] = [debutMois(AUJOURDHUI)];
  while (debuts.length < n) debuts.unshift(moisPrecedent(debuts[0]));
  return debuts.map((mois) => {
    const f = fenetreMois(mois);
    return {
      mois,
      libelle: format(parseISO(mois), 'MMM', { locale: fr }).replace('.', ''),
      revenuBrut: revenuBrut(d.reservations, f),
      commission: commissionLabelMaison(d.reservations, d.mandats, f),
      note: noteMoyenne(d.reservations, f),
    };
  });
}
