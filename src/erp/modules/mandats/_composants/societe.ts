/** Identité légale du gestionnaire, reprise dans les contrats et relevés (SPEC §2.10 : SASU). */
export const SOCIETE = {
  nom: 'Label Maison Conciergerie',
  forme: 'SASU',
  siret: '993 428 200 00014',
  adresse: '10 chemin des Bas Cornus, 91100 Villabé',
  ville: 'Villabé',
} as const;

export const MENTION_SOCIETE = `${SOCIETE.nom}, ${SOCIETE.forme}, SIRET ${SOCIETE.siret}, ${SOCIETE.adresse}`;

/** Durée de non-sollicitation après la fin du mandat, en mois. */
export const NON_SOLLICITATION_MOIS = 12;
