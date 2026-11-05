/**
 * Noter une absence, pas à pas : « Nouvelle absence ».
 *
 * - Le gérant (Paramètres → Accès, fiche d'un responsable) : les dates, le
 *   remplaçant, le motif (facultatif), puis le récapitulatif avec ce qui
 *   change. La personne est celle de la fiche : le récapitulatif la nomme
 *   toujours (« Personne absente »), sans « Modifier ».
 * - Un responsable de pôle (espace opérations → Équipe) : la personne
 *   absente, les dates, le remplaçant, puis le récapitulatif.
 *
 * Personne ne peut remplacer (personne ne suit tous ses logements) : pas
 * d'écran du remplaçant, le récapitulatif le dit (ecransAbsence).
 *
 * Mêmes règles et mêmes écritures qu'avant : verifierAbsence (operations.ts :
 * dates dans l'ordre, pas de chevauchement, pas son propre remplaçant) ;
 * côté gérant, la même absence enregistrée (creeLe, par, motif nettoyé,
 * jamais « notée par » un pôle) ; côté pôle, la même action « absence »
 * envoyée au serveur. Les modifications gardent leur fenêtre.
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */
import { ajouterJours, verifierAbsence } from './operations';
import type { DateISO, Horodatage, Id } from './types';
import type { AbsenceMembre } from './types-operations';

export type EcranAbsence = 'personne' | 'dates' | 'remplacant' | 'motif' | 'recapitulatif';

/** Le gérant, depuis la fiche de la personne : elle est déjà choisie. */
export const ECRANS_ABSENCE_GERANT: readonly EcranAbsence[] = ['dates', 'remplacant', 'motif', 'recapitulatif'];
/** Un responsable de pôle : la personne d'abord (pas de motif, comme avant). */
export const ECRANS_ABSENCE_POLE: readonly EcranAbsence[] = ['personne', 'dates', 'remplacant', 'recapitulatif'];

/** Écrans du parcours : sans remplaçant possible, l'écran du remplaçant n'offrirait que « Pas de remplaçant » ; il est sauté. */
export const ecransAbsence = (base: readonly EcranAbsence[], remplacantPossible: boolean): EcranAbsence[] => base.filter((e) => remplacantPossible || e !== 'remplacant');

/** Valeur du récapitulatif quand personne ne peut remplacer (écran sauté). */
export const AUCUN_REMPLACANT_POSSIBLE = 'Aucun possible\u00a0: personne ne suit tous ses logements';

export interface BrouillonAbsence {
  membreId: Id;
  du: DateISO;
  au: DateISO;
  /** Remplaçant si le logement n'en a pas ; vide : personne. */
  remplacantId: Id;
  motif: string;
}

/** Départ du gérant, comme avant : aujourd'hui seulement, sans remplaçant. */
export const brouillonAbsenceGerant = (membreId: Id, aujourdhui: DateISO): BrouillonAbsence => ({ membreId, du: aujourdhui, au: aujourdhui, remplacantId: '', motif: '' });
/** Départ d'un responsable de pôle, comme avant : une semaine à partir d'aujourd'hui. */
export const brouillonAbsencePole = (aujourdhui: DateISO): BrouillonAbsence => ({ membreId: '', du: aujourdhui, au: ajouterJours(aujourdhui, 6), remplacantId: '', motif: '' });

/** Les choix et la paire de dates sont dits au-dessus de « Continuer ». */
export const SANS_CHAMP_ABSENCE = new Set(['membreId', 'dates', 'remplacantId']);

/** L'absence telle que la vérifie verifierAbsence (id provisoire, comme avant). */
const pourVerifier = (b: BrouillonAbsence): AbsenceMembre => ({ id: 'nouvelle', membreId: b.membreId, du: b.du, au: b.au, ...(b.remplacantId ? { remplacantId: b.remplacantId } : {}) });

/** Écran de chaque refus de verifierAbsence. */
const ECRAN_DU_REFUS: Record<string, { ecran: EcranAbsence; cle: string }> = {
  'Choisissez la personne absente.': { ecran: 'personne', cle: 'membreId' },
  'Indiquez les dates de début et de fin.': { ecran: 'dates', cle: 'dates' },
  'La fin doit être après le début.': { ecran: 'dates', cle: 'dates' },
  'Une absence est déjà notée sur ces dates pour cette personne.': { ecran: 'dates', cle: 'dates' },
  'Une personne ne peut pas se remplacer elle-même.': { ecran: 'remplacant', cle: 'remplacantId' },
};

