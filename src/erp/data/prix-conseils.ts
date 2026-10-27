/**
 * Prix conseillés (A7) : pour chaque logement et chaque nuit des prochaines
 * semaines (60 jours au plus, ceux dont les plateformes donnent le prix), un
 * prix conseillé, l'écart en %, une raison en une phrase, une confiance et
 * un genre : `baisse`, `hausse` ou `trou`.
 *
 * LECTURE SEULE. L'ERP ne change jamais un prix : l'équipe le change
 * elle-même sur Airbnb ou Booking (lien « Ouvrir le calendrier »), puis dit
 * « C'est fait » dans l'ERP. Ce module ne fait que calculer : il n'importe
 * ni le client de notre service de connexion aux plateformes, ni rien qui
 * puisse y écrire (contrôlé par verifier-prix-conseils.ts).
 *
 * D'où viennent les conseils (nos propres données, aucun prix de
 * concurrent) :
 * - le prix actuel de chaque nuit, lu sur les plateformes (Logement.tarifs) ;
 * - notre prix habituel : prix médian d'une nuit vendue sur 365 jours, par
 *   type de nuit (semaine / vendredi-samedi), corrigé du mois ;
 * - la médiane des prix actuels des logements comparables du parc (même
 *   capacité à une place près, même département) ;
 * - le rythme de réservation : part des nuits déjà réservées autour de la
 *   nuit, comparée à ce qui est d'habitude réservé à ce délai ;
 * - le calendrier : week-ends, veilles de jours fériés, vacances scolaires ;
 * - les trous d'une ou deux nuits entre deux séjours.
 * Une source de prix du marché (PriceLabs, AirDNA…) pourra s'ajouter par
 * l'interface `SourceMarche` : aucune n'est branchée.
 *
 * Les nombres des règles sont dans REGLES_PRIX. Imports en « .js » : ce
 * module tourne aussi côté serveur (passage du matin, api/_prix-conseils.ts).
 */
import { jourDemande } from './calendrier-fr.js';
import type { Centimes, DateISO, Horodatage, Id, Logement, Reservation } from './types';

/* ------------------------------------------------------------ données */

/** Collection des réglages, décisions et historique des prix conseillés (une par espace). */
export const COLLECTION_PRIX = 'conseilsPrix';
/** Jours de prix lus à l'avance sur les plateformes (comme JOURS_TARIFS de la synchronisation). */
export const HORIZON_MAX_JOURS = 60;

export type GenreConseil = 'baisse' | 'hausse' | 'trou';
/** Pourquoi : peu de demande (nuits qui restent vides), forte demande, sous notre prix habituel, trou entre deux séjours. */
export type MotifConseil = 'invendu' | 'demande' | 'niveau' | 'trou';

/** Plancher et plafond d'un logement (centimes), facultatifs. */
export interface BornesPrix {
  plancher?: Centimes;
  plafond?: Centimes;
}

/** Réglages du gérant (élément 'reglages' de la collection). */
export interface ReglagesPrix {
  id: 'reglages';
  genre: 'reglages';
  /** Conseils calculés et montrés. */
  actif: boolean;
  /** Notification du matin « prix à revoir ». */
  notifications: boolean;
  /** Écart maximal conseillé, en % du prix actuel (et de notre prix habituel). */
  variationMaxPct: number;
  /** Nuits regardées à l'avance, en jours (14 à 60). */
  horizonJours: number;
  /** Confiance minimale d'un conseil montré (0 à 1). */
  confianceMin: number;
  /** Plancher et plafond par logement. */
  parLogement: Record<Id, BornesPrix>;
  majLe?: Horodatage;
  majPar?: string;
}

/** « C'est fait » ou « Ignorer » sur un conseil (une plage de nuits). */
export interface DecisionPrix {
  id: Id;
  genre: 'decision';
  logementId: Id;
  type: GenreConseil;
  /** Première nuit. */
  debut: DateISO;
  /** Lendemain de la dernière nuit. */
  fin: DateISO;
  prixActuel: Centimes;
  prixConseille: Centimes;
  raison: string;
  decision: 'fait' | 'ignore';
  le: Horodatage;
  par: string;
}

/** Un conseil du jour, résumé pour l'historique. */
export interface ResumeConseil {
  logementId: Id;
  type: GenreConseil;
  debut: DateISO;
  fin: DateISO;
  prixActuel: Centimes;
  prixConseille: Centimes;
}

/** Ce que retient le passage du matin (élément 'etat', écrit par le serveur). */
export interface EtatPrix {
  id: 'etat';
  genre: 'etat';
  /** Dernier jour calculé (un seul calcul et une seule notification par jour). */
  dernierCalcul?: DateISO;
  /** Conseils du dernier calcul. */
  derniers?: ResumeConseil[];
  /** Un résumé par jour calculé, du plus ancien au plus récent (90 jours). */
  historique?: { date: DateISO; conseils: number; logements: number; notifie: boolean }[];
  /** Anomalies graves déjà notifiées, et le jour de la notification. */
  anomaliesNotifiees?: Record<string, DateISO>;
  /** Dernière recherche des anomalies (une par heure et par espace au plus). */
  anomaliesVerifieesLe?: Horodatage;
  majLe?: Horodatage;
}

