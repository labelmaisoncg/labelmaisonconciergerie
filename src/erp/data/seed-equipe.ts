/**
 * Jeu de démo de l'espace opérations : une équipe de terrain fictive (noms,
 * adresses en exemple.fr et numéros réservés à la fiction), ses accès, qui
 * suit chaque logement, une absence avec son remplaçant, deux contrôles
 * qualité (dont un en retard), deux incidents de plus (dont un urgent) et
 * un « ce logement n'est pas à moi ». Rattaché aux réservations générées
 * pour que les contrôles suivent de vrais départs.
 */
import { AUJOURDHUI, ajouterJours } from './format';
import type { Incident, Reservation } from './types';
import type { AbsenceMembre, AccesOperations, AffectationLogement, ControleQualite, MembreEquipe, SignalementLogement } from './types-operations';

const le = (decalageJours: number, heure: string) => `${ajouterJours(AUJOURDHUI, decalageJours)}T${heure}:00+02:00`;

const INES = 'eq-ines';
const YANIS = 'eq-yanis';
const CLARA = 'eq-clara';

const CORBEIL_EVRY = ['log-corbeil-t2', 'log-corbeil-t3', 'log-evry-t2', 'log-evry-cosy'];

/** Numéros 06 39 98 xx xx : plage réservée par l'Arcep aux œuvres de fiction. */
export const EQUIPE_DEMO: MembreEquipe[] = [
  {
    id: INES,
    nom: 'Inès Morel',
    role: 'pole',
    email: 'ines.morel@exemple.fr',
    telephone: '06 39 98 10 21',
    logementIds: [...CORBEIL_EVRY, 'log-lisses', 'log-juvisy', 'log-soisy', 'log-paris14', 'log-massy'],
    actif: true,
  },
  { id: YANIS, nom: 'Yanis Lefort', role: 'agent', email: 'yanis.lefort@exemple.fr', telephone: '06 39 98 12 40', logementIds: ['log-paris14', 'log-massy', 'log-soisy', 'log-linas'], actif: true },
  { id: CLARA, nom: 'Clara Dumas', role: 'agent', email: 'clara.dumas@exemple.fr', telephone: '06 39 98 27 15', logementIds: [...CORBEIL_EVRY, 'log-lisses', 'log-juvisy'], actif: true },
];

const AFFECTATIONS: AffectationLogement[] = [
  ...CORBEIL_EVRY.map((id) => ({ id, responsableId: CLARA, remplacantId: INES })),
  { id: 'log-lisses', responsableId: CLARA, remplacantId: INES },
  { id: 'log-juvisy', responsableId: CLARA, remplacantId: INES },
  // Logement avec beaucoup d'électroménager : un point de plus au contrôle.
  { id: 'log-paris14', responsableId: YANIS, remplacantId: INES, pointsControle: ['Propreté', 'Linge', 'Consommables', 'Équipements', 'Serrure connectée', 'État général'] },
  { id: 'log-massy', responsableId: YANIS, remplacantId: INES },
  { id: 'log-soisy', responsableId: YANIS, remplacantId: INES },
  { id: 'log-linas', responsableId: YANIS },
];

/** Qui s'occupe des incidents déjà dans la démo. */
const ASSIGNATIONS: Record<string, string> = { 'inc-01': YANIS, 'inc-02': CLARA, 'inc-03': YANIS, 'inc-06': YANIS, 'inc-08': CLARA };

const acces = (membreId: string, email: string, statut: AccesOperations['statut'], invite: number, connexion?: number): AccesOperations => ({
  id: membreId,
  membreId,
  email,
  statut,
  inviteLe: le(invite, '09:30'),
  invitePar: 'abdel@labelmaisoncg.fr',
  ...(connexion !== undefined ? { derniereConnexion: le(connexion, '08:12') } : {}),
  version: 1,
  liens: [],
});

