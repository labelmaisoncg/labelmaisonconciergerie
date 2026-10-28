/**
 * Carte des logements, la même dans les trois espaces (accueil du gérant,
 * espace propriétaire, espace opérations) : un point par logement, sa
 * couleur et son icône disent l'état du jour (réservé, libre, ménage), un
 * « ! » dit qu'un problème est signalé. La légende compte et filtre ; un
 * toucher ouvre la fiche (feuille en bas sur téléphone, carte à droite sur
 * ordinateur), avec une seule action, propre à l'espace.
 *
 * Le fond de carte (MapLibre, OpenFreeMap) est chargé à part, seulement
 * ici ; sans WebGL, ou sans logement placé, la liste le remplace. Les
 * logements sans position sont nommés sous la carte ; le gérant peut les
 * placer (aPlacer). Rien n'est calculé ici : les points arrivent déjà
 * réduits à ce que l'espace voit (data/carte.ts, carte/points.ts).
 */
import { Component, Suspense, lazy, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { compterCarte, garderPoint, trierPoints, type FiltreCarte, type PointCarte } from '../data/carte';
import type { DateISO, Id } from '../data/types';
import { Badge, Button, FilterChips, IconButton, cn, useLienFichier, type Filtre } from '../ui';
import { BadgeProbleme, PastilleEtat } from './Pastille';
import { ligneMenage, motEtat, phraseDuJour, phraseLegende, titreEtat } from './phrases';

const FondCarte = lazy(() => import('./FondCarte'));

/** L'action de la fiche : une seule par espace (ouvrir le logement, l'incident…). */
export interface ActionCarte {
  libelle: string;
  onClick: () => void;
}

export interface CarteLogementsProps {
  points: PointCarte[];
  aujourdhui: DateISO;
  action: (p: PointCarte) => ActionCarte | null;
  /** Sous les logements pas encore placés (gérant : « Placer … sur la carte »). */
  aPlacer?: ReactNode;
  className?: string;
}

/** Chargement du fond de carte impossible (réseau, navigateur) : la liste prend le relais. */
class GardeCarte extends Component<{ onErreur: () => void; children: ReactNode }, { echec: boolean }> {
  state = { echec: false };
  static getDerivedStateFromError() {
    return { echec: true };
  }
  componentDidCatch() {
    this.props.onErreur();
  }
  render() {
    return this.state.echec ? null : this.props.children;
  }
}

function Photo({ url, className }: { url?: string; className?: string }) {
  const lien = useLienFichier(url);
  const [casse, setCasse] = useState<string>();
  if (lien && casse !== lien) {
    return <img src={lien} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setCasse(lien)} className={cn('bg-(--lm-surface-2) object-cover', className)} />;
  }
  return <span aria-hidden className={cn('block bg-(--lm-surface-2)', className)} />;
}

