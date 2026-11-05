/**
 * Démo des demandes des propriétaires (données fictives) : la SCI Les
 * Tilleuls (espace connecté) a une demande de clés répondue, une question
 * qui attend le gérant et une demande de linge réglée ; Sophie Lambert-Roche
 * (deux logements) demande de bloquer les fêtes sur tous ses logements (vue) ;
 * Hélène Marchand prévient de travaux dans la copropriété (nouvelle).
 */
import type { DemandeProprietaire } from './types';

const GERANT = 'abdel@labelmaisoncg.fr';

export function creerDemandesDemo(): DemandeProprietaire[] {
  return [
    {
      id: 'dem-0a1b2c3d4e5f60718293a4b5',
      proprietaireId: 'pro-sci-tilleuls',
      type: 'question',
      logementId: 'log-corbeil-t3',
      statut: 'envoyee',
      creeLe: '2026-09-24T08:40:00+02:00',
      majLe: '2026-09-24T08:40:00+02:00',
      echanges: [
        {
          id: 'dem-0a1b2c3d4e5f60718293a4b5-1',
          auteur: 'proprietaire',
          texte: 'Bonjour, le bilan d’août compte deux nuits de moins que l’an dernier. Est-ce lié aux travaux de la rue ? Merci de me tenir au courant.',
          le: '2026-09-24T08:40:00+02:00',
        },
      ],
      historique: [{ statut: 'envoyee', le: '2026-09-24T08:40:00+02:00' }],
    },
    {
      id: 'dem-1c2d3e4f5a6b7c8d9e0f1a2b',
      proprietaireId: 'pro-sci-tilleuls',
      type: 'demande',
      sujet: 'cles',
      logementId: 'log-corbeil-t3',
      statut: 'repondue',
      creeLe: '2026-09-21T09:14:00+02:00',
      majLe: '2026-09-21T11:02:00+02:00',
      echanges: [
        {
          id: 'dem-1c2d3e4f5a6b7c8d9e0f1a2b-1',
          auteur: 'proprietaire',
          texte: 'Je passe à Corbeil samedi 26 septembre. Pouvez-vous me laisser un jeu de clés ? Je les rendrai le dimanche soir.',
          le: '2026-09-21T09:14:00+02:00',
        },
        {
          id: 'dem-1c2d3e4f5a6b7c8d9e0f1a2b-2',
          auteur: 'conciergerie',
          texte: 'Bonjour, c’est noté : un jeu de clés vous attendra dans la boîte à clés samedi matin. Nous vous envoyons son code la veille. Bonne journée !',
          le: '2026-09-21T11:02:00+02:00',
          par: GERANT,
        },
      ],
      historique: [
        { statut: 'envoyee', le: '2026-09-21T09:14:00+02:00' },
        { statut: 'vue', le: '2026-09-21T10:48:00+02:00', par: GERANT },
        { statut: 'repondue', le: '2026-09-21T11:02:00+02:00', par: GERANT },
      ],
    },
    {
      id: 'dem-2e3f4a5b6c7d8e9f0a1b2c3d',
      proprietaireId: 'pro-sci-tilleuls',
      type: 'demande',
      sujet: 'linge',
      logementId: 'log-corbeil-t3',
      statut: 'reglee',
      creeLe: '2026-09-10T17:25:00+02:00',
      majLe: '2026-09-12T15:10:00+02:00',
      echanges: [
        {
          id: 'dem-2e3f4a5b6c7d8e9f0a1b2c3d-1',
          auteur: 'proprietaire',
          texte: 'Les serviettes de bain commencent à s’abîmer. Pouvez-vous les remplacer ? Je vous laisse choisir le modèle.',
          le: '2026-09-10T17:25:00+02:00',
        },
        {
          id: 'dem-2e3f4a5b6c7d8e9f0a1b2c3d-2',
          auteur: 'conciergerie',
          texte: 'C’est fait : six serviettes neuves sont en place depuis ce matin. Elles figureront sur la facture de septembre.',
          le: '2026-09-12T15:08:00+02:00',
          par: GERANT,
        },
      ],
      historique: [
        { statut: 'envoyee', le: '2026-09-10T17:25:00+02:00' },
        { statut: 'vue', le: '2026-09-11T08:30:00+02:00', par: GERANT },
        { statut: 'repondue', le: '2026-09-12T15:08:00+02:00', par: GERANT },
        { statut: 'reglee', le: '2026-09-12T15:10:00+02:00', par: GERANT },
      ],
    },
    {
      id: 'dem-3a4b5c6d7e8f9a0b1c2d3e4f',
      proprietaireId: 'pro-lambert',
      type: 'demande',
      sujet: 'calendrier',
      tousLogements: true,
      statut: 'vue',
      creeLe: '2026-09-23T18:05:00+02:00',
      majLe: '2026-09-24T09:12:00+02:00',
      echanges: [
        {
          id: 'dem-3a4b5c6d7e8f9a0b1c2d3e4f-1',
          auteur: 'proprietaire',
          texte: 'Nous aimerions garder nos deux logements pour la famille du 20 au 27 décembre. Pouvez-vous fermer ces dates aux réservations ?',
          le: '2026-09-23T18:05:00+02:00',
        },
      ],
      historique: [
        { statut: 'envoyee', le: '2026-09-23T18:05:00+02:00' },
        { statut: 'vue', le: '2026-09-24T09:12:00+02:00', par: GERANT },
      ],
    },
    {
      id: 'dem-4b5c6d7e8f9a0b1c2d3e4f5a',
      proprietaireId: 'pro-marchand',
      type: 'demande',
      sujet: 'travaux',
      logementId: 'log-corbeil-t2',
      statut: 'envoyee',
      creeLe: '2026-09-24T07:55:00+02:00',
      majLe: '2026-09-24T07:55:00+02:00',
      echanges: [
        {
          id: 'dem-4b5c6d7e8f9a0b1c2d3e4f5a-1',
          auteur: 'proprietaire',
          texte: 'La copropriété refait la cage d’escalier du 3 au 7 novembre. Faut-il prévenir les voyageurs de ces dates ?',
          le: '2026-09-24T07:55:00+02:00',
        },
      ],
      historique: [{ statut: 'envoyee', le: '2026-09-24T07:55:00+02:00' }],
    },
  ];
}
