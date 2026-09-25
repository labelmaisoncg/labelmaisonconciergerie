import { ImageIcon } from 'lucide-react';
import { cn } from './cn';
import { useLienFichier } from './Fichier';

export interface VignetteProps {
  url?: string;
  alt: string;
  legende?: string;
  className?: string;
}

/**
 * Photo (mission, incident, logement). Les fichiers stockés dans Supabase
 * (« stockage:// ») sont affichés par lien signé ; les URL de démo et les URL
 * absentes affichent un aplat neutre plutôt qu'une image cassée.
 */
export function Vignette({ url, alt, legende, className }: VignetteProps) {
  const reelle = useLienFichier(url);
  return (
    <figure className={cn('overflow-hidden rounded-lg border border-(--lm-bord) bg-(--lm-surface-2)', className)}>
      {reelle ? (
        <img src={reelle} alt={alt} loading="lazy" className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div role="img" aria-label={alt} className="grid aspect-[4/3] w-full place-items-center text-(--lm-encre-3)">
          <ImageIcon className="size-6" aria-hidden />
        </div>
      )}
      {legende && <figcaption className="truncate px-2 py-1 text-[11.5px] text-(--lm-encre-2)">{legende}</figcaption>}
    </figure>
  );
}
