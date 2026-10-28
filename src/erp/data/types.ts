/**
 * Modèle de données de l'ERP (SPEC §3).
 *
 * Identifiants : chaînes (uuid en base). Dates : 'YYYY-MM-DD'. Horodatages :
 * ISO complets. Montants : centimes entiers, jamais de flottants.
 */

import type { AccesProprietaire, BilanProprietaire, DocumentProprietaire } from './types-proprietaire';
import type { AbsenceMembre, AccesOperations, AffectationLogement, ControleQualite, MembreEquipe, SignalementLogement } from './types-operations';
import type { AvisADeposer, DeclencheurMessage, EnvoiProgramme, ReglagesMessagesProgrammes, ReponseAvisAuto } from './types-programmes';
import type { ElementPrix } from './prix-conseils';
import type { AnnonceEquipe } from './annonces-equipe';
import type { ReglagesSupplements } from './supplements';
import type { ActionAgent } from './types-copilote';

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
  /** Réservation : quand le voyageur a réservé (bookedAt, à défaut createdAt), si la plateforme le dit. */
  reserveeLe?: Horodatage;
  /** Annonces reliées sur chaque plateforme. */
  canaux?: { plateforme: string; idExterne: string; actif: boolean }[];
  /** Logement retiré du choix (page Connexions) : en pause, plus synchronisé. */
  horsSelection?: boolean;
  /** Statut du logement juste avant cette mise en pause : il revient quand l'annonce est recochée, ou au « Délier ». */
  statutAvantPause?: StatutLogement;
  /** Dernière lecture des photos de l'annonce (relues une fois par semaine). */
  photosLuesLe?: Horodatage;
  /** D'où viennent les photos et les prix, ou pourquoi ils manquent (dernier relevé). */
  lecture?: LectureAnnonce;
}

/**
 * Note de lecture d'une annonce : la source des photos et des prix, et en
 * clair la raison d'un manque. `le` ne change que si la note change.
 */
export interface LectureAnnonce {
  photos: 'annonce' | 'repull' | 'booking-chambre' | 'booking-etablissement' | 'airbnb' | 'airbnb-page' | 'aucune';
  prix: 'repull' | 'booking' | 'aucun';
  /** Pourquoi il n'y a pas de photo (« Booking.com n'a renvoyé aucune photo »). */
  raisonPhotos?: string;
  /** Pourquoi il n'y a pas de prix. */
  raisonPrix?: string;
  le: DateISO;
}

/* ------------------------------------------------------------ référentiel */

export type TypeProprietaire = 'particulier' | 'sci' | 'societe';

export interface Proprietaire {
  id: Id;
  type: TypeProprietaire;
  nom: string;
  contact: { email: string; telephone: string };
  adresse: string;
  /** Ancien IBAN masqué : plus demandé ni affiché ; peut rester sur une ancienne fiche, effacé au prochain enregistrement. */
  ibanMasque?: string;
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
  /** Ce qu'il faut savoir d'autre (poubelles, voisinage, chauffage…), lu par l'agent. */
  aSavoir?: string;
  /** Consignes de départ (clés, poubelles, linge…) : livret du séjour et agent. */
  consignesDepart?: string;
  /** Guides du logement (vidéo, photo, document, lien) que l'agent joint à sa réponse. */
  guides?: GuideLogement[];
  /** Questions fréquentes et leur réponse, sûres pour l'agent. */
  questions?: QuestionFrequente[];
}

/**
 * Un guide pratique du logement (« Comment récupérer la clé »…) : l'agent le
 * joint par son id quand la question du voyageur y correspond.
 */
export interface GuideLogement {
  id: Id;
  titre: string;
  /** Quand l'envoyer, en clair (« le voyageur demande comment entrer »). */
  quand?: string;
  media: {
    type: 'video' | 'photo' | 'document' | 'lien';
    /** Adresse https (YouTube, Drive, iCloud…). */
    url?: string;
    /** Fichier déposé dans l'espace privé (« stockage://… ») : envoyé en lien signé. */
    fichier?: string;
  };
  /** Contient l'accès au logement (clé, code) : envoyé seulement quand les codes sont communicables. */
  acces?: boolean;
  ajouteLe: Horodatage;
  ajoutePar: string;
}

