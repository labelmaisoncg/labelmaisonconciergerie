/**
 * Espace propriétaire (/espace-proprietaire) : accès, documents partagés et
 * bilans mensuels. Trois collections de erp.enregistrements, sans SQL.
 *
 * Le propriétaire ne lit jamais la base : api/espace-proprietaire.ts filtre
 * par propriétaire et ne renvoie que les champs de VueProprietaire.
 */
import type { AccesExterne, LienAccesExterne } from './acces-externe';
import type { JourCarte } from './carte';
import type { CanalReservation, Centimes, DateISO, Horodatage, Id, IdentiteSociete } from './types';

/* ------------------------------------------------------------------ accès */

export type StatutAccesProprietaire = 'invite' | 'actif' | 'retire';

/** Lien de connexion à usage unique : invitation du gérant (7 jours) ou lien demandé (1 heure). */
export type LienAccesProprietaire = LienAccesExterne;

/**
 * Accès d'un propriétaire à son espace, un par propriétaire (id = proprietaireId).
 * Écrit uniquement par le serveur (invitation, connexion, retrait).
 */
export interface AccesProprietaire extends AccesExterne {
  id: Id;
  proprietaireId: Id;
  /** Espace qui a invité (Label Maison, Sens…) ; absent (accès d'avant les espaces) : Label Maison. */
  espace?: string;
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
  /** PDF d'une facture partagée (catégorie « facture »). */
  factureId?: Id;
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
  /** Prolongations regroupées dans ce séjour (réservations qui se suivent, même voyageur) : un seul ménage. */
  prolongations?: number;
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
  /**
   * Carte de l'accueil (octobre 2026) : sa position (lat, lng, précision) et
   * ce qui s'y passe aujourd'hui. Voyageur « Prénom N. » de ses séjours
   * seulement ; ménage sans le nom de qui le fait ; incident par sa nature,
   * jamais sa description (data/carte.ts).
   */
  carte?: JourCarte;
}

export interface ChiffresMoisVue {
  mois: string;
  net: Centimes;
  nuits: number;
  occupation: number;
  sejours: number;
  /** Mois en cours ou bilan pas encore publié : chiffres provisoires. */
  provisoire: boolean;
  /** Commission : `aucune` (pas de taux connu, « après frais ») ou `partielle` (un logement sans taux) ; absent : déduite partout. */
  commission?: 'aucune' | 'partielle';
}