/** Fiche d'un logement : ce qui se passe aujourd'hui, en quelques lignes, et l'action de l'espace. */
function Fiche({ p, aujourdhui, action, surCarte, onFermer }: { p: PointCarte; aujourdhui: DateISO; action: ActionCarte | null; surCarte: boolean; onFermer: () => void }) {
  const titreId = useId();
  const ref = useRef<HTMLDivElement>(null);
  // Focus dans la fiche à l'ouverture (sans faire défiler), rendu au repère à la fermeture.
  useEffect(() => {
    const avant = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => {
      if (avant?.isConnected) avant.focus({ preventScroll: true });
    };
  }, [p.id]);
  useEffect(() => {
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    document.addEventListener('keydown', touche);
    return () => document.removeEventListener('keydown', touche);
  }, [onFermer]);
  const approx = p.position?.precision === 'commune';
  const menage = ligneMenage(p);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titreId}
      tabIndex={-1}
      className={cn(
        'lm-apparition fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-(--lm-bord) bg-(--lm-surface) pb-[env(safe-area-inset-bottom)] shadow-(--lm-ombre-haute) outline-none',
        surCarte
          ? 'md:absolute md:inset-x-auto md:top-3 md:right-3 md:bottom-auto md:max-h-[calc(100%-1.5rem)] md:w-[332px] md:rounded-lg md:border md:pb-0'
          : 'md:static md:mb-3 md:max-w-md md:rounded-xl md:border md:pb-0 md:shadow-(--lm-ombre)',
      )}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <Photo url={p.photo} className="size-16 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <h3 id={titreId} className="truncate text-[15px] font-semibold text-(--lm-encre)">
            {p.nom}
          </h3>
          <p className="truncate text-[13px] text-(--lm-encre-2)">{approx ? `${p.ville} · position approximative` : p.ville}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-(--lm-encre)">
            <PastilleEtat etat={p.etat} />
            {titreEtat(p.etat)}
          </p>
        </div>
        <IconButton label="Fermer la fiche" size="sm" onClick={onFermer} className="-mt-1 -mr-1">
          <X />
        </IconButton>
      </div>
      <div className="space-y-2 px-4 pb-4 text-[13.5px]">
        <p className="text-(--lm-encre)">{phraseDuJour(p, aujourdhui)}</p>
        {menage && <p className="text-(--lm-encre-2)">{menage}</p>}
        {p.problemes.slice(0, 2).map((x, k) => (
          <p key={x.id ?? k} className="flex items-start gap-2 text-(--lm-encre)">
            <BadgeProbleme className="mt-0.5 size-4 text-[10.5px] ring-0" />
            <span className="line-clamp-2 min-w-0 flex-1">
              <span className="font-medium">Problème signalé</span> : {x.titre}
            </span>
            {x.urgent && <Badge tone="danger">Urgent</Badge>}
          </p>
        ))}
        {p.problemes.length > 2 && <p className="text-(--lm-encre-2)">Et {p.problemes.length - 2} autre{p.problemes.length > 3 ? 's' : ''}.</p>}
        {p.note && <p className="text-(--lm-encre-2)">{p.note}</p>}
        {action && (
          <Button
            className="mt-1 w-full"
            onClick={() => {
              // La fiche se ferme : le panneau ou la page ouverte prend la main (et Échap ne ferme qu'elle).
              onFermer();
              action.onClick();
            }}
          >
            {action.libelle}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Une ligne de la liste : le point, le nom, la phrase du jour. */
function LigneLogement({ p, aujourdhui, choisi, onClick }: { p: PointCarte; aujourdhui: DateISO; choisi: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={choisi}
        onClick={onClick}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-(--lm-surface-2) focus-visible:bg-(--lm-surface-2) focus:outline-none"
      >
        <PastilleEtat etat={p.etat} probleme={p.problemes.length > 0} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-(--lm-encre)">
            {p.nom}
            <span className="sr-only">
              {' '}
              : {motEtat(p.etat)}
              {p.problemes.length ? ', problème signalé' : ''}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[12.5px] text-(--lm-encre-2)">{p.problemes.length ? `Problème signalé · ${phraseDuJour(p, aujourdhui)}` : phraseDuJour(p, aujourdhui)}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
      </button>
    </li>
  );
}

export function CarteLogements({ points, aujourdhui, action, aPlacer, className }: CarteLogementsProps) {
  const listeId = useId();
  const [filtre, setFiltre] = useState<FiltreCarte | null>(null);
  const [choisi, setChoisi] = useState<Id>();
  const [sansCarte, setSansCarte] = useState(false);
  const [liste, setListe] = useState(false);

  const tries = useMemo(() => trierPoints(points), [points]);
  const places = useMemo(() => tries.filter((p) => p.position), [tries]);
  const visibles = useMemo(() => new Set(tries.filter((p) => garderPoint(p, filtre)).map((p) => p.id)), [tries, filtre]);
  const comptes = compterCarte(points);
  const avecCarte = places.length > 0 && !sansCarte;
  const nonPlaces = tries.filter((p) => !p.position);
  const point = choisi ? points.find((p) => p.id === choisi) : undefined;

  // Un logement écarté par le filtre (ou disparu) ferme sa fiche.
  useEffect(() => {
    if (choisi && !visibles.has(choisi)) setChoisi(undefined);
  }, [choisi, visibles]);

  // Téléphone : la feuille couvre le bas de l'écran ; la carte remonte au-dessus pour rester visible.
  const cadre = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cadre.current;
    if (!choisi || !el || !window.matchMedia('(max-width: 767px)').matches) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight * 0.5 || r.top < 0) {
      const doux = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollBy({ top: r.top - 72, behavior: doux ? 'smooth' : 'auto' });
    }
  }, [choisi]);

  if (!points.length) return null;

  const filtres: Filtre[] = [
    ...(['reserve', 'libre', 'menage'] as const)
      .filter((e) => comptes[e] > 0)
      .map((e) => ({
        cle: e,
        libelle: (
          <>
            <PastilleEtat etat={e} />
            <span className="lm-chiffres text-(--lm-encre)">{comptes[e]}</span>
            {motEtat(e, comptes[e])}
          </>
        ),
      })),
    ...(comptes.probleme
      ? [
          {
            cle: 'probleme',
            libelle: (
              <>
                <BadgeProbleme className="size-5 text-[11px] ring-0" />
                <span className="lm-chiffres text-(--lm-encre)">{comptes.probleme}</span>
                {comptes.probleme > 1 ? 'problèmes' : 'problème'}
              </>
            ),
          },
        ]
      : []),
  ];
  const choisir = (id: Id) => setChoisi((c) => (c === id ? undefined : id));
  const montrerListe = liste || !avecCarte;
  const visiblesTries = tries.filter((p) => visibles.has(p.id));

  return (
    <div className={className}>
      <p className="sr-only" aria-live="polite">
        {phraseLegende(comptes)}
      </p>
      <FilterChips label="Filtrer les logements" unique filtres={filtres} actifs={filtre ? [filtre] : []} onChange={(a) => setFiltre((a[0] as FiltreCarte | undefined) ?? null)} className="mb-3" />

      <div className="relative">
        {avecCarte && (
          <div ref={cadre} className="relative h-[280px] overflow-hidden rounded-xl border border-(--lm-bord) bg-(--lm-surface-2) sm:h-[340px] lg:h-[380px]">
            <GardeCarte onErreur={() => setSansCarte(true)}>
              <Suspense fallback={<div aria-hidden className="lm-squelette absolute inset-0" />}>
                <FondCarte points={places} visibles={visibles} choisi={choisi} onChoisir={choisir} onFond={() => setChoisi(undefined)} onErreur={() => setSansCarte(true)} />
              </Suspense>
            </GardeCarte>
          </div>
        )}
        {point && <Fiche key={point.id} p={point} aujourdhui={aujourdhui} action={action(point)} surCarte={avecCarte} onFermer={() => setChoisi(undefined)} />}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {avecCarte && nonPlaces.length > 0 ? (
          <p className="min-w-0 text-[13px] text-(--lm-encre-2)">
            Pas encore sur la carte :{' '}
            {nonPlaces.map((p, k) => (
              <span key={p.id}>
                {k > 0 && ', '}
                <button type="button" onClick={() => choisir(p.id)} className="inline-flex min-h-8 items-center font-medium text-(--lm-encre) underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none">
                  {p.nom}
                </button>
              </span>
            ))}
          </p>
        ) : !avecCarte ? (
          <p className="text-[13px] text-(--lm-encre-2)">{sansCarte ? 'La carte ne s’affiche pas sur cet appareil : voici la liste.' : 'Aucun logement n’est encore sur la carte.'}</p>
        ) : (
          <span />
        )}
        {avecCarte && (
          <button
            type="button"
            aria-expanded={liste}
            aria-controls={listeId}
            onClick={() => setListe((x) => !x)}
            className="inline-flex min-h-8 items-center rounded-md px-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
          >
            {liste ? 'Masquer la liste' : 'Voir en liste'}
          </button>
        )}
      </div>
      {aPlacer && <div className="mt-2">{aPlacer}</div>}

      {montrerListe && (
        <ul id={listeId} aria-label="Logements" className="mt-3 divide-y divide-(--lm-bord) overflow-hidden rounded-xl border border-(--lm-bord) bg-(--lm-surface) shadow-(--lm-ombre)">
          {visiblesTries.map((p) => (
            <LigneLogement key={p.id} p={p} aujourdhui={aujourdhui} choisi={choisi === p.id} onClick={() => choisir(p.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}
