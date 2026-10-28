/**
 * Fond de carte, chargé à part (import dynamique) : seulement sur les pages
 * qui montrent la carte. MapLibre GL et les tuiles vectorielles d'OpenFreeMap
 * (style « Positron » : gratuit, sans clé ni cookie, usage commercial
 * permis ; crédits OpenFreeMap, OpenMapTiles et OpenStreetMap toujours
 * affichés, comme ils le demandent).
 *
 * Les repères sont des boutons React posés sur la carte (portails) : on les
 * atteint au clavier, chacun dit le logement et son état, avec la même
 * pastille que la légende. Gestes « coopératifs » : un doigt fait défiler la
 * page, deux doigts déplacent la carte ; sur ordinateur, Ctrl (⌘) + molette
 * pour zoomer. Pas de rotation ni d'inclinaison.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LngLatBounds, Map as CarteMapLibre, Marker, NavigationControl, setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import urlTravailleur from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { PointCarte } from '../data/carte';
import type { Id } from '../data/types';
import { cn } from '../ui';
import { ecartements } from './ecartement';
import { PastilleEtat } from './Pastille';
import { libelleRepere } from './phrases';

setWorkerUrl(urlTravailleur);

/** Style de fond : OpenFreeMap « Positron » (clair, discret sous les repères). */
export const STYLE_CARTE = 'https://tiles.openfreemap.org/styles/positron';

/** Textes des commandes de la carte, en français. */
const TEXTES: Record<string, string> = {
  'AttributionControl.ToggleAttribution': 'Afficher ou masquer les crédits',
  'AttributionControl.MapFeedback': 'Signaler une erreur sur la carte',
  'Map.Title': 'Carte des logements',
  'NavigationControl.ZoomIn': 'Zoomer',
  'NavigationControl.ZoomOut': 'Dézoomer',
  'NavigationControl.ResetBearing': 'Remettre le nord en haut',
  'CooperativeGesturesHandler.WindowsHelpText': 'Ctrl + molette pour zoomer sur la carte',
  'CooperativeGesturesHandler.MacHelpText': '⌘ + molette pour zoomer sur la carte',
  'CooperativeGesturesHandler.MobileHelpText': 'Deux doigts pour déplacer la carte',
};

/**
 * Le style compare la longueur d'un numéro de route (« ref_length ») sans
 * valeur par défaut : la bibliothèque le signale dans la console pour chaque
 * route sans numéro. Même rendu, sans ces avertissements : 99 quand il manque.
 */
function sansRouteSansNumero<T>(v: T): T {
  if (!Array.isArray(v)) return v;
  if (v.length === 2 && v[0] === 'get' && v[1] === 'ref_length') return ['coalesce', v, 99] as unknown as T;
  return v.map(sansRouteSansNumero) as unknown as T;
}
const corrigerStyle = (_avant: StyleSpecification | undefined, style: StyleSpecification): StyleSpecification => ({
  ...style,
  layers: style.layers.map((l) => ('filter' in l && l.filter ? { ...l, filter: sansRouteSansNumero(l.filter) } : l)),
});

/** Vue de départ sans repère : l'Essonne. */
const CENTRE_DEPART: [number, number] = [2.35, 48.6];
const ZOOM_MAX_CADRAGE = 13;
/** Un seul logement : assez large pour voir la commune autour. */
const ZOOM_UN_LOGEMENT = 12.5;
/** Largeur de la fiche ouverte sur ordinateur (côté droit de la carte), marge comprise. */
const LARGEUR_FICHE = 356;

export interface FondCarteProps {
  /** Logements placés (avec position). */
  points: PointCarte[];
  /** Ceux que le filtre de la légende garde. */
  visibles: ReadonlySet<Id>;
  choisi?: Id;
  onChoisir: (id: Id) => void;
  /** Toucher le fond de carte (hors repère) : ferme la fiche. */
  onFond: () => void;
  /** Carte impossible (pas de WebGL) : l'écran passe à la liste. */
  onErreur: () => void;
}

function Repere({ p, choisi, onClick }: { p: PointCarte; choisi: boolean; onClick: () => void }) {
  const approx = p.position?.precision === 'commune';
  return (
    <button
      type="button"
      aria-label={libelleRepere(p)}
      aria-pressed={choisi}
      title={p.nom}
      onClick={onClick}
      className={cn(
        'relative grid size-10 cursor-pointer place-items-center rounded-full transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--lm-encre) motion-reduce:transition-none',
        choisi && 'scale-125',
      )}
    >
      {/* Position approximative (centre de la commune) : un cercle en pointillés autour du point. */}
      {approx && <span aria-hidden className="absolute inset-0 rounded-full border-2 border-dashed border-(--lm-encre-2) bg-(--lm-surface)/50" />}
      <PastilleEtat etat={p.etat} probleme={p.problemes.length > 0} taille="md" className={choisi ? 'ring-(--lm-encre)' : undefined} />
    </button>
  );
}

