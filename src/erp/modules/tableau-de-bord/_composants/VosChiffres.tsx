import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BedDouble, Coins, Euro, Star } from 'lucide-react';
import { useErp } from '../../../data/store';
import { SANS_DONNEE, euros, note, pourcentage } from '../../../data/format';
import { SEUIL_NOTE_CONTROLE } from '../../../data/constantes';
import { ButtonLink, EmptyState, Stat } from '../../../ui';
import { fenetresHorizon, mesurer, variation } from './calculs';

/**
 * « Vos 30 derniers jours » : quatre repères comparés aux 30 jours d'avant.
 * Sans aucune activité, un seul message remplace les cartes à zéro.
 */
export function VosChiffres() {
  const d = useErp();
  const { cour, prec } = useMemo(() => {
    const f = fenetresHorizon('30j');
    return { cour: mesurer(d.donnees, f.courante), prec: mesurer(d.donnees, f.precedente) };
  }, [d.donnees]);
  const actifs = d.logements.filter((l) => l.statut === 'actif').length;
  const lib = 'vs 30 j avant';
  // Base vide : un seul message plutôt que quatre cartes à zéro.
  const vide = !cour.revenuBrut && !cour.commission && cour.note === undefined && !cour.occupation;

  return (
    <section aria-labelledby="chiffres-titre" className="mb-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 id="chiffres-titre" className="text-[16px] font-semibold text-(--lm-encre)">
          Vos 30 derniers jours
        </h2>
        {!vide && (
          <Link to="/erp/performance" className="inline-flex items-center gap-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline">
            Rentabilité <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      {vide ? (
        <EmptyState
          icone={<Euro />}
          titre="Vos chiffres apparaîtront avec vos premières réservations."
          action={
            <ButtonLink to="/erp/reservations" variant="secondary" size="sm">
              Voir les réservations
            </ButtonLink>
          }
        />
      ) : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Logements occupés"
          valeur={actifs ? pourcentage(cour.occupation) : SANS_DONNEE}
          icone={<BedDouble />}
          delta={actifs ? variation(cour.occupation, prec.occupation, 'points', lib) : undefined}
          to="/erp/reservations"
        />
        <Stat
          label="Payé par les voyageurs"
          valeur={euros(cour.revenuBrut, true)}
          icone={<Euro />}
          delta={variation(cour.revenuBrut, prec.revenuBrut, 'euros', lib)}
          to="/erp/finance"
        />
        <Stat
          label="Ce que vous gagnez"
          valeur={euros(cour.commission, true)}
          icone={<Coins />}
          delta={variation(cour.commission, prec.commission, 'euros', lib)}
          to="/erp/finance"
        />
        <Stat
          label="Note des voyageurs"
          valeur={cour.note === undefined ? SANS_DONNEE : `${note(cour.note)} / 5`}
          icone={<Star />}
          tone={cour.note !== undefined && cour.note < SEUIL_NOTE_CONTROLE ? 'alerte' : 'neutre'}
          delta={variation(cour.note, prec.note, 'note', lib)}
        />
      </div>
      )}
    </section>
  );
}
