/**
 * Publication automatique des avis (octobre 2026, comme Smoobu) : règles
 * pures, partagées par le serveur (avis-auto-passage.ts) et les écrans
 * (Logements → Avis, fiche du séjour, Accueil).
 *
 * Exception décidée par le gérant de Label Maison, LIMITÉE AUX AVIS : l'ERP
 * reste en lecture seule pour les prix, le calendrier, les disponibilités et
 * les annonces (ecritureRepullPermise, repull-synchro.ts).
 *
 * Deux réglages par espace, éteints par défaut, changés par un gérant
 * (reglages/messages-programmes, avisAuto : élément déjà réservé aux gérants
 * par la base) :
 *
 * 1. « Avis sur les voyageurs : publication automatique » (Airbnb seulement,
 *    la seule plateforme où l'hôte note le voyageur) : deux jours après le
 *    départ, et tant que le délai d'Airbnb (14 jours) n'est pas passé, l'avis
 *    est rédigé (même rédaction que « Votre avis sur le voyageur », dans la
 *    langue du voyageur) et publié avec 5 étoiles et « je recommande ».
 *    Un séjour sensible n'est JAMAIS publié seul : il va dans « À valider »
 *    (raisonsAvisSensible) — incident, contrôle à revoir, note basse, échange
 *    sensible ou conversation transmise, litige ou remboursement, séjour du
 *    propriétaire, rédaction en panne, texte qui contient un contact, un
 *    lien, un chiffre ou un code.
 *
 * 2. « Réponses aux avis : publication automatique » (Airbnb, Booking.com) :
 *    la réponse est rédigée comme « Proposer une réponse » (avis.ts,
 *    avis-serveur.ts) et publiée seule SEULEMENT pour un avis positif : note
 *    de 4 sur 5 au moins ET lecture « Positif » (analyse des avis : une note
 *    sous 4,6 est au mieux « Mitigé »), aucun point négatif, ni dans la partie
 *    publique ni dans le message privé, aucune réclamation. Le reste va dans
 *    « À valider » (Publier, Modifier, Ne pas répondre).
 *
 * Jamais deux fois : une publication est marquée « en cours » avant l'envoi,
 * la plateforme refuse un second avis (409 review_already_submitted) et une
 * seconde réponse ; un avis déjà en ligne est noté tel quel.
 *
 * Module pur, sans date système ; imports en « .js » : il tourne aussi côté
 * serveur (Node, ESM).
 */
import { libelleTheme, problemesReponse, sansReponse, type AvisLu } from './avis.js';
import { masquerCoordonnees } from './masquage.js';
import { consigneCachee, langueFil, masquerCodes, nettoyerTexte, sujetSensibleMessages } from './messagerie-ia.js';
import {
  ID_REGLAGES_PROGRAMMES,
  JOURS_AVIS,
  PAR_MESSAGE_AUTO,
  ajouterJoursISO,
  alerteTexteAvis,
  avisATraiter,
  contientEloge,
  dateParisDe,
  heureParisDe,
  raisonsARelire,
  type AvisEnFile,
} from './messages-programmes.js';
import type { RepullReview } from './repull.js';
import type { DateISO, ErpDonnees, FilMessages, Horodatage, Id, Incident, Logement, Proprietaire, Reglage, Reservation } from './types';
import type { ControleQualite } from './types-operations';
import type {
  AvisADeposer,
  PublicationAvis,
  ReglageAvisAuto,
  ReglagesAvisAuto,
  ReglagesMessagesProgrammes,
  ReponseAvisAuto,
  StatutPublication,
} from './types-programmes';

/* ============================================================ constantes */

/** Réponses aux avis publiées par l'ERP (une par réservation), écrites par le serveur et le gérant. */
export const COLLECTION_REPONSES_AVIS = 'reponsesAvis';
/** État du passage des avis (collection serveur « programmes ») : jour, essais. */
export const ID_ETAT_AVIS_AUTO = 'avis-auto';
/** Qui a publié, quand ce n'est pas un gérant (journal, fiche du séjour). */
export const PAR_PUBLICATION_AUTO = 'Publication automatique';

