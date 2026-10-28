import { placerLogement } from '../../../carte/placer';
import { aPlacerSurCarte } from '../../../data/creation-logement';
import type { ErpContexte } from '../../../data/store';
import type { Logement } from '../../../data/types';

/**
 * Enregistre un logement (formulaire ou assistant : une ligne « Création » ou
 * « Modification » au journal), puis le place sur la carte s'il le faut
 * (gérant seulement, jamais à chaque frappe : une fois, après l'enregistrement).
 */
export function enregistrerLogement(d: Pick<ErpContexte, 'upsert' | 'mettreAJour' | 'utilisateur' | 'lectureSeule'>, l: Logement): void {
  d.upsert('logements', l);
  if (aPlacerSurCarte(l, d.utilisateur.role, d.lectureSeule)) void placerLogement(l, d.mettreAJour);
}
