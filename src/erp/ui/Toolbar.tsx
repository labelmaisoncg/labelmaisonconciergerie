import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from './cn';

export interface SearchInputProps {
  valeur: string;
  onChange: (valeur: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function SearchInput({ valeur, onChange, placeholder = 'Rechercher', label = 'Rechercher', className }: SearchInputProps) {
  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-(--lm-encre)" />
      <input
        type="search"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 w-full rounded-full border border-(--lm-bord-fort) bg-(--lm-surface) pr-10 pl-10 text-[14px] text-(--lm-encre) placeholder:text-(--lm-encre-2) hover:border-(--lm-encre-3) focus:border-(--lm-encre) focus:shadow-[inset_0_0_0_1px_var(--lm-encre)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {valeur && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Effacer la recherche"
          className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-full text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre)"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export interface Filtre {
  cle: string;
  libelle: ReactNode;
  compteur?: number;
}

export interface FilterChipsProps {
  filtres: Filtre[];
  /** Clés actives. */
  actifs: string[];
  onChange: (actifs: string[]) => void;
  /** Un seul filtre à la fois (comportement de boutons radio). */
  unique?: boolean;
  label?: string;
  className?: string;
}

export function FilterChips({ filtres, actifs, onChange, unique, label = 'Filtres', className }: FilterChipsProps) {
  const basculer = (cle: string) => {
    if (unique) return onChange(actifs.includes(cle) ? [] : [cle]);
    onChange(actifs.includes(cle) ? actifs.filter((a) => a !== cle) : [...actifs, cle]);
  };
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-1.5', className)}>
      {filtres.map((f) => {
        const actif = actifs.includes(f.cle);
        return (
          <button
            key={f.cle}
            type="button"
            aria-pressed={actif}
            onClick={() => basculer(f.cle)}
            className={cn(
              // Filtre en pilule bordée (Airbnb). Choisi : l'or, contour doublé et texte en 600 (pas la couleur seule).
              'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] whitespace-nowrap transition-colors',
              actif
                ? 'border-(--lm-or-texte) bg-(--lm-or-lavis) font-semibold text-(--lm-encre) shadow-[inset_0_0_0_1px_var(--lm-or-texte)]'
                : 'border-(--lm-bord-fort) bg-(--lm-surface) font-medium text-(--lm-encre) hover:border-(--lm-encre)',
            )}
          >
            {f.libelle}
            {f.compteur !== undefined && <span className="lm-chiffres text-[12px] font-normal text-(--lm-encre-2)">{f.compteur}</span>}
          </button>
        );
      })}
    </div>
  );
}

export interface ToolbarProps {
  recherche?: SearchInputProps;
  filtres?: FilterChipsProps;
  /** Boutons à droite (export, création...). */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Barre au-dessus d'une liste : recherche, filtres en puces, actions. */
export function Toolbar({ recherche, filtres, actions, children, className }: ToolbarProps) {
  return (
    <div className={cn('mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      {recherche && <SearchInput {...recherche} />}
      {filtres && <FilterChips {...filtres} />}
      {children}
      {actions && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{actions}</div>}
    </div>
  );
}