/** L'avis sur le voyageur part ce nombre de jours après le départ (comme Smoobu). */
export const JOURS_AVANT_AVIS_AUTO = 2;
/** Note donnée au voyageur (propreté, communication, respect du règlement). */
export const NOTE_AVIS_AUTO = 5;
/** Réponse publiée seule : note de l'avis au moins égale (sur 5)… */
export const NOTE_MIN_REPONSE_AUTO = 4;
/** …pour un avis écrit il y a moins de ce nombre de jours (un vieil avis sans réponse reste à l'équipe). */
export const JOURS_REPONSE_AUTO = 30;
/** Avis sur le voyageur pas encore publié dans les derniers jours du délai : l'équipe le dépose elle-même (filet). */
export const JOURS_SECOURS_MANUEL = 2;
/** Le passage des avis tourne une fois par jour, à partir de cette heure (Paris), jamais après 21 h. */
export const HEURE_AVIS_AUTO = '10:00';
export const HEURE_FIN_AVIS_AUTO = '21:00';
/** Un passage incomplet (temps, part d'appels) est repris au plus ce nombre de fois dans la journée, une heure après. */
export const ESSAIS_AVIS_AUTO = 4;
const HEURE_MS = 3_600_000;

/** Statuts définitifs : plus rien à faire automatiquement. */
const FINAUX: ReadonlySet<StatutPublication> = new Set(['publie', 'refuse', 'expire', 'sans_objet']);
export const publicationFinale = (p: Pick<PublicationAvis, 'statut'> | undefined): boolean => !!p && FINAUX.has(p.statut);

/* ============================================================== réglages */

const eteint = (): ReglageAvisAuto => ({ actif: false });

function lireReglage(v: unknown): ReglageAvisAuto {
  if (!v || typeof v !== 'object') return eteint();
  const x = v as Partial<ReglageAvisAuto>;
  // Allumé seulement si c'est écrit noir sur blanc, avec l'heure de l'allumage.
  const actif = x.actif === true && typeof x.activeLe === 'string' && !!x.activeLe;
  return { actif, ...(actif ? { activeLe: x.activeLe } : {}), ...(typeof x.majPar === 'string' ? { majPar: x.majPar } : {}) };
}

/** Réglages de l'espace, éteints tant qu'un gérant ne les a pas allumés. */
export function reglagesAvisAuto(d: { reglages?: readonly Reglage[] }): ReglagesAvisAuto {
  const stocke = (d.reglages ?? []).find((r): r is ReglagesMessagesProgrammes => r?.id === ID_REGLAGES_PROGRAMMES);
  return { voyageurs: lireReglage(stocke?.avisAuto?.voyageurs), reponses: lireReglage(stocke?.avisAuto?.reponses) };
}

export const allume = (r: ReglageAvisAuto | undefined): boolean => r?.actif === true && !!r.activeLe;

/**
 * Réglages des messages automatiques avec un réglage d'avis changé (le reste
 * tel quel). Un réglage éteint perd son heure d'allumage.
 */
export function avecAvisAuto(
  reglages: ReglagesMessagesProgrammes,
  cle: keyof ReglagesAvisAuto,
  actif: boolean,
  o: { par: string; le: Horodatage },
): ReglagesMessagesProgrammes {
  const avant = reglagesAvisAuto({ reglages: [reglages as Reglage] });
  const suivant: ReglageAvisAuto = actif ? { actif: true, activeLe: avant[cle].actif ? avant[cle].activeLe : o.le, majPar: o.par } : { actif: false, majPar: o.par };
  return { ...reglages, avisAuto: { ...avant, [cle]: suivant }, majLe: o.le, majPar: o.par };
}

