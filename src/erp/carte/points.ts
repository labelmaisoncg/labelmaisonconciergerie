/**
 * Logements de la carte, selon l'espace :
 * - gérant : calculés dans l'ERP sur les données de l'espace ouvert (Label
 *   Maison, Sens…), logements gérés seulement (pas « Sorti ») ;
 * - propriétaire et opérations : déjà calculés et réduits par le serveur
 *   (LogementVue.carte, LogementOps.carte) ; l'écran ne fait que les poser.
 * Voyageur « Prénom N. » partout.
 */
import { etatDuJour, jourCarte, titreIncident, type JourCarte, type PointCarte, type VarianteCarte } from '../data/carte';
import { prenomInitiale } from '../data/proprietaire';
import type { DateISO, ErpDonnees, Id } from '../data/types';
import { photosLogement } from '../modules/logements/_composants/stats';

const NOTES: Partial<Record<string, string>> = { lancement: 'En préparation : pas encore en location.', pause: 'En pause : pas de nouvelle réservation.' };

/** Gérant : tous les logements gérés de l'espace, avec le nom de qui fait le ménage. */
export function pointsDuGerant(
  d: Pick<ErpDonnees, 'logements' | 'reservations' | 'missions' | 'incidents' | 'controles' | 'prestataires'>,
  aujourdhui: DateISO,
): PointCarte[] {
  const nomPrestataire = new Map(d.prestataires.map((p) => [p.id, p.nom]));
  const variante: VarianteCarte = {
    voyageur: (r) => prenomInitiale(r.voyageur?.nom),
    probleme: (i) => titreIncident(i),
    lienProbleme: true,
    menagePar: (m) => (m.prestataireId ? nomPrestataire.get(m.prestataireId) : undefined),
    menageInterne: true,
  };
  const entrees = { reservations: d.reservations, missions: d.missions, incidents: d.incidents, controles: d.controles };
  return d.logements
    .filter((l) => l && l.statut !== 'sorti')
    .map((l) => {
      const photo = photosLogement(l)[0];
      const note = NOTES[l.statut];
      return { id: l.id, nom: l.nom, ville: l.ville, ...(photo ? { photo } : {}), ...(note ? { note } : {}), ...jourCarte(l, etatDuJour(l.id, entrees, aujourdhui), variante) };
    });
}

/** Propriétaire ou opérations : les logements de la vue, avec ce que le serveur a calculé. */
export function pointsDeLaVue(logements: readonly { id: Id; nom: string; ville: string; photo?: string; carte?: JourCarte }[]): PointCarte[] {
  return logements
    .filter((l) => !!l.carte)
    .map((l) => ({ id: l.id, nom: l.nom, ville: l.ville, ...(l.photo ? { photo: l.photo } : {}), ...l.carte!, problemes: l.carte!.problemes ?? [] }));
}
