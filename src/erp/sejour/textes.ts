/**
 * Textes du livret du séjour (/sejour), en français et en anglais : courts et
 * simples. Les textes de la fiche du logement restent tels que l'équipe les a
 * écrits (en français).
 */
import { CODE_MASQUE } from '../data/messagerie-ia';
import type { GuideSejour, LangueSejour } from '../data/sejour';

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

const FR = {
  titrePage: 'Votre séjour',
  langue: 'English',
  langueCode: 'EN',
  bonjour: (p: string) => (p ? `Bonjour ${p}` : 'Bonjour'),
  arrivee: 'Arrivée',
  depart: 'Départ',
  des: (h: string) => `dès ${h}`,
  avant: (h: string) => `avant ${h}`,
  nuits: (n: number) => pluriel(n, 'nuit', 'nuits'),
  voyageurs: (n: number) => pluriel(n, 'voyageur', 'voyageurs'),
  apres: 'Merci pour votre séjour.',

  checkinTitre: 'Check-in en ligne',
  checkinAFaire: 'Deux minutes pour préparer votre arrivée.',
  checkinEnCours: 'Il reste votre check-in : deux minutes.',
  checkinFait: 'Check-in fait',
  checkinEnvoye: (d: string) => `Envoyé le ${d}.`,
  faireCheckin: 'Faire mon check-in',
  modifier: 'Modifier',
  heureArrivee: 'Heure d’arrivée prévue',
  heureArriveeSurPlace: 'Heure d’arrivée',
  nbVoyageurs: 'Nombre de voyageurs',
  nationaliteQuestion: 'Nationalité des voyageurs',
  tousFrancais: 'Tous français',
  etrangers: 'Au moins un voyageur étranger',
  ficheExplication: 'Une fiche par voyageur étranger de 15 ans et plus, sans pièce d’identité.',
  voyageurN: (n: number) => `Voyageur ${n}`,
  nom: 'Nom',
  prenoms: 'Prénom(s)',
  naissanceLe: 'Date de naissance',
  naissanceLieu: 'Lieu de naissance',
  naissanceLieuAide: 'Ville et pays.',
  nationalite: 'Nationalité',
  domicile: 'Adresse du domicile habituel',
  enfants: 'Enfants de moins de 15 ans',
  enfantsAide: 'Sur la fiche de cette personne.',
  ajouterVoyageur: 'Ajouter un voyageur',
  retirer: 'Retirer',
  fichesGardees: (n: number) => `${pluriel(n, 'fiche déjà envoyée', 'fiches déjà envoyées')}. Pour votre confidentialité, elles ne sont pas réaffichées ici.`,
  remplirDeNouveau: 'Les remplir de nouveau',
  garderFiches: 'Garder les fiches déjà envoyées',
  accepte: 'J’ai lu le règlement intérieur et je l’accepte.',
  voirReglement: 'Voir le règlement',
  confidentialiteCourte: 'Gardées 6 mois, transmises seulement à la police si elle le demande.',
  enSavoirPlus: 'En savoir plus',
  confidentialite:
    'Ces informations servent seulement à préparer votre arrivée. Les fiches de police sont gardées 6 mois, comme la loi le demande, puis effacées. Elles ne sont transmises qu’à la police ou à la gendarmerie, si elles le demandent.',
  signature: 'En envoyant, vous certifiez ces informations exactes.',
  envoyer: 'Envoyer',
  annuler: 'Annuler',
  merci: 'Merci, c’est noté.',
  verifier: 'Vérifiez les champs signalés.',

  accesTitre: 'Accès et wifi',
  codeAttente: 'Code communiqué dans les 48 heures avant l’arrivée',
  codeAttenteDate: (d: string) => `Il s’affichera ici à partir du ${d}.`,
  accesJourDepart: 'Jour du départ : le code reste celui de votre arrivée.',
  // Remplace « code 4821 » en entier (CODE_RETIRE mange le mot « code ») : aucun crochet pour le voyageur.
  codeArrivee: 'code : le même qu’à votre arrivée',
  wifi: 'Wifi',
  reseau: 'Réseau',
  motDePasse: 'Mot de passe',
  copier: 'Copier',
  copie: 'Copié',

  adresseTitre: 'Adresse',
  itineraire: 'Itinéraire',
  parking: 'Parking',
  transports: 'Venir en transports',

  reglesTitre: 'Règlement intérieur',
  fetes: (oui: boolean): string => (oui ? 'Fêtes autorisées' : 'Fêtes interdites'),
  fumeur: (oui: boolean): string => (oui ? 'Fumeurs acceptés' : 'Logement non-fumeur'),
  animaux: (oui: boolean): string => (oui ? 'Animaux acceptés' : 'Animaux non acceptés'),
  calme: (debut: string, fin: string) => `Calme de ${debut} à ${fin}`,

  aSavoirTitre: 'À savoir',
  questionsTitre: 'Questions fréquentes',
  guidesTitre: 'Guides',
  typesGuide: { video: 'Vidéo', photo: 'Photo', document: 'Document', lien: 'Lien' } as Record<GuideSejour['type'], string>,

  departTitre: 'Départ',
  departDefaut: 'Laissez les clés comme à votre arrivée.',

  aideTitre: 'Une question ?',
  aidePlateforme: (p: string) => `Écrivez-nous dans la messagerie ${p} : nous répondons vite.`,
  ouvrir: (p: string) => `Ouvrir ${p}`,
  aideDirect: 'Écrivez-nous ou appelez-nous.',
  appeler: 'Appeler',
  ecrireEmail: 'Écrire un e-mail',
  lienPerso: 'Ce lien est personnel : ne le partagez pas.',
  confidentialiteLien: 'Confidentialité',

  chargement: 'Chargement de votre séjour…',
  erreurReseau: 'Pas de connexion. Vérifiez votre réseau, puis réessayez.',
  erreur: 'Une erreur est survenue. Réessayez dans un instant.',
  reessayer: 'Réessayer',
  lienIncomplet: 'Ce lien est incomplet. Ouvrez le lien reçu dans votre messagerie de réservation.',
  lienExpire: 'Ce lien a expiré.',
  votreLogement: 'Votre logement',
  codeMasque: CODE_MASQUE,
};

