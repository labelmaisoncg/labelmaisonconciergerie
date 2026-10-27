import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dateCourte, jourMois, pluriel, pourcentage } from '../data/format';
import { moisPrecedent, moisSuivant } from '../data/proprietaire';
import type { CalendrierLogement, JourCalendrier, VueProprietaire } from '../data/types-proprietaire';
import { Card, cn } from '../ui';
import { CANAL, TitreEspace, titreMois } from './commun';

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const BANDE = 'absolute inset-y-1.5 bg-(--lm-or)/40';

/**
 * Un jour : la bande dorée couvre les nuits réservées. Elle commence au
 * milieu du jour d'arrivée et s'arrête au milieu du jour de départ, comme
 * sur Airbnb ; un jour de chassé-croisé montre deux bandes séparées.
 */
function Jour({ j, aujourdhui }: { j: JourCalendrier; aujourdhui: string }) {
  const changement = j.depart && j.arrivee;
  // Jour qui n'est pas à lui (avant son arrivée, après son départ) : grisé, ni libre ni réservé.
  if (j.hors) {
    return (
      <div className="relative h-11 sm:h-12">
        <span className="lm-chiffres relative grid h-full place-items-center bg-(--lm-surface-2) text-[13.5px] text-(--lm-encre-3)">{Number(j.date.slice(8))}</span>
      </div>
    );
  }
  return (
    <div className="relative h-11 sm:h-12">
      {j.veille && <span className={cn(BANDE, 'left-0', changement ? 'right-[calc(50%+2px)]' : 'right-1/2', j.depart && 'rounded-r-full')} aria-hidden />}
      {j.occupe && <span className={cn(BANDE, 'right-0', changement ? 'left-[calc(50%+2px)]' : 'left-1/2', j.arrivee && 'rounded-l-full')} aria-hidden />}
      <span
        className={cn(
          'lm-chiffres relative grid h-full place-items-center text-[13.5px]',
          j.date === aujourdhui ? 'font-semibold text-(--lm-or-texte) underline decoration-2 underline-offset-4' : 'text-(--lm-encre)',
        )}
      >
        {Number(j.date.slice(8))}
      </span>
    </div>
  );
}

const HORS = { avant: 'Avant votre arrivée', apres: 'Après votre départ', autre: 'Séjour de l’ancien propriétaire' } as const;

function libelleJour(j: JourCalendrier): string {
  if (j.hors) return `${jourMois(j.date)} : ${HORS[j.hors].toLowerCase()}`;
  const etat = j.arrivee && j.depart ? 'départ et arrivée' : j.arrivee ? 'arrivée' : j.depart ? 'départ' : j.occupe ? 'réservé' : 'libre';
  return `${jourMois(j.date)} : ${etat}`;
}

function Mois({ c, aujourdhui }: { c: CalendrierLogement; aujourdhui: string }) {
  const premier = c.jours[0]?.date;
  const decalage = premier ? (new Date(`${premier}T12:00:00Z`).getUTCDay() + 6) % 7 : 0;
  return (
    <>
      <div className="grid grid-cols-7 text-center text-[11.5px] font-medium text-(--lm-encre-3)" aria-hidden>
        {JOURS.map((j, i) => (
          <span key={i} className="py-1.5">
            {j}
          </span>
        ))}
      </div>
      <ul className="grid grid-cols-7" aria-label="Jours du mois">
        {Array.from({ length: decalage }, (_, i) => (
          <li key={`v${i}`} aria-hidden />
        ))}
        {c.jours.map((j) => (
          <li key={j.date} aria-label={libelleJour(j)}>
            <Jour j={j} aujourdhui={aujourdhui} />
          </li>
        ))}
      </ul>
    </>
  );
}