export interface QuestionFrequente {
  id: Id;
  question: string;
  reponse: string;
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
  /**
   * Premier jour (inclus) où le propriétaire actuel reçoit chiffres, avis et
   * séjours de ce logement. Posé par changerProprietaire (data/proprietaire.ts)
   * quand le logement change de propriétaire ; absent : depuis toujours.
   */
  proprietaireDepuis?: DateISO;
  /** Propriétaires précédents, chacun jusqu'à `jusquAu` (exclu) : ce qui était à eux le reste. */
  proprietairesPrecedents?: ProprietairePrecedent[];
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
  /**
   * Photos déposées par l'équipe (« stockage://… »), dans l'ordre choisi (la
   * première est la couverture) : toujours avant celles des plateformes, et
   * jamais modifiées par la synchronisation.
   */
  photosEquipe?: string[];
  /** Photos de l'annonce, lues sur les plateformes (jamais envoyées par l'ERP). */
  photos?: string[];
  /** Prix par nuit des prochaines semaines, lus sur les plateformes (jamais modifiés par l'ERP). */
  tarifs?: TarifsLogement;
  /** Ce que dit l'annonce (description, couchage, conditions, prix de base), lu sur les plateformes. */
  descriptif?: DescriptifLogement;
  /** Annonce importée de Repull (synchronisation automatique). */
  repull?: OrigineRepull;
  /**
   * Logement créé à la main, relié à son annonce depuis sa fiche
   * (data/liaison-annonce.ts) : qui, quand, et ce qu'il était avant le lien.
   * Jamais écrit par la synchronisation (elle le garde tel quel).
   */
  liaison?: LiaisonAnnonce;
  /**
   * Place du logement sur la carte de l’accueil (octobre 2026), calculée
   * d'après son adresse par le géocodeur public (data/carte.ts). Aussi
   * sensible que l'adresse : chaque espace ne la reçoit que pour les
   * logements qu'il voit déjà. Jamais écrite par la synchronisation.
   */
  position?: PositionLogement;
}

/** Champs d'un logement que son annonce remplit ou remplace (versLogement, repull.ts). */
export type ChampsAnnonce = Partial<
  Pick<Logement, 'nom' | 'adresse' | 'ville' | 'capacite' | 'chambres' | 'surfaceM2' | 'lits' | 'fiche' | 'annonces' | 'photoUrl' | 'photos' | 'descriptif' | 'tarifs'>
>;

/** Lien d'un logement créé à la main avec son annonce (« Relier à une annonce »). */
export interface LiaisonAnnonce {
  /** Annonce reliée (même valeur que repull.id au moment du lien). */
  annonce: string;
  le: Horodatage;
  /** Gérant qui a relié (adresse du compte). */
  par: string;
  /** Le logement juste avant le lien : ce que « Délier » lui rend. */
  avant: ChampsAnnonce;
  /**
   * Noms (jamais les valeurs) des champs vides au moment du lien, que
   * l'import remplit seulement s'ils sont vides (CHAMPS_REMPLIS_SI_VIDES,
   * liaison-annonce.ts) : « Délier » les vide de nouveau.
   */
  vides?: string[];
}

/**
 * Point d'un logement sur la carte. `precision` : « adresse » (le numéro de
 * la rue a été trouvé) ou « commune » (seulement le centre de la commune,
 * montré comme approximatif). `adresse` : le texte géocodé, pour savoir si
 * l'adresse a changé depuis.
 */
export interface PositionLogement {
  lat: number;
  lng: number;
  precision: 'adresse' | 'commune';
  /** Service qui l'a trouvée (« geoplateforme », « demo »). */
  source: string;
  adresse: string;
  le: Horodatage;
}

/** Ancien propriétaire d'un logement, de `depuis` (absent : depuis toujours) à `jusquAu` (exclu). */
export interface ProprietairePrecedent {
  proprietaireId: Id;
  depuis?: DateISO;
  jusquAu: DateISO;
}

/** Calendrier des prix lu sur les plateformes : affiché, jamais modifié. */
export interface TarifsLogement {
  /** Devise des prix (EUR attendu). */
  devise: string;
  /** Instant de la lecture. */
  luLe: Horodatage;
  /** Jours connus, dans l'ordre (les jours sans donnée sont absents). */
  jours: { date: DateISO; prixCentimes: Centimes; libre: boolean }[];
}

/**
 * Annonce telle que publiée sur les plateformes : affichée dans la fiche
 * logement et donnée à l'agent, jamais modifiée par l'ERP. Chaque partie
 * n'est remplacée que si la plateforme la renvoie.
 */
