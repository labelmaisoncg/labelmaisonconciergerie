/**
 * Catalogue des automatisations, dans l'ordre d'exécution du moteur :
 * référentiel → réservations → opérations → prestataires → finance → pilotage.
 *
 * Chaque règle est PURE (aucune date système, aucun effet de bord) et
 * IDEMPOTENTE : ids déterministes dérivés des ids sources, existence vérifiée
 * avant toute création. Relancer le moteur ne crée jamais de doublon.
 */
import { activationLogement, escaladeIncidents, messagesEnAttente, plafondResidencePrincipale, rappelsCommerciaux } from './regles-pilotage';
import { attribuerAutomatiquement, controleQualite, preuvesManquantes } from './regles-operations';
import { documentsPrestataires, suiviLinge } from './regles-prestataires';
import { annulerMenageSiAnnulation, creerMenageAuDepart } from './regles-reservations';
import { facturationMensuelle, paiementsPrestataires, relanceFactures } from './regles-finance';
import { ORDRE_DOMAINES, type Regle } from './types';

const CATALOGUE: Regle[] = [
  activationLogement,
  creerMenageAuDepart,
  annulerMenageSiAnnulation,
  attribuerAutomatiquement,
  controleQualite,
  preuvesManquantes,
  suiviLinge,
  documentsPrestataires,
  paiementsPrestataires,
  relanceFactures,
  facturationMensuelle,
  plafondResidencePrincipale,
  rappelsCommerciaux,
  messagesEnAttente,
  escaladeIncidents,
];

/** Règles triées par domaine (tri stable : l'ordre du catalogue est conservé dans un domaine). */
export const REGLES: Regle[] = [...CATALOGUE].sort(
  (a, b) => ORDRE_DOMAINES.indexOf(a.domaine) - ORDRE_DOMAINES.indexOf(b.domaine),
);

/** Clés des règles actives par défaut. */
export const REGLES_ACTIVES_PAR_DEFAUT: string[] = REGLES.filter((r) => r.actifParDefaut).map((r) => r.cle);

export function regleParCle(cle: string): Regle | undefined {
  return REGLES.find((r) => r.cle === cle);
}
