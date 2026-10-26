/**
 * Couleur de chaque étape du CRM : pastille lavée (fond + texte) et point plein.
 * Peu de teintes : l'or pour ce qui attend un appel, le neutre pour les
 * échanges en cours, la sarcelle pour un rendez-vous, le vert pour un contrat ;
 * le rouge reste réservé aux relances en retard.
 */
import type { StatutContactCrm } from '../../../data/types';

export const PASTILLE: Record<StatutContactCrm, string> = {
  a_appeler: 'bg-(--lm-or-lavis) text-(--lm-brun)',
  a_rappeler: 'bg-(--lm-alerte-lavis) text-(--lm-alerte)',
  contacte: 'bg-(--lm-neutre-lavis) text-(--lm-encre)',
  en_attente: 'bg-(--lm-neutre-lavis) text-(--lm-encre-2)',
  rendez_vous: 'bg-(--lm-sarcelle-lavis) text-(--lm-sarcelle)',
  signe: 'bg-(--lm-succes-lavis) text-(--lm-succes-texte)',
  pas_interesse: 'bg-(--lm-neutre-lavis) text-(--lm-encre-2)',
};

export const POINT: Record<StatutContactCrm, string> = {
  a_appeler: 'bg-(--lm-or)',
  a_rappeler: 'bg-(--lm-alerte)',
  contacte: 'bg-(--lm-encre-2)',
  en_attente: 'bg-(--lm-encre-3)',
  rendez_vous: 'bg-(--lm-sarcelle)',
  signe: 'bg-(--lm-succes)',
  pas_interesse: 'bg-(--lm-encre-3)',
};
