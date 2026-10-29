import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

export interface RepliProps {
  /** Ce que l'on déplie, ex. « Autres logiciels de gestion ». */
  titre: ReactNode;
  /** Une phrase sous le titre, visible même replié. */
  description?: ReactNode;
  /** Déplié au premier affichage (ex. quand il contient déjà quelque chose). */
  ouvert?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Carte repliable pour les réglages avancés ou rarement utiles : l'essentiel
 * reste visible, le reste est à un clic (divulgation progressive). S'appuie
 * sur <details> : clavier et lecteurs d'écran sans code en plus.
 */
export function Repli({ titre, description, ouvert, children, className }: RepliProps) {
  return (
    <details open={ouvert} className={cn('group rounded-xl border border-(--lm-bord) bg-(--lm-surface)', className)}>
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl px-4 group-open:rounded-b-none py-3.5 hover:bg-(--lm-surface-2) sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-(--lm-encre)">{titre}</span>
          {description && <span className="mt-0.5 block text-[13px] text-(--lm-encre-2)">{description}</span>}
        </span>
        <ChevronDown className="mt-0.5 size-5 shrink-0 text-(--lm-encre) transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-(--lm-bord) px-4 py-4 sm:px-5">{children}</div>
    </details>
  );
}
