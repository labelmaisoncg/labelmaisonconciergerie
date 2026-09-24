import type { ReactNode } from 'react';
import { euros } from '../../../data/format';
import { cn } from '../../../ui';

export interface CarteMontantProps {
  titre: string;
  /** Précision entre parenthèses, toujours visible : lève toute ambiguïté. */
  precision: string;
  montant: number;
  couleur: string;
  icone: ReactNode;
  lignes?: [string, number][];
  note?: ReactNode;
  accent?: boolean;
}

/** Grande carte de montant : un seul chiffre, sa définition, sa décomposition. */
export function CarteMontant({ titre, precision, montant, couleur, icone, lignes, note, accent }: CarteMontantProps) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-(--lm-surface) p-4 shadow-(--lm-ombre) sm:p-5',
        accent ? 'border-(--lm-or-anneau)' : 'border-(--lm-bord)',
      )}
      style={{ borderTop: `3px solid ${couleur}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-semibold text-(--lm-encre)">{titre}</p>
          <p className="text-[12.5px] text-(--lm-encre-2)">({precision})</p>
        </div>
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md bg-(--lm-surface-2) text-(--lm-encre-2) [&_svg]:size-4">
          {icone}
        </span>
      </div>
      <p className={cn('lm-chiffres mt-3 text-[28px] leading-none font-semibold tracking-tight', montant < 0 ? 'text-(--lm-danger)' : 'text-(--lm-encre)')}>
        {euros(montant, true)}
      </p>
      {lignes && (
        <dl className="mt-3 space-y-1 border-t border-(--lm-bord) pt-2.5 text-[12.5px]">
          {lignes.map(([l, v]) => (
            <div key={l} className="flex justify-between gap-3">
              <dt className="text-(--lm-encre-2)">{l}</dt>
              <dd className="lm-chiffres whitespace-nowrap text-(--lm-encre)">{v < 0 ? `- ${euros(-v, true)}` : euros(v, true)}</dd>
            </div>
          ))}
        </dl>
      )}
      {note && <p className="mt-auto pt-3 text-[12px] leading-snug text-(--lm-encre-3)">{note}</p>}
    </div>
  );
}