export type ElementPrix = ReglagesPrix | DecisionPrix | EtatPrix;

/* ------------------------------------------------------------ règles */

/** Les nombres des règles, en un seul endroit. */
export const REGLES_PRIX = {
  /** Nuits vendues sur 365 jours en dessous desquelles notre historique ne compte pas. */
  nuitsHistoriqueMin: 10,
  /** Nuits d'un même type (semaine, week-end) ou d'un même mois pour en tirer un prix à part. */
  nuitsTypeMin: 6,
  /** Logements comparables nécessaires pour une médiane du parc. */
  comparablesMin: 2,
  /** Logements connus une nuit donnée pour lire la demande sur le parc. */
  parcDemandeMin: 3,
  /** Une nuit libre est « proche » dans les 14 jours. */
  joursProches: 14,
  /** Baisse d'une nuit libre proche, selon le délai : 3 j ou moins 15 %, 7 j 10 %, 14 j 6 %. */
  baisses: [
    { jours: 3, pct: 15 },
    { jours: 7, pct: 10 },
    { jours: 14, pct: 6 },
  ],
  /** Retard sur le rythme : part réservée autour de la nuit inférieure à l'attendu de plus de 15 points. */
  retardRythme: 0.15,
  /** Trou : 1 ou 2 nuits libres entre deux séjours, proposées 15 % moins cher. */
  trouNuitsMax: 2,
  trouPct: 15,
  /** Forte demande : 80 % réservé autour de la nuit ou sur le parc (65 % en vacances ou veille de jour férié). */
  demandeSeuil: 0.8,
  demandeSeuilFete: 0.65,
  /** Hausse en forte demande : 10 %, 15 % en vacances ou veille de jour férié. */
  haussePct: 10,
  haussePctFete: 15,
  /** Sous notre prix habituel : prix actuel sous 85 % de la référence, au-delà des 14 jours. */
  sousNiveau: 0.85,
  /** Écart minimal pour conseiller : 3 % et 3 €. */
  ecartMinPct: 3,
  ecartMinCentimes: 300,
  /** Prix lus il y a plus de 3 jours : trop anciens pour conseiller. */
  fraicheurPrixJours: 3,
  /** Après « C'est fait », rien de nouveau sur ces nuits pendant 3 jours (le temps de la mise à jour). */
  silenceFaitJours: 3,
} as const;

/**
 * Part des réservations finales déjà prises selon le délai avant la nuit
 * (rythme habituel d'une location courte durée) : à 7 jours, 85 % de ce qui
 * sera réservé l'est déjà.
 */
export const COURBE_REMPLISSAGE: readonly { jours: number; part: number }[] = [
  { jours: 2, part: 0.95 },
  { jours: 7, part: 0.85 },
  { jours: 14, part: 0.7 },
  { jours: 30, part: 0.5 },
  { jours: 60, part: 0.3 },
  { jours: Infinity, part: 0.2 },
];

export function partDejaReservee(delaiJours: number): number {
  return COURBE_REMPLISSAGE.find((c) => delaiJours <= c.jours)!.part;
}

/** Les trois niveaux de prudence proposés au gérant. */
export const NIVEAUX_CONFIANCE = [
  { cle: 'tous', libelle: 'Tous', valeur: 0.4 },
  { cle: 'probables', libelle: 'Probables', valeur: 0.55 },
  { cle: 'surs', libelle: 'Sûrs', valeur: 0.7 },
] as const;

export const REGLAGES_PRIX_DEFAUT: ReglagesPrix = {
  id: 'reglages',
  genre: 'reglages',
  actif: true,
  notifications: true,
  variationMaxPct: 20,
  horizonJours: HORIZON_MAX_JOURS,
  confianceMin: 0.55,
  parLogement: {},
};

const borne = (n: unknown, min: number, max: number, defaut: number): number => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : defaut;
};
const centimesOuRien = (n: unknown): Centimes | undefined => {
  const x = Math.round(Number(n));
  return Number.isFinite(x) && x > 0 ? x : undefined;
};

/** Réglages lus avec tolérance (absents, incomplets ou hors bornes : valeurs par défaut). */
export function reglagesPrix(brut: Partial<ReglagesPrix> | null | undefined): ReglagesPrix {
  const d = REGLAGES_PRIX_DEFAUT;
  const parLogement: Record<Id, BornesPrix> = {};
  for (const [id, b] of Object.entries(brut?.parLogement ?? {})) {
    const plancher = centimesOuRien(b?.plancher);
    const plafond = centimesOuRien(b?.plafond);
    // Un plafond sous le plancher n'a pas de sens : on garde le plancher seul.
    if (plancher || plafond) parLogement[id] = { ...(plancher ? { plancher } : {}), ...(plafond && (!plancher || plafond > plancher) ? { plafond } : {}) };
  }
  return {
    id: 'reglages',
    genre: 'reglages',
    actif: brut?.actif !== false,
    notifications: brut?.notifications !== false,
    variationMaxPct: Math.round(borne(brut?.variationMaxPct, 5, 50, d.variationMaxPct)),
    horizonJours: Math.round(borne(brut?.horizonJours, 14, HORIZON_MAX_JOURS, d.horizonJours)),
    confianceMin: borne(brut?.confianceMin, 0, 0.95, d.confianceMin),
    parLogement,
    ...(brut?.majLe ? { majLe: brut.majLe } : {}),
    ...(brut?.majPar ? { majPar: brut.majPar } : {}),
  };
}

