import { useId } from 'react';
import type { DateISO } from '../data/types';
import { cn } from '../ui';
import { JOURS_SEMAINE, bandesDuMois, libelleJour, libelleSejour, lignesDuMois, type BandeCalendrier, type JourCalendrier, type SejourCalendrier } from './calendrier-mois';

export interface CalendrierMoisProps {
  /** « 2026-10 ». */
  mois: string;
  jours: readonly JourCalendrier[];
  sejours: readonly SejourCalendrier[];
  aujourdhui: DateISO;
  /** Ligne discrète à droite du titre (« 12 nuits réservées · 19 libres · 39 % »). */
  chiffres?: string;
  /** Texte posé sur la bande : « Prénom N. » (propriétaire) ou le prénom complet (ERP). Par défaut, `voyageur`. */
  libelleBande?: (s: SejourCalendrier) => string;
  /** Toucher une bande ; sans, les bandes ne sont pas des boutons. */
  onSejour?: (s: SejourCalendrier) => void;
  /** Niveau du titre du mois dans la page. */
  niveauTitre?: 2 | 3;
  className?: string;
}

/** « Octobre 2026 ». */
export function titreDuMois(mois: string): string {
  const t = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${mois}-01T12:00:00Z`));
  return t.charAt(0).toLocaleUpperCase('fr') + t.slice(1);
}

const pc = (x: number) => `${(x / 7) * 100}%`;

/**
 * Une bande : du milieu du jour d'arrivée au milieu du jour de départ,
 * noire, nom en blanc une fois au début. Le bouton prend la hauteur de la
 * ligne (cible de toucher) ; la bande visible est dedans.
 */
function Bande({ b, libelle, onSejour }: { b: BandeCalendrier; libelle: string; onSejour?: (s: SejourCalendrier) => void }) {
  const position = {
    left: b.arrivee ? `calc(${pc(b.de)} + 2px)` : pc(b.de),
    right: b.depart ? `calc(${pc(7 - b.a)} + 2px)` : pc(7 - b.a),
  };
  const visuel = cn(
    'absolute inset-x-0 top-8 flex h-6 items-center overflow-hidden bg-(--lm-encre) text-white',
    b.arrivee && 'rounded-l-full',
    b.depart && 'rounded-r-full',
  );
  const texte = b.libelle ? <span className="min-w-0 truncate px-2 text-[12px] leading-6 font-semibold">{libelle}</span> : null;
  if (!onSejour) {
    return (
      <span className="absolute inset-y-0" style={position} aria-hidden>
        <span className={visuel}>{texte}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onSejour(b.sejour)}
      aria-label={libelleSejour(b.sejour, libelle)}
      className="absolute inset-y-0 focus:outline-none [&:focus-visible>span]:ring-2 [&:focus-visible>span]:ring-(--lm-encre) [&:focus-visible>span]:ring-offset-2 [&:focus-visible>span]:ring-offset-(--lm-surface)"
      style={position}
    >
      <span className={visuel} aria-hidden>
        {texte}
      </span>
    </button>
  );
}

/**
 * Un mois, à la manière de l'app Airbnb (côté hôte) : titre à gauche, les
 * initiales des jours en gris, les chiffres centrés, les séjours en bandes
 * noires avec le nom du voyageur. Les jours passés sont en retrait,
 * aujourd'hui porte un point ; un jour hors de la période du propriétaire
 * est grisé. Rien n'est dit par la couleur seule : chaque jour a son libellé
 * et chaque bande est un bouton nommé.
 */
export function CalendrierMois({ mois, jours, sejours, aujourdhui, chiffres, libelleBande, onSejour, niveauTitre = 2, className }: CalendrierMoisProps) {
  const titreId = useId();
  const lignes = lignesDuMois(mois, jours);
  const bandes = bandesDuMois(mois, jours, sejours);
  const Titre = niveauTitre === 3 ? 'h3' : 'h2';
  const titre = titreDuMois(mois);
  return (
    <section aria-labelledby={titreId} className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1">
        <Titre id={titreId} className="text-[16px] leading-6 font-semibold text-(--lm-encre)">
          {titre}
        </Titre>
        {chiffres && <p className="lm-chiffres text-[12.5px] leading-5 text-(--lm-encre-2)">{chiffres}</p>}
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[11.5px] leading-4 font-medium text-(--lm-encre-3)" aria-hidden>
        {JOURS_SEMAINE.map((j, i) => (
          <span key={i} className="py-1">
            {j}
          </span>
        ))}
      </div>
      <div role="list" aria-label={`Jours, ${titre.toLocaleLowerCase('fr')}`}>
        {lignes.map((ligne, i) => (
          <div key={i} className="relative grid h-15 grid-cols-7 sm:h-16">
            {ligne.map((j, c) =>
              j ? (
                <div key={j.date} role="listitem" aria-label={libelleJour(j, sejours, aujourdhui)} className={cn('relative', j.hors && 'bg-(--lm-surface-2)')}>
                  <span
                    className={cn(
                      'lm-chiffres absolute inset-x-0 top-1 text-center text-[14px] leading-5',
                      j.date === aujourdhui ? 'font-semibold text-(--lm-encre)' : j.hors || j.date < aujourdhui ? 'text-(--lm-encre-3)' : 'text-(--lm-encre)',
                    )}
                    aria-hidden
                  >
                    {Number(j.date.slice(8))}
                  </span>
                  {j.date === aujourdhui && <span className="absolute top-[25px] left-1/2 size-1 -translate-x-1/2 rounded-full bg-(--lm-encre)" aria-hidden />}
                </div>
              ) : (
                <div key={`v${c}`} aria-hidden />
              ),
            )}
            {bandes
              .filter((b) => b.ligne === i)
              .map((b) => (
                <Bande key={`${b.sejour.arrivee}-${b.sejour.depart}`} b={b} libelle={libelleBande ? libelleBande(b.sejour) : b.sejour.voyageur} onSejour={onSejour} />
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
