/**
 * Notifications de l'app « Opérations » (espace /espace-operations installé
 * sur le téléphone des responsables de pôle et des agents de terrain).
 *
 * Sans réseau ni variable d'environnement, comme notifications-envoi.ts :
 * le serveur (api/_operations-notifications.ts) lit la base de l'espace,
 * appelle ces fonctions et envoie ; verifier-operations.ts les contrôle.
 *
 * Qui reçoit quoi (seulement les personnes concernées, seulement leurs
 * logements, jamais l'auteur de l'action) :
 * - incident confié : la personne qui s'en occupe aujourd'hui (le titulaire,
 *   ou son remplaçant pendant une absence) ;
 * - urgence : en plus, qui a la charge du logement aujourd'hui et les
 *   responsables de pôle du logement ;
 * - « Vous remplacez … » : le remplaçant, le premier jour de l'absence (ou
 *   tout de suite quand le pôle la note alors qu'elle a commencé) ;
 * - contrôles qualité du jour : une notification par personne et par jour,
 *   au passage du matin ;
 * - « Ce logement n'est pas à moi » : la réponse du gérant (gardé, retiré).
 *
 * Appareils : collection technique « connecteurs » (réservée aux gérants,
 * jamais lue par la synchronisation du navigateur), un enregistrement par
 * personne (`operations-appareils-<membre>`), lié à son accès : adresse et
 * version de l'accès au moment de l'abonnement. Accès retiré, adresse ou
 * version changée : l'appareil ne reçoit plus rien (et il est oublié dès
 * que le changement est définitif). Chaque espace garde les siens.
 *
 * Contenu : en français, voyageurs jamais nommés, coordonnées masquées dans
 * le texte d'un incident. Un toucher ouvre le bon écran de l'espace.
 *
 * Imports en « .js » : ce module tourne aussi sous Node (fonctions Vercel).
 */
import { accesToujoursDeLaFiche, espaceDe } from './acces-externe.js';
import { appliquerAction, avecEcritures, perimetre, type EntreesOperations } from './espace-operations.js';
import { extrait } from './notifications.js';
import type { BaseNotifications, Envoyeur } from './notifications-envoi.js';
import { ajouterJours, assigneLe, controlesAFaire, court, estUrgent, quiSuit, responsableLe, titulaireDe } from './operations.js';
import type { DateISO, Id } from './types';
import type { AbsenceMembre, AccesOperations, MembreEquipe, SignalementLogement } from './types-operations';
import { envoyerPush, type AbonnementPush, type ClesVapid } from './web-push.js';

/** Collection des appareils et du journal (lisible des seuls gérants, comme les appareils de l'ERP). */
export const COLLECTION_APPAREILS_OPS = 'connecteurs';
export const PREFIXE_APPAREILS_OPS = 'operations-appareils-';
export const ID_JOURNAL_OPS = 'operations-notifications-journal';
const AUTEUR = 'Notifications opérations';
/** Appareils gardés par personne (les plus récents). */
const MAX_APPAREILS = 6;
/** Clés gardées dans le journal d'idempotence (les plus récentes). */
const TAILLE_JOURNAL = 1000;
/** « Ce logement n'est pas à moi » traité depuis moins de ces jours : rattrapé au passage du matin. */
const JOURS_SIGNALEMENT = 2;

export const URL_OPERATIONS = '/espace-operations';

export type MotifOps = 'incident' | 'urgence' | 'remplacement' | 'controles' | 'logement' | 'test';

/** Une notification pour une personne de l'équipe. */
export interface NotificationOps {
  membreId: Id;
  /** Clé d'idempotence : elle ne part qu'une fois. */
  cle: string;
  motif: MotifOps;
  titre: string;
  corps: string;
  /** Écran ouvert au toucher (toujours sous /espace-operations). */
  url: string;
  /** Livrée tout de suite (urgence). */
  urgente?: boolean;
}

/** Ce que l'app annonce, pour la feuille « Recevoir les notifications ? » et la page de l'app. */
export const NOTIFICATIONS_OPS: { motif: Exclude<MotifOps, 'test'>; libelle: string }[] = [
  { motif: 'urgence', libelle: 'Une urgence sur un de vos logements' },
  { motif: 'incident', libelle: 'Un incident qui vous est confié' },
  { motif: 'remplacement', libelle: 'Un remplacement, le premier jour' },
  { motif: 'controles', libelle: 'Les contrôles qualité du jour, le matin' },
  { motif: 'logement', libelle: 'La réponse du gérant à « ce logement n’est pas à moi »' },
];

