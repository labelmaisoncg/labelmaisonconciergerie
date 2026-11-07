import { cn } from './cn';

export interface InterrupteurProps {
  actif: boolean;
  onChange: (actif: boolean) => void;
  /** Libellé accessible (le texte visible est à côté). */
  label: string;
  disabled?: boolean;
  id?: string;
  /** « grand » : la taille de l'interrupteur de l'iPhone (51 × 31), 44 px au toucher, pour un réglage principal. */
  taille?: 'normal' | 'grand';
}

/** Interrupteur marche / arrêt (role="switch"). */
export function Interrupteur({ actif, onChange, label, disabled, id, taille = 'normal' }: InterrupteurProps) {
  const grand = taille === 'grand';
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!actif)}
      className={cn(
        // Zone de toucher agrandie par un bord invisible au-dessus et au-dessous, sans changer l'aspect.
        'relative inline-flex shrink-0 items-center rounded-full transition-colors after:absolute after:inset-x-0 disabled:cursor-not-allowed disabled:opacity-60',
        // Grand : 31 px de haut, zone de toucher portée à 44 px (6,5 px de bord invisible de chaque côté).
        grand ? 'h-[31px] w-[51px] after:-inset-y-[6.5px]' : 'h-6 w-11 after:-inset-y-1',
        actif ? 'bg-(--lm-or-texte)' : 'bg-(--lm-bord-fort)',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block rounded-full bg-white shadow-sm transition-transform',
          grand ? cn('size-[27px]', actif ? 'translate-x-[22px]' : 'translate-x-[2px]') : cn('size-5', actif ? 'translate-x-5.5' : 'translate-x-0.5'),
        )}
      />
    </button>
  );
}
