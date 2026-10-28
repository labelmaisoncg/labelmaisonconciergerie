/**
 * Briefing du matin, côté serveur : la notification « Briefing du matin »
 * (type `rappel`) envoyée par le passage planifié de l'agent
 * (api/erp-agent.ts → api/_briefing.ts), dans chaque espace actif.
 *
 * - Fenêtre : de 7 h à midi, heure de Paris (le réveil passe aussi la nuit,
 *   et un briefing « du matin » l'après-midi n'aurait pas de sens).
 * - Une fois par jour et par espace : état `briefing-etat` dans la
 *   collection technique des gérants (`connecteurs`, comme le journal des
 *   notifications), écrit sous condition AVANT l'envoi (la version lue, ou
 *   « s'il n'existe pas encore ») : deux passages simultanés n'en envoient
 *   qu'un.
 * - Rien de dû : une seule lecture (l'état). Aucun appareil ne veut le
 *   briefing : deux lectures, rien d'autre (il partira au passage suivant si
 *   quelqu'un l'active dans la matinée).
 * - Le 1er du mois, il attend (jusqu'à 10 h au plus) que les brouillons des
 *   factures du mois terminé soient prêts (même passage, en parallèle) :
 *   « factures à valider » est juste dès le premier briefing.
 * - Deux versions : celle du gérant (prix conseillés, factures) pour ses
 *   appareils, celle de l'équipe pour les autres (variante `gerant`).
 *
 * Lecture seule vis-à-vis des plateformes : seule la base de l'ERP est lue
 * (dont l'état de la dernière synchronisation), seul l'état du briefing y
 * est écrit. Imports en « .js » : tourne sous Node.
 */
import { construireBriefing, notificationBriefing, type EntreesBriefing } from './briefing.js';
import { ID_ALERTE_CONTROLE } from './controle-reponse.js';
import { COLLECTION_PASSAGES_FACTURES, moisAFacturerAutomatiquement } from './factures-mensuelles.js';
import { estActive, preferencesPourRole, type GroupeNotification } from './notifications.js';
import { lireAppareils, type BaseNotifications } from './notifications-envoi.js';
import type { DateISO, Horodatage } from './types';

/** Heure de Paris à partir de laquelle le briefing part (comme le passage du matin des opérations). */
export const HEURE_BRIEFING = 7;
/** Heure de Paris après laquelle on ne l'envoie plus ce jour-là. */
export const HEURE_FIN_BRIEFING = 12;
/** Jusqu'à cette heure, le briefing attend les brouillons des factures du mois terminé. */
export const HEURE_ATTENTE_FACTURES = 10;
export const ID_ETAT_BRIEFING = 'briefing-etat';
/** État de la synchronisation des plateformes (repull-synchro.ts : COLLECTION_ETAT, ID_ETAT), lu seulement. */
const COLLECTION_ETAT_REPULL = 'repull';
const ID_ETAT_REPULL = 'etat';
interface EtatSynchroLu {
  id: string;
  derniereSynchro?: string;
  dernierBilan?: { erreurs?: string[] };
}
const COLLECTION = 'connecteurs';
const AUTEUR = 'Briefing du matin';

export interface EtatBriefing {
  id: typeof ID_ETAT_BRIEFING;
  type: 'briefing-etat';
  /** Dernier jour (Paris) traité. */
  dernierJour: DateISO;
  majLe: Horodatage;
  /** Une notification est partie ce jour-là (faux : rien à dire). */
  envoye: boolean;
}

const PARTIES = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });

/** Jour et heure à Paris d'un instant. */
export function parisDe(d: Date): { jour: DateISO; heure: number } {
  const p = Object.fromEntries(PARTIES.formatToParts(d).map((x) => [x.type, x.value]));
  return { jour: `${p.year}-${p.month}-${p.day}`, heure: Number(p.hour) };
}

/** Le briefing peut-il partir à cet instant ? (7 h – midi, Paris) */
export const fenetreBriefing = (d: Date): boolean => {
  const h = parisDe(d).heure;
  return h >= HEURE_BRIEFING && h < HEURE_FIN_BRIEFING;
};

/** Ce dont le passage a besoin de la base de l'espace (BaseErp en production, une base en mémoire pour les vérifications). */
export interface BasePassageBriefing extends BaseNotifications {
  lireVersions<T>(collection: string, ids?: string[]): Promise<{ element: T; version: string }[]>;
  /** Écrit seulement si l'élément n'a pas changé depuis sa lecture (vrai : écrit). */
  remplacerSi(collection: string, element: { id: string }, version: string, auteur?: string): Promise<boolean>;
  /** Ajoute seulement les éléments absents ; renvoie le nombre ajouté. */
  ajouterSiAbsent(collection: string, elements: { id: string }[], auteur?: string): Promise<number>;
}

export interface BilanBriefing {
  statut: 'hors-fenetre' | 'deja-fait' | 'personne' | 'attente-factures' | 'deja-pris' | 'fait';
  notification?: GroupeNotification | null;
}

