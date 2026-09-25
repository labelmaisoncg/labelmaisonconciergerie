import { Link } from 'react-router-dom';
import { BedDouble, CalendarClock, MapPin, Star, Users } from 'lucide-react';
import { ProgressBar, StatusBadge } from '../../../ui';
import { LIBELLES } from '../../../data/libelles';
import { jourMois, note, pluriel, relatif } from '../../../data/format';
import type { Logement } from '../../../data/types';
import type { StatsLogement } from './stats';
import { VisuelLogement } from './Visuel';
import { BadgeCommission, BadgeRentabilite, type EconomieBien } from './EconomieBien';

export function CarteLogement({ logement: l, stats, economie }: { logement: Logement; stats: StatsLogement; economie?: EconomieBien }) {
  const prochaine = stats.prochaineArrivee;
  return (
    <Link
      to={l.id}
      className="group flex flex-col overflow-hidden rounded-xl border border-(--lm-bord) bg-(--lm-surface) shadow-(--lm-ombre) transition-colors hover:border-(--lm-or-anneau)"
    >
      <div className="relative">
        <VisuelLogement logement={l} className="aspect-[16/9] w-full" />
        <StatusBadge type="statutLogement" valeur={l.statut} className="absolute top-2.5 left-2.5 bg-white/90 shadow-sm backdrop-blur" />
        {stats.enCours && (
          <span className="absolute top-2.5 right-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[11.5px] font-medium text-(--lm-brun) shadow-sm">
            Occupé
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-(--lm-encre) group-hover:text-(--lm-brun)">{l.nom}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-(--lm-encre-2)">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {l.ville} · {LIBELLES.typeLogement[l.type]}
              {l.surfaceM2 ? ` · ${l.surfaceM2} m²` : ''}
            </span>
          </p>
          {l.repull?.majLe && <p className="mt-0.5 text-[11.5px] text-(--lm-encre-3)">Importé de Repull</p>}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-(--lm-encre-2)">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden />
            {pluriel(l.capacite, 'voyageur')}
          </span>
          <span className="inline-flex items-center gap-1">
            <BedDouble className="size-3.5" aria-hidden />
            {pluriel(l.lits.reduce((s, x) => s + x.nombre, 0), 'lit')}
          </span>
          <span className="lm-chiffres inline-flex items-center gap-1">
            <Star className="size-3.5 text-(--lm-or)" aria-hidden />
            <span className="sr-only">Note moyenne</span>
            {note(stats.note)}
          </span>
        </div>
        {economie && (
          <div className="flex flex-wrap gap-1.5">
            <BadgeCommission eco={economie} />
            <BadgeRentabilite eco={economie} />
          </div>
        )}
        <ProgressBar
          valeur={stats.occupation30}
          label="Occupation 30 j"
          afficherValeur
          tone={stats.occupation30 >= 0.6 ? 'succes' : stats.occupation30 >= 0.35 ? 'or' : 'alerte'}
        />
        <p className="mt-auto flex items-center gap-1.5 border-t border-(--lm-bord) pt-2.5 text-[12.5px] text-(--lm-encre-2)">
          <CalendarClock className="size-3.5 shrink-0" aria-hidden />
          {prochaine ? (
            <span className="truncate">
              Prochaine arrivée <span className="font-medium text-(--lm-encre)">{jourMois(prochaine.arrivee)}</span> ({relatif(prochaine.arrivee)})
            </span>
          ) : (
            <span>Aucune arrivée prévue</span>
          )}
        </p>
      </div>
    </Link>
  );
}
