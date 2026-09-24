/**
 * Jeu de démo : référentiel saisi à la main (propriétaires, logements,
 * mandats, prestataires, utilisateurs, prospects). Tous les noms et adresses
 * sont fictifs.
 */
import { CHECKLIST_LANCEMENT } from './constantes';
import type {
  CleChecklistLancement,
  ElementChecklistLancement,
  FicheLogement,
  LigneArticle,
  Logement,
  Mandat,
  Prestataire,
  Proprietaire,
  Prospect,
  TypeLogement,
  Utilisateur,
} from './types';

/* ----------------------------------------------------------- propriétaires */

export const PROPRIETAIRES: Proprietaire[] = [
  {
    id: 'pro-marchand',
    type: 'particulier',
    nom: 'Hélène Marchand',
    contact: { email: 'helene.marchand@exemple.fr', telephone: '06 12 48 73 20' },
    adresse: '8 allée des Charmilles, 91100 Corbeil-Essonnes',
    ibanMasque: 'FR76 •••• •••• •••• 4821',
    notes: 'Premier mandat de Label Maison. Commission historique à 10 %, migration prévue au renouvellement de janvier.',
    creeLe: '2025-03-14',
  },
  {
    id: 'pro-sci-tilleuls',
    type: 'sci',
    nom: 'SCI Les Tilleuls',
    contact: { email: 'gestion@sci-lestilleuls.fr', telephone: '01 64 96 21 57' },
    adresse: '27 rue du Moulin Galant, 91100 Corbeil-Essonnes',
    ibanMasque: 'FR76 •••• •••• •••• 0934',
    notes: 'Gérant : M. Vasseur. Veut un relevé détaillé par réservation. Paie parfois en retard, relancer au J+5.',
    creeLe: '2025-11-02',
  },
  {
    id: 'pro-mansouri',
    type: 'particulier',
    nom: 'Farid Mansouri',
    contact: { email: 'f.mansouri@exemple.fr', telephone: '07 81 36 44 09' },
    adresse: '5 rue des Glycines, 91000 Évry-Courcouronnes',
    ibanMasque: 'FR76 •••• •••• •••• 7710',
    notes: 'Deux biens confiés, le studio de Ris-Orangis est sorti en juillet (vente). Mandat Évry à 10 %.',
    creeLe: '2025-05-20',
  },
  {
    id: 'pro-carpentier',
    type: 'particulier',
    nom: 'Julie Carpentier',
    contact: { email: 'julie.carpentier@exemple.fr', telephone: '06 55 09 18 62' },
    adresse: '14 avenue des Peupliers, 94000 Créteil',
    ibanMasque: 'FR76 •••• •••• •••• 3368',
    notes: 'Investisseuse, très réactive par e-mail. Intéressée par un deuxième bien à Évry.',
    creeLe: '2026-01-09',
  },
  {
    id: 'pro-rousseau',
    type: 'particulier',
    nom: 'Bernard et Odile Rousseau',
    contact: { email: 'rousseau.bo@exemple.fr', telephone: '06 70 23 91 44' },
    adresse: '3 chemin des Vignes, 91090 Lisses',
    ibanMasque: 'FR76 •••• •••• •••• 5102',
    notes: 'Retraités, habitent à proximité. Préfèrent le téléphone. Passent parfois récupérer le courrier.',
    creeLe: '2026-02-18',
  },
  {
    id: 'pro-nguyen',
    type: 'particulier',
    nom: 'Thomas Nguyen',
    contact: { email: 't.nguyen@exemple.fr', telephone: '06 31 77 50 28' },
    adresse: '41 rue Hoche, 91260 Juvisy-sur-Orge',
    ibanMasque: 'FR76 •••• •••• •••• 9047',
    notes: 'Résidence principale louée pendant ses déplacements : suivre le compteur des 120 nuits.',
    creeLe: '2025-06-30',
  },
  {
    id: 'pro-sci-valdorge',
    type: 'sci',
    nom: 'SCI Val d’Orge Patrimoine',
    contact: { email: 'contact@valdorge-patrimoine.fr', telephone: '01 69 40 12 83' },
    adresse: '12 place de la Mairie, 91450 Soisy-sur-Seine',
    ibanMasque: 'FR76 •••• •••• •••• 2285',
    notes: 'Associés : famille Perrault. Facture adressée à la SCI, relevé en copie aux deux associés.',
    creeLe: '2026-03-04',
  },
  {
    id: 'pro-dubreuil',
    type: 'particulier',
    nom: 'Claire Dubreuil',
    contact: { email: 'claire.dubreuil@exemple.fr', telephone: '06 08 64 35 71' },
    adresse: '19 rue Sarrette, 75014 Paris',
    ibanMasque: 'FR76 •••• •••• •••• 6613',
    notes: 'Expatriée à Lyon. Contact par e-mail uniquement, réponse sous 48 h.',
    creeLe: '2026-04-22',
  },
  {
    id: 'pro-lambert',
    type: 'particulier',
    nom: 'Sophie Lambert-Roche',
    contact: { email: 's.lambertroche@exemple.fr', telephone: '07 52 19 86 30' },
    adresse: '2 rue des Lilas, 91300 Massy',
    ibanMasque: 'FR76 •••• •••• •••• 1459',
    notes: 'Massy en gestion depuis juillet. Nous confie la maison familiale de Linas : lancement en cours.',
    creeLe: '2026-06-11',
  },
];

