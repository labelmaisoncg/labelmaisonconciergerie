/**
 * Prospect du pipeline commercial : saisie, contrôles et fiche, partagés par
 * le formulaire de la fiche (modules/commercial/_composants/FormProspect.tsx,
 * modification) et l'assistant « Nouveau prospect » (NouveauProspect.tsx,
 * création pas à pas : le propriétaire, le bien, le revenu attendu, d'où il
 * vient et qui le suit, l'étape, la prochaine action, une note, puis le
 * récapitulatif).
 *
 * Les règles sont celles du formulaire (erreursProspect), écran par écran ;
 * le prospect enregistré est le même (versProspect).
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */
import { LIBELLES } from './libelles';
import { euros, versCentimes } from './format';
import { dateLisible } from './parcours-assistant';
import type { DateISO, EtapeProspect, Prospect, Responsable, SourceProspect } from './types';

export interface BrouillonProspect {
  nom: string;
  ville: string;
  typeBien: string;
  source: SourceProspect;
  responsable: Responsable;
  etape: EtapeProspect;
  revenu: string;
  prochaineAction: string;
  prochaineActionLe: string;
  notes: string;
}

export function brouillonDe(p?: Partial<Prospect>): BrouillonProspect {
  return {
    nom: p?.nom ?? '',
    ville: p?.ville ?? '',
    typeBien: p?.typeBien ?? '',
    source: p?.source ?? 'seo',
    responsable: p?.responsable ?? 'abdel',
    etape: p?.etape ?? 'nouveau',
    revenu: p?.revenuEstimeAnnuelCentimes ? String(Math.round(p.revenuEstimeAnnuelCentimes / 100)) : '',
    prochaineAction: p?.prochaineAction ?? '',
    prochaineActionLe: p?.prochaineActionLe ?? '',
    notes: p?.notes ?? '',
  };
}

export type ErreursProspect = Partial<Record<keyof BrouillonProspect, string>>;

/** Erreurs de la saisie, par champ (formulaire et assistant). */
export function erreursProspect(b: BrouillonProspect): ErreursProspect {
  const e: ErreursProspect = {};
  if (b.nom.trim().length < 2) e.nom = 'Indiquez le nom du propriétaire.';
  if (!b.ville.trim()) e.ville = 'Indiquez la ville du bien.';
  if (!b.typeBien.trim()) e.typeBien = 'Décrivez le bien (ex. T2 45 m²).';
  const c = versCentimes(b.revenu);
  if (!b.revenu.trim() || !Number.isFinite(c) || c <= 0) e.revenu = 'Montant annuel en euros, supérieur à 0.';
  if (b.prochaineActionLe && !b.prochaineAction.trim()) e.prochaineAction = 'Précisez l’action prévue à cette date.';
  if (b.prochaineAction.trim() && !b.prochaineActionLe) e.prochaineActionLe = 'Choisissez une date pour cette action.';
  return e;
}

/** Applique le brouillon validé sur un prospect (nouveau ou existant). */
export function versProspect(b: BrouillonProspect, base: Pick<Prospect, 'id' | 'creeLe'>): Prospect {
  return {
    ...base,
    nom: b.nom.trim(),
    ville: b.ville.trim(),
    typeBien: b.typeBien.trim(),
    source: b.source,
    responsable: b.responsable,
    etape: b.etape,
    revenuEstimeAnnuelCentimes: versCentimes(b.revenu),
    prochaineAction: b.prochaineAction.trim() || undefined,
    prochaineActionLe: b.prochaineActionLe || undefined,
    notes: b.notes.trim(),
  };
}

/* ---------------------------------------------------------------- assistant */

export const ECRANS_PROSPECT = ['proprietaire', 'bien', 'revenu', 'origine', 'etape', 'action', 'notes', 'recapitulatif'] as const;
export type EcranProspect = (typeof ECRANS_PROSPECT)[number];

const CHAMPS: Record<Exclude<EcranProspect, 'recapitulatif'>, (keyof BrouillonProspect)[]> = {
  proprietaire: ['nom'],
  bien: ['ville', 'typeBien'],
  revenu: ['revenu'],
  origine: ['source', 'responsable'],
  etape: ['etape'],
  action: ['prochaineAction', 'prochaineActionLe'],
  notes: ['notes'],
};

/** Erreurs d'un écran, dans l'ordre de l'écran ; le récapitulatif réunit celles de tous les écrans. */
export function erreursEcranProspect(ecran: EcranProspect, b: BrouillonProspect): Record<string, string> {
  const e = erreursProspect(b);
  const champs = ecran === 'recapitulatif' ? Object.values(CHAMPS).flat() : CHAMPS[ecran];
  const r: Record<string, string> = {};
  for (const k of champs) if (e[k]) r[k] = e[k]!;
  return r;
}

export function ecranDuChampProspect(cle: string): EcranProspect {
  for (const [ecran, champs] of Object.entries(CHAMPS)) if ((champs as string[]).includes(cle)) return ecran as EcranProspect;
  return 'recapitulatif';
}

export type ResultatProspect = { ok: true; prospect: Prospect } | { ok: false; ecran: EcranProspect; erreur: string };

/** Ce que « Créer le prospect » enregistre : le même prospect que le formulaire. */
export function creationProspect(b: BrouillonProspect, base: Pick<Prospect, 'id' | 'creeLe'>): ResultatProspect {
  const erreurs = Object.entries(erreursEcranProspect('recapitulatif', b));
  if (erreurs.length) return { ok: false, ecran: ecranDuChampProspect(erreurs[0][0]), erreur: erreurs[0][1] };
  return { ok: true, prospect: versProspect(b, base) };
}

export const RESPONSABLES: { valeur: Responsable; libelle: string }[] = [
  { valeur: 'abdel', libelle: 'Abdel' },
  { valeur: 'kamel', libelle: 'Kamel' },
];

/** Lignes du récapitulatif. */
export function recapProspect(b: BrouillonProspect, aujourdhui: DateISO): { cle: string; ecran: Exclude<EcranProspect, 'recapitulatif'>; libelle: string; valeur: string }[] {
  const revenu = versCentimes(b.revenu);
  return [
    { cle: 'nom', ecran: 'proprietaire', libelle: 'Propriétaire', valeur: b.nom.trim() },
    { cle: 'bien', ecran: 'bien', libelle: 'Bien', valeur: b.ville.trim() && b.typeBien.trim() ? `${b.typeBien.trim()}, ${b.ville.trim()}` : '' },
    { cle: 'revenu', ecran: 'revenu', libelle: 'Revenu annuel estimé', valeur: b.revenu.trim() && Number.isFinite(revenu) && revenu > 0 ? euros(revenu, true) : '' },
    {
      cle: 'origine',
      ecran: 'origine',
      libelle: 'Source et suivi',
      valeur: `${LIBELLES.sourceProspect[b.source]} · suivi par ${RESPONSABLES.find((r) => r.valeur === b.responsable)?.libelle ?? b.responsable}`,
    },
    { cle: 'etape', ecran: 'etape', libelle: 'Étape', valeur: LIBELLES.etapeProspect[b.etape] },
    {
      cle: 'action',
      ecran: 'action',
      libelle: 'Prochaine action',
      valeur: b.prochaineAction.trim() && b.prochaineActionLe ? `${b.prochaineAction.trim()}, le ${dateLisible(b.prochaineActionLe, aujourdhui)}` : b.prochaineAction.trim() || b.prochaineActionLe ? '' : 'Aucune',
    },
    { cle: 'notes', ecran: 'notes', libelle: 'Notes', valeur: b.notes.trim() || 'Aucune' },
  ];
}
