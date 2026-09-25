/**
 * Modèle de données de l'ERP (SPEC §3).
 *
 * Identifiants : chaînes (uuid en base). Dates : 'YYYY-MM-DD'. Horodatages :
 * ISO complets. Montants : centimes entiers, jamais de flottants.
 */

export type Id = string;
/** Date calendaire 'YYYY-MM-DD'. */
export type DateISO = string;
/** Horodatage ISO complet. */
export type Horodatage = string;
/** Montant en centimes d'euro (entier). */
export type Centimes = number;

/**
 * Trace d'un élément importé de Repull (API unifiée Airbnb, Booking.com...),
 * écrite par la synchronisation serveur (api/erp-repull-sync.ts). Sa présence
 * signifie « Importé de Repull » ; son contenu sert à relier et à comparer.
 */
export interface OrigineRepull {
  /** Identifiant Repull (annonce, réservation ou conversation). */
  id: string;
  /** Dernière modification connue chez Repull (updatedAt, ou dernier message d'une conversation). */
  majLe?: Horodatage;
  /** Statut brut chez Repull (active, cancelled...). */
  statut?: string;
  /** Précision du statut (cancelled_by_guest, declined...). */
  statutDetail?: string;
  /** Code de confirmation de la plateforme (HM... Airbnb, numéro Booking.com). */
  code?: string;
  /** Devise des montants (EUR attendu). */
  devise?: string;
  /** Voyageur chez Repull (pays lu dans sa fiche). */
  voyageurId?: string;
  /** Annonces reliées sur chaque plateforme. */
  canaux?: { plateforme: string; idExterne: string; actif: boolean }[];
  /** Logement retiré du choix (page Connexions) : en pause, plus synchronisé. */
  horsSelection?: boolean;
}

/* ------------------------------------------------------------ référentiel */

export type TypeProprietaire = 'particulier' | 'sci' | 'societe';

export interface Proprietaire {
  id: Id;
  type: TypeProprietaire;
  nom: string;
  contact: { email: string; telephone: string };
  adresse: string;
  ibanMasque: string;
  notes: string;
  creeLe: DateISO;
}

export type StatutMandat = 'brouillon' | 'envoye' | 'signe' | 'resilie';

export interface Mandat {
  id: Id;
  proprietaireId: Id;
  logementId: Id;
  reference: string;
  statut: StatutMandat;
  /** Pourcentage entier ou décimal, ex. 18 pour 18 %. */
  commissionPct: number;
  fraisMenageCentimes: Centimes;
  dateDebut: DateISO;
  dateFin?: DateISO;
  periodeEssaiFin?: DateISO;
  preavisJours: number;
  signeLe?: DateISO;
  resilieLe?: DateISO;
  motifResiliation?: string;
  documentUrl?: string;
}

export type TypeLogement = 'studio' | 'T1' | 'T2' | 'T3' | 'T4' | 'maison' | 'autre';
export type StatutLogement = 'lancement' | 'actif' | 'pause' | 'sorti';
export type TypeLit = 'simple' | 'double' | 'canape';
export type Dpe = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type Serrure = 'connectee' | 'boite_a_cles' | 'cles';
export type Canal = 'airbnb' | 'booking' | 'direct';

export interface Lit {
  type: TypeLit;
  nombre: number;
}

export interface FicheLogement {
  wifiNom: string;
  wifiCode: string;
  heureArrivee: string;
  heureDepart: string;
  acces: string;
  parking: string;
  regles: string;
  equipements: string[];
}

export interface LigneArticle {
  article: string;
  quantite: number;
}

export interface Annonce {
  canal: Canal;
  url?: string;
  connecte: boolean;
}

/** Clés stables de la checklist de lancement (SPEC §2.2). */
export type CleChecklistLancement =
  | 'mandat_signe'
  | 'inventaire_signe'
  | 'linge_etiquete'
  | 'acces_securise'
  | 'assurance_proprietaire'
  | 'numero_enregistrement'
  | 'dpe'
  | 'fiche_complete'
  | 'prestataire_menage';

export interface ElementChecklistLancement {
  cle: CleChecklistLancement;
  libelle: string;
  fait: boolean;
  preuve?: string;
}