export interface DescriptifLogement {
  /** Titre vu par les voyageurs. */
  titre?: string;
  textes?: {
    resume?: string;
    description?: string;
    espace?: string;
    accesVoyageurs?: string;
    quartier?: string;
    transports?: string;
  };
  /** Couchage pièce par pièce, ex. « Chambre 1 » : « 1 lit double ». */
  couchage?: { piece: string; lits: string }[];
  sallesDeBain?: number;
  conditions?: {
    animaux?: boolean;
    fumeur?: boolean;
    fetes?: boolean;
    enfants?: boolean;
    bebes?: boolean;
    ageMinEnfants?: number;
    /** Heures de calme, ex. 22:00 → 07:00. */
    calme?: { debut: string; fin: string };
    /** Conditions d'annulation, en clair (ex. « Flexible »). */
    annulation?: string;
    /** Arrivée : mode (« Boîte à clés »…) et heure limite. */
    arrivee?: string;
    arriveeJusqua?: string;
  };
  sejour?: { nuitsMin?: number; nuitsMax?: number; preavisHeures?: number; reservationInstantanee?: boolean };
  prix?: {
    devise: string;
    nuit?: Centimes;
    weekend?: Centimes;
    menage?: Centimes;
    voyageurSupplementaire?: Centimes;
    voyageursInclus?: number;
    caution?: Centimes;
    remiseSemainePct?: number;
    remiseMoisPct?: number;
  };
  /** Autres frais (animal, linge…), en clair : « Animal : 15 € par séjour ». */
  frais?: string[];
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
  /** Lecture de l'avis par l'IA (« Préparer une réponse ») : affine l'analyse, src/erp/data/avis.ts. */
  lectureAvis?: LectureAvis;
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
  /** Message réellement parti chez le voyageur par Repull (Airbnb, Booking.com...). */
  envoi?: EnvoiMessage;
  /** Traduction française d'un message du voyageur (« Voir en français »), gardée après la première demande. */
  traductionFr?: string;
}

/** Ce que demande le voyageur (dernier message), lu par l'IA : src/erp/data/messagerie-ia.ts. */
export type IntentionMessage =
  | 'arrivee'
  | 'depart'
  | 'arrivee_anticipee'
  | 'depart_tardif'
  | 'facture'
  | 'prolongation'
  | 'probleme_technique'
  | 'infos'
  | 'annulation'
  | 'paiement'
  | 'avis'
  | 'autre';

export type SentimentMessage = 'positif' | 'neutre' | 'negatif';

/**
 * Lecture d'un avis par l'IA, gardée sur la réservation : son sentiment, et
 * le sens des thèmes que l'analyse par mots-clés avait déjà repérés (jamais
 * un thème de plus). Ne vaut que pour le texte public lu (`empreinte`).
 */
export interface LectureAvis {
  empreinte: string;
  sentiment: SentimentMessage;
  /** Clés de THEMES_AVIS (src/erp/data/avis.ts). */
  themes: { theme: string; sentiment: SentimentMessage }[];
  le: Horodatage;
}

/**
 * Lecture du dernier message du voyageur par l'IA (passage de l'agent ou
 * « Proposer une réponse ») : tri de « À répondre », langue et demande
 * affichées dans la messagerie. Aucun appel à l'IA juste pour la remplir.
 */
export interface AnalyseFil {
  /** Message du voyageur lu. */
  messageId: Id;
  /** Code ISO de sa langue (fr, en, es...). */
  langue?: string;
  intention?: IntentionMessage;
  sentiment?: SentimentMessage;
  /** À traiter vite selon l'IA (problème sur place, voyageur très mécontent). */
  urgence?: boolean;
  le: Horodatage;
}

/**
 * Réponse préparée par l'agent et pas envoyée (« à valider ») : l'équipe la
 * relit dans la zone de réponse et l'envoie en un clic.
 */
