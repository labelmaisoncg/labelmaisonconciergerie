import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from './cn';

export interface ElementCoche {
  libelle: ReactNode;
  fait: boolean;
  /** Information secondaire : preuve, date, auteur. */
  meta?: ReactNode;
}

export interface ChecklistProps {
  elements: ElementCoche[];
  /** Sans gestionnaire, la liste est en lecture seule. */
  onToggle?: (index: number, fait: boolean) => void;
  label?: string;
  className?: string;
}

export function Checklist({ elements, onToggle, label, className }: ChecklistProps) {
  const faits = elements.filter((e) => e.fait).length;
  return (
    <div className={className}>
      {label && (
        <p className="mb-2 flex items-center justify-between text-[13px] font-medium text-(--lm-encre)">
          <span>{label}</span>
          <span className="lm-chiffres text-(--lm-encre-2)">
            {faits}/{elements.length}
          </span>
        </p>
      )}
      <ul className="divide-y divide-(--lm-bord) rounded-lg border border-(--lm-bord)" aria-label={label}>
        {elements.map((e, i) => {
          const boite = (
            <span
              aria-hidden
              className={cn(
                'mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors',
                e.fait ? 'border-(--lm-succes) bg-(--lm-succes) text-white' : 'border-(--lm-bord-fort) bg-(--lm-surface)',
              )}
            >
              {e.fait && <Check className="size-3" strokeWidth={3} />}
            </span>
          );
          const texte = (
            <span className="min-w-0 flex-1">
              <span className={cn('block text-[13.5px]', e.fait ? 'text-(--lm-encre-2)' : 'text-(--lm-encre)')}>{e.libelle}</span>
              {e.meta && <span className="mt-0.5 block text-[12px] text-(--lm-encre-3)">{e.meta}</span>}
            </span>
          );
          return (
            <li key={i}>
              {onToggle ? (
                <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 hover:bg-(--lm-surface-2)">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={e.fait}
                    onChange={(ev) => onToggle(i, ev.target.checked)}
                  />
                  <span className="contents peer-focus-visible:[&>span:first-child]:ring-2 peer-focus-visible:[&>span:first-child]:ring-(--lm-or)">
                    {boite}
                    {texte}
                  </span>
                </label>
              ) : (
                <div className="flex items-start gap-2.5 px-3 py-2.5">
                  {boite}
                  <span className="sr-only">{e.fait ? 'Fait :' : 'À faire :'}</span>
                  {texte}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
