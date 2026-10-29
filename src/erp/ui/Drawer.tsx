import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './Button';
import { PIED_FENETRE } from './Modal';
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

/**
 * Panneau de détail : à droite sur ordinateur, feuille qui monte du bas sur
 * téléphone (arrondie en haut). En-tête d'Airbnb : fermer rond à gauche,
 * titre centré, actions à droite, un filet dessous.
 */
export function Drawer({ ouvert, onFermer, titre, sousTitre, pied, actions, largeur = 'lg', children }: DrawerProps) {
  const ref = useFenetre<HTMLDivElement>(ouvert, onFermer);
  const titreId = useId();
  if (!ouvert) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch">
      <div aria-hidden className="lm-apparition absolute inset-0 bg-(--lm-voile)" onClick={onFermer} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        tabIndex={-1}
        className={cn(
          'lm-feuille lm-tiroir relative flex h-[94dvh] w-full flex-col rounded-t-2xl bg-(--lm-surface) shadow-(--lm-ombre-haute) outline-none sm:h-full sm:rounded-none',
          LARGEURS[largeur],
        )}
      >
        <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-(--lm-bord) px-3 py-2.5">
          <IconButton label="Fermer" onClick={onFermer} size="sm">
            <X />
          </IconButton>
          <div className="min-w-0 flex-1 text-center">
            <h2 id={titreId} className="lm-titre truncate text-[17px] leading-snug text-(--lm-encre)">
              {titre}
            </h2>
            {sousTitre && <div className="mt-0.5 text-[13px] leading-snug text-(--lm-encre-2) [&>.flex]:justify-center">{sousTitre}</div>}
          </div>
          {/* Sans actions, une place vide de la taille du bouton fermer garde le titre au centre. */}
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : <span aria-hidden className="size-8 shrink-0" />}
        </div>
        <div className="lm-defilement flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
        {pied && <div className={PIED_FENETRE}>{pied}</div>}
      </div>
    </div>
  );
}
