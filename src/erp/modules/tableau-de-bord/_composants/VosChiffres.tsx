import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BedDouble, Coins, Euro, Star } from 'lucide-react';
import { useErp } from '../../../data/store';
import { SANS_DONNEE, euros, note, pourcentage } from '../../../data/format';
import { SEUIL_NOTE_CONTROLE } from '../../../data/constantes';
import { Stat } from '../../../ui';
import { fenetresHorizon, mesurer, variation } from './calculs';

/**
 * « Vos chiffres » : quatre repères sur les 30 derniers jours, comparés aux
 * 30 jours d'avant, chacun expliqué en une phrase simple.
 */
export function VosChiffres() {
  const d = useErp();
  const { cour, prec } = useMemo(() => {
    const f = fenetresHorizon('30j');
    return { cour: mesurer(d.donnees, f.courante), prec: mesurer(d.donnees, f.precedente) };
  }, [d.donnees]);
  const actifs = d.logements.filter((l) => l.statut === 'actif').length;
  const lib = 'vs 30 jours avant';

  return (
    <section aria-labelledby="chiffres-titre" className="mb-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="chiffres-titre" className="text-[16px] font-semibold text-(--lm-encre)">
            Vos chiffres
          </h2>
          <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">Les 30 derniers jours, calculés à partir de vos réservations.</p>
        </div>
        <Link to="/erp/performance" className="inline-flex items-center gap-1 text-[13px] font-medium text-(--lm-or) hover:underline">
          Rentabilité de vos logements <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Logements occupés"
          valeur={actifs ? pourcentage(cour.occupation) : SANS_DONNEE}
          icone={<BedDouble />}
          delta={actifs ? variation(cour.occupation, prec.occupation, 'points', lib) : undefined}
          aide={actifs ? 'Part des nuits réservées sur vos logements en ligne.' : 'Aucun logement en ligne pour l’instant.'}
          to="/erp/reservations"
        />
        <Stat
          label="Payé par les voyageurs"
          valeur={euros(cour.revenuBrut, true)}
          icone={<Euro />}
          delta={variation(cour.revenuBrut, prec.revenuBrut, 'euros', lib)}
          aide="Tout ce que les voyageurs ont réglé, ménage compris."
          to="/erp/finance"
        />
        <Stat
          label="Ce que vous gagnez"
          valeur={euros(cour.commission, true)}
          icone={<Coins />}
          delta={variation(cour.commission, prec.commission, 'euros', lib)}
          aide="Votre commission, prévue dans chaque contrat de gestion."
          to="/erp/finance"
        />
        <Stat
          label="Note des voyageurs"
          valeur={cour.note === undefined ? SANS_DONNEE : `${note(cour.note)} / 5`}
          icone={<Star />}
          tone={cour.note !== undefined && cour.note < SEUIL_NOTE_CONTROLE ? 'alerte' : 'neutre'}
          delta={variation(cour.note, prec.note, 'note', lib)}
          aide={cour.note === undefined ? 'Pas encore d’avis sur la période.' : 'La moyenne des avis laissés par vos voyageurs.'}
        />
      </div>
    </section>
  );
}
