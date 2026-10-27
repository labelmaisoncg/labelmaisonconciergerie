/**
 * Démo de l'espace propriétaire : SCI Les Tilleuls (Corbeil Centre Familial)
 * est connectée, a deux documents partagés, le bilan d'août publié et ses
 * factures émises partagées (une payée avec son PDF, une en retard). Sa
 * facture mensuelle d'août attend la relecture du gérant (brouillon préparé
 * par le passage du 1er septembre), avec une prolongation (un seul ménage).
 * Aperçu : /espace-proprietaire?apercu=pro-sci-tilleuls (VITE_ERP_DEMO=1).
 */
import { idFactureMensuelle, PAR_AUTOMATIQUE, preparerBrouillon } from './factures-mensuelles';
import { IDENTITE_LABEL_MAISON } from './identite-conciergerie';
import { bilanMensuel } from './proprietaire';
import type { Facture, Logement, Mandat, Reservation } from './types';
import type { AccesProprietaire, BilanProprietaire, DocumentProprietaire } from './types-proprietaire';

export const PROPRIETAIRE_DEMO = 'pro-sci-tilleuls';

/**
 * Démo : en août, au Corbeil Centre Familial, la voyageuse d'un séjour
 * prolonge par une seconde réservation qui le suit (même voyageuse) : deux
 * réservations, un séjour, un ménage (consoliderSejours).
 */
export function prolongationDemo(reservations: Reservation[]): Reservation[] {
  const aout = reservations
    .filter((r) => r.logementId === 'log-corbeil-t3' && r.statut !== 'annulee' && r.arrivee.startsWith('2026-08'))
    .sort((a, b) => a.arrivee.localeCompare(b.arrivee));
  const suite = aout.find((r, i) => i > 0 && aout[i - 1].depart === r.arrivee);
  if (!suite) return reservations;
  const avant = aout[aout.indexOf(suite) - 1];
  return reservations.map((r) => (r === suite ? { ...r, canal: avant.canal, voyageur: { ...avant.voyageur } } : r));
}

export function creerEspaceProprietaireDemo(d: { logements: Logement[]; reservations: Reservation[]; mandats: Mandat[]; factures: Facture[] }): {
  accesProprietaires: AccesProprietaire[];
  documentsProprietaire: DocumentProprietaire[];
  bilansProprietaire: BilanProprietaire[];
  factures: Facture[];
} {
  const p = PROPRIETAIRE_DEMO;
  const factures = d.factures.map((f) => (f.proprietaireId === p && f.statut !== 'brouillon' && f.statut !== 'annulee' ? { ...f, partageeLe: `${f.dateEmission}T09:00:00.000Z` } : f));
  const premiere = factures.filter((f) => f.partageeLe).sort((a, b) => a.dateEmission.localeCompare(b.dateEmission))[0];
  // Facture mensuelle d'août : brouillon préparé par le passage du 1er septembre, à relire et valider.
  const brouillonAout = d.factures.some((f) => f.id === idFactureMensuelle(p, '2026-08'))
    ? null
    : preparerBrouillon({ donnees: d, proprietaireId: p, mois: '2026-08', identite: IDENTITE_LABEL_MAISON, aujourdhui: '2026-09-01', maintenant: '2026-09-01T00:30:00.000Z', par: PAR_AUTOMATIQUE });
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
      ...(premiere
        ? [
            {
              id: `doc-tilleuls-${premiere.id}`,
              proprietaireId: p,
              factureId: premiere.id,
              categorie: 'facture' as const,
              titre: `Facture ${premiere.numero}`,
              fichier: `demo://proprietaires/${p}/${premiere.numero}.pdf`,
              nomFichier: `${premiere.numero}.pdf`,
              ajouteLe: `${premiere.dateEmission}T09:00:00.000Z`,
              ajoutePar: 'equipe@labelmaisoncg.fr',
            },
          ]
        : []),
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
    factures: brouillonAout ? [...factures, brouillonAout] : factures,
  };
}
