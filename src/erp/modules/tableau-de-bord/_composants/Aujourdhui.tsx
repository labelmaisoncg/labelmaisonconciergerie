import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bell, LogIn, LogOut, Sparkles } from 'lucide-react';
import { useErp } from '../../../data/store';
import { arriveesDuJour, departsDuJour, logementById, missionsDuJour } from '../../../data/selectors';
import { cn } from '../../../ui';

function Tuile({
  titre,
  icone,
  n,
  to,
  texte,
  alerte,
}: {
  titre: string;
  icone: ReactNode;
  n: number;
  to: string;
  texte: string;
  alerte?: boolean;
}) {
  const classes =
    'group flex min-w-0 items-start gap-3 rounded-xl border border-(--lm-bord) bg-(--lm-surface) p-3.5 shadow-(--lm-ombre) transition-colors hover:border-(--lm-or-anneau)';
  const contenu = (
    <>
      <span
        aria-hidden
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-[18px]',
          alerte ? 'bg-(--lm-alerte-lavis) text-(--lm-alerte)' : 'bg-(--lm-or-lavis) text-(--lm-or)',
        )}
      >
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="lm-chiffres text-[22px] leading-none font-semibold text-(--lm-encre)">{n}</span>
          <span className="text-[13px] font-medium text-(--lm-encre-2)">{titre}</span>
        </span>
        <span className="mt-1 line-clamp-2 block text-[12.5px] text-(--lm-encre-3)" title={texte}>
          {texte}
        </span>
      </span>
    </>
  );
  return to.startsWith('#') ? (
    <a href={to} className={classes}>
      {contenu}
    </a>
  ) : (
    <Link to={to} className={classes}>
      {contenu}
    </Link>
  );
}

const noms = (liste: string[]) => (liste.length > 2 ? `${liste.slice(0, 2).join(', ')} et ${liste.length - 2} autre${liste.length > 3 ? 's' : ''}` : liste.join(' et '));

/** Rangée « Aujourd'hui » : arrivées, départs, ménages et sujets à regarder. */
export function Aujourdhui({ alertes, urgentes }: { alertes: number; urgentes: number }) {
  const d = useErp();
  const arrivees = arriveesDuJour(d.reservations);
  const departs = departsDuJour(d.reservations);
  const menages = missionsDuJour(d.missions);
  const sansPersonne = menages.filter((m) => !m.prestataireId).length;
  const nomLogement = (id: string) => logementById(d, id)?.nom ?? 'un logement';

  return (
    <section aria-labelledby="aujourdhui-titre" className="mb-6">
      <h2 id="aujourdhui-titre" className="mb-3 text-[16px] font-semibold text-(--lm-encre)">
        Aujourd’hui
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tuile
          titre={arrivees.length > 1 ? 'arrivées' : 'arrivée'}
          icone={<LogIn />}
          n={arrivees.length}
          to="/erp/reservations"
          texte={arrivees.length ? noms(arrivees.map((r) => r.voyageur.nom.split(' ')[0])) : 'Personne n’arrive aujourd’hui, journée calme.'}
        />
        <Tuile
          titre={departs.length > 1 ? 'départs' : 'départ'}
          icone={<LogOut />}
          n={departs.length}
          to="/erp/reservations"
          texte={departs.length ? noms(departs.map((r) => nomLogement(r.logementId))) : 'Aucun départ aujourd’hui.'}
        />
        <Tuile
          titre={menages.length > 1 ? 'ménages' : 'ménage'}
          icone={<Sparkles />}
          n={menages.length}
          to="/erp/menages"
          alerte={sansPersonne > 0}
          texte={
            !menages.length
              ? 'Pas de ménage prévu aujourd’hui.'
              : sansPersonne
                ? `${sansPersonne} sans personne pour le faire`
                : 'Tout le monde sait où aller.'
          }
        />
        <Tuile
          titre={alertes > 1 ? 'sujets à regarder' : 'sujet à regarder'}
          icone={<Bell />}
          n={alertes}
          to="#a-faire"
          alerte={urgentes > 0}
          texte={alertes ? (urgentes ? `dont ${urgentes} pour aujourd’hui` : 'Rien d’urgent.') : 'Tout va bien, rien à signaler.'}
        />
      </div>
    </section>
  );
}