/* --------------------------------------------------------------- logements */

/** Paramètres de génération propres à chaque logement (hors modèle). */
export interface ProfilLogement {
  /** Prix de base par nuit, en euros. */
  prixNuit: number;
  /** Écart moyen entre deux séjours (plus bas = plus rempli). */
  tension: number;
  prestataireMenageId: string;
  enLigneDepuis: string;
  horsLigneLe?: string;
}

function checklist(manquants: CleChecklistLancement[] = []): ElementChecklistLancement[] {
  return CHECKLIST_LANCEMENT.map(({ cle, libelle }) => ({
    cle,
    libelle,
    fait: !manquants.includes(cle),
    preuve: manquants.includes(cle) ? undefined : `demo://preuves/${cle}.pdf`,
  }));
}

function fiche(p: Partial<FicheLogement> & Pick<FicheLogement, 'wifiNom' | 'acces'>): FicheLogement {
  return {
    wifiCode: 'LabelMaison-2026',
    heureArrivee: '16:00',
    heureDepart: '11:00',
    parking: 'Stationnement gratuit dans la rue',
    regles: 'Non fumeur. Pas de fêtes. Animaux non admis. Calme après 22 h.',
    equipements: ['Wifi fibre', 'Cuisine équipée', 'Lave-linge', 'Machine à café', 'Télévision', 'Fer à repasser'],
    ...p,
  };
}

function dotation(doubles: number, simples: number, canapes: number, sdb = 1): LigneArticle[] {
  const jeux = 3; // un en place, un en blanchisserie, un de secours
  const lignes: LigneArticle[] = [];
  if (doubles + canapes) lignes.push({ article: 'Drap housse 140', quantite: (doubles + canapes) * jeux });
  if (simples) lignes.push({ article: 'Drap housse 90', quantite: simples * jeux });
  if (doubles + canapes) lignes.push({ article: 'Housse de couette 240', quantite: (doubles + canapes) * jeux });
  if (simples) lignes.push({ article: 'Housse de couette 140', quantite: simples * jeux });
  const couchages = (doubles + canapes) * 2 + simples;
  lignes.push({ article: 'Taie d’oreiller', quantite: couchages * jeux });
  lignes.push({ article: 'Serviette de bain', quantite: couchages * jeux });
  lignes.push({ article: 'Serviette de toilette', quantite: couchages * jeux });
  lignes.push({ article: 'Tapis de bain', quantite: sdb * jeux });
  lignes.push({ article: 'Torchon', quantite: 6 });
  return lignes;
}

const tousCanaux = (id: string) => [
  { canal: 'airbnb' as const, url: `https://www.airbnb.fr/rooms/demo-${id}`, connecte: true },
  { canal: 'booking' as const, url: `https://www.booking.com/hotel/fr/demo-${id}.html`, connecte: true },
  { canal: 'direct' as const, connecte: true },
];

