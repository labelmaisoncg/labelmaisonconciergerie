import type { ReactNode } from 'react';
import { cn } from './cn';

export interface SectionProps {
  titre?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

/** Bloc de page titré (sans cadre), pour regrouper cartes et tableaux. */
export function Section({ titre, description, actions, children, className, id }: SectionProps) {
  const titreId = id ? `${id}-titre` : undefined;
  return (
    <section id={id} aria-labelledby={titreId} className={cn('mb-6 sm:mb-8', className)}>
      {(titre || actions) && (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            {titre && (
              <h2 id={titreId} className="text-[16px] font-semibold text-(--lm-encre)">
                {titre}
              </h2>
            )}
            {description && <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
