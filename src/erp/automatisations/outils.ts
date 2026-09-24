/**
 * Petits outils partagés par les règles : pas d'état, pas de date système.
 */
import type { ElementDe, Id, NomCollection } from '../data/types';
import type { Changement, ContexteAuto, EvenementAuto, NiveauEvenement, ResultatRegle } from './types';

/** Accumulateur de résultat pour une règle. */
export function collecteur(regle: string, ctx: ContexteAuto) {
  const res: ResultatRegle = { changements: [], evenements: [] };
  // « 24 sept. » en fin de phrase ne doit pas produire « sept.. ».
  const net = (t: string) => t.replace(/\.\./g, '.');
  return {
    res,
    creer<C extends NomCollection>(collection: C, element: ElementDe<C>, resume: string) {
      res.changements.push({ collection, operation: 'creer', element, resume: net(resume) } as Changement);
    },
    modifier<C extends NomCollection>(collection: C, element: ElementDe<C>, resume: string) {
      res.changements.push({ collection, operation: 'modifier', element, resume: net(resume) } as Changement);
    },
    evenement(niveau: NiveauEvenement, cle: string, message: string, entite: string, entiteId: Id) {
      const e: EvenementAuto = { id: `${regle}:${cle}`, regle, horodatage: ctx.maintenant, niveau, message: net(message), entite, entiteId };
      res.evenements.push(e);
    },
  };
}

/** Hachage FNV-1a 32 bits, déterministe (tirage 1 sur 10). */
export function hachage(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 'HH:MM' d'un horodatage ISO. */
export function heureDe(horodatage: string): string {
  return horodatage.slice(11, 16);
}

/** Deux créneaux 'HH:MM' [debut, fin[ se chevauchent-ils ? */
export function chevauche(a: { heureDebut: string; heureFinMax: string }, b: { heureDebut: string; heureFinMax: string }) {
  return a.heureDebut < b.heureFinMax && b.heureDebut < a.heureFinMax;
}

/** Heures écoulées entre deux horodatages ISO (Date.parse sur des valeurs fournies, jamais « maintenant » système). */
export function heuresEntre(de: string, a: string): number {
  return (Date.parse(a) - Date.parse(de)) / 3_600_000;
}

/** Mois 'YYYY-MM' précédent. */
export function moisPrecedent(periode: string): string {
  const [a, m] = periode.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

/** Mois 'YYYY-MM' suivant. */
export function moisSuivant(periode: string): string {
  const [a, m] = periode.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

