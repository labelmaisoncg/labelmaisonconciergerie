/**
 * Référentiels fixes partagés par le seed, le store et les modules.
 */
import type { CleChecklistLancement, EtapeProspect, ElementChecklist } from './types';

/** Checklist de lancement bloquante (SPEC §2.2), dans l'ordre d'exécution. */
export const CHECKLIST_LANCEMENT: ReadonlyArray<{ cle: CleChecklistLancement; libelle: string }> = [
  { cle: 'mandat_signe', libelle: 'Mandat de gestion signé' },
  { cle: 'inventaire_signe', libelle: 'Inventaire contradictoire signé, avec photos' },
  { cle: 'linge_etiquete', libelle: 'Linge étiqueté, dotation définie' },
  { cle: 'acces_securise', libelle: 'Accès sécurisé (serrure connectée ou boîte à clés, code par séjour)' },
  { cle: 'assurance_proprietaire', libelle: 'Attestation d’assurance du propriétaire' },
  { cle: 'numero_enregistrement', libelle: 'N° d’enregistrement meublé de tourisme' },
  { cle: 'dpe', libelle: 'DPE fourni' },
  { cle: 'fiche_complete', libelle: 'Fiche logement complète (wifi, accès, horaires, règles)' },
  { cle: 'prestataire_menage', libelle: 'Prestataire ménage affecté sous contrat' },
];

/** Checklist type d'un ménage de départ. */
export const CHECKLIST_MENAGE: ReadonlyArray<string> = [
  'Aération et vidage des poubelles',
  'Changement complet du linge de lit',
  'Serviettes et tapis de bain remplacés',
  'Cuisine : plan de travail, plaques, évier, frigo',
  'Salle de bain et WC désinfectés',
  'Sols aspirés et lavés',
  'Consommables réassortis (café, papier, savon)',
  'Contrôle casse et objets oubliés',
];

export function checklistMenageVierge(): ElementChecklist[] {
  return CHECKLIST_MENAGE.map((libelle) => ({ libelle, fait: false }));
}

/** Ordre du pipeline commercial (« perdu » est une sortie, pas une étape). */
export const ETAPES_PIPELINE: ReadonlyArray<EtapeProspect> = [
  'nouveau',
  'contact',
  'visite',
  'proposition',
  'negociation',
  'signe',
];

/** Articles de linge suivis. */
export const ARTICLES_LINGE = [
  'Drap housse 140',
  'Drap housse 90',
  'Housse de couette 240',
  'Housse de couette 140',
  'Taie d’oreiller',
  'Serviette de bain',
  'Serviette de toilette',
  'Tapis de bain',
  'Torchon',
] as const;

/** Commission cible des nouveaux mandats (SPEC §2.9). */
export const COMMISSION_CIBLE_MIN = 18;
export const COMMISSION_CIBLE_MAX = 20;
/** Plafond de nuits louées pour une résidence principale. */
export const PLAFOND_NUITS_RESIDENCE_PRINCIPALE = 120;
/** Seuil de note voyageur déclenchant un contrôle qualité. */
export const SEUIL_NOTE_CONTROLE = 4.5;
/** Validité d'une attestation de vigilance URSSAF, en mois. */
export const VALIDITE_URSSAF_MOIS = 6;