export const LOGEMENTS: Logement[] = [
  {
    id: 'log-corbeil-t2',
    nom: 'Corbeil Rives de Seine',
    adresse: '12 quai des Tanneurs',
    ville: 'Corbeil-Essonnes',
    codePostal: '91100',
    type: 'T2',
    surfaceM2: 42,
    capacite: 4,
    chambres: 1,
    lits: [{ type: 'double', nombre: 1 }, { type: 'canape', nombre: 1 }],
    statut: 'actif',
    proprietaireId: 'pro-marchand',
    residencePrincipale: false,
    numeroEnregistrement: '91174000125RX',
    dpe: 'D',
    serrure: 'boite_a_cles',
    fiche: fiche({
      wifiNom: 'Livebox-RivesSeine',
      acces: 'Boîte à clés à gauche de la porte du hall, code envoyé la veille. 2e étage sans ascenseur.',
      parking: 'Parking public quai de l’Essonne à 150 m',
    }),
    dotationLinge: dotation(1, 0, 1),
    channexPropertyId: 'chx-prop-1001',
    annonces: tousCanaux('corbeil-t2'),
    checklistLancement: checklist(),
  },
  {
    id: 'log-corbeil-t3',
    nom: 'Corbeil Centre Familial',
    adresse: '6 rue des Remparts',
    ville: 'Corbeil-Essonnes',
    codePostal: '91100',
    type: 'T3',
    surfaceM2: 64,
    capacite: 6,
    chambres: 2,
    lits: [{ type: 'double', nombre: 1 }, { type: 'simple', nombre: 2 }, { type: 'canape', nombre: 1 }],
    statut: 'actif',
    proprietaireId: 'pro-sci-tilleuls',
    residencePrincipale: false,
    numeroEnregistrement: '91174000318KL',
    dpe: 'C',
    serrure: 'connectee',
    fiche: fiche({
      wifiNom: 'SFR-Remparts',
      acces: 'Serrure connectée Nuki, code unique généré pour chaque séjour. 1er étage.',
      parking: 'Place privée n° 14 dans la cour',
    }),
    dotationLinge: dotation(1, 2, 1),
    channexPropertyId: 'chx-prop-1002',
    annonces: tousCanaux('corbeil-t3'),
    checklistLancement: checklist(),
  },
  {
    id: 'log-evry-t2',
    nom: 'Évry Parc des Loges',
    adresse: '31 allée du Bois Guillaume',
    ville: 'Évry-Courcouronnes',
    codePostal: '91000',
    type: 'T2',
    surfaceM2: 45,
    capacite: 4,
    chambres: 1,
    lits: [{ type: 'double', nombre: 1 }, { type: 'canape', nombre: 1 }],
    statut: 'actif',
    proprietaireId: 'pro-mansouri',
    residencePrincipale: false,
    numeroEnregistrement: '91228000207ME',
    dpe: 'D',
    serrure: 'boite_a_cles',
    fiche: fiche({
      wifiNom: 'Bbox-ParcLoges',
      acces: 'Boîte à clés sur la grille du local vélos, bâtiment B, 4e étage avec ascenseur.',
      parking: 'Parking résidence, badge dans la boîte à clés',
    }),
    dotationLinge: dotation(1, 0, 1),
    channexPropertyId: 'chx-prop-1003',
    annonces: tousCanaux('evry-t2'),
    checklistLancement: checklist(),
  },
  {
    id: 'log-evry-cosy',
    nom: 'Cosy F2',
    adresse: '9 place de l’Agora',
    ville: 'Évry-Courcouronnes',
    codePostal: '91000',
    type: 'studio',
    surfaceM2: 28,
    capacite: 2,
    chambres: 0,
    lits: [{ type: 'double', nombre: 1 }],
    statut: 'actif',
    proprietaireId: 'pro-carpentier',
    residencePrincipale: false,
    numeroEnregistrement: '91228000412CF',
    dpe: 'C',
    serrure: 'connectee',
    fiche: fiche({
      wifiNom: 'Freebox-CosyF2',
      acces: 'Serrure connectée, code envoyé le jour de l’arrivée à 12 h. 3e étage avec ascenseur.',
      parking: 'Parking Agora payant, 2 min à pied',
    }),
    dotationLinge: dotation(1, 0, 0),
    channexPropertyId: 'chx-prop-1004',
    annonces: [
      { canal: 'airbnb', url: 'https://www.airbnb.fr/rooms/demo-cosy-f2', connecte: true },
      { canal: 'booking', url: 'https://www.booking.com/hotel/fr/demo-cosy-f2.html', connecte: true },
    ],
    checklistLancement: checklist(),
  },
  {
    id: 'log-lisses',
    nom: 'Lisses Jardin',
    adresse: '17 rue des Aulnes',
    ville: 'Lisses',
    codePostal: '91090',
    type: 'T2',
    surfaceM2: 48,
    capacite: 4,
    chambres: 1,
    lits: [{ type: 'double', nombre: 1 }, { type: 'canape', nombre: 1 }],
    statut: 'actif',
    proprietaireId: 'pro-rousseau',
    residencePrincipale: false,
    numeroEnregistrement: '91340000096LJ',
    dpe: 'C',
    serrure: 'boite_a_cles',
    fiche: fiche({
      wifiNom: 'Livebox-Aulnes',
      acces: 'Rez-de-jardin, entrée indépendante par le portillon. Boîte à clés sur le muret.',
      parking: 'Place devant le portillon',
      equipements: ['Wifi fibre', 'Cuisine équipée', 'Lave-linge', 'Jardin privatif', 'Barbecue', 'Télévision'],
    }),
    dotationLinge: dotation(1, 0, 1),
    channexPropertyId: 'chx-prop-1005',
    annonces: tousCanaux('lisses'),
    checklistLancement: checklist(),
  },
  {
    id: 'log-juvisy',
    nom: 'Juvisy Gare',
    adresse: '41 rue Hoche',
    ville: 'Juvisy-sur-Orge',
    codePostal: '91260',
    type: 'T2',
    surfaceM2: 39,
    capacite: 3,
    chambres: 1,
    lits: [{ type: 'double', nombre: 1 }, { type: 'simple', nombre: 1 }],
    statut: 'actif',
    proprietaireId: 'pro-nguyen',
    residencePrincipale: true,
    numeroEnregistrement: '91326000051JG',
    dpe: 'E',
    serrure: 'boite_a_cles',
    fiche: fiche({
      wifiNom: 'SFR-Hoche41',
      acces: 'Boîte à clés dans le hall, digicode transmis la veille. 3e étage sans ascenseur.',
      parking: 'Pas de parking, gare RER C et D à 4 min',
    }),
    dotationLinge: dotation(1, 1, 0),
    channexPropertyId: 'chx-prop-1006',
    annonces: [
      { canal: 'airbnb', url: 'https://www.airbnb.fr/rooms/demo-juvisy', connecte: true },
      { canal: 'direct', connecte: true },
    ],
    checklistLancement: checklist(),
  },
  {
    id: 'log-soisy',
    nom: 'Soisy Bords de Seine',
    adresse: '4 chemin du Halage',
    ville: 'Soisy-sur-Seine',
    codePostal: '91450',
    type: 'T3',
    surfaceM2: 71,
    capacite: 6,
    chambres: 2,
    lits: [{ type: 'double', nombre: 2 }, { type: 'canape', nombre: 1 }],
    statut: 'actif',
    proprietaireId: 'pro-sci-valdorge',
    residencePrincipale: false,
    numeroEnregistrement: '91599000033SB',
    dpe: 'B',
    serrure: 'connectee',
    fiche: fiche({
      wifiNom: 'Orange-Halage',
      acces: 'Serrure connectée au portail et à la porte. Codes générés par séjour.',
      parking: 'Deux places dans la propriété',
      equipements: ['Wifi fibre', 'Cuisine équipée', 'Lave-vaisselle', 'Lave-linge', 'Terrasse vue Seine', 'Télévision'],
    }),
    dotationLinge: dotation(2, 0, 1, 2),
    channexPropertyId: 'chx-prop-1007',
    annonces: tousCanaux('soisy'),
    checklistLancement: checklist(),
  },
  {
    id: 'log-paris14',
    nom: 'Paris 14 Alésia',
    adresse: '58 rue des Plantes',
    ville: 'Paris',
    codePostal: '75014',
    type: 'T2',
    surfaceM2: 36,
    capacite: 4,
    chambres: 1,
    lits: [{ type: 'double', nombre: 1 }, { type: 'canape', nombre: 1 }],
    statut: 'actif',
    proprietaireId: 'pro-dubreuil',
    residencePrincipale: false,
    numeroEnregistrement: '7511400078214',
    dpe: 'D',
    serrure: 'connectee',
    fiche: fiche({
      wifiNom: 'Freebox-Plantes',
      acces: 'Digicode puis serrure connectée. 5e étage avec ascenseur.',
      parking: 'Parking Alésia payant à 300 m',
      heureArrivee: '15:00',
    }),
    dotationLinge: dotation(1, 0, 1),
    channexPropertyId: 'chx-prop-1008',
    annonces: tousCanaux('paris14'),
    checklistLancement: checklist(),
  },
  {
    id: 'log-massy',
    nom: 'Massy Atlantis',
    adresse: '23 avenue du Lac',
    ville: 'Massy',
    codePostal: '91300',
    type: 'T2',
    surfaceM2: 44,
    capacite: 4,
    chambres: 1,
    lits: [{ type: 'double', nombre: 1 }, { type: 'canape', nombre: 1 }],
    statut: 'actif',
    proprietaireId: 'pro-lambert',
    residencePrincipale: false,
    numeroEnregistrement: '91377000164MA',
    dpe: 'B',
    serrure: 'connectee',
    fiche: fiche({
      wifiNom: 'Bbox-Atlantis',
      acces: 'Serrure connectée, code par séjour. Bâtiment C, 6e étage.',
      parking: 'Place en sous-sol n° 207, bip dans le logement',
    }),
    dotationLinge: dotation(1, 0, 1),
    channexPropertyId: 'chx-prop-1009',
    annonces: tousCanaux('massy'),
    checklistLancement: checklist(),
  },
  {
    id: 'log-linas',
    nom: 'Maison de Linas',
    adresse: '11 impasse des Coquelicots',
    ville: 'Linas',
    codePostal: '91310',
    type: 'maison',
    surfaceM2: 96,
    capacite: 8,
    chambres: 3,
    lits: [{ type: 'double', nombre: 2 }, { type: 'simple', nombre: 2 }, { type: 'canape', nombre: 1 }],
    statut: 'lancement',
    proprietaireId: 'pro-lambert',
    residencePrincipale: false,
    dpe: 'D',
    serrure: 'cles',
    fiche: fiche({
      wifiNom: '',
      wifiCode: '',
      acces: 'À définir : boîte à clés commandée.',
      parking: 'Garage et deux places devant la maison',
      equipements: ['Jardin', 'Cuisine équipée', 'Lave-linge'],
    }),
    dotationLinge: dotation(2, 2, 1, 2),
    annonces: [
      { canal: 'airbnb', connecte: false },
      { canal: 'booking', connecte: false },
    ],
    checklistLancement: checklist([
      'mandat_signe',
      'linge_etiquete',
      'acces_securise',
      'numero_enregistrement',
      'fiche_complete',
      'prestataire_menage',
    ]),
  },
  {
    id: 'log-ris',
    nom: 'Studio Ris Centre',
    adresse: '7 rue de la Roche',
    ville: 'Ris-Orangis',
    codePostal: '91130',
    type: 'studio',
    surfaceM2: 24,
    capacite: 2,
    chambres: 0,
    lits: [{ type: 'double', nombre: 1 }],
    statut: 'sorti',
    proprietaireId: 'pro-mansouri',
    residencePrincipale: false,
    numeroEnregistrement: '91521000088RC',
    dpe: 'E',
    serrure: 'boite_a_cles',
    fiche: fiche({ wifiNom: 'Livebox-Roche', acces: 'Boîte à clés retirée le 31 juillet.' }),
    dotationLinge: dotation(1, 0, 0),
    annonces: [{ canal: 'airbnb', connecte: false }],
    checklistLancement: checklist(),
  },
];

