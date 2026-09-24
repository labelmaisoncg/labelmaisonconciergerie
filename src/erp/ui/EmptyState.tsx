import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from './cn';

export interface EmptyStateProps {
  titre: ReactNode;
  description?: ReactNode;
  icone?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ titre, description, icone, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-(--lm-bord-fort) px-6 py-12 text-center',
        className,
      )}
    >
      <span aria-hidden className="mb-3 grid size-11 place-items-center rounded-full bg-(--lm-or-lavis) text-(--lm-or) [&_svg]:size-5">
        {icone ?? <Inbox />}
      </span>
      <p className="text-[15px] font-semibold text-(--lm-encre)">{titre}</p>
      {description && <p className="mt-1 max-w-md text-sm text-(--lm-encre-2)">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
