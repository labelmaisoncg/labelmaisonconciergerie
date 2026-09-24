/**
 * Jeu de démo : messagerie, incidents, interventions hors ménage, charges et
 * journal. Écrit à la main mais rattaché aux réservations générées, pour que
 * chaque fil ou incident pointe vers un séjour réel de la maquette.
 */
import { checklistMenageVierge } from './constantes';
import { AUJOURDHUI, ajouterJours, ecartJours, jourMois } from './format';
import type { EcartSeed } from './seed';
import type { Charge, FilMessages, Incident, Journal, Mission, Reservation } from './types';

type Critere = (r: Reservation) => boolean;

function trouveur(reservations: Reservation[]) {
  const pris = new Set<string>();
  return (critere: Critere): Reservation => {
    const r =
      reservations.find((x) => !pris.has(x.id) && x.statut !== 'annulee' && critere(x)) ??
      reservations.find((x) => !pris.has(x.id) && x.statut !== 'annulee')!;
    pris.add(r.id);
    return r;
  };
}

const le = (decalageJours: number, heure: string) => `${ajouterJours(AUJOURDHUI, decalageJours)}T${heure}:00+02:00`;

/* ----------------------------------------------------------- messagerie */

interface Gabarit {
  critere: Critere;
  statut: FilMessages['statut'];
  traitePar: FilMessages['traitePar'];
  echanges: [FilMessages['messages'][number]['auteur'], string, number, string][];
}

const enCours: Critere = (r) => r.statut === 'en_cours';
const arriveDans = (min: number, max: number): Critere => (r) => {
  const d = ecartJours(AUJOURDHUI, r.arrivee);
  return r.statut === 'confirmee' && d >= min && d <= max;
};
const partiIlYa = (min: number, max: number): Critere => (r) => {
  const d = ecartJours(r.depart, AUJOURDHUI);
  return r.statut === 'terminee' && d >= min && d <= max;
};

const GABARITS: Gabarit[] = [
  {
    critere: arriveDans(0, 1),
    statut: 'clos',
    traitePar: 'agent',
    echanges: [
      ['voyageur', 'Bonjour, à quelle heure recevrons-nous le code pour entrer ?', -1, '18:42'],
      ['agent', 'Bonjour ! Le code d’accès vous sera envoyé le jour de votre arrivée à 12 h, pour une arrivée possible dès 16 h. Bon voyage !', -1, '18:43'],
      ['voyageur', 'Parfait, merci beaucoup.', -1, '18:50'],
    ],
  },
  {
    critere: enCours,
    statut: 'ouvert',
    traitePar: 'agent',
    echanges: [
      ['voyageur', 'Le wifi ne fonctionne plus depuis ce matin.', 0, '08:12'],
      ['agent', 'Désolé pour la gêne. Pouvez-vous débrancher la box 30 secondes puis la rebrancher ? Elle se trouve sous la télévision.', 0, '08:13'],
      ['voyageur', 'C’est reparti, merci !', 0, '08:31'],
    ],
  },
  {
    critere: partiIlYa(0, 2),
    statut: 'escalade',
    traitePar: 'en_attente',
    echanges: [
      ['voyageur', 'Nous avons trouvé la salle de bain sale à notre arrivée. Nous souhaitons un remboursement partiel.', 0, '09:05'],
      ['agent', 'Je suis sincèrement désolé. Je transmets votre demande à l’équipe, qui reviendra vers vous aujourd’hui. Je ne peux pas traiter moi-même un remboursement.', 0, '09:06'],
    ],
  },
  {
    critere: arriveDans(1, 3),
    statut: 'escalade',
    traitePar: 'en_attente',
    echanges: [
      ['voyageur', 'Est-il possible d’arriver vers 13 h ? Notre train arrive tôt.', 0, '07:48'],
      ['agent', 'Je vérifie avec l’équipe ménage si le logement peut être prêt plus tôt et je reviens vers vous.', 0, '07:49'],
    ],
  },
  {
    critere: arriveDans(2, 6),
    statut: 'clos',
    traitePar: 'agent',
    echanges: [
      ['voyageur', 'Y a-t-il un parking à proximité ?', -2, '20:10'],
      ['agent', 'Oui, le détail du stationnement est dans le guide du logement : place indiquée dans votre message d’arrivée. Bonne soirée !', -2, '20:11'],
    ],
  },
  {
    critere: enCours,
    statut: 'clos',
    traitePar: 'humain',
    echanges: [
      ['voyageur', 'Pourrions-nous partir à 14 h dimanche ? Nous pouvons payer un supplément.', -1, '11:20'],
      ['agent', 'Je transmets à l’équipe : un départ tardif payant doit être validé par un membre de l’équipe.', -1, '11:21'],
      ['hote', 'Bonjour, c’est possible jusqu’à 13 h pour 20 €, je vous envoie la demande de paiement. Abdel', -1, '12:02'],
      ['voyageur', 'Merci, c’est réglé.', -1, '12:15'],
    ],
  },
  {
    critere: partiIlYa(3, 12),
    statut: 'ouvert',
    traitePar: 'en_attente',
    echanges: [
      ['voyageur', 'Bonjour, nous aimerions revenir du 14 au 18 novembre en direct, est-ce possible ?', 0, '10:02'],
    ],
  },
  {
    critere: partiIlYa(1, 6),
    statut: 'ouvert',
    traitePar: 'humain',
    echanges: [
      ['voyageur', 'J’ai oublié un chargeur d’ordinateur dans la chambre.', -1, '16:30'],
      ['agent', 'Je préviens l’équipe pour vérifier lors du prochain passage.', -1, '16:31'],
      ['hote', 'Chargeur retrouvé par la prestataire. Envoi possible en Lettre suivie, je vous communique le coût. Kamel', 0, '09:40'],
    ],
  },
  {
    critere: partiIlYa(2, 10),
    statut: 'clos',
    traitePar: 'agent',
    echanges: [
      ['voyageur', 'Merci pour ce séjour, tout était parfait.', -3, '12:04'],
      ['agent', 'Merci à vous ! Au plaisir de vous accueillir à nouveau.', -3, '12:05'],
    ],
  },
  {
    critere: enCours,
    statut: 'escalade',
    traitePar: 'humain',
    echanges: [
      ['voyageur', 'Un voisin est venu se plaindre du bruit alors que nous étions calmes à 21 h.', -1, '21:48'],
      ['agent', 'Merci de nous prévenir. Je transmets à l’équipe, qui vous rappelle demain matin.', -1, '21:49'],
      ['hote', 'Bonjour, nous avons échangé avec le voisin, tout est rentré dans l’ordre. Bon séjour. Abdel', 0, '09:15'],
    ],
  },
];