/** Explication d'une ligne de réglage, en une phrase. */
export const EXPLICATIONS_AVIS_AUTO: Record<keyof ReglagesAvisAuto, { titre: string; phrase: string }> = {
  voyageurs: {
    titre: 'Avis sur les voyageurs : publication automatique',
    phrase: 'Sur Airbnb, deux jours après le départ, avec 5 étoiles. Un séjour avec un souci attend votre accord.',
  },
  reponses: {
    titre: 'Réponses aux avis : publication automatique',
    phrase: 'Sur Airbnb et Booking.com, seulement sous les avis positifs. Les autres attendent votre accord.',
  },
};

/* ===================================================== passage du jour */

export interface EtatAvisAuto {
  id: typeof ID_ETAT_AVIS_AUTO;
  /** Jour (Paris) du dernier passage. */
  jour?: DateISO;
  /** Tout ce qui était dû ce jour-là a été traité. */
  complet?: boolean;
  essais?: number;
  dernierEssai?: Horodatage;
}

/**
 * Le passage des avis est-il dû ? Une fois par jour à partir de 10 h (Paris),
 * jamais après 21 h ; repris une heure après un passage incomplet, quatre
 * fois au plus dans la journée.
 */
export function passageAvisDu(etat: EtatAvisAuto | undefined, maintenant: Date): boolean {
  const hm = heureParisDe(maintenant);
  if (hm < HEURE_AVIS_AUTO || hm >= HEURE_FIN_AVIS_AUTO) return false;
  if (!etat || etat.jour !== dateParisDe(maintenant)) return true;
  if (etat.complet) return false;
  const dernier = Date.parse(etat.dernierEssai ?? '');
  return (etat.essais ?? 0) < ESSAIS_AVIS_AUTO && (!Number.isFinite(dernier) || maintenant.getTime() - dernier >= HEURE_MS);
}

/* ============================================ avis sur les voyageurs */

const joursEntre = (a: DateISO, b: DateISO) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * hors : pas d'avis de l'hôte (pas Airbnb, réservation annulée) ; trop_tot :
 * moins de deux jours après le départ ; ouverte : à publier ; passee : délai
 * d'Airbnb dépassé (14 jours après le départ).
 */
export type FenetreAvis = 'hors' | 'trop_tot' | 'ouverte' | 'passee';

export function fenetreAvisVoyageur(r: Pick<Reservation, 'canal' | 'statut' | 'depart'>, aujourdhui: DateISO): FenetreAvis {
  if (r.canal !== 'airbnb' || r.statut === 'annulee' || !/^\d{4}-\d{2}-\d{2}$/.test(r.depart ?? '')) return 'hors';
  const jours = joursEntre(r.depart, aujourdhui);
  if (jours < JOURS_AVANT_AVIS_AUTO) return 'trop_tot';
  return jours > JOURS_AVIS ? 'passee' : 'ouverte';
}

/** Jour où l'avis part de lui-même (deux jours après le départ). */
export const jourPublicationAuto = (depart: DateISO): DateISO => ajouterJoursISO(depart, JOURS_AVANT_AVIS_AUTO);

export type DecisionAvisVoyageur =
  /** À rédiger, puis publier ou garder pour le gérant (reprise d'un envoi coupé comprise). */
  | { genre: 'preparer' }
  /** Pas encore (moins de deux jours après le départ). */
  | { genre: 'attendre' }
  /** Délai d'Airbnb passé sans publication. */
  | { genre: 'expirer' }
  /** Rien à faire (pas Airbnb, décision déjà prise, déjà déposé, réglage éteint). */
  | { genre: 'rien' };

/**
 * Que faire de l'avis de ce séjour, maintenant ? Une ligne déjà traitée par
 * l'équipe (« C’est fait », « Passer »), publiée, refusée, à valider ou en
 * échec n'est jamais reprise : la décision reste à l'équipe.
 */
