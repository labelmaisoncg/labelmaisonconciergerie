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

/**
 * Choix exclusif court (2 à 4 options), comme le sélecteur d'Airbnb : une
 * piste grise, l'option choisie en pastille blanche ombrée, à l'encre en 600.
 */
export function Segmente<T extends string>({ options, valeur, onChange, label, className }: SegmenteProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex rounded-full bg-(--lm-surface-2) p-1', className)}>
      {options.map((o) => (
        <button
          key={o.valeur}
          type="button"
          aria-pressed={valeur === o.valeur}
          onClick={() => onChange(o.valeur)}
          className={cn(
            'h-8 rounded-full px-3.5 text-[13px] whitespace-nowrap transition-colors',
            valeur === o.valeur ? 'bg-(--lm-surface) font-semibold text-(--lm-encre) shadow-(--lm-ombre-haute)' : 'font-medium text-(--lm-encre-2) hover:text-(--lm-encre)',
          )}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}