/* --------------------------------------------------------------- outils */

type Ecran = { onglet?: 'logements' | 'incidents' | 'controles' | 'equipe'; incident?: Id; logement?: Id };

/** Adresse d'un écran de l'espace (lue par la page : onglet, incident, logement). */
export function lienOps(e: Ecran = {}): string {
  const p = new URLSearchParams();
  if (e.onglet) p.set('onglet', e.onglet);
  if (e.incident) p.set('incident', e.incident);
  if (e.logement) p.set('logement', e.logement);
  const q = p.toString();
  return q ? `${URL_OPERATIONS}?${q}` : URL_OPERATIONS;
}

/** Une adresse e-mail ou un numéro tapé dans un incident n'apparaît pas sur l'écran verrouillé. */
export function sansCoordonnees(texte: string): string {
  return String(texte ?? '')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '…')
    .replace(/\+?\d[\d .-]{6,}\d/g, '…');
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const jourMois = (d: DateISO) => `${Number(d.slice(8, 10))} ${MOIS[Number(d.slice(5, 7)) - 1] ?? ''}`.trim();

/** « A », « A et B », « A, B et C », « A, B, C et 2 autres ». */
function enumerer(noms: string[]): string {
  if (noms.length > 3) return `${noms.slice(0, 3).join(', ')} et ${noms.length - 3} autre${noms.length > 4 ? 's' : ''}`;
  if (noms.length > 1) return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
  return noms[0] ?? '';
}

const idValide = (v: unknown): v is Id => typeof v === 'string' && /^[\w-]{1,80}$/.test(v);
const nomLogement = (e: Pick<EntreesOperations, 'logements'>, id: Id) => e.logements.find((l) => l?.id === id)?.nom ?? 'un logement';
const nomMembre = (e: Pick<EntreesOperations, 'equipe'>, id?: Id) => court(e.equipe.find((m) => m?.id === id)?.nom);
/** La personne est dans l'équipe et ce logement est dans son espace. */
const concerne = (e: EntreesOperations, membreId: Id, logementId: Id) => perimetre(e, membreId).has(logementId);
const polesDu = (e: Pick<EntreesOperations, 'equipe'>, logementId: Id) =>
  quiSuit(e.equipe, logementId)
    .filter((m) => m.role === 'pole')
    .map((m) => m.id);

/* ------------------------------------------------------------ incidents */

/**
 * Incidents à annoncer entre deux états de la base : nouvel incident urgent
 * ou passé en urgent, incident confié à quelqu'un (nouveau ou autre
 * personne). Un incident réglé n'est jamais annoncé.
 */
export function notificationsIncidents(avant: Pick<EntreesOperations, 'incidents'>, apres: EntreesOperations, o: { aujourdhui: DateISO; auteurId?: Id }): NotificationOps[] {
  const precedents = new Map(avant.incidents.filter(Boolean).map((i) => [i.id, i]));
  const res: NotificationOps[] = [];
  for (const i of apres.incidents) {
    if (!i || i.statut === 'resolu' || !idValide(i.id)) continue;
    const p = precedents.get(i.id);
    const urgent = estUrgent(i);
    const devenuUrgent = urgent && (!p || !estUrgent(p));
    const confie = !!i.assigneA && i.assigneA !== p?.assigneA;
    if (!devenuUrgent && !confie) continue;
    // Qui s'en occupe aujourd'hui : le titulaire, ou son remplaçant pendant une absence.
    const charge = assigneLe(apres, i, o.aujourdhui).membreId;
    const destinataires = new Set<Id>();
    if (charge) destinataires.add(charge);
    if (devenuUrgent) {
      const enCharge = responsableLe(apres, i.logementId, o.aujourdhui).membreId;
      if (enCharge) destinataires.add(enCharge);
      for (const pole of polesDu(apres, i.logementId)) destinataires.add(pole);
    }
    const logement = nomLogement(apres, i.logementId);
    const texte = extrait(sansCoordonnees(i.description), 110);
    for (const m of destinataires) {
      if (m === o.auteurId || !concerne(apres, m, i.logementId)) continue;
      const pourMoi = m === charge;
      // Seulement confié (pas urgent) : pour la personne qui s'en occupe, personne d'autre.
      if (!pourMoi && !devenuUrgent) continue;
      const qui = charge ? nomMembre(apres, charge) : '';
      res.push({
        membreId: m,
        cle: `ops-incident-${i.id}-${urgent ? 'urgence' : 'confie'}-${i.assigneA ?? 'personne'}-${m}`,
        motif: urgent ? 'urgence' : 'incident',
        titre: `${pourMoi ? (urgent ? 'Urgence confiée' : 'Incident confié') : 'Urgence'} · ${logement}`,
        corps: pourMoi ? texte : `${texte} · ${qui ? `${qui} s’en occupe` : 'Personne dessus pour l’instant'}`,
        url: lienOps({ onglet: 'incidents', incident: i.id }),
        ...(urgent ? { urgente: true } : {}),
      });
    }
  }
  return res;
}

