import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Button, Skeleton, cn } from '../ui';
import { titreDuMois } from './CalendrierMois';
import { useMoisDefilants, type ChargeurMois } from './useMoisDefilants';

export interface CalendrierDefilantProps<T> {
  /** Mois affiché en premier (le mois en cours). */
  moisInitial: string;
  /** Mois déjà connus, par mois ; `charger` les complète dans le parent. */
  connus: Readonly<Record<string, T | undefined>>;
  charger: ChargeurMois;
  /** Rend un mois dont les données sont là (CalendrierMois, en général). */
  rendreMois: (mois: string, donnees: T) => ReactNode;
  /** Vrai quand le mois le plus ancien chargé est un butoir (tout avant l'arrivée du propriétaire) : plus de « Mois précédents ». */
  butoirArriere?: (donnees: T) => boolean;
  pas?: number;
  arriereMax?: number;
  avantMax?: number;
  className?: string;
}

/** Squelette d'un mois : titre, initiales, six semaines. */
function SqueletteMois({ mois }: { mois: string }) {
  return (
    <div role="status" aria-label={`Chargement, ${titreDuMois(mois).toLocaleLowerCase('fr')}`} className="px-1">
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3.5 w-44 max-w-[45%]" />
      </div>
      <Skeleton className="mt-3 h-4 w-full" />
      <div className="mt-2 space-y-5 py-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    </div>
  );
}

/**
 * Fait défiler de `delta` ce qui porte le défilement de `el` (une boîte qui
 * défile, sinon la page), d'un coup : le site anime les défilements
 * (scroll-behavior: smooth), un recalage doit rester invisible.
 */
function defiler(el: HTMLElement, delta: number) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) {
      p.scrollBy({ top: delta, behavior: 'instant' });
      return;
    }
  }
  window.scrollBy({ top: delta, behavior: 'instant' });
}

/**
 * Des mois qui défilent à la verticale, comme sur Airbnb : le mois en cours
 * puis les suivants, chargés au fur et à mesure qu'on approche du bas ; un
 * bouton « Mois précédents » en haut. Un mois qui arrive se montre d'abord
 * en squelette ; quand des mois s'ajoutent au-dessus, la page ne saute pas
 * (le premier mois visible reste à sa place).
 */
export function CalendrierDefilant<T>({ moisInitial, connus, charger, rendreMois, butoirArriere, pas, arriereMax, avantMax, className }: CalendrierDefilantProps<T>) {
  const d = useMoisDefilants({ moisInitial, connus, charger, pas, arriereMax, avantMax });
  const conteneur = useRef<HTMLDivElement>(null);
  const sentinelle = useRef<HTMLDivElement>(null);
  // Mois à garder à la même place à l'écran pendant que d'autres s'ajoutent au-dessus.
  const ancre = useRef<{ mois: string; haut: number } | null>(null);
  const [sansObservateur] = useState(() => typeof IntersectionObserver === 'undefined');

  const voirArriere = () => {
    const premier = d.mois[0];
    const el = conteneur.current?.querySelector<HTMLElement>(`[data-mois="${premier}"]`);
    if (el) ancre.current = { mois: premier, haut: el.getBoundingClientRect().top };
    d.voirArriere();
  };

  useLayoutEffect(() => {
    const a = ancre.current;
    if (!a || !conteneur.current) return;
    const el = conteneur.current.querySelector<HTMLElement>(`[data-mois="${a.mois}"]`);
    if (!el) {
      ancre.current = null;
      return;
    }
    const delta = el.getBoundingClientRect().top - a.haut;
    if (delta) defiler(conteneur.current, delta);
    // L'ancre tient tant que des mois au-dessus d'elle sont encore en squelette (leur hauteur va changer).
    if (d.mois.slice(0, d.mois.indexOf(a.mois)).every((m) => connus[m] !== undefined)) ancre.current = null;
  });

  // Approche du bas : les trois mois suivants.
  const { peutAvant, chargementAvant, voirAvant } = d;
  const nbMois = d.mois.length;
  useEffect(() => {
    const el = sentinelle.current;
    if (!el || !peutAvant || chargementAvant || sansObservateur) return;
    const io = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) voirAvant();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [peutAvant, chargementAvant, voirAvant, sansObservateur, nbMois]);

  const chargement = d.chargementArriere || d.chargementAvant;
  const premier = connus[d.mois[0]];
  const butoir = !!butoirArriere && premier !== undefined && butoirArriere(premier);
  return (
    <div ref={conteneur} className={cn('[overflow-anchor:none]', className)} aria-busy={chargement || undefined}>
      {d.peutArriere && !butoir && (
        <div className="mb-4 flex justify-center">
          <Button variant="ghost" size="sm" chargement={d.chargementArriere} onClick={voirArriere} className="max-sm:min-h-11">
            Mois précédents
          </Button>
        </div>
      )}
      {d.erreur && (
        <Alert tone="danger" className="mb-4">
          {d.erreur}{' '}
          <button type="button" onClick={d.reessayer} className="font-medium lm-lien">
            Réessayer
          </button>
        </Alert>
      )}
      <div className="space-y-8">
        {d.mois.map((m) => {
          const donnees = connus[m];
          return (
            <div key={m} data-mois={m}>
              {donnees !== undefined ? rendreMois(m, donnees) : <SqueletteMois mois={m} />}
            </div>
          );
        })}
      </div>
      <div ref={sentinelle} aria-hidden className="h-px" />
      {sansObservateur && d.peutAvant && (
        <div className="mt-4 flex justify-center">
          <Button variant="ghost" size="sm" chargement={d.chargementAvant} onClick={d.voirAvant} className="max-sm:min-h-11">
            Mois suivants
          </Button>
        </div>
      )}
    </div>
  );
}