export function deciderAvisVoyageur(
  r: Pick<Reservation, 'canal' | 'statut' | 'depart'>,
  avis: Pick<AvisADeposer, 'statut' | 'publication'> | undefined,
  aujourdhui: DateISO,
  reglage: ReglageAvisAuto,
): DecisionAvisVoyageur {
  if (!allume(reglage)) return { genre: 'rien' };
  const f = fenetreAvisVoyageur(r, aujourdhui);
  if (f === 'hors') return { genre: 'rien' };
  if (avis && (avis.statut === 'fait' || avis.statut === 'passe')) return { genre: 'rien' };
  const p = avis?.publication;
  if (p && p.statut !== 'en_cours') return f === 'passee' && p.statut === 'a_valider' ? { genre: 'expirer' } : { genre: 'rien' };
  if (f === 'trop_tot') return { genre: 'attendre' };
  if (f === 'passee') return p?.statut === 'en_cours' ? { genre: 'expirer' } : { genre: 'rien' };
  return { genre: 'preparer' };
}

/** Le séjour est-il celui du propriétaire (montant nul, ou réservé à son nom) ? */
export function sejourDuProprietaire(
  r: Pick<Reservation, 'logementId' | 'voyageur' | 'montantBrutCentimes'>,
  d: { logements?: readonly Pick<Logement, 'id' | 'proprietaireId'>[]; proprietaires?: readonly Pick<Proprietaire, 'id' | 'nom'>[] },
): boolean {
  if (r.montantBrutCentimes === 0) return true;
  const proprietaireId = (d.logements ?? []).find((l) => l.id === r.logementId)?.proprietaireId;
  const p = proprietaireId ? (d.proprietaires ?? []).find((x) => x.id === proprietaireId) : undefined;
  const mots = (t: string | undefined) =>
    String(t ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^a-z]+/)
      .filter((m) => m.length >= 2 && !['m', 'mme', 'mr', 'mrs', 'sci', 'sas', 'sarl', 'et', 'de', 'du', 'la', 'le'].includes(m));
  const voyageur = mots(r.voyageur?.nom);
  const proprio = new Set(mots(p?.nom));
  // Même nom de famille (le dernier mot du voyageur) et même prénom quand il est donné : le propriétaire lui-même.
  const nom = voyageur[voyageur.length - 1];
  return !!nom && voyageur.length >= 2 && proprio.has(nom) && proprio.has(voyageur[0]);
}

/** Statut de la plateforme qui dit un litige, un remboursement ou une réclamation. */
const LITIGE_PLATEFORME = /dispute|claim|refund|chargeback|r[ée]clam|rembours|litige/i;

const LIBELLE_SENSIBLE: Record<string, string> = {
  argent: 'argent, remboursement ou annulation',
  litige: 'réclamation ou problème sur place',
  autre: 'données personnelles',
};

export interface SignauxSejour {
  incidents?: readonly Incident[];
  controles?: readonly ControleQualite[];
  filsMessages?: readonly FilMessages[];
  logements?: readonly Pick<Logement, 'id' | 'proprietaireId'>[];
  proprietaires?: readonly Pick<Proprietaire, 'id' | 'nom'>[];
}

/**
 * Pourquoi l'avis sur ce voyageur ne part pas seul (vide : rien ne s'y
 * oppose). Les règles de « Votre avis sur le voyageur » (incident, note
 * basse, contrôle à revoir, conversation transmise pour un litige ou de
 * l'argent, message négatif), plus : conversation confiée à l'équipe, sujet
 * sensible dans les messages du voyageur pendant ou après le séjour (mêmes
 * règles que l'agent : argent, annulation, réclamation, problème sur place,
 * données personnelles), litige ou remboursement chez la plateforme, séjour
 * du propriétaire.
 */
