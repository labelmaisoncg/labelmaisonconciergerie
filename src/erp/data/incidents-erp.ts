/**
 * Incidents côté ERP (octobre 2026) : ceux signalés depuis l'espace
 * opérations restent visibles du gérant, sur la fiche du logement et dans le
 * « À faire » de l'accueil. Mêmes mots que l'espace opérations (Nouveau /
 * On s'en occupe / Réglé) ; seul « Urgent » est en rouge.
 */
import { estUrgent, trierIncidents } from './operations.js';
import type { ErpDonnees, Horodatage, Id, Incident } from './types';

/** Fiche du logement, carte des incidents en vue (notification, À faire, recherche). */
export const lienIncident = (i: Pick<Incident, 'id' | 'logementId'>) =>
  `/erp/logements/${encodeURIComponent(i.logementId)}?incident=${encodeURIComponent(i.id)}`;

/** Les incidents d'un logement : ouverts d'abord (urgents en tête), puis réglés. */
export function incidentsDuLogement(d: Pick<ErpDonnees, 'incidents'>, logementId: Id): { ouverts: Incident[]; regles: Incident[] } {
  const siens = d.incidents.filter((i) => i.logementId === logementId);
  return {
    ouverts: trierIncidents(siens.filter((i) => i.statut !== 'resolu')),
    regles: siens.filter((i) => i.statut === 'resolu').sort((a, b) => String(b.resoluLe ?? b.date).localeCompare(String(a.resoluLe ?? a.date))),
  };
}

/** Pour l'accueil : urgences et autres incidents ouverts, tous logements confondus. */
export function incidentsATraiter(d: Pick<ErpDonnees, 'incidents'>): { urgences: Incident[]; autres: Incident[] } {
  const ouverts = trierIncidents(d.incidents.filter((i) => i.statut !== 'resolu'));
  return { urgences: ouverts.filter(estUrgent), autres: ouverts.filter((i) => !estUrgent(i)) };
}

const historiser = (i: Incident, le: Horodatage, par: string, texte: string): Incident => ({
  ...i,
  historique: [...(i.historique ?? []), { le, par, texte }],
});

/** « Je m’en occupe » du gérant : l'incident passe « On s’en occupe », et c'est le gérant qui s'en occupe (dit aussi dans l'espace opérations). */
export const prendreEnCharge = (i: Incident, par: string, le: Horodatage): Incident =>
  i.statut === 'ouvert' ? historiser({ ...i, statut: 'en_cours', parGerant: true }, le, par, 'Pris en charge.') : i;

/** « Marquer réglé » du gérant. */
export const marquerRegle = (i: Incident, par: string, le: Horodatage): Incident =>
  i.statut === 'resolu' ? i : historiser({ ...i, statut: 'resolu', resoluLe: le.slice(0, 10) }, le, par, 'Réglé.');

/** « Ajouter un mot » : une ligne d'historique, rien d'autre ne change. */
export function ajouterMot(i: Incident, par: string, le: Horodatage, texte: string): Incident {
  const t = texte.trim().slice(0, 1000);
  return t ? historiser(i, le, par, t) : i;
}
