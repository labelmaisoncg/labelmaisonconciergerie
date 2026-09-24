import { cn } from './cn';
import { initiales } from '../data/format';

export interface AvatarProps {
  nom: string;
  taille?: 'sm' | 'md' | 'lg';
  className?: string;
}

const TAILLES = { sm: 'size-6 text-[10px]', md: 'size-8 text-[12px]', lg: 'size-10 text-[14px]' };

/** Pastille d'initiales, couleur stable dérivée du nom. */
export function Avatar({ nom, taille = 'md', className }: AvatarProps) {
  const teintes = ['bg-(--lm-or-lavis) text-(--lm-brun)', 'bg-(--lm-info-lavis) text-(--lm-info)', 'bg-(--lm-succes-lavis) text-(--lm-succes)', 'bg-(--lm-neutre-lavis) text-(--lm-encre)'];
  let h = 0;
  for (const c of nom) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      role="img"
      aria-label={nom}
      title={nom}
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-semibold', TAILLES[taille], teintes[h % teintes.length], className)}
    >
      {initiales(nom)}
    </span>
  );
}
