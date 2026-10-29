import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './Button';
import { useFenetre } from './useFenetre';

export interface ModalProps {
  ouvert: boolean;
  onFermer: () => void;
  titre: ReactNode;
  description?: ReactNode;
  pied?: ReactNode;
  taille?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
}

const TAILLES = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

/**
 * Pied d'une fenêtre, comme Airbnb : un filet dessus, l'action d'abandon
 * (« Annuler », bouton tertiaire souligné) à gauche, l'action principale à
 * droite ; 48 px de haut sur téléphone (erp.css, .lm-pied-fenetre).
 */
export const PIED_FENETRE = 'lm-pied-fenetre flex flex-wrap items-center justify-end gap-2 border-t border-(--lm-bord) px-5 py-3.5 sm:px-6 [&>*:first-child:not(:last-child)]:mr-auto';

/**
 * Fenêtre à la manière d'Airbnb : en-tête avec le bouton fermer rond à
 * gauche et le titre centré (16 px, 600), un filet dessous ; sur téléphone,
 * une feuille qui monte du bas, arrondie en haut.
 */
export function Modal({ ouvert, onFermer, titre, description, pied, taille = 'md', children }: ModalProps) {
  const ref = useFenetre<HTMLDivElement>(ouvert, onFermer);
  const titreId = useId();
  const descId = useId();
  if (!ouvert) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div aria-hidden className="lm-apparition absolute inset-0 bg-(--lm-voile)" onClick={onFermer} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'lm-feuille relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-(--lm-surface) shadow-(--lm-ombre-haute) outline-none sm:rounded-2xl',
          TAILLES[taille],
        )}
      >
        <div className="relative flex min-h-14 shrink-0 items-center justify-center border-b border-(--lm-bord) px-14 py-3">
          <IconButton label="Fermer" onClick={onFermer} size="sm" className="absolute top-1/2 left-3 -translate-y-1/2">
            <X />
          </IconButton>
          <h2 id={titreId} className="lm-titre text-center text-[16px] leading-snug text-(--lm-encre)">
            {titre}
          </h2>
        </div>
        {(description || children) && (
          <div className="lm-defilement overflow-y-auto px-5 py-5 sm:px-6">
            {description && (
              <p id={descId} className={cn('text-[14px] text-(--lm-encre-2)', children && 'mb-4')}>
                {description}
              </p>
            )}
            {children}
          </div>
        )}
        {pied && <div className={PIED_FENETRE}>{pied}</div>}
      </div>
    </div>
  );
}