export function raisonsAvisSensible(
  r: Pick<Reservation, 'id' | 'logementId' | 'arrivee' | 'depart' | 'noteVoyageur' | 'voyageur' | 'montantBrutCentimes' | 'repull'>,
  d: SignauxSejour,
): string[] {
  const raisons = raisonsARelire(r, d);
  const fils = (d.filsMessages ?? []).filter((f) => f.reservationId === r.id);
  if (fils.some((f) => f.statut === 'escalade') && !raisons.some((x) => /Conversation transmise/.test(x))) raisons.push('Conversation confiée à l’équipe');
  // Messages du voyageur de la veille de l'arrivée à aujourd'hui (pas les questions d'avant la réservation).
  const depuis = ajouterJoursISO(r.arrivee, -1);
  const textes = fils.flatMap((f) => f.messages).filter((m) => m.auteur === 'voyageur' && m.envoi?.par !== PAR_MESSAGE_AUTO && m.envoyeLe.slice(0, 10) >= depuis).map((m) => m.texte);
  const sensible = textes.length ? sujetSensibleMessages(textes) : null;
  if (sensible) raisons.push(`Échange sensible avec le voyageur (${LIBELLE_SENSIBLE[sensible.raison] ?? 'à vérifier'})`);
  if (LITIGE_PLATEFORME.test(`${r.repull?.statut ?? ''} ${r.repull?.statutDetail ?? ''}`)) raisons.push('Litige ou remboursement signalé par la plateforme');
  if (sejourDuProprietaire(r, d)) raisons.push('Séjour du propriétaire');
  return [...new Set(raisons)];
}

/** Langue du voyageur pour son avis : celle de sa conversation, sinon le français. */
export function langueVoyageur(r: Pick<Reservation, 'id'>, fils: readonly FilMessages[]): string {
  const fil = fils
    .filter((f) => f.reservationId === r.id)
    .sort((a, b) => Number(!!b.repull?.id) - Number(!!a.repull?.id) || b.dernierMessageLe.localeCompare(a.dernierMessageLe))[0];
  return (fil && langueFil(fil)) || 'fr';
}

/**
 * Ce qu'un texte d'avis public ne doit jamais contenir, en clair (vide : il
 * peut partir). Contact, lien, chiffre, adresse, code d'accès ou wifi, nom de
 * famille du voyageur, promesse d'argent, consigne cachée ; texte vide ou
 * trop long.
 */
export function problemesTexteAvis(texte: string, ctx: { nomVoyageur?: string; logement?: Pick<Logement, 'adresse' | 'fiche' | 'descriptif'> } = {}): string[] {
  const t = String(texte ?? '').trim();
  if (!t) return ['aucun texte'];
  const raisons: string[] = [];
  if (t.length > 1000) raisons.push('plus de 1 000 caractères');
  if (alerteTexteAvis(t)) raisons.push('un lien, une adresse, un chiffre ou un e-mail');
  raisons.push(...problemesReponse(t, { nomVoyageur: ctx.nomVoyageur, ...(ctx.logement ? { logement: ctx.logement } : {}) }));
  const propre = nettoyerTexte(t);
  if (masquerCoordonnees(propre) !== propre) raisons.push('des coordonnées');
  if (masquerCodes(propre) !== propre) raisons.push('un code');
  return [...new Set(raisons)];
}

export type VerdictAvis = { publier: true } | { publier: false; raisons: string[]; texte: string };

/**
 * Après la rédaction : publier, ou garder pour le gérant. `raisons` : celles
 * du séjour (raisonsAvisSensible) et celles notées par l'IA ; `panne` : la
 * rédaction n'a pas abouti. Un séjour sensible n'est jamais proposé avec un
 * éloge (le texte proposé est vide : le gérant l'écrit).
 */
export function verdictAvisVoyageur(e: { raisons: readonly string[]; texte: string; problemes: readonly string[]; panne?: string }): VerdictAvis {
  const raisons = [...e.raisons];
  if (e.panne) raisons.push(e.panne);
  if (e.problemes.length) raisons.push(`Le texte contient ${e.problemes.join(', ')} : à vérifier`);
  if (!raisons.length) return { publier: true };
  const souci = e.raisons.length > 0;
  return { publier: false, raisons: [...new Set(raisons)], texte: souci && contientEloge(e.texte) ? '' : e.texte };
}

