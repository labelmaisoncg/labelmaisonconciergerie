import { NavLink } from 'react-router-dom';
import { cn } from '../ui';
import { GROUPES, MODULES } from '../modules/registry';
import { useCompteurs } from './useCompteurs';
import { Wordmark } from './Wordmark';

export interface SidebarProps {
  onNaviguer?: () => void;
  className?: string;
}

/** Navigation principale, groupée par couche fonctionnelle (SPEC §1). */
export function Sidebar({ onNaviguer, className }: SidebarProps) {
  const compteurs = useCompteurs();
  return (
    <div className={cn('flex h-full flex-col bg-(--lm-surface)', className)}>
      <div className="flex h-14 shrink-0 items-center px-4">
        <Wordmark />
      </div>
      <nav aria-label="Modules de l’ERP" className="lm-defilement flex-1 overflow-y-auto px-2.5 pt-2 pb-6">
        {GROUPES.map((g) => {
          const modules = MODULES.filter((m) => m.group === g.cle);
          if (!modules.length) return null;
          return (
            <div key={g.cle} className="mb-3">
              {g.cle !== 'pilotage' && (
                <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-[0.08em] text-(--lm-encre-3) uppercase">{g.libelle}</p>
              )}
              <ul>
                {modules.map((m) => {
                  const n = m.compteur ? compteurs[m.compteur] : 0;
                  const Icone = m.icon;
                  return (
                    <li key={m.key}>
                      <NavLink
                        to={m.path}
                        end={m.segment === ''}
                        onClick={onNaviguer}
                        className={({ isActive }) =>
                          cn(
                            'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors',
                            isActive
                              ? 'bg-(--lm-or-lavis) text-(--lm-brun) [&>svg]:text-(--lm-or)'
                              : 'text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre)',
                          )
                        }
                      >
                        <Icone className="size-[17px] shrink-0" aria-hidden />
                        <span className="flex-1 truncate">{m.label}</span>
                        {n > 0 && (
                          <span className="lm-chiffres rounded-full bg-(--lm-or) px-1.5 py-px text-[11px] font-semibold text-white">
                            {n}
                            <span className="sr-only"> à traiter</span>
                          </span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