function genererFils(trouver: (c: Critere) => Reservation): FilMessages[] {
  return GABARITS.map((g, i) => {
    const r = trouver(g.critere);
    const messages = g.echanges.map(([auteur, texte, jour, heure], j) => ({
      id: `msg-${i + 1}-${j + 1}`,
      auteur,
      texte,
      envoyeLe: le(jour, heure),
    }));
    return {
      id: `fil-${String(i + 1).padStart(2, '0')}`,
      reservationId: r.id,
      logementId: r.logementId,
      canal: r.canal,
      voyageur: r.voyageur.nom,
      statut: g.statut,
      messages,
      dernierMessageLe: messages[messages.length - 1].envoyeLe,
      traitePar: g.traitePar,
    };
  });
}

/* ---------------------------------------------------------------- incidents */

function genererIncidents(fils: FilMessages[], missions: Mission[], ecart?: EcartSeed): Incident[] {
  const filRemboursement = fils[2];
  const refusee = missions.find((m) => m.statut === 'refusee');
  const incidents: Incident[] = [
    {
      id: 'inc-01', logementId: filRemboursement.logementId, reservationId: filRemboursement.reservationId,
      date: AUJOURDHUI, categorie: 'menage', gravite: 'haute',
      description: 'Voyageur signale une salle de bain sale à l’arrivée, demande de remboursement partiel. Contrôle qualité déclenché.',
      statut: 'ouvert', responsable: 'Abdel', refacturable: 'prestataire', preuves: ['demo://incidents/inc-01-1.jpg'],
    },
    {
      id: 'inc-03', logementId: 'log-soisy', date: '2026-09-22', categorie: 'panne', gravite: 'moyenne',
      description: 'Chauffe-eau en sécurité, eau tiède seulement. Intervention de Multiservices Essonne prévue demain.',
      statut: 'en_cours', responsable: 'Kamel', coutCentimes: 18000, refacturable: 'proprietaire', preuves: ['demo://incidents/inc-03-1.jpg'],
    },
    ...(refusee
      ? [{
          id: 'inc-04', logementId: refusee.logementId, reservationId: refusee.reservationId, date: refusee.date,
          categorie: 'menage' as const, gravite: 'moyenne' as const,
          description: 'Ménage bâclé (salle de bain non faite). Mission refusée et non payée, repassage par Éclat Services.',
          statut: 'resolu' as const, responsable: 'Kamel', coutCentimes: 3800, refacturable: 'prestataire' as const,
          preuves: ['demo://incidents/inc-04-1.jpg'], resoluLe: ajouterJours(refusee.date, 1),
        }]
      : []),
    {
      id: 'inc-05', logementId: 'log-corbeil-t3', date: '2026-09-10', categorie: 'casse', gravite: 'faible',
      description: 'Deux verres et un plat cassés, déclarés par le voyageur.',
      statut: 'resolu', responsable: 'Abdel', coutCentimes: 2600, refacturable: 'voyageur', preuves: [], resoluLe: '2026-09-12',
    },
    {
      id: 'inc-06', logementId: 'log-paris14', date: '2026-09-23', categorie: 'acces', gravite: 'haute',
      description: 'Serrure connectée hors ligne (piles faibles), voyageur bloqué 25 min. Piles changées, à surveiller.',
      statut: 'ouvert', responsable: 'Kamel', refacturable: 'aucun', preuves: [],
    },
    {
      id: 'inc-07', logementId: 'log-evry-t2', date: '2026-09-02', categorie: 'panne', gravite: 'moyenne',
      description: 'Lave-linge en panne (pompe de vidange). Remplacé par le propriétaire.',
      statut: 'resolu', responsable: 'Kamel', coutCentimes: 34900, refacturable: 'proprietaire', preuves: [], resoluLe: '2026-09-05',
    },
    {
      id: 'inc-08', logementId: 'log-lisses', date: '2026-09-19', categorie: 'voyageur', gravite: 'moyenne',
      description: 'Voyageurs à 6 au lieu de 4 déclarés. Message envoyé via la plateforme, demande de supplément en cours.',
      statut: 'en_cours', responsable: 'Abdel', coutCentimes: 5000, refacturable: 'voyageur', preuves: [],
    },
    {
      id: 'inc-09', logementId: 'log-juvisy', date: '2026-07-28', categorie: 'acces', gravite: 'faible',
      description: 'Boîte à clés grippée. Cylindre remplacé par Serrures Express 91.',
      statut: 'resolu', responsable: 'Kamel', coutCentimes: 14500, refacturable: 'proprietaire', preuves: [], resoluLe: '2026-07-29',
    },
  ];
  if (ecart) {
    incidents.splice(1, 0, {
      id: 'inc-02', logementId: ecart.logementId, date: ecart.date, categorie: 'linge', gravite: 'faible',
      description: `Écart d’inventaire : 1 ${ecart.article.toLowerCase()} manquant au retour de blanchisserie du ${jourMois(ecart.date)}. Réclamation envoyée à la Blanchisserie du Val.`,
      statut: 'en_cours', responsable: 'Kamel', coutCentimes: 2400, refacturable: 'prestataire', preuves: [],
    });
  }
  return incidents;
}