/* ============================================ réponses aux avis */

/** Réclamation dans un avis (« plainte », « remboursement », « police »…), en plus de l'analyse des avis. */
const RECLAMATION_AVIS = /r[ée]clamation|litige|plainte|inacceptable|arnaque|escroquer|avocat|police|rembours|dédommag|dedommag|scam|refund|unacceptable|lawyer|dispute|compensation/i;

/** Plateformes où l'ERP publie une réponse. */
export const PLATEFORMES_REPONSE = ['airbnb', 'booking'] as const;

/**
 * Pourquoi la réponse à cet avis ne part pas seule (vide : avis positif, elle
 * peut partir) : note absente ou sous 4, lecture « Mitigé » ou « Négatif »,
 * point à revoir (public ou privé), réclamation, consigne cachée.
 */
export function raisonsReponseAValider(a: AvisLu): string[] {
  const raisons: string[] = [];
  if (a.note === undefined) raisons.push('Avis sans note');
  else if (a.note < NOTE_MIN_REPONSE_AUTO) raisons.push(`Note de ${String(a.note).replace('.', ',')} sur 5`);
  if (a.sentiment === 'negatif') raisons.push('Avis négatif');
  else if (a.sentiment === 'neutre') raisons.push('Avis mitigé');
  const publics = a.themes.filter((t) => !t.prive && t.sentiment === 'negatif');
  if (publics.length) raisons.push(`Point à revoir : ${publics.map((t) => libelleTheme(t.cle).toLowerCase()).join(', ')}`);
  if (a.themes.some((t) => t.prive && t.sentiment === 'negatif')) raisons.push('Le message privé signale un point à revoir');
  if (RECLAMATION_AVIS.test(`${a.textePublic}\n${a.textePrive}`)) raisons.push('L’avis parle d’une réclamation ou d’un remboursement');
  if (consigneCachee(`${a.textePublic}\n${a.textePrive}`)) raisons.push('L’avis contient des consignes inhabituelles');
  return [...new Set(raisons)];
}

/** Avis positif : sa réponse peut partir seule. */
export const avisPositif = (a: AvisLu): boolean => !sansReponse(a) && raisonsReponseAValider(a).length === 0;

/** Plateforme d'un avis lu chez notre service de connexion (« booking.com » → booking). */
export function plateformeAvis(p: unknown): string {
  const s = String(p ?? '').trim().toLowerCase();
  return s.startsWith('booking') ? 'booking' : s;
}

/** L'avis a-t-il déjà une réponse de l'hôte ? */
export const avisRepondu = (a: Pick<RepullReview, 'response'>): boolean => !!a.response && (typeof a.response !== 'object' || !!String(a.response.body ?? '').trim() || !!a.response.submittedAt);
/** L'avis de l'hôte sur le voyageur est-il déjà déposé ? */
export const avisDepose = (a: Pick<RepullReview, 'submittedAt' | 'publicReview'>): boolean => !!a.submittedAt || !!String(a.publicReview ?? '').trim();

/**
 * Un avis de voyageur à traiter : Airbnb ou Booking.com, sans réponse, écrit
 * il y a moins de 30 jours (à défaut de date : séjour terminé depuis moins de
 * 45 jours), pas déjà décidé dans l'ERP.
 */
