import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { StatusBadge } from '../../../ui';
import { LIBELLES } from '../../../data/libelles';
import { AUJOURDHUI, ajouterJours, euros, jourMois, note, pourcentage } from '../../../data/format';
import type { Logement } from '../../../data/types';
import { prixAVenir, type StatsLogement } from './stats';
import { VisuelLogement } from './Visuel';

/** Le prochain événement, en une ligne : départ du voyageur sur place, sinon prochaine arrivée. */
function prochainEvenement(s: StatsLogement): string {
  if (s.enCours) return s.enCours.depart === AUJOURDHUI ? 'Départ aujourd’hui' : `Occupé jusqu’au ${jourMois(s.enCours.depart)}`;
  const a = s.prochaineArrivee?.arrivee;
  if (!a) return 'Aucune arrivée prévue';
  if (a === AUJOURDHUI) return 'Arrivée aujourd’hui';
  if (a === ajouterJours(AUJOURDHUI, 1)) return 'Arrivée demain';
  return `Arrivée le ${jourMois(a)}`;
}

export function CarteLogement({ logement: l, stats }: { logement: Logement; stats: StatsLogement }) {
  const prix = prixAVenir(l);
  return (
    <Link
      to={l.id}
      className="group flex flex-col overflow-hidden rounded-xl border border-(--lm-bord) bg-(--lm-surface) shadow-(--lm-ombre) transition-colors hover:border-(--lm-or-anneau) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
    >
      <div className="relative">
        <VisuelLogement logement={l} className="aspect-[4/3] w-full" />
        {/* « Actif » est l'état normal : seul un autre statut mérite un badge. */}
        {l.statut !== 'actif' && (
          <StatusBadge type="statutLogement" valeur={l.statut} className="absolute top-2.5 left-2.5 bg-white/90 shadow-sm backdrop-blur" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-[15px] font-semibold text-(--lm-encre) group-hover:text-(--lm-brun)">{l.nom}</h3>
          {stats.note !== undefined && (
            <span className="lm-chiffres flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-(--lm-encre)" title="Note des voyageurs, 12 derniers mois">
              <Star className="size-3.5 fill-current text-(--lm-or-texte)" aria-hidden />
              {note(stats.note)}
            </span>
          )}
        </div>
        <p className="truncate text-[12.5px] text-(--lm-encre-2)">
          {[l.ville, LIBELLES.typeLogement[l.type], l.capacite ? `${l.capacite} voyageurs` : ''].filter(Boolean).join(' · ')}
        </p>
        <p className="mt-auto flex items-center justify-between gap-2 pt-2 text-[12.5px]">
          <span className="truncate font-medium text-(--lm-encre)">{prochainEvenement(stats)}</span>
          <span className="lm-chiffres shrink-0 text-(--lm-encre-2)">
            {prix ? `${euros(prix.moyen, true)}/nuit` : `${pourcentage(stats.occupation30)} occupé`}
          </span>
        </p>
      </div>
    </Link>
  );
}