/* ------------------------------------------------ interventions hors ménage */

function genererInterventions(missions: Mission[]): Mission[] {
  const base = { checklist: [], photos: [], controleQualite: false };
  const aControler = missions.filter((m) => m.controleQualite && m.statut === 'validee').slice(-2);
  return [
    {
      ...base, id: 'mis-mnt-01', type: 'maintenance', logementId: 'log-soisy', prestataireId: 'pre-artisan',
      date: ajouterJours(AUJOURDHUI, 1), heureDebut: '09:00', heureFinMax: '12:00', statut: 'attribuee', tarifCentimes: 18000,
      commentaire: 'Chauffe-eau en sécurité (incident inc-03).',
    },
    {
      ...base, id: 'mis-mnt-02', type: 'maintenance', logementId: 'log-paris14',
      date: ajouterJours(AUJOURDHUI, 2), heureDebut: '11:00', heureFinMax: '15:00', statut: 'a_attribuer', tarifCentimes: 6000,
      commentaire: 'Contrôle de la serrure connectée et remplacement des piles (incident inc-06).',
    },
    {
      ...base, id: 'mis-lin-01', type: 'linge', logementId: 'log-linas', prestataireId: 'pre-blanchisserie',
      date: '2026-10-08', heureDebut: '10:00', heureFinMax: '12:00', statut: 'attribuee', tarifCentimes: 3900,
      commentaire: 'Livraison de la dotation étiquetée pour le lancement.',
    },
    ...aControler.map((m, i): Mission => ({
      ...base,
      id: `mis-ctl-0${i + 1}`,
      type: 'controle',
      logementId: m.logementId,
      reservationId: m.reservationId,
      date: ajouterJours(m.date, 1),
      heureDebut: '10:00',
      heureFinMax: '11:00',
      statut: 'validee',
      checklist: checklistMenageVierge().map((c) => ({ ...c, fait: true })),
      tarifCentimes: 0,
      controleQualite: true,
      noteControle: m.noteControle,
      commentaire: 'Contrôle physique réalisé par Kamel.',
    })),
  ];
}