/** Réglages, décisions et état rangés à partir des éléments de la collection. */
export function lireElementsPrix(elements: readonly ElementPrix[] | undefined): { reglages: ReglagesPrix; decisions: DecisionPrix[]; etat?: EtatPrix } {
  const liste = (elements ?? []).filter((e) => e && typeof e === 'object');
  const reglages = liste.find((e): e is ReglagesPrix => e.id === 'reglages');
  const etat = liste.find((e): e is EtatPrix => e.id === 'etat');
  const decisions = liste.filter((e): e is DecisionPrix => e.genre === 'decision' && typeof e.logementId === 'string' && typeof e.debut === 'string');
  return { reglages: reglagesPrix(reglages), decisions, ...(etat ? { etat } : {}) };
}

/* ------------------------------------------------------------ marché */

/**
 * Source de prix du marché (concurrents), à brancher : PriceLabs, AirDNA…
 * AUCUNE N'EST BRANCHÉE : les conseils viennent de nos seules données.
 * Pour en ajouter une : lire ses prix avant le calcul (côté serveur, en
 * lecture), puis les passer ici ; le moteur les prend comme une référence
 * de plus, pondérée par leur fiabilité. Elle ne doit jamais écrire chez
 * les plateformes.
 */
export interface SourceMarche {
  /** Nom affiché (« PriceLabs »). */
  nom: string;
  /** Prix comparable du marché pour cette nuit, et sa fiabilité (0 à 1) ; undefined : inconnu. */
  prixMarche(logement: Logement, nuit: DateISO): { prix: Centimes; fiabilite: number } | undefined;
}

/* ------------------------------------------------------------ dates */

const JOUR_MS = 86_400_000;
const enMs = (d: DateISO) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
export const plusJours = (d: DateISO, n: number): DateISO => new Date(enMs(d) + n * JOUR_MS).toISOString().slice(0, 10);
export const ecartJours = (de: DateISO, a: DateISO): number => Math.round((enMs(a) - enMs(de)) / JOUR_MS);

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const jourMois = (d: DateISO) => `${Number(d.slice(8, 10))} ${MOIS[Number(d.slice(5, 7)) - 1] ?? ''}`.trim();

/** « la nuit du 3 oct. », « du 3 au 5 oct. », « du 30 sept. au 2 oct. » (fin = jour du départ). */
export function texteNuits(debut: DateISO, fin: DateISO): string {
  if (ecartJours(debut, fin) <= 1) return `la nuit du ${jourMois(debut)}`;
  if (debut.slice(0, 7) === fin.slice(0, 7)) return `du ${Number(debut.slice(8, 10))} au ${jourMois(fin)}`;
  return `du ${jourMois(debut)} au ${jourMois(fin)}`;
}

/** « 85 € » (prix conseillés arrondis à l'euro). */
export const eurosRonds = (c: Centimes): string => `${Math.round(c / 100).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} €`;