/* ---------------------------------------------------------- remplacements */

/**
 * « Vous remplacez Clara D. » : pour chaque absence en cours ce jour-là, la
 * personne qui reprend ses logements ou ses incidents ouverts (sur son
 * périmètre seulement). Le motif de l'absence n'est jamais dit.
 */
export function notificationsRemplacement(e: EntreesOperations, o: { aujourdhui: DateISO; absences: readonly AbsenceMembre[]; auteurId?: Id }): NotificationOps[] {
  const res: NotificationOps[] = [];
  for (const a of o.absences) {
    if (!a || a.annuleeLe || !idValide(a.id) || a.du > o.aujourdhui || a.au < o.aujourdhui) continue;
    const reprises = new Map<Id, Set<Id>>();
    const ajouter = (r: Id | undefined, logementId: Id) => {
      if (!r || r === a.membreId) return;
      reprises.set(r, (reprises.get(r) ?? new Set()).add(logementId));
    };
    for (const l of e.logements) if (l && l.statut !== 'sorti' && titulaireDe(e, l.id) === a.membreId) ajouter(responsableLe(e, l.id, o.aujourdhui).membreId, l.id);
    for (const i of e.incidents) if (i && i.statut !== 'resolu' && i.assigneA === a.membreId) ajouter(assigneLe(e, i, o.aujourdhui).membreId, i.logementId);
    const absent = nomMembre(e, a.membreId) || 'un collègue';
    for (const [r, ids] of reprises) {
      if (r === o.auteurId) continue;
      const siens = [...ids].filter((l) => concerne(e, r, l));
      if (!siens.length) continue;
      const noms = siens.map((l) => nomLogement(e, l)).sort((x, y) => x.localeCompare(y, 'fr'));
      res.push({
        membreId: r,
        cle: `ops-remplacement-${a.id}-${a.du}-${a.au}-${r}`,
        motif: 'remplacement',
        titre: `Vous remplacez ${absent}`,
        corps: `${a.au === o.aujourdhui ? 'Aujourd’hui' : `Jusqu’au ${jourMois(a.au)}`} : ${enumerer(noms)}.`,
        url: siens.length === 1 ? lienOps({ onglet: 'logements', logement: siens[0] }) : lienOps({ onglet: 'logements' }),
      });
    }
  }
  return res;
}

/* --------------------------------------------------- contrôles du jour */

/**
 * Contrôles qualité à faire aujourd'hui : une notification par personne et
 * par jour, à qui a la charge du logement (sinon aux responsables de pôle
 * du logement). Les contrôles en retard ont déjà leur place dans l'espace.
 */
