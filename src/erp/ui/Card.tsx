import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Sans marge intérieure (tableaux, listes bord à bord). */
  flush?: boolean;
  /** Carte cliquable : elle flotte au survol (l'ombre unique). */
  interactive?: boolean;
}

export function Card({ flush, interactive, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        // À plat au repos, un filet d'1 px (Airbnb).
        'rounded-xl border border-(--lm-bord) bg-(--lm-surface)',
        !flush && 'p-4 sm:p-5',
        interactive && 'cursor-pointer transition-shadow hover:shadow-(--lm-ombre-haute)',
        className,
      )}
      {...rest}
    />
  );
}

export interface CardHeaderProps {
  titre: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** En-tête de carte : titre, description, actions à droite. */
export function CardHeader({ titre, description, actions, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-start justify-between gap-2', className)}>
      <div className="min-w-0">
        <h3 className="text-[16px] leading-snug font-semibold text-(--lm-encre)">{titre}</h3>
        {description && <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
