/**
 * Repères de la carte qui se chevauchent : calcul pur (positions à l'écran →
 * décalage de chacun, en pixels), utilisé par FondCarte.tsx, vérifié par
 * data/verifier-carte.ts.
 */
import type { Id } from '../data/types';

/** Écart minimal entre deux repères à l'écran : la taille d'un repère (40 px), chacun reste touchable. */
export const ECART_PX = 40;
type Ecran = { x: number; y: number };

/**
 * Repères trop proches à l'écran (même quartier, zoom large) : écartés en
 * cercle autour de leur centre, de quoi les toucher un par un. Le décalage
 * (en pixels) disparaît de lui-même en zoomant, quand ils se séparent.
 * Pur : positions à l'écran → décalage de chacun.
 */
export function ecartements(positions: { id: Id; ecran: Ecran }[], ecart = ECART_PX): Map<Id, [number, number]> {
  const n = positions.length;
  const parent = positions.map((_, k) => k);
  const racine = (k: number): number => (parent[k] === k ? k : (parent[k] = racine(parent[k])));
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      if (Math.hypot(positions[a].ecran.x - positions[b].ecran.x, positions[a].ecran.y - positions[b].ecran.y) < ecart) parent[racine(a)] = racine(b);
    }
  }
  const groupes = new Map<number, number[]>();
  positions.forEach((_, k) => groupes.set(racine(k), [...(groupes.get(racine(k)) ?? []), k]));
  const decalages = new Map<Id, [number, number]>();
  for (const membres of groupes.values()) {
    if (membres.length === 1) {
      decalages.set(positions[membres[0]].id, [0, 0]);
      continue;
    }
    const c = membres.reduce((s, k) => ({ x: s.x + positions[k].ecran.x / membres.length, y: s.y + positions[k].ecran.y / membres.length }), { x: 0, y: 0 });
    // Autour du centre, dans l'ordre où ils sont déjà : chacun bouge le moins possible.
    const angle = (k: number) => Math.atan2(positions[k].ecran.y - c.y, positions[k].ecran.x - c.x);
    const ordre = membres.slice().sort((a, b) => angle(a) - angle(b));
    const rayon = ecart / (2 * Math.sin(Math.PI / ordre.length));
    const depart = angle(ordre[0]);
    ordre.forEach((k, i) => {
      const t = depart + (2 * Math.PI * i) / ordre.length;
      decalages.set(positions[k].id, [Math.round(c.x + rayon * Math.cos(t) - positions[k].ecran.x), Math.round(c.y + rayon * Math.sin(t) - positions[k].ecran.y)]);
    });
  }
  return decalages;
}
