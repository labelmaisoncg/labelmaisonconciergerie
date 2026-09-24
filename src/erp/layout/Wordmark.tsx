import { Link } from 'react-router-dom';
import { cn } from '../ui';

/** Marque « LABEL MAISON · ERP » de la barre latérale. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/erp" className={cn('group flex items-center gap-2.5', className)} aria-label="ERP Label Maison, tableau de bord">
      <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-(--lm-brun) text-[13px] font-semibold text-[#F7F2E6]">
        LM
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[11.5px] font-semibold tracking-[0.18em] text-(--lm-or) [font-variant:small-caps]">Label Maison</span>
        <span className="lm-serif mt-1 text-[17px] text-(--lm-encre)">ERP</span>
      </span>
    </Link>
  );
}