export function reponseADecider(
  a: Pick<RepullReview, 'platform' | 'reviewerRole' | 'response' | 'submittedAt'>,
  r: Pick<Reservation, 'depart' | 'statut' | 'canal'>,
  ligne: Pick<ReponseAvisAuto, 'publication'> | undefined,
  maintenant: Date,
): boolean {
  if (a.reviewerRole && a.reviewerRole !== 'guest') return false;
  if (!(PLATEFORMES_REPONSE as readonly string[]).includes(plateformeAvis(a.platform))) return false;
  if (r.statut === 'annulee' || avisRepondu(a)) return false;
  if (ligne && ligne.publication.statut !== 'en_cours') return false;
  const ecrit = Date.parse(a.submittedAt ?? '');
  if (Number.isFinite(ecrit)) return maintenant.getTime() - ecrit <= JOURS_REPONSE_AUTO * 86_400_000;
  return joursEntre(r.depart, dateParisDe(maintenant)) <= JOURS_REPONSE_AUTO + 15;
}

/* ================================================ lien avis ↔ séjour */

/**
 * Séjour de l'ERP d'un avis lu chez notre service de connexion : par
 * l'identifiant de la réservation, sinon par son code de confirmation.
 */
export function indexSejours(reservations: readonly Reservation[]): (a: Pick<RepullReview, 'reservationId' | 'reservationConfirmationCode'>) => Reservation | undefined {
  const parId = new Map<string, Reservation>();
  const parCode = new Map<string, Reservation>();
  for (const r of reservations) {
    if (r.repull?.id) parId.set(String(r.repull.id), r);
    if (r.id.startsWith('repull-') && !parId.has(r.id.slice(7))) parId.set(r.id.slice(7), r);
    if (r.repull?.code) parCode.set(r.repull.code, r);
  }
  return (a) => (a.reservationId ? parId.get(String(a.reservationId)) : undefined) ?? (a.reservationConfirmationCode ? parCode.get(String(a.reservationConfirmationCode)) : undefined);
}

/* ========================================================== écrans */

export interface ElementAValider {
  genre: 'voyageur' | 'reponse';
  /** Réservation du séjour. */
  reservationId: Id;
  logementId: Id;
  /** Prénom du voyageur. */
  voyageur: string;
  texte: string;
  raisons: string[];
  /** Avis sur le voyageur : jours qui restent avant la fin du délai d'Airbnb. */
  joursRestants?: number;
  /** Réponse : note et texte public de l'avis. */
  note?: number;
  avis?: string;
  canal: Reservation['canal'];
  le: Horodatage;
}

/**
 * Ce qui attend le gérant : avis sur les voyageurs gardés (séjour sensible),
 * encore dans le délai d'Airbnb, puis réponses gardées (avis pas positif) ;
 * les plus pressés d'abord.
 */
export function avisAValider(d: Pick<ErpDonnees, 'reservations' | 'avisADeposer'> & { reponsesAvis?: readonly ReponseAvisAuto[] }, aujourdhui: DateISO): ElementAValider[] {
  const parId = new Map(d.reservations.map((r) => [r.id, r]));
  const voyageurs = (d.avisADeposer ?? [])
    .filter((a) => a.publication?.statut === 'a_valider' && a.statut !== 'fait' && a.statut !== 'passe')
    .map((a) => ({ a, r: parId.get(a.reservationId) }))
    .filter((x): x is { a: AvisADeposer; r: Reservation } => !!x.r && fenetreAvisVoyageur(x.r, aujourdhui) === 'ouverte')
    .sort((x, y) => x.r.depart.localeCompare(y.r.depart))
    .map(
      ({ a, r }): ElementAValider => ({
        genre: 'voyageur',
        reservationId: r.id,
        logementId: r.logementId,
        voyageur: a.voyageur,
        texte: a.publication?.texte ?? '',
        raisons: a.publication?.raisons ?? [],
        joursRestants: Math.max(0, JOURS_AVIS - joursEntre(r.depart, aujourdhui)),
        canal: r.canal,
        le: a.publication!.le,
      }),
    );
  const reponses = (d.reponsesAvis ?? [])
    .filter((x) => x?.publication?.statut === 'a_valider')
    .sort((x, y) => y.publication.le.localeCompare(x.publication.le))
    .map(
      (x): ElementAValider => ({
        genre: 'reponse',
        reservationId: x.reservationId,
        logementId: x.logementId,
        voyageur: x.voyageur,
        texte: x.publication.texte ?? '',
        raisons: x.publication.raisons ?? [],
        ...(x.note !== undefined ? { note: x.note } : {}),
        ...(x.avis ? { avis: x.avis } : {}),
        canal: x.canal,
        le: x.publication.le,
      }),
    );
  return [...voyageurs, ...reponses];
}

