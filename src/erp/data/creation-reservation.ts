/**
 * Nouvelle réservation directe (séjour réservé hors plateformes), saisie pas
 * à pas (modules/reservations/_composants/ModalNouvelleReservation.tsx) :
 * le logement, les dates, le voyageur, les montants, puis le récapitulatif.
 *
 * Mêmes règles que l'ancien formulaire, écran par écran : un logement actif,
 * pas d'arrivée dans le passé, départ après l'arrivée, aucun chevauchement
 * avec une réservation du logement (surbooking refusé, `conflits`), nombre de
 * voyageurs dans la capacité, montants en centimes (ménage par défaut : celui
 * du mandat), statut selon les dates (`statutSelonDates`).
 *
 * L'ERP ne modifie pas les calendriers des plateformes : les dates se
 * bloquent aussi à la main sur Airbnb et Booking.com (rappel du récapitulatif).
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */
import { ajouterJours, ecartJours, euros, pluriel, versCentimes } from './format';
import { dateLisible } from './parcours-assistant';
import { mandatAuJour } from './selectors';
import { conflits, statutSelonDates, type Conflit } from '../modules/reservations/_composants/outils';
import type { Centimes, DateISO, Id, Logement, Mandat, Reservation } from './types';

/** Les écrans, dans l'ordre : une question par écran, puis le récapitulatif. */
export const ECRANS_RESERVATION = ['logement', 'dates', 'voyageur', 'montants', 'recapitulatif'] as const;
export type EcranReservation = (typeof ECRANS_RESERVATION)[number];

/** Réponses de l'assistant (rien n'est enregistré avant « Créer la réservation »). */
export interface BrouillonReservation {
  logementId: Id;
  arrivee: DateISO | '';
  depart: DateISO | '';
  nom: string;
  pays: string;
  nbPersonnes: number;
  /** Prix des nuits, en euros tels que tapés (« 360 », « 412,50 »). */
  hebergement: string;
  /** Frais de ménage en euros ; vide : ceux du mandat. */
  menage: string;
}

/** Valeurs de départ, comme l'ancien formulaire : arrivée dans 7 jours, départ dans 10, deux voyageurs, France. */
export function brouillonReservation(aujourdhui: DateISO): BrouillonReservation {
  return {
    logementId: '',
    arrivee: ajouterJours(aujourdhui, 7),
    depart: ajouterJours(aujourdhui, 10),
    nom: '',
    pays: 'France',
    nbPersonnes: 2,
    hebergement: '',
    menage: '',
  };
}

/** Un logement se réserve quand il est actif (mandat signé, lancement terminé). */
export const logementsReservables = (logements: readonly Logement[]): Logement[] => logements.filter((l) => l.statut === 'actif');

export interface ContexteReservation {
  logements: readonly Logement[];
  reservations: Reservation[];
  mandats: Mandat[];
  aujourdhui: DateISO;
}

const logementChoisi = (b: BrouillonReservation, ctx: ContexteReservation) => logementsReservables(ctx.logements).find((l) => l.id === b.logementId);

export const datesValides = (b: Pick<BrouillonReservation, 'arrivee' | 'depart'>): boolean => !!b.arrivee && !!b.depart && b.depart > b.arrivee;

/** Nuits du séjour (0 tant que les dates ne vont pas). */
export const nuitsReservation = (b: Pick<BrouillonReservation, 'arrivee' | 'depart'>): number => (datesValides(b) ? ecartJours(b.arrivee, b.depart) : 0);

/** Réservations du logement qui occupent déjà une des nuits demandées (surbooking). */
export function chevauchements(b: BrouillonReservation, ctx: ContexteReservation): Conflit[] {
  const l = logementChoisi(b, ctx);
  return l && datesValides(b) ? conflits(ctx.reservations, l.id, b.arrivee, b.depart) : [];
}

/** Frais de ménage du mandat du logement à l'arrivée (proposés par défaut). */
export function menageDuMandat(b: BrouillonReservation, ctx: ContexteReservation): Centimes | undefined {
  const l = logementChoisi(b, ctx);
  return l ? mandatAuJour(ctx.mandats, l, b.arrivee || ctx.aujourdhui)?.fraisMenageCentimes : undefined;
}

/** Montants en centimes : hébergement tapé, ménage tapé ou celui du mandat (0 sans mandat). NaN : illisible. */
export function montantsReservation(b: BrouillonReservation, ctx: ContexteReservation): { hebergement: Centimes; menage: Centimes } {
  return {
    hebergement: versCentimes(b.hebergement),
    menage: b.menage.trim() === '' ? (menageDuMandat(b, ctx) ?? 0) : versCentimes(b.menage),
  };
}

/** Erreurs sans champ à elles (choix, compteur) : dites au-dessus de « Continuer ». */
export const SANS_CHAMP_RESERVATION = new Set(['logementId', 'nbPersonnes']);

/**
 * Le chevauchement est dit par l'encadré rouge de l'écran des dates (les
 * réservations et les nuits en conflit) : jamais répété au pied, où
 * « Continuer » reste grisé sans autre phrase.
 */
export const ditParLEncadre = (cle: string): boolean => cle === 'conflit';

/**
 * Erreurs d'un écran, par champ, dans l'ordre de l'écran ; vide : « Continuer »
 * est permis. Le récapitulatif réunit celles de tous les écrans.
 */
