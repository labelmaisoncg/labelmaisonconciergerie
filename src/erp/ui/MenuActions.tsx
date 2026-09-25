import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Ellipsis } from 'lucide-react';
import { cn } from './cn';

export interface ActionMenu {
  libelle: ReactNode;
  icone?: ReactNode;
  /** Action immédiate, lien interne (`to`) ou externe (`href`, nouvel onglet). */
  onClick?: () => void;
  to?: string;
  href?: string;
  disabled?: boolean;
}

export interface MenuActionsProps {
  actions: (ActionMenu | false | null | undefined)[];
  /** Libellé accessible (et visible si `texte`). */
  label?: string;
  /** Afficher « Plus » à côté des trois points. */
  texte?: boolean;
  className?: string;
}

/**
 * Menu « … » : range les actions secondaires d'une page pour ne laisser
 * qu'une action principale visible. Clavier : Échap ferme, flèches naviguent.
 */
export function MenuActions({ actions, label = 'Plus d’actions', texte, className }: MenuActionsProps) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const liste = actions.filter((a): a is ActionMenu => !!a);

  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOuvert(false);
        bouton.current?.focus();
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLElement);
      const j = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[j].focus();
    };
    document.addEventListener('mousedown', clic);
    document.addEventListener('keydown', touche);
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', clic);
      document.removeEventListener('keydown', touche);
    };
  }, [ouvert]);

  if (!liste.length) return null;
  const classeItem =
    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] text-(--lm-encre) hover:bg-(--lm-surface-2) focus:bg-(--lm-surface-2) focus:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-(--lm-encre-3)';

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={bouton}
        type="button"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-controls={id}
        aria-label={texte ? undefined : label}
        title={label}
        onClick={() => setOuvert((o) => !o)}
        className={cn(
          'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-(--lm-bord-fort) bg-(--lm-surface) text-sm font-medium text-(--lm-encre) transition-colors hover:bg-(--lm-surface-2) [&_svg]:size-4',
          texte ? 'px-3' : 'w-9',
        )}
      >
        <Ellipsis aria-hidden />
        {texte && (
          <>
            {label}
            <ChevronDown aria-hidden className="text-(--lm-encre-3)" />
          </>
        )}
      </button>
      {ouvert && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          className="lm-apparition absolute right-0 z-40 mt-1 min-w-56 rounded-xl border border-(--lm-bord) bg-(--lm-surface) p-1 shadow-(--lm-ombre-haute)"
        >
          {liste.map((a, i) => {
            const fermer = () => setOuvert(false);
            if (a.to && !a.disabled)
              return (
                <Link key={i} role="menuitem" to={a.to} onClick={fermer} className={classeItem}>
                  {a.icone}
                  {a.libelle}
                </Link>
              );
            if (a.href && !a.disabled)
              return (
                <a key={i} role="menuitem" href={a.href} target="_blank" rel="noreferrer" onClick={fermer} className={classeItem}>
                  {a.icone}
                  {a.libelle}
                </a>
              );
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                aria-disabled={a.disabled || undefined}
                onClick={() => {
                  if (a.disabled) return;
                  fermer();
                  a.onClick?.();
                }}
                className={classeItem}
              >
                {a.icone}
                {a.libelle}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
