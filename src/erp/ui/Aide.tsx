import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, CircleHelp } from 'lucide-react';
import { cn } from './cn';

export interface AideProps {
  /** Question affichée replié, ex. « Comment ça marche ? ». */
  titre?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Explication repliée par défaut : les règles et le « pourquoi » restent à un
 * clic, sans encombrer la page.
 */
export function Aide({ titre = 'Comment ça marche ?', children, className }: AideProps) {
  const [ouvert, setOuvert] = useState(false);
  const id = useId();
  return (
    <div className={cn('mb-5', className)}>
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls={id}
        onClick={() => setOuvert((o) => !o)}
        className="-my-1.5 inline-flex min-h-8 items-center gap-1.5 text-[13px] font-semibold text-(--lm-encre) underline underline-offset-[3px] hover:decoration-2"
      >
        <CircleHelp className="size-4" aria-hidden />
        {titre}
        <ChevronDown className={cn('size-3.5 transition-transform', ouvert && 'rotate-180')} aria-hidden />
      </button>
      {ouvert && (
        <div id={id} className="lm-apparition mt-2 max-w-3xl rounded-xl border [.rounded-xl_&]:rounded-lg border-(--lm-bord) bg-(--lm-surface-2) px-4 py-3 text-[13.5px] leading-relaxed text-(--lm-encre-2)">
          {children}
        </div>
      )}
    </div>
  );
}