/**
 * « Avis à déposer » qui restent à l'équipe (à la main), réglage compris :
 * publication automatique allumée, un séjour n'y figure que si la plateforme
 * a refusé l'avis (echec), ou s'il n'est toujours pas publié dans les deux
 * derniers jours du délai (filet). Un avis à valider est dans « À valider ».
 */
export function avisADeposerEquipe(
  d: Pick<ErpDonnees, 'reservations' | 'avisADeposer' | 'incidents' | 'controles' | 'filsMessages'> & { reglages?: readonly Reglage[] },
  aujourdhui: DateISO,
): AvisEnFile[] {
  const liste = avisATraiter(d, aujourdhui);
  if (!allume(reglagesAvisAuto(d).voyageurs)) return liste;
  return liste.filter((x) => {
    const p = x.avis?.publication;
    if (p?.statut === 'echec') return true;
    if (p) return false;
    return x.joursRestants < JOURS_SECOURS_MANUEL;
  });
}

/** Où en est la publication de l'avis sur ce voyageur, pour la fiche du séjour (null : rien de particulier, la carte habituelle). */
export type EtatPublicationVoyageur =
  | { genre: 'prevue'; le: DateISO; raisons: string[] }
  | { genre: 'a_valider'; publication: PublicationAvis }
  | { genre: 'en_cours' }
  | { genre: 'publiee'; publication: PublicationAvis }
  | { genre: 'refusee'; publication: PublicationAvis }
  | { genre: 'expiree' }
  | { genre: 'echec'; erreur: string };

export function etatPublicationVoyageur(
  r: Reservation,
  avis: AvisADeposer | undefined,
  aujourdhui: DateISO,
  reglages: ReglagesAvisAuto,
  signaux: SignauxSejour,
): EtatPublicationVoyageur | null {
  const p = avis?.publication;
  if (p) {
    if (p.statut === 'publie') return { genre: 'publiee', publication: p };
    if (p.statut === 'refuse') return { genre: 'refusee', publication: p };
    if (p.statut === 'expire') return { genre: 'expiree' };
    if (p.statut === 'en_cours') return { genre: 'en_cours' };
    if (p.statut === 'echec') return { genre: 'echec', erreur: p.erreur ?? 'La plateforme a refusé l’avis.' };
    if (p.statut === 'a_valider') return fenetreAvisVoyageur(r, aujourdhui) === 'passee' ? { genre: 'expiree' } : { genre: 'a_valider', publication: p };
    return null;
  }
  if (!allume(reglages.voyageurs) || (avis && (avis.statut === 'fait' || avis.statut === 'passe'))) return null;
  const f = fenetreAvisVoyageur(r, aujourdhui);
  if (f !== 'trop_tot' && f !== 'ouverte') return null;
  // Filet : pas encore publié dans les derniers jours du délai, l'équipe le dépose elle-même.
  if (f === 'ouverte' && JOURS_AVIS - joursEntre(r.depart, aujourdhui) < JOURS_SECOURS_MANUEL) return null;
  const le = jourPublicationAuto(r.depart);
  return { genre: 'prevue', le: le < aujourdhui ? aujourdhui : le, raisons: raisonsAvisSensible(r, signaux) };
}

/** La réponse à l'avis de ce séjour, publiée ou à valider par l'ERP (undefined : rien). */
export const reponseDuSejour = (d: { reponsesAvis?: readonly ReponseAvisAuto[] }, reservationId: Id): ReponseAvisAuto | undefined =>
  (d.reponsesAvis ?? []).find((x) => x?.reservationId === reservationId);
