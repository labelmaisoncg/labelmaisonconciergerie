import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { texteCacheAvant48h } from '../../../data/sejour';
import type { Logement } from '../../../data/types';

/** Message montré quand un champ du livret semble contenir un code d'accès. */
export const AVERTISSEMENT_CODE = 'Un code semble écrit ici : ce texte restera caché au voyageur jusqu’à 48 h avant l’arrivée.';

/**
 * Aide d'un champ montré dans le livret d'accueil : si le livret cachera ce
 * texte en entier jusqu'aux 48 h (code court près d'un mot d'accès, code de
 * l'accès, wifi), on le dit à la place de l'aide habituelle. Même règle que
 * la vue du voyageur (texteCacheAvant48h) ; un code seulement masqué
 * (« code 4821 ») ne cache pas le texte : pas d'avertissement.
 */
export function aideOuCode(texte: string | undefined, logement: Logement | undefined, aide?: ReactNode): ReactNode {
  return texteCacheAvant48h(texte, logement) ? (
    <span className="inline-flex items-start gap-1 font-medium text-(--lm-alerte)">
      <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
      {AVERTISSEMENT_CODE}
    </span>
  ) : (
    aide
  );
}
