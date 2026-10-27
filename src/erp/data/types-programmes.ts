/**
 * Messages automatiques aux voyageurs (B1) et avis à déposer sur les
 * voyageurs après leur départ (B5).
 *
 * - Réglages : collection `reglages`, élément d'id 'messages-programmes'
 *   (modifiés dans Messagerie → Messages automatiques, par un gérant).
 * - Envois : collection `envoisProgrammes`, une ligne par séjour et par
 *   moment (id `${reservationId}~${declencheur}`), écrite par le serveur
 *   seulement. C'est à la fois l'historique et la garantie « jamais deux
 *   fois » (avec la clé d'idempotence de l'envoi).
 * - Avis à déposer : collection `avisADeposer`, une ligne par séjour terminé
 *   (id = celui de la réservation). Le serveur prépare le texte, l'équipe
 *   le copie sur Airbnb puis le marque « fait » ou « passé ». L'ERP ne publie
 *   jamais rien sur la plateforme.
 *
 * Règles : src/erp/data/messages-programmes.ts ; passage serveur :
 * src/erp/data/passage-programmes.ts (api/erp-agent.ts).
 */
import type { CanalReservation, DateISO, Horodatage, Id } from './types';

/** Moment d'envoi d'un message automatique. */
export type DeclencheurMessage = 'confirmation' | 'veille_arrivee' | 'jour_depart' | 'demande_avis';

/** Texte propre à un logement (remplace celui de l'espace), ou message coupé pour ce logement. */
export interface ModeleLogement {
  texte?: string;
  /** false : pas de message automatique pour ce logement. */
  actif?: boolean;
}

export interface ModeleProgramme {
  /** Éteint par défaut : rien ne part tant qu'un gérant ne l'allume pas. */
  actif: boolean;
  /** Allumé depuis cet instant : aucun message prévu avant ne part. */
  activeLe?: Horodatage;
  /** Heure d'envoi (Paris), entre 08:00 et 20:30. Absente pour la confirmation. */
  heure?: string;
  texte: string;
  /** Textes propres à certains logements. */
  logements?: Record<Id, ModeleLogement>;
}

export interface ReglagesMessagesProgrammes {
  id: 'messages-programmes';
  modeles: Record<DeclencheurMessage, ModeleProgramme>;
  majLe?: Horodatage;
  majPar?: string;
}

/**
 * en_cours : marqué avant l'envoi (repris avec la même clé si le passage est
 * coupé) ; envoye ; ignore : pas envoyé, pour de bon (raison) ; echec : la
 * plateforme a refusé ; a_verifier : un envoi commencé n'a pas pu être
 * confirmé à temps (rien n'est renvoyé) ; reporte : à réessayer.
 */
export type StatutEnvoiProgramme = 'en_cours' | 'envoye' | 'ignore' | 'echec' | 'a_verifier' | 'reporte';

export interface EnvoiProgramme {
  /** `${reservationId}~${declencheur}` */
  id: Id;
  reservationId: Id;
  logementId: Id;
  declencheur: DeclencheurMessage;
  /** Prénom du voyageur (historique). */
  voyageur: string;
  filId?: Id;
  statut: StatutEnvoiProgramme;
  /** Pourquoi le message n'est pas parti, en clair. */
  raison?: string;
  /** Texte envoyé (ou prêt à partir). */
  texte?: string;
  /** Clé d'idempotence de l'envoi. */
  cle?: string;
  /** Dernier changement. */
  le: Horodatage;
  /** Envoi commencé (en_cours). */
  depuis?: Horodatage;
  envoyeLe?: Horodatage;
  /** Plateforme par laquelle le message est parti. */
  canal?: string;
}

/** a_rediger : texte pas encore prêt ; pret ; a_relire : séjour à vérifier avant de déposer ; fait ; passe. */
export type StatutAvisADeposer = 'a_rediger' | 'pret' | 'a_relire' | 'fait' | 'passe';

export interface AvisADeposer {
  /** Celui de la réservation. */
  id: Id;
  reservationId: Id;
  logementId: Id;
  /** Prénom du voyageur. */
  voyageur: string;
  depart: DateISO;
  canal: CanalReservation;
  statut: StatutAvisADeposer;
  texte?: string;
  /** ia : rédigé par l'IA ; modele : texte simple (sans IA) ; equipe : retouché par l'équipe. */
  source?: 'ia' | 'modele' | 'equipe';
  /** Pourquoi relire avant de déposer (incident, note basse, message négatif…). */
  raisons?: string[];
  creeLe: Horodatage;
  redigeLe?: Horodatage;
  traiteLe?: Horodatage;
  traitePar?: string;
}
