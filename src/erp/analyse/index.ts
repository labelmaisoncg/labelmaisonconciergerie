/** Moteur d'analyse des biens (SPEC §10) : pur TypeScript, sans React. */
export { analyserBien, decider } from './analyseBien';
export { analyserParc, scoreBien } from './parc';
export type { AnalyseParc } from './parc';
export { contexteParc } from './contexte';
export { SEUILS, interpreter, scoreDpe, TON_NIVEAU, LIBELLE_NIVEAU } from './seuils';
export type { CleKpi, NiveauKpi, SeuilKpi, Interpretation } from './seuils';
export { THEMES_PLAINTE } from './defauts';
export type * from './types';

/** Libellés et tons des recommandations. */
export const LIBELLES_RECOMMANDATION = {
  developper: 'Développer',
  garder: 'Garder',
  surveiller: 'Surveiller',
  renegocier: 'Renégocier',
  sortir: 'Sortir',
} as const;

export const TONS_RECOMMANDATION = {
  developper: 'succes',
  garder: 'info',
  surveiller: 'alerte',
  renegocier: 'or',
  sortir: 'danger',
} as const;

export const LIBELLES_STATUT_RECO = {
  a_proposer: 'À proposer',
  proposee: 'Proposée',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
  realisee: 'Réalisée',
} as const;

export const TONS_STATUT_RECO = {
  a_proposer: 'neutre',
  proposee: 'info',
  acceptee: 'or',
  refusee: 'danger',
  realisee: 'succes',
} as const;
