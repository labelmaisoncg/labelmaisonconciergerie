import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';
import { TON_LAVIS, TON_PLEIN, type Ton } from './tons';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Ton;
  /** Pastille colorée avant le libellé. */
  point?: boolean;
  icone?: ReactNode;
}

export function Badge({ tone = 'neutre', point, icone, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap [&_svg]:size-3.5',
        TON_LAVIS[tone],
        className,
      )}
      {...rest}
    >
      {point && <span aria-hidden className={cn('size-1.5 rounded-full', TON_PLEIN[tone])} />}
      {icone}
      <span className="truncate">{children}</span>
    </span>
  );
}
