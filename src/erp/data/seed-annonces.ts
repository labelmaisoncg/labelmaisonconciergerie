/**
 * Jeu de démo : historique des versions d'annonce (SPEC §11).
 *
 * Les textes sont produits par le même générateur que la règle mensuelle
 * (annonces/generer.ts), à la date de leur création : ils ne s'appuient que
 * sur la fiche, les avis et les améliorations connus à cette date. Ids
 * déterministes `ann-<logement>-<mois>` : la règle « Rafraîchissement mensuel
 * des annonces » ne recrée jamais un mois déjà traité.
 */
import { proposerVersion, type DonneesAnnonce } from '../annonces/generer';
import type { StatutVersionAnnonce, VersionAnnonce } from './types';

interface Etape {
  logementId: string;
  mois: string;
  creeLe: string;
  statut: StatutVersionAnnonce;
  valideePar?: string;
  valideeLe?: string;
  publieeLe?: string;
  motifRejet?: string;
  source?: 'agent' | 'humain';
}

const pub = (logementId: string, mois: string, creeLe: string, valideeLe: string, publieeLe: string, valideePar = 'Kamel'): Etape => ({
  logementId, mois, creeLe, statut: 'publiee', valideePar, valideeLe, publieeLe,
});

const PLAN: Etape[] = [
  pub('log-corbeil-t2', '2026-06', '2026-06-02', '2026-06-03', '2026-06-04'),
  pub('log-corbeil-t2', '2026-08', '2026-08-01', '2026-08-02', '2026-08-03', 'Abdel'),
  { logementId: 'log-corbeil-t2', mois: '2026-09', creeLe: '2026-09-02', statut: 'proposee' },

  pub('log-corbeil-t3', '2026-08', '2026-08-03', '2026-08-04', '2026-08-05'),
  { logementId: 'log-corbeil-t3', mois: '2026-09', creeLe: '2026-09-18', statut: 'validee', valideePar: 'Abdel', valideeLe: '2026-09-22' },

  pub('log-evry-t2', '2026-07', '2026-07-03', '2026-07-05', '2026-07-06', 'Abdel'),
  { logementId: 'log-evry-t2', mois: '2026-09', creeLe: '2026-09-15', statut: 'proposee' },

  { ...pub('log-evry-cosy', '2026-08', '2026-08-11', '2026-08-11', '2026-08-12'), source: 'humain' },
  { logementId: 'log-evry-cosy', mois: '2026-09', creeLe: '2026-09-21', statut: 'proposee' },

  pub('log-lisses', '2026-07', '2026-07-08', '2026-07-09', '2026-07-10'),

  pub('log-juvisy', '2026-06', '2026-06-10', '2026-06-11', '2026-06-12', 'Abdel'),

  pub('log-soisy', '2026-06', '2026-06-06', '2026-06-07', '2026-06-08'),
  pub('log-soisy', '2026-09', '2026-09-05', '2026-09-07', '2026-09-08'),

  pub('log-paris14', '2026-08', '2026-08-04', '2026-08-05', '2026-08-06', 'Abdel'),
  {
    logementId: 'log-paris14', mois: '2026-09', creeLe: '2026-09-03', statut: 'rejetee',
    motifRejet: 'Trop proche de la version d’août : on attend les avis de la rentrée pour changer d’angle.',
  },

  pub('log-massy', '2026-07', '2026-07-14', '2026-07-15', '2026-07-15'),
  pub('log-massy', '2026-09', '2026-09-09', '2026-09-10', '2026-09-11', 'Abdel'),
];

export function creerVersionsAnnonce(base: DonneesAnnonce): VersionAnnonce[] {
  return PLAN.map(({ logementId, mois, creeLe, source, ...suivi }) => ({
    ...proposerVersion(base, logementId, mois, creeLe),
    ...suivi,
    source: source ?? 'agent',
  }));
}
