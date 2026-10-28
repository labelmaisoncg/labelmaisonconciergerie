/**
 * Démo de la carte : des positions plausibles mais fausses. Chaque logement
 * de démonstration est posé près du centre de sa commune (centre public de
 * la commune, légèrement décalé pour que deux logements d'une même ville ne
 * se cachent pas), jamais sur une adresse réelle. En démo, « Placer sur la
 * carte » n'appelle aucun service : il pose le centre de la commune.
 *
 * « Maison de Linas » (en préparation) reste à placer : la démo montre la
 * liste « Pas encore sur la carte » et le bouton du gérant. « Soisy Bords de
 * Seine » est placé au centre de sa commune (position approximative).
 */
import { nouvellePosition, texteAdresse } from './carte';
import type { Logement, PositionLogement } from './types';

/** Centres des communes de la démo (lat, lng), arrondis à la centaine de mètres. */
export const CENTRES_COMMUNES_DEMO: Record<string, [number, number]> = {
  '91100': [48.598, 2.465],
  '91000': [48.627, 2.433],
  '91090': [48.598, 2.433],
  '91260': [48.692, 2.371],
  '91450': [48.648, 2.449],
  '75014': [48.83, 2.323],
  '91300': [48.728, 2.27],
  '91310': [48.627, 2.263],
  '91130': [48.646, 2.416],
};

/** Décalage (lat, lng) depuis le centre de la commune, et précision montrée. */
const PLACES_DEMO: Record<string, { decalage: [number, number]; precision: PositionLogement['precision'] }> = {
  'log-corbeil-t2': { decalage: [0.006, 0.012], precision: 'adresse' },
  'log-corbeil-t3': { decalage: [-0.004, 0.003], precision: 'adresse' },
  'log-evry-t2': { decalage: [-0.006, -0.008], precision: 'adresse' },
  'log-evry-cosy': { decalage: [0.003, 0.004], precision: 'adresse' },
  'log-lisses': { decalage: [-0.003, -0.005], precision: 'adresse' },
  'log-juvisy': { decalage: [0.002, 0.004], precision: 'adresse' },
  'log-soisy': { decalage: [0, 0], precision: 'commune' },
  'log-paris14': { decalage: [-0.002, 0.003], precision: 'adresse' },
  'log-massy': { decalage: [0.003, -0.004], precision: 'adresse' },
};

const LE_DEMO = '2026-09-01T09:00:00+02:00';

/** Position de démonstration d'un logement (aucune pour ceux à placer). */
export function positionDemo(l: Logement): PositionLogement | undefined {
  const place = PLACES_DEMO[l.id];
  const centre = CENTRES_COMMUNES_DEMO[l.codePostal];
  if (!place || !centre) return undefined;
  const c = { lat: Math.round((centre[0] + place.decalage[0]) * 1e4) / 1e4, lng: Math.round((centre[1] + place.decalage[1]) * 1e4) / 1e4 };
  return nouvellePosition(l, c, place.precision, 'demo', LE_DEMO);
}

/** « Placer sur la carte » en démo : le centre de la commune, sans aucun appel réseau. */
export function geocoderDemo(l: Pick<Logement, 'adresse' | 'codePostal' | 'ville'>, le: string): PositionLogement | null {
  const centre = CENTRES_COMMUNES_DEMO[String(l.codePostal ?? '').trim()];
  if (!centre || !texteAdresse(l)) return null;
  return nouvellePosition(l, { lat: centre[0], lng: centre[1] }, 'commune', 'demo', le);
}
