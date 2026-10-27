/**
 * Suppléments proposés aux voyageurs (cahier B7) : arrivée plus tôt, départ
 * plus tard, ménage supplémentaire, navette. Règles pures, partagées par la
 * fiche logement (réglages du gérant), la Messagerie (proposition prête) et
 * le message automatique « Proposer les suppléments » (serveur).
 *
 * - Réglages : collection `reglages`, élément d'id 'supplements' (un par
 *   espace, un bloc par logement), écrit par un gérant seulement
 *   (erp.ecriture_gerant_seulement, ecritures-gerant.ts). Pour chaque
 *   supplément : actif ou non, prix indicatif, heure possible (arrivée dès,
 *   départ jusqu'à), « selon le planning », précision libre.
 * - Disponibilité : vérifiée sur les réservations du logement (un départ le
 *   jour de l'arrivée, ou une arrivée le jour du départ, bloque) et sur les
 *   ménages déjà prévus.
 * - Proposition : un texte au ton de la marque, avec le prix réglé, que
 *   l'équipe relit et envoie comme une réponse normale.
 *
 * L'ERP n'encaisse rien et ne change aucune réservation : ni offre spéciale,
 * ni modification sur la plateforme, ni lien de paiement. L'encaissement se
 * fait hors ERP. L'agent IA ne vend jamais seul un supplément : c'est une
 * question d'argent, toujours à valider (messagerie-ia.ts, verdictEnvoi).
 *
 * Imports relatifs avec « .js » : ce fichier tourne aussi sous Node (serveur).
 */
import { dernierVoyageur, intentionFil, supplementDansTexte } from './messagerie-ia.js';
import type { Centimes, DateISO, ErpDonnees, FilMessages, Horodatage, Id, Logement, Mission, Reservation } from './types';

/* ============================================================ constantes */

export const ID_REGLAGES_SUPPLEMENTS = 'supplements' as const;

export type CleSupplement = 'arrivee_anticipee' | 'depart_tardif' | 'menage_supplementaire' | 'navette';
export const CLES_SUPPLEMENTS: CleSupplement[] = ['arrivee_anticipee', 'depart_tardif', 'menage_supplementaire', 'navette'];

export interface ReglageSupplement {
  actif: boolean;
  /** Prix indicatif, en centimes ; 0 : proposé sans supplément. */
  prixCentimes: Centimes;
  /** Arrivée plus tôt : possible dès cette heure ; départ plus tard : jusqu'à cette heure (Paris, « HH:MM »). */
  heure?: string;
  /** Seulement si le planning le permet (personne ne part le jour de l'arrivée, personne n'arrive le jour du départ). */
  selonPlanning?: boolean;
  /** Précision donnée au voyageur (« À confirmer la veille », « Depuis la gare d’Évry »). */
  conditions?: string;
}

export interface ReglagesSupplements {
  id: typeof ID_REGLAGES_SUPPLEMENTS;
  /** Par logement : ses suppléments réglés. */
  logements: Record<Id, Partial<Record<CleSupplement, ReglageSupplement>>>;
  majLe?: Horodatage;
  majPar?: string;
}

export const LIBELLES_SUPPLEMENTS: Record<CleSupplement, { titre: string; aide: string; en: string }> = {
  arrivee_anticipee: { titre: 'Arrivée plus tôt', aide: 'Le voyageur entre avant l’heure habituelle.', en: 'Early check-in' },
  depart_tardif: { titre: 'Départ plus tard', aide: 'Le voyageur rend le logement après l’heure habituelle.', en: 'Late check-out' },
  menage_supplementaire: { titre: 'Ménage supplémentaire', aide: 'Un ménage pendant le séjour.', en: 'Extra cleaning' },
  navette: { titre: 'Navette', aide: 'Un trajet organisé pour le voyageur (gare, aéroport…).', en: 'Shuttle' },
};