/** Erreurs d'un écran (le refus de verifierAbsence, sur son écran) ; le récapitulatif les dit toutes. */
export function erreursAbsence(ecran: EcranAbsence, b: BrouillonAbsence, absences: AbsenceMembre[]): Record<string, string> {
  const refus = verifierAbsence(pourVerifier(b), absences);
  if (!refus) return {};
  const ou = ECRAN_DU_REFUS[refus] ?? { ecran: 'recapitulatif', cle: 'absence' };
  return ecran === 'recapitulatif' || ecran === ou.ecran ? { [ou.cle]: refus } : {};
}

export const ecranDeLaCleAbsence = (cle: string): EcranAbsence => ({ membreId: 'personne', dates: 'dates', remplacantId: 'remplacant' } as Record<string, EcranAbsence>)[cle] ?? 'recapitulatif';

export type ResultatAbsence<T> = { ok: true; valeur: T } | { ok: false; ecran: EcranAbsence; erreur: string };

const refus = <T>(b: BrouillonAbsence, absences: AbsenceMembre[]): ResultatAbsence<T> | undefined => {
  const e = Object.entries(erreursAbsence('recapitulatif', b, absences))[0];
  return e ? { ok: false, ecran: ecranDeLaCleAbsence(e[0]), erreur: e[1] } : undefined;
};

/** Ce qu'enregistre le gérant : la même absence que l'ancienne fenêtre « Noter une absence ». */
export function absenceGerantDepuisBrouillon(b: BrouillonAbsence, o: { absences: AbsenceMembre[]; id: Id; maintenant: Horodatage; par: string }): ResultatAbsence<AbsenceMembre> {
  const non = refus<AbsenceMembre>(b, o.absences);
  if (non) return non;
  return {
    ok: true,
    valeur: {
      id: o.id,
      membreId: b.membreId,
      du: b.du,
      au: b.au,
      ...(b.remplacantId ? { remplacantId: b.remplacantId } : {}),
      ...(b.motif.trim() ? { motif: b.motif.trim() } : {}),
      creeLe: o.maintenant,
      par: o.par,
    },
  };
}

/** Ce qu'envoie un responsable de pôle : la même action « absence » qu'avant. */
export function actionAbsenceDepuisBrouillon(b: BrouillonAbsence, absences: AbsenceMembre[]): ResultatAbsence<{ type: 'absence'; membreId: Id; du: DateISO; au: DateISO; remplacantId?: Id }> {
  const non = refus<{ type: 'absence'; membreId: Id; du: DateISO; au: DateISO; remplacantId?: Id }>(b, absences);
  if (non) return non;
  return { ok: true, valeur: { type: 'absence', membreId: b.membreId, du: b.du, au: b.au, ...(b.remplacantId ? { remplacantId: b.remplacantId } : {}) } };
}

/**
 * Lignes du récapitulatif ; `ecrans` : ceux du parcours (une ligne dont
 * l'écran n'y est pas se lit sans « Modifier ») ; `nom` : nom d'une
 * personne, `jour` : date lisible. La personne absente est toujours nommée.
 */
export function recapAbsence(
  b: BrouillonAbsence,
  o: { ecrans: readonly EcranAbsence[]; nom: (id: Id) => string; jour: (iso: DateISO) => string },
): { cle: string; ecran: Exclude<EcranAbsence, 'recapitulatif'>; libelle: string; valeur: string }[] {
  const lignes: { cle: string; ecran: Exclude<EcranAbsence, 'recapitulatif'>; libelle: string; valeur: string }[] = [];
  lignes.push({ cle: 'personne', ecran: 'personne', libelle: 'Personne absente', valeur: b.membreId ? o.nom(b.membreId) : '' });
  lignes.push({ cle: 'dates', ecran: 'dates', libelle: 'Dates', valeur: b.du && b.au ? (b.du === b.au ? `Le ${o.jour(b.du)}` : `Du ${o.jour(b.du)} au ${o.jour(b.au)} inclus`) : '' });
  lignes.push({
    cle: 'remplacant',
    ecran: 'remplacant',
    libelle: 'Remplaçant',
    valeur: !o.ecrans.includes('remplacant') ? AUCUN_REMPLACANT_POSSIBLE : b.remplacantId ? o.nom(b.remplacantId) : 'Pas de remplaçant choisi',
  });
  if (o.ecrans.includes('motif')) lignes.push({ cle: 'motif', ecran: 'motif', libelle: 'Motif', valeur: b.motif.trim() || 'Aucun' });
  return lignes;
}