export interface Logement {
  id: Id;
  nom: string;
  adresse: string;
  ville: string;
  codePostal: string;
  type: TypeLogement;
  surfaceM2: number;
  capacite: number;
  chambres: number;
  lits: Lit[];
  statut: StatutLogement;
  proprietaireId: Id;
  residencePrincipale: boolean;
  numeroEnregistrement?: string;
  dpe?: Dpe;
  serrure: Serrure;
  fiche: FicheLogement;
  dotationLinge: LigneArticle[];
  /** @deprecated Ancien identifiant Channex (avant Repull), ni affiché ni écrit. */
  channexPropertyId?: string;
  annonces: Annonce[];
  checklistLancement: ElementChecklistLancement[];
  photoUrl?: string;
  /** Annonce importée de Repull (synchronisation automatique). */
  repull?: OrigineRepull;
}

/* ----------------------------------------------------------- distribution */

export type CanalReservation = 'airbnb' | 'booking' | 'direct' | 'autre';
export type StatutReservation = 'confirmee' | 'annulee' | 'en_cours' | 'terminee';

export interface Voyageur {
  nom: string;
  pays?: string;
  nbPersonnes: number;
}

export interface Reservation {
  id: Id;
  logementId: Id;
  canal: CanalReservation;
  voyageur: Voyageur;
  arrivee: DateISO;
  depart: DateISO;
  nuits: number;
  statut: StatutReservation;
  montantBrutCentimes: Centimes;
  commissionPlateformeCentimes: Centimes;
  fraisMenageCentimes: Centimes;
  noteVoyageur?: number;
  commentaireVoyageur?: string;
  /** @deprecated Ancienne référence Channex (avant Repull) : lue en secours pour les anciennes lignes. */
  channexBookingId?: string;
  /** Réservation importée de Repull (synchronisation automatique). */
  repull?: OrigineRepull;
}

/* ------------------------------------------------------ relation voyageur */

export type StatutFil = 'ouvert' | 'escalade' | 'clos';
export type AuteurMessage = 'voyageur' | 'hote' | 'agent';
export type TraitePar = 'agent' | 'humain' | 'en_attente';

export interface Message {
  id: Id;
  auteur: AuteurMessage;
  texte: string;
  envoyeLe: Horodatage;
}

export interface FilMessages {
  id: Id;
  reservationId?: Id;
  logementId: Id;
  canal: CanalReservation;
  voyageur: string;
  statut: StatutFil;
  messages: Message[];
  dernierMessageLe: Horodatage;
  traitePar: TraitePar;
  /** Pourquoi l'agent a passé la main (fil escaladé). */
  raisonEscalade?: RaisonEscalade;
  /** Conversation importée de Repull (synchronisation automatique). */
  repull?: OrigineRepull;
}

export type RaisonEscalade = 'argent' | 'litige' | 'hors_fiche';

/* -------------------------------------------------------------- opérations */

export type TypeMission = 'menage' | 'linge' | 'controle' | 'maintenance';
export type StatutMission =
  | 'a_attribuer'
  | 'attribuee'
  | 'en_cours'
  | 'a_valider'
  | 'validee'
  | 'refusee'
  | 'annulee';
export type MomentPhoto = 'avant' | 'apres';

export interface ElementChecklist {
  libelle: string;
  fait: boolean;
}

export interface PhotoMission {
  url: string;
  moment: MomentPhoto;
  prisLe: Horodatage;
}

export interface Mission {
  id: Id;
  type: TypeMission;
  logementId: Id;
  reservationId?: Id;
  prestataireId?: Id;
  date: DateISO;
  heureDebut: string;
  heureFinMax: string;
  statut: StatutMission;
  checklist: ElementChecklist[];
  photos: PhotoMission[];
  tarifCentimes: Centimes;
  controleQualite: boolean;
  noteControle?: number;
  commentaire?: string;
}

export type TypeMouvementLinge =
  | 'sortie_sale'
  | 'envoi_blanchisserie'
  | 'retour_propre'
  | 'mise_en_place'
  | 'perte'
  | 'rebut';

export interface MouvementLinge {
  id: Id;
  logementId: Id;
  date: DateISO;
  type: TypeMouvementLinge;
  articles: LigneArticle[];
  prestataireId?: Id;
  missionId?: Id;
  note?: string;
}