export function notificationsControlesDuJour(e: EntreesOperations, aujourdhui: DateISO): NotificationOps[] {
  const parPersonne = new Map<Id, Set<Id>>();
  for (const c of controlesAFaire(e, aujourdhui)) {
    if (c.echeance !== aujourdhui) continue;
    const enCharge = responsableLe(e, c.logementId, aujourdhui).membreId;
    for (const m of enCharge ? [enCharge] : polesDu(e, c.logementId)) {
      if (concerne(e, m, c.logementId)) parPersonne.set(m, (parPersonne.get(m) ?? new Set()).add(c.logementId));
    }
  }
  return [...parPersonne].map(([m, ids]) => {
    const n = [...ids].length;
    const noms = [...ids].map((l) => nomLogement(e, l)).sort((x, y) => x.localeCompare(y, 'fr'));
    return {
      membreId: m,
      cle: `ops-controles-${aujourdhui}-${m}`,
      motif: 'controles' as const,
      titre: `Aujourd’hui : ${n} contrôle${n > 1 ? 's' : ''} qualité`,
      corps: `${enumerer(noms)}.`,
      url: lienOps({ onglet: 'controles' }),
    };
  });
}

/* ------------------------------------- « ce logement n'est pas à moi » */

/** La réponse du gérant, pour la personne qui a signalé. */
export function notificationSignalementTraite(e: EntreesOperations, s: SignalementLogement | undefined): NotificationOps | null {
  if (!s || s.statut !== 'traite' || (s.decision !== 'retire' && s.decision !== 'confirme') || !idValide(s.id)) return null;
  if (!e.equipe.some((m) => m?.id === s.membreId && m.actif)) return null;
  const garde = s.decision === 'confirme';
  // Gardé : le logement doit être encore dans son espace ; retiré : il n'y est plus, le nom lui est déjà connu.
  if (garde && !concerne(e, s.membreId, s.logementId)) return null;
  const nom = nomLogement(e, s.logementId);
  return {
    membreId: s.membreId,
    cle: `ops-signalement-${s.id}`,
    motif: 'logement',
    titre: `${garde ? 'Logement confirmé' : 'Logement retiré'} · ${nom}`,
    corps: garde ? 'Le gérant a répondu : ce logement reste à vous.' : 'Le gérant a répondu : ce logement n’est plus dans votre espace.',
    url: garde ? lienOps({ onglet: 'logements', logement: s.logementId }) : lienOps({ onglet: 'logements' }),
  };
}

/* ------------------------------------------------------ quand envoyer */

const pareil = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Après une action de l'espace : incidents (urgence, confié) et absences
 * notées ou changées qui sont en cours aujourd'hui (le remplaçant est
 * prévenu tout de suite ; une absence à venir l'est le matin de son début).
 */
export function notificationsApresAction(avant: EntreesOperations, apres: EntreesOperations, o: { aujourdhui: DateISO; auteurId: Id }): NotificationOps[] {
  const absencesAvant = new Map(avant.absences.filter(Boolean).map((a) => [a.id, a]));
  const absences = apres.absences.filter((a) => a && !pareil(absencesAvant.get(a.id), a));
  return [...notificationsIncidents(avant, apres, o), ...notificationsRemplacement(apres, { ...o, absences })];
}

/** Passage du matin : remplacements qui commencent, contrôles du jour, réponses du gérant des derniers jours. */
export function notificationsDuJour(e: EntreesOperations, aujourdhui: DateISO): NotificationOps[] {
  const depuis = ajouterJours(aujourdhui, -JOURS_SIGNALEMENT);
  return [
    ...notificationsRemplacement(e, { aujourdhui, absences: e.absences.filter((a) => a?.du === aujourdhui) }),
    ...notificationsControlesDuJour(e, aujourdhui),
    ...e.signalementsLogement
      .filter((s) => s?.statut === 'traite' && String(s.traiteLe ?? '').slice(0, 10) >= depuis)
      .map((s) => notificationSignalementTraite(e, s))
      .filter((n): n is NotificationOps => !!n),
  ];
}

/**
 * Qui recevrait l'urgence si la personne la signalait maintenant sur ce
 * logement (mêmes règles que « Signaler ») : pour le dire avant l'envoi.
 */
export function destinatairesUrgence(e: EntreesOperations, membreId: Id, logementId: Id, aujourdhui: DateISO): Id[] {
  const r = appliquerAction(
    e,
    membreId,
    { type: 'signaler', logementId, urgent: true, description: 'Urgence à venir.' },
    { aujourdhui, maintenant: `${aujourdhui}T12:00:00.000Z`, nouvelId: (p) => `${p}-apercu` },
  );
  if (!r.ok) return [];
  return [...new Set(notificationsIncidents(e, avecEcritures(e, r.ecritures), { aujourdhui, auteurId: membreId }).map((n) => n.membreId))];
}