/* ----------------------------------------------------------------- charges */

function genererCharges(): Charge[] {
  const charges: Charge[] = [];
  let n = 0;
  const ajouter = (c: Omit<Charge, 'id'>) => charges.push({ id: `chg-${String(++n).padStart(3, '0')}`, ...c });
  for (const mois of ['2026-06', '2026-07', '2026-08', '2026-09']) {
    ajouter({ date: `${mois}-01`, libelle: 'Channex, abonnement channel manager', categorie: 'logiciel', montantCentimes: 6900 });
    ajouter({ date: `${mois}-01`, libelle: 'Supabase, offre Pro', categorie: 'logiciel', montantCentimes: 2300 });
    ajouter({ date: `${mois}-03`, libelle: 'Assurance RC Pro Label Maison (mensualité)', categorie: 'assurance', montantCentimes: 4200 });
    ajouter({ date: `${mois}-12`, libelle: 'Produits d’entretien et consommables', categorie: 'produits', montantCentimes: 16800 + n * 37 });
    ajouter({ date: `${mois}-20`, libelle: 'Carburant tournées Essonne', categorie: 'transport', montantCentimes: 9400 + n * 21 });
  }
  ajouter({ date: '2026-07-29', libelle: 'Remplacement cylindre boîte à clés Juvisy', categorie: 'serrurerie', montantCentimes: 14500, logementId: 'log-juvisy' });
  ajouter({ date: '2026-09-09', libelle: 'Boîte à clés sécurisée Maison de Linas', categorie: 'serrurerie', montantCentimes: 8900, logementId: 'log-linas' });
  ajouter({ date: '2026-09-15', libelle: 'Dotation linge Maison de Linas (3 jeux)', categorie: 'linge', montantCentimes: 61200, logementId: 'log-linas' });
  ajouter({ date: '2026-08-18', libelle: 'Réassort serviettes de bain (lot de 20)', categorie: 'linge', montantCentimes: 17800 });
  return charges.sort((a, b) => a.date.localeCompare(b.date));
}

/* ------------------------------------------------------------------ journal */

function genererJournal(): Journal[] {
  const entrees: [number, string, string, string, string, string, string][] = [
    [-6, '09:12', 'Kamel', 'Document ajouté', 'prestataire', 'pre-ouali', 'Attestation URSSAF valable jusqu’au 12 janv. 2027.'],
    [-5, '14:30', 'Abdel', 'Mandat envoyé', 'mandat', 'man-010', 'Mandat LM-M-2026-006 envoyé pour signature électronique.'],
    [-4, '10:05', 'Kamel', 'Checklist cochée', 'logement', 'log-linas', 'Inventaire contradictoire signé.'],
    [-4, '16:48', 'Abdel', 'Prospect avancé', 'prospect', 'pst-07', 'Étape : proposition.'],
    [-3, '08:55', 'Kamel', 'Mission validée', 'mission', 'mis-0001', 'Checklist complète, 5 photos.'],
    [-2, '11:20', 'Kamel', 'Incident créé', 'incident', 'inc-03', 'Chauffe-eau en sécurité à Soisy.'],
    [-2, '15:02', 'Abdel', 'Facture relancée', 'facture', 'fac-50', 'Relance par e-mail à la SCI Les Tilleuls.'],
    [-1, '09:30', 'Kamel', 'Incident créé', 'incident', 'inc-06', 'Serrure connectée hors ligne à Paris 14.'],
    [-1, '17:45', 'Abdel', 'Prospect créé', 'prospect', 'pst-01', 'Formulaire site, T2 à Évry.'],
    [0, '08:05', 'Système', 'Missions générées', 'mission', '-', 'Missions de ménage créées pour les départs de la semaine.'],
    [0, '09:06', 'Agent IA', 'Fil escaladé', 'fil', 'fil-03', 'Demande de remboursement transmise à l’équipe.'],
  ];
  return entrees
    .map(([jour, heure, auteur, action, entite, entiteId, details], i) => ({
      id: `jrn-${String(i + 1).padStart(3, '0')}`,
      horodatage: le(jour, heure),
      auteur,
      action,
      entite,
      entiteId,
      details,
    }))
    .reverse();
}

/* ------------------------------------------------------------- assemblage */

export function genererOperations(reservations: Reservation[], missions: Mission[], ecart?: EcartSeed) {
  const filsMessages = genererFils(trouveur(reservations));
  return {
    filsMessages,
    incidents: genererIncidents(filsMessages, missions, ecart),
    missions: genererInterventions(missions),
    charges: genererCharges(),
    journal: genererJournal(),
  };
}
