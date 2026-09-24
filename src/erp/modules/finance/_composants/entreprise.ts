/** Identité légale de Label Maison (mentions des relevés, factures, paramètres). */
export const ENTREPRISE = {
  raisonSociale: 'Label Maison Conciergerie',
  forme: 'SASU',
  siret: '993 428 200 00014',
  adresse: '10 chemin des Bas Cornus',
  ville: '91100 Villabé',
  email: 'contact@labelmaisoncg.fr',
  site: 'labelmaisoncg.fr',
} as const;

export const ENTREPRISE_LIGNE = `${ENTREPRISE.raisonSociale} ${ENTREPRISE.forme} · SIRET ${ENTREPRISE.siret} · ${ENTREPRISE.adresse}, ${ENTREPRISE.ville}`;
