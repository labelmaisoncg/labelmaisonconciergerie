import { cn } from './cn';
import { pourcentage } from '../data/format';
import { TON_PLEIN, type Ton } from './tons';

export interface ProgressBarProps {
  /** Ratio 0..1. */
  valeur: number;
  label?: string;
  /** Affiche le pourcentage à droite du libellé. */
  afficherValeur?: boolean;
  tone?: Ton;
  className?: string;
}

export function ProgressBar({ valeur, label, afficherValeur, tone = 'or', className }: ProgressBarProps) {
  const borne = Math.min(1, Math.max(0, Number.isFinite(valeur) ? valeur : 0));
  return (
    <div className={cn('w-full', className)}>
      {(label || afficherValeur) && (
        <div className="mb-1 flex items-center justify-between gap-2 text-[12.5px]">
          {label && <span className="text-(--lm-encre-2)">{label}</span>}
          {afficherValeur && <span className="lm-chiffres font-medium text-(--lm-encre)">{pourcentage(borne)}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(borne * 100)}
        className="h-1.5 w-full overflow-hidden rounded-full bg-(--lm-neutre-lavis)"
      >
        <div className={cn('h-full rounded-full transition-[width]', TON_PLEIN[tone])} style={{ width: `${borne * 100}%` }} />
      </div>
    </div>
  );
}
