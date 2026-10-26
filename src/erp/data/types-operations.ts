/**
 * Espace opérations (/espace-operations, octobre 2026) : l'espace des
 * responsables de pôle et des agents de terrain, hors du channel manager.
 * Six collections de erp.enregistrements, sans SQL.
 *
 * Le gérant choisit dans l'ERP (Paramètres → Accès) qui voit quels
 * logements ; la personne ne lit jamais la base : api/espace-operations.ts
 * filtre par logement et ne renvoie que les champs de VueOperations.
 */
import type { AccesExterne } from './acces-externe';
import type { CanalReservation, CategorieIncident, DateISO, Horodatage, Id, StatutIncident } from './types';

/* ----------------------------------------------------------------- équipe */

/** « Responsable de pôle » : tous ses logements ; « Agent de terrain » : ce qu'on lui confie. */
export type RoleOperations = 'pole' | 'agent';

/**
 * Personne de terrain (écrite par le gérant, dans l'ERP). Les entreprises
 * extérieures (ménage, blanchisserie, artisans) restent des prestataires.
 */
export interface MembreEquipe {
  id: Id;
  nom: string;
  role: RoleOperations;
  email?: string;
  telephone?: string;
  /** Logements confiés par le gérant : la personne ne voit jamais rien d'autre. */
  logementIds: Id[];
  /** Faux : ne fait plus partie de l'équipe (gardé pour l'historique). */
  actif: boolean;
}

/**
 * Accès d'une personne à l'espace opérations (id = membreId), écrit par le
 * serveur uniquement, rangé dans l'espace (Label Maison, Sens…) qui a invité.
 * Liens et sessions : communs avec l'espace propriétaire (acces-externe.ts).
 */
export interface AccesOperations extends AccesExterne {
  membreId: Id;
  inviteLe: Horodatage;
  invitePar: string;
  retireLe?: Horodatage;
}

/** Qui suit un logement au quotidien, et qui le reprend pendant une absence. L'id est celui du logement. */
export interface AffectationLogement {
  id: Id;
  responsableId?: Id;
  remplacantId?: Id;
  /** Points du contrôle qualité propres à ce logement (vide : le modèle par défaut). */
  pointsControle?: string[];
}

/** Absence d'un membre : ses logements et ses incidents passent à leur remplaçant pendant la période. */
export interface AbsenceMembre {
  id: Id;
  membreId: Id;
  du: DateISO;
  au: DateISO;
  /** Remplaçant des logements qui n'en ont pas (ou dont le remplaçant est absent lui aussi). */
  remplacantId?: Id;
  motif?: string;
  creeLe?: Horodatage;
  par?: string;
  /** Annulée : gardée pour l'historique, sans effet. */
  annuleeLe?: Horodatage;
}

/* ------------------------------------------------------ contrôles qualité */

export type EtatPointControle = 'ok' | 'a_revoir';

export interface PointControle {
  id: string;
  libelle: string;
  etat?: EtatPointControle;
  photo?: string;
  commentaire?: string;
  /** Incident créé pour ce point. */
  incidentId?: Id;
}

export type StatutControle = 'a_faire' | 'fait';

/** Contrôle qualité d'un logement, rempli sur place au téléphone. */
export interface ControleQualite {
  id: Id;
  logementId: Id;
  /** Séjour qui vient de partir (contrôle après un départ). */
  reservationId?: Id;
  /** À faire au plus tard ce jour-là. */
  echeance: DateISO;
  statut: StatutControle;
  points: PointControle[];
  /** Note d'ensemble sur 5. */
  note?: number;
  commentaire?: string;
  /** Membre de l'équipe qui l'a fait. */
  parId?: Id;
  realiseLe?: Horodatage;
}

/* ------------------------------------------- « ce logement n'est pas à moi » */

/**
 * Signalement au gérant : la personne ne gère pas (ou plus) ce logement. Le
 * logement reste dans son espace jusqu'à ce que le gérant le lui retire ou
 * confirme qu'il est bien à elle.
 */
export interface SignalementLogement {
  id: Id;
  logementId: Id;
  membreId: Id;
  le: Horodatage;
  motif?: string;
  statut: 'ouvert' | 'traite';
  /** retire : le logement n'est plus dans son espace ; confirme : il y reste. */
  decision?: 'retire' | 'confirme';
  traiteLe?: Horodatage;
  traitePar?: string;
}

/* ------------------------------------------------- vue d'une personne */

export interface LogementOps {
  id: Id;
  nom: string;
  ville: string;
  photo?: string;
  /** Qui le suit aujourd'hui (le remplaçant pendant une absence). */
  suiviPar?: string;
  /** « Ce logement n'est pas à moi » envoyé, en attente du gérant. */
  signale?: boolean;
  /** Consignes d'accès : seulement le jour où la personne y a quelque chose à faire. */
  acces?: string;
}

/** Séjour vu de l'espace : « Prénom N. », nombre de voyageurs, dates. */
export interface SejourOps {
  id: Id;
  logementId: Id;
  arrivee: DateISO;
  depart: DateISO;
  voyageur: string;
  nbPersonnes: number;
  canal: CanalReservation;
  heureArrivee?: string;
  heureDepart?: string;
}

export interface IncidentOps {
  id: Id;
  logementId: Id;
  reservationId?: Id;
  date: DateISO;
  categorie: CategorieIncident;
  urgent: boolean;
  description: string;
  statut: StatutIncident;
  /** Titulaire (membre) et qui s'en occupe aujourd'hui. */
  assigneA?: Id;
  suiviPar?: Id;
  /** Le titulaire est absent : son remplaçant s'en occupe. */
  remplace?: Id;
  photos: string[];
  historique: { le: Horodatage; par: string; texte: string }[];
  resoluLe?: DateISO;
  controleId?: Id;
}

export interface ControleOps {
  /** Id du contrôle enregistré, ou `depart-<réservation>` pour un contrôle proposé. */
  cle: string;
  controle?: ControleQualite;
  logementId: Id;
  reservationId?: Id;
  echeance: DateISO;
  enRetard: boolean;
  /** Points à remplir (ceux du logement). */
  points: string[];
}

export interface MembreOps {
  id: Id;
  nom: string;
  role: RoleOperations;
  telephone?: string;
  /** Logements en commun avec la personne connectée. */
  logementIds: Id[];
  /** Absence en cours ou prochaine. */
  absence?: { du: DateISO; au: DateISO };
}

export interface ElementProgrammeOps {
  cle: string;
  type: 'depart' | 'controle' | 'intervention' | 'arrivee';
  heure?: string;
  logementId: Id;
  reservationId?: Id;
  controleCle?: string;
}

/** Tout ce que voit une personne de l'équipe, et rien d'autre. */
export interface VueOperations {
  moi: { id: Id; nom: string; role: RoleOperations };
  /** Conciergerie de l'espace qui a invité (nom affiché en tête de l'espace). */
  conciergerie?: { nom: string };
  aujourdhui: DateISO;
  logements: LogementOps[];
  sejours: SejourOps[];
  incidents: IncidentOps[];
  controles: ControleOps[];
  historiqueControles: ControleQualite[];
  programme: ElementProgrammeOps[];
  /** Responsable de pôle : les personnes de ses logements, leurs absences, qui suit quoi. */
  equipe: MembreOps[];
  absences: AbsenceMembre[];
  affectations: AffectationLogement[];
}
