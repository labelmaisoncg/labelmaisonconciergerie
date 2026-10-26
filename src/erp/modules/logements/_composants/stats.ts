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
import type { ErpDonnees, FicheLogement, Logement, Reservation } from '../../../data/types';

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

/** Champs de la fiche voyageur utilisés par l'agent IA, avec leur libellé. */
export const CHAMPS_FICHE: { cle: keyof FicheLogement; libelle: string }[] = [
  { cle: 'wifiNom', libelle: 'Nom du wifi' },
  { cle: 'wifiCode', libelle: 'Code wifi' },
  { cle: 'heureArrivee', libelle: 'Heure d’arrivée' },
  { cle: 'heureDepart', libelle: 'Heure de départ' },
  { cle: 'acces', libelle: 'Accès' },
  { cle: 'parking', libelle: 'Parking' },
  { cle: 'regles', libelle: 'Règles' },
  { cle: 'equipements', libelle: 'Équipements' },
];

/** Complétude de la fiche voyageur (0..1) et champs manquants. */
export function completudeFiche(f: FicheLogement): { ratio: number; manquants: string[] } {
  const manquants = CHAMPS_FICHE.filter(({ cle }) => {
    const v = f[cle] ?? '';
    return Array.isArray(v) ? v.length === 0 : !v.trim();
  }).map((c) => c.libelle);
  return { ratio: (CHAMPS_FICHE.length - manquants.length) / CHAMPS_FICHE.length, manquants };
}

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

/** Photos du logement : celles des plateformes, sinon la photo déposée par l'équipe. */
export function photosLogement(l: Logement): string[] {
  if (l.photos?.length) return l.photos;
  return l.photoUrl && /^https?:\/\//.test(l.photoUrl) ? [l.photoUrl] : [];
}
