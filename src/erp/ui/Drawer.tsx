import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './Button';
import { useFenetre } from './useFenetre';

export interface DrawerProps {
  ouvert: boolean;
  onFermer: () => void;
  titre: ReactNode;
  sousTitre?: ReactNode;
  /** Boutons en pied de panneau. */
  pied?: ReactNode;
  /** Actions à côté du titre. */
  actions?: ReactNode;
  largeur?: 'md' | 'lg' | 'xl';
  children: ReactNode;
}

const LARGEURS = { md: 'sm:max-w-md', lg: 'sm:max-w-xl', xl: 'sm:max-w-3xl' };

/** Panneau latéral de détail, plein écran sur mobile. */
export function Drawer({ ouvert, onFermer, titre, sousTitre, pied, actions, largeur = 'lg', children }: DrawerProps) {
  const ref = useFenetre<HTMLDivElement>(ouvert, onFermer);
  const titreId = useId();
  if (!ouvert) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div aria-hidden className="lm-apparition absolute inset-0 bg-[rgba(20,17,14,0.32)]" onClick={onFermer} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        tabIndex={-1}
        className={cn('lm-tiroir relative flex h-full w-full flex-col bg-(--lm-surface) shadow-(--lm-ombre-haute) outline-none', LARGEURS[largeur])}
      >
        <div className="flex items-start gap-3 border-b border-(--lm-bord) px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id={titreId} className="lm-serif truncate text-[20px] text-(--lm-encre)">
              {titre}
            </h2>
            {sousTitre && <div className="mt-0.5 text-[13px] text-(--lm-encre-2)">{sousTitre}</div>}
          </div>
          {actions}
          <IconButton label="Fermer" onClick={onFermer}>
            <X />
          </IconButton>
        </div>
        <div className="lm-defilement flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {pied && <div className="flex flex-wrap justify-end gap-2 border-t border-(--lm-bord) px-4 py-3 sm:px-5">{pied}</div>}
      </div>
    </div>
  );
}