/** « Le gérant et Clara D. sont prévenus tout de suite. » : les personnes qui recevront vraiment l'urgence. */
export function phrasePrevenus(noms: readonly string[]): string {
  const autres = noms.filter(Boolean);
  if (!autres.length) return 'Le gérant est prévenu tout de suite.';
  return `Le gérant${autres.length > 1 ? `, ${autres.slice(0, -1).join(', ')}` : ''} et ${autres[autres.length - 1]} sont prévenus tout de suite.`;
}

/** Notification d'essai (bouton « Envoyer une notification de test »). */
export function notificationTestOps(membreId: Id, cle: string): NotificationOps {
  return { membreId, cle, motif: 'test', titre: 'Opérations', corps: 'Les notifications fonctionnent sur ce téléphone.', url: URL_OPERATIONS };
}

/* ------------------------------------------------------------- appareils */

/** Un appareil abonné, lié à l'accès de la personne au moment de l'abonnement. */
export interface AppareilOps {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** « iPhone », « Android », « Ordinateur ». */
  nom?: string;
  /** Adresse et version de l'accès : si l'une change, l'appareil ne reçoit plus rien. */
  email: string;
  version: number;
  creeLe: string;
  majLe: string;
}

/** Les appareils d'une personne (id : `operations-appareils-<membre>`). */
export interface AppareilsOps {
  id: string;
  type: 'operations-appareils';
  membreId: Id;
  appareils: AppareilOps[];
  majLe: string;
}

interface JournalOps {
  id: typeof ID_JOURNAL_OPS;
  envoyees: { cle: string; le: string }[];
}

export const idAppareilsOps = (membreId: Id) => `${PREFIXE_APPAREILS_OPS}${membreId}`;
const estEnregistrement = (r: unknown): r is AppareilsOps =>
  !!r && typeof (r as AppareilsOps).id === 'string' && (r as AppareilsOps).id.startsWith(PREFIXE_APPAREILS_OPS) && Array.isArray((r as AppareilsOps).appareils);
const adresse = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/**
 * Un appareil reçoit-il encore ? `valable` ; `ignore` (adresse de la fiche
 * changée sans « Retirer », accès pas encore actif : réversible) ; `oublie`
 * (accès retiré, nouvelle version, personne hors de l'équipe, autre espace).
 */
export function etatAppareil(a: AppareilOps, acces: AccesOperations | undefined, membre: MembreEquipe | undefined, espace: string): 'valable' | 'ignore' | 'oublie' {
  if (!acces || acces.statut === 'retire' || acces.version !== a.version || !membre?.actif || espaceDe(acces.espace) !== espaceDe(espace)) return 'oublie';
  if (acces.statut !== 'actif' || adresse(acces.email) !== adresse(a.email) || !accesToujoursDeLaFiche(acces, { email: membre.email })) return 'ignore';
  return 'valable';
}

/** Enregistre l'appareil de la personne connectée (un même appareil n'appartient qu'à une personne de l'espace). */
export async function abonnerAppareilOps(base: BaseNotifications, o: { membreId: Id; email: string; version: number; abonnement: AbonnementPush; nom?: string; maintenant?: Date }): Promise<void> {
  const le = (o.maintenant ?? new Date()).toISOString();
  const { endpoint, keys } = o.abonnement;
  const tous = (await base.lire<AppareilsOps>(COLLECTION_APPAREILS_OPS)).filter(estEnregistrement);
  const ecritures: AppareilsOps[] = [];
  // Téléphone passé à un collègue : il ne reçoit plus ce qui concernait l'autre.
  for (const r of tous) {
    if (r.membreId !== o.membreId && r.appareils.some((a) => a.endpoint === endpoint)) ecritures.push({ ...r, appareils: r.appareils.filter((a) => a.endpoint !== endpoint), majLe: le });
  }
  const mien = tous.find((r) => r.id === idAppareilsOps(o.membreId));
  const avant = mien?.appareils.find((a) => a.endpoint === endpoint);
  const nom = o.nom ? String(o.nom).slice(0, 40) : avant?.nom;
  const appareil: AppareilOps = { endpoint, keys, ...(nom ? { nom } : {}), email: adresse(o.email), version: o.version, creeLe: avant?.creeLe ?? le, majLe: le };
  const appareils = [...(mien?.appareils ?? []).filter((a) => a.endpoint !== endpoint), appareil].slice(-MAX_APPAREILS);
  ecritures.push({ id: idAppareilsOps(o.membreId), type: 'operations-appareils', membreId: o.membreId, appareils, majLe: le });
  await base.ecrire(COLLECTION_APPAREILS_OPS, ecritures, AUTEUR);
}