export const PROFILS: Record<string, ProfilLogement> = {
  'log-corbeil-t2': { prixNuit: 68, tension: 1.0, prestataireMenageId: 'pre-ouali', enLigneDepuis: '2025-04-01' },
  'log-corbeil-t3': { prixNuit: 96, tension: 1.1, prestataireMenageId: 'pre-ouali', enLigneDepuis: '2025-12-01' },
  'log-evry-t2': { prixNuit: 72, tension: 0.9, prestataireMenageId: 'pre-ouali', enLigneDepuis: '2025-06-15' },
  'log-evry-cosy': { prixNuit: 58, tension: 0.8, prestataireMenageId: 'pre-eclat', enLigneDepuis: '2026-02-01' },
  'log-lisses': { prixNuit: 74, tension: 1.1, prestataireMenageId: 'pre-ouali', enLigneDepuis: '2026-03-10' },
  'log-juvisy': { prixNuit: 64, tension: 1.7, prestataireMenageId: 'pre-eclat', enLigneDepuis: '2025-07-15' },
  'log-soisy': { prixNuit: 128, tension: 1.3, prestataireMenageId: 'pre-ouali', enLigneDepuis: '2026-04-01' },
  'log-paris14': { prixNuit: 118, tension: 0.6, prestataireMenageId: 'pre-eclat', enLigneDepuis: '2026-05-15' },
  'log-massy': { prixNuit: 82, tension: 0.9, prestataireMenageId: 'pre-eclat', enLigneDepuis: '2026-07-10' },
  'log-ris': {
    prixNuit: 55,
    tension: 1.5,
    prestataireMenageId: 'pre-perrin',
    enLigneDepuis: '2025-06-01',
    horsLigneLe: '2026-07-31',
  },
};