export default function FondCarte({ points, visibles, choisi, onChoisir, onFond, onErreur }: FondCarteProps) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<CarteMapLibre | null>(null);
  const reperes = useRef(new Map<Id, Marker>());
  const [elements, setElements] = useState<[Id, HTMLElement][]>([]);
  const rappels = useRef({ onFond, onErreur });
  rappels.current = { onFond, onErreur };
  const visiblesRef = useRef(visibles);
  visiblesRef.current = visibles;

  /** Écarte les repères visibles qui se chevauchent (au zoom, au redimensionnement, au filtre). */
  const ecarter = useCallback(() => {
    const m = carte.current;
    if (!m) return;
    const positions = [...reperes.current]
      .filter(([id]) => visiblesRef.current.has(id))
      .map(([id, r]) => ({ id, ecran: m.project(r.getLngLat()) }));
    const d = ecartements(positions);
    for (const [id, r] of reperes.current) r.setOffset(d.get(id) ?? [0, 0]);
  }, []);

  // Une carte par montage ; retirée (et ses repères) au démontage.
  useEffect(() => {
    const el = conteneur.current;
    if (!el) return;
    let m: CarteMapLibre;
    try {
      m = new CarteMapLibre({
        container: el,
        center: CENTRE_DEPART,
        zoom: 9,
        minZoom: 4,
        maxZoom: 17,
        maxPitch: 0,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        renderWorldCopies: false,
        cooperativeGestures: true,
        // Crédits sous la carte (CreditsCarte) : toujours visibles, sans jamais cacher un logement.
        attributionControl: false,
        locale: TEXTES,
        // Style d'OpenFreeMap tel quel : pas de validation (plus rapide, sans avertissements sur ses filtres).
        validateStyle: false,
      });
    } catch {
      // WebGL indisponible (vieil appareil, réglage du navigateur) : la liste suffit.
      rappels.current.onErreur();
      return;
    }
    m.setStyle(STYLE_CARTE, { transformStyle: corrigerStyle });
    m.touchZoomRotate.disableRotation();
    m.keyboard.disableRotation();
    m.addControl(new NavigationControl({ showCompass: false }), 'top-left');
    m.on('click', (e) => {
      if (!(e.originalEvent.target as HTMLElement | null)?.closest?.('.lm-marqueur')) rappels.current.onFond();
    });
    m.getCanvas().addEventListener('webglcontextlost', () => rappels.current.onErreur());
    m.on('zoom', ecarter);
    m.on('resize', ecarter);
    carte.current = m;
    const liste = reperes.current;
    return () => {
      liste.forEach((r) => r.remove());
      liste.clear();
      m.remove();
      carte.current = null;
    };
  }, []);

  // Repères : un par logement placé, déplacés si la position change.
  useEffect(() => {
    const m = carte.current;
    if (!m) return;
    const ids = new Set(points.map((p) => p.id));
    for (const [id, r] of reperes.current) {
      if (!ids.has(id)) {
        r.remove();
        reperes.current.delete(id);
      }
    }
    for (const p of points) {
      if (!p.position) continue;
      let r = reperes.current.get(p.id);
      if (!r) {
        const el = document.createElement('div');
        el.className = 'lm-marqueur';
        r = new Marker({ element: el, anchor: 'center' });
        reperes.current.set(p.id, r);
        r.setLngLat([p.position.lng, p.position.lat]).addTo(m);
      } else r.setLngLat([p.position.lng, p.position.lat]);
    }
    setElements(points.filter((p) => reperes.current.has(p.id)).map((p) => [p.id, reperes.current.get(p.id)!.getElement()]));
    ecarter();
  }, [points, ecarter]);

  // Cadrage sur tous les logements placés, quand leurs positions changent (pas au filtre).
  const signature = useMemo(() => points.map((p) => `${p.id}:${p.position?.lat}:${p.position?.lng}`).join('|'), [points]);
  useEffect(() => {
    const m = carte.current;
    const places = points.filter((p) => p.position);
    if (!m || !places.length) return;
    const b = new LngLatBounds();
    for (const p of places) b.extend([p.position!.lng, p.position!.lat]);
    m.fitBounds(b, { padding: 48, maxZoom: places.length > 1 ? ZOOM_MAX_CADRAGE : ZOOM_UN_LOGEMENT, duration: 0 });
    ecarter();
  }, [signature, ecarter]);

  // Repères qui se chevauchent : le plus important au-dessus (problème, puis ménage, réservé,
  // libre : l'ordre reçu), le repère choisi au-dessus de tout ; sur ordinateur, jamais caché sous la fiche.
  useEffect(() => {
    const rang = new Map(points.map((p, k) => [p.id, points.length - k]));
    for (const [id, r] of reperes.current) r.getElement().style.zIndex = String(id === choisi ? points.length + 1 : (rang.get(id) ?? 0));
    const m = carte.current;
    const p = choisi ? points.find((x) => x.id === choisi) : undefined;
    if (!m || !p?.position || !window.matchMedia('(min-width: 768px)').matches) return;
    const { x } = m.project([p.position.lng, p.position.lat]);
    const largeur = m.getContainer().clientWidth;
    if (x > largeur - LARGEUR_FICHE || x < 40) m.easeTo({ center: [p.position.lng, p.position.lat], offset: [-LARGEUR_FICHE / 2, 0], duration: 350 });
  }, [choisi, elements]);

  // Filtre de la légende : les repères écartés sont masqués (la carte ne bouge pas).
  useEffect(() => {
    for (const [id, r] of reperes.current) r.getElement().style.display = visibles.has(id) ? '' : 'none';
    ecarter();
  }, [visibles, elements, ecarter]);

  const parId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);
  return (
    <>
      {/* La bibliothèque pose « position: relative » sur son conteneur : il remplit un cadre placé. */}
      <div className="absolute inset-0">
        <div ref={conteneur} className="h-full w-full" />
      </div>
      {elements.map(([id, el]) => {
        const p = parId.get(id);
        return p ? createPortal(<Repere p={p} choisi={choisi === id} onClick={() => onChoisir(id)} />, el, id) : null;
      })}
    </>
  );
}
