import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from './cn';

export interface Miette {
  libelle: string;
  to?: string;
}

export interface PageHeaderProps {
  titre: ReactNode;
  sousTitre?: ReactNode;
  actions?: ReactNode;
  /** Fil d'Ariane au-dessus du titre. */
  fil?: Miette[];
  className?: string;
}

export function PageHeader({ titre, sousTitre, actions, fil, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6', className)}>
      <div className="min-w-0">
        {fil && fil.length > 0 && (
          <nav aria-label="Fil d’Ariane" className="mb-1.5">
            <ol className="flex flex-wrap items-center gap-1 text-[12.5px] text-(--lm-encre-3)">
              {fil.map((m, i) => (
                <li key={`${m.libelle}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3.5" aria-hidden />}
                  {m.to ? (
                    <Link to={m.to} className="hover:text-(--lm-or) hover:underline">
                      {m.libelle}
                    </Link>
                  ) : (
                    <span aria-current={i === fil.length - 1 ? 'page' : undefined}>{m.libelle}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="lm-serif text-[26px] leading-tight text-(--lm-encre) sm:text-[30px]">{titre}</h1>
        {sousTitre && <p className="mt-1 max-w-3xl text-sm text-(--lm-encre-2)">{sousTitre}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
