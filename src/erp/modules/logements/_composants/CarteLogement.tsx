import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { StatusBadge } from '../../../ui';
import { LIBELLES } from '../../../data/libelles';
import { AUJOURDHUI, ajouterJours, dateHeure, euros, jourMois, note, pluriel } from '../../../data/format';
import type { Logement } from '../../../data/types';
import { prixNuit, type StatsLogement } from './stats';
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

/**
 * Un logement, comme une annonce Airbnb : la photo, puis le nom et la note,
 * la ville et la taille, le prochain événement, et le prix de la nuit. Un
 * logement qui n'est pas en location (en pause, en préparation, sorti)
 * n'affiche pas de prix.
 */
export function CarteLogement({ logement: l, stats }: { logement: Logement; stats: StatsLogement }) {
  const enLocation = l.statut === 'actif';
  const prix = enLocation ? prixNuit(l, { adr90: stats.adr90 }) : undefined;
  const detailPrix = !prix
    ? ''
    : prix.source === 'soir'
      ? `Prix de ce soir, lu sur les plateformes le ${dateHeure(prix.luLe!)}`
      : prix.source === 'prochaine'
        ? `Prix de la nuit du ${jourMois(prix.date!)}, lu sur les plateformes le ${dateHeure(prix.luLe!)}`
        : prix.source === 'base'
          ? 'Prix de base de l’annonce'
          : 'Prix moyen encaissé par nuit sur les séjours des 90 derniers jours, hors ménage';
  const taille = [
    l.ville,
    // « Autre » n'apprend rien : le type n'apparaît que s'il est connu.
    l.type !== 'autre' ? LIBELLES.typeLogement[l.type] : '',
    l.capacite ? pluriel(l.capacite, 'voyageur') : '',
  ].filter(Boolean);

  return (
    <Link
      to={l.id}
      className="group block rounded-xl focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus-visible:ring-offset-4 focus-visible:ring-offset-(--lm-fond) focus:outline-none"
    >
      <div className="relative overflow-hidden rounded-xl bg-(--lm-surface-2)">
        <VisuelLogement
          logement={l}
          decoratif
          className="aspect-[20/19] w-full transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        {/* « Actif » est l'état normal : seul un autre statut mérite une pastille. */}
        {!enLocation && <StatusBadge type="statutLogement" valeur={l.statut} className="absolute top-3 left-3 bg-white/95 shadow-sm" />}
      </div>
      <div className="mt-3 text-[14px] leading-snug">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate font-semibold text-(--lm-encre)">{l.nom}</h3>
          {stats.note !== undefined && (
            <span className="lm-chiffres flex shrink-0 items-center gap-1 text-(--lm-encre)" title="Note des voyageurs, 12 derniers mois">
              <Star className="size-3.5 fill-current" aria-hidden />
              <span className="sr-only">Note </span>
              {note(stats.note)}
            </span>
          )}
        </div>
        {taille.length > 0 && <p className="truncate text-(--lm-encre-2)">{taille.join(' · ')}</p>}
        <p className="truncate text-(--lm-encre-2)">{prochainEvenement(stats)}</p>
        {enLocation &&
          (prix ? (
            <p className="mt-1.5 text-(--lm-encre)" title={detailPrix}>
              <span className="lm-chiffres font-semibold">{euros(prix.centimes, true)}</span> par nuit
              {prix.source === 'constate' && <span className="text-(--lm-encre-2)"> · moyenne constatée</span>}
              <span className="sr-only"> ({detailPrix})</span>
            </p>
          ) : (
            <p className="mt-1.5 text-(--lm-encre-3)">Prix pas encore lu</p>
          ))}
      </div>
    </Link>
  );
}
