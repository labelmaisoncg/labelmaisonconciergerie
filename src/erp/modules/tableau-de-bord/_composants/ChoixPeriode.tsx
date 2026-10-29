import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { AUJOURDHUI, ajouterJours, dateCourte, debutMois, debutMoisSuivant, ecartJours, jourMois, moisAnnee } from '../../../data/format';
import type { DateISO } from '../../../data/types';
import { cn } from '../../../ui';

/** Période, bornes comprises. */
export interface Periode {
  debut: DateISO;
  fin: DateISO;
}

const lundi = (d: DateISO) => ajouterJours(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));
const finMois = (d: DateISO) => ajouterJours(debutMoisSuivant(d), -1);
const moisPrecedent = (d: DateISO) => debutMois(ajouterJours(debutMois(d), -1));

export const RACCOURCIS: { libelle: string; periode: () => Periode }[] = [
  { libelle: 'Aujourd’hui', periode: () => ({ debut: AUJOURDHUI, fin: AUJOURDHUI }) },
  { libelle: 'Cette semaine', periode: () => ({ debut: lundi(AUJOURDHUI), fin: ajouterJours(lundi(AUJOURDHUI), 6) }) },
  { libelle: 'Ce mois-ci', periode: () => ({ debut: debutMois(AUJOURDHUI), fin: finMois(AUJOURDHUI) }) },
  { libelle: 'Le mois dernier', periode: () => ({ debut: moisPrecedent(AUJOURDHUI), fin: finMois(moisPrecedent(AUJOURDHUI)) }) },
];

/** « Aujourd'hui », « Cette semaine »… ou « 12 – 18 oct. ». */
export function libellePeriode(p: Periode): string {
  const r = RACCOURCIS.find((x) => {
    const q = x.periode();
    return q.debut === p.debut && q.fin === p.fin;
  });
  if (r) return r.libelle;
  const annee = (d: DateISO) => (d.slice(0, 4) === AUJOURDHUI.slice(0, 4) ? jourMois(d) : dateCourte(d));
  if (p.debut === p.fin) return annee(p.debut);
  // Même mois : « 10–20 sept. », sinon « 28 sept. – 4 oct. ».
  if (p.debut.slice(0, 7) === p.fin.slice(0, 7)) return `${Number(p.debut.slice(8))}–${annee(p.fin)}`;
  return `${annee(p.debut)} – ${annee(p.fin)}`;
}

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * Choix d'une période : quatre raccourcis, ou deux touches sur le calendrier
 * (premier puis dernier jour). Le choix s'applique tout de suite.
 */