export interface BrouillonAgent {
  /** Message du voyageur auquel elle répond. */
  messageId: Id;
  /** Texte au voyageur, dans sa langue, signé. */
  texte: string;
  /** Version française pour l'équipe (absente si la réponse est en français). */
  texteFr?: string;
  langue?: string;
  intention?: IntentionMessage;
  /** Confiance de l'agent dans sa réponse (0 à 1). */
  confiance?: number;
  /** Pourquoi elle n'est pas partie seule. */
  motif?: string;
  le: Horodatage;
  /** Envoyée par ce membre de l'équipe (api/erp-repull-messages.ts). */
  valideePar?: string;
  valideeLe?: Horodatage;
  /** Retouchée avant l'envoi. */
  modifiee?: boolean;
  /** Proposée par Claude depuis le connecteur (outil reponse_proposer), pas par l'agent. */
  proposePar?: 'claude';
}

/** Trace d'un envoi par Repull (api/erp-repull-messages.ts ou l'agent IA). */
export interface EnvoiMessage {
  /** Plateforme par laquelle le message est parti (airbnb, booking...). */
  canal?: string;
  /** La plateforme a modifié le texte (lien ou téléphone retiré) : `texte` est ce qu'a reçu le voyageur. */
  reecrit?: boolean;
  /** Qui l'a envoyé (nom du membre, ou « Agent IA »). */
  par?: string;
  /**
   * Message automatique : son moment (« proposer_supplements »…). Une réponse
   * du voyageur à « Proposer les suppléments » n'est jamais envoyée seule par
   * l'agent (messagerie-ia.ts, apresPropositionSupplements).
   */
  moment?: DeclencheurMessage;
}

/**
 * Suivi de l'agent IA sur un fil (api/erp-agent.ts) : dernier message du
 * voyageur traité (jamais deux réponses au même message) et envoi en cours
 * (reprise sans double envoi après une coupure).
 */
export interface SuiviAgent {
  /** Dernier message du voyageur traité par l'agent. */
  dernierMessageTraite?: Id;
  /** a_valider : réponse préparée, pas envoyée (niveau d'autonomie, confiance trop basse). */
  decision?: 'repondre' | 'transmettre' | 'a_valider';
  /** Demande du voyageur et confiance de l'agent, notées à chaque décision. */
  intention?: IntentionMessage;
  confiance?: number;
  /** Réponse préparée par l'agent, à relire et envoyer par l'équipe. */
  brouillon?: BrouillonAgent;
  /** Résumé de la situation pour l'équipe (transmis) ou de la réponse. */
  resume?: string;
  le?: Horodatage;
  /** Relance Telegram faite (conversation transmise restée sans réponse). */
  relanceLe?: Horodatage;
  /** Envoi commencé et pas encore confirmé : repris tel quel au passage suivant. */
  enCours?: { messageId: Id; texte: string; cle: string; depuis: Horodatage; transmettre?: boolean; raison?: RaisonEscalade; resume?: string };
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
  /** Suivi de l'agent IA (serveur). */
  agent?: SuiviAgent;
  /** Dernier message du voyageur lu par l'IA : langue, demande, ton (tri de « À répondre »). */
  analyse?: AnalyseFil;
  /**
   * Dernière réponse proposée avec « Proposer une réponse » (rien d'envoyé) :
   * le serveur la compare au texte envoyé pour noter qui l'a validée.
   */
  proposition?: { messageId: Id; texte: string; le: Horodatage; par: string };
}

export type RaisonEscalade = 'argent' | 'litige' | 'hors_fiche' | 'exception' | 'autre';

/* ------------------------------------------------------------- réglages */

export type TonAgent = 'chaleureux' | 'professionnel' | 'decontracte';

/**
 * Réglages de l'agent de messagerie (collection `reglages`, élément d'id
 * 'agent'), modifiés dans Messagerie > Votre agent. L'agent
 * du site (api/erp-agent.ts, src/erp/data/agent-messagerie.ts) les relit à
 * chaque passage : voir docs/erp/README.md, « Messagerie et agent IA ».
 */