export function Calendrier({ vue, onMois, enCours }: { vue: VueProprietaire; onMois: (mois: string) => void; enCours?: boolean }) {
  // Ses logements, puis ceux qu'il a cédés (calendrier borné à sa période).
  const choixPossibles = [...vue.logements.map((l) => ({ id: l.id, nom: l.nom })), ...vue.logementsCedes.map((l) => ({ id: l.id, nom: l.nom }))];
  const [choix, setChoix] = useState(choixPossibles[0]?.id);
  const mois = vue.calendrier.mois;
  const c = vue.calendrier.logements.find((x) => x.logementId === choix) ?? vue.calendrier.logements[0];
  const cede = vue.logementsCedes.find((l) => l.id === c?.logementId);
  const hors = new Set(c?.jours.map((j) => j.hors).filter((x): x is 'avant' | 'apres' | 'autre' => !!x));
  const bouton =
    'grid size-9 place-items-center rounded-lg border border-(--lm-bord-fort) bg-(--lm-surface) text-(--lm-encre-2) hover:text-(--lm-encre) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none disabled:opacity-50';
  return (
    <>
      <TitreEspace titre="Calendrier" description="Les nuits réservées et libres, avec les arrivées et les départs." />

      {choixPossibles.length > 1 && (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Logement">
          {choixPossibles.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={l.id === c?.logementId}
              onClick={() => setChoix(l.id)}
              className={cn(
                'h-9 shrink-0 rounded-full border px-4 text-[13.5px] font-medium focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none',
                l.id === c?.logementId ? 'border-(--lm-encre) bg-(--lm-encre) text-white' : 'border-(--lm-bord-fort) bg-(--lm-surface) text-(--lm-encre) hover:border-(--lm-encre-3)',
              )}
            >
              {l.nom}
            </button>
          ))}
        </div>
      )}

      {(cede || hors.size > 0) && (
        <p className="mb-3 text-[13.5px] text-(--lm-encre-2)">
          {[
            cede && `${cede.nom} : plus en gestion pour vous depuis le ${dateCourte(cede.jusquAu)}.`,
            'Le calendrier montre votre période seulement.',
            // Jours grisés dans sa période : le séjour de l'ancien propriétaire, arrivé avant le changement.
            hors.has('autre') && 'Le séjour en cours au changement reste à l’ancien propriétaire.',
          ]
            .filter(Boolean)
            .join(' ')}
        </p>
      )}
      {!c ? (
        <p className="text-[14px] text-(--lm-encre-2)">Aucun logement en gestion pour l’instant.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card aria-busy={enCours || undefined}>
            <div className="flex items-center justify-between gap-2">
              <button type="button" className={bouton} aria-label="Mois précédent" disabled={enCours} onClick={() => onMois(moisPrecedent(mois))}>
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <p className="text-[16px] font-semibold text-(--lm-encre)" aria-live="polite">
                {titreMois(mois)}
              </p>
              <button type="button" className={bouton} aria-label="Mois suivant" disabled={enCours} onClick={() => onMois(moisSuivant(mois))}>
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
            <div className={cn('mt-3 transition-opacity', enCours && 'opacity-50')}>
              <Mois c={c} aujourdhui={vue.aujourdhui} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-(--lm-bord) pt-3 text-[12.5px] text-(--lm-encre-2)">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-5 rounded-full bg-(--lm-or)/25" aria-hidden />
                Réservé
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-5 rounded-full border border-(--lm-bord-fort)" aria-hidden />
                Libre
              </span>
              {/* Un seul gris, une seule entrée : le détail (avant, après, séjour de l'ancien) est dans la phrase et le libellé de chaque jour. */}
              {hors.size > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-5 rounded-full border border-(--lm-bord) bg-(--lm-surface-2)" aria-hidden />
                  Hors de votre période
                </span>
              )}
              <span>La bande commence le jour d’arrivée et s’arrête le jour du départ.</span>
            </div>
          </Card>

          <div className="space-y-4">
            <Card flush>
              <dl className="grid grid-cols-3 divide-x divide-(--lm-bord)">
                {[
                  { libelle: 'Nuits réservées', valeur: String(c.nuitsReservees) },
                  { libelle: 'Nuits libres', valeur: String(c.nuitsLibres) },
                  { libelle: 'Occupation', valeur: pourcentage(c.occupation) },
                ].map((x) => (
                  <div key={x.libelle} className="px-3 py-3.5">
                    <dt className="text-[12px] text-(--lm-encre-2)">{x.libelle}</dt>
                    <dd className="lm-chiffres mt-0.5 text-[18px] font-semibold text-(--lm-encre)">{x.valeur}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card flush>
              <p className="border-b border-(--lm-bord) px-4 py-3 text-[14px] font-semibold text-(--lm-encre)">Séjours du mois</p>
              {c.sejours.length ? (
                <ul className="divide-y divide-(--lm-bord)">
                  {c.sejours.map((s) => (
                    <li key={`${s.arrivee}-${s.depart}`} className="px-4 py-2.5">
                      <p className="flex items-baseline justify-between gap-2 text-[14px]">
                        <span className="font-medium text-(--lm-encre)">
                          {jourMois(s.arrivee)} → {jourMois(s.depart)}
                        </span>
                        <span className="lm-chiffres shrink-0 text-[13px] text-(--lm-encre-2)">{pluriel(s.nuits, 'nuit')}</span>
                      </p>
                      <p className="text-[13px] text-(--lm-encre-2)">
                        {s.voyageur} · {pluriel(s.nbPersonnes, 'voyageur')} · {CANAL[s.canal]}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-[13.5px] text-(--lm-encre-2)">Aucun séjour ce mois-ci.</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