const EN: typeof FR = {
  titrePage: 'Your stay',
  langue: 'Français',
  langueCode: 'FR',
  bonjour: (p: string) => (p ? `Hello ${p}` : 'Hello'),
  arrivee: 'Check-in',
  depart: 'Check-out',
  des: (h: string) => `from ${h}`,
  avant: (h: string) => `before ${h}`,
  nuits: (n: number) => pluriel(n, 'night', 'nights'),
  voyageurs: (n: number) => pluriel(n, 'guest', 'guests'),
  apres: 'Thank you for staying with us.',

  checkinTitre: 'Online check-in',
  checkinAFaire: 'Two minutes to get your arrival ready.',
  checkinEnCours: 'Your check-in is still missing: two minutes.',
  checkinFait: 'Check-in done',
  checkinEnvoye: (d: string) => `Sent on ${d}.`,
  faireCheckin: 'Start check-in',
  modifier: 'Edit',
  heureArrivee: 'Estimated arrival time',
  heureArriveeSurPlace: 'Arrival time',
  nbVoyageurs: 'Number of guests',
  nationaliteQuestion: 'Guests’ nationality',
  tousFrancais: 'All French',
  etrangers: 'At least one non-French guest',
  ficheExplication: 'One form per non-French guest aged 15 or over, no ID document needed.',
  voyageurN: (n: number) => `Guest ${n}`,
  nom: 'Last name',
  prenoms: 'First name(s)',
  naissanceLe: 'Date of birth',
  naissanceLieu: 'Place of birth',
  naissanceLieuAide: 'City and country.',
  nationalite: 'Nationality',
  domicile: 'Home address',
  enfants: 'Children under 15',
  enfantsAide: 'On this guest’s form.',
  ajouterVoyageur: 'Add a guest',
  retirer: 'Remove',
  fichesGardees: (n: number) => `${pluriel(n, 'form already sent', 'forms already sent')}. For your privacy, they are not shown again here.`,
  remplirDeNouveau: 'Fill them in again',
  garderFiches: 'Keep the forms already sent',
  accepte: 'I have read and accept the house rules.',
  voirReglement: 'See the house rules',
  confidentialiteCourte: 'Kept for 6 months, only shared with the police if they ask.',
  enSavoirPlus: 'Learn more',
  confidentialite:
    'This information is only used to prepare your arrival. Police forms are kept for 6 months, as French law requires, then deleted. They are only shared with the police, if they ask for them.',
  signature: 'By sending, you confirm this information is correct.',
  envoyer: 'Send',
  annuler: 'Cancel',
  merci: 'Thank you, all set.',
  verifier: 'Please check the highlighted fields.',

  accesTitre: 'Access and wifi',
  codeAttente: 'Your access code will appear here 48 hours before arrival',
  codeAttenteDate: (d: string) => `From ${d}.`,
  accesJourDepart: 'Check-out day: use the same code as on arrival.',
  codeArrivee: 'code: the same as on arrival',
  wifi: 'Wifi',
  reseau: 'Network',
  motDePasse: 'Password',
  copier: 'Copy',
  copie: 'Copied',

  adresseTitre: 'Address',
  itineraire: 'Directions',
  parking: 'Parking',
  transports: 'Public transport',

  reglesTitre: 'House rules',
  fetes: (oui: boolean) => (oui ? 'Parties allowed' : 'No parties'),
  fumeur: (oui: boolean) => (oui ? 'Smoking allowed' : 'No smoking'),
  animaux: (oui: boolean) => (oui ? 'Pets allowed' : 'No pets'),
  calme: (debut: string, fin: string) => `Quiet hours ${debut}–${fin}`,

  aSavoirTitre: 'Good to know',
  questionsTitre: 'FAQs',
  guidesTitre: 'Guides',
  typesGuide: { video: 'Video', photo: 'Photo', document: 'Document', lien: 'Link' } as Record<GuideSejour['type'], string>,

  departTitre: 'Check-out',
  departDefaut: 'Leave the keys as you found them on arrival.',

  aideTitre: 'Any question?',
  aidePlateforme: (p: string) => `Message us in the ${p} app: we reply fast.`,
  ouvrir: (p: string) => `Open ${p}`,
  aideDirect: 'Write to us or call us.',
  appeler: 'Call',
  ecrireEmail: 'Send an email',
  lienPerso: 'This link is personal: please do not share it.',
  confidentialiteLien: 'Privacy',

  chargement: 'Loading your stay…',
  erreurReseau: 'No connection. Check your network, then try again.',
  erreur: 'Something went wrong. Please try again in a moment.',
  reessayer: 'Try again',
  lienIncomplet: 'This link is incomplete. Open the link from your booking messages.',
  lienExpire: 'This link has expired.',
  votreLogement: 'Your accommodation',
  codeMasque: '[code shared within 48 hours before arrival]',
};

