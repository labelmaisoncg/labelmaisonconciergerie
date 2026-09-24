/**
 * Jeu de démo : améliorations déjà proposées aux propriétaires (suivi du
 * module Performance des biens, SPEC §10). Ids déterministes
 * `reco-<logement>-<code>` : la règle d'automatisation « analyse des biens »
 * ne recrée jamais une amélioration déjà suivie.
 */
import type { RecommandationProprietaire } from './types';

type Graine = Omit<RecommandationProprietaire, 'id'>;

const GRAINES: Graine[] = [
  {
    logementId: 'log-corbeil-t2', proprietaireId: 'pro-marchand', code: 'commission_18',
    titre: 'Passer la commission à 18 % au renouvellement',
    detail: 'Mandat historique à 10 %. Proposé avec le bilan de la saison : agent IA, contrôle photo, suivi du linge.',
    impactEstimeCentimesMois: 12500, impactSur: 'marge_label_maison', porteur: 'label_maison', statut: 'acceptee',
    proposeeLe: '2026-08-28', decideeLe: '2026-09-12', creeLe: '2026-08-25',
    resultatObserve: 'Accord de Mme Marchand : avenant à 18 % au 1er avril 2027, date anniversaire du mandat.',
  },
  {
    logementId: 'log-corbeil-t2', proprietaireId: 'pro-marchand', code: 'isolation_rideaux',
    titre: 'Rideaux occultants et joints acoustiques',
    detail: 'Rideaux doublés dans la chambre et joints de fenêtre côté rue.',
    porteur: 'proprietaire', statut: 'realisee', coutCentimes: 32000,
    proposeeLe: '2026-07-15', decideeLe: '2026-07-20', realiseeLe: '2026-08-05', creeLe: '2026-07-10',
    resultatObserve: 'Rideaux posés le 5 août. Le bruit de la rue revient encore dans deux avis : joints du séjour à compléter.',
  },
  {
    logementId: 'log-evry-t2', proprietaireId: 'pro-mansouri', code: 'commission_18',
    titre: 'Passer la commission à 18 % au renouvellement',
    detail: 'Mandat à 10 % depuis juin 2025. Proposition envoyée avec le relevé d’août.',
    impactEstimeCentimesMois: 11500, impactSur: 'marge_label_maison', porteur: 'label_maison', statut: 'proposee',
    proposeeLe: '2026-09-10', creeLe: '2026-09-08',
  },
  {
    logementId: 'log-juvisy', proprietaireId: 'pro-nguyen', code: 'literie',
    titre: 'Literie neuve (matelas et oreillers)',
    detail: 'Matelas 140 et oreillers à remplacer, cités dans plusieurs avis.',
    porteur: 'proprietaire', statut: 'refusee', coutCentimes: 65000,
    proposeeLe: '2026-08-20', decideeLe: '2026-09-01', creeLe: '2026-08-18',
    resultatObserve: 'M. Nguyen ne veut pas investir avant de décider s’il reprend son logement l’an prochain.',
  },
  {
    logementId: 'log-juvisy', proprietaireId: 'pro-nguyen', code: 'serrure_connectee',
    titre: 'Installer une serrure connectée',
    detail: 'Deux incidents d’accès en été (boîte à clés grippée puis bloquée de nuit).',
    impactEstimeCentimesMois: 6000, impactSur: 'marge_label_maison', porteur: 'proprietaire', statut: 'proposee',
    coutCentimes: 29000, proposeeLe: '2026-09-05', creeLe: '2026-08-18',
  },
  {
    logementId: 'log-massy', proprietaireId: 'pro-lambert', code: 'equipements',
    titre: 'Compléter les équipements cités par les voyageurs',
    detail: 'Box fibre à la place de la clé 4G, répéteur dans la chambre.',
    porteur: 'proprietaire', statut: 'acceptee', coutCentimes: 4500,
    proposeeLe: '2026-09-14', decideeLe: '2026-09-18', creeLe: '2026-09-14',
    resultatObserve: 'Mme Lambert-Roche a souscrit l’abonnement fibre, installation prévue le 2 octobre.',
  },
  {
    logementId: 'log-evry-cosy', proprietaireId: 'pro-carpentier', code: 'photos_annonce',
    titre: 'Photos professionnelles et refonte de l’annonce',
    detail: 'Séance photo lumière du jour, nouveau titre et description orientés télétravail.',
    impactEstimeCentimesMois: 9000, impactSur: 'revenu_bien', porteur: 'label_maison', statut: 'realisee', coutCentimes: 25000,
    proposeeLe: '2026-07-22', decideeLe: '2026-07-24', realiseeLe: '2026-08-12', creeLe: '2026-07-20',
    resultatObserve: 'Taux de clic Airbnb +22 % sur le mois suivant. Prix moyen encore sous le parc : tarification à revoir.',
  },
  {
    logementId: 'log-soisy', proprietaireId: 'pro-sci-valdorge', code: 'remplacer_equipements',
    titre: 'Remplacer les équipements qui tombent en panne',
    detail: 'Chauffe-eau de 2009 en sécurité à répétition : devis de remplacement 200 L transmis.',
    porteur: 'proprietaire', statut: 'proposee', coutCentimes: 98000,
    proposeeLe: '2026-09-23', creeLe: '2026-09-23',
  },
  {
    logementId: 'log-lisses', proprietaireId: 'pro-rousseau', code: 'serrure_connectee',
    titre: 'Installer une serrure connectée',
    detail: 'Arrivées autonomes et codes par séjour, fin de la boîte à clés.',
    impactEstimeCentimesMois: 6000, impactSur: 'marge_label_maison', porteur: 'proprietaire', statut: 'acceptee', coutCentimes: 29000,
    proposeeLe: '2026-09-02', decideeLe: '2026-09-15', creeLe: '2026-09-01',
    resultatObserve: 'Pose par Serrures Express 91 programmée le 8 octobre.',
  },
  {
    logementId: 'log-corbeil-t3', proprietaireId: 'pro-sci-tilleuls', code: 'equipements',
    titre: 'Compléter les équipements cités par les voyageurs',
    detail: 'Vaisselle pour 6, cafetière à capsules et serviettes de réserve.',
    porteur: 'proprietaire', statut: 'realisee', coutCentimes: 18000,
    proposeeLe: '2026-08-18', decideeLe: '2026-08-21', realiseeLe: '2026-09-02', creeLe: '2026-08-18',
    resultatObserve: 'Aucune remarque sur l’équipement dans les avis de septembre.',
  },
];

export function creerRecommandations(): RecommandationProprietaire[] {
  return GRAINES.map((g) => ({ ...g, id: `reco-${g.logementId}-${g.code}` }));
}
