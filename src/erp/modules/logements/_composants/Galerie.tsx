import { useState } from 'react';
import { ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { IconButton, Modal, cn, useLienFichier } from '../../../ui';

/** Grille selon le nombre de photos (1 à 5 affichées) : la première prend toute la hauteur. */
const GRILLES: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-[2fr_1fr] grid-rows-2',
  4: 'grid-cols-[2fr_1fr_1fr] grid-rows-2 [&>button:nth-child(4)]:col-span-2',
  5: 'grid-cols-[2fr_1fr_1fr] grid-rows-2',
};

/** Une photo : lien signé pour une photo déposée par l'équipe ; signalée si elle ne se charge pas. */
function Photo({ url, alt = '', premiere, onCasse, className }: { url: string; alt?: string; premiere?: boolean; onCasse: () => void; className?: string }) {
  const lien = useLienFichier(url);
  if (!lien) return <span aria-hidden className={cn('block bg-(--lm-surface-2)', className)} />;
  return <img src={lien} alt={alt} loading={premiere ? 'eager' : 'lazy'} referrerPolicy="no-referrer" onError={onCasse} className={className} />;
}

/**
 * Photos de l'annonce : une grande et quatre petites sur ordinateur, un
 * défilement horizontal sur téléphone. Un clic ouvre la visionneuse.
 */
export function Galerie({ photos: toutes, nom }: { photos: string[]; nom: string }) {
  const [ouverte, setOuverte] = useState<number | null>(null);
  // Une photo qui ne se charge pas (lien expiré, CDN qui refuse) disparaît de la galerie.
  const [cassees, setCassees] = useState<string[]>([]);
  const photos = toutes.filter((p) => !cassees.includes(p));
  const casser = (p: string) => setCassees((c) => (c.includes(p) ? c : [...c, p]));
  if (!photos.length) return null;
  const n = photos.length;
  const vue = ouverte === null ? null : Math.min(ouverte, n - 1);
  const aller = (delta: number) => setOuverte((i) => (i === null ? i : (i + delta + n) % n));
  const vignette = 'block h-full w-full object-cover transition-opacity hover:opacity-90';

  return (
    <>
      {/* Téléphone : défilement horizontal, une photo par écran. */}
      <div className="lm-defilement -mx-4 mb-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 sm:hidden" aria-label={`Photos de ${nom}`}>
        {photos.map((p, i) => (
          <button key={p} type="button" onClick={() => setOuverte(i)} className="aspect-[4/3] w-[85%] shrink-0 snap-center overflow-hidden rounded-xl" aria-label={`Agrandir la photo ${i + 1} sur ${n}`}>
            <Photo url={p} premiere={!i} onCasse={() => casser(p)} className={vignette} />
          </button>
        ))}
      </div>

      {/* Ordinateur : une grande photo et jusqu'à quatre petites, sans case vide. */}
      <div className={`relative mb-5 hidden h-[340px] gap-2 overflow-hidden rounded-xl sm:grid ${GRILLES[Math.min(n, 5)]}`}>
        {photos.slice(0, 5).map((p, i) => (
          <button key={p} type="button" onClick={() => setOuverte(i)} className={i === 0 && n > 1 ? 'row-span-2' : ''} aria-label={`Agrandir la photo ${i + 1} sur ${n}`}>
            <Photo url={p} premiere={!i} onCasse={() => casser(p)} className={vignette} />
          </button>
        ))}
        {n > 1 && (
          <button
            type="button"
            onClick={() => setOuverte(0)}
            className="absolute right-3 bottom-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-(--lm-surface) px-3 text-[12.5px] font-medium text-(--lm-encre) shadow-(--lm-ombre) hover:bg-(--lm-surface-2)"
          >
            <Images className="size-4" aria-hidden />
            {n} photos
          </button>
        )}
      </div>

      <Modal ouvert={vue !== null} onFermer={() => setOuverte(null)} titre={nom} description={vue !== null ? `Photo ${vue + 1} sur ${n}` : undefined} taille="lg">
        {vue !== null && (
          <div className="flex flex-col gap-3">
            <Photo url={photos[vue]} alt={`${nom}, photo ${vue + 1} sur ${n}`} premiere onCasse={() => casser(photos[vue])} className="max-h-[65vh] min-h-48 w-full rounded-xl bg-(--lm-surface-2) object-contain" />
            {n > 1 && (
              <div className="flex items-center justify-center gap-3">
                <IconButton label="Photo précédente" variant="secondary" onClick={() => aller(-1)}>
                  <ChevronLeft />
                </IconButton>
                <span className="lm-chiffres text-[13px] text-(--lm-encre-2)">
                  {vue + 1} / {n}
                </span>
                <IconButton label="Photo suivante" variant="secondary" onClick={() => aller(1)}>
                  <ChevronRight />
                </IconButton>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
