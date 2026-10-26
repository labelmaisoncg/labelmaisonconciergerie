/**
 * Espace propriétaire (/espace-proprietaire) : accès, documents partagés et
 * bilans mensuels. Trois collections de erp.enregistrements, sans SQL.
 *
 * Le propriétaire ne lit jamais la base : api/espace-proprietaire.ts filtre
 * par propriétaire et ne renvoie que les champs de VueProprietaire.
 */
import type { CanalReservation, Centimes, DateISO, Horodatage, Id } from './types';

/* ------------------------------------------------------------------ accès */

export type StatutAccesProprietaire = 'invite' | 'actif' | 'retire';

/** Lien de connexion à usage unique : seule son empreinte (SHA-256) est gardée. */
export interface LienAccesProprietaire {
  empreinte: string;
  /** Invitation du gérant (7 jours) ou lien demandé par le propriétaire (1 heure). */
  motif: 'invitation' | 'connexion';
  creeLe: Horodatage;
  expireLe: Horodatage;
  utiliseLe?: Horodatage;
}

/**
 * Accès d'un propriétaire à son espace, un par propriétaire (id = proprietaireId).
 * Écrit uniquement par le serveur (invitation, connexion, retrait).
 */
export interface AccesProprietaire {
  id: Id;
  proprietaireId: Id;
  /** Adresse qui reçoit les liens de connexion (en minuscules). */
  email: string;
  statut: StatutAccesProprietaire;
  inviteLe: Horodatage;
  invitePar: string;
  derniereConnexion?: Horodatage;
  retireLe?: Horodatage;
  /** Augmentée au retrait : toutes les sessions ouvertes deviennent invalides. */
  version: number;
  /** Liens en cours (3 au plus), les plus récents en dernier. */
  liens: LienAccesProprietaire[];
}

/* ------------------------------------------------------------- documents */

export type CategorieDocumentProprietaire = 'contrat' | 'attestation' | 'bilan' | 'facture' | 'autre';

export interface DocumentProprietaire {
  id: Id;
  proprietaireId: Id;
  logementId?: Id;
  categorie: CategorieDocumentProprietaire;
  titre: string;
  /** « stockage://erp-fichiers/proprietaires/<id>/… » (jamais envoyé au propriétaire). */
  fichier: string;
  nomFichier: string;
  ajouteLe: Horodatage;
  ajoutePar: string;
}

/* ---------------------------------------------------------------- bilans */

/** Séjour vu par le propriétaire : prénom et initiale, nombre de voyageurs, montants du mois. */
export interface SejourBilan {
  logementId: Id;
  arrivee: DateISO;
  depart: DateISO;
  /** Nuits du séjour comprises dans le mois. */
  nuits: number;
  /** Nuits du séjour en tout (différent quand il chevauche deux mois). */
  nuitsSejour: number;
  voyageur: string;
  nbPersonnes: number;
  canal: CanalReservation;
  encaisse: Centimes;
  fraisPlateforme: Centimes;
  menage: Centimes;
  commission: Centimes;
  net: Centimes;
}

export interface TotauxBilan {
  sejours: number;
  nuits: number;
  encaisse: Centimes;
  fraisPlateforme: Centimes;
  menage: Centimes;
  commission: Centimes;
  net: Centimes;
}

export interface LogementBilan extends TotauxBilan {
  logementId: Id;
  nom: string;
  /** Nuits réservées / jours du mois (0..1). */
  occupation: number;
  commissionPct?: number;
}

/** Bilan d'un mois (« 2026-08 »), nuits au prorata quand un séjour chevauche deux mois. */
export interface ChiffresBilan {
  mois: string;
  joursMois: number;
  logements: LogementBilan[];
  sejours: SejourBilan[];
  totaux: TotauxBilan;
  /** Nuits réservées / (jours du mois × logements), 0..1. */
  occupation: number;
}

export type StatutBilanProprietaire = 'brouillon' | 'publie';

/** Bilan préparé par le gérant (id = `${proprietaireId}-${mois}`) ; le propriétaire ne voit que les publiés. */
export interface BilanProprietaire {
  id: Id;
  proprietaireId: Id;
  mois: string;
  statut: StatutBilanProprietaire;
  commentaire: string;
  /** Chiffres figés à la publication : le propriétaire voit exactement l'aperçu. */
  chiffres: ChiffresBilan;
  publieLe?: Horodatage;
  publiePar?: string;
  majLe: Horodatage;
}

/* ------------------------------------------------- vue du propriétaire */

export interface LogementVue {
  id: Id;
  nom: string;
  ville: string;
  /** Photo de couverture (adresse web, ou lien signé pour un fichier de l'équipe). */
  photo?: string;
  capacite: number;
  chambres: number;
}

export interface ChiffresMoisVue {
  mois: string;
  net: Centimes;
  nuits: number;
  occupation: number;
  sejours: number;
  /** Mois en cours ou bilan pas encore publié : chiffres provisoires. */
  provisoire: boolean;
}

export interface JourCalendrier {
  date: DateISO;
  /** Nuit du jour au lendemain réservée. */
  occupe: boolean;
  /** Nuit de la veille au jour réservée (quelqu'un se réveille dans le logement). */
  veille: boolean;
  arrivee: boolean;
  depart: boolean;
}

export interface CalendrierLogement {
  logementId: Id;
  jours: JourCalendrier[];
  nuitsReservees: number;
  nuitsLibres: number;
  occupation: number;
  sejours: { arrivee: DateISO; depart: DateISO; nuits: number; voyageur: string; nbPersonnes: number; canal: CanalReservation }[];
}

export interface ArriveeVue {
  logementId: Id;
  arrivee: DateISO;
  depart: DateISO;
  nuits: number;
  voyageur: string;
  nbPersonnes: number;
  canal: CanalReservation;
}

export interface DocumentVue {
  id: Id;
  categorie: CategorieDocumentProprietaire;
  titre: string;
  nomFichier: string;
  ajouteLe: Horodatage;
  logementId?: Id;
}

export interface BilanVue {
  mois: string;
  commentaire: string;
  publieLe: Horodatage;
  chiffres: ChiffresBilan;
}

export interface ContactsConciergerie {
  nom: string;
  email: string;
  telephone: string;
  lienTelephone: string;
  whatsapp: string;
  adresse: string;
  site: string;
}

/** Tout ce que le propriétaire voit, et rien d'autre. */
export interface VueProprietaire {
  proprietaire: { id: Id; nom: string };
  aujourdhui: DateISO;
  logements: LogementVue[];
  moisCourant: ChiffresMoisVue;
  moisPrecedent: ChiffresMoisVue;
  prochainesArrivees: ArriveeVue[];
  calendrier: { mois: string; logements: CalendrierLogement[] };
  bilans: BilanVue[];
  documents: DocumentVue[];
  contacts: ContactsConciergerie;
}
