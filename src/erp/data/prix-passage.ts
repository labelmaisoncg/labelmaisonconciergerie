/**
 * Passage du matin des prix conseillés et des anomalies, sans réseau : ce
 * que le serveur doit écrire et notifier (api/_prix-conseils.ts l'exécute
 * à chaque réveil planifié de l'agent, toutes les 30 minutes).
 *
 * - Rien avant 8 h à Paris.
 * - Prix : un seul calcul par jour (état `dernierCalcul`), et au plus une
 *   notification groupée, « 3 logements : prix à revoir », qui ouvre le
 *   logement le plus pressé (clé `prix-<jour>` : jamais deux fois).
 * - Anomalies graves (double réservation, départ sans personne, réservation
 *   inhabituelle) : regardées à chaque passage, chacune notifiée une seule
 *   fois (mémoire `anomaliesNotifiees`, gardée 30 jours).
 * Le passage n'écrit que dans la collection des prix conseillés de l'espace.
 * Jamais vers Airbnb ou Booking.
 *
 * Imports en « .js » : ce module tourne côté serveur.
 */
import { anomaliesANotifier, detecterAnomalies, type Anomalie, type EntreesAnomalies } from './anomalies.js';
import { conseillerPrix, lireElementsPrix, plusJours, resumerPlage, type ElementPrix, type EtatPrix, type PlagePrix } from './prix-conseils.js';
import type { GroupeNotification } from './notifications';
import type { DateISO, Horodatage } from './types';

/** Heure de Paris à partir de laquelle part le passage du matin. */
export const HEURE_MATIN_PRIX = 8;
/** Jours d'historique gardés dans l'état. */
const JOURS_HISTORIQUE = 90;
const JOURS_MEMOIRE_ANOMALIES = 30;
const MAX_DERNIERS = 120;

/** Heure (0–23) à Paris d'un instant. */
export function heureParisDe(d: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(d));
}

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

export interface EntreesPassage extends Omit<EntreesAnomalies, 'maintenant' | 'aujourdhui'> {
  /** Éléments de la collection des prix conseillés (réglages, décisions, état). */
  elements: readonly ElementPrix[];
  /** Instant du passage. */
  maintenant: Date;
  /** Jour à Paris (par défaut : celui de `maintenant`). */
  aujourdhui?: DateISO;
  /** Notifications possibles (clés du serveur présentes) ; sans : calcul et historique seulement. */
  notifier?: boolean;
}

export interface PlanPassage {
  /** À écrire dans la collection des prix conseillés (l'état seulement). */
  ecritures: EtatPrix[];
  notifications: GroupeNotification[];
  /** Conseils calculés à ce passage (vide : déjà calculés aujourd'hui, ou trop tôt). */
  conseils: PlagePrix[];
  /** Anomalies graves notifiées à ce passage. */
  anomalies: Anomalie[];
  /** Pourquoi rien n'est fait (« avant 8 h »), pour le journal du serveur. */
  raison?: string;
}

/**
 * Ce que le passage doit faire maintenant. Idempotent : avec l'état qu'il
 * vient d'écrire, un nouveau passage le même jour ne refait ni le calcul ni
 * la notification des prix, et ne renotifie aucune anomalie.
 */
export function planifierPassage(e: EntreesPassage): PlanPassage {
  const vide: PlanPassage = { ecritures: [], notifications: [], conseils: [], anomalies: [] };
  if (heureParisDe(e.maintenant) < HEURE_MATIN_PRIX) return { ...vide, raison: 'avant 8 h à Paris' };
  const aujourdhui = e.aujourdhui ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(e.maintenant);
  const maintenant: Horodatage = e.maintenant.toISOString();
  const { reglages, decisions, etat } = lireElementsPrix(e.elements);
  const suivant: EtatPrix = { ...(etat ?? { id: 'etat', genre: 'etat' }), id: 'etat', genre: 'etat' };
  let change = false;
  const notifications: GroupeNotification[] = [];
  let conseils: PlagePrix[] = [];

  if (etat?.dernierCalcul !== aujourdhui) {
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
    change = true;
  }

  // Sans notification possible, les anomalies ne sont pas marquées « notifiées » : elles partiront quand ce sera possible.
  const anomalies = e.notifier === false ? [] : anomaliesANotifier(detecterAnomalies({ ...e, aujourdhui, maintenant }), etat?.anomaliesNotifiees);
  const memoire = Object.fromEntries(Object.entries(etat?.anomaliesNotifiees ?? {}).filter(([, d]) => d > plusJours(aujourdhui, -JOURS_MEMOIRE_ANOMALIES)));
  if (anomalies.length) {
    const notif = notificationAnomalies(anomalies, aujourdhui);
    if (notif) notifications.push(notif);
    for (const a of anomalies) memoire[a.id] = aujourdhui;
  }
  if (anomalies.length || Object.keys(memoire).length !== Object.keys(etat?.anomaliesNotifiees ?? {}).length) {
    suivant.anomaliesNotifiees = memoire;
    change = true;
  }
  if (change) suivant.majLe = maintenant;
  return { ecritures: change ? [suivant] : [], notifications, conseils, anomalies };
}