export function genererEquipeOps(reservations: Reservation[], incidents: Incident[]) {
  const actives = reservations.filter((r) => r.statut !== 'annulee');
  const departDe = (logementId: string, decalage: number) =>
    actives.find((r) => r.logementId === logementId && r.depart === ajouterJours(AUJOURDHUI, decalage));

  // Contrôle fait il y a deux jours (un point à revoir, devenu incident) et contrôle en retard.
  const fait = departDe('log-paris14', -2);
  const enRetard = departDe('log-corbeil-t2', -2);
  const controles: ControleQualite[] = [
    {
      id: 'ctl-01',
      logementId: 'log-paris14',
      ...(fait ? { reservationId: fait.id } : {}),
      echeance: ajouterJours(AUJOURDHUI, -2),
      statut: 'fait',
      points: [
        { id: 'p1', libelle: 'Propreté', etat: 'ok' },
        { id: 'p2', libelle: 'Linge', etat: 'ok' },
        { id: 'p3', libelle: 'Consommables', etat: 'ok', commentaire: 'Café et papier toilette complétés.' },
        { id: 'p4', libelle: 'Équipements', etat: 'a_revoir', photo: 'demo://controles/ctl-01-p4.jpg', commentaire: 'Ampoule grillée au-dessus du lit.', incidentId: 'inc-13' },
        { id: 'p5', libelle: 'Serrure connectée', etat: 'ok' },
        { id: 'p6', libelle: 'État général', etat: 'ok' },
      ],
      note: 4,
      commentaire: 'Logement prêt pour l’arrivée de 16 h.',
      parId: YANIS,
      realiseLe: le(-2, '13:40'),
    },
    {
      id: 'ctl-02',
      logementId: 'log-corbeil-t2',
      ...(enRetard ? { reservationId: enRetard.id } : {}),
      echeance: ajouterJours(AUJOURDHUI, -2),
      statut: 'a_faire',
      points: ['Propreté', 'Linge', 'Consommables', 'Équipements', 'État général'].map((libelle, k) => ({ id: `p${k + 1}`, libelle })),
    },
  ];

  const nouveaux: Incident[] = [
    {
      id: 'inc-12', logementId: 'log-massy', date: AUJOURDHUI, categorie: 'panne', gravite: 'haute',
      description: 'Fuite d’eau sous l’évier de la cuisine, signalée par la voisine du dessous. Arrivée de voyageurs ce soir.',
      statut: 'ouvert', assigneA: YANIS, signalePar: INES, responsable: 'Yanis Lefort', refacturable: 'proprietaire', preuves: ['demo://incidents/inc-12-1.jpg'],
      historique: [
        { le: le(0, '08:05'), par: 'Inès Morel', texte: 'Signalé depuis l’espace opérations.' },
        { le: le(0, '08:05'), par: 'Inès Morel', texte: 'Confié à Yanis L.' },
      ],
    },
    {
      id: 'inc-13', logementId: 'log-paris14', ...(fait ? { reservationId: fait.id } : {}), date: ajouterJours(AUJOURDHUI, -2), categorie: 'panne', gravite: 'moyenne',
      description: 'Contrôle qualité : équipements à revoir. Ampoule grillée au-dessus du lit.',
      statut: 'ouvert', assigneA: YANIS, signalePar: YANIS, responsable: 'Yanis Lefort', refacturable: 'aucun', preuves: ['demo://controles/ctl-01-p4.jpg'], controleId: 'ctl-01',
      historique: [{ le: le(-2, '13:42'), par: 'Yanis Lefort', texte: 'Créé depuis le contrôle qualité.' }],
    },
  ];

  const completes = incidents.map((i): Incident => (ASSIGNATIONS[i.id] ? { ...i, assigneA: ASSIGNATIONS[i.id] } : i));

  const absences: AbsenceMembre[] = [
    { id: 'abs-01', membreId: CLARA, du: ajouterJours(AUJOURDHUI, -1), au: ajouterJours(AUJOURDHUI, 3), remplacantId: INES, motif: 'Congés', creeLe: le(-4, '10:00'), par: 'Inès Morel' },
  ];

  const signalementsLogement: SignalementLogement[] = [
    { id: 'sig-01', logementId: 'log-linas', membreId: YANIS, le: le(-1, '18:20'), motif: 'Je ne m’occupe plus de Linas depuis la rentrée.', statut: 'ouvert' },
  ];

  return {
    equipe: structuredClone(EQUIPE_DEMO),
    accesOperations: [acces(INES, 'ines.morel@exemple.fr', 'actif', -20, 0), acces(YANIS, 'yanis.lefort@exemple.fr', 'invite', -1)],
    affectations: structuredClone(AFFECTATIONS),
    absences,
    controles,
    signalementsLogement,
    incidents: [...nouveaux, ...completes],
  };
}
