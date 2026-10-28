/**
 * Fiche voyageur d'un logement, telle que l'agent IA la lit : champs
 * attendus et ce qui manque. Partagée par l'écran (logements, « À faire »)
 * et le serveur (briefing du matin) : module pur, sans dépendance.
 */
import type { FicheLogement } from './types';

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

/** Complétude de la fiche voyageur (0..1) et champs manquants (fiche absente : tout manque). */
export function completudeFiche(f: FicheLogement | undefined): { ratio: number; manquants: string[] } {
  const manquants = CHAMPS_FICHE.filter(({ cle }) => {
    const v = f?.[cle] ?? '';
    return Array.isArray(v) ? v.length === 0 : !String(v).trim();
  }).map((c) => c.libelle);
  return { ratio: (CHAMPS_FICHE.length - manquants.length) / CHAMPS_FICHE.length, manquants };
}
