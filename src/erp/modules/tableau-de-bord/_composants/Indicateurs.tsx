import { useMemo } from 'react';
import { BedDouble, Euro, Moon, Star } from 'lucide-react';
import { useErp } from '../../../data/store';
import { SANS_DONNEE, euros, note, pourcentage } from '../../../data/format';
import { SEUIL_NOTE_CONTROLE } from '../../../data/constantes';
import { Aide, Stat } from '../../../ui';
import { fenetresHorizon, mesurer, variation } from './calculs';

/** Les quatre repères d'un channel manager, sur 30 jours, comparés aux 30 jours d'avant. */
export function Indicateurs() {
  const d = useErp();
  const { cour, prec } = useMemo(() => {
    const f = fenetresHorizon('30j');
    return { cour: mesurer(d.donnees, f.courante), prec: mesurer(d.donnees, f.precedente) };
  }, [d.donnees]);
  // Logements actifs, ou réservés sur la période (même règle que le connecteur Claude).
  const actifs = cour.logements > 0;
  const lib = 'vs 30 j avant';

  return (
    <section aria-labelledby="indicateurs-titre" className="mb-6">
      <h2 id="indicateurs-titre" className="mb-3 text-[16px] font-semibold text-(--lm-encre)">
        30 derniers jours
      </h2>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="Occupation"
          valeur={actifs ? pourcentage(cour.occupation) : SANS_DONNEE}
          icone={<BedDouble />}
          delta={actifs ? variation(cour.occupation, prec.occupation, 'points', lib) : undefined}
          to="/erp/reservations"
        />
        <Stat
          label="Revenu"
          valeur={euros(cour.revenu, true)}
          icone={<Euro />}
          delta={variation(cour.revenu, prec.revenu, 'euros', lib)}
          to="/erp/reservations?vue=liste"
        />
        <Stat
          label="Prix moyen par nuit"
          valeur={cour.adr ? euros(cour.adr, true) : SANS_DONNEE}
          icone={<Moon />}
          delta={cour.adr ? variation(cour.adr, prec.adr, 'euros', lib) : undefined}
        />
        <Stat
          label="Note des voyageurs"
          valeur={cour.note === undefined ? SANS_DONNEE : `${note(cour.note)} / 5`}
          icone={<Star />}
          tone={cour.note !== undefined && cour.note < SEUIL_NOTE_CONTROLE ? 'alerte' : 'neutre'}
          delta={variation(cour.note, prec.note, 'note', lib)}
        />
      </div>
      <Aide titre="Comment ces chiffres sont calculés" className="mt-3 mb-0">
        <ul className="space-y-1">
          <li>Occupation : nuits réservées ÷ nuits des logements actifs ou réservés sur la période.</li>
          <li>Revenu : payé par les voyageurs, moins la commission d’Airbnb ou de Booking.</li>
          <li>Prix moyen par nuit : hors frais de ménage.</li>
          <li>Annulations exclues. Une réservation à cheval sur deux périodes est partagée à la nuit.</li>
        </ul>
      </Aide>
    </section>
  );
}