/** Prix indicatif le plus haut accepté (au-delà : erreur de saisie). */
export const PRIX_MAX_CENTIMES = 100_000;
export const CONDITIONS_MAX = 160;
/** Heures proposées à l'écran : de 06:00 à 22:00, toutes les demi-heures. */
export const HEURES_SUPPLEMENTS: string[] = Array.from({ length: 33 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const HEURES_DEFAUT: Partial<Record<CleSupplement, string>> = { arrivee_anticipee: '12:00', depart_tardif: '14:00' };
const PRIX_DEFAUT: Record<CleSupplement, Centimes> = { arrivee_anticipee: 2000, depart_tardif: 2000, menage_supplementaire: 4500, navette: 3000 };

/** Un supplément qui a une heure (arrivée plus tôt, départ plus tard). */
export const avecHeure = (cle: CleSupplement): boolean => cle === 'arrivee_anticipee' || cle === 'depart_tardif';

/** Réglage d'un supplément pas encore réglé : éteint, prix et heure proposés par défaut. */
export function reglageParDefaut(cle: CleSupplement): ReglageSupplement {
  return { actif: false, prixCentimes: PRIX_DEFAUT[cle], ...(HEURES_DEFAUT[cle] ? { heure: HEURES_DEFAUT[cle], selonPlanning: true } : {}) };
}

/* ============================================================== réglages */

const heureLue = (h: unknown): string | undefined => (typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h) ? h : undefined);

/** Lecture tolérante d'un réglage : allumé seulement si c'est écrit noir sur blanc, prix entier borné. */
export function lireReglage(cle: CleSupplement, brut: unknown): ReglageSupplement {
  const defaut = reglageParDefaut(cle);
  const x = (brut && typeof brut === 'object' ? brut : {}) as Partial<ReglageSupplement>;
  const prix = typeof x.prixCentimes === 'number' && Number.isInteger(x.prixCentimes) && x.prixCentimes >= 0 && x.prixCentimes <= PRIX_MAX_CENTIMES ? x.prixCentimes : undefined;
  const conditions = typeof x.conditions === 'string' ? x.conditions.replace(/\s+/g, ' ').trim().slice(0, CONDITIONS_MAX) : '';
  return {
    // Sans prix lisible, jamais proposé : on ne dit pas un prix faux.
    actif: x.actif === true && prix !== undefined,
    prixCentimes: prix ?? defaut.prixCentimes,
    ...(avecHeure(cle) ? { heure: heureLue(x.heure) ?? defaut.heure, selonPlanning: x.selonPlanning !== false } : {}),
    ...(conditions ? { conditions } : {}),
  };
}

/** Réglages des suppléments de l'espace (vides s'il n'y en a pas). */
export function reglagesSupplements(d: Pick<ErpDonnees, 'reglages'>): ReglagesSupplements {
  const stocke = (d.reglages ?? []).find((r) => (r as { id?: string })?.id === ID_REGLAGES_SUPPLEMENTS) as Partial<ReglagesSupplements> | undefined;
  const logements: ReglagesSupplements['logements'] = {};
  for (const [id, bloc] of Object.entries(stocke?.logements && typeof stocke.logements === 'object' ? stocke.logements : {})) {
    if (!bloc || typeof bloc !== 'object') continue;
    logements[id] = Object.fromEntries(CLES_SUPPLEMENTS.filter((k) => k in bloc).map((k) => [k, lireReglage(k, (bloc as Record<string, unknown>)[k])]));
  }
  return { id: ID_REGLAGES_SUPPLEMENTS, logements, ...(stocke?.majLe ? { majLe: stocke.majLe } : {}), ...(stocke?.majPar ? { majPar: stocke.majPar } : {}) };
}

/** Les quatre suppléments d'un logement, réglés ou par défaut (éteints). */
export function supplementsDuLogement(r: ReglagesSupplements, logementId: Id): Record<CleSupplement, ReglageSupplement> {
  const bloc = r.logements[logementId] ?? {};
  return Object.fromEntries(CLES_SUPPLEMENTS.map((k) => [k, bloc[k] ? lireReglage(k, bloc[k]) : reglageParDefaut(k)])) as Record<CleSupplement, ReglageSupplement>;
}

/** Suppléments allumés pour un logement, dans l'ordre. */
export const supplementsActifs = (r: ReglagesSupplements, logementId: Id): CleSupplement[] =>
  CLES_SUPPLEMENTS.filter((k) => supplementsDuLogement(r, logementId)[k].actif);

/** Le logement propose-t-il au moins un supplément ? */
export const aDesSupplements = (r: ReglagesSupplements | undefined, logementId: Id): boolean => !!r && supplementsActifs(r, logementId).length > 0;

/**
 * Ce qui empêche d'enregistrer un réglage (vide : il peut l'être). L'heure
 * d'une arrivée plus tôt doit précéder l'arrivée habituelle, celle d'un
 * départ plus tard suivre le départ habituel.
 */
export function erreursReglage(cle: CleSupplement, r: ReglageSupplement, fiche?: Pick<Logement['fiche'], 'heureArrivee' | 'heureDepart'>): string[] {
  if (!r.actif) return [];
  const e: string[] = [];
  if (!Number.isInteger(r.prixCentimes) || r.prixCentimes < 0) e.push('Indiquez un prix (0 € si c’est offert).');
  else if (r.prixCentimes > PRIX_MAX_CENTIMES) e.push('Prix trop élevé : vérifiez la saisie.');
  if (avecHeure(cle)) {
    const h = heureLue(r.heure);
    if (!h) e.push('Choisissez une heure.');
    else if (cle === 'arrivee_anticipee' && heureLue(fiche?.heureArrivee) && h >= fiche!.heureArrivee) e.push(`L’heure doit être avant l’arrivée habituelle (${fiche!.heureArrivee}).`);
    else if (cle === 'depart_tardif' && heureLue(fiche?.heureDepart) && h <= fiche!.heureDepart) e.push(`L’heure doit être après le départ habituel (${fiche!.heureDepart}).`);
  }
  if ((r.conditions ?? '').length > CONDITIONS_MAX) e.push(`Précision trop longue (${CONDITIONS_MAX} caractères au plus).`);
  return e;
}

/** Réglages de l'espace avec ceux d'un logement remplacés (enregistrés par le gérant). */
export function avecReglagesLogement(
  r: ReglagesSupplements,
  logementId: Id,
  reglages: Record<CleSupplement, ReglageSupplement>,
  par: { le: Horodatage; nom: string },
): ReglagesSupplements {
  const bloc = Object.fromEntries(
    CLES_SUPPLEMENTS.map((k) => {
      const x = reglages[k];
      const conditions = x.conditions?.replace(/\s+/g, ' ').trim().slice(0, CONDITIONS_MAX);
      return [k, { actif: x.actif, prixCentimes: x.prixCentimes, ...(avecHeure(k) ? { heure: x.heure, selonPlanning: x.selonPlanning !== false } : {}), ...(conditions ? { conditions } : {}) }];
    }),
  ) as Record<CleSupplement, ReglageSupplement>;
  return { ...r, logements: { ...r.logements, [logementId]: bloc }, majLe: par.le, majPar: par.nom };
}

/* ======================================================== disponibilité */

export type StatutDisponibilite = 'possible' | 'a_verifier' | 'impossible';

export interface Disponibilite {
  statut: StatutDisponibilite;
  /** Ce que l'équipe doit savoir, en phrases courtes (planning, ménage). */
  constats: string[];
}

/** Ce que la disponibilité lit du planning : réservations et ménages du logement. */
export interface PlanningLogement {
  reservations: readonly Pick<Reservation, 'id' | 'logementId' | 'arrivee' | 'depart' | 'statut'>[];
  missions?: readonly Pick<Mission, 'logementId' | 'type' | 'date' | 'statut' | 'heureDebut' | 'heureFinMax'>[];
}

const MISSION_VIVANTE = (m: Pick<Mission, 'statut'>) => m.statut !== 'annulee' && m.statut !== 'refusee';
const jourCourt = (date: DateISO) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

/**
 * Le supplément est-il possible pour ce séjour ? Lu sur les réservations du
 * même logement (annulées écartées) et sur les ménages prévus. « Selon le
 * planning » (par défaut) : un départ le jour de l'arrivée, ou une arrivée
 * le jour du départ, le rend impossible ; sinon il est à vérifier.
 */
export function disponibiliteSupplement(
  cle: CleSupplement,
  r: Pick<Reservation, 'id' | 'logementId' | 'arrivee' | 'depart' | 'nuits' | 'statut'>,
  d: PlanningLogement,
  reglage: ReglageSupplement,
  fiche: Pick<Logement['fiche'], 'heureArrivee' | 'heureDepart'> | undefined,
  aujourdhui: DateISO,
): Disponibilite {
  if (r.statut === 'annulee') return { statut: 'impossible', constats: ['Réservation annulée.'] };
  if (r.depart < aujourdhui || r.statut === 'terminee') return { statut: 'impossible', constats: ['Séjour terminé.'] };
  const autres = d.reservations.filter((x) => x.logementId === r.logementId && x.id !== r.id && x.statut !== 'annulee');
  const menages = (d.missions ?? []).filter((m) => m.logementId === r.logementId && m.type === 'menage' && MISSION_VIVANTE(m));
  const bloque = reglage.selonPlanning !== false ? 'impossible' : 'a_verifier';
  const constats: string[] = [];
  let statut: StatutDisponibilite = 'possible';
  const baisser = (s: StatutDisponibilite) => {
    if (s === 'impossible' || (s === 'a_verifier' && statut === 'possible')) statut = s;
  };

  switch (cle) {
    case 'arrivee_anticipee': {
      // Le jour même, le voyageur n'est pas encore là (le statut « en cours » peut venir de la plateforme dès le matin).
      if (r.arrivee < aujourdhui) return { statut: 'impossible', constats: ['Le voyageur est déjà arrivé.'] };
      const part = autres.find((x) => x.depart === r.arrivee);
      if (part) {
        constats.push(`Un voyageur part ce jour-là${fiche?.heureDepart ? ` (avant ${fiche.heureDepart})` : ''}.`);
        baisser(bloque);
      } else constats.push('Personne ne part ce jour-là.');
      const menage = menages.find((m) => m.date === r.arrivee);
      if (menage) {
        constats.push(`Ménage prévu ce jour-là, de ${menage.heureDebut} à ${menage.heureFinMax}.`);
        if (reglage.heure && menage.heureFinMax > reglage.heure) baisser('a_verifier');
      } else {
        const veille = menages.filter((m) => m.date < r.arrivee).sort((a, b) => b.date.localeCompare(a.date))[0];
        const dernierDepart = autres.filter((x) => x.depart <= r.arrivee).sort((a, b) => b.depart.localeCompare(a.depart))[0]?.depart;
        if (veille && (!dernierDepart || veille.date >= dernierDepart)) constats.push(`Ménage déjà prévu le ${jourCourt(veille.date)}.`);
      }
      break;
    }
    case 'depart_tardif': {
      const arrive = autres.find((x) => x.arrivee === r.depart);
      if (arrive) {
        constats.push(`Un voyageur arrive ce jour-là${fiche?.heureArrivee ? ` (dès ${fiche.heureArrivee})` : ''}.`);
        baisser(bloque);
      } else constats.push('Personne n’arrive ce jour-là.');
      const menage = menages.find((m) => m.date === r.depart);
      if (menage) {
        constats.push(`Ménage prévu ce jour-là à ${menage.heureDebut}.`);
        if (reglage.heure && menage.heureDebut < reglage.heure) {
          constats.push('Il faudra le décaler.');
          baisser('a_verifier');
        }
      }
      break;
    }
    case 'menage_supplementaire': {
      if ((r.nuits ?? 0) < 2) return { statut: 'impossible', constats: ['Séjour trop court pour un ménage pendant le séjour.'] };
      const pendant = menages.find((m) => m.date > r.arrivee && m.date < r.depart);
      if (pendant) {
        constats.push(`Un ménage est déjà prévu le ${jourCourt(pendant.date)}, pendant le séjour.`);
        baisser('a_verifier');
      } else constats.push('Aucun ménage prévu pendant le séjour.');
      break;
    }
    case 'navette':
      break;
  }
  return { statut, constats };
}

/* ============================================================ propositions */

const euros = (langue: string, decimales: number) => new Intl.NumberFormat(langue, { style: 'currency', currency: 'EUR', minimumFractionDigits: decimales, maximumFractionDigits: decimales });
const EUROS = { fr: [euros('fr-FR', 0), euros('fr-FR', 2)], en: [euros('en-GB', 0), euros('en-GB', 2)] } as const;
/** « 20 € », « 22,50 € » (les centimes seulement s'il y en a) ; en anglais « €20 ». */
export const prixLisible = (c: Centimes, langue: 'fr' | 'en' = 'fr'): string => EUROS[langue][c % 100 === 0 ? 0 : 1].format(c / 100);
/** « 12 h », « 12 h 30 » ; en anglais « 12:00 ». */
const heureFr = (h: string | undefined) => (h && /^\d{2}:\d{2}$/.test(h) ? h.replace(/^0/, '').replace(':00', ' h').replace(':', ' h ') : '');
const dateFr = (d: DateISO) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
const dateEn = (d: DateISO) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
const phrase = (t: string | undefined) => {
  const x = (t ?? '').trim();
  return x ? `${x.charAt(0).toUpperCase()}${x.slice(1)}${/[.!?]$/.test(x) ? '' : '.'}` : '';
};

export interface ContexteProposition {
  reservation: Pick<Reservation, 'arrivee' | 'depart'>;
  fiche?: Pick<Logement['fiche'], 'heureArrivee' | 'heureDepart'>;
  reglage: ReglageSupplement;
  disponibilite: Disponibilite;
  prenom: string;
  signature: string;
  langue: 'fr' | 'en';
}

/**
 * Texte prêt à envoyer, au ton de la marque : la proposition avec le prix
 * réglé, ou la réponse polie quand ce n'est pas possible. Jamais de lien de
 * paiement, jamais de promesse au-delà de ce qui est réglé.
 */
export function texteProposition(cle: CleSupplement, c: ContexteProposition): string {
  const possible = c.disponibilite.statut !== 'impossible';
  const r = c.reglage;
  const fr = c.langue !== 'en';
  const bonjour = fr ? `Bonjour${c.prenom ? ` ${c.prenom}` : ''},` : `Hello${c.prenom ? ` ${c.prenom}` : ''},`;
  const prixFr = r.prixCentimes > 0 ? `pour ${prixLisible(r.prixCentimes, 'fr')}` : 'sans supplément';
  const prixEn = r.prixCentimes > 0 ? `for ${prixLisible(r.prixCentimes, 'en')}` : 'at no extra cost';
  const conditions = phrase(r.conditions);
  const confirmer = fr ? 'Si cela vous convient, répondez-nous simplement : nous vous confirmons tout.' : 'If that suits you, just reply here and we will confirm everything.';
  const corps: string[] = [];
  switch (cle) {
    case 'arrivee_anticipee': {
      const habituelle = fr ? heureFr(c.fiche?.heureArrivee) : c.fiche?.heureArrivee;
      if (possible) {
        corps.push(
          fr
            ? `Bonne nouvelle : le ${dateFr(c.reservation.arrivee)}, vous pouvez arriver dès ${heureFr(r.heure)}${habituelle ? ` au lieu de ${habituelle}` : ''}, ${prixFr}.`
            : `Good news: on ${dateEn(c.reservation.arrivee)}, you can check in from ${r.heure}${habituelle ? ` instead of ${habituelle}` : ''}, ${prixEn}.`,
        );
      } else {
        corps.push(
          fr
            ? `Merci pour votre message. Le ${dateFr(c.reservation.arrivee)}, le logement ne peut pas être prêt plus tôt${habituelle ? ` : l’arrivée reste possible à partir de ${habituelle}` : ''}.`
            : `Thank you for your message. On ${dateEn(c.reservation.arrivee)}, the apartment cannot be ready earlier${habituelle ? `: check-in remains possible from ${habituelle}` : ''}.`,
        );
      }
      break;
    }
    case 'depart_tardif': {
      const habituelle = fr ? heureFr(c.fiche?.heureDepart) : c.fiche?.heureDepart;
      if (possible) {
        corps.push(
          fr
            ? `Bonne nouvelle : le ${dateFr(c.reservation.depart)}, vous pouvez partir jusqu’à ${heureFr(r.heure)}${habituelle ? ` au lieu de ${habituelle}` : ''}, ${prixFr}.`
            : `Good news: on ${dateEn(c.reservation.depart)}, you can check out until ${r.heure}${habituelle ? ` instead of ${habituelle}` : ''}, ${prixEn}.`,
        );
      } else {
        corps.push(
          fr
            ? `Merci pour votre message. Le ${dateFr(c.reservation.depart)}, nous ne pouvons pas proposer de départ plus tard${habituelle ? ` : le départ reste prévu avant ${habituelle}` : ''}.`
            : `Thank you for your message. On ${dateEn(c.reservation.depart)}, we cannot offer a later check-out${habituelle ? `: check-out remains before ${habituelle}` : ''}.`,
        );
      }
      break;
    }
    case 'menage_supplementaire':
      corps.push(
        possible
          ? fr
            ? `Nous pouvons organiser un ménage pendant votre séjour, ${prixFr}.`
            : `We can arrange a cleaning during your stay, ${prixEn}.`
          : fr
            ? 'Merci pour votre message. Nous ne pouvons pas organiser de ménage pendant ce séjour.'
            : 'Thank you for your message. We cannot arrange a cleaning during this stay.',
      );
      break;
    case 'navette':
      corps.push(fr ? `Nous pouvons organiser une navette, ${prixFr}.` : `We can arrange a shuttle, ${prixEn}.`);
      break;
  }
  if (possible && conditions) corps.push(conditions);
  if (possible) corps.push(confirmer);
  const fin = fr ? (possible ? 'À très bientôt,' : 'Au plaisir de vous accueillir,') : possible ? 'See you soon,' : 'We look forward to welcoming you,';
  return [bonjour, '', corps.join(' '), '', fin, c.signature.trim()].join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Résumé d'un réglage pour l'équipe : « dès 12 h · 20 € », « 45 € », « sans supplément ». */
export function resumeSupplement(cle: CleSupplement, r: ReglageSupplement): string {
  const quand = cle === 'arrivee_anticipee' ? `dès ${heureFr(r.heure)}` : cle === 'depart_tardif' ? `jusqu’à ${heureFr(r.heure)}` : '';
  return [quand, r.prixCentimes > 0 ? prixLisible(r.prixCentimes, 'fr') : 'sans supplément'].filter(Boolean).join(' · ');
}

/** Ligne d'un supplément dans le message automatique (« • Arrivée plus tôt, dès 12 h : 20 € »). */
export function ligneSupplement(cle: CleSupplement, r: ReglageSupplement): string {
  const titre = LIBELLES_SUPPLEMENTS[cle].titre;
  const quand = cle === 'arrivee_anticipee' ? `, dès ${heureFr(r.heure)}` : cle === 'depart_tardif' ? `, jusqu’à ${heureFr(r.heure)}` : '';
  const prix = r.prixCentimes > 0 ? prixLisible(r.prixCentimes, 'fr') : 'sans supplément';
  const conditions = r.conditions?.trim() ? ` (${r.conditions.trim().replace(/[.!]+$/, '')})` : '';
  return `• ${titre}${quand} : ${prix}${conditions}`;
}

/**
 * Lignes du message automatique pour un séjour : seulement les suppléments
 * allumés ET possibles d'après le planning (rien « à vérifier » ne part sans
 * relecture). Vide : rien à proposer, le message ne part pas.
 */
export function texteSupplementsSejour(
  reglages: ReglagesSupplements | undefined,
  r: Pick<Reservation, 'id' | 'logementId' | 'arrivee' | 'depart' | 'nuits' | 'statut'>,
  d: PlanningLogement,
  fiche: Pick<Logement['fiche'], 'heureArrivee' | 'heureDepart'> | undefined,
  aujourdhui: DateISO,
): string {
  if (!reglages) return '';
  const tous = supplementsDuLogement(reglages, r.logementId);
  return CLES_SUPPLEMENTS.filter((k) => tous[k].actif && disponibiliteSupplement(k, r, d, tous[k], fiche, aujourdhui).statut === 'possible')
    .map((k) => ligneSupplement(k, tous[k]))
    .join('\n');
}

/* ============================================================== messagerie */

/**
 * Supplément demandé par le voyageur dans une conversation : la demande lue
 * par l'IA (arrivée plus tôt, départ plus tard), sinon les mots de son
 * dernier message (ménage pendant le séjour, navette).
 */
export function supplementDemande(fil: Pick<FilMessages, 'messages' | 'analyse'>): CleSupplement | undefined {
  const intention = intentionFil(fil);
  if (intention === 'arrivee_anticipee' || intention === 'depart_tardif') return intention;
  const dernier = dernierVoyageur(fil);
  return dernier ? supplementDansTexte(dernier.texte) : undefined;
}
