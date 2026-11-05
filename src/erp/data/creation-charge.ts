/**
 * Nouvelle charge (dépense de la conciergerie), saisie pas à pas
 * (modules/finance/_composants/FormulaireCharge.tsx, en création ; la
 * modification garde le formulaire) : ce qui a été payé, combien et quand,
 * la catégorie, le logement concerné, puis le récapitulatif.
 *
 * Mêmes règles et même ligne que le formulaire : un libellé, un montant TTC
 * supérieur à 0 (en centimes), une date ; « Produits » par défaut ; sans
 * logement, c'est une charge générale.
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */
import { LIBELLES } from './libelles';
import { dateJour, euros, versCentimes } from './format';
import type { CategorieCharge, Charge, DateISO, Id, Logement } from './types';

export const ECRANS_CHARGE = ['libelle', 'montant', 'categorie', 'logement', 'recapitulatif'] as const;
export type EcranCharge = (typeof ECRANS_CHARGE)[number];

export interface BrouillonCharge {
  libelle: string;
  /** Montant TTC en euros, tel que tapé. */
  montant: string;
  date: DateISO | '';
  categorie: CategorieCharge;
  /** Vide : charge générale. */
  logementId: Id;
}

/** Valeurs de départ du formulaire : aujourd'hui, « Produits », charge générale. */
export const brouillonCharge = (aujourdhui: DateISO): BrouillonCharge => ({ libelle: '', montant: '', date: aujourdhui, categorie: 'produits', logementId: '' });

/** Erreurs d'un écran ; le récapitulatif réunit celles de tous les écrans. */
export function erreursCharge(ecran: EcranCharge, b: BrouillonCharge): Record<string, string> {
  const r: Record<string, string> = {};
  const tout = ecran === 'recapitulatif';
  if ((tout || ecran === 'libelle') && !b.libelle.trim()) r.libelle = 'Indiquez un libellé.';
  if (tout || ecran === 'montant') {
    const c = versCentimes(b.montant);
    if (!b.montant.trim()) r.montant = 'Indiquez le montant.';
    else if (!Number.isFinite(c) || c <= 0) r.montant = 'Montant invalide.';
    if (!b.date) r.date = 'Date requise.';
  }
  return r;
}

const ECRAN_DE_LA_CLE: Record<string, EcranCharge> = { libelle: 'libelle', montant: 'montant', date: 'montant' };
export const ecranDeLaCleCharge = (cle: string): EcranCharge => ECRAN_DE_LA_CLE[cle] ?? 'recapitulatif';

export type ResultatCharge = { ok: true; charge: Charge } | { ok: false; ecran: EcranCharge; erreur: string };

/** Ce que « Ajouter la charge » enregistre : la même ligne que le formulaire. */
export function chargeDepuisBrouillon(b: BrouillonCharge, id: Id): ResultatCharge {
  const erreurs = Object.entries(erreursCharge('recapitulatif', b));
  if (erreurs.length || !b.date) {
    const [cle, erreur] = erreurs[0] ?? ['date', 'Date requise.'];
    return { ok: false, ecran: ecranDeLaCleCharge(cle), erreur };
  }
  return {
    ok: true,
    charge: { id, date: b.date, libelle: b.libelle.trim(), categorie: b.categorie, montantCentimes: versCentimes(b.montant), logementId: b.logementId || undefined },
  };
}

/** Lignes du récapitulatif. */
export function recapCharge(b: BrouillonCharge, logements: readonly Pick<Logement, 'id' | 'nom'>[]): { cle: string; ecran: Exclude<EcranCharge, 'recapitulatif'>; libelle: string; valeur: string }[] {
  const c = versCentimes(b.montant);
  return [
    { cle: 'libelle', ecran: 'libelle', libelle: 'Libellé', valeur: b.libelle.trim() },
    { cle: 'montant', ecran: 'montant', libelle: 'Montant TTC', valeur: b.montant.trim() && Number.isFinite(c) && c > 0 && b.date ? `${euros(c)}, le ${dateJour(b.date)}` : '' },
    { cle: 'categorie', ecran: 'categorie', libelle: 'Catégorie', valeur: LIBELLES.categorieCharge[b.categorie] },
    { cle: 'logement', ecran: 'logement', libelle: 'Logement concerné', valeur: logements.find((l) => l.id === b.logementId)?.nom ?? 'Charge générale' },
  ];
}