export type CategorieIncident = 'menage' | 'linge' | 'casse' | 'panne' | 'acces' | 'voyageur' | 'autre';
export type GraviteIncident = 'faible' | 'moyenne' | 'haute';
export type StatutIncident = 'ouvert' | 'en_cours' | 'resolu';
export type Refacturable = 'proprietaire' | 'voyageur' | 'prestataire' | 'aucun';

export interface Incident {
  id: Id;
  logementId: Id;
  reservationId?: Id;
  date: DateISO;
  categorie: CategorieIncident;
  gravite: GraviteIncident;
  description: string;
  statut: StatutIncident;
  responsable?: string;
  coutCentimes?: Centimes;
  refacturable: Refacturable;
  preuves: string[];
  resoluLe?: DateISO;
  /** Date à laquelle la somme refacturable a été récupérée. */
  recupereLe?: DateISO;
}

/* ------------------------------------------------------------ prestataires */

export type TypePrestataire = 'menage' | 'linge' | 'maintenance' | 'serrurier' | 'autre';
export type StatutPrestataire = 'actif' | 'suspendu' | 'sorti';
export type TypeDocument = 'contrat' | 'rc_pro' | 'urssaf' | 'kbis' | 'autre';
export type StatutDocument = 'valide' | 'expire' | 'manquant';

export interface TarifPrestataire {
  typeLogement: TypeLogement;
  montantCentimes: Centimes;
}

export interface DocumentPrestataire {
  type: TypeDocument;
  valideJusquau?: DateISO;
  url?: string;
  statut: StatutDocument;
}

export interface Prestataire {
  id: Id;
  nom: string;
  raisonSociale?: string;
  siret?: string;
  type: TypePrestataire;
  telephone: string;
  email?: string;
  zone: string[];
  statut: StatutPrestataire;
  tarifs: TarifPrestataire[];
  documents: DocumentPrestataire[];
  noteMoyenne?: number;
  missionsRealisees: number;
}

/* ----------------------------------------------------------------- finance */

export type TypeFacture = 'commission' | 'menage' | 'prestation' | 'avoir';
export type DestinataireFacture = 'proprietaire' | 'voyageur' | 'autre';
export type StatutFacture = 'brouillon' | 'emise' | 'payee' | 'en_retard' | 'annulee';

export interface LigneFacture {
  libelle: string;
  quantite: number;
  puCentimes: Centimes;
}

export interface Facture {
  id: Id;
  numero: string;
  type: TypeFacture;
  destinataire: DestinataireFacture;
  proprietaireId?: Id;
  dateEmission: DateISO;
  echeance: DateISO;
  montantHtCentimes: Centimes;
  tvaPct: number;
  statut: StatutFacture;
  payeeLe?: DateISO;
  lignes: LigneFacture[];
}

export type StatutPaiementPrestataire = 'a_payer' | 'paye' | 'bloque';

export interface PaiementPrestataire {
  id: Id;
  prestataireId: Id;
  /** 'YYYY-MM' */
  periode: string;
  missions: Id[];
  montantCentimes: Centimes;
  retenueCentimes: Centimes;
  motifRetenue?: string;
  statut: StatutPaiementPrestataire;
  payeLe?: DateISO;
}

export type CategorieCharge =
  | 'linge'
  | 'produits'
  | 'transport'
  | 'logiciel'
  | 'assurance'
  | 'serrurerie'
  | 'autre';

export interface Charge {
  id: Id;
  date: DateISO;
  libelle: string;
  categorie: CategorieCharge;
  montantCentimes: Centimes;
  logementId?: Id;
}

/* -------------------------------------------------------------- commercial */

export type SourceProspect = 'seo' | 'parrainage' | 'cercle' | 'reseau' | 'appel_entrant' | 'autre';
export type EtapeProspect =
  | 'nouveau'
  | 'contact'
  | 'visite'
  | 'proposition'
  | 'negociation'
  | 'signe'
  | 'perdu';
export type Responsable = 'abdel' | 'kamel';

