import { placerLogement } from '../../../carte/placer';
import { couleurLibre, teinteConnue } from '../../../data/couleurs-logement';
import { aPlacerSurCarte } from '../../../data/creation-logement';
import type { ErpContexte } from '../../../data/store';
import type { Logement } from '../../../data/types';

/**
 * Enregistre un logement (formulaire ou assistant : une ligne « Création » ou
 * « Modification » au journal), puis le place sur la carte s'il le faut
 * (gérant seulement, jamais à chaque frappe : une fois, après l'enregistrement).
 * Un nouveau logement reçoit sa couleur une fois pour toutes, la moins portée
 * du parc (data/couleurs-logement.ts) : elle ne bougera plus d'elle-même.
 */
export function enregistrerLogement(d: Pick<ErpContexte, 'upsert' | 'mettreAJour' | 'utilisateur' | 'lectureSeule' | 'logements'>, logement: Logement): void {
  const nouveau = !d.logements.some((x) => x.id === logement.id);
  const l = nouveau && !teinteConnue(logement.couleur) ? { ...logement, couleur: couleurLibre(d.logements) } : logement;
  d.upsert('logements', l);
  if (aPlacerSurCarte(l, d.utilisateur.role, d.lectureSeule)) void placerLogement(l, d.mettreAJour);
}
