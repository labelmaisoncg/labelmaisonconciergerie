/**
 * Notifications de l'app installable (Web Push) : ce qu'il faut envoyer.
 *
 * Module pur, sans réseau, utilisable par le navigateur et par le serveur.
 * Le serveur (api/_erp-notifications.ts) photographie la base avant et après
 * une synchronisation, un événement Repull ou un passage de l'agent, puis
 * envoie ce que `notificationsEntre` trouve de nouveau.
 *
 * Une notification = un « groupe » avec une clé d'idempotence (elle ne part
 * qu'une fois) et une ou plusieurs variantes de la plus importante à la
 * moins importante : chaque appareil reçoit la première variante dont le
 * type est activé chez lui. Exemple : un message qui signale une fuite et
 * auquel l'agent a déjà répondu donne une seule notification, « Problème
 * signalé », et non trois.
 */
import { SEUIL_NOTE_CONTROLE } from './constantes.js';
import { lienIncident } from './incidents-erp.js';
import type { FilMessages, Incident, Logement, RaisonEscalade, Reservation } from './types';

export type TypeNotification =
  | 'reservation'
  | 'reservation_modifiee'
  | 'message'
  | 'agent_repondu'
  | 'agent_main'
  | 'probleme'
  | 'avis'
  | 'synchro'
  | 'rappel'
  | 'urgence';

/** Les types, dans l'ordre des réglages, avec leur valeur par défaut. */
export const TYPES_NOTIFICATION: { type: TypeNotification; libelle: string; detail: string; defaut: boolean }[] = [
  { type: 'reservation', libelle: 'Nouvelle réservation', detail: 'Logement, voyageur, dates et montant.', defaut: true },
  { type: 'reservation_modifiee', libelle: 'Réservation annulée ou modifiée', detail: 'Annulation, nouvelles dates ou nombre de voyageurs.', defaut: true },
  { type: 'message', libelle: 'Nouveau message d’un voyageur', detail: 'Le début du message.', defaut: true },
  { type: 'agent_repondu', libelle: 'L’agent a répondu', detail: 'Quand l’agent a répondu à votre place.', defaut: true },
  { type: 'agent_main', libelle: 'L’agent vous passe la main', detail: 'Un voyageur attend votre réponse, avec la raison.', defaut: true },
  { type: 'probleme', libelle: 'Problème signalé dans un logement', detail: 'Panne, fuite, clé, bruit, ménage…', defaut: true },
  { type: 'urgence', libelle: 'Urgence dans un logement', detail: 'Nouvel incident urgent, ou incident confié à un membre de l’équipe.', defaut: true },
  { type: 'avis', libelle: 'Nouvel avis', detail: 'Avec la note ; mis en avant sous 4,5.', defaut: true },
  { type: 'synchro', libelle: 'Mise à jour des plateformes en échec', detail: 'Une fois par jour au plus.', defaut: true },
  { type: 'rappel', libelle: 'Rappel du matin', detail: 'Les arrivées et départs du jour.', defaut: false },
];

export type PreferencesNotifications = Partial<Record<TypeNotification, boolean>>;

const DEFAUTS = Object.fromEntries(TYPES_NOTIFICATION.map((t) => [t.type, t.defaut])) as Record<TypeNotification, boolean>;

/** Ce type est-il activé sur cet appareil ? (réglage absent : valeur par défaut) */
export function estActive(p: PreferencesNotifications | undefined, t: TypeNotification): boolean {
  const v = p?.[t];
  return typeof v === 'boolean' ? v : DEFAUTS[t];
}

/** Préférences propres : seulement des types connus et des booléens. */
export function nettoyerPreferences(p: unknown): PreferencesNotifications {
  const res: PreferencesNotifications = {};
  if (!p || typeof p !== 'object') return res;
  for (const { type } of TYPES_NOTIFICATION) {
    const v = (p as Record<string, unknown>)[type];
    if (typeof v === 'boolean') res[type] = v;
  }
  return res;
}

