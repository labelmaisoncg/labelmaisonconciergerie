/** Indicateurs par logement, calculés à partir des sélecteurs partagés. */
import { AUJOURDHUI, ajouterJours } from '../../../data/format';
import {
  adr,
  commissionLabelMaison,
  estActive,
  fenetreJours,
  noteMoyenne,
  revenuBrut,
  sejourEnCours,
  tauxOccupation,
} from '../../../data/selectors';
import type { ErpDonnees, Logement, Reservation } from '../../../data/types';

export interface StatsLogement {
  occupation30: number;
  occupation90: number;
  revenu30: number;
  revenu90: number;
  commission30: number;
  commission90: number;
  note?: number;
  /** Prix moyen par nuit constaté sur les séjours des 90 derniers jours (hors ménage), 0 sans séjour. */
  adr90: number;
  prochaineArrivee?: Reservation;
  enCours?: Reservation;
}

export function statsLogement(d: Pick<ErpDonnees, 'reservations' | 'mandats'>, l: Logement): StatsLogement {
  const resas = d.reservations.filter((r) => r.logementId === l.id);
  const f30 = fenetreJours(30);
  const f90 = fenetreJours(90);
  const prochaineArrivee = resas
    .filter((r) => estActive(r) && r.arrivee >= AUJOURDHUI)
    .sort((a, b) => a.arrivee.localeCompare(b.arrivee))[0];
  return {
    occupation30: tauxOccupation(resas, [l], f30),
    occupation90: tauxOccupation(resas, [l], f90),
    revenu30: revenuBrut(resas, f30),
    revenu90: revenuBrut(resas, f90),
    commission30: commissionLabelMaison(resas, d.mandats, f30),
    commission90: commissionLabelMaison(resas, d.mandats, f90),
    note: noteMoyenne(resas, fenetreJours(365)),
    adr90: adr(resas, f90),
    prochaineArrivee,
    enCours: sejourEnCours(resas, l.id),
  };
}

// Fiche voyageur lue par l'agent IA : règle partagée avec le serveur (briefing du matin).
export { CHAMPS_FICHE, completudeFiche } from '../../../data/fiche-agent';

/** Prix par nuit des `jours` prochains jours, lus sur les plateformes (undefined sans lecture). */
export function prixAVenir(l: Logement, jours = 30, aujourdhui = AUJOURDHUI): { moyen: number; min: number; max: number; luLe: string } | undefined {
  const fin = ajouterJours(aujourdhui, jours);
  const prix = (l.tarifs?.jours ?? []).filter((j) => j.date >= aujourdhui && j.date < fin && j.prixCentimes > 0).map((j) => j.prixCentimes);
  if (!prix.length || !l.tarifs) return undefined;
  return {
    moyen: Math.round(prix.reduce((a, b) => a + b, 0) / prix.length),
    min: Math.min(...prix),
    max: Math.max(...prix),
    luLe: l.tarifs.luLe,
  };
}

export interface PrixNuit {
  centimes: number;
  /** Ce soir ou prochaine nuit (lus sur les plateformes), prix de base de l'annonce, ou moyenne constatée. */
  source: 'soir' | 'prochaine' | 'base' | 'constate';
  date?: string;
  luLe?: string;
}

/**
 * Prix de la nuit, d'un coup d'œil : celui de ce soir lu sur les plateformes
 * (sinon de la prochaine nuit connue), sinon le prix de base de l'annonce,
 * sinon le prix moyen réellement encaissé par nuit sur les séjours des 90
 * derniers jours (`adr90`, hors ménage).
 */
export function prixNuit(l: Logement, o: { adr90?: number; aujourdhui?: string } = {}): PrixNuit | undefined {
  const aujourdhui = o.aujourdhui ?? AUJOURDHUI;
  const j = (l.tarifs?.jours ?? []).find((x) => x.date >= aujourdhui && x.prixCentimes > 0);
  if (j && l.tarifs) return { centimes: j.prixCentimes, source: j.date === aujourdhui ? 'soir' : 'prochaine', date: j.date, luLe: l.tarifs.luLe };
  const base = l.descriptif?.prix?.nuit;
  if (base) return { centimes: base, source: 'base' };
  return o.adr90 && o.adr90 > 0 ? { centimes: o.adr90, source: 'constate' } : undefined;
}

/**
 * Photos du logement : d'abord celles de l'équipe (dans l'ordre choisi, la
 * première est la couverture ; une ancienne photo déposée « stockage:// »
 * compte aussi), puis celles des plateformes, sinon leur photo de couverture.
 * Sans doublon.
 */
export function photosLogement(l: Logement): string[] {
  const equipe = [...(l.photosEquipe ?? [])];
  if (l.photoUrl?.startsWith('stockage://') && !equipe.includes(l.photoUrl)) equipe.push(l.photoUrl);
  const plateformes = l.photos?.length ? l.photos : l.photoUrl && /^https?:\/\//.test(l.photoUrl) ? [l.photoUrl] : [];
  return [...new Set([...equipe, ...plateformes])];
}