export interface JourCalendrier {
  date: DateISO;
  /** Nuit du jour au lendemain réservée. */
  occupe: boolean;
  /** Nuit de la veille au jour réservée (quelqu'un se réveille dans le logement). */
  veille: boolean;
  arrivee: boolean;
  depart: boolean;
  /**
   * Jour qui n'est pas à ce propriétaire (changement de propriétaire, début
   * du mandat) : ni libre ni réservé pour lui. `avant` : avant son arrivée ;
   * `apres` : après son départ ; `autre` : dans sa période, mais pris par le
   * séjour de l'ancien propriétaire (arrivé avant le changement).
   */
  hors?: 'avant' | 'apres' | 'autre';
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

/* ------------------------------------------ fiche « Mes logements » */

/** Un mois d'un logement. `suivi` : le mois est couvert par les données de l'ERP. */
export interface MoisPerformance {
  mois: string;
  suivi: boolean;
  net: Centimes;
  encaisse: Centimes;
  /** Encaissé hors ménage (base du prix moyen par nuit). */
  hebergement: Centimes;
  nuits: number;
  sejours: number;
  /** Jours où le logement était géré (dénominateur de l'occupation). */
  jours: number;
  occupation: number;
  prixMoyenNuit: Centimes;
}

/** Totaux sur des mois suivis : séjours comptés une fois, même à cheval sur deux mois. */
export interface TotauxPerformance {
  mois: number;
  net: Centimes;
  encaisse: Centimes;
  nuits: number;
  sejours: number;
  jours: number;
  occupation: number;
  prixMoyenNuit: Centimes;
}

/** Mêmes mois, un an plus tôt : seulement les mois suivis les deux années. */
export interface ComparaisonPerformance {
  nbMois: number;
  actuel: TotauxPerformance;
  precedent: TotauxPerformance;
}

/** Avis d'un voyageur : « Prénom N. », note, partie publique du commentaire seulement. */
export interface AvisVue {
  date: DateISO;
  note: number;
  texte?: string;
  voyageur: string;
  canal: CanalReservation;
}

export interface FicheLogementVue {
  logementId: Id;
  /** Les 12 derniers mois terminés, du plus ancien au plus récent. */
  mois: MoisPerformance[];
  totaux: TotauxPerformance;
  comparaison?: ComparaisonPerformance;
  avis?: { moyenne: number; nombre: number; derniers: AvisVue[] };
  /** Séjour en cours et prochains séjours. */
  prochainsSejours: ArriveeVue[];
}

/* ------------------------------------------- factures et relances */

/** Statut vu par le propriétaire. */
export type StatutFactureVue = 'a_payer' | 'en_retard' | 'payee';

export interface FactureVue {
  id: Id;
  numero: string;
  dateEmission: DateISO;
  echeance: DateISO;
  montantHt: Centimes;
  tvaPct: number;
  montantTtc: Centimes;
  statut: StatutFactureVue;
  payeeLe?: DateISO;
  lignes: { libelle: string; quantite: number; pu: Centimes; detail?: string; code?: 'commission' | 'menage' | 'ajustement' }[];
  /** Facture mensuelle : mois, identités et mentions figées à sa validation (mise en page complète). */
  mensuelle?: FactureMensuelleVue;
  /** Document PDF partagé (ouvert par lien signé) ; absent : version imprimable. */
  pdf?: Id;
  /** Dernier rappel envoyé. */
  dernierRappel?: DateISO;
}

/** Partie figée d'une facture mensuelle, telle que l'imprime le propriétaire. */
export interface FactureMensuelleVue {
  mois: string;
  emetteur: IdentiteSociete;
  client: { nom: string; adresse: string };
  logements: string[];
  mentionTva?: string;
}

export type StatutRelance = 'proposee' | 'envoyee' | 'annulee' | 'sans_objet';

/**
 * Relance d'une facture (id = `${factureId}-r${niveau}` : une par étape et
 * par facture). Collection serveur `relancesPaiement` : écrite seulement par
 * le serveur (passage quotidien, envoi ou annulation par un gérant).
 */
export interface RelancePaiement {
  id: Id;
  factureId: Id;
  proprietaireId: Id;
  numero: string;
  /** Étape : 1 = premier rappel (J+5 par défaut), 2, 3… */
  niveau: number;
  joursApresEcheance: number;
  /** Date où la relance est due (échéance + jours). */
  dueLe: DateISO;
  statut: StatutRelance;
  creeLe: Horodatage;
  /** Pourquoi une relance du mode automatique reste à valider. */
  motif?: 'sans_expediteur' | 'sans_adresse' | 'echec_envoi' | 'remplacee';
  destinataire?: string;
  envoyeeLe?: Horodatage;
  /** « automatique » ou l'adresse du gérant qui a validé. */
  envoyeePar?: string;
  annuleeLe?: Horodatage;
  annuleePar?: string;
  espace?: string;
}

/** Réglages des relances d'un espace (collection serveur `reglagesRelances`, id « relances »). */
export interface ReglagesRelances {
  id: 'relances';
  actif: boolean;
  /** proposer : le gérant valide chaque envoi ; automatique : envoi par e-mail. */
  mode: 'proposer' | 'automatique';
  /** Jours après l'échéance, une étape par valeur (5, 15, 30 par défaut). */
  jours: number[];
  majLe?: Horodatage;
  majPar?: string;
}

/** Tout ce que le propriétaire voit, et rien d'autre. */
export interface VueProprietaire {
  proprietaire: { id: Id; nom: string };
  /**
   * Conciergerie (espace) qui gère ses logements : « Label Maison », « Sens »…
   * `espace` : son identifiant (pas secret, il est dans le lien) ; c'est lui,
   * jamais le nom, qui décide de l'en-tête légal de Label Maison à l'impression.
   */
  conciergerie: { nom: string; espace: string; ligneLegale?: string };
  aujourdhui: DateISO;
  logements: LogementVue[];
  /** Logements qu'il a cédés à un autre propriétaire (dernier jour exclu), du plus récent au plus ancien. */
  logementsCedes: { id: Id; nom: string; jusquAu: DateISO }[];
  moisCourant: ChiffresMoisVue;
  moisPrecedent: ChiffresMoisVue;
  prochainesArrivees: ArriveeVue[];
  calendrier: { mois: string; logements: CalendrierLogement[] };
  /** Une fiche par logement géré (onglet « Mes logements »). */
  fiches: FicheLogementVue[];
  bilans: BilanVue[];
  documents: DocumentVue[];
  /** Factures partagées avec lui, des plus récentes aux plus anciennes. */
  factures: FactureVue[];
  /** Contacts de la conciergerie ; absents si l'espace n'en a pas renseigné. */
  contacts?: ContactsConciergerie;
}
