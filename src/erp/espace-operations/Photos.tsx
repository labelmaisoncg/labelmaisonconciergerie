import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Button, IconButton, Vignette, cn } from '../ui';
import { useOps } from './commun';

export interface PhotoChoisie {
  /** Adresse à enregistrer (« stockage://… », ou « demo://… » en démonstration). */
  url: string;
  /** Lien affichable (signé) ; sans : vignette neutre. */
  apercu?: string;
}

/** Photos à joindre : prises ou choisies sur le téléphone, envoyées une à une. */
export function ChoixPhotos({
  photos,
  onChange,
  max = 6,
  libelle = 'Ajouter une photo',
  variante = 'secondary',
  lecture = false,
  className,
}: {
  photos: PhotoChoisie[];
  onChange: (p: PhotoChoisie[]) => void;
  max?: number;
  libelle?: string;
  variante?: 'secondary' | 'ghost';
  /** Photos montrées seulement : ni ajout ni retrait. */
  lecture?: boolean;
  className?: string;
}) {
  const { actions } = useOps();
  const champ = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string>();

  const choisir = async (fichiers: FileList | null) => {
    const liste = Array.from(fichiers ?? []).slice(0, Math.max(0, max - photos.length));
    if (champ.current) champ.current.value = '';
    if (!liste.length) return;
    setErreur(undefined);
    setEnCours(true);
    const ajoutees: PhotoChoisie[] = [];
    for (const f of liste) {
      const r = await actions.photo(f);
      if ('url' in r) ajoutees.push(r);
      else setErreur(r.erreur);
    }
    setEnCours(false);
    if (ajoutees.length) onChange([...photos, ...ajoutees]);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {photos.length > 0 && (
        <ul className={max === 1 ? 'grid w-32 grid-cols-1' : 'grid grid-cols-3 gap-2 sm:grid-cols-4'}>
          {photos.map((p, k) => (
            <li key={p.url} className="relative">
              <Vignette url={p.apercu} alt={`Photo ${k + 1}`} />
              {!lecture && (
                <IconButton label={`Retirer la photo ${k + 1}`} size="sm" variant="secondary" className="absolute top-1 right-1" onClick={() => onChange(photos.filter((x) => x.url !== p.url))}>
                  <X />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
      {!lecture && photos.length < max && (
        <div className="flex flex-col items-start gap-1">
          <input ref={champ} type="file" accept="image/*" multiple={max > 1} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void choisir(e.target.files)} />
          <Button variant={variante} size="sm" icone={<Camera />} chargement={enCours} onClick={() => champ.current?.click()}>
            {enCours ? 'Envoi…' : libelle}
          </Button>
          {erreur && (
            <p role="alert" className="text-[12px] font-medium text-(--lm-danger)">
              {erreur}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
