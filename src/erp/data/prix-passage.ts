/**
 * Passage du matin des prix conseillés et des anomalies : ce que le serveur
 * doit lire, écrire et notifier (api/_prix-conseils.ts le lance à chaque
 * réveil planifié de l'agent, toutes les 30 minutes, dans chaque espace).
 *
 * - Rien avant 8 h à Paris.
 * - Prix : un seul calcul par jour (état `dernierCalcul`), et au plus une
 *   notification groupée, « 3 logements : prix à revoir », qui ouvre le
 *   logement le plus pressé.
 * - Anomalies graves (double réservation, départ sans personne, réservation
 *   inhabituelle) : cherchées au plus une fois par heure et par espace
 *   (état `anomaliesVerifieesLe`), chacune notifiée une seule fois
 *   (mémoire `anomaliesNotifiees`, gardée 30 jours).
 * - Rien de dû : une seule lecture (l'état), rien d'autre.
 * - Une seule notification même si deux passages tournent en même temps :
 *   le nouvel état (« déjà calculé, déjà notifié ») est écrit AVANT l'envoi,
 *   par une écriture conditionnelle (la version lue de l'état, ou « s'il
 *   n'existe pas encore ») ; le passage qui la perd n'envoie rien.
 * Le passage n'écrit que l'élément `etat` de la collection des prix
 * conseillés de l'espace. Jamais vers Airbnb ou Booking.
 *
 * Imports en « .js » : ce module tourne côté serveur.
 */
import { anomaliesANotifier, detecterAnomalies, type Anomalie, type EntreesAnomalies } from './anomalies.js';
import { COLLECTION_PRIX, conseillerPrix, lireElementsPrix, plusJours, resumerPlage, type ElementPrix, type EtatPrix, type PlagePrix } from './prix-conseils.js';
import type { GroupeNotification } from './notifications';
import type { DateISO, Horodatage, Logement, Reservation } from './types';
import type { AbsenceMembre, AffectationLogement, MembreEquipe } from './types-operations';

/** Heure de Paris à partir de laquelle part le passage du matin. */
export const HEURE_MATIN_PRIX = 8;
/** Une recherche des anomalies par heure et par espace, au plus. */
export const INTERVALLE_ANOMALIES_MS = 3_600_000;
/** Id de l'état du passage dans la collection des prix conseillés (écrit par le serveur, gérants seulement). */
export const ID_ETAT_PRIX = 'etat';
/** Jours d'historique gardés dans l'état. */
const JOURS_HISTORIQUE = 90;
const JOURS_MEMOIRE_ANOMALIES = 30;
const MAX_DERNIERS = 120;
const AUTEUR = 'Prix conseillés';

/** Heure (0–23) à Paris d'un instant. */
export function heureParisDe(d: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(d));
}