/** Cet appareil ne reçoit plus rien (« Couper », déconnexion). Vrai : il était abonné. */
export async function desabonnerAppareilOps(base: BaseNotifications, membreId: Id, endpoint: string): Promise<boolean> {
  const [r] = (await base.lire<AppareilsOps>(COLLECTION_APPAREILS_OPS, [idAppareilsOps(membreId)])).filter(estEnregistrement);
  if (!r?.appareils.some((a) => a.endpoint === endpoint)) return false;
  const suivant: AppareilsOps = { ...r, appareils: r.appareils.filter((a) => a.endpoint !== endpoint), majLe: new Date().toISOString() };
  await base.ecrire(COLLECTION_APPAREILS_OPS, [suivant], AUTEUR);
  return true;
}

/** Accès retiré : plus aucun appareil pour cette personne. */
export async function oublierAppareilsOps(base: BaseNotifications, membreId: Id): Promise<void> {
  const [r] = (await base.lire<AppareilsOps>(COLLECTION_APPAREILS_OPS, [idAppareilsOps(membreId)])).filter(estEnregistrement);
  if (!r?.appareils.length) return;
  const vide: AppareilsOps = { ...r, appareils: [], majLe: new Date().toISOString() };
  await base.ecrire(COLLECTION_APPAREILS_OPS, [vide], AUTEUR);
}

/** Appareils qui reçoivent encore, par personne (lecture seule). */
export async function appareilsValables(base: BaseNotifications, membreIds: readonly Id[], espace: string): Promise<Map<Id, AppareilOps[]>> {
  const ids = [...new Set(membreIds)].filter(idValide);
  const res = new Map<Id, AppareilOps[]>();
  if (!ids.length) return res;
  const [enregistrements, acces, equipe] = await Promise.all([
    base.lire<AppareilsOps>(COLLECTION_APPAREILS_OPS, ids.map(idAppareilsOps)),
    base.lire<AccesOperations>('accesOperations', ids),
    base.lire<MembreEquipe>('equipe', ids),
  ]);
  for (const r of enregistrements.filter(estEnregistrement)) {
    const ok = r.appareils.filter(
      (a) =>
        etatAppareil(
          a,
          acces.find((x) => x?.id === r.membreId),
          equipe.find((x) => x?.id === r.membreId),
          espace,
        ) === 'valable',
    );
    if (ok.length) res.set(r.membreId, ok);
  }
  return res;
}

export interface BilanOps {
  /** Notifications parties (au moins un appareil). */
  envoyees: number;
  /** Déjà parties lors d'un passage précédent. */
  dejaParties: number;
  /** Personne sans appareil qui reçoit : rien à faire. */
  sansAppareil: number;
  /** Abonnements disparus (404/410), oubliés. */
  expires: number;
  /** Appareils oubliés (accès retiré, nouvelle version, personne hors de l'équipe). */
  oublies: number;
}

/**
 * Envoie chaque notification une seule fois (journal), sur les appareils
 * encore valables de la personne. Ne lève jamais.
 */