export function ChoixPeriode({ valeur, onChange }: { valeur: Periode; onChange: (p: Periode) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [mois, setMois] = useState(debutMois(valeur.fin));
  const [premier, setPremier] = useState<DateISO | null>(null);
  // S'ouvre vers le haut quand la place manque sous le bouton.
  const [versLeHaut, setVersLeHaut] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (racine.current && !racine.current.contains(e.target as Node)) fermer(false);
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer(true);
    };
    document.addEventListener('mousedown', dehors);
    document.addEventListener('keydown', touche);
    return () => {
      document.removeEventListener('mousedown', dehors);
      document.removeEventListener('keydown', touche);
    };
  }, [ouvert]);

  const ouvrir = () => {
    const r = bouton.current?.getBoundingClientRect();
    setVersLeHaut(!!r && window.innerHeight - r.bottom < 420 && r.top >= 420);
    setMois(debutMois(valeur.fin));
    setPremier(null);
    setOuvert(true);
  };
  function fermer(rendreFocus: boolean) {
    setOuvert(false);
    setPremier(null);
    if (rendreFocus) bouton.current?.focus();
  }
  const choisir = (p: Periode) => {
    onChange(p);
    fermer(true);
  };
  const toucher = (jour: DateISO) => {
    if (!premier) {
      setPremier(jour);
      return;
    }
    choisir(jour < premier ? { debut: jour, fin: premier } : { debut: premier, fin: jour });
  };

  const decalage = (new Date(`${mois}T12:00:00Z`).getUTCDay() + 6) % 7;
  const nbJours = ecartJours(mois, debutMoisSuivant(mois));
  const cases: (DateISO | null)[] = [...Array<null>(decalage).fill(null), ...Array.from({ length: nbJours }, (_, i) => ajouterJours(mois, i))];
  const debut = premier ?? valeur.debut;
  const fin = premier ?? valeur.fin;

  return (
    <div ref={racine} className="relative">
      <button
        ref={bouton}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        onClick={() => (ouvert ? fermer(false) : ouvrir())}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--lm-bord-fort) bg-(--lm-surface) px-3 text-[13px] font-medium text-(--lm-encre) hover:shadow-(--lm-ombre-haute) focus-visible:ring-2 focus-visible:ring-(--lm-encre) focus:outline-none transition"
      >
        <CalendarDays className="size-4 text-(--lm-encre-2)" aria-hidden />
        {libellePeriode(valeur)}
        <ChevronDown className={cn('size-3.5 text-(--lm-encre-2) transition-transform', ouvert && 'rotate-180')} aria-hidden />
      </button>

      {ouvert && (
        <div
          role="dialog"
          aria-label="Choisir la période"
          className={cn(
            'lm-apparition absolute right-0 z-30 w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-(--lm-bord) bg-(--lm-surface) p-3 shadow-(--lm-ombre-haute)',
            versLeHaut ? 'bottom-full mb-2' : 'top-full mt-2',
          )}
        >
          <div className="grid grid-cols-2 gap-1.5 border-b border-(--lm-bord) pb-3">
            {RACCOURCIS.map((r) => {
              const p = r.periode();
              const actif = p.debut === valeur.debut && p.fin === valeur.fin && !premier;
              return (
                <button
                  key={r.libelle}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => choisir(p)}
                  className={cn(
                    'h-8 rounded-lg px-2.5 text-[12.5px] font-medium focus-visible:ring-2 focus-visible:ring-(--lm-encre) focus:outline-none',
                    actif ? 'bg-(--lm-or-lavis) text-(--lm-brun)' : 'bg-(--lm-surface-2) text-(--lm-encre-2) hover:text-(--lm-encre)',
                  )}
                >
                  {r.libelle}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              aria-label="Mois précédent"
              onClick={() => setMois(moisPrecedent(mois))}
              className="grid size-8 place-items-center rounded-lg text-(--lm-encre-2) hover:bg-(--lm-surface-2) focus-visible:ring-2 focus-visible:ring-(--lm-encre) focus:outline-none"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <p className="text-[13.5px] font-semibold text-(--lm-encre) first-letter:uppercase" aria-live="polite">
              {moisAnnee(mois)}
            </p>
            <button
              type="button"
              aria-label="Mois suivant"
              onClick={() => setMois(debutMoisSuivant(mois))}
              className="grid size-8 place-items-center rounded-lg text-(--lm-encre-2) hover:bg-(--lm-surface-2) focus-visible:ring-2 focus-visible:ring-(--lm-encre) focus:outline-none"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 text-center text-[11.5px] font-medium text-(--lm-encre-3)" aria-hidden>
            {JOURS.map((j, i) => (
              <span key={i} className="py-1">
                {j}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {cases.map((jour, i) => {
              if (!jour) return <span key={`v${i}`} />;
              const borne = jour === debut || jour === fin;
              const dedans = jour > debut && jour < fin;
              return (
                <span key={jour} className={cn('flex justify-center', dedans && 'bg-(--lm-or-lavis)', jour === debut && fin > debut && 'rounded-l-full bg-(--lm-or-lavis)', jour === fin && fin > debut && 'rounded-r-full bg-(--lm-or-lavis)')}>
                  <button
                    type="button"
                    aria-label={dateCourte(jour)}
                    aria-pressed={borne}
                    aria-current={jour === AUJOURDHUI ? 'date' : undefined}
                    onClick={() => toucher(jour)}
                    className={cn(
                      'lm-chiffres grid size-9 place-items-center rounded-full text-[13px] focus-visible:ring-2 focus-visible:ring-(--lm-encre) focus:outline-none',
                      borne ? 'bg-(--lm-or-texte) font-semibold text-white' : 'text-(--lm-encre) hover:bg-(--lm-surface-2)',
                      jour === AUJOURDHUI && !borne && 'font-semibold text-(--lm-encre) underline decoration-2 underline-offset-4',
                    )}
                  >
                    {Number(jour.slice(8))}
                  </button>
                </span>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[12.5px] text-(--lm-encre-2)" aria-live="polite">
            {premier ? `Du ${jourMois(premier)} : touchez le dernier jour.` : 'Touchez le premier jour, puis le dernier.'}
          </p>
        </div>
      )}
    </div>
  );
}