/**
 * Un passage dans un espace : lit l'état, puis qui veut le briefing, puis
 * les données ; prend la main en écrivant l'état sous condition, et
 * n'envoie qu'ensuite.
 */
export async function passerBriefingDansEspace(
  base: BasePassageBriefing,
  o: { maintenant: Date; envoyer: (groupes: GroupeNotification[]) => Promise<unknown> },
): Promise<BilanBriefing> {
  const { jour, heure } = parisDe(o.maintenant);
  if (heure < HEURE_BRIEFING || heure >= HEURE_FIN_BRIEFING) return { statut: 'hors-fenetre' };
  const [lu] = await base.lireVersions<EtatBriefing>(COLLECTION, [ID_ETAT_BRIEFING]);
  if (lu?.element?.dernierJour === jour) return { statut: 'deja-fait' };

  // Qui le veut : les appareils de l'espace qui ont le type activé (selon le rôle de leur compte).
  const appareils = (await lireAppareils(base)).filter((a) => estActive(preferencesPourRole(a.preferences, a.role), 'rappel'));
  if (!appareils.length) return { statut: 'personne' };
  const gerant = appareils.some((a) => a.role === 'gerant');

  const vide = Promise.resolve([] as never[]);
  const mois = moisAFacturerAutomatiquement(jour);
  const [traceFactures, etatPlateformes, reglages, signalementsLogement, logements, reservations, filsMessages, crm, incidents, avisADeposer, controles, equipe, affectations, absences, conseilsPrix, factures] = await Promise.all([
    gerant ? base.lire<{ id: string }>(COLLECTION_PASSAGES_FACTURES, [mois]) : vide,
    // Dernière mise à jour des plateformes (état de la synchronisation, une ligne) : en échec, ou son heure.
    base.lire<EtatSynchroLu>(COLLECTION_ETAT_REPULL, [ID_ETAT_REPULL]),
    base.lire<NonNullable<EntreesBriefing['reglages']>[number]>('reglages', [ID_ALERTE_CONTROLE]),
    gerant ? base.lire<NonNullable<EntreesBriefing['signalementsLogement']>[number]>('signalementsLogement') : vide,
    base.lire<EntreesBriefing['logements'][number]>('logements'),
    base.lire<EntreesBriefing['reservations'][number]>('reservations'),
    base.lire<EntreesBriefing['filsMessages'][number]>('filsMessages'),
    base.lire<EntreesBriefing['crm'][number]>('crm'),
    base.lire<EntreesBriefing['incidents'][number]>('incidents'),
    base.lire<NonNullable<EntreesBriefing['avisADeposer']>[number]>('avisADeposer'),
    base.lire<NonNullable<EntreesBriefing['controles']>[number]>('controles'),
    base.lire<NonNullable<EntreesBriefing['equipe']>[number]>('equipe'),
    base.lire<NonNullable<EntreesBriefing['affectations']>[number]>('affectations'),
    base.lire<NonNullable<EntreesBriefing['absences']>[number]>('absences'),
    gerant ? base.lire<NonNullable<EntreesBriefing['conseilsPrix']>[number]>('conseilsPrix') : vide,
    gerant ? base.lire<NonNullable<EntreesBriefing['factures']>[number]>('factures') : vide,
  ]);
  // Factures du mois terminé pas encore préparées (le 1er, même passage) : on attend le suivant.
  if (gerant && !traceFactures.length && heure < HEURE_ATTENTE_FACTURES) return { statut: 'attente-factures' };

  const synchro = etatPlateformes[0];
  const entrees = {
    logements, reservations, filsMessages, crm, incidents, avisADeposer, controles, equipe, affectations, absences, conseilsPrix, factures, reglages, signalementsLogement,
    aujourdhui: jour,
    maintenant: o.maintenant.toISOString(),
    // Même lecture que l'écran (dernière ligne de synchronisation du journal) : en échec, ou réussie à telle heure.
    ...(synchro?.dernierBilan?.erreurs?.length ? { synchroEnEchec: true } : synchro?.derniereSynchro ? { derniereSynchro: synchro.derniereSynchro } : {}),
  };
  const equipeB = construireBriefing({ ...entrees, gerant: false });
  const notification = notificationBriefing(gerant ? construireBriefing({ ...entrees, gerant: true }) : equipeB, equipeB);

  // Prendre la main AVANT d'envoyer : l'état lu n'a pas bougé (ou n'existe toujours pas).
  const nouvel: EtatBriefing = { id: ID_ETAT_BRIEFING, type: 'briefing-etat', dernierJour: jour, majLe: o.maintenant.toISOString(), envoye: !!notification };
  const pris = lu ? await base.remplacerSi(COLLECTION, nouvel, lu.version, AUTEUR) : (await base.ajouterSiAbsent(COLLECTION, [nouvel], AUTEUR)) === 1;
  if (!pris) return { statut: 'deja-pris' };
  if (notification) {
    try {
      await o.envoyer([notification]);
    } catch (e) {
      console.warn('[briefing] notification non envoyée', e instanceof Error ? e.message : e);
    }
  }
  return { statut: 'fait', notification };
}
