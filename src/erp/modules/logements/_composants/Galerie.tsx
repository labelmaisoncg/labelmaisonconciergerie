import { useState } from 'react';
import { ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { IconButton, Modal } from '../../../ui';

/**
 * Photos de l'annonce : une grande et quatre petites sur ordinateur, un
 * défilement horizontal sur téléphone. Un clic ouvre la visionneuse.
 */
export function Galerie({ photos, nom }: { photos: string[]; nom: string }) {
  const [ouverte, setOuverte] = useState<number | null>(null);
  if (!photos.length) return null;
  const n = photos.length;
  const aller = (delta: number) => setOuverte((i) => (i === null ? i : (i + delta + n) % n));
  const vignette = 'block h-full w-full object-cover transition-opacity hover:opacity-90';

  return (
    <>
      {/* Téléphone : défilement horizontal, une photo par écran. */}
      <div className="lm-defilement -mx-4 mb-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 sm:hidden" aria-label={`Photos de ${nom}`}>
        {photos.map((p, i) => (
          <button key={p} type="button" onClick={() => setOuverte(i)} className="aspect-[4/3] w-[85%] shrink-0 snap-center overflow-hidden rounded-xl" aria-label={`Agrandir la photo ${i + 1} sur ${n}`}>
            <img src={p} alt="" loading={i ? 'lazy' : 'eager'} className={vignette} />
          </button>
        ))}
      </div>

      {/* Ordinateur : une grande photo, quatre petites. */}
      <div className="relative mb-5 hidden h-[340px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl sm:grid">
        {photos.slice(0, 5).map((p, i) => (
          <button
            key={p}
            type="button"
            onClick={() => setOuverte(i)}
            className={i === 0 ? 'col-span-2 row-span-2' : n < 3 ? 'col-span-2 row-span-2' : ''}
            aria-label={`Agrandir la photo ${i + 1} sur ${n}`}
          >
            <img src={p} alt="" loading={i ? 'lazy' : 'eager'} className={vignette} />
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

      <Modal ouvert={ouverte !== null} onFermer={() => setOuverte(null)} titre={nom} description={ouverte !== null ? `Photo ${ouverte + 1} sur ${n}` : undefined} taille="lg">
        {ouverte !== null && (
          <div className="flex flex-col gap-3">
            <img src={photos[ouverte]} alt={`${nom}, photo ${ouverte + 1} sur ${n}`} className="max-h-[65vh] w-full rounded-xl bg-(--lm-surface-2) object-contain" />
            {n > 1 && (
              <div className="flex items-center justify-center gap-3">
                <IconButton label="Photo précédente" variant="secondary" onClick={() => aller(-1)}>
                  <ChevronLeft />
                </IconButton>
                <span className="lm-chiffres text-[13px] text-(--lm-encre-2)">
                  {ouverte + 1} / {n}
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
