/**
 * Parcours d'un assistant pas à pas (ui/Assistant.tsx) : où mènent
 * « Continuer » et « Retour », le libellé du bouton d'action et ce que dit
 * le pied quand l'écran n'est pas complet. Les règles de chaque assistant
 * (ce qui manque à chaque écran) vivent à côté, dans data/creation-*.ts.
 *
 * Le dernier écran est toujours le récapitulatif : rien n'est enregistré
 * avant son bouton. « Modifier » d'une ligne du récapitulatif ouvre l'écran
 * concerné, d'où « Continuer » et « Retour » ramènent au récapitulatif.
 *
 * Module pur, sans React (verifier-assistants.ts). On y trouve aussi la
 * typographie commune des assistants (dates lisibles, espaces insécables).
 */
import { dateJour } from './format';
import type { DateISO } from './types';

/** Où en est la personne : l'écran ouvert, et si elle y est arrivée par « Modifier » du récapitulatif. */
export interface PositionParcours<E extends string> {
  ecran: E;
  retourRecap: boolean;
}

const recapitulatif = <E extends string>(ecrans: readonly E[]): E => ecrans[ecrans.length - 1];

/**
 * Écran ouvert par « Continuer » : le suivant, ou le récapitulatif quand on
 * vient de « Modifier ». Un écran qui n'est plus du parcours (une réponse en
 * a retiré) mène au premier écran qui reste après lui, sinon au récapitulatif.
 */
export function ecranSuivant<E extends string>(ecrans: readonly E[], p: PositionParcours<E>): PositionParcours<E> {
  const recap = recapitulatif(ecrans);
  if (p.retourRecap) return { ecran: recap, retourRecap: false };
  const i = ecrans.indexOf(p.ecran);
  return { ecran: i < 0 ? recap : ecrans[Math.min(ecrans.length - 1, i + 1)], retourRecap: false };
}

/** Écran ouvert par « Retour » ; rien au premier écran (le bouton n'y est pas). */
export function ecranPrecedent<E extends string>(ecrans: readonly E[], p: PositionParcours<E>): PositionParcours<E> | undefined {
  if (p.retourRecap) return { ecran: recapitulatif(ecrans), retourRecap: false };
  const i = ecrans.indexOf(p.ecran);
  return i > 0 ? { ecran: ecrans[i - 1], retourRecap: false } : undefined;
}

/** « Retour » est proposé ailleurs qu'au premier écran, et toujours après « Modifier ». */
export function retourPossible<E extends string>(ecrans: readonly E[], p: PositionParcours<E>): boolean {
  return p.retourRecap || ecrans.indexOf(p.ecran) > 0;
}

/** Libellé du bouton d'action : celui de l'action finale au récapitulatif. */
export function libelleSuite<E extends string>(ecrans: readonly E[], p: PositionParcours<E>, final: string): string {
  if (p.ecran === recapitulatif(ecrans)) return final;
  return p.retourRecap ? 'Revenir au récapitulatif' : 'Continuer';
}

/** Rang de l'écran (1 pour le premier) et part du parcours faite, en pour cent. */
export function progression<E extends string>(ecrans: readonly E[], ecran: E): { rang: number; total: number; pourcent: number } {
  const total = Math.max(1, ecrans.length);
  const rang = Math.max(0, ecrans.indexOf(ecran)) + 1;
  return { rang, total, pourcent: Math.round((rang / total) * 100) };
}

export interface Blocage {
  /** L'écran est complet : « Continuer » est permis. */
  valide: boolean;
  /** Ce qui manque, au-dessus de « Continuer » : la première erreur qui n'est pas déjà dite sous son champ. */
  raison?: string;
  /** Erreur à dire sous ce champ (il a été quitté), sinon rien. */
  erreurChamp: (cle: string) => string | undefined;
}

/**
 * Chaque erreur est dite une seule fois : sous son champ quand
 * `sousLeChamp(cle)` (champ déjà quitté), sinon au-dessus de « Continuer ».
 * Les erreurs arrivent dans l'ordre de l'écran : la raison est la première.
 */
export function blocage(erreurs: Readonly<Record<string, string>>, sousLeChamp: (cle: string) => boolean): Blocage {
  const cles = Object.keys(erreurs);
  return {
    valide: cles.length === 0,
    raison: cles.filter((k) => !sousLeChamp(k)).map((k) => erreurs[k])[0],
    erreurChamp: (k) => (k in erreurs && sousLeChamp(k) ? erreurs[k] : undefined),
  };
}

/** Le brouillon a changé depuis l'ouverture : fermer demande confirmation. */
export const brouillonModifie = (depart: unknown, actuel: unknown): boolean => JSON.stringify(depart) !== JSON.stringify(actuel);

/* -------------------------------------------------------------- typographie */

/** « mer. 10 févr. », avec l'année quand ce n'est pas celle de `reference` (« mer. 10 févr. 2027 »). */
export function dateLisible(date: DateISO, reference: DateISO): string {
  return date.slice(0, 4) === reference.slice(0, 4) ? dateJour(date) : `${dateJour(date)} ${date.slice(0, 4)}`;
}

/** Espace insécable (U+00A0), avant « : ? ! » et entre un nombre et son unité. */
export const NBSP = String.fromCharCode(0xa0);
/**
 * Trait d'union qui ne se coupe pas : celui de la police, suivi du gluon
 * invisible U+2060. Le trait d'union insécable U+2011 n'existe ni dans
 * Figtree ni dans Playfair Display : le navigateur l'empruntait à une autre
 * police, plus court et plus épais, visible dans les questions en serif.
 */
export const TIRET_INSECABLE = '-' + String.fromCharCode(0x2060);

/**
 * Typographie des textes de l'assistant sur petit écran : un nombre ne quitte
 * pas son unité (« 2 voyageurs », « 14 févr. », « 360,00 € »), « e-mail »,
 * les « -vous », « -il », « -elle » et « lui-même », « elle-même » ne se
 * coupent pas. Ce qui n'est pas du texte passe tel quel.
 */
export function insecables(texte: string): string;
export function insecables<T>(texte: T): T;
export function insecables(texte: unknown): unknown {
  if (typeof texte !== 'string') return texte;
  return texte
    .replace(/(\d) (?=\S)/g, `$1${NBSP}`)
    .replace(/\b([eE])-mail/g, `$1${TIRET_INSECABLE}mail`)
    .replace(/-(?=(?:vous|ils?|elles?|t|mêmes?)\b)/g, TIRET_INSECABLE);
}
