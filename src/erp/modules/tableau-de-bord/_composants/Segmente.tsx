import type { ReactNode } from 'react';
import { cn } from '../../../ui';

export interface OptionSegment<T extends string> {
  cle: T;
  libelle: ReactNode;
}

/** Contrôle segmenté (boutons radio visuels). */
export function Segmente<T extends string>({
  options,
  valeur,
  onChange,
  label,
  className,
}: {
  options: OptionSegment<T>[];
  valeur: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex max-w-full rounded-lg border border-(--lm-bord-fort) bg-(--lm-surface) p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.cle}
          type="button"
          role="radio"
          aria-checked={valeur === o.cle}
          onClick={() => onChange(o.cle)}
          className={cn(
            'inline-flex h-8 min-w-0 items-center gap-1.5 truncate rounded-md px-3 text-[13px] font-medium transition-colors [&_svg]:size-4',
            valeur === o.cle ? 'bg-(--lm-or) text-white shadow-sm' : 'text-(--lm-encre-2) hover:text-(--lm-encre)',
          )}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}