const jourParisDe = (d: Date): DateISO => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** Empreinte courte d'un texte (clé de notification). */
function empreinte(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Notification groupée des prix à revoir (null : rien à revoir). */
export function notificationPrix(plages: readonly PlagePrix[], aujourdhui: DateISO): GroupeNotification | null {
  if (!plages.length) return null;
  const logements: string[] = [];
  for (const p of plages) if (!logements.includes(p.logementId)) logements.push(p.logementId);
  // Le plus pressé : la première nuit la plus proche (les plages sont triées par date).
  const premier = plages[0];
  const noms = logements.map((id) => plages.find((p) => p.logementId === id)!.nom);
  const n = logements.length;
  return {
    cle: `prix-${aujourdhui}`,
    variantes: [
      {
        type: 'prix',
        titre: n > 1 ? `${n} logements : prix à revoir` : `Prix à revoir · ${noms[0]}`,
        corps: n > 1 ? `${noms.slice(0, 2).join(', ')}${n > 2 ? ` et ${n - 2} autre${n > 3 ? 's' : ''}` : ''}. ${premier.raison}` : premier.raison,
        url: `/erp/logements/${encodeURIComponent(premier.logementId)}#prix`,
      },
    ],
  };
}

/** Notification groupée des anomalies graves nouvelles (null : aucune). */
export function notificationAnomalies(anomalies: readonly Anomalie[], aujourdhui: DateISO): GroupeNotification | null {
  if (!anomalies.length) return null;
  const premiere = anomalies.find((a) => a.type === 'chevauchement') ?? anomalies[0];
  return {
    cle: `anomalies-${aujourdhui}-${empreinte(anomalies.map((a) => a.id).sort().join(','))}`,
    urgente: anomalies.some((a) => a.type === 'chevauchement'),
    variantes: [
      {
        type: 'anomalie',
        titre: anomalies.length > 1 ? `${anomalies.length} anomalies à vérifier` : premiere.titre,
        corps: anomalies.length > 1 ? `${premiere.titre}. ${premiere.detail}` : premiere.detail,
        url: premiere.lien,
      },
    ],
  };
}

/* ------------------------------------------------------------ ce qui est dû */

export interface TravauxDus {
  /** Calcul des prix du jour (pas encore fait aujourd'hui). */
  prix: boolean;
  /** Recherche des anomalies (pas faite depuis une heure ; seulement si l'on peut notifier). */
  anomalies: boolean;
}

/** Ce que le passage a à faire, d'après l'état seul (rien d'autre n'est lu avant). */
export function travauxDus(etat: EtatPrix | undefined, maintenant: Date, o: { notifier?: boolean; aujourdhui?: DateISO } = {}): TravauxDus {
  if (heureParisDe(maintenant) < HEURE_MATIN_PRIX) return { prix: false, anomalies: false };
  const aujourdhui = o.aujourdhui ?? jourParisDe(maintenant);
  const derniere = etat?.anomaliesVerifieesLe ? Date.parse(etat.anomaliesVerifieesLe) : NaN;
  return {
    prix: etat?.dernierCalcul !== aujourdhui,
    anomalies: o.notifier !== false && (!Number.isFinite(derniere) || maintenant.getTime() - derniere >= INTERVALLE_ANOMALIES_MS),
  };
}

/* ------------------------------------------------------------ plan (pur) */

export interface EntreesPassage extends Omit<EntreesAnomalies, 'maintenant' | 'aujourdhui'> {
  /** Éléments de la collection des prix conseillés (réglages, décisions ; l'état aussi, sauf s'il est donné à part). */
  elements: readonly ElementPrix[];
  /** État lu (avec sa version) : prime sur celui de `elements`. */
  etat?: EtatPrix;
  /** Instant du passage. */
  maintenant: Date;
  /** Jour à Paris (par défaut : celui de `maintenant`). */
  aujourdhui?: DateISO;
  /** Notifications possibles (clés du serveur présentes) ; sans : calcul et historique seulement. */
  notifier?: boolean;
}

export interface PlanPassage {
  /** Nouvel état à écrire (vide : rien n'a changé). */
  ecritures: EtatPrix[];
  notifications: GroupeNotification[];
  /** Conseils calculés à ce passage (vide : déjà calculés aujourd'hui, ou trop tôt). */
  conseils: PlagePrix[];
  /** Anomalies graves notifiées à ce passage. */
  anomalies: Anomalie[];
  /** Ce qui était dû. */
  dus: TravauxDus;
  /** Pourquoi rien n'est fait (« avant 8 h »), pour le journal du serveur. */
  raison?: string;
}

/**
 * Ce que le passage doit faire maintenant. Idempotent : avec l'état qu'il
 * vient d'écrire, un nouveau passage le même jour ne refait ni le calcul ni
 * la notification des prix, ne recherche pas les anomalies avant une heure,
 * et ne renotifie aucune anomalie.
 */
export function planifierPassage(e: EntreesPassage): PlanPassage {
  const lu = lireElementsPrix(e.elements);
  const etat = e.etat ?? lu.etat;
  const dus = travauxDus(etat, e.maintenant, { notifier: e.notifier, aujourdhui: e.aujourdhui });
  const vide: PlanPassage = { ecritures: [], notifications: [], conseils: [], anomalies: [], dus };
  if (heureParisDe(e.maintenant) < HEURE_MATIN_PRIX) return { ...vide, raison: 'avant 8 h à Paris' };
  if (!dus.prix && !dus.anomalies) return { ...vide, raison: 'rien de dû' };
  const aujourdhui = e.aujourdhui ?? jourParisDe(e.maintenant);
  const maintenant: Horodatage = e.maintenant.toISOString();
  const { reglages, decisions } = lu;
  const suivant: EtatPrix = { ...(etat ?? { id: ID_ETAT_PRIX, genre: 'etat' }), id: ID_ETAT_PRIX, genre: 'etat', majLe: maintenant };
  const notifications: GroupeNotification[] = [];
  let conseils: PlagePrix[] = [];

  if (dus.prix) {
    conseils = conseillerPrix({ logements: e.logements, reservations: e.reservations, reglages, decisions, aujourdhui, maintenant });
    const notif = e.notifier !== false && reglages.actif && reglages.notifications ? notificationPrix(conseils, aujourdhui) : null;
    if (notif) notifications.push(notif);
    const limite = plusJours(aujourdhui, -JOURS_HISTORIQUE);
    suivant.dernierCalcul = aujourdhui;
    suivant.derniers = conseils.slice(0, MAX_DERNIERS).map(resumerPlage);
    suivant.historique = [
      ...(etat?.historique ?? []).filter((h) => h.date > limite && h.date !== aujourdhui),
      { date: aujourdhui, conseils: conseils.length, logements: new Set(conseils.map((c) => c.logementId)).size, notifie: !!notif },
    ];
  }

  let anomalies: Anomalie[] = [];
  if (dus.anomalies) {
    anomalies = anomaliesANotifier(detecterAnomalies({ ...e, aujourdhui, maintenant }), etat?.anomaliesNotifiees);
    const memoire = Object.fromEntries(Object.entries(etat?.anomaliesNotifiees ?? {}).filter(([, d]) => d > plusJours(aujourdhui, -JOURS_MEMOIRE_ANOMALIES)));
    const notif = notificationAnomalies(anomalies, aujourdhui);
    if (notif) notifications.push(notif);
    for (const a of anomalies) memoire[a.id] = aujourdhui;
    suivant.anomaliesNotifiees = memoire;
    suivant.anomaliesVerifieesLe = maintenant;
  }
  return { ecritures: [suivant], notifications, conseils, anomalies, dus };
}

/* ------------------------------------------------------------ exécution */

/** Ce dont le passage a besoin de la base de l'espace (BaseErp en production). */
export interface BasePassagePrix {
  lire<T>(collection: string, ids?: string[]): Promise<T[]>;
  lireVersions<T>(collection: string, ids?: string[]): Promise<{ element: T; version: string }[]>;
  /** Écrit seulement si l'élément n'a pas changé depuis sa lecture (vrai : écrit). */
  remplacerSi(collection: string, element: { id: string }, version: string, auteur?: string): Promise<boolean>;
  /** Ajoute seulement les éléments absents ; renvoie le nombre ajouté. */
  ajouterSiAbsent(collection: string, elements: { id: string }[], auteur?: string): Promise<number>;
}

export interface BilanPassage {
  statut: 'rien' | 'fait' | 'deja-pris';
  plan?: PlanPassage;
}

/**
 * Un passage dans un espace : lit l'état (et sa version), puis seulement ce
 * qui est dû ; prend la main en écrivant le nouvel état sous condition, et
 * n'envoie les notifications qu'après. Deux passages simultanés : un seul
 * écrit, un seul envoie.
 */
export async function passerDansEspace(
  base: BasePassagePrix,
  o: { maintenant: Date; notifier: boolean; envoyer: (groupes: GroupeNotification[]) => Promise<unknown> },
): Promise<BilanPassage> {
  if (heureParisDe(o.maintenant) < HEURE_MATIN_PRIX) return { statut: 'rien' };
  const [lu] = await base.lireVersions<EtatPrix>(COLLECTION_PRIX, [ID_ETAT_PRIX]);
  const etat = lu?.element;
  const dus = travauxDus(etat, o.maintenant, { notifier: o.notifier });
  if (!dus.prix && !dus.anomalies) return { statut: 'rien' };

  const vide = Promise.resolve([] as never[]);
  const [elements, logements, reservations, equipe, affectations, absences] = await Promise.all([
    dus.prix ? base.lire<ElementPrix>(COLLECTION_PRIX) : vide,
    base.lire<Logement>('logements'),
    base.lire<Reservation>('reservations'),
    dus.anomalies ? base.lire<MembreEquipe>('equipe') : vide,
    dus.anomalies ? base.lire<AffectationLogement>('affectations') : vide,
    dus.anomalies ? base.lire<AbsenceMembre>('absences') : vide,
  ]);
  const plan = planifierPassage({ elements, etat, logements, reservations, equipe, affectations, absences, maintenant: o.maintenant, notifier: o.notifier });
  const nouvel = plan.ecritures[0];
  if (!nouvel) return { statut: 'rien', plan };

  // Prendre la main AVANT d'envoyer : l'état lu n'a pas bougé (ou n'existe toujours pas).
  const pris = lu ? await base.remplacerSi(COLLECTION_PRIX, nouvel, lu.version, AUTEUR) : (await base.ajouterSiAbsent(COLLECTION_PRIX, [nouvel], AUTEUR)) === 1;
  if (!pris) return { statut: 'deja-pris', plan };
  if (plan.notifications.length) {
    try {
      await o.envoyer(plan.notifications);
    } catch (e) {
      console.warn('[prix] notifications non envoyées', e instanceof Error ? e.message : e);
    }
  }
  return { statut: 'fait', plan };
}
