import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { cn, libelleStatut, TON_PLEIN, tonStatut } from '../../../ui';
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
 * Repère de la pastille posée sur la photo (comme « Coup de cœur voyageurs »
 * chez Airbnb) : le statut s'il n'est pas « Actif », sinon une arrivée du
 * jour (la ligne du dessous dit seulement « Occupé jusqu'au… »), sinon
 * « Nouveau » pour un logement sans séjour ni note. Rien d'autre : la note
 * est déjà sur la ligne du titre.
 */
function repere(l: Logement, s: StatsLogement): { texte: string; point?: string } | undefined {
  if (l.statut !== 'actif') return { texte: libelleStatut('statutLogement', l.statut), point: TON_PLEIN[tonStatut('statutLogement', l.statut)] };
  if (s.enCours?.arrivee === AUJOURDHUI) return { texte: 'Arrivée aujourd’hui' };
  if (s.note === undefined && s.revenu90 === 0) return { texte: 'Nouveau' };
  return undefined;
}

/**
 * Un logement, comme la carte d'annonce d'Airbnb : la photo d'abord (12 px),
 * une pastille blanche ombrée en haut à gauche, puis le nom (15 px, 600) et
 * « ★ 4,7 » à l'encre sur la même ligne, la ville et la taille, le prochain
 * événement en gris, et le prix de la nuit en 600. Un logement qui n'est pas
 * en location (en pause, en préparation, sorti) n'affiche pas de prix.
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
  const pastille = repere(l, stats);
  const taille = [
    l.ville,
    // « Autre » n'apprend rien : le type n'apparaît que s'il est connu.
    l.type !== 'autre' ? LIBELLES.typeLogement[l.type] : '',
    l.capacite ? pluriel(l.capacite, 'voyageur') : '',
  ].filter(Boolean);

  return (
    <Link
      to={l.id}
      className="group block rounded-xl focus-visible:ring-2 focus-visible:ring-(--lm-encre) focus-visible:ring-offset-4 focus-visible:ring-offset-(--lm-fond) focus:outline-none"
    >
      <div className="relative overflow-hidden rounded-xl bg-(--lm-surface-2)">
        <VisuelLogement logement={l} decoratif className="aspect-[20/19] w-full" />
        {pastille && (
          <span className="absolute top-3 left-3 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full bg-(--lm-surface) px-2.5 py-1 text-[12px] leading-tight font-semibold text-(--lm-encre) shadow-(--lm-ombre-haute)">
            {pastille.point && <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', pastille.point)} />}
            <span className="truncate">{pastille.texte}</span>
          </span>
        )}
      </div>
      <div className="mt-3 text-[14px] leading-snug">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="min-w-0 truncate text-[15px] font-semibold text-(--lm-encre) group-hover:underline">{l.nom}</h3>
          {stats.note !== undefined && (
            <span className="lm-chiffres flex shrink-0 items-center gap-1 text-(--lm-encre)" title="Note des voyageurs, 12 derniers mois">
              <Star className="size-3 self-center fill-current" aria-hidden />
              <span className="sr-only">Note </span>
              {note(stats.note)}
            </span>
          )}
        </div>
        {taille.length > 0 && <p className="truncate text-(--lm-encre-2)">{taille.join(' · ')}</p>}
        <p className="truncate text-(--lm-encre-2)">{prochainEvenement(stats)}</p>
        {enLocation &&
          (prix ? (
            <p className="mt-1 text-(--lm-encre)" title={detailPrix}>
              <span className="lm-chiffres font-semibold">{euros(prix.centimes, true)}</span> par nuit
              {prix.source === 'constate' && <span className="text-(--lm-encre-2)"> · moyenne constatée</span>}
              <span className="sr-only"> ({detailPrix})</span>
            </p>
          ) : (
            <p className="mt-1 text-(--lm-encre-2)">Prix pas encore lu</p>
          ))}
      </div>
    </Link>
  );
}
