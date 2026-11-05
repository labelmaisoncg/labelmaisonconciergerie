/**
 * Nouveau propriétaire, saisi pas à pas (modules/proprietaires/FormProprietaire.tsx,
 * en création seulement ; la modification garde le formulaire) : son type,
 * son nom, comment le joindre, son adresse postale, une note pour l'équipe,
 * puis le récapitulatif.
 *
 * Mêmes règles et même fiche que le formulaire : erreursProprietaire et
 * proprietaireDepuisSaisie (data/creation-logement.ts), écran par écran.
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */
import { LIBELLES } from './libelles';
import { A_REMPLIR_PROPRIETAIRE, erreursProprietaire, proprietaireDepuisSaisie, type SaisieProprietaire } from './creation-logement';
import type { DateISO, Id, Proprietaire } from './types';

export const ECRANS_PROPRIETAIRE = ['type', 'nom', 'contact', 'adresse', 'notes', 'recapitulatif'] as const;
export type EcranProprietaire = (typeof ECRANS_PROPRIETAIRE)[number];

/** Champs de la saisie posés à chaque écran (leurs erreurs bloquent cet écran). */
const CHAMPS: Record<Exclude<EcranProprietaire, 'recapitulatif'>, (keyof SaisieProprietaire)[]> = {
  type: ['type'],
  nom: ['nom'],
  contact: ['email', 'telephone'],
  adresse: ['adresse'],
  notes: ['notes'],
};

/**
 * Erreurs d'un écran, par champ, dans l'ordre de l'écran ; un champ vide dit
 * ce qu'il faut faire (« Indiquez son e-mail. »). Le récapitulatif réunit
 * celles de tous les écrans.
 */
export function erreursEcranProprietaire(ecran: EcranProprietaire, s: SaisieProprietaire): Record<string, string> {
  const e = erreursProprietaire(s);
  const champs = ecran === 'recapitulatif' ? Object.values(CHAMPS).flat() : CHAMPS[ecran];
  const r: Record<string, string> = {};
  for (const k of champs) {
    const erreur = e[k];
    if (erreur) r[k] = (!String(s[k]).trim() && A_REMPLIR_PROPRIETAIRE[k]) || erreur;
  }
  return r;
}

/** Écran où se corrige une erreur. */
export function ecranDuChampProprietaire(cle: string): EcranProprietaire {
  for (const [ecran, champs] of Object.entries(CHAMPS)) if ((champs as string[]).includes(cle)) return ecran as EcranProprietaire;
  return 'recapitulatif';
}

export type ResultatProprietaire = { ok: true; proprietaire: Proprietaire } | { ok: false; ecran: EcranProprietaire; erreur: string };

/** Ce que « Créer le propriétaire » enregistre : la même fiche que le formulaire. */
export function creationProprietaire(s: SaisieProprietaire, id: Id, aujourdhui: DateISO): ResultatProprietaire {
  const erreurs = Object.entries(erreursEcranProprietaire('recapitulatif', s));
  if (erreurs.length) return { ok: false, ecran: ecranDuChampProprietaire(erreurs[0][0]), erreur: erreurs[0][1] };
  return { ok: true, proprietaire: proprietaireDepuisSaisie(s, id, aujourdhui) };
}

/** Lignes du récapitulatif (« Notes internes » : « Aucune » si vide, la ligne reste modifiable). */
export function recapProprietaire(s: SaisieProprietaire): { cle: string; ecran: Exclude<EcranProprietaire, 'recapitulatif'>; libelle: string; valeur: string }[] {
  return [
    { cle: 'type', ecran: 'type', libelle: 'Type', valeur: LIBELLES.typeProprietaire[s.type] },
    { cle: 'nom', ecran: 'nom', libelle: s.type === 'particulier' ? 'Nom complet' : 'Raison sociale', valeur: s.nom.trim() },
    { cle: 'email', ecran: 'contact', libelle: 'E-mail', valeur: s.email.trim() },
    { cle: 'telephone', ecran: 'contact', libelle: 'Téléphone', valeur: s.telephone.trim() },
    { cle: 'adresse', ecran: 'adresse', libelle: 'Adresse postale', valeur: s.adresse.trim() },
    { cle: 'notes', ecran: 'notes', libelle: 'Notes internes', valeur: s.notes.trim() || 'Aucune' },
  ];
}
