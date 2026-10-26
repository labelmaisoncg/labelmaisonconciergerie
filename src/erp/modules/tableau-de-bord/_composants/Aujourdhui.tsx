import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BedDouble, LogIn, LogOut } from 'lucide-react';
import { useErp } from '../../../data/store';
import { AUJOURDHUI } from '../../../data/format';
import { estActive, logementById } from '../../../data/selectors';
import type { Reservation } from '../../../data/types';
import { ChoixPeriode, type Periode } from './ChoixPeriode';

function Tuile({ titre, icone, n, texte }: { titre: string; icone: ReactNode; n: number; texte: string }) {
  return (
    <Link
      to="/erp/reservations"
      className="flex min-w-0 items-start gap-3 rounded-xl border border-(--lm-bord) bg-(--lm-surface) p-3 shadow-(--lm-ombre) transition-colors hover:border-(--lm-or-anneau) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none sm:p-3.5"
    >
      <span aria-hidden className="hidden size-9 shrink-0 place-items-center rounded-lg bg-(--lm-or-lavis) text-(--lm-or-texte) sm:grid [&_svg]:size-[18px]">
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
          <span className="lm-chiffres text-[22px] leading-none font-semibold text-(--lm-encre)">{n}</span>
          <span className="mt-1 text-[12.5px] font-medium text-(--lm-encre-2) sm:mt-0 sm:text-[13px]">{titre}</span>
        </span>
        <span className="mt-1 line-clamp-2 hidden text-[12.5px] text-(--lm-encre-3) sm:block" title={texte}>
          {texte}
        </span>
      </span>
    </Link>
  );
}

const noms = (liste: string[]) => (liste.length > 2 ? `${liste.slice(0, 2).join(', ')} et ${liste.length - 2} autre${liste.length > 3 ? 's' : ''}` : liste.join(' et '));

/**
 * Arrivées, départs et voyageurs sur place : aujourd'hui par défaut, ou sur la
 * période choisie au calendrier (bornes comprises).
 */
export function Aujourdhui() {
  const d = useErp();
  const [periode, setPeriode] = useState<Periode>({ debut: AUJOURDHUI, fin: AUJOURDHUI });
  const { debut, fin } = periode;
  const unJour = debut === fin;
  const actives = d.reservations.filter(estActive);
  const dans = (date: string) => date >= debut && date <= fin;
  const arrivees = actives.filter((r) => dans(r.arrivee));
  const departs = actives.filter((r) => dans(r.depart));
  // Sur place : au moins une nuit dans la période (un jour : les logements occupés ce soir-là).
  const surPlace = actives.filter((r) => r.arrivee <= fin && r.depart > debut);
  const prenom = (r: Reservation) => r.voyageur.nom.split(' ')[0];
  const logement = (r: Reservation) => logementById(d, r.logementId)?.nom ?? 'un logement';
  const quand = !unJour ? 'sur la période' : debut === AUJOURDHUI ? 'aujourd’hui' : 'ce jour-là';

  return (
    <section aria-labelledby="aujourdhui-titre" className="mb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="aujourdhui-titre" className="text-[16px] font-semibold text-(--lm-encre)">
          Arrivées et départs
        </h2>
        <ChoixPeriode valeur={periode} onChange={setPeriode} />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tuile
          titre={arrivees.length > 1 ? 'arrivées' : 'arrivée'}
          icone={<LogIn />}
          n={arrivees.length}
          texte={arrivees.length ? noms(arrivees.map(prenom)) : `Personne n’arrive ${quand}.`}
        />
        <Tuile
          titre={departs.length > 1 ? 'départs' : 'départ'}
          icone={<LogOut />}
          n={departs.length}
          texte={departs.length ? noms(departs.map(logement)) : `Aucun départ ${quand}.`}
        />
        <Tuile
          titre="sur place"
          icone={<BedDouble />}
          n={surPlace.length}
          texte={surPlace.length ? noms(surPlace.map(logement)) : `Personne sur place ${quand}.`}
        />
      </div>
    </section>
  );
}