export const TEXTES: Record<LangueSejour, typeof FR> = { fr: FR, en: EN };

export type TextesSejour = typeof FR;

/** Date longue dans la langue du voyageur : « vendredi 30 octobre », « Friday 30 October ». */
export function dateLongueSejour(date: string, langue: LangueSejour): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  return new Intl.DateTimeFormat(langue === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

/** Date courte : « ven. 30 oct. », « Fri 30 Oct ». */
export function dateCourteSejour(date: string, langue: LangueSejour): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  return new Intl.DateTimeFormat(langue === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

/** Jour d'un horodatage, à Paris : « 12 octobre ». */
export function jourHorodatage(h: string, langue: LangueSejour): string {
  const t = Date.parse(h);
  if (!Number.isFinite(t)) return '';
  return new Intl.DateTimeFormat(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(new Date(t));
}

/** Texte de la fiche affiché : le code retiré (« [code communiqué…] ») dit dans la langue du voyageur. */
export const texteFiche = (t: string, langue: LangueSejour): string => (langue === 'fr' ? t : t.split(CODE_MASQUE).join(TEXTES.en.codeMasque));

/** Le code retiré, avec ce qui le précède : le mot « code » (« code : [code communiqué…] »), deux-points ou espace. */
const CODE_RETIRE = new RegExp(`((?<![\\p{L}])codes?\\s*:?\\s*|\\s*:\\s*|\\s+)?${CODE_MASQUE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'giu');

/**
 * Consignes de départ : le code retiré est celui de l'arrivée.
 * « Laissez les clés dans la boîte, code 4821. » devient « Laissez les clés
 * dans la boîte, code : le même qu’à votre arrivée. » ; « Boîte à clés :
 * 4821 » devient « Boîte à clés, code : le même qu’à votre arrivée ».
 */
export const texteConsignes = (t: string, langue: LangueSejour): string =>
  t.replace(CODE_RETIRE, (_tout: string, avant: string | undefined, position: number, entier: string) => {
    const c = TEXTES[langue].codeArrivee;
    if (avant && /code/i.test(avant)) return c;
    // Juste après un mot : une virgule (« la boîte, code : … ») ; sinon l'espace d'avant est gardé.
    return /[\p{L}\p{N}]/u.test(entier.slice(0, position).slice(-1)) ? `, ${c}` : `${avant && /^\s/.test(avant) ? ' ' : ''}${c}`;
  });