export interface ReglagesAgent {
  id: 'agent';
  /** En pause : l'agent ne répond plus, tout arrive à l'équipe. */
  actif: boolean;
  ton: TonAgent;
  /** Langues dans lesquelles l'agent répond (codes ISO : fr, en, es...). */
  langues: string[];
  /** Signature ajoutée à la fin de chaque réponse. */
  signature: string;
  /** Plage horaire des réponses (heure de Paris). « toujours » : 24 h / 24. */
  horaires: { mode: 'toujours' | 'plage'; debut: string; fin: string };
  /**
   * Ce que l'agent vous transmet au lieu de répondre seul. Argent et litiges
   * sont toujours transmis (règle non négociable).
   */
  transmettre: {
    horsFiche: boolean;
    derogations: boolean;
    sejoursLongs: boolean;
    /** Nombre de nuits à partir duquel une demande est « longue ». */
    sejoursLongsNuits: number;
  };
  /** Minutes sans réponse humaine avant de vous prévenir d'une conversation transmise. */
  delaiAlerteMinutes: number;
  /** Copie de chaque réponse et alertes sur Telegram. */
  telegram: boolean;
  /**
   * Ce que l'agent envoie seul (choisi par un gérant) : valider (il prépare,
   * l'équipe envoie), simples (questions pratiques quand il est sûr de lui),
   * autonome (tout sauf les sujets sensibles quand il est sûr de lui).
   * Absent : « valider » pour un nouvel espace, « autonome » pour Label
   * Maison (messagerie-ia.ts, niveauAutonomie).
   */
  autonomie?: NiveauAutonomie;
  majLe?: Horodatage;
  majPar?: string;
}

export type NiveauAutonomie = 'valider' | 'simples' | 'autonome';

/* ------------------------------------------- identité de la conciergerie */

/** Régime de TVA de la conciergerie : franchise en base (art. 293 B du CGI) ou TVA facturée. */
export type RegimeTva = 'franchise' | 'tva';

/**
 * Identité légale de la conciergerie de l'espace (Paramètres → Société),
 * imprimée sur ses factures et ses bilans (data/identite-conciergerie.ts).
 */
export interface IdentiteSociete {
  raisonSociale: string;
  /** Forme juridique : SASU, SARL, EI… */
  forme: string;
  /** 14 chiffres, affiché « 993 428 200 00014 ». */
  siret: string;
  /** Adresse du siège, sur une ligne. */
  adresse: string;
  regimeTva: RegimeTva;
  /** Taux de TVA facturé en régime « tva » (20 par défaut) ; sans objet en franchise. */
  tvaPct: number;
  /** Numéro de TVA intracommunautaire (régime « tva »). */
  numeroTva?: string;
  /** Mentions libres imprimées en bas des factures (conditions, pénalités…). */
  mentions?: string;
}

/** Identité enregistrée par le gérant : élément 'societe' de la collection `reglages` de l'espace. */
export interface ReglagesSociete extends IdentiteSociete {
  id: 'societe';
  majLe?: Horodatage;
  majPar?: string;
}

/**
 * Numérotation des factures de l'espace (élément 'numerotation-factures' de
 * `reglages`) : dernier numéro attribué par année. Un numéro n'est jamais
 * réutilisé, même si sa facture disparaît.
 */
export interface CompteurFactures {
  id: 'numerotation-factures';
  derniers: Record<string, number>;
  majLe?: Horodatage;
}


/**
 * Tous les réglages stockés dans la collection `reglages` : l'agent (id
 * 'agent'), les messages automatiques ('messages-programmes'), l'identité de
 * la société ('societe'), la numérotation des factures et les suppléments
 * proposés aux voyageurs ('supplements', data/supplements.ts).
 */
export type Reglage = ReglagesAgent | ReglagesMessagesProgrammes | ReglagesSociete | CompteurFactures | AlerteControleAgent | ReglagesSupplements;

/**
 * Alerte « l'agent ne peut plus vérifier ses réponses » (collection
 * `reglages`, id 'alerte-controle-agent'), écrite par le serveur après des
 * échecs en série du second contrôle (controle-reponse.ts) et lue par
 * l'« À faire » de l'accueil.
 */
export interface AlerteControleAgent {
  id: 'alerte-controle-agent';
  active: boolean;
  message: string;
  /** Échecs de suite au moment de l'écriture. */
  echecs: number;
  depuis?: Horodatage;
  leveeLe?: Horodatage;
}

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
  /**
   * Mission prévue par Claude depuis le connecteur (copilote) : interne à
   * l'ERP (planning, suppléments), jamais transmise à un prestataire ni à une
   * plateforme de ménage.
   */
  interne?: true;
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
  /** Espace opérations (octobre 2026) : membre de l'équipe de terrain qui s'en occupe. */
  assigneA?: Id;
  /** Le gérant a dit « Je m’en occupe » depuis l'ERP (jusqu'à ce que l'incident soit confié à quelqu'un). */
  parGerant?: boolean;
  /** Membre de l'équipe de terrain qui l'a signalé. */
  signalePar?: Id;
  /** Contrôle qualité d'où vient l'incident (point « à revoir »). */
  controleId?: Id;
  /** Ce qui s'est passé, du plus ancien au plus récent. */
  historique?: { le: Horodatage; par: string; texte: string }[];
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
  /** Facture mensuelle : nature de la ligne (commission, ménage d'un séjour, ajustement du gérant). */
  code?: 'commission' | 'menage' | 'ajustement';
  /** Précision imprimée sous le libellé (base et taux, séjour, raison d'un ajustement). */
  detail?: string;
}

