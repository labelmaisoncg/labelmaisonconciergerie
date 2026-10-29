import { Link, useLocation } from 'react-router-dom';
import { cn } from '../ui';
import { GROUPES, moduleDuChemin, modulesDe, type Rubrique } from '../modules/registry';
import { useCompteurs } from './useCompteurs';
import { Wordmark } from './Wordmark';

export interface SidebarProps {
  onNaviguer?: () => void;
  className?: string;
}

/** Navigation principale : sept rubriques, Paramètres en bas. */
export function Sidebar({ onNaviguer, className }: SidebarProps) {
  const compteurs = useCompteurs();
  const { pathname } = useLocation();
  const active = moduleDuChemin(pathname)?.group;

  const entree = (g: Rubrique) => {
    const n = modulesDe(g.cle).reduce((s, m) => s + (m.compteur ? compteurs[m.compteur] : 0), 0);
    const Icone = g.icon;
    const actif = active === g.cle;
    return (
      <li key={g.cle}>
        <Link
          to={g.path}
          onClick={onNaviguer}
          aria-current={actif ? 'page' : undefined}
          className={cn(
            'flex h-11 items-center gap-3 rounded-lg px-3 text-[14px] transition-[color,background-color]',
            // Rubrique ouverte : fond gris, libellé en 600, icône or (comme l'onglet actif de la barre du bas).
            actif
              ? 'bg-(--lm-surface-2) font-semibold text-(--lm-encre) [&>svg]:fill-(--lm-or-lavis) [&>svg]:text-(--lm-or-texte)'
              : 'font-medium text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre)',
          )}
        >
          <Icone className="size-5 shrink-0" aria-hidden />
          <span className="flex-1 truncate">{g.libelle}</span>
          {n > 0 && (
            <span className="lm-chiffres min-w-5 rounded-full bg-(--lm-encre) px-1.5 py-px text-center text-[11px] font-semibold text-white">
              {n}
              <span className="sr-only"> à regarder</span>
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className={cn('flex h-full flex-col bg-(--lm-surface)', className)}>
      <div className="flex h-[4.5rem] shrink-0 items-center px-5">
        <Wordmark />
      </div>
      <nav aria-label="Menu principal" className="lm-defilement flex flex-1 flex-col overflow-y-auto px-3 pt-3 pb-4">
        <ul className="space-y-0.5">{GROUPES.filter((g) => !g.bas).map(entree)}</ul>
        <ul className="mt-auto space-y-0.5 border-t border-(--lm-bord) pt-3">{GROUPES.filter((g) => g.bas).map(entree)}</ul>
      </nav>
    </div>
  );
}