/* ----------------------------------------------------------------- mandats */

export const MANDATS: Mandat[] = [
  mandat('man-001', 'pro-marchand', 'log-corbeil-t2', 'LM-M-2025-001', 10, 4500, '2025-04-01', '2025-03-24'),
  mandat('man-002', 'pro-mansouri', 'log-evry-t2', 'LM-M-2025-003', 10, 4500, '2025-06-15', '2025-06-02'),
  mandat('man-003', 'pro-nguyen', 'log-juvisy', 'LM-M-2025-004', 10, 4000, '2025-07-15', '2025-07-08'),
  mandat('man-004', 'pro-sci-tilleuls', 'log-corbeil-t3', 'LM-M-2025-007', 18, 6000, '2025-12-01', '2025-11-20'),
  mandat('man-005', 'pro-carpentier', 'log-evry-cosy', 'LM-M-2026-001', 20, 3500, '2026-02-01', '2026-01-19'),
  mandat('man-006', 'pro-rousseau', 'log-lisses', 'LM-M-2026-002', 18, 4500, '2026-03-10', '2026-02-27'),
  mandat('man-007', 'pro-sci-valdorge', 'log-soisy', 'LM-M-2026-003', 20, 7000, '2026-04-01', '2026-03-18'),
  mandat('man-008', 'pro-dubreuil', 'log-paris14', 'LM-M-2026-004', 20, 5000, '2026-05-15', '2026-05-06'),
  mandat('man-009', 'pro-lambert', 'log-massy', 'LM-M-2026-005', 18, 4500, '2026-07-10', '2026-06-29'),
  {
    id: 'man-010',
    proprietaireId: 'pro-lambert',
    logementId: 'log-linas',
    reference: 'LM-M-2026-006',
    statut: 'envoye',
    commissionPct: 20,
    fraisMenageCentimes: 9000,
    dateDebut: '2026-10-15',
    periodeEssaiFin: '2027-01-15',
    preavisJours: 90,
    documentUrl: 'demo://mandats/LM-M-2026-006.pdf',
  },
  {
    ...mandat('man-011', 'pro-mansouri', 'log-ris', 'LM-M-2025-002', 10, 3500, '2025-06-01', '2025-05-26'),
    statut: 'resilie',
    dateFin: '2026-07-31',
    resilieLe: '2026-05-02',
    motifResiliation: 'Vente du bien par le propriétaire.',
  },
];