export async function envoyerNotificationsOps(
  base: BaseNotifications,
  notifications: readonly NotificationOps[],
  o: {
    cles: ClesVapid | null;
    /** Espace de la base (un accès d'un autre espace n'y vaut rien). */
    espace: string;
    maintenant?: Date;
    envoyer?: Envoyeur;
    /** Notification d'essai : sans journal. */
    essai?: boolean;
    /** Un seul appareil (adresse d'abonnement). */
    seulement?: string;
  },
): Promise<BilanOps> {
  const bilan: BilanOps = { envoyees: 0, dejaParties: 0, sansAppareil: 0, expires: 0, oublies: 0 };
  const cles = o.cles;
  if (!cles || !notifications.length) return bilan;
  try {
    const ids = [...new Set(notifications.map((n) => n.membreId))].filter(idValide);
    if (!ids.length) return bilan;
    const [enregistrements, acces, equipe, journalLu] = await Promise.all([
      base.lire<AppareilsOps>(COLLECTION_APPAREILS_OPS, ids.map(idAppareilsOps)),
      base.lire<AccesOperations>('accesOperations', ids),
      base.lire<MembreEquipe>('equipe', ids),
      o.essai ? Promise.resolve([]) : base.lire<JournalOps>(COLLECTION_APPAREILS_OPS, [ID_JOURNAL_OPS]),
    ]);
    const journal: JournalOps = Array.isArray(journalLu[0]?.envoyees) ? journalLu[0] : { id: ID_JOURNAL_OPS, envoyees: [] };
    const deja = new Set(journal.envoyees.map((x) => x.cle));
    const le = (o.maintenant ?? new Date()).toISOString();
    const valables = new Map<Id, AppareilOps[]>();
    const aReecrire = new Map<Id, AppareilsOps>();
    for (const r of enregistrements.filter(estEnregistrement)) {
      const ac = acces.find((x) => x?.id === r.membreId);
      const m = equipe.find((x) => x?.id === r.membreId);
      const etats = r.appareils.map((a) => etatAppareil(a, ac, m, o.espace));
      valables.set(
        r.membreId,
        r.appareils.filter((_, k) => etats[k] === 'valable'),
      );
      const oublies = etats.filter((x) => x === 'oublie').length;
      if (oublies) {
        bilan.oublies += oublies;
        aReecrire.set(r.membreId, { ...r, appareils: r.appareils.filter((_, k) => etats[k] !== 'oublie'), majLe: le });
      }
    }
    const envoyer: Envoyeur = o.envoyer ?? ((a, c, k, x) => envoyerPush(a, c, k, x));
    const expires = new Set<string>();
    const parties: string[] = [];
    for (const n of notifications) {
      if (!o.essai && deja.has(n.cle)) {
        bilan.dejaParties++;
        continue;
      }
      const cibles = (valables.get(n.membreId) ?? []).filter((a) => (!o.seulement || a.endpoint === o.seulement) && !expires.has(a.endpoint));
      if (!cibles.length) {
        bilan.sansAppareil++;
        continue;
      }
      let partie = false;
      for (const a of cibles) {
        const r = await envoyer({ endpoint: a.endpoint, keys: a.keys }, { titre: n.titre, corps: n.corps, url: n.url, tag: n.cle, type: n.motif }, cles, { urgente: n.urgente });
        if (r.ok) partie = true;
        else if (r.expire) expires.add(a.endpoint);
      }
      if (!o.essai) {
        parties.push(n.cle);
        deja.add(n.cle);
      }
      if (partie) bilan.envoyees++;
    }
    if (expires.size) {
      for (const r of enregistrements.filter(estEnregistrement)) {
        const courant = aReecrire.get(r.membreId) ?? r;
        if (courant.appareils.some((a) => expires.has(a.endpoint))) aReecrire.set(r.membreId, { ...courant, appareils: courant.appareils.filter((a) => !expires.has(a.endpoint)), majLe: le });
      }
      bilan.expires = expires.size;
    }
    const ecritures: { id: string }[] = [...aReecrire.values()];
    if (parties.length) ecritures.push({ id: ID_JOURNAL_OPS, envoyees: [...journal.envoyees, ...parties.map((cle) => ({ cle, le }))].slice(-TAILLE_JOURNAL) } as JournalOps);
    if (ecritures.length) await base.ecrire(COLLECTION_APPAREILS_OPS, ecritures, AUTEUR);
  } catch (e) {
    console.warn('[notifications-operations] envoi impossible', e instanceof Error ? e.message : e);
  }
  return bilan;
}

/** Bilan pour les journaux du serveur : des compteurs, jamais de texte ni de nom. */
export const resumeBilan = (b: BilanOps) => `${b.envoyees} envoyée(s), ${b.dejaParties} déjà partie(s), ${b.sansAppareil} sans appareil, ${b.expires} expiré(s), ${b.oublies} oublié(s)`;
