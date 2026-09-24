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

const TAILLES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

export function Modal({ ouvert, onFermer, titre, description, pied, taille = 'md', children }: ModalProps) {
  const ref = useFenetre<HTMLDivElement>(ouvert, onFermer);
  const titreId = useId();
  const descId = useId();
  if (!ouvert) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div aria-hidden className="lm-apparition absolute inset-0 bg-[rgba(20,17,14,0.4)]" onClick={onFermer} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'lm-apparition relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-(--lm-surface) shadow-(--lm-ombre-haute) outline-none sm:rounded-2xl',
          TAILLES[taille],
        )}
      >
        <div className="flex items-start gap-3 px-5 pt-4">
          <div className="min-w-0 flex-1">
            <h2 id={titreId} className="lm-serif text-[20px] text-(--lm-encre)">
              {titre}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-[13.5px] text-(--lm-encre-2)">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Fermer" onClick={onFermer} size="sm">
            <X />
          </IconButton>
        </div>
        {children && <div className="lm-defilement overflow-y-auto px-5 py-4">{children}</div>}
        {pied && <div className="flex flex-wrap justify-end gap-2 border-t border-(--lm-bord) px-5 py-3">{pied}</div>}
      </div>
    </div>
  );
}
