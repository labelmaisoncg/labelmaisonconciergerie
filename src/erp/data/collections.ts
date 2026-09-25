/**
 * Liste des collections de l'ERP, partagée par le store et la synchronisation.
 */
import type { ErpDonnees, NomCollection } from './types';

export const COLLECTIONS: NomCollection[] = [
  'proprietaires', 'mandats', 'logements', 'reservations', 'filsMessages', 'missions', 'prestataires',
  'mouvementsLinge', 'incidents', 'factures', 'paiementsPrestataires', 'charges', 'prospects',
  'utilisateurs', 'journal', 'recommandations', 'versionsAnnonce', 'reglages',
];

/**
 * Collections enregistrées dans erp.enregistrements. `utilisateurs` n'en fait
 * pas partie : l'équipe vient de la table erp.membres.
 */
export const COLLECTIONS_SYNCHRONISEES: NomCollection[] = COLLECTIONS.filter((c) => c !== 'utilisateurs');

/** Jeu de données vide : chaque collection présente, sans élément. */
export function donneesVides(): ErpDonnees {
  return Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as ErpDonnees;
}

/** Garantit la présence de toutes les collections (sauvegarde ancienne, base vide). */
export function completer(d: Partial<ErpDonnees>): ErpDonnees {
  const manquantes = COLLECTIONS.filter((c) => !Array.isArray((d as Record<string, unknown>)[c]));
  return (manquantes.length ? { ...d, ...Object.fromEntries(manquantes.map((c) => [c, []])) } : d) as ErpDonnees;
}

/** Journal toujours du plus récent au plus ancien (les écrans prennent les premières lignes). */
export function trierJournal<T>(journal: T[]): T[] {
  const h = (x: T) => String((x as { horodatage?: unknown })?.horodatage ?? '');
  return journal.slice().sort((a, b) => h(b).localeCompare(h(a)));
}
