/**
 * Calculs propres à l'accueil : périodes comparées, séries des deux courbes.
 * Les indicateurs eux-mêmes viennent de data/selectors (jamais recalculés ici).
 */
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AUJOURDHUI, ajouterJours, debutMois, nombre } from '../../../data/format';
import {
  adr,
  fenetreJours,
  fenetreMois,
  logementsActifs,
  noteMoyenne,
  revenuNet,
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

/** Les quatre repères d'un channel manager (occupation, revenu, prix moyen par nuit, note). */
export interface MesuresPeriode {
  /** Nuits vendues ÷ nuits des logements actifs (0..1). */
  occupation: number;
  /** Versé par les plateformes (brut − commission), en centimes. */
  revenu: number;
  /** Prix moyen par nuit vendue, hors ménage, en centimes. */
  adr: number;
  note: number | undefined;
}

export function mesurer(d: ErpDonnees, f: Fenetre): MesuresPeriode {
  return {
    occupation: tauxOccupation(d.reservations, logementsActifs(d.logements), f),
    revenu: revenuNet(d.reservations, f),
    adr: adr(d.reservations, f),
    note: noteMoyenne(d.reservations, f),
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
  /** Versé par les plateformes ce mois-là (centimes). */
  revenu: number;
}

/** Les `n` derniers mois (mois en cours inclus), du plus ancien au plus récent. */
export function serieMensuelle(d: ErpDonnees, n = 12): PointMensuel[] {
  const debuts: string[] = [debutMois(AUJOURDHUI)];
  while (debuts.length < n) debuts.unshift(moisPrecedent(debuts[0]));
  return debuts.map((mois) => ({
    mois,
    libelle: format(parseISO(mois), 'MMM', { locale: fr }).replace('.', ''),
    revenu: revenuNet(d.reservations, fenetreMois(mois)),
  }));
}

export interface PointHebdo {
  debut: string;
  libelle: string;
  /** Occupation de la semaine (0..1). */
  occupation: number;
  /** Semaine qui commence aujourd'hui ou plus tard : réservations déjà prises. */
  aVenir: boolean;
}

/**
 * Occupation par semaine : `avant` semaines passées et `apres` à venir (la
 * semaine en cours compte comme à venir). Les semaines démarrent aujourd'hui,
 * de 7 en 7 jours.
 */
export function serieHebdo(d: ErpDonnees, avant = 8, apres = 8): PointHebdo[] {
  const actifs = logementsActifs(d.logements);
  const res: PointHebdo[] = [];
  for (let i = -avant; i < apres; i++) {
    const debut = ajouterJours(AUJOURDHUI, i * 7);
    res.push({
      debut,
      libelle: format(parseISO(debut), 'd MMM', { locale: fr }).replace('.', ''),
      occupation: tauxOccupation(d.reservations, actifs, { debut, fin: ajouterJours(debut, 7) }),
      aVenir: i >= 0,
    });
  }
  return res;
}
