import { ImagePlus } from 'lucide-react';
import { MAINTENANT, dateHeure } from '../../../data/format';
import type { MomentPhoto, Mission } from '../../../data/types';
import { Badge, Button, Card, CardHeader, Vignette } from '../../../ui';

interface Props {
  mission: Mission;
  /** Absent : lecture seule. */
  onAjouter?: (photo: Mission['photos'][number]) => void;
  demo: boolean;
}

const MOMENTS: { cle: MomentPhoto; titre: string }[] = [
  { cle: 'avant', titre: 'Avant' },
  { cle: 'apres', titre: 'Après' },
];

/** Preuves photo horodatées, séparées avant / après. */
export function Photos({ mission, onAjouter, demo }: Props) {
  return (
    <Card>
      <CardHeader titre="Photos horodatées" description="Obligatoires avant et après : sans elles, la mission ne peut pas être validée." />
      <div className="grid gap-5 md:grid-cols-2">
        {MOMENTS.map(({ cle, titre }) => {
          const photos = mission.photos.filter((p) => p.moment === cle).sort((a, b) => a.prisLe.localeCompare(b.prisLe));
          return (
            <section key={cle} aria-label={`Photos ${titre.toLowerCase()}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-(--lm-encre)">
                  {titre} <span className="lm-chiffres font-normal text-(--lm-encre-3)">({photos.length})</span>
                </p>
                {photos.length === 0 && <Badge tone="danger">Manquantes</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {photos.map((p, i) => (
                  <Vignette key={`${p.url}-${i}`} url={p.url} alt={`Photo ${titre.toLowerCase()} ${i + 1}`} legende={dateHeure(p.prisLe)} />
                ))}
                {photos.length === 0 && (
                  <div className="col-span-full grid place-items-center rounded-lg border border-dashed border-(--lm-bord-fort) px-3 py-6 text-center text-[12.5px] text-(--lm-encre-3)">
                    Aucune photo {titre.toLowerCase()}
                  </div>
                )}
              </div>
              {onAjouter && demo && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  icone={<ImagePlus />}
                  onClick={() =>
                    onAjouter({ url: `demo://photos/${mission.id}/${cle}-${mission.photos.length + 1}.jpg`, moment: cle, prisLe: MAINTENANT })
                  }
                >
                  Ajouter une photo (démo)
                </Button>
              )}
            </section>
          );
        })}
      </div>
    </Card>
  );
}
