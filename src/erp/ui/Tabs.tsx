import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from './cn';

export interface Onglet {
  cle: string;
  libelle: ReactNode;
  compteur?: number;
  /** Si présent, l'onglet est un lien de navigation (sous-routes d'un module). */
  to?: string;
  /** Lien actif uniquement sur le chemin exact. */
  end?: boolean;
}

export interface TabsProps {
  onglets: Onglet[];
  /** Onglet actif (mode contrôlé, onglets sans `to`). */
  actif?: string;
  onChange?: (cle: string) => void;
  label?: string;
  className?: string;
}

const BASE =
  'relative inline-flex h-10 shrink-0 items-center gap-1.5 px-3 text-[13.5px] font-medium whitespace-nowrap text-(--lm-encre-2) transition-colors hover:text-(--lm-encre)';
const ACTIF = 'text-(--lm-encre) after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-(--lm-or)';

function Compteur({ n }: { n?: number }) {
  if (n === undefined) return null;
  return <span className="lm-chiffres rounded-full bg-(--lm-neutre-lavis) px-1.5 text-[11.5px] text-(--lm-encre-2)">{n}</span>;
}

/** Onglets : contrôlés (état local) ou routés (NavLink) selon la présence de `to`. */
export function Tabs({ onglets, actif, onChange, label = 'Onglets', className }: TabsProps) {
  const refs = useRef<(HTMLButtonElement | HTMLAnchorElement | null)[]>([]);

  const clavier = (e: KeyboardEvent, i: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const j = (i + delta + onglets.length) % onglets.length;
    refs.current[j]?.focus();
    if (!onglets[j].to) onChange?.(onglets[j].cle);
  };

  return (
    <div
      role={onglets.some((o) => o.to) ? undefined : 'tablist'}
      aria-label={label}
      className={cn('lm-defilement mb-5 flex overflow-x-auto border-b border-(--lm-bord)', className)}
    >
      {onglets.map((o, i) =>
        o.to ? (
          <NavLink
            key={o.cle}
            to={o.to}
            end={o.end}
            ref={(el) => {
              refs.current[i] = el;
            }}
            onKeyDown={(e) => clavier(e, i)}
            className={({ isActive }) => cn(BASE, isActive && ACTIF)}
          >
            {o.libelle}
            <Compteur n={o.compteur} />
          </NavLink>
        ) : (
          <button
            key={o.cle}
            type="button"
            role="tab"
            aria-selected={actif === o.cle}
            tabIndex={actif === o.cle ? 0 : -1}
            ref={(el) => {
              refs.current[i] = el;
            }}
            onKeyDown={(e) => clavier(e, i)}
            onClick={() => onChange?.(o.cle)}
            className={cn(BASE, actif === o.cle && ACTIF)}
          >
            {o.libelle}
            <Compteur n={o.compteur} />
          </button>
        ),
      )}
    </div>
  );
}
