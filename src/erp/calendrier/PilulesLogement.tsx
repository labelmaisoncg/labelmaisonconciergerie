import { useEffect, useRef } from 'react';
import { cn } from '../ui';

export interface PilulesLogementProps {
  logements: readonly { id: string; nom: string }[];
  choisi?: string;
  onChoisir: (id: string) => void;
  /** Couleur de chaque logement (ERP) : une pastille devant le nom. Sans : pas de pastille (espace propriétaire). */
  teintes?: ReadonlyMap<string, string>;
  className?: string;
}

/**
 * Choix du logement au-dessus du calendrier : des pilules qui défilent sur
 * téléphone et passent à la ligne sur grand écran, la choisie à l'encre.
 * Rien quand il n'y a qu'un logement. Avec `teintes`, la pastille de
 * couleur du logement précède son nom (cerclée de blanc sur la pilule choisie).
 */
export function PilulesLogement({ logements, choisi, onChoisir, teintes, className }: PilulesLogementProps) {
  const barre = useRef<HTMLDivElement>(null);
  // Barre plus large que l'écran (téléphone) : la pilule choisie est ramenée dans la vue,
  // qu'elle vienne d'un toucher ou de l'adresse (`?logement=` d'une fiche logement).
  useEffect(() => {
    const b = barre.current;
    const el = b?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!b || !el || b.scrollWidth <= b.clientWidth) return;
    const o = el.getBoundingClientRect();
    const r = b.getBoundingClientRect();
    if (o.right > r.right) b.scrollLeft += o.right - r.right + 16;
    else if (o.left < r.left) b.scrollLeft -= r.left - o.left + 16;
  }, [choisi]);
  if (logements.length < 2) return null;
  return (
    <div ref={barre} className={cn('-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0', className)} role="group" aria-label="Logement">
      {logements.map((l) => (
        <button
          key={l.id}
          type="button"
          aria-pressed={l.id === choisi}
          onClick={() => onChoisir(l.id)}
          className={cn(
            'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[13.5px] font-medium max-sm:h-11',
            l.id === choisi ? 'border-(--lm-encre) bg-(--lm-encre) text-white' : 'border-(--lm-bord-fort) bg-(--lm-surface) text-(--lm-encre) hover:border-(--lm-encre-3)',
          )}
        >
          {teintes?.get(l.id) && (
            <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', l.id === choisi && 'ring-[1.5px] ring-white')} style={{ background: teintes.get(l.id) }} />
          )}
          {l.nom}
        </button>
      ))}
    </div>
  );
}