export interface Prospect {
  id: Id;
  nom: string;
  ville: string;
  source: SourceProspect;
  typeBien: string;
  revenuEstimeAnnuelCentimes: Centimes;
  etape: EtapeProspect;
  prochaineAction?: string;
  prochaineActionLe?: DateISO;
  responsable: Responsable;
  notes: string;
  creeLe: DateISO;
}

/* ------------------------------------------------------ administration */

export type RoleUtilisateur = 'gerant' | 'operations' | 'prestataire' | 'lecture';

export interface Utilisateur {
  id: Id;
  nom: string;
  email: string;
  role: RoleUtilisateur;
  /** Pour le rôle « prestataire » : la fiche prestataire liée (accès à ses seules missions). */
  prestataireId?: Id;
}

export interface Journal {
  id: Id;
  horodatage: Horodatage;
  auteur: string;
  action: string;
  entite: string;
  entiteId: Id;
  details: string;
}

/* ------------------------------------------------------------- agrégats */

/** Toutes les collections de l'ERP, telles que tenues par le store. */
export interface ErpDonnees {
  proprietaires: Proprietaire[];
  mandats: Mandat[];
  logements: Logement[];
  reservations: Reservation[];
  filsMessages: FilMessages[];
  missions: Mission[];
  prestataires: Prestataire[];
  mouvementsLinge: MouvementLinge[];
  incidents: Incident[];
  factures: Facture[];
  paiementsPrestataires: PaiementPrestataire[];
  charges: Charge[];
  prospects: Prospect[];
  utilisateurs: Utilisateur[];
  journal: Journal[];
  /** Améliorations proposées aux propriétaires (ajoutée en septembre 2026). */
  recommandations: RecommandationProprietaire[];
  /** Versions successives des descriptions d'annonce (ajoutée en septembre 2026). */
  versionsAnnonce: VersionAnnonce[];
}

export type NomCollection = keyof ErpDonnees;
/** Type d'élément d'une collection donnée. */
export type ElementDe<C extends NomCollection> = ErpDonnees[C][number];

/* ------------------------------------------------- analyse des biens */

export type StatutRecommandation = 'a_proposer' | 'proposee' | 'acceptee' | 'refusee' | 'realisee';
export type PorteurRecommandation = 'proprietaire' | 'label_maison';

/**
 * Amélioration suggérée au propriétaire, suivie de la proposition au résultat
 * observé (module Performance des biens).
 */
export interface RecommandationProprietaire {
  id: Id;
  logementId: Id;
  proprietaireId: Id;
  /** Code stable de l'amélioration (analyse/ameliorations.ts), ex. 'literie'. */
  code: string;
  titre: string;
  detail: string;
  /** Gain mensuel estimé, en centimes (voir `impactSur`). */
  impactEstimeCentimesMois?: Centimes;
  /** Sur quoi porte le gain : revenu brut du bien ou marge Label Maison. */
  impactSur?: 'revenu_bien' | 'marge_label_maison';
  porteur: PorteurRecommandation;
  statut: StatutRecommandation;
  proposeeLe?: DateISO;
  decideeLe?: DateISO;
  realiseeLe?: DateISO;
  coutCentimes?: Centimes;
  resultatObserve?: string;
  creeLe: DateISO;
}

/* ------------------------------------------ rafraîchissement des annonces */

export type StatutVersionAnnonce = 'proposee' | 'validee' | 'publiee' | 'rejetee';

/**
 * Version mensuelle de la description d'une annonce (SPEC §11) : proposée par
 * l'agent (ou saisie par un humain), validée par Abdel ou Kamel, publiée,
 * puis mesurée (réservations avant / après publication).
 */
export interface VersionAnnonce {
  id: Id;
  logementId: Id;
  /** Mois visé 'YYYY-MM'. */
  mois: string;
  statut: StatutVersionAnnonce;
  titre: string;
  description: string;
  /** Accroche d'une ligne (premier paragraphe visible sur Airbnb). */
  accroche: string;
  /** Pourquoi cette version : saison, événement local, avis voyageurs. */
  raisons: string[];
  source: 'agent' | 'humain';
  creeLe: DateISO;
  /** Nom de l'utilisateur qui a validé. */
  valideePar?: string;
  valideeLe?: DateISO;
  publieeLe?: DateISO;
  motifRejet?: string;
}
