/**
 * CRM de démonstration : personnes fictives (noms, numéros 06 00 00 00 xx,
 * adresses exemple.fr), une ou deux par étape, pour voir l'écran rempli.
 */
import { AUJOURDHUI, ajouterJours } from './format';
import type { ContactCrm, SourceContactCrm, StatutContactCrm } from './types';

const h = (jours: number, heure = '10:12') => `${ajouterJours(AUJOURDHUI, jours)}T${heure}:00+02:00`;

const ligne = (
  n: number,
  nom: string,
  statut: StatutContactCrm,
  source: SourceContactCrm,
  ville: string,
  typeBien: string,
  creeIlYa: number,
  extra: Partial<ContactCrm> = {},
): ContactCrm => ({
  id: `crm-demo-${String(n).padStart(2, '0')}`,
  nom,
  telephone: `06 00 00 00 ${String(n).padStart(2, '0')}`,
  email: `${nom.toLowerCase().split(' ')[0]}@exemple.fr`,
  ville,
  typeBien,
  page: `/conciergerie-airbnb-${ville.toLowerCase().replace(/[^a-z]+/g, '-')}`,
  source,
  statut,
  notes: '',
  tentatives: 0,
  historique: [{ le: h(-creeIlYa), par: 'Site web', resultat: 'formulaire', texte: extra.message ?? 'Demande d’estimation.' }],
  creeLe: h(-creeIlYa),
  majLe: h(-creeIlYa),
  ...extra,
});

export function creerContactsCrm(): ContactCrm[] {
  return [
    ligne(1, 'Sophie Martin', 'a_appeler', 'audit', 'Massy', 'T2 meublé', 0, { message: 'T2 près de la gare, libre en novembre.' }),
    ligne(2, 'Karim Benali', 'a_appeler', 'accueil', 'Évry-Courcouronnes', 'Studio', 0, { message: 'Studio rénové, je veux savoir combien ça peut rapporter.' }),
    ligne(3, 'Julie Moreau', 'a_rappeler', 'audit', 'Juvisy-sur-Orge', 'T3', 2, {
      tentatives: 2,
      relanceLe: AUJOURDHUI,
      historique: [
        { le: h(-1, '18:05'), par: 'Kamel', resultat: 'messagerie', texte: 'Message laissé.' },
        { le: h(-2, '11:40'), par: 'Kamel', resultat: 'pas_de_reponse' },
        { le: h(-2), par: 'Site web', resultat: 'formulaire', texte: 'Demande d’estimation.' },
      ],
    }),
    ligne(4, 'Thomas Leroy', 'contacte', 'contact', 'Corbeil-Essonnes', 'Maison', 5, {
      responsable: 'abdel',
      relanceLe: ajouterJours(AUJOURDHUI, 2),
      notes: 'Intéressé, attend l’accord de sa femme. Envoyer la simulation.',
    }),
    ligne(5, 'Nadia Haddad', 'en_attente', 'audit', 'Palaiseau', 'T2', 12, {
      motifAttente: 'Travaux de cuisine jusqu’à fin novembre',
      relanceLe: ajouterJours(AUJOURDHUI, 30),
      responsable: 'kamel',
    }),
    ligne(6, 'Pierre Dubois', 'rendez_vous', 'accueil', 'Athis-Mons', 'T3', 8, {
      responsable: 'abdel',
      relanceLe: ajouterJours(AUJOURDHUI, 3),
      notes: 'Visite du bien jeudi 14 h.',
    }),
    ligne(7, 'Inès Garcia', 'signe', 'cercle', 'Draveil', 'Studio', 25, { responsable: 'kamel' }),
    ligne(8, 'Marc Petit', 'pas_interesse', 'contact', 'Orly', 'T2', 20, { notes: 'Préfère louer en meublé classique.' }),
  ];
}