const mediane = (xs: number[]): number | undefined => {
  if (!xs.length) return undefined;
  const t = [...xs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};

/* ------------------------------------------------------------ profil */

const active = (r: Reservation) => r.statut !== 'annulee';
const estWeekend = (nuit: DateISO) => {
  const j = new Date(enMs(nuit)).getUTCDay();
  return j === 5 || j === 6;
};

/** Ce que notre historique dit d'un logement. */
export interface ProfilPrix {
  /** Nuits vendues sur les 365 derniers jours. */
  nuitsVendues: number;
  /** Prix médian d'une nuit vendue (hors ménage), tous types. */
  median?: Centimes;
  semaine?: Centimes;
  weekend?: Centimes;
  /** Facteur de chaque mois (1 à 12) par rapport à la médiane, s'il est connu. */
  facteurMois: Record<number, number>;
  /** Occupation des 90 derniers jours (0..1), undefined sans séjour. */
  occupation?: number;
}

/** Prix d'une nuit d'un séjour : (total − ménage) ÷ nuits. */
export function prixNuitSejour(r: Reservation): Centimes | undefined {
  if (!r.nuits || r.montantBrutCentimes <= 0) return undefined;
  const p = (r.montantBrutCentimes - (r.fraisMenageCentimes || 0)) / r.nuits;
  return p > 0 ? p : undefined;
}

export function profilPrix(logementId: Id, reservations: readonly Reservation[], aujourdhui: DateISO): ProfilPrix {
  const depuis = plusJours(aujourdhui, -365);
  const nuits: { nuit: DateISO; prix: number }[] = [];
  let premiere: DateISO | undefined;
  const debut90 = plusJours(aujourdhui, -90);
  let vendues90 = 0;
  for (const r of reservations) {
    if (r.logementId !== logementId || !active(r)) continue;
    if (!premiere || r.arrivee < premiere) premiere = r.arrivee;
    const prix = prixNuitSejour(r);
    for (let d = r.arrivee > depuis ? r.arrivee : depuis; d < r.depart && d < aujourdhui; d = plusJours(d, 1)) {
      if (prix) nuits.push({ nuit: d, prix });
      if (d >= debut90) vendues90++;
    }
  }
  const median = mediane(nuits.map((n) => n.prix));
  const parType = (we: boolean) => {
    const xs = nuits.filter((n) => estWeekend(n.nuit) === we).map((n) => n.prix);
    return xs.length >= REGLES_PRIX.nuitsTypeMin ? mediane(xs) : undefined;
  };
  const facteurMois: Record<number, number> = {};
  if (median) {
    for (let m = 1; m <= 12; m++) {
      const xs = nuits.filter((n) => Number(n.nuit.slice(5, 7)) === m).map((n) => n.prix);
      if (xs.length >= REGLES_PRIX.nuitsTypeMin) facteurMois[m] = Math.min(1.25, Math.max(0.8, mediane(xs)! / median));
    }
  }
  // Occupation récente : sur 90 jours, ou depuis le premier séjour s'il est plus récent (30 jours au moins).
  const jours = premiere && premiere > debut90 ? Math.max(30, ecartJours(premiere, aujourdhui)) : 90;
  return {
    nuitsVendues: nuits.length,
    ...(median ? { median: Math.round(median) } : {}),
    ...(parType(false) ? { semaine: Math.round(parType(false)!) } : {}),
    ...(parType(true) ? { weekend: Math.round(parType(true)!) } : {}),
    facteurMois,
    ...(premiere && premiere < aujourdhui ? { occupation: Math.min(1, vendues90 / jours) } : {}),
  };
}

/** Notre prix habituel pour cette nuit (undefined : pas assez d'historique). */
export function prixHabituel(p: ProfilPrix, nuit: DateISO): Centimes | undefined {
  if (p.nuitsVendues < REGLES_PRIX.nuitsHistoriqueMin || !p.median) return undefined;
  const base = (estWeekend(nuit) ? p.weekend : p.semaine) ?? p.median;
  return Math.round(base * (p.facteurMois[Number(nuit.slice(5, 7))] ?? 1));
}

/* ------------------------------------------------------------ calendrier d'un logement */

export type EtatNuit = 'reserve' | 'libre' | 'ferme' | 'inconnu';

/**
 * Logement à conseiller : en location (actif, ou en pause mais encore
 * réservé), toujours suivi, avec des prix lus récemment.
 */
export function logementConseillable(l: Logement, reservations: readonly Reservation[], aujourdhui: DateISO, maintenant: Horodatage): boolean {
  if (l.statut === 'sorti' || l.statut === 'lancement' || l.repull?.horsSelection) return false;
  if (!l.tarifs?.jours?.length) return false;
  const lu = Date.parse(l.tarifs.luLe);
  if (!Number.isFinite(lu) || Date.parse(maintenant) - lu > REGLES_PRIX.fraicheurPrixJours * JOUR_MS) return false;
  if (l.statut === 'actif') return true;
  // En pause (annonce « inactive » chez notre service de connexion) mais encore réservée : toujours en vente.
  const depuis = plusJours(aujourdhui, -30);
  return reservations.some((r) => r.logementId === l.id && active(r) && r.depart >= depuis);
}

/* ------------------------------------------------------------ calcul */

export interface ConseilNuit {
  logementId: Id;
  nuit: DateISO;
  type: GenreConseil;
  motif: MotifConseil;
  prixActuel: Centimes;
  prixConseille: Centimes;
  /** Écart signé, en % entier (−10 : baisse de 10 %). */
  variationPct: number;
  /** 0 à 1. */
  confiance: number;
  /** Notre référence pour cette nuit (habituel, parc, marché). */
  reference?: Centimes;
  /** Vacances ou jour férié qui expliquent une hausse. */
  fete?: string;
  /** Nuits minimum de l'annonce, quand elles empêchent de vendre un trou. */
  nuitsMin?: number;
}

/** Plusieurs nuits consécutives au même conseil : ce qui est montré et notifié. */
export interface PlagePrix {
  /** Clé stable : logement, genre, motif, première nuit, lendemain de la dernière. */
  cle: string;
  logementId: Id;
  nom: string;
  type: GenreConseil;
  motif: MotifConseil;
  debut: DateISO;
  fin: DateISO;
  nuits: number;
  prixActuel: Centimes;
  prixConseille: Centimes;
  variationPct: number;
  confiance: number;
  /** Une phrase, en français simple. */
  raison: string;
}

export interface EntreesConseils {
  logements: readonly Logement[];
  reservations: readonly Reservation[];
  reglages?: Partial<ReglagesPrix> | null;
  decisions?: readonly DecisionPrix[];
  aujourdhui: DateISO;
  /** Instant du calcul (fraîcheur des prix lus) ; par défaut, midi le jour même. */
  maintenant?: Horodatage;
  /** Sources de prix du marché (aucune branchée aujourd'hui). */
  marche?: readonly SourceMarche[];
  /** Un seul logement (page du logement) ; le parc sert quand même de comparaison. */
  logementId?: Id;
}

const departement = (l: Logement) => (l.codePostal || '').slice(0, 2) || (l.ville || '').toLowerCase();

const arrondiEuro = (c: number) => Math.round(c / 100) * 100;

/** Silence après une décision : « Ignorer » pour de bon, « C'est fait » pendant 3 jours. */
function enSilence(decisions: readonly DecisionPrix[], logementId: Id, type: GenreConseil, nuit: DateISO, aujourdhui: DateISO): boolean {
  return decisions.some(
    (x) =>
      x.logementId === logementId &&
      x.type === type &&
      x.debut <= nuit &&
      nuit < x.fin &&
      (x.decision === 'ignore' || ecartJours(String(x.le).slice(0, 10), aujourdhui) < REGLES_PRIX.silenceFaitJours),
  );
}

/**
 * Prix conseillé borné : jamais au-delà de l'écart maximal (par rapport au
 * prix actuel ET à notre référence), jamais sous le plancher ni au-dessus
 * du plafond, arrondi à l'euro. undefined : rien d'utile à conseiller.
 */
export function bornerPrix(o: { actuel: Centimes; cible: number; reference?: Centimes; variationMaxPct: number; bornes?: BornesPrix }): Centimes | undefined {
  const max = o.variationMaxPct / 100;
  const { plancher, plafond } = o.bornes ?? {};
  let z: number;
  if (o.cible < o.actuel) {
    if (plancher && o.actuel <= plancher) return undefined;
    const bas = Math.max(o.actuel * (1 - max), o.reference ? o.reference * (1 - max) : 0, plancher ?? 0);
    if (bas >= o.actuel) return undefined;
    z = Math.max(arrondiEuro(Math.max(o.cible, bas)), Math.ceil(bas / 100) * 100);
    z = Math.min(z, o.actuel);
  } else {
    if (plafond && o.actuel >= plafond) return undefined;
    const haut = Math.min(o.actuel * (1 + max), o.reference ? Math.max(o.actuel, o.reference * (1 + max)) : Infinity, plafond ?? Infinity);
    if (haut <= o.actuel) return undefined;
    z = Math.min(arrondiEuro(Math.min(o.cible, haut)), Math.floor(haut / 100) * 100);
    z = Math.max(z, o.actuel);
  }
  const ecart = Math.abs(z - o.actuel);
  if (ecart < REGLES_PRIX.ecartMinCentimes || ecart < (o.actuel * REGLES_PRIX.ecartMinPct) / 100) return undefined;
  return z;
}

const pctBaisse = (delai: number) => REGLES_PRIX.baisses.find((b) => delai <= b.jours)?.pct ?? 0;

/** Conseils nuit par nuit, avant regroupement (filtrés par la confiance minimale et les décisions). */
export function conseilsParNuit(e: EntreesConseils): ConseilNuit[] {
  const reglages = reglagesPrix(e.reglages);
  if (!reglages.actif) return [];
  const maintenant = e.maintenant ?? `${e.aujourdhui}T12:00:00+02:00`;
  const fin = plusJours(e.aujourdhui, Math.min(reglages.horizonJours, HORIZON_MAX_JOURS));
  const actives = e.reservations.filter(active);
  const parLogement = new Map<Id, Reservation[]>();
  for (const r of actives) parLogement.set(r.logementId, [...(parLogement.get(r.logementId) ?? []), r]);
  const eligibles = e.logements.filter((l) => logementConseillable(l, actives, e.aujourdhui, maintenant));
  const prixDe = (l: Logement) => new Map((l.tarifs?.jours ?? []).map((j) => [j.date, j]));
  const prixParLogement = new Map(eligibles.map((l) => [l.id, prixDe(l)]));

  // Nuits réservées de chaque logement autour de la période regardée (de la veille à 4 nuits après la fin).
  const debutFenetre = plusJours(e.aujourdhui, -4);
  const finFenetre = plusJours(fin, 4);
  const nuitsReservees = new Map<Id, Set<DateISO>>();
  for (const l of eligibles) {
    const nuits = new Set<DateISO>();
    for (const r of parLogement.get(l.id) ?? []) {
      if (r.depart <= debutFenetre || r.arrivee >= finFenetre) continue;
      for (let d = r.arrivee > debutFenetre ? r.arrivee : debutFenetre; d < r.depart && d < finFenetre; d = plusJours(d, 1)) nuits.add(d);
    }
    nuitsReservees.set(l.id, nuits);
  }

  /** État d'une nuit pour un logement. */
  const etatNuit = (l: Logement, nuit: DateISO): EtatNuit => {
    if (nuitsReservees.get(l.id)?.has(nuit)) return 'reserve';
    const j = prixParLogement.get(l.id)?.get(nuit);
    if (!j) return 'inconnu';
    return j.libre === false ? 'ferme' : 'libre';
  };

  // Demande sur le parc, nuit par nuit : part des logements réservés.
  const demandeParc = new Map<DateISO, number>();
  for (let d = e.aujourdhui; d < fin; d = plusJours(d, 1)) {
    const etats = eligibles.map((l) => etatNuit(l, d)).filter((x) => x === 'reserve' || x === 'libre');
    if (etats.length >= REGLES_PRIX.parcDemandeMin) demandeParc.set(d, etats.filter((x) => x === 'reserve').length / etats.length);
  }

  const profils = new Map(eligibles.map((l) => [l.id, profilPrix(l.id, parLogement.get(l.id) ?? [], e.aujourdhui)]));
  const occupationParc = mediane([...profils.values()].map((p) => p.occupation).filter((x): x is number => x !== undefined && x > 0));

  const resultat: ConseilNuit[] = [];
  for (const l of eligibles) {
    if (e.logementId && l.id !== e.logementId) continue;
    const profil = profils.get(l.id)!;
    const comparables = eligibles.filter((x) => x.id !== l.id && Math.abs((x.capacite || 0) - (l.capacite || 0)) <= 1 && departement(x) === departement(l));
    // Occupation de référence : celle du logement (90 jours), sinon celle du parc.
    const occupationRef = profil.occupation ? profil.occupation : occupationParc;
    const bornes = reglages.parLogement[l.id];
    const nuitsMin = l.descriptif?.sejour?.nuitsMin;
    // Prix médian lu pour ce logement : une nuit à moins de 50 % ou plus de 250 % est sans doute une faute de frappe
    // (signalée par les anomalies), pas une base de conseil.
    const medianeLue = mediane((l.tarifs?.jours ?? []).filter((j) => j.date >= e.aujourdhui && j.prixCentimes > 0).map((j) => j.prixCentimes));

    const reference = (nuit: DateISO): { prix: Centimes; parc: boolean; marche: boolean; historique: boolean } | undefined => {
      const parts: { prix: number; poids: number }[] = [];
      const habituel = prixHabituel(profil, nuit);
      if (habituel) parts.push({ prix: habituel, poids: 0.6 });
      const prixParc = comparables.map((x) => prixParLogement.get(x.id)?.get(nuit)?.prixCentimes ?? 0).filter((p) => p > 0);
      const parc = prixParc.length >= REGLES_PRIX.comparablesMin ? mediane(prixParc) : undefined;
      if (parc) parts.push({ prix: parc, poids: 0.4 });
      let marche = false;
      for (const s of e.marche ?? []) {
        const m = s.prixMarche(l, nuit);
        if (m && m.prix > 0 && m.fiabilite > 0) {
          parts.push({ prix: m.prix, poids: 0.5 * Math.min(1, m.fiabilite) });
          marche = true;
        }
      }
      const poids = parts.reduce((s, x) => s + x.poids, 0);
      if (!poids) return undefined;
      return { prix: Math.round(parts.reduce((s, x) => s + x.prix * x.poids, 0) / poids), parc: !!parc, marche, historique: !!habituel };
    };

    /** Part réservée de [debut − 3 nuits, fin + 3 nuits[ (pas avant aujourd'hui ; nuits fermées exclues). */
    const partReservee = (debut: DateISO, finExclue: DateISO): number | undefined => {
      let reserves = 0;
      let total = 0;
      for (let d = plusJours(debut, -3); d < plusJours(finExclue, 3); d = plusJours(d, 1)) {
        if (d < e.aujourdhui || d >= fin) continue;
        const x = etatNuit(l, d);
        if (x === 'reserve') reserves++;
        if (x === 'reserve' || x === 'libre') total++;
      }
      return total >= 4 ? reserves / total : undefined;
    };
    /** Autour d'une nuit (forte demande). */
    const autour = (nuit: DateISO) => partReservee(nuit, plusJours(nuit, 1));
    // « Peu de demande » se juge sur toute la suite de nuits libres : une plage cohérente, du premier au dernier soir.
    const autourDeLaSuite = new Map<DateISO, number | undefined>();
    for (let d = e.aujourdhui; d < fin; d = plusJours(d, 1)) {
      if (etatNuit(l, d) !== 'libre' || autourDeLaSuite.has(d)) continue;
      let f = d;
      while (f < fin && etatNuit(l, f) === 'libre') f = plusJours(f, 1);
      const part = partReservee(d, f);
      for (let x = d; x < f; x = plusJours(x, 1)) autourDeLaSuite.set(x, part);
    }

    // Trous : suites de 1 ou 2 nuits libres entre la fin d'un séjour et le début du suivant.
    const trous = new Set<DateISO>();
    for (let d = e.aujourdhui; d < fin; d = plusJours(d, 1)) {
      if (etatNuit(l, d) !== 'libre' || etatNuit(l, plusJours(d, -1)) !== 'reserve') continue;
      let n = 0;
      while (n < REGLES_PRIX.trouNuitsMax + 1 && plusJours(d, n) < fin && etatNuit(l, plusJours(d, n)) === 'libre') n++;
      const apres = plusJours(d, n);
      if (n >= 1 && n <= REGLES_PRIX.trouNuitsMax && apres < fin && etatNuit(l, apres) === 'reserve') for (let k = 0; k < n; k++) trous.add(plusJours(d, k));
    }
    const longueurTrou = (nuit: DateISO) => (trous.has(plusJours(nuit, -1)) || trous.has(plusJours(nuit, 1)) ? 2 : 1);

    for (let nuit = e.aujourdhui; nuit < fin; nuit = plusJours(nuit, 1)) {
      if (etatNuit(l, nuit) !== 'libre') continue;
      const actuel = prixParLogement.get(l.id)?.get(nuit)?.prixCentimes ?? 0;
      if (actuel <= 0 || (medianeLue && (actuel < medianeLue * 0.5 || actuel > medianeLue * 2.5))) continue;
      const ref = reference(nuit);
      // Pas assez de données (ni historique, ni logements comparables, ni marché) : aucun conseil.
      if (!ref) continue;
      const delai = ecartJours(e.aujourdhui, nuit);
      const cal = jourDemande(nuit);
      const fete = cal.vacances ?? (cal.ferie ? `veille de ${cal.ferie}` : undefined);
      let confiance = 0.35 + (profil.nuitsVendues >= 30 ? 0.25 : profil.nuitsVendues >= REGLES_PRIX.nuitsHistoriqueMin ? 0.15 : 0) + (ref.parc ? 0.1 : 0) + (ref.marche ? 0.1 : 0);
      let type: GenreConseil | undefined;
      let motif: MotifConseil | undefined;
      let cible = actuel;
      let trouNuitsMin: number | undefined;

      const local = autour(nuit);
      const suite = autourDeLaSuite.get(nuit);
      const parc = demandeParc.get(nuit);
      const demande = Math.max(local ?? 0, parc ?? 0);
      const attendu = occupationRef !== undefined ? occupationRef * partDejaReservee(delai) : undefined;

      if (trous.has(nuit)) {
        type = 'trou';
        motif = 'trou';
        cible = actuel * (1 - REGLES_PRIX.trouPct / 100);
        confiance += 0.25;
        const longueur = longueurTrou(nuit);
        if (nuitsMin && nuitsMin > longueur) trouNuitsMin = longueur;
      } else if (delai <= REGLES_PRIX.joursProches && attendu !== undefined && suite !== undefined && suite < attendu - REGLES_PRIX.retardRythme) {
        type = 'baisse';
        motif = 'invendu';
        const pct = pctBaisse(delai);
        // Au-dessus de notre référence : on y revient (dans la limite de l'écart maximal).
        cible = Math.min(actuel * (1 - pct / 100), actuel > ref.prix * 1.1 ? ref.prix : Infinity);
        confiance += (delai <= 7 ? 0.15 : 0.05) + (suite < attendu - 0.35 ? 0.05 : 0);
      } else if (delai >= 2 && (local !== undefined || parc !== undefined) && demande >= (fete ? REGLES_PRIX.demandeSeuilFete : REGLES_PRIX.demandeSeuil)) {
        type = 'hausse';
        motif = 'demande';
        cible = Math.max(actuel * (1 + (fete ? REGLES_PRIX.haussePctFete : REGLES_PRIX.haussePct) / 100), ref.prix);
        confiance += 0.1 + (fete ? 0.05 : 0) + ((local ?? 0) >= REGLES_PRIX.demandeSeuil && (parc ?? 0) >= REGLES_PRIX.demandeSeuil ? 0.05 : 0);
      } else if (delai > REGLES_PRIX.joursProches && actuel < ref.prix * REGLES_PRIX.sousNiveau) {
        type = 'hausse';
        motif = 'niveau';
        cible = ref.prix;
        if (!ref.historique) confiance -= 0.1;
      }
      if (!type || !motif) continue;
      const prixConseille = bornerPrix({ actuel, cible, reference: ref.prix, variationMaxPct: reglages.variationMaxPct, bornes });
      if (prixConseille === undefined) continue;
      confiance = Math.round(Math.min(0.95, Math.max(0.05, confiance)) * 100) / 100;
      if (confiance < reglages.confianceMin) continue;
      if (enSilence(e.decisions ?? [], l.id, type, nuit, e.aujourdhui)) continue;
      resultat.push({
        logementId: l.id,
        nuit,
        type,
        motif,
        prixActuel: actuel,
        prixConseille,
        variationPct: Math.round(((prixConseille - actuel) / actuel) * 100),
        confiance,
        reference: ref.prix,
        ...(motif === 'demande' && fete ? { fete } : {}),
        ...(trouNuitsMin ? { nuitsMin: trouNuitsMin } : {}),
      });
    }
  }
  return resultat;
}

/** Une seule fin de phrase (« oct. » finit déjà par un point). */
const phrase = (s: string) => `${s.replace(/\.+$/, '')}.`;

/** La phrase d'un conseil. */
export function raisonConseil(p: Pick<PlagePrix, 'nom' | 'motif' | 'debut' | 'fin' | 'prixConseille'> & { fete?: string; nuitsMin?: number }): string {
  const nuits = texteNuits(p.debut, p.fin);
  const prix = eurosRonds(p.prixConseille);
  switch (p.motif) {
    case 'invendu':
      return phrase(`Peu de demande : ${p.nom} reste vide ${nuits}, baissez à ${prix}`);
    case 'demande':
      return phrase(`Forte demande${p.fete ? ` (${p.fete})` : ''} : montez ${p.nom} à ${prix} ${nuits}`);
    case 'niveau':
      return phrase(`Sous votre prix habituel : montez ${p.nom} à ${prix} ${nuits}`);
    case 'trou':
      return phrase(`Trou dans le calendrier : proposez ${prix} ${nuits} pour le combler${p.nuitsMin ? ` et acceptez ${p.nuitsMin} nuit${p.nuitsMin > 1 ? 's' : ''} minimum` : ''}`);
  }
}

/**
 * Le conseil sans les dates ni le prix (déjà sur la ligne) : « Ça ne se vend
 * pas : baissez de 10 % », pour la carte du logement.
 */
export function conseilCourt(p: Pick<PlagePrix, 'motif' | 'variationPct' | 'raison'>): string {
  const pct = `${Math.abs(p.variationPct)} %`;
  const fete = /^Forte demande \(([^)]+)\)/.exec(p.raison)?.[1];
  const minimum = / et acceptez (\d+ nuits? minimum)/.exec(p.raison)?.[1];
  switch (p.motif) {
    case 'invendu':
      return `Peu de demande : baissez de ${pct}`;
    case 'demande':
      return `Forte demande${fete ? ` (${fete})` : ''} : montez de ${pct}`;
    case 'niveau':
      return `Sous votre prix habituel : montez de ${pct}`;
    case 'trou':
      return `Trou entre deux séjours : baissez de ${pct}${minimum ? ` et acceptez ${minimum}` : ''}`;
  }
}

