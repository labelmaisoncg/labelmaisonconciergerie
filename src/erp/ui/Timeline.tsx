import type { ReactNode } from 'react';
import { cn } from './cn';
import { TON_PLEIN, type Ton } from './tons';

export interface EvenementFrise {
  id: string;
  titre: ReactNode;
  /** Date, heure, auteur... */
  meta?: ReactNode;
  description?: ReactNode;
  tone?: Ton;
}

export interface TimelineProps {
  elements: EvenementFrise[];
  vide?: ReactNode;
  className?: string;
}

/** Frise verticale (journal d'audit, historique d'une entité). */
export function Timeline({ elements, vide = 'Aucun événement.', className }: TimelineProps) {
  if (!elements.length) return <p className="text-sm text-(--lm-encre-3)">{vide}</p>;
  return (
    <ol className={cn('relative space-y-4 border-l border-(--lm-bord-fort) pl-5', className)}>
      {elements.map((e) => (
        <li key={e.id} className="relative">
          <span
            aria-hidden
            className={cn('absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-(--lm-surface)', TON_PLEIN[e.tone ?? 'or'])}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="text-[13.5px] font-medium text-(--lm-encre)">{e.titre}</p>
            {e.meta && <p className="text-[12px] text-(--lm-encre-3)">{e.meta}</p>}
          </div>
          {e.description && <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">{e.description}</p>}
        </li>
      ))}
    </ol>
  );
}
