import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { logementsAPlacer } from '../../../data/carte';
import { AUJOURDHUI } from '../../../data/format';
import { lienIncident } from '../../../data/incidents-erp';
import { useErp } from '../../../data/store';
import { CarteLogements } from '../../../carte/CarteLogements';
import { phraseBilan, placerLogements } from '../../../carte/placer';
import { pointsDuGerant } from '../../../carte/points';
import { Button } from '../../../ui';

/**
 * Carte de l'accueil du gérant : les logements gérés de l'espace ouvert
 * (Label Maison, Sens…) et ce qui s'y passe aujourd'hui. « Placer sur la
 * carte » géocode, d'un clic du gérant, les logements jamais placés ou dont
 * l'adresse a changé (jamais tout seul au chargement).
 */
export function CarteDuJour() {
  const d = useErp();
  const naviguer = useNavigate();
  const peutPlacer = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  const points = useMemo(() => pointsDuGerant(d.donnees, AUJOURDHUI), [d.donnees]);
  const aPlacer = useMemo(() => logementsAPlacer(d.logements), [d.logements]);
  const [avancement, setAvancement] = useState<{ fait: number; total: number } | null>(null);
  const [bilan, setBilan] = useState<string>();

  if (!points.length) return null;

  const placer = async () => {
    setBilan(undefined);
    const liste = aPlacer.slice();
    setAvancement({ fait: 0, total: liste.length });
    const b = await placerLogements(liste, d.mettreAJour, (fait) => setAvancement({ fait, total: liste.length }));
    setAvancement(null);
    setBilan(phraseBilan(b));
  };
  const n = aPlacer.length;

  return (
    <section aria-labelledby="carte-du-jour-titre" className="mb-6">
      <h2 id="carte-du-jour-titre" className="mb-3 text-[16px] font-semibold text-(--lm-encre)">
        {points.length > 1 ? 'Vos logements aujourd’hui' : 'Votre logement aujourd’hui'}
      </h2>
      <CarteLogements
        points={points}
        aujourdhui={AUJOURDHUI}
        action={(p) => ({
          libelle: 'Ouvrir le logement',
          // Un problème signalé : la fiche s'ouvre sur l'incident.
          onClick: () => naviguer(p.problemes[0]?.id ? lienIncident({ id: p.problemes[0].id, logementId: p.id }) : `/erp/logements/${encodeURIComponent(p.id)}`),
        })}
        aPlacer={
          peutPlacer && (n > 0 || avancement || bilan) ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {(n > 0 || avancement) && (
                <Button size="sm" icone={<MapPin />} onClick={placer} chargement={!!avancement}>
                  {avancement ? `Placement… ${avancement.fait} sur ${avancement.total}` : `Placer ${n} logement${n > 1 ? 's' : ''} sur la carte`}
                </Button>
              )}
              {bilan && (
                <p role="status" className="text-[13px] text-(--lm-encre-2)">
                  {bilan}
                </p>
              )}
            </div>
          ) : undefined
        }
      />
    </section>
  );
}
