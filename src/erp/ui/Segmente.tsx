import { cn } from './cn';

export interface OptionSegment<T extends string> {
  valeur: T;
  libelle: string;
}

export interface SegmenteProps<T extends string> {
  options: OptionSegment<T>[];
  valeur: T;
  onChange: (v: T) => void;
  /** Libellé accessible du groupe. */
  label: string;
  className?: string;
}

/** Choix exclusif court (2 à 4 options), à la manière d'un contrôle segmenté. */
export function Segmente<T extends string>({ options, valeur, onChange, label, className }: SegmenteProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex rounded-lg border border-(--lm-bord-fort) p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.valeur}
          type="button"
          aria-pressed={valeur === o.valeur}
          onClick={() => onChange(o.valeur)}
          className={cn(
            'h-7 rounded-md px-2.5 text-[12.5px] font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none',
            valeur === o.valeur ? 'bg-(--lm-or-lavis) text-(--lm-brun)' : 'text-(--lm-encre-2) hover:text-(--lm-encre)',
          )}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}
