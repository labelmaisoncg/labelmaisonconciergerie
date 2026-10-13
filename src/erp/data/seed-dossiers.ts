/**
 * Dossier propriétaire de démonstration (données fictives), rattaché au
 * logement en lancement de la démo (Linas).
 */
import type { DossierProprietaire } from './types';

export function creerDossiersDemo(): DossierProprietaire[] {
  return [
    {
      id: 'dos-demo-linas',
      proprietaireId: 'pro-lambert',
      logementId: 'log-linas',
      recuLe: '2026-10-08T18:42:00+02:00',
      valeurs: {
        'prop.prenom': 'Sophie',
        'prop.nom': 'Lambert-Roche',
        'prop.tel': '07 52 19 86 30',
        'prop.email': 's.lambertroche@exemple.fr',
        'prop.qualite': 'particulier',
        'prop.adresse': '2 rue des Lilas, 91300 Massy',
        'bien.adresse': '18 rue des Essais',
        'bien.cp': '91310',
        'bien.ville': 'Linas',
        'bien.type': 'maison',
        'bien.couchages': '6',
        'bien.chambres': '3',
        'bien.surface': '95',
        'bien.residence': 'secondaire',
        'acces.mode': 'boite',
        'equip.manquants': ['electromenager', 'literie'],
        'linge.fournisseur': 'labelmaison',
        'annonce.compte': 'acreer',
        notes: 'Le volet de la chambre se bloque à mi-course.',
        'decl.certif': true,
      },
    },
  ];
}