/** Regroupe les nuits consécutives au même conseil (même genre, motif et prix) en plages. */
export function grouperPlages(nuits: readonly ConseilNuit[], logements: readonly Pick<Logement, 'id' | 'nom'>[]): PlagePrix[] {
  const tri = [...nuits].sort((a, b) => a.logementId.localeCompare(b.logementId) || a.nuit.localeCompare(b.nuit));
  const plages: (PlagePrix & { fete?: string; nuitsMin?: number })[] = [];
  for (const n of tri) {
    const p = plages[plages.length - 1];
    if (p && p.logementId === n.logementId && p.motif === n.motif && p.fin === n.nuit && p.prixActuel === n.prixActuel && p.prixConseille === n.prixConseille && p.fete === n.fete) {
      p.fin = plusJours(n.nuit, 1);
      p.nuits++;
      p.confiance = Math.min(p.confiance, n.confiance);
      continue;
    }
    plages.push({
      cle: '',
      logementId: n.logementId,
      nom: logements.find((l) => l.id === n.logementId)?.nom ?? 'Ce logement',
      type: n.type,
      motif: n.motif,
      debut: n.nuit,
      fin: plusJours(n.nuit, 1),
      nuits: 1,
      prixActuel: n.prixActuel,
      prixConseille: n.prixConseille,
      variationPct: n.variationPct,
      confiance: n.confiance,
      raison: '',
      ...(n.fete ? { fete: n.fete } : {}),
      ...(n.nuitsMin ? { nuitsMin: n.nuitsMin } : {}),
    });
  }
  return plages
    .map(({ fete, nuitsMin, ...p }) => ({
      ...p,
      cle: `${p.logementId}|${p.type}|${p.motif}|${p.debut}|${p.fin}`,
      raison: raisonConseil({ ...p, fete, nuitsMin }),
    }))
    .sort((a, b) => a.debut.localeCompare(b.debut) || a.nom.localeCompare(b.nom));
}

/** Les conseils du jour, en plages (ce que montrent l'Accueil, la page du logement et la notification). */
export function conseillerPrix(e: EntreesConseils): PlagePrix[] {
  return grouperPlages(conseilsParNuit(e), e.logements);
}

/** Résumé d'une plage pour l'historique. */
export const resumerPlage = (p: PlagePrix): ResumeConseil => ({
  logementId: p.logementId,
  type: p.type,
  debut: p.debut,
  fin: p.fin,
  prixActuel: p.prixActuel,
  prixConseille: p.prixConseille,
});

/** Décision « C'est fait » ou « Ignorer » sur une plage. */
export function decider(p: PlagePrix, decision: DecisionPrix['decision'], o: { le: Horodatage; par: string }): DecisionPrix {
  return {
    id: `decision-${p.logementId}-${p.type}-${p.debut}-${p.fin}-${o.le.replace(/[^0-9]/g, '').slice(0, 14)}`,
    genre: 'decision',
    logementId: p.logementId,
    type: p.type,
    debut: p.debut,
    fin: p.fin,
    prixActuel: p.prixActuel,
    prixConseille: p.prixConseille,
    raison: p.raison,
    decision,
    le: o.le,
    par: o.par,
  };
}
