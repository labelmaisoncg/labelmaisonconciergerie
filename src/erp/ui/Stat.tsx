import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from './cn';
import { TON_LAVIS, TON_TEXTE, type Ton } from './tons';

export interface Delta {
  /** Texte déjà formaté, ex. « +4 pts » ou « -120 € ». */
  valeur: string;
  sens: 'hausse' | 'baisse' | 'stable';
  /** La variation est-elle favorable ? Colore en vert ou rouge. */
  favorable?: boolean;
  /** Référence de comparaison, ex. « vs août ». */
  libelle?: string;
}

export interface StatProps {
  label: ReactNode;
  valeur: ReactNode;
  delta?: Delta;
  /** Ton de mise en avant (alerte, danger...) : liseré et icône colorés. */
  tone?: Ton;
  icone?: ReactNode;
  aide?: ReactNode;
  /** Lien vers le détail. */
  to?: string;
  className?: string;
}

export function Stat({ label, valeur, delta, tone = 'neutre', icone, aide, to, className }: StatProps) {
  const contenu = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium text-(--lm-encre-2)">{label}</p>
        {icone && (
          <span aria-hidden className={cn('grid size-7 shrink-0 place-items-center rounded-md [&_svg]:size-4', TON_LAVIS[tone === 'neutre' ? 'or' : tone])}>
            {icone}
          </span>
        )}
      </div>
      <p className="lm-chiffres mt-1.5 text-[24px] leading-none font-semibold tracking-tight text-(--lm-encre)">{valeur}</p>
      {(delta || aide) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
          {delta && <DeltaBadge {...delta} />}
          {aide && <span className="text-(--lm-encre-3)">{aide}</span>}
        </div>
      )}
    </>
  );
  const classes = cn(
    'block rounded-xl border border-(--lm-bord) bg-(--lm-surface) p-4 shadow-(--lm-ombre)',
    tone === 'danger' && 'border-l-[3px] border-l-(--lm-danger)',
    tone === 'alerte' && 'border-l-[3px] border-l-(--lm-alerte)',
    to && 'transition-colors hover:border-(--lm-or-anneau)',
    className,
  );
  return to ? (
    <Link to={to} className={classes}>
      {contenu}
    </Link>
  ) : (
    <div className={classes}>{contenu}</div>
  );
}

function DeltaBadge({ valeur, sens, favorable, libelle }: Delta) {
  const Icone = sens === 'hausse' ? ArrowUpRight : sens === 'baisse' ? ArrowDownRight : ArrowRight;
  const ton: Ton = favorable === undefined || sens === 'stable' ? 'neutre' : favorable ? 'succes' : 'danger';
  const lecture = sens === 'hausse' ? 'en hausse' : sens === 'baisse' ? 'en baisse' : 'stable';
  return (
    <span className={cn('lm-chiffres inline-flex items-center gap-0.5 font-medium', TON_TEXTE[ton])}>
      <Icone className="size-3.5" aria-hidden />
      <span className="sr-only">{lecture} :</span>
      {valeur}
      {libelle && <span className="ml-1 font-normal text-(--lm-encre-3)">{libelle}</span>}
    </span>
  );
}