function mandat(
  id: string,
  proprietaireId: string,
  logementId: string,
  reference: string,
  commissionPct: number,
  fraisMenageCentimes: number,
  dateDebut: string,
  signeLe: string,
): Mandat {
  return {
    id,
    proprietaireId,
    logementId,
    reference,
    statut: 'signe',
    commissionPct,
    fraisMenageCentimes,
    dateDebut,
    periodeEssaiFin: decalerMois(dateDebut, 3),
    preavisJours: commissionPct <= 10 ? 60 : 90,
    signeLe,
    documentUrl: `demo://mandats/${reference}.pdf`,
  };
}

function decalerMois(date: string, mois: number): string {
  const [a, m, j] = date.split('-').map(Number);
  const total = a * 12 + (m - 1) + mois;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
}

/* ------------------------------------------------------------ prestataires */

const tarifsMenage = (studio: number, t2: number, t3: number, maison: number) =>
  (
    [
      ['studio', studio],
      ['T1', studio],
      ['T2', t2],
      ['T3', t3],
      ['T4', t3 + 1000],
      ['maison', maison],
    ] as [TypeLogement, number][]
  ).map(([typeLogement, montantCentimes]) => ({ typeLogement, montantCentimes }));

export const PRESTATAIRES: Prestataire[] = [
  {
    id: 'pre-ouali',
    nom: 'Samia Ouali',
    raisonSociale: 'SO Propreté',
    siret: '912 384 551 00017',
    type: 'menage',
    telephone: '06 45 71 20 93',
    email: 'so.proprete@exemple.fr',
    zone: ['Corbeil-Essonnes', 'Évry-Courcouronnes', 'Lisses', 'Soisy-sur-Seine'],
    statut: 'actif',
    tarifs: tarifsMenage(2800, 3500, 4500, 7000),
    documents: [
      { type: 'contrat', valideJusquau: '2027-02-28', statut: 'valide', url: 'demo://docs/ouali-contrat.pdf' },
      { type: 'rc_pro', valideJusquau: '2027-01-31', statut: 'valide', url: 'demo://docs/ouali-rcpro.pdf' },
      { type: 'urssaf', valideJusquau: '2027-01-12', statut: 'valide', url: 'demo://docs/ouali-urssaf.pdf' },
      { type: 'kbis', statut: 'valide', url: 'demo://docs/ouali-kbis.pdf' },
    ],
    noteMoyenne: 4.8,
    missionsRealisees: 0,
  },
  {
    id: 'pre-eclat',
    nom: 'Éclat Services 91',
    raisonSociale: 'Éclat Services 91 SARL',
    siret: '884 120 937 00025',
    type: 'menage',
    telephone: '01 60 78 34 12',
    email: 'planning@eclat-services91.fr',
    zone: ['Évry-Courcouronnes', 'Juvisy-sur-Orge', 'Massy', 'Paris'],
    statut: 'actif',
    tarifs: tarifsMenage(3000, 3800, 4800, 7500),
    documents: [
      { type: 'contrat', valideJusquau: '2027-05-31', statut: 'valide', url: 'demo://docs/eclat-contrat.pdf' },
      { type: 'rc_pro', valideJusquau: '2026-12-31', statut: 'valide', url: 'demo://docs/eclat-rcpro.pdf' },
      { type: 'urssaf', valideJusquau: '2026-10-09', statut: 'valide', url: 'demo://docs/eclat-urssaf.pdf' },
      { type: 'kbis', statut: 'valide', url: 'demo://docs/eclat-kbis.pdf' },
    ],
    noteMoyenne: 4.6,
    missionsRealisees: 0,
  },
  {
    id: 'pre-perrin',
    nom: 'Lucas Perrin',
    siret: '903 551 208 00011',
    type: 'menage',
    telephone: '07 69 12 58 40',
    zone: ['Ris-Orangis', 'Juvisy-sur-Orge', 'Évry-Courcouronnes'],
    statut: 'suspendu',
    tarifs: tarifsMenage(2600, 3200, 4200, 6500),
    documents: [
      { type: 'contrat', valideJusquau: '2026-12-31', statut: 'valide', url: 'demo://docs/perrin-contrat.pdf' },
      { type: 'rc_pro', valideJusquau: '2026-08-15', statut: 'expire', url: 'demo://docs/perrin-rcpro.pdf' },
      { type: 'urssaf', statut: 'manquant' },
    ],
    noteMoyenne: 3.9,
    missionsRealisees: 0,
  },
  {
    id: 'pre-blanchisserie',
    nom: 'Blanchisserie du Val',
    raisonSociale: 'Blanchisserie du Val SAS',
    siret: '529 047 316 00034',
    type: 'linge',
    telephone: '01 69 25 47 80',
    email: 'pro@blanchisserieduval.fr',
    zone: ['Essonne', 'Paris'],
    statut: 'actif',
    tarifs: tarifsMenage(1400, 1800, 2600, 3900),
    documents: [
      { type: 'contrat', valideJusquau: '2027-03-31', statut: 'valide', url: 'demo://docs/bdv-contrat.pdf' },
      { type: 'rc_pro', valideJusquau: '2027-03-31', statut: 'valide', url: 'demo://docs/bdv-rcpro.pdf' },
      { type: 'urssaf', valideJusquau: '2026-12-20', statut: 'valide', url: 'demo://docs/bdv-urssaf.pdf' },
      { type: 'kbis', statut: 'valide', url: 'demo://docs/bdv-kbis.pdf' },
    ],
    noteMoyenne: 4.7,
    missionsRealisees: 0,
  },
  {
    id: 'pre-artisan',
    nom: 'Karim Belkacem',
    raisonSociale: 'Multiservices Essonne',
    siret: '851 663 042 00019',
    type: 'maintenance',
    telephone: '06 22 94 13 57',
    email: 'multiservices.essonne@exemple.fr',
    zone: ['Essonne'],
    statut: 'actif',
    tarifs: [],
    documents: [
      { type: 'contrat', valideJusquau: '2027-06-30', statut: 'valide', url: 'demo://docs/mse-contrat.pdf' },
      { type: 'rc_pro', valideJusquau: '2026-10-15', statut: 'valide', url: 'demo://docs/mse-rcpro.pdf' },
      { type: 'urssaf', valideJusquau: '2027-02-02', statut: 'valide', url: 'demo://docs/mse-urssaf.pdf' },
      { type: 'kbis', statut: 'valide', url: 'demo://docs/mse-kbis.pdf' },
    ],
    noteMoyenne: 4.5,
    missionsRealisees: 0,
  },
  {
    id: 'pre-serrures',
    nom: 'Serrures Express 91',
    raisonSociale: 'Serrures Express 91 EURL',
    siret: '798 204 115 00022',
    type: 'serrurier',
    telephone: '01 64 88 02 19',
    zone: ['Essonne', 'Val-de-Marne'],
    statut: 'actif',
    tarifs: [],
    documents: [
      { type: 'contrat', valideJusquau: '2027-01-31', statut: 'valide', url: 'demo://docs/se91-contrat.pdf' },
      { type: 'rc_pro', valideJusquau: '2027-04-30', statut: 'valide', url: 'demo://docs/se91-rcpro.pdf' },
      { type: 'urssaf', valideJusquau: '2026-09-02', statut: 'expire', url: 'demo://docs/se91-urssaf.pdf' },
    ],
    missionsRealisees: 0,
  },
];