export interface VarianteNotification {
  type: TypeNotification;
  titre: string;
  corps: string;
  /** Écran ouvert au toucher (toujours sous /erp). */
  url: string;
}

export interface GroupeNotification {
  /** Clé d'idempotence : la même notification ne part qu'une fois. */
  cle: string;
  /** De la plus importante à la moins importante. */
  variantes: VarianteNotification[];
  /** Importante (problème, voyageur qui attend) : livrée tout de suite. */
  urgente?: boolean;
}

/** La variante à envoyer à un appareil (undefined : rien pour lui). */
export function varianteAEnvoyer(g: GroupeNotification, p: PreferencesNotifications | undefined): VarianteNotification | undefined {
  return g.variantes.find((v) => estActive(p, v.type));
}

/* --------------------------------------------------------------- outils */

/** « Alex Morgan » → « Alex M. » : un écran verrouillé n'affiche pas le nom complet. */
export function prenomInitiale(nom: string): string {
  const mots = String(nom ?? '').trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return 'Un voyageur';
  if (mots.length === 1) return mots[0];
  const dernier = mots[mots.length - 1].replace(/\.$/, '');
  return `${mots[0]} ${dernier.charAt(0).toUpperCase()}.`;
}

/** Début d'un texte sur une ligne, borné. */
export function extrait(texte: string, max = 140): string {
  const t = String(texte ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const jourMois = (d: string) => `${Number(d.slice(8, 10))} ${MOIS[Number(d.slice(5, 7)) - 1] ?? ''}`.trim();

/** « 12–15 nov. », « 28 oct. – 2 nov. » */
export function plage(arrivee: string, depart: string): string {
  if (arrivee.slice(0, 7) === depart.slice(0, 7)) return `${Number(arrivee.slice(8, 10))}–${jourMois(depart)}`;
  return `${jourMois(arrivee)} – ${jourMois(depart)}`;
}

const euros = (centimes: number) => `${Math.round(centimes / 100).toLocaleString('fr-FR').replace(/ | /g, ' ')} €`;

const RAISONS: Record<RaisonEscalade, string> = {
  argent: 'question d’argent (remboursement, geste…)',
  litige: 'litige ou problème sur place',
  hors_fiche: 'réponse absente des infos du logement',
  exception: 'demande d’exception',
  autre: 'à voir par l’équipe',
};

/* ------------------------------------------------ problème signalé */

// Formulations d'un problème sur place (français et anglais). Prudent : une
// simple question (« où est la clé ? ») n'en est pas un.
const PROBLEMES: RegExp[] = [
  /\b(en panne|hors service|ne (marche|fonctionne|s'allume) (plus|pas)|ne s'allume pas|ne chauffe (plus|pas))\b/,
  /\bfuite|inond|d[ée]g[âa]ts? des eaux/,
  /\b(pas|plus) d'eau( chaude)?\b|\beau (est )?(froide|coup[ée]e)\b/,
  /\b(pas|plus) de chauffage\b|\bchauffage\b.{0,25}\b(panne|coup[ée]|marche pas|fonctionne pas)|\bradiateurs?\b.{0,20}\b(froids?|marche pas|fonctionne pas)/,
  /\b(cl[ée]f?|cl[ée]s|badge|code|bo[iî]te [àa] cl[ée]s?)\b.{0,40}\b(perdu|introuvable|ne (marche|fonctionne)|bloqu|cass|impossible|pas dedans|vide|ne s'ouvre)/,
  /\b(impossible|pas pu|n'arrive pas|on n'arrive pas|je n'arrive pas) (d'|de |à |a )?(entrer|ouvrir|rentrer|acc[ée]der)/,
  /\bporte\b.{0,25}\b(bloqu|coinc|ne s'ouvre|ferm[ée]e? [àa] cl[ée])/,
  /\bbruit|bruyant|tapage/,
  /\bcass[ée]e?s?\b|\bbris[ée]e?s?\b|\bab[îi]m[ée]/,
  /\bsale\b|\bsales\b|salet[ée]|pas propre|mal nettoy|pas (été )?nettoy/,
  /cafards?|punaises?|nuisibles?|\bsouris\b|\brats?\b|insectes?|moisissure/,
  /coupure (de |d')?(courant|[ée]lectricit[ée]|eau|internet)|(pas|plus) d'([ée]lectricit[ée]|internet|wifi|wi-fi)|wi-?fi\b.{0,20}\b(ne (marche|fonctionne)|coup[ée]|en panne)/,
  /\b(not working|doesn'?t work|does not work|stopped working|out of order|broken|leak(ing)?|flood(ed|ing)?|no hot water|no water|no heating|heating (is )?(off|broken|not working)|locked out|can'?t (get in|open|enter)|cannot (get in|open|enter)|key.{0,25}(lost|missing|doesn'?t|not)|noisy|noise|dirty|filthy|cockroach|bed ?bugs?|\bmice\b|\bmouse\b|\brats?\b|mou?ld|power (outage|cut)|no (power|electricity|internet|wifi|wi-fi)|wi-?fi (is )?(down|not working))\b/,
];

/** Le message parle-t-il d'un problème dans le logement ? */
export function estProbleme(texte: string): boolean {
  const t = String(texte ?? '')
    .toLowerCase()
    .replace(/[’`´]/g, "'");
  return PROBLEMES.some((r) => r.test(t));
}

/* --------------------------------------------- avant / après la base */

export interface Instantane {
  reservations: Reservation[];
  fils: FilMessages[];
  logements: Logement[];
}

/** Au-delà, une synchronisation qui importe beaucoup d'un coup (première connexion) donne un résumé. */
const MAX_DETAIL = 5;
/** Un message plus ancien est un historique importé, pas une nouveauté. */
const FRAICHEUR_MESSAGE_MS = 48 * 3_600_000;

const estConfirmee = (r: Reservation) => r.statut === 'confirmee' || r.statut === 'en_cours';

/**
 * Ce qui est nouveau entre deux photographies de la base : réservations
 * créées, annulées ou modifiées, avis, messages de voyageurs, réponses et
 * passages de main de l'agent, problèmes signalés.
 */
export function notificationsEntre(avant: Instantane, apres: Instantane, maintenant: Date): GroupeNotification[] {
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  const nomLogement = (id: string) => apres.logements.find((l) => l.id === id)?.nom ?? avant.logements.find((l) => l.id === id)?.nom ?? 'un logement';

  /* réservations */
  const resaAvant = new Map(avant.reservations.map((r) => [r.id, r]));
  const nouvelles: Reservation[] = [];
  const modifiees: GroupeNotification[] = [];
  const avis: GroupeNotification[] = [];
  for (const r of apres.reservations) {
    const p = resaAvant.get(r.id);
    const url = `/erp/reservations/${r.id}`;
    const qui = prenomInitiale(r.voyageur?.nom ?? '');
    if (!p) {
      if (estConfirmee(r) && r.depart >= aujourdhui) nouvelles.push(r);
      continue;
    }
    if (p.statut !== 'annulee' && r.statut === 'annulee') {
      modifiees.push({
        cle: `resa-${r.id}-annulee`,
        variantes: [{ type: 'reservation_modifiee', titre: `Réservation annulée · ${nomLogement(r.logementId)}`, corps: `${qui}, ${plage(r.arrivee, r.depart)}`, url }],
      });
    } else if (r.statut !== 'annulee' && (p.arrivee !== r.arrivee || p.depart !== r.depart || p.voyageur?.nbPersonnes !== r.voyageur?.nbPersonnes)) {
      const avantTexte = p.arrivee !== r.arrivee || p.depart !== r.depart ? ` (avant : ${plage(p.arrivee, p.depart)})` : '';
      modifiees.push({
        cle: `resa-${r.id}-modif-${r.arrivee}-${r.depart}-${r.voyageur?.nbPersonnes ?? ''}`,
        variantes: [
          {
            type: 'reservation_modifiee',
            titre: `Réservation modifiée · ${nomLogement(r.logementId)}`,
            corps: `${qui}, ${plage(r.arrivee, r.depart)}, ${r.voyageur?.nbPersonnes ?? '?'} voyageur${(r.voyageur?.nbPersonnes ?? 0) > 1 ? 's' : ''}${avantTexte}`,
            url,
          },
        ],
      });
    }
    if (p.noteVoyageur === undefined && typeof r.noteVoyageur === 'number') {
      const basse = r.noteVoyageur < SEUIL_NOTE_CONTROLE;
      const note = String(Math.round(r.noteVoyageur * 10) / 10).replace('.', ',');
      avis.push({
        cle: `avis-${r.id}`,
        urgente: basse,
        variantes: [
          {
            type: 'avis',
            titre: `${basse ? 'Avis à lire' : 'Nouvel avis'} · ${note} sur 5`,
            corps: `${qui} · ${nomLogement(r.logementId)}${r.commentaireVoyageur ? ` : « ${extrait(r.commentaireVoyageur, 110)} »` : ''}`,
            url,
          },
        ],
      });
    }
  }

  const groupes: GroupeNotification[] = [];
  if (nouvelles.length > MAX_DETAIL) {
    groupes.push({
      cle: `resa-lot-${nouvelles.map((r) => r.id).sort().join(',').slice(0, 180)}`,
      variantes: [{ type: 'reservation', titre: `${nouvelles.length} nouvelles réservations`, corps: 'Arrivées depuis les plateformes.', url: '/erp/reservations?vue=liste' }],
    });
  } else {
    for (const r of nouvelles) {
      const nuits = r.nuits ? `, ${r.nuits} nuit${r.nuits > 1 ? 's' : ''}` : '';
      groupes.push({
        cle: `resa-${r.id}-creee`,
        variantes: [
          {
            type: 'reservation',
            titre: `Nouvelle réservation · ${nomLogement(r.logementId)}`,
            corps: `${prenomInitiale(r.voyageur?.nom ?? '')}, ${plage(r.arrivee, r.depart)}${nuits}${r.montantBrutCentimes ? ` · ${euros(r.montantBrutCentimes)}` : ''}`,
            url: `/erp/reservations/${r.id}`,
          },
        ],
      });
    }
  }
  groupes.push(...modifiees.slice(0, MAX_DETAIL * 2), ...avis.slice(0, MAX_DETAIL));

  /* conversations : une notification par conversation et par passage, la plus importante */
  const filsAvant = new Map(avant.fils.map((f) => [f.id, f]));
  const limite = maintenant.getTime() - FRAICHEUR_MESSAGE_MS;
  for (const f of apres.fils) {
    const p = filsAvant.get(f.id);
    const connus = new Set((p?.messages ?? []).map((m) => m.id));
    const nouveaux = (f.messages ?? []).filter((m) => !connus.has(m.id) && Date.parse(m.envoyeLe) >= limite);
    const voyageur = nouveaux.filter((m) => m.auteur === 'voyageur');
    const agent = nouveaux.filter((m) => m.auteur === 'agent');
    const passeLaMain =
      (f.statut === 'escalade' && p?.statut !== 'escalade' && !!p) ||
      // Transmise, ou réponse préparée par l'agent et gardée « à valider ».
      ((f.agent?.decision === 'transmettre' || f.agent?.decision === 'a_valider') && !!f.agent.le && f.agent.le !== p?.agent?.le && f.traitePar === 'en_attente');
    const litige = f.raisonEscalade === 'litige' && p?.raisonEscalade !== 'litige' && passeLaMain;
    const probleme = litige || voyageur.some((m) => estProbleme(m.texte));
    if (!voyageur.length && !agent.length && !passeLaMain) continue;

    const qui = prenomInitiale(f.voyageur);
    const logement = nomLogement(f.logementId);
    const url = `/erp/messagerie/${f.id}`;
    const dernierVoyageur = voyageur[voyageur.length - 1];
    const variantes: VarianteNotification[] = [];
    if (probleme) {
      variantes.push({ type: 'probleme', titre: `Problème signalé · ${logement}`, corps: `${qui} : ${extrait(dernierVoyageur?.texte ?? f.agent?.resume ?? 'voir la conversation')}`, url });
    }
    if (passeLaMain) {
      const raison = f.agent?.decision === 'a_valider' ? 'réponse préparée par l’agent, à valider' : f.raisonEscalade ? RAISONS[f.raisonEscalade] : 'à voir par l’équipe';
      variantes.push({
        type: 'agent_main',
        titre: `${qui} attend votre réponse`,
        corps: `${logement} · ${raison}${f.agent?.resume ? ` : ${extrait(f.agent.resume, 100)}` : ''}`,
        url,
      });
    }
    if (agent.length) {
      variantes.push({ type: 'agent_repondu', titre: `L’agent a répondu à ${qui}`, corps: `${logement} · « ${extrait(agent[agent.length - 1].texte, 110)} »`, url });
    }
    if (dernierVoyageur) {
      variantes.push({ type: 'message', titre: `${qui} · ${logement}`, corps: extrait(dernierVoyageur.texte), url });
    }
    const repere = nouveaux.length ? nouveaux[nouveaux.length - 1].id : `main-${f.agent?.le ?? f.dernierMessageLe}`;
    groupes.push({ cle: `fil-${f.id}-${repere}`, variantes, urgente: probleme || passeLaMain });
  }
  return groupes;
}

/* -------------------------------------------- notifications planifiées */

/** Rappel du matin : arrivées et départs du jour (rien s'il n'y en a pas). */
export function rappelDuMatin(reservations: Reservation[], logements: Logement[], aujourdhui: string): GroupeNotification | null {
  const actives = reservations.filter((r) => r.statut !== 'annulee');
  const arrivees = actives.filter((r) => r.arrivee === aujourdhui);
  const departs = actives.filter((r) => r.depart === aujourdhui);
  if (!arrivees.length && !departs.length) return null;
  const nom = (id: string) => logements.find((l) => l.id === id)?.nom ?? 'un logement';
  const nb = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  const parties = [arrivees.length ? nb(arrivees.length, 'arrivée') : '', departs.length ? nb(departs.length, 'départ') : ''].filter(Boolean);
  const lieux = [...new Set([...arrivees, ...departs].map((r) => nom(r.logementId)))];
  return {
    cle: `rappel-${aujourdhui}`,
    variantes: [
      {
        type: 'rappel',
        titre: `Aujourd’hui : ${parties.join(', ')}`,
        corps: lieux.length > 3 ? `${lieux.slice(0, 3).join(', ')} et ${lieux.length - 3} autre${lieux.length > 4 ? 's' : ''}` : lieux.join(', '),
        url: '/erp',
      },
    ],
  };
}

/** Mise à jour des plateformes en échec : une notification par jour au plus. */
export function synchroEnEchec(aujourdhui: string, raison: string): GroupeNotification {
  return {
    cle: `synchro-${aujourdhui}`,
    variantes: [{ type: 'synchro', titre: 'Airbnb et Booking : mise à jour en échec', corps: extrait(raison || 'Ouvrez Paramètres → Plateformes pour relancer.', 140), url: '/erp/parametres/plateformes' }],
  };
}

/**
 * Espace Opérations : un incident urgent vient d'être signalé, ou un incident
 * vient d'être confié à quelqu'un. Une notification par incident et par
 * personne assignée (rien pour un incident normal sans personne, ni résolu).
 */
export function notificationUrgence(
  i: Pick<Incident, 'id' | 'logementId' | 'gravite' | 'statut' | 'description' | 'assigneA'>,
  logement: string,
  assigne?: string,
): GroupeNotification | null {
  const urgent = i.gravite === 'haute';
  if (i.statut === 'resolu' || (!urgent && !i.assigneA)) return null;
  const qui = assigne ? prenomInitiale(assigne) : '';
  return {
    cle: `urgence-${i.id}-${i.assigneA ?? 'personne'}`,
    urgente: urgent,
    variantes: [
      {
        type: 'urgence',
        titre: urgent ? `Urgence · ${logement || 'un logement'}` : `Incident confié à ${qui || 'l’équipe'} · ${logement || 'un logement'}`,
        corps: `${extrait(i.description, 120)}${urgent && qui ? ` (${qui})` : ''}`,
        url: lienIncident(i),
      },
    ],
  };
}

/** Notification d'essai (bouton « Envoyer une notification de test »), au nom de l'espace (Label Maison par défaut). */
export function notificationTest(cle: string, nomEspace = 'Label Maison'): GroupeNotification {
  return {
    cle,
    variantes: [{ type: 'message', titre: nomEspace, corps: 'Les notifications fonctionnent sur cet appareil.', url: '/erp/parametres/application' }],
  };
}

/* ------------------------------------- demande à la première ouverture */

/** « Plus tard » sur la demande d'autorisation : on ne la repose pas avant ce délai. */
export const JOURS_PLUS_TARD_NOTIFICATIONS = 7;

/** Tout ce qui décide d'afficher « Recevoir les notifications ? » à l'ouverture de l'ERP. */
export interface ContexteDemandeNotifications {
  demo: boolean;
  /** Clés présentes sur le serveur (`?action=etat`). */
  serveurActif: boolean;
  /** Notification.permission, ou 'indisponible' sans API Notification. */
  permission: 'default' | 'granted' | 'denied' | 'indisponible';
  /** Service worker, PushManager et Notification présents. */
  navigateurCapable: boolean;
  iphone: boolean;
  /** Ouvert comme une app (display-mode: standalone). */
  dansLApp: boolean;
  /** Cet appareil a déjà un abonnement. */
  abonne: boolean;
  /** Date (ms) du dernier « Plus tard », s'il y en a un. */
  plusTardLe: number | null;
  /** Refusée depuis cette fenêtre : on ne la repropose plus. */
  refusee: boolean;
  /** La proposition d'installation de l'app est affichée. */
  propositionInstallation: boolean;
  /** Une autre fenêtre (feuille, tiroir, recherche) est ouverte. */
  autreFenetre: boolean;
  maintenant: number;
}

export type RaisonDemande =
  | 'demo'
  | 'serveur-inactif'
  | 'navigateur'
  | 'iphone-hors-app'
  | 'deja-decide'
  | 'refusee'
  | 'abonne'
  | 'plus-tard'
  | 'installation'
  | 'autre-fenetre'
  | 'proposer';

/**
 * Faut-il demander les notifications à l'ouverture de l'ERP ? Toutes les
 * conditions sont requises ; la réponse dit laquelle manque (dans l'ordre de
 * vérification), ou « proposer ». Sur iPhone, seulement dans l'app de l'écran
 * d'accueil : dans Safari, c'est la proposition d'installation qui parle.
 */
export function demandeNotifications(c: ContexteDemandeNotifications): RaisonDemande {
  if (c.demo) return 'demo';
  if (!c.serveurActif) return 'serveur-inactif';
  if (c.iphone && !c.dansLApp) return 'iphone-hors-app';
  if (!c.navigateurCapable || c.permission === 'indisponible') return 'navigateur';
  if (c.permission !== 'default') return 'deja-decide';
  if (c.refusee) return 'refusee';
  if (c.abonne) return 'abonne';
  if (c.plusTardLe !== null && c.maintenant - c.plusTardLe < JOURS_PLUS_TARD_NOTIFICATIONS * 86_400_000) return 'plus-tard';
  if (c.propositionInstallation) return 'installation';
  if (c.autreFenetre) return 'autre-fenetre';
  return 'proposer';
}