/** Ligne ajoutée à la main par le gérant sur un brouillon de facture mensuelle, toujours avec sa raison. */
export interface AjustementFacture {
  id: Id;
  libelle: string;
  /** Montant HT, positif ou négatif (remise). */
  montantCentimes: Centimes;
  motif: string;
  ajouteLe: Horodatage;
  ajoutePar: string;
}

/**
 * Facture mensuelle d'un propriétaire (data/factures-mensuelles.ts) :
 * commission de gestion et ménages du mois, calculés comme son bilan.
 * Brouillon (sans numéro) tant qu'elle n'est pas validée ; à la validation,
 * numéro, lignes, identités et mentions sont figés.
 */
export interface FactureMensuelle {
  /** Mois facturé 'AAAA-MM'. */
  mois: string;
  ajustements: AjustementFacture[];
  creeeLe: Horodatage;
  /** « automatique » (passage planifié du 1er) ou l'adresse du gérant. */
  creeePar: string;
  valideeLe?: Horodatage;
  valideePar?: string;
  /** Figés à la validation. */
  emetteur?: IdentiteSociete;
  client?: { nom: string; adresse: string };
  logements?: string[];
  /** « TVA non applicable, art. 293 B du CGI » en franchise en base. */
  mentionTva?: string;
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
  /** Partagée dans l'espace propriétaire (visible et relancée) depuis cet instant ; absent : pas partagée. */
  partageeLe?: Horodatage;
  /** Facture mensuelle du propriétaire (id `fm-<propriétaire>-<mois>`). */
  mensuelle?: FactureMensuelle;
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
/**
 * « Suivi par » d'un contact du CRM : Abdel ou Kamel dans l'espace de Label
 * Maison (valeurs d'avant, toujours valables) ; dans un autre espace,
 * l'identifiant d'un de ses membres (son adresse, voir marque-espace.ts).
 */
export type SuiviCrm = Responsable | (string & {});

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

/* ------------------------------------------------------------------- CRM */

/**
 * CRM d'appels : chaque demande du site (formulaires audit, accueil, contact,
 * Cercle) devient une ligne « À appeler », créée automatiquement par
 * /api/contact. L'équipe fait avancer la ligne d'étape en étape.
 */
export type StatutContactCrm =
  | 'a_appeler'
  | 'a_rappeler'
  | 'contacte'
  | 'en_attente'
  | 'rendez_vous'
  | 'signe'
  | 'pas_interesse';

/** D'où vient la ligne : formulaire du site (par type) ou saisie à la main. */
export type SourceContactCrm = 'audit' | 'accueil' | 'contact' | 'cercle' | 'dossier' | 'manuel';

export type ResultatAppel = 'joint' | 'pas_de_reponse' | 'messagerie' | 'note' | 'formulaire';

/**
 * Qui est le contact : un propriétaire (il peut confier son logement) ou un
 * apporteur d'affaires (il recommande des propriétaires, Cercle). Absent :
 * déduit de la source (crm-assistant.ts, profilContact).
 */
export type ProfilContactCrm = 'proprietaire' | 'apporteur';

/** Une trace dans l'historique d'un contact (appel, note, nouvelle demande). */
export interface TraceContactCrm {
  le: Horodatage;
  par: string;
  resultat: ResultatAppel;
  texte?: string;
}

export interface ContactCrm {
  id: Id;
  nom: string;
  telephone?: string;
  email?: string;
  ville?: string;
  typeBien?: string;
  adresse?: string;
  /** Message laissé dans le formulaire. */
  message?: string;
  /** Page du site d'où vient la demande. */
  page?: string;
  source: SourceContactCrm;
  statut: StatutContactCrm;
  /** Propriétaire ou apporteur, choisi dans la fiche ; absent : d'après la source (Cercle = apporteur). */
  profil?: ProfilContactCrm;
  /** Pour « En attente » : la raison (travaux, achat en cours, décision à deux…). */
  motifAttente?: string;
  /** Date de la prochaine relance prévue. */
  relanceLe?: DateISO;
  responsable?: SuiviCrm;
  notes: string;
  /** Appels passés sans joindre la personne. */
  tentatives: number;
  historique: TraceContactCrm[];
  creeLe: Horodatage;
  majLe?: Horodatage;
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
  /** Compte relié à la fiche (invitation activée) ; absent : on ne sait pas (base d'avant les espaces, ajout du moment). */
  compteActif?: boolean;
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
/**
 * Dossier propriétaire (mise en service) rempli sur /dossier-proprietaire :
 * toutes les réponses, par identifiant de champ (src/erp/data/dossier-proprietaire.ts).
 */
export interface DossierProprietaire {
  id: Id;
  proprietaireId: Id;
  logementId: Id;
  /** Contact du CRM retrouvé par e-mail ou téléphone. */
  contactCrmId?: Id;
  recuLe: Horodatage;
  majLe?: Horodatage;
  valeurs: Record<string, unknown>;
}

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
  /** CRM d'appels, alimenté par les formulaires du site (ajoutée en octobre 2026). */
  crm: ContactCrm[];
  /** Dossiers remplis par les propriétaires sur /dossier-proprietaire (ajoutée en octobre 2026). */
  dossiers: DossierProprietaire[];
  utilisateurs: Utilisateur[];
  journal: Journal[];
  /** Améliorations proposées aux propriétaires (ajoutée en septembre 2026). */
  recommandations: RecommandationProprietaire[];
  /** Versions successives des descriptions d'annonce (ajoutée en septembre 2026). */
  versionsAnnonce: VersionAnnonce[];
  /** Réglages (agent de messagerie...), un élément par sujet (ajoutée en septembre 2026). */
  reglages: Reglage[];
  /** Accès des propriétaires à leur espace, écrits par le serveur (ajoutée en octobre 2026). */
  accesProprietaires: AccesProprietaire[];
  /** Documents partagés dans l'espace propriétaire (ajoutée en octobre 2026). */
  documentsProprietaire: DocumentProprietaire[];
  /** Bilans mensuels préparés puis publiés dans l'espace propriétaire (ajoutée en octobre 2026). */
  bilansProprietaire: BilanProprietaire[];
  /** Espace opérations (ajoutées en octobre 2026) : équipe de terrain et ses accès (écrits par le serveur), */
  equipe: MembreEquipe[];
  accesOperations: AccesOperations[];
  /** qui suit chaque logement, absences, contrôles qualité, « ce logement n'est pas à moi ». */
  affectations: AffectationLogement[];
  absences: AbsenceMembre[];
  controles: ControleQualite[];
  signalementsLogement: SignalementLogement[];
  /** Messages automatiques (ajoutées en octobre 2026) : envois et refus, écrits par le serveur, */
  envoisProgrammes: EnvoiProgramme[];
  /** avis à déposer sur les voyageurs après leur départ (texte préparé, fait / passé, publié par l'ERP). */
  avisADeposer: AvisADeposer[];
  /**
   * Réponses publiques aux avis des voyageurs publiées par l'ERP, ou qui attendent le gérant
   * (octobre 2026, « Réponses aux avis : publication automatique »). Écrites par le serveur et le gérant.
   */
  reponsesAvis: ReponseAvisAuto[];
  /** Prix conseillés (octobre 2026) : réglages, « C'est fait » / « Ignorer », état du passage du matin. */
  conseilsPrix: ElementPrix[];
  /**
   * Annonces à l'équipe (octobre 2026) : messages du gérant affichés en haut de l'Accueil de chaque
   * membre (rien à voir avec l'annonce d'un logement, versionsAnnonce). Écrites par le gérant seul.
   */
  annoncesEquipe: AnnonceEquipe[];
  /**
   * Actions de l'IA (octobre 2026, copilote) : ce que Claude et l'agent de la messagerie ont fait,
   * avec de quoi l'annuler. Écrites par le serveur ; lues et annulées par le gérant seul.
   */
  actionsAgent: ActionAgent[];
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
  /**
   * Textes de l'annonce (cahier A6) : les trois titres proposés (le premier
   * est aussi `titre`). Absent : version mensuelle d'avant (un seul titre).
   */
  titres?: string[];
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
