/**
 * Couleur de chaque étape du CRM : pastille lavée (fond + texte) et point plein.
 * Une teinte par étape, comme les options d'un champ « sélection » Airtable ;
 * le rouge reste réservé aux relances en retard.
 */
import type { StatutContactCrm } from '../../../data/types';

export const PASTILLE: Record<StatutContactCrm, string> = {
  a_appeler: 'bg-(--lm-info-lavis) text-(--lm-info-texte)',
  a_rappeler: 'bg-(--lm-orange-lavis) text-(--lm-orange)',
  contacte: 'bg-(--lm-or-lavis) text-(--lm-brun)',
  en_attente: 'bg-(--lm-violet-lavis) text-(--lm-violet)',
  rendez_vous: 'bg-(--lm-sarcelle-lavis) text-(--lm-sarcelle)',
  signe: 'bg-(--lm-succes-lavis) text-(--lm-succes-texte)',
  pas_interesse: 'bg-(--lm-neutre-lavis) text-(--lm-encre-2)',
};

export const POINT: Record<StatutContactCrm, string> = {
  a_appeler: 'bg-(--lm-info)',
  a_rappeler: 'bg-(--lm-orange)',
  contacte: 'bg-(--lm-or)',
  en_attente: 'bg-(--lm-violet)',
  rendez_vous: 'bg-(--lm-sarcelle)',
  signe: 'bg-(--lm-succes)',
  pas_interesse: 'bg-(--lm-encre-3)',
};
