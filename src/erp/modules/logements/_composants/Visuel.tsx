import { useState } from 'react';
import { House } from 'lucide-react';
import { cn } from '../../../ui';
import { initiales } from '../../../data/format';
import type { Logement } from '../../../data/types';
import { photosLogement } from './stats';

/**
 * Visuel d'un logement : première photo de l'annonce. Sans photo, ou si elle
 * ne se charge pas, un aplat neutre (maison discrète, initiales en petit
 * format) : jamais une image cassée ni une fausse photo.
 */
export function VisuelLogement({ logement, className, taille = 'md' }: { logement: Logement; className?: string; taille?: 'sm' | 'md' }) {
  const photo = photosLogement(logement)[0];
  const [casse, setCasse] = useState<string | null>(null);
  if (photo && casse !== photo) {
    return (
      <img
        src={photo}
        alt={logement.nom}
        loading="lazy"
        // Certains CDN de plateformes refusent les referers inconnus.
        referrerPolicy="no-referrer"
        onError={() => setCasse(photo)}
        className={cn('bg-(--lm-surface-2) object-cover', className)}
      />
    );
  }
  return (
    <div role="img" aria-label={`${logement.nom} : pas encore de photo`} className={cn('grid place-items-center bg-(--lm-surface-2) text-(--lm-encre-3)', className)}>
      {taille === 'sm' ? (
        <span aria-hidden className="text-[12px] font-semibold">
          {initiales(logement.nom)}
        </span>
      ) : (
        <House aria-hidden className="size-9" strokeWidth={1.25} />
      )}
    </div>
  );
}
