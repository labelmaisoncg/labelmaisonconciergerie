import { cn } from './cn';

export interface InterrupteurProps {
  actif: boolean;
  onChange: (actif: boolean) => void;
  /** Libellé accessible (le texte visible est à côté). */
  label: string;
  disabled?: boolean;
  id?: string;
}

/** Interrupteur marche / arrêt (role="switch"). */
export function Interrupteur({ actif, onChange, label, disabled, id }: InterrupteurProps) {
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
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        actif ? 'bg-(--lm-or)' : 'bg-(--lm-bord-fort)',
      )}
    >
      <span
        aria-hidden
        className={cn('inline-block size-5 rounded-full bg-white shadow-sm transition-transform', actif ? 'translate-x-5.5' : 'translate-x-0.5')}
      />
    </button>
  );
}