/* ------------------------------------------------------------- utilisateurs */

export const UTILISATEURS: Utilisateur[] = [
  { id: 'usr-abdel', nom: 'Abdel', email: 'abdel@labelmaisoncg.fr', role: 'gerant' },
  { id: 'usr-kamel', nom: 'Kamel', email: 'kamel@labelmaisoncg.fr', role: 'operations' },
  { id: 'usr-samia', nom: 'Samia Ouali', email: 'so.proprete@exemple.fr', role: 'prestataire' },
  { id: 'usr-compta', nom: 'Cabinet comptable', email: 'compta@exemple.fr', role: 'lecture' },
];

/* --------------------------------------------------------------- prospects */

const prospect = (p: Omit<Prospect, 'responsable'> & { responsable?: Prospect['responsable'] }): Prospect => ({
  responsable: 'abdel',
  ...p,
});

export const PROSPECTS: Prospect[] = [
  prospect({
    id: 'pst-01', nom: 'Martin Leroy', ville: 'Évry-Courcouronnes', source: 'seo', typeBien: 'T2 45 m²',
    revenuEstimeAnnuelCentimes: 1680000, etape: 'nouveau', prochaineAction: 'Premier appel de qualification',
    prochaineActionLe: '2026-09-25', notes: 'Formulaire du site, page conciergerie Évry.', creeLe: '2026-09-23',
  }),
  prospect({
    id: 'pst-02', nom: 'Amina Traoré', ville: 'Ris-Orangis', source: 'appel_entrant', typeBien: 'Studio 26 m²',
    revenuEstimeAnnuelCentimes: 1150000, etape: 'nouveau', prochaineAction: 'Rappeler après 18 h',
    prochaineActionLe: '2026-09-24', notes: 'A vu l’annonce du studio Ris Centre, veut le même service.', creeLe: '2026-09-22',
  }),
  prospect({
    id: 'pst-03', nom: 'Guillaume Fabre', ville: 'Draveil', source: 'parrainage', typeBien: 'Maison 110 m²',
    revenuEstimeAnnuelCentimes: 3400000, etape: 'contact', prochaineAction: 'Envoyer l’estimation de revenus',
    prochaineActionLe: '2026-09-26', notes: 'Parrainé par Bernard Rousseau. Maison avec piscine, saisonnier été.', creeLe: '2026-09-12',
  }),
  prospect({
    id: 'pst-04', nom: 'Chloé Garnier', ville: 'Massy', source: 'seo', typeBien: 'T3 62 m²',
    revenuEstimeAnnuelCentimes: 2450000, etape: 'contact', prochaineAction: 'Relance e-mail',
    prochaineActionLe: '2026-09-22', notes: 'Hésite avec une autre conciergerie, sensible au prix.', creeLe: '2026-09-05',
  }),
  prospect({
    id: 'pst-05', nom: 'Yanis Bouzid', ville: 'Corbeil-Essonnes', source: 'reseau', typeBien: 'T2 40 m²',
    revenuEstimeAnnuelCentimes: 1520000, etape: 'visite', prochaineAction: 'Visite du bien',
    prochaineActionLe: '2026-09-27', notes: 'Rencontré au salon de l’immobilier d’Évry.', creeLe: '2026-08-29',
  }),
  prospect({
    id: 'pst-06', nom: 'SCI Horizon Seine', ville: 'Athis-Mons', source: 'reseau', typeBien: '2 T2 dans le même immeuble',
    revenuEstimeAnnuelCentimes: 3300000, etape: 'visite', prochaineAction: 'Compte rendu de visite',
    prochaineActionLe: '2026-09-25', notes: 'Deux lots identiques, possible troisième en 2027.', creeLe: '2026-08-21',
    responsable: 'kamel',
  }),
  prospect({
    id: 'pst-07', nom: 'Élodie Masson', ville: 'Paris 13e', source: 'cercle', typeBien: 'T2 38 m²',
    revenuEstimeAnnuelCentimes: 2900000, etape: 'proposition', prochaineAction: 'Relance proposition à 20 %',
    prochaineActionLe: '2026-09-29', notes: 'Membre du Cercle Label Maison. Proposition envoyée le 18/09.', creeLe: '2026-08-10',
  }),
  prospect({
    id: 'pst-08', nom: 'Patrick Duval', ville: 'Savigny-sur-Orge', source: 'seo', typeBien: 'T3 58 m²',
    revenuEstimeAnnuelCentimes: 2100000, etape: 'proposition', prochaineAction: 'Appel de suivi',
    prochaineActionLe: '2026-09-30', notes: 'Veut garder la main sur les prix l’hiver.', creeLe: '2026-08-02',
  }),
  prospect({
    id: 'pst-09', nom: 'Inès Carvalho', ville: 'Évry-Courcouronnes', source: 'parrainage', typeBien: 'Studio 24 m²',
    revenuEstimeAnnuelCentimes: 1200000, etape: 'negociation', prochaineAction: 'Arbitrer commission 18 ou 20 %',
    prochaineActionLe: '2026-09-25', notes: 'Parrainée par Julie Carpentier. Demande 16 %, on tient 18 %.', creeLe: '2026-07-24',
  }),
  prospect({
    id: 'pst-10', nom: 'Laurent Picard', ville: 'Brétigny-sur-Orge', source: 'appel_entrant', typeBien: 'Maison 90 m²',
    revenuEstimeAnnuelCentimes: 2800000, etape: 'negociation', prochaineAction: 'Envoyer le mandat pour signature',
    prochaineActionLe: '2026-09-28', notes: 'D’accord sur 18 %, attend le détail des frais de ménage.', creeLe: '2026-07-15',
  }),
  prospect({
    id: 'pst-11', nom: 'Sophie Lambert-Roche', ville: 'Linas', source: 'parrainage', typeBien: 'Maison 96 m²',
    revenuEstimeAnnuelCentimes: 3600000, etape: 'signe', notes: 'Deuxième bien de la propriétaire. Mandat envoyé, lancement en cours.',
    creeLe: '2026-08-04',
  }),
  prospect({
    id: 'pst-12', nom: 'Claire Dubreuil', ville: 'Paris 14e', source: 'seo', typeBien: 'T2 36 m²',
    revenuEstimeAnnuelCentimes: 3100000, etape: 'signe', notes: 'Signé en mai.', creeLe: '2026-04-02',
  }),
  prospect({
    id: 'pst-13', nom: 'Vincent Roussel', ville: 'Grigny', source: 'seo', typeBien: 'T3 65 m²',
    revenuEstimeAnnuelCentimes: 1600000, etape: 'perdu', notes: 'Copropriété interdit la location courte durée.', creeLe: '2026-06-18',
  }),
  prospect({
    id: 'pst-14', nom: 'Nathalie Brun', ville: 'Viry-Châtillon', source: 'autre', typeBien: 'T2 42 m²',
    revenuEstimeAnnuelCentimes: 1400000, etape: 'perdu', notes: 'A choisi la location meublée à l’année.', creeLe: '2026-07-02',
    responsable: 'kamel',
  }),
];
