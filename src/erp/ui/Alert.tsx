import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, Sparkles } from 'lucide-react';
import { cn } from './cn';
import type { Ton } from './tons';

export interface AlertProps {
  tone?: Ton;
  titre?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  icone?: ReactNode;
  className?: string;
}

const STYLES: Record<Ton, string> = {
  neutre: 'border-(--lm-bord-fort) bg-(--lm-surface-2) [&>svg]:text-(--lm-encre-2)',
  or: 'border-(--lm-or-anneau) bg-(--lm-or-lavis) [&>svg]:text-(--lm-or)',
  succes: 'border-(--lm-succes)/30 bg-(--lm-succes-lavis) [&>svg]:text-(--lm-succes)',
  alerte: 'border-(--lm-alerte)/30 bg-(--lm-alerte-lavis) [&>svg]:text-(--lm-alerte)',
  danger: 'border-(--lm-danger)/30 bg-(--lm-danger-lavis) [&>svg]:text-(--lm-danger)',
  info: 'border-(--lm-info)/30 bg-(--lm-info-lavis) [&>svg]:text-(--lm-info)',
};

const ICONES: Record<Ton, ReactNode> = {
  neutre: <Info />,
  or: <Sparkles />,
  succes: <CheckCircle2 />,
  alerte: <AlertTriangle />,
  danger: <OctagonAlert />,
  info: <Info />,
};

/** Encadré d'information ou d'alerte, toujours doublé d'une icône. */
export function Alert({ tone = 'info', titre, children, actions, icone, className }: AlertProps) {
  return (
    <div
      role={tone === 'danger' || tone === 'alerte' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 [&>svg]:mt-0.5 [&>svg]:size-[18px] [&>svg]:shrink-0', STYLES[tone], className)}
    >
      {icone ?? ICONES[tone]}
      <div className="min-w-0 flex-1 text-[13.5px] text-(--lm-encre)">
        {titre && <p className="font-semibold">{titre}</p>}
        {children && <div className={cn(titre && 'mt-0.5', 'text-(--lm-encre-2)')}>{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Alias : encadré de mise en avant. */
export const Callout = Alert;
