import { cn } from '../ui';

export interface PilulesLogementProps {
  logements: readonly { id: string; nom: string }[];
  choisi?: string;
  onChoisir: (id: string) => void;
  className?: string;
}

/**
 * Choix du logement au-dessus du calendrier : des pilules qui défilent,
 * la choisie à l'encre. Rien quand il n'y a qu'un logement.
 */
export function PilulesLogement({ logements, choisi, onChoisir, className }: PilulesLogementProps) {
  if (logements.length < 2) return null;
  return (
    <div className={cn('-mx-4 flex gap-2 overflow-x-auto px-4 pb-1', className)} role="group" aria-label="Logement">
      {logements.map((l) => (
        <button
          key={l.id}
          type="button"
          aria-pressed={l.id === choisi}
          onClick={() => onChoisir(l.id)}
          className={cn(
            'h-9 shrink-0 rounded-full border px-4 text-[13.5px] font-medium focus-visible:ring-2 focus-visible:ring-(--lm-encre) focus:outline-none',
            l.id === choisi ? 'border-(--lm-encre) bg-(--lm-encre) text-white' : 'border-(--lm-bord-fort) bg-(--lm-surface) text-(--lm-encre) hover:border-(--lm-encre-3)',
          )}
        >
          {l.nom}
        </button>
      ))}
    </div>
  );
}