export function erreursReservation(ecran: EcranReservation, b: BrouillonReservation, ctx: ContexteReservation): Record<string, string> {
  if (ecran === 'recapitulatif') {
    return Object.assign({}, ...ECRANS_RESERVATION.filter((e) => e !== 'recapitulatif').map((e) => erreursReservation(e, b, ctx)));
  }
  const r: Record<string, string> = {};
  const l = logementChoisi(b, ctx);
  if (ecran === 'logement') {
    if (!l) r.logementId = 'Choisissez un logement actif.';
  } else if (ecran === 'dates') {
    if (!b.arrivee) r.arrivee = 'Indiquez la date d’arrivée.';
    else if (b.arrivee < ctx.aujourdhui) r.arrivee = 'L’arrivée ne peut pas être dans le passé.';
    if (!b.depart) r.depart = 'Indiquez la date de départ.';
    else if (!datesValides(b)) r.depart = 'Le départ doit être après l’arrivée.';
    if (chevauchements(b, ctx).length) r.conflit = 'Ces dates chevauchent une réservation existante.';
  } else if (ecran === 'voyageur') {
    if (!b.nom.trim()) r.nom = 'Indiquez le nom du voyageur.';
    else if (b.nom.trim().length < 2) r.nom = 'Le nom compte au moins 2 lettres.';
    if (!Number.isInteger(b.nbPersonnes) || b.nbPersonnes < 1) r.nbPersonnes = 'Au moins 1 personne.';
    else if (l && b.nbPersonnes > l.capacite) r.nbPersonnes = `Capacité maximale : ${pluriel(l.capacite, 'personne')}.`;
  } else if (ecran === 'montants') {
    const m = montantsReservation(b, ctx);
    if (!b.hebergement.trim()) r.hebergement = 'Indiquez le prix des nuits.';
    else if (!Number.isFinite(m.hebergement) || m.hebergement <= 0) r.hebergement = 'Montant d’hébergement requis.';
    if (!Number.isFinite(m.menage) || m.menage < 0) r.menage = 'Montant invalide.';
  }
  return r;
}

/** Écran où se corrige une erreur (clé rendue par erreursReservation). */
export function ecranDeLaCle(cle: string): EcranReservation {
  if (cle === 'logementId') return 'logement';
  if (['arrivee', 'depart', 'conflit'].includes(cle)) return 'dates';
  if (['nom', 'nbPersonnes'].includes(cle)) return 'voyageur';
  if (['hebergement', 'menage'].includes(cle)) return 'montants';
  return 'recapitulatif';
}

export type ResultatReservation = { ok: true; reservation: Reservation } | { ok: false; ecran: EcranReservation; erreur: string };

/**
 * Ce que « Créer la réservation » enregistre : un séjour direct, sans
 * commission, statut selon les dates, montant payé = nuits + ménage. Toutes
 * les règles sont vérifiées à nouveau (une réservation a pu arriver entre-temps).
 */
export function reservationDepuisBrouillon(b: BrouillonReservation, ctx: ContexteReservation & { id: Id }): ResultatReservation {
  const erreurs = Object.entries(erreursReservation('recapitulatif', b, ctx));
  const l = logementChoisi(b, ctx);
  if (erreurs.length || !l || !b.arrivee || !b.depart) {
    const [cle, erreur] = erreurs[0] ?? ['logementId', 'Choisissez un logement actif.'];
    return { ok: false, ecran: ecranDeLaCle(cle), erreur };
  }
  const { hebergement, menage } = montantsReservation(b, ctx);
  return {
    ok: true,
    reservation: {
      id: ctx.id,
      logementId: l.id,
      canal: 'direct',
      voyageur: { nom: b.nom.trim(), pays: b.pays.trim() || undefined, nbPersonnes: b.nbPersonnes },
      arrivee: b.arrivee,
      depart: b.depart,
      nuits: nuitsReservation(b),
      statut: statutSelonDates(b.arrivee, b.depart),
      montantBrutCentimes: hebergement + menage,
      commissionPlateformeCentimes: 0,
      fraisMenageCentimes: menage,
    },
  };
}

/** Lignes du récapitulatif, une par écran. */
export function recapReservation(b: BrouillonReservation, ctx: ContexteReservation): { cle: string; ecran: Exclude<EcranReservation, 'recapitulatif'>; libelle: string; valeur: string }[] {
  const l = logementChoisi(b, ctx);
  const nuits = nuitsReservation(b);
  const m = montantsReservation(b, ctx);
  const montantsLisibles = Number.isFinite(m.hebergement) && m.hebergement > 0 && Number.isFinite(m.menage) && m.menage >= 0;
  return [
    { cle: 'logement', ecran: 'logement', libelle: 'Logement', valeur: l ? `${l.nom} (${l.ville})` : '' },
    {
      cle: 'dates',
      ecran: 'dates',
      libelle: 'Dates',
      valeur: nuits > 0 ? `Du ${dateLisible(b.arrivee, ctx.aujourdhui)} au ${dateLisible(b.depart, ctx.aujourdhui)} · ${pluriel(nuits, 'nuit')}` : '',
    },
    {
      cle: 'voyageur',
      ecran: 'voyageur',
      libelle: 'Voyageur',
      valeur: b.nom.trim() ? [b.nom.trim(), b.pays.trim(), pluriel(b.nbPersonnes, 'voyageur')].filter(Boolean).join(' · ') : '',
    },
    {
      cle: 'montants',
      ecran: 'montants',
      libelle: 'Montant payé par le voyageur',
      valeur: montantsLisibles ? `${euros(m.hebergement + m.menage)} (nuits ${euros(m.hebergement)}, ménage ${euros(m.menage)})` : '',
    },
  ];
}
