/**
 * Démo de l'espace propriétaire : SCI Les Tilleuls (Corbeil Centre Familial)
 * est connectée, a deux documents partagés et le bilan d'août publié.
 * Aperçu : /espace-proprietaire?apercu=pro-sci-tilleuls (VITE_ERP_DEMO=1).
 */
import { bilanMensuel } from './proprietaire';
import type { Logement, Mandat, Reservation } from './types';
import type { AccesProprietaire, BilanProprietaire, DocumentProprietaire } from './types-proprietaire';

export const PROPRIETAIRE_DEMO = 'pro-sci-tilleuls';

export function creerEspaceProprietaireDemo(d: { logements: Logement[]; reservations: Reservation[]; mandats: Mandat[] }): {
  accesProprietaires: AccesProprietaire[];
  documentsProprietaire: DocumentProprietaire[];
  bilansProprietaire: BilanProprietaire[];
} {
  const p = PROPRIETAIRE_DEMO;
  return {
    accesProprietaires: [
      {
        id: p,
        proprietaireId: p,
        email: 'gestion@sci-lestilleuls.fr',
        statut: 'actif',
        inviteLe: '2026-09-02T09:12:00.000Z',
        invitePar: 'equipe@labelmaisoncg.fr',
        derniereConnexion: '2026-09-21T16:40:00.000Z',
        version: 1,
        liens: [],
      },
    ],
    documentsProprietaire: [
      {
        id: 'doc-tilleuls-mandat',
        proprietaireId: p,
        logementId: 'log-corbeil-t3',
        categorie: 'contrat',
        titre: 'Mandat de gestion LM-M-2025-007',
        fichier: `demo://proprietaires/${p}/mandat-LM-M-2025-007.pdf`,
        nomFichier: 'mandat-LM-M-2025-007.pdf',
        ajouteLe: '2025-11-20T10:00:00.000Z',
        ajoutePar: 'equipe@labelmaisoncg.fr',
      },
      {
        id: 'doc-tilleuls-assurance',
        proprietaireId: p,
        logementId: 'log-corbeil-t3',
        categorie: 'attestation',
        titre: 'Attestation d’assurance responsabilité civile 2026',
        fichier: `demo://proprietaires/${p}/attestation-rc-2026.pdf`,
        nomFichier: 'attestation-rc-2026.pdf',
        ajouteLe: '2026-09-04T08:30:00.000Z',
        ajoutePar: 'equipe@labelmaisoncg.fr',
      },
    ],
    bilansProprietaire: [
      {
        id: `${p}-2026-08`,
        proprietaireId: p,
        mois: '2026-08',
        statut: 'publie',
        commentaire:
          'Merci pour votre confiance. Le détail des séjours du mois est ci-dessous ; appelez-nous pour toute question.',
        chiffres: bilanMensuel(d, p, '2026-08'),
        publieLe: '2026-09-03T08:00:00.000Z',
        publiePar: 'equipe@labelmaisoncg.fr',
        majLe: '2026-09-03T08:00:00.000Z',
      },
    ],
  };
}
