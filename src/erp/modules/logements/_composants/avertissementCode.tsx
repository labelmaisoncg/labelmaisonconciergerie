import type { ReactNode } from 'react';
import { codeProbable } from '../../../data/sejour';

/** Message montré quand un champ du livret semble contenir un code d'accès. */
export const AVERTISSEMENT_CODE = 'Un code semble écrit ici : ce texte restera caché au voyageur jusqu’à 48 h avant l’arrivée.';

/**
 * Aide d'un champ montré dans le livret d'accueil : si un code y semble écrit
 * (« Portail : 482 », « boîte B7Z »), le livret cache tout le texte jusqu'aux
 * 48 h avant l'arrivée. On le dit à la place de l'aide habituelle.
 */
export function aideOuCode(texte: string | undefined, aide?: ReactNode): ReactNode {
  return codeProbable(texte) ? <span className="font-medium text-(--lm-alerte)">{AVERTISSEMENT_CODE}</span> : aide;
}
