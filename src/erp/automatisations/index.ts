/** Moteur d'automatisations de l'ERP (voir moteur.ts pour l'intégration au store). */
export { executerAutomatisations } from './moteur';
export type { ChangementApplique, OptionsMoteur, ResultatMoteur } from './moteur';
export { REGLES, REGLES_ACTIVES_PAR_DEFAUT, regleParCle } from './regles';
export { LIBELLES_DOMAINES, ORDRE_DOMAINES } from './types';
export type { Changement, ContexteAuto, Declencheur, DomaineAuto, EvenementAuto, NiveauEvenement, Regle, ResultatRegle } from './types';

/** Clé localStorage de l'état des automatisations (règles actives + journal). */
export const CLE_AUTOMATISATIONS = 'lm-erp-auto-v1';
