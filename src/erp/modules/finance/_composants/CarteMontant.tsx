import type { ReactNode } from 'react';
import { euros } from '../../../data/format';
import { cn } from '../../../ui';

export interface CarteMontantProps {
  titre: string;
  montant: number;
  couleur: string;
  icone: ReactNode;
  /** Décomposition, repliée par défaut (divulgation progressive). */
  lignes?: [string, number][];
  note?: ReactNode;
  accent?: boolean;
}

/** Carte de montant : un titre et un chiffre ; le détail est à un clic. */
export function CarteMontant({ titre, montant, couleur, icone, lignes, note, accent }: CarteMontantProps) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-(--lm-surface) p-4 shadow-(--lm-ombre) sm:p-5',
        accent ? 'border-(--lm-or-anneau)' : 'border-(--lm-bord)',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-(--lm-encre)">
          {/* Pastille de la couleur de la série dans les graphiques (repère, pas décor). */}
          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: couleur }} />
          {titre}
        </p>
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md bg-(--lm-surface-2) text-(--lm-encre-2) [&_svg]:size-4">
          {icone}
        </span>
      </div>
      <p className={cn('lm-chiffres mt-3 text-[28px] leading-none font-semibold tracking-tight', montant < 0 ? 'text-(--lm-danger)' : 'text-(--lm-encre)')}>
        {euros(montant, true)}
      </p>
      {(lignes || note) && (
        <details className="group mt-3">
          <summary className="inline-flex cursor-pointer list-none items-center rounded-md text-[12.5px] font-medium text-(--lm-encre-2) hover:text-(--lm-or-texte) [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Voir le détail</span>
            <span className="hidden group-open:inline">Masquer le détail</span>
          </summary>
          {lignes && (
            <dl className="mt-2 space-y-1 border-t border-(--lm-bord) pt-2.5 text-[12.5px]">
              {lignes.map(([l, v]) => (
                <div key={l} className="flex justify-between gap-3">
                  <dt className="text-(--lm-encre-2)">{l}</dt>
                  <dd className="lm-chiffres whitespace-nowrap text-(--lm-encre)">{v < 0 ? `- ${euros(-v, true)}` : euros(v || 0, true)}</dd>
                </div>
              ))}
            </dl>
          )}
          {note && <p className="pt-2 text-[12px] leading-snug text-(--lm-encre-3)">{note}</p>}
        </details>
      )}
    </div>
  );
}
