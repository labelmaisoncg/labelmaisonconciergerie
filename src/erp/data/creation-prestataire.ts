/**
 * Ajouter un prestataire, pas à pas (modules/prestataires/_composants/PrestataireModal.tsx) :
 * son métier, qui il est (nom, raison sociale, SIRET), comment le joindre,
 * où il intervient, son engagement à ne pas sous-traiter, puis le
 * récapitulatif.
 *
 * Mêmes règles et même fiche que l'ancien formulaire : SIRET à 14 chiffres
 * (pas de prestataire non déclaré), téléphone lisible, e-mail facultatif
 * mais valide, au moins une ville, engagement coché ; la fiche démarre
 * « actif », sans tarif, avec ses quatre documents « manquants » (il reste
 * non conforme tant qu'ils ne sont pas déposés).
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */
import { LIBELLES } from './libelles';
import type { Id, Prestataire, TypePrestataire } from './types';

export const ECRANS_PRESTATAIRE = ['metier', 'identite', 'contact', 'zone', 'engagement', 'recapitulatif'] as const;
export type EcranPrestataire = (typeof ECRANS_PRESTATAIRE)[number];

export interface BrouillonPrestataire {
  type: TypePrestataire;
  nom: string;
  raisonSociale: string;
  siret: string;
  telephone: string;
  email: string;
  /** Villes séparées par des virgules. */
  zone: string;
  /** Intervient lui-même ou avec ses salariés déclarés, sans sous-traiter. */
  sansCascade: boolean;
}

export const brouillonPrestataire = (): BrouillonPrestataire => ({
  type: 'menage',
  nom: '',
  raisonSociale: '',
  siret: '',
  telephone: '',
  email: '',
  zone: '',
  sansCascade: false,
});

/** L'engagement est une case : dit au-dessus de « Continuer ». */
export const SANS_CHAMP_PRESTATAIRE = new Set(['type', 'sansCascade']);

export const siretSaisi = (siret: string): string => siret.replace(/\s/g, '');
export const villesSaisies = (zone: string): string[] => zone.split(',').map((v) => v.trim()).filter(Boolean);

const CHAMPS: Record<Exclude<EcranPrestataire, 'recapitulatif'>, (keyof BrouillonPrestataire)[]> = {
  metier: ['type'],
  identite: ['nom', 'raisonSociale', 'siret'],
  contact: ['telephone', 'email'],
  zone: ['zone'],
  engagement: ['sansCascade'],
};

/** Toutes les erreurs de la saisie, par champ (règles de l'ancien formulaire ; un champ vide dit quoi faire). */
function erreursSaisie(b: BrouillonPrestataire): Partial<Record<keyof BrouillonPrestataire, string>> {
  const e: Partial<Record<keyof BrouillonPrestataire, string>> = {};
  if (!b.nom.trim()) e.nom = 'Indiquez son nom.';
  else if (b.nom.trim().length < 2) e.nom = 'Nom obligatoire.';
  if (!b.siret.trim()) e.siret = 'Indiquez son SIRET.';
  else if (!/^\d{14}$/.test(siretSaisi(b.siret))) e.siret = 'Le SIRET compte 14 chiffres : pas de prestataire non déclaré.';
  if (!b.telephone.trim()) e.telephone = 'Indiquez son téléphone.';
  else if (!/^[+\d][\d\s.]{8,}$/.test(b.telephone.trim())) e.telephone = 'Téléphone invalide.';
  if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) e.email = 'Adresse e-mail invalide.';
  if (!b.zone.trim()) e.zone = 'Indiquez au moins une ville.';
  if (!b.sansCascade) e.sansCascade = 'Cochez l’engagement pour continuer.';
  return e;
}

/** Erreurs d'un écran, dans l'ordre de l'écran ; le récapitulatif réunit celles de tous les écrans. */
export function erreursPrestataire(ecran: EcranPrestataire, b: BrouillonPrestataire): Record<string, string> {
  const e = erreursSaisie(b);
  const champs = ecran === 'recapitulatif' ? Object.values(CHAMPS).flat() : CHAMPS[ecran];
  const r: Record<string, string> = {};
  for (const k of champs) if (e[k]) r[k] = e[k]!;
  return r;
}

export function ecranDuChampPrestataire(cle: string): EcranPrestataire {
  for (const [ecran, champs] of Object.entries(CHAMPS)) if ((champs as string[]).includes(cle)) return ecran as EcranPrestataire;
  return 'recapitulatif';
}

export type ResultatPrestataire = { ok: true; prestataire: Prestataire } | { ok: false; ecran: EcranPrestataire; erreur: string };

/** Ce que « Créer le prestataire » enregistre : la même fiche que l'ancien formulaire. */
export function prestataireDepuisBrouillon(b: BrouillonPrestataire, id: Id): ResultatPrestataire {
  const erreurs = Object.entries(erreursPrestataire('recapitulatif', b));
  if (erreurs.length) return { ok: false, ecran: ecranDuChampPrestataire(erreurs[0][0]), erreur: erreurs[0][1] };
  return {
    ok: true,
    prestataire: {
      id,
      nom: b.nom.trim(),
      raisonSociale: b.raisonSociale.trim() || undefined,
      siret: siretSaisi(b.siret),
      type: b.type,
      telephone: b.telephone.trim(),
      email: b.email.trim() || undefined,
      zone: villesSaisies(b.zone),
      statut: 'actif',
      tarifs: [],
      documents: (['contrat', 'rc_pro', 'urssaf', 'kbis'] as const).map((type) => ({ type, statut: 'manquant' as const })),
      missionsRealisees: 0,
    },
  };
}

/** Lignes du récapitulatif. */
export function recapPrestataire(b: BrouillonPrestataire): { cle: string; ecran: Exclude<EcranPrestataire, 'recapitulatif'>; libelle: string; valeur: string }[] {
  return [
    { cle: 'type', ecran: 'metier', libelle: 'Métier', valeur: LIBELLES.typePrestataire[b.type] },
    { cle: 'nom', ecran: 'identite', libelle: 'Nom de l’intervenant', valeur: b.nom.trim() },
    { cle: 'raisonSociale', ecran: 'identite', libelle: 'Raison sociale', valeur: b.raisonSociale.trim() || 'Non renseignée' },
    { cle: 'siret', ecran: 'identite', libelle: 'SIRET', valeur: siretSaisi(b.siret) },
    { cle: 'telephone', ecran: 'contact', libelle: 'Téléphone', valeur: b.telephone.trim() },
    { cle: 'email', ecran: 'contact', libelle: 'E-mail', valeur: b.email.trim() || 'Non renseigné' },
    { cle: 'zone', ecran: 'zone', libelle: 'Zone d’intervention', valeur: villesSaisies(b.zone).join(', ') },
    { cle: 'engagement', ecran: 'engagement', libelle: 'Engagement', valeur: b.sansCascade ? 'Sans sous-traitance, linge jamais lavé à domicile' : '' },
  ];
}
