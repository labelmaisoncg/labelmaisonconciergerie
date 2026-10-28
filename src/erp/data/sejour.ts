/**
 * Livret d'accueil et check-in en ligne (cahier B2) : règles pures, partagées
 * par le serveur (api/sejour.ts, api/_sejour.ts), la page du voyageur
 * (/sejour) et la fiche d'une réservation dans l'ERP.
 *
 * Lien du séjour : « <site>/sejour#<jeton> ». Le jeton est SIGNÉ
 * (HMAC-SHA256 avec ACCES_SECRET, serveur seulement) et porte l'espace et la
 * réservation : impossible à deviner ou à modifier, il ne vaut que pour ce
 * séjour, dans cet espace. Après « # » : jamais envoyé aux serveurs (ni
 * journaux, ni en-tête Referer) ; la page le passe dans le corps d'un POST.
 * Rien n'est gardé pour lui en base : la réservation est relue à chaque
 * appel, dans la base de SON espace. Il ne montre rien pour une réservation
 * annulée, et s'éteint JOURS_LIEN_APRES_DEPART jours après le départ (des
 * dates déplacées le suivent).
 *
 * Ce que la page reçoit (vueSejour) : prénom, dates, logement (nom, adresse,
 * horaires, parking, règles, « À savoir », questions fréquentes, guides),
 * jamais d'autre réservation, d'e-mail ni de téléphone du voyageur, de prix,
 * de versement ni rien du propriétaire. Codes d'accès, wifi et guides
 * d'accès : même règle que l'agent et les messages automatiques
 * (codesAutorises, messages-programmes.ts) — réservation confirmée, dans les
 * 48 h avant l'arrivée ou pendant le séjour — appliquée par le serveur ;
 * avant, les textes passent par masquerCodes (messagerie-ia.ts), et un texte
 * qui contiendrait encore un code ou le wifi n'est pas montré du tout.
 *
 * Check-in : heure d'arrivée estimée, nombre de voyageurs, règlement
 * accepté et, pour les voyageurs étrangers seulement, la fiche individuelle
 * de police (FICHE_POLICE plus bas). Aucune photo de pièce d'identité. Rangé
 * dans la collection COLLECTION_CHECKINS (une ligne par réservation, lue et
 * écrite par les gérants et le serveur seulement : supabase/erp-espaces.sql,
 * jamais archivée dans erp.historique), jamais donné à l'IA (agent, assistant,
 * connecteurs), effacé MOIS_CONSERVATION mois après le départ par le passage
 * planifié (purgerCheckins), tout de suite pour une réservation annulée.
 *
 * Imports relatifs avec « .js » : ce fichier tourne aussi sous Node (serveur).
 */
import { ID_LABEL_MAISON, idEspaceValide } from './espaces.js';
import { estFichierGuide, estLienGuide, guideEnvoyable } from './guides.js';
import { ajouterJoursISO, codesAutorises, prenomDe } from './messages-programmes.js';
import { codesCitesApresMot, contientCodeAcces, masquerCodes, nettoyerTexte } from './messagerie-ia.js';
import { b64url, deB64url } from './web-push.js';
import type { CanalReservation, DateISO, GuideLogement, Horodatage, Id, Logement, Reservation } from './types';

/* ============================================================ constantes */

/** Collection des check-ins (erp.enregistrements) : gérants et serveur seulement, jamais archivée. */
export const COLLECTION_CHECKINS = 'checkinsEnLigne';
/** Page du livret (route du site). */
export const PAGE_SEJOUR = '/sejour';
/** Le lien vaut jusqu'à ce nombre de jours après le départ (inclus). */
export const JOURS_LIEN_APRES_DEPART = 3;
/** Fiches de police gardées 6 mois après le départ (CESEDA, art. R. 814-1 et suivants), puis effacées. */
export const MOIS_CONSERVATION = 6;
/** Envois du formulaire par séjour (premier envoi et modifications) : au-delà, écrire dans la messagerie. */
export const MAX_ENVOIS_CHECKIN = 12;
/** Voyageurs au plus, quand la capacité du logement n'est pas connue. */
export const MAX_VOYAGEURS = 16;
/** Enfants de moins de 15 ans inscrits sur la fiche d'un adulte, au plus. */
export const MAX_ENFANTS_PAR_FICHE = 10;
/** Taille d'un envoi du formulaire (JSON), au plus. */
export const TAILLE_MAX_ENVOI = 16_000;
/** Durée des liens signés montrés sur la page (photo, guides déposés). */
export const DUREE_LIENS_PAGE_S = 6 * 3600;

/** Longueur maximale de chaque champ de la fiche de police (après nettoyage). */
export const LONGUEURS = { nom: 80, prenoms: 80, naissanceLieu: 80, nationalite: 60, domicile: 200 } as const;

/*
 * FICHE_POLICE — fiche individuelle de police des voyageurs étrangers.
 *
 * Règle : tout voyageur de nationalité étrangère (Union européenne comprise)
 * hébergé dans un meublé de tourisme remplit et signe, à son arrivée, une
 * fiche individuelle de police ; les enfants de moins de 15 ans peuvent
 * figurer sur celle d'un adulte qui les accompagne. Code de l'entrée et du
 * séjour des étrangers et du droit d'asile (CESEDA), art. R. 814-1 et
 * suivants (ancien art. R. 611-42, étendu aux loueurs de meublés de tourisme
 * par le décret n° 2015-1002 du 18 août 2015) ; modèle fixé par arrêté.
 * Fiches conservées six mois, remises aux services de police et de
 * gendarmerie sur leur demande seulement (CNIL : « Touriste étranger en
 * France : la fiche de police dans les établissements de tourisme »).
 *
 * Mentions demandées ici : nom, prénoms, date et lieu de naissance,
 * nationalité, domicile habituel (et les enfants de moins de 15 ans qui
 * accompagnent l'adulte). Les dates d'arrivée et de départ sont celles de la
 * réservation. Le décret de 2015 cite aussi le téléphone mobile et l'adresse
 * électronique : ils ne sont PAS demandés ici (choix de minimisation de
 * Label Maison, la plateforme les a déjà) — question ouverte, voir
 * docs/erp/README.md. La signature : l'envoi du formulaire, horodaté.
 * Rien pour un voyageur français. Aucune pièce d'identité n'est demandée.
 */

/* ================================================================= types */

export type LangueSejour = 'fr' | 'en';

/** Fiche individuelle de police d'un voyageur étranger de 15 ans et plus. */
export interface FichePolice {
  nom: string;
  prenoms: string;
  naissanceLe: DateISO;
  naissanceLieu: string;
  nationalite: string;
  /** Domicile habituel (adresse). */
  domicile: string;
  /** Enfants de moins de 15 ans qui l'accompagnent, inscrits sur sa fiche. */
  enfants: number;
}

/** Ce que le voyageur envoie. */
export interface SaisieCheckin {
  /** Heure d'arrivée estimée, « HH:MM ». */
  arriveeEstimee: string;
  nbPersonnes: number;
  reglesAcceptees: true;
  /** Tous de nationalité française : aucune fiche de police. */
  tousFrancais: boolean;
  /** Une par voyageur étranger de 15 ans et plus (vide si tousFrancais). */
  fiches: FichePolice[];
  /**
   * Modification seulement : garder les fiches déjà envoyées. Le lien ne les
   * renvoie jamais au navigateur ; le serveur les reprend de la ligne gardée
   * (lireSaisieCheckin, fichesPrecedentes). Jamais enregistré.
   */
  garderFiches?: true;
}

/** Check-in enregistré (collection COLLECTION_CHECKINS, id = réservation). */
export interface CheckinEnLigne extends SaisieCheckin {
  id: Id;
  reservationId: Id;
  logementId: Id;
  langue: LangueSejour;
  envoyeLe: Horodatage;
  modifieLe?: Horodatage;
  /** Envois du formulaire (premier compris), au plus MAX_ENVOIS_CHECKIN. */
  envois: number;
  /** Effacé après ce jour (départ + MOIS_CONSERVATION mois). */
  conserverJusquAu: DateISO;
}

/* ============================================================ dates */

const FORME_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Date calendaire réelle (« 2026-02-30 » ne l'est pas). */
export function dateValide(d: unknown): d is DateISO {
  if (typeof d !== 'string' || !FORME_DATE.test(d)) return false;
  const t = new Date(`${d}T12:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

/** Date + n mois, jour ramené à la fin du mois (31 août + 6 mois = 28 ou 29 février). */
export function ajouterMoisISO(date: DateISO, n: number): DateISO {
  const [a, m, j] = date.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  const annee = Math.floor(total / 12);
  const mois = total % 12;
  const fin = new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
  return `${String(annee).padStart(4, '0')}-${String(mois + 1).padStart(2, '0')}-${String(Math.min(j, fin)).padStart(2, '0')}`;
}

/** A-t-on 18 ans ce jour-là (né le 29 février : le 28 février) ? */
export const majeurLe = (naissance: DateISO, jour: DateISO): boolean => ajouterMoisISO(naissance, 18 * 12) <= jour;

/** Dernier jour où le check-in d'un séjour est gardé. */
export const conservationJusquAu = (depart: DateISO): DateISO => ajouterMoisISO(depart, MOIS_CONSERVATION);

/* ================================================================= jeton */

/** Version du jeton (premier octet du corps). */
const VERSION_JETON = 1;
/**
 * Séparation des usages : la signature porte sur « lm-sejour-v1| » + corps.
 * Une session des espaces (même secret possible, ACCES_SECRET) signe un corps
 * base64url seul, sans « | » : aucune signature de l'un ne vaut pour l'autre.
 */
const DOMAINE = 'lm-sejour-v1|';
/** Réservation : 1 à 120 octets, sans espace ni caractère de contrôle. */
const FORME_ID = /^[\x21-\x7e\u00a0-\uffff]{1,120}$/;
const FORME_JETON = /^[A-Za-z0-9_-]{24,200}\.[A-Za-z0-9_-]{43}$/;

const utf8 = (t: string) => new TextEncoder().encode(t);

/** Web Crypto du navigateur ou de Node (global à partir de Node 19, module avant). */
async function webCrypto(): Promise<Crypto> {
  const g = (globalThis as { crypto?: Crypto }).crypto;
  if (g?.subtle) return g;
  return ((await import('node:crypto' as string)) as { webcrypto: Crypto }).webcrypto;
}

const cle = async (secret: string) => (await webCrypto()).subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

const octetsUuid = (u: string): Uint8Array => Uint8Array.from(u.replace(/-/g, '').match(/../g)!.map((h) => parseInt(h, 16)));
const uuidDe = (o: Uint8Array): string => {
  const h = [...o].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

/** Le séjour qu'un jeton désigne. */
export interface SejourDuJeton {
  espace: string;
  reservationId: Id;
}

/**
 * Jeton du séjour : corps (version, espace sur 16 octets, id de la
 * réservation) en base64url, « . », HMAC-SHA256 (32 octets). Même séjour,
 * même secret : même jeton (le lien copié par l'équipe et celui du message
 * automatique sont identiques).
 */
export async function signerJetonSejour(secret: string, s: SejourDuJeton): Promise<string> {
  if (!idEspaceValide(s.espace) || typeof s.reservationId !== 'string' || !FORME_ID.test(s.reservationId)) throw new Error('Séjour illisible.');
  const id = utf8(s.reservationId);
  if (id.length > 120) throw new Error('Séjour illisible.');
  const corpsOctets = new Uint8Array(17 + id.length);
  corpsOctets[0] = VERSION_JETON;
  corpsOctets.set(octetsUuid(s.espace.toLowerCase()), 1);
  corpsOctets.set(id, 17);
  const corps = b64url(corpsOctets);
  const signature = new Uint8Array(await (await webCrypto()).subtle.sign('HMAC', await cle(secret), utf8(DOMAINE + corps)));
  return `${corps}.${b64url(signature)}`;
}

/**
 * Séjour d'un jeton : forme stricte, signature vérifiée en temps constant
 * (Web Crypto), version connue, espace et réservation lisibles. null sinon,
 * sans dire pourquoi.
 */
export async function lireJetonSejour(secret: string, jeton: unknown): Promise<SejourDuJeton | null> {
  if (!secret || typeof jeton !== 'string' || !FORME_JETON.test(jeton)) return null;
  const [corps, signature] = jeton.split('.');
  const sig = deB64url(signature);
  if (sig.length !== 32) return null;
  const ok = await (await webCrypto()).subtle.verify('HMAC', await cle(secret), new Uint8Array(sig), utf8(DOMAINE + corps)).catch(() => false);
  if (!ok) return null;
  const o = deB64url(corps);
  if (o.length < 18 || o[0] !== VERSION_JETON) return null;
  const espace = uuidDe(o.slice(1, 17));
  let reservationId: string;
  try {
    reservationId = new TextDecoder('utf-8', { fatal: true }).decode(o.slice(17));
  } catch {
    return null;
  }
  if (!idEspaceValide(espace) || !FORME_ID.test(reservationId)) return null;
  return { espace, reservationId };
}

/** Lien envoyé au voyageur : « <site>/sejour#<jeton> ». */
export const lienSejour = (site: string, jeton: string): string => `${site.replace(/\/+$/, '')}${PAGE_SEJOUR}#${jeton}`;

/** Jeton lu dans le fragment de l'adresse (« #<jeton> », ou « #jeton=<jeton> ») ; '' sinon. */
export function jetonDuFragment(fragment: string): string {
  const brut = String(fragment ?? '').replace(/^#/, '').trim();
  const j = brut.startsWith('jeton=') ? brut.slice(6) : brut;
  return FORME_JETON.test(j) ? j : '';
}

/* ============================================================ le séjour */

export type EtatLienSejour = 'ouvert' | 'annule' | 'expire' | 'inconnu';

/**
 * Le lien montre-t-il quelque chose ? Réservation introuvable : inconnu ;
 * annulée : rien ; JOURS_LIEN_APRES_DEPART jours après le départ (ou dates
 * illisibles) : expiré.
 */
export function etatLienSejour(r: Pick<Reservation, 'statut' | 'depart'> | undefined, aujourdhui: DateISO): EtatLienSejour {
  if (!r) return 'inconnu';
  if (r.statut === 'annulee') return 'annule';
  if (!dateValide(r.depart) || aujourdhui > ajouterJoursISO(r.depart, JOURS_LIEN_APRES_DEPART)) return 'expire';
  return 'ouvert';
}

/** Dernier jour où le lien s'ouvre. */
export const lienValableJusquAu = (depart: DateISO): DateISO => ajouterJoursISO(depart, JOURS_LIEN_APRES_DEPART);

/**
 * Codes d'accès, wifi et guides d'accès visibles maintenant : la règle de
 * l'agent et des messages automatiques, telle quelle (codesAutorises).
 */
export const codesVisibles = (r: Pick<Reservation, 'logementId' | 'statut' | 'arrivee' | 'depart'>, aujourdhui: DateISO): boolean => codesAutorises(r, r.logementId, aujourdhui);

/** Premier jour où les codes sont visibles (arrivée dans 2 jours au plus). */
export const codesVisiblesLe = (arrivee: DateISO): DateISO => ajouterJoursISO(arrivee, -2);

/**
 * Le formulaire peut-il être envoyé ? Modifiable jusqu'au jour de
 * l'arrivée compris ; un premier envoi reste possible pendant le séjour
 * (fiche de police à remplir « dès l'arrivée ») ; jamais pour une
 * réservation annulée, jamais au-delà de MAX_ENVOIS_CHECKIN envois.
 */
export function etatFormulaire(
  r: Pick<Reservation, 'statut' | 'arrivee' | 'depart'>,
  precedent: Pick<CheckinEnLigne, 'envois'> | undefined,
  aujourdhui: DateISO,
): { modifiable: boolean; raison?: 'annule' | 'ferme' | 'limite' } {
  if (r.statut === 'annulee') return { modifiable: false, raison: 'annule' };
  if (precedent && (precedent.envois ?? 0) >= MAX_ENVOIS_CHECKIN) return { modifiable: false, raison: 'limite' };
  if (aujourdhui <= r.arrivee) return { modifiable: true };
  if (!precedent && aujourdhui < r.depart && r.statut !== 'terminee') return { modifiable: true };
  return { modifiable: false, raison: 'ferme' };
}

/* ======================================================= le formulaire */

export type ChampCheckin =
  | 'arriveeEstimee'
  | 'nbPersonnes'
  | 'reglesAcceptees'
  | 'tousFrancais'
  | 'fiches'
  | 'nom'
  | 'prenoms'
  | 'naissanceLe'
  | 'naissanceLieu'
  | 'nationalite'
  | 'domicile'
  | 'enfants'
  /** Enfants inscrits sur la fiche d'un voyageur de moins de 18 ans le jour de l'arrivée. */
  | 'enfantsMineur';

export interface ErreurCheckin {
  champ: ChampCheckin;
  /** Fiche concernée (0 : la première). */
  fiche?: number;
}

/** Message de chaque erreur, en français et en anglais. */
export const MESSAGES_ERREURS: Record<ChampCheckin, Record<LangueSejour, string>> = {
  arriveeEstimee: { fr: 'Indiquez une heure, par exemple 17:30.', en: 'Enter a time, for example 17:30.' },
  nbPersonnes: { fr: 'Indiquez le nombre de voyageurs.', en: 'Enter the number of guests.' },
  reglesAcceptees: { fr: 'Merci d’accepter le règlement intérieur.', en: 'Please accept the house rules.' },
  tousFrancais: { fr: 'Choisissez une réponse.', en: 'Choose an answer.' },
  fiches: { fr: 'Une fiche par voyageur étranger de 15 ans et plus, sans dépasser le nombre de voyageurs.', en: 'One form per foreign guest aged 15 or over, no more than the number of guests.' },
  nom: { fr: 'Indiquez le nom.', en: 'Enter the last name.' },
  prenoms: { fr: 'Indiquez le ou les prénoms.', en: 'Enter the first name(s).' },
  naissanceLe: { fr: 'Indiquez une date de naissance valable.', en: 'Enter a valid date of birth.' },
  naissanceLieu: { fr: 'Indiquez le lieu de naissance.', en: 'Enter the place of birth.' },
  nationalite: { fr: 'Indiquez la nationalité.', en: 'Enter the nationality.' },
  domicile: { fr: 'Indiquez l’adresse du domicile habituel.', en: 'Enter the home address.' },
  enfants: { fr: 'Nombre d’enfants entre 0 et 10.', en: 'Number of children between 0 and 10.' },
  enfantsMineur: { fr: 'Les enfants s’inscrivent sur la fiche d’un adulte (18 ans ou plus).', en: 'Children go on an adult’s form (18 or over).' },
};

/** Caractères de contrôle, invisibles et de sens d'écriture : retirés de tout texte saisi. */
const INVISIBLES = /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g;

/** Texte saisi, nettoyé (NFC, invisibles retirés, espaces resserrés) ; null s'il est vide ou trop long. */
export function texteSaisi(v: unknown, max: number): string | null {
  if (typeof v !== 'string' || v.length > max * 4) return null;
  const t = v.normalize('NFC').replace(INVISIBLES, ' ').replace(/\s+/g, ' ').trim();
  return t && t.length <= max ? t : null;
}

const entier = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,3}$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) ? n : null;
};

/**
 * Lecture stricte d'un envoi du formulaire : seuls les champs connus sont
 * repris, chacun contrôlé et borné. Voyageurs : 1 à `maxPersonnes` ;
 * fiches : au moins une si quelqu'un n'est pas français, au plus une par
 * voyageur, enfants compris ; date de naissance réelle, entre 1900 et
 * aujourd'hui.
 */
export function lireSaisieCheckin(
  brut: unknown,
  o: { maxPersonnes: number; aujourdhui: DateISO; fichesPrecedentes?: readonly FichePolice[]; /** Jour d'arrivée (âge du titulaire) ; absent : aujourd'hui. */ arrivee?: DateISO },
): { ok: true; saisie: SaisieCheckin } | { ok: false; erreurs: ErreurCheckin[] } {
  const x = (brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {}) as Record<string, unknown>;
  const erreurs: ErreurCheckin[] = [];
  const max = Math.max(1, Math.min(MAX_VOYAGEURS, Math.floor(o.maxPersonnes) || MAX_VOYAGEURS));

  const heure = typeof x.arriveeEstimee === 'string' ? x.arriveeEstimee.trim() : '';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(heure)) erreurs.push({ champ: 'arriveeEstimee' });
  const nb = entier(x.nbPersonnes);
  if (nb === null || nb < 1 || nb > max) erreurs.push({ champ: 'nbPersonnes' });
  if (x.reglesAcceptees !== true) erreurs.push({ champ: 'reglesAcceptees' });
  if (typeof x.tousFrancais !== 'boolean') erreurs.push({ champ: 'tousFrancais' });

  const fiches: FichePolice[] = [];
  if (x.tousFrancais === false && x.garderFiches === true) {
    // Modification : les fiches déjà envoyées restent telles quelles (jamais renvoyées par le lien).
    if (!o.fichesPrecedentes?.length) erreurs.push({ champ: 'fiches' });
    else fiches.push(...o.fichesPrecedentes.slice(0, MAX_VOYAGEURS).map((f) => ({ ...f })));
  } else if (x.tousFrancais === false) {
    const liste = Array.isArray(x.fiches) ? x.fiches : [];
    if (liste.length < 1 || liste.length > MAX_VOYAGEURS) erreurs.push({ champ: 'fiches' });
    liste.slice(0, MAX_VOYAGEURS).forEach((f, i) => {
      const y = (f && typeof f === 'object' && !Array.isArray(f) ? f : {}) as Record<string, unknown>;
      const champ = (k: keyof typeof LONGUEURS) => {
        const t = texteSaisi(y[k], LONGUEURS[k]);
        if (t === null) erreurs.push({ champ: k, fiche: i });
        return t ?? '';
      };
      const fiche: FichePolice = {
        nom: champ('nom'),
        prenoms: champ('prenoms'),
        naissanceLe: typeof y.naissanceLe === 'string' ? y.naissanceLe.trim() : '',
        naissanceLieu: champ('naissanceLieu'),
        nationalite: champ('nationalite'),
        domicile: champ('domicile'),
        enfants: 0,
      };
      const naissanceOk = dateValide(fiche.naissanceLe) && fiche.naissanceLe >= '1900-01-01' && fiche.naissanceLe <= o.aujourdhui;
      if (!naissanceOk) erreurs.push({ champ: 'naissanceLe', fiche: i });
      const enfants = y.enfants === undefined || y.enfants === '' ? 0 : entier(y.enfants);
      if (enfants === null || enfants < 0 || enfants > MAX_ENFANTS_PAR_FICHE) erreurs.push({ champ: 'enfants', fiche: i });
      // Des enfants sur sa fiche : seulement un adulte (18 ans le jour de l'arrivée). Date fausse : une seule erreur, la date.
      else if (enfants > 0 && naissanceOk && !majeurLe(fiche.naissanceLe, dateValide(o.arrivee) ? o.arrivee : o.aujourdhui)) erreurs.push({ champ: 'enfantsMineur', fiche: i });
      else fiche.enfants = enfants;
      fiches.push(fiche);
    });
  }
  if (x.tousFrancais === false) {
    // Chaque fiche est un voyageur, chaque enfant inscrit aussi : jamais plus que le séjour n'en compte.
    const comptes = fiches.length + fiches.reduce((n, f) => n + (f.enfants ?? 0), 0);
    if (nb !== null && comptes > nb && !erreurs.some((e) => e.champ === 'fiches')) erreurs.push({ champ: 'fiches' });
  }
  if (erreurs.length) return { ok: false, erreurs };
  return { ok: true, saisie: { arriveeEstimee: heure, nbPersonnes: nb!, reglesAcceptees: true, tousFrancais: x.tousFrancais === true, fiches } };
}

/**
 * Check-in à enregistrer : le premier envoi, ou une modification (même
 * ligne, compteur d'envois). Refusé quand le formulaire n'est plus
 * modifiable (etatFormulaire).
 */
export function nouveauCheckin(
  precedent: CheckinEnLigne | undefined,
  saisie: SaisieCheckin,
  o: { reservation: Pick<Reservation, 'id' | 'logementId' | 'statut' | 'arrivee' | 'depart'>; langue: LangueSejour; maintenant: Horodatage; aujourdhui: DateISO },
): { ok: true; checkin: CheckinEnLigne } | { ok: false; raison: 'annule' | 'ferme' | 'limite' } {
  const etat = etatFormulaire(o.reservation, precedent, o.aujourdhui);
  if (!etat.modifiable) return { ok: false, raison: etat.raison ?? 'ferme' };
  const r = o.reservation;
  const { garderFiches: _garder, ...propre } = saisie;
  void _garder;
  return {
    ok: true,
    checkin: {
      ...propre,
      id: r.id,
      reservationId: r.id,
      logementId: r.logementId,
      langue: o.langue === 'en' ? 'en' : 'fr',
      envoyeLe: precedent?.envoyeLe ?? o.maintenant,
      ...(precedent ? { modifieLe: o.maintenant } : {}),
      envois: (precedent?.envois ?? 0) + 1,
      conserverJusquAu: conservationJusquAu(r.depart),
    },
  };
}

/** Raisons d'un refus d'enregistrement, en français et en anglais. */
export const MESSAGES_REFUS_CHECKIN: Record<'annule' | 'ferme' | 'limite', Record<LangueSejour, string>> = {
  annule: { fr: 'Ce séjour a été annulé.', en: 'This stay has been cancelled.' },
  ferme: { fr: 'Le check-in en ligne est fermé. Écrivez-nous dans la messagerie si besoin.', en: 'Online check-in is closed. Message us if needed.' },
  limite: { fr: 'Le check-in a déjà été modifié plusieurs fois. Écrivez-nous dans la messagerie pour le changer.', en: 'Check-in has already been changed several times. Message us to change it.' },
};

/* ================================================================ purge */

/**
 * Check-ins à effacer maintenant : réservation annulée (tout de suite), ou
 * plus de MOIS_CONSERVATION mois après le départ (celui de la réservation
 * si elle est encore là, sinon la date gardée sur la ligne). Ligne sans date
 * lisible : effacée (rien n'est gardé faute de savoir jusqu'à quand).
 */
export function checkinsAPurger(
  checkins: readonly Pick<CheckinEnLigne, 'id' | 'reservationId' | 'conserverJusquAu'>[],
  reservations: readonly Pick<Reservation, 'id' | 'statut' | 'depart'>[],
  aujourdhui: DateISO,
): Id[] {
  const parId = new Map(reservations.map((r) => [r.id, r]));
  return checkins
    .filter((c) => {
      const r = parId.get(c.reservationId ?? c.id);
      if (r?.statut === 'annulee') return true;
      const limite = r && dateValide(r.depart) ? conservationJusquAu(r.depart) : c.conserverJusquAu;
      return !dateValide(limite) || aujourdhui > limite;
    })
    .map((c) => c.id);
}

/** Ce dont la purge a besoin de la base (BaseErp côté serveur, fausse base dans les vérifications). */
export interface BasePurge {
  lire<T>(collection: string, ids?: string[]): Promise<T[]>;
  supprimer(collection: string, ids: string[]): Promise<number>;
}

/** Efface, dans une base (un espace), les check-ins dont la conservation est finie ; renvoie le nombre effacé. */
export async function purgerCheckins(base: BasePurge, aujourdhui: DateISO): Promise<number> {
  const lignes = await base.lire<CheckinEnLigne>(COLLECTION_CHECKINS);
  if (!lignes.length) return 0;
  const reservations = await base.lire<Reservation>('reservations', [...new Set(lignes.map((c) => c.reservationId ?? c.id))]);
  const ids = checkinsAPurger(lignes, reservations, aujourdhui);
  return ids.length ? base.supprimer(COLLECTION_CHECKINS, ids) : 0;
}

/* ======================================================== la vue du voyageur */

export interface GuideSejour {
  id: Id;
  titre: string;
  type: GuideLogement['media']['type'];
  lien: string;
}

/** Ce que la page du voyageur reçoit, et rien d'autre. */
export interface VueSejour {
  conciergerie: string;
  prenom: string;
  canal: CanalReservation;
  arrivee: DateISO;
  depart: DateISO;
  nuits: number;
  voyageurs: number;
  /**
   * avant l'arrivée, pendant le séjour (le jour du départ compris, jusqu'à
   * l'heure de départ), après le départ (lien encore ouvert quelques jours).
   */
  moment: 'avant' | 'pendant' | 'apres';
  logement: {
    /** Titre de l'annonce ('' sans titre : jamais le nom interne, qui peut citer le propriétaire). */
    nom: string;
    ville: string;
    adresse: string;
    photo?: string;
    capacite: number;
    heureArrivee?: string;
    heureDepart?: string;
    parking?: string;
    transports?: string;
    regles?: string;
    conditions?: { animaux?: boolean; fumeur?: boolean; fetes?: boolean; calme?: { debut: string; fin: string } };
    aSavoir?: string;
    consignesDepart?: string;
    questions: { question: string; reponse: string }[];
  };
  /** Guides sans accès au logement (vidéos, documents, liens). */
  guides: GuideSejour[];
  /** Pas visibles : `aPartirDu` avant la fenêtre des codes ; absent le jour du départ et après (le code reste celui de l'arrivée). */
  acces: { visible: true; texte?: string; wifi?: { nom: string; code?: string }; guides: GuideSejour[] } | { visible: false; aPartirDu?: DateISO };
  checkin: {
    /** Le formulaire peut être enregistré (base prête). */
    ouvert: boolean;
    fait: boolean;
    envoyeLe?: Horodatage;
    modifiable: boolean;
    raison?: 'annule' | 'ferme' | 'limite';
    /** Ce qui a été envoyé, seulement tant qu'il est modifiable (pour le corriger), SANS les fiches de police. */
    saisie?: SaisieCheckin;
    /** Fiches de police déjà envoyées : leur nombre (et les personnes qu'elles comptent), jamais leur contenu. */
    fichesEnvoyees?: { fiches: number; personnes: number };
  };
  contact: { plateforme?: 'Airbnb' | 'Booking.com'; lien?: string; email?: string; telephone?: string };
}

export interface EntreesSejour {
  conciergerie: string;
  reservation: Reservation;
  logement?: Logement;
  checkin?: CheckinEnLigne;
  aujourdhui: DateISO;
  /** Heure à Paris (« HH:MM ») : le jour du départ, le séjour dure jusqu'à l'heure de départ. Absente : toute la journée. */
  heure?: string;
  /** Le check-in peut être enregistré (SQL passé : règles et purge en place). */
  checkinOuvert: boolean;
  /** Contacts de la conciergerie : seulement pour un séjour hors plateforme. */
  contacts?: { email?: string; telephone?: string };
}

/** Plateformes : on écrit à l'équipe dans leur messagerie. */
const PLATEFORMES: Partial<Record<CanalReservation, { plateforme: 'Airbnb' | 'Booking.com'; lien: string }>> = {
  airbnb: { plateforme: 'Airbnb', lien: 'https://www.airbnb.fr/trips' },
  booking: { plateforme: 'Booking.com', lien: 'https://secure.booking.com/mytrips.html' },
};

/** Photo du logement : celles de l'équipe d'abord, puis celles des plateformes (même ordre que photoCouverture, proprietaire.ts). */
function photoDuLogement(l: Logement | undefined): string | undefined {
  if (!l) return undefined;
  const equipe = (l.photosEquipe ?? []).find((p) => typeof p === 'string' && p.startsWith('stockage://'));
  if (equipe) return equipe;
  if (l.photoUrl?.startsWith('stockage://')) return l.photoUrl;
  return [...(l.photos ?? []), l.photoUrl].find((p): p is string => typeof p === 'string' && /^https:\/\/[^\s"'<>]+$/.test(p));
}

/** Mots d'accès près desquels un court jeton avec un chiffre est un code probable (« code postal » n'en est pas un). */
const MOT_D_ACCES =
  /(?<![\p{L}])(?:portails?|portes?|bo[iî]tes?|cadenas|badges?|digicodes?|interphones?|grilles?|barri[eè]res?|garages?|coffres?|bips?|t[ée]l[ée]commandes?|claviers?|gates?|doors?|keybox(?:es)?|lockbox(?:es)?|key\s?safes?|keypads?|padlocks?|intercoms?|codes?(?!\s+postal))(?![\p{L}])/giu;
/** Jeton d'au moins 3 signes dont un chiffre (« 482 », « B7Z », « 12#4 »). */
const JETON_CHIFFRE = /(?<![\p{L}\p{N}#*])(?:\d(?:[ \-.·/]\d){2,}|(?=[\p{L}\p{N}#*]*\d)[\p{L}\p{N}#*]{3,})(?![\p{L}\p{N}#*])/gu;
/** Jetons qui ressemblent à un code sans en être un : heure, ordinal, distance, durée, montant, débit. */
const PAS_UN_CODE_COURT = /^(\d{1,2}h\d{0,2}|\d{1,3}(er|re|e|ème|eme|nd|rd|th|st)|\d+(m|km|mn|min|mins|h|j|jours?|€|eur|euros?|mb|mbps|go|gb))$/iu;
/** Unité écrite après le nombre, séparée par une espace (« à 200 m », « 150 € ») : une distance, une durée, un montant. */
const UNITE_APRES = /^\s{1,2}(?:m|km|mètres?|metres?|mn|min|minutes?|h|heures?|€|eur|euros?)(?![\p{L}\p{N}])/iu;

/**
 * Un code écrit sans le mot « code » à côté d'un mot d'accès : « Portail du
 * parking : 482. », « Dans la boîte B7Z », « 482 au portail ». Un jeton d'au
 * moins 3 signes avec un chiffre, dans la même phrase, juste après le mot
 * (30 signes) ou juste avant lui (même membre de phrase). Prudent : un
 * numéro d'appartement près de « porte » compte aussi (le texte attend
 * alors les 48 h). Sert au livret et à l'avertissement de la fiche voyageur.
 */
export function codeProbable(texte: string | undefined): boolean {
  const t = String(texte ?? '').normalize('NFKC');
  for (const m of t.matchAll(MOT_D_ACCES)) {
    const debut = m.index ?? 0;
    const finMot = debut + m[0].length;
    // « 4.8.2 » ou « 4 8 2 » : le point ne coupe pas la phrase entre deux chiffres.
    const apres = t.slice(finMot, finMot + 60).split(/(?<!\d)[.]|[.](?!\d)|[\n;!?]/)[0];
    const avant = t.slice(Math.max(0, debut - 30), debut).split(/[.,:\n;!?]/).pop() ?? '';
    for (const [morceau, origine] of [
      [apres, finMot],
      [avant, debut - avant.length],
    ] as const) {
      for (const j of morceau.matchAll(JETON_CHIFFRE)) {
        const fin = origine + (j.index ?? 0) + j[0].length;
        if (!PAS_UN_CODE_COURT.test(j[0]) && !UNITE_APRES.test(t.slice(fin, fin + 12))) return true;
      }
    }
  }
  return false;
}

/**
 * Nombres qu'un voyageur doit lire tels quels avant les 48 h : code postal
 * (après « code postal », ou 5 chiffres suivis d'une ville en majuscule),
 * année après « en », « depuis », « in », « since »…, nombre suivi d'une
 * unité (distance, durée, montant), numéro de bus, de ligne, de RER, de
 * tram, « n° ». Tout le reste passe par masquerCodes : une suite inconnue
 * reste masquée (filet de sécurité), et codeProbable retire encore le texte
 * entier si l'un de ces nombres est près d'un mot d'accès.
 */
const NOMBRES_EVIDENTS = new RegExp(
  [
    String.raw`(?<=(?<![\p{L}])codes?\s+postal\s*:?\s*)\d{5}(?![\p{L}\p{N}])`,
    String.raw`(?<![\p{L}\p{N}])\d{5}(?=\s+\p{Lu})`,
    String.raw`(?<=(?<![\p{L}])(?:en|depuis|ann[ée]e|in|since|built(?:\s+in)?)\s+)(?:19|20)\d{2}(?![\p{L}\p{N}])`,
    String.raw`(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?\s?(?:m|km|m[èe]tres?|mn|mins?|minutes?|h|heures?|j|jours?|€|eur|euros?)(?![\p{L}\p{N}])`,
    String.raw`(?<=(?<![\p{L}])(?:bus|lignes?|lines?|rer|tram|n°|num[ée]ro|no\.)\s*)\d+(?![\p{L}\p{N}])`,
  ].join('|'),
  'giu',
);

/** masquerCodes pour le livret : les nombres évidents (NOMBRES_EVIDENTS) restent lisibles, le reste est masqué comme pour l'IA. */
export function masquerCodesLivret(texte: string): string {
  const t = nettoyerTexte(texte);
  let sortie = '';
  let debut = 0;
  for (const m of t.matchAll(NOMBRES_EVIDENTS)) {
    const i = m.index ?? 0;
    sortie += masquerCodes(t.slice(debut, i)) + m[0];
    debut = i + m[0].length;
  }
  return sortie + masquerCodes(t.slice(debut));
}

/**
 * Secrets qui font retirer un texte entier du livret avant les 48 h : ceux du
 * champ Accès, le wifi, et les codes cités après un mot d'accès dans les
 * autres champs (« Portail du parking : code 482 »). Jamais les nombres nus
 * des autres champs : « 91100 » ou « 2019 » ne sont pas des secrets.
 */
function secretsDuLivret(l: Logement | undefined): { acces: string; wifiCode: string; wifiNom: string } {
  const f = l?.fiche;
  const t = l?.descriptif?.textes ?? {};
  const autres = [f?.aSavoir, f?.consignesDepart, f?.parking, f?.regles, ...(f?.questions ?? []).map((q) => q?.reponse), t.resume, t.description, t.espace, t.accesVoyageurs, t.quartier, t.transports]
    .filter(Boolean)
    .join('\n')
    // « code postal 91100 » n'est pas un code d'accès.
    .replace(/(?<![\p{L}])codes?\s+postal\s*:?\s*\d{5}/giu, '');
  // Chaque code cité redevient « code X » : secretsAcces le reconnaît comme dans le champ Accès, même court (« 482 »).
  return { acces: [f?.acces ?? '', ...codesCitesApresMot(autres).map((c) => `code ${c}.`)].join('\n'), wifiCode: f?.wifiCode ?? '', wifiNom: f?.wifiNom ?? '' };
}

/** Texte court montré tel quel (titre d'un guide, adresse) : cite-t-il un code d'accès ou le wifi de ce logement ? */
const citeUnCode = (t: string | undefined, l: Logement | undefined): boolean => !!t?.trim() && contientCodeAcces(t, secretsDuLivret(l));

/**
 * Guides que la page peut montrer, selon les codes. Avant l'heure, un guide
 * « sans accès » dont le titre cite un code du logement est un guide d'accès
 * mal rangé : il attend comme eux.
 */
function guidesPermis(l: Logement | undefined, codes: boolean): { libres: GuideLogement[]; acces: GuideLogement[] } {
  const tous = (l?.fiche?.guides ?? []).filter(guideEnvoyable);
  return { libres: tous.filter((g) => !g.acces && (codes || !citeUnCode(g.titre, l))), acces: codes ? tous.filter((g) => g.acces) : [] };
}

/**
 * Fichiers déposés que la vue montrera (photo, guides permis) : le serveur
 * les signe d'abord, puis passe le résultat à vueSejour.
 */
export function fichiersDeLaVue(e: Pick<EntreesSejour, 'reservation' | 'logement' | 'aujourdhui'>): string[] {
  const g = guidesPermis(e.logement, codesVisibles(e.reservation, e.aujourdhui));
  const photo = photoDuLogement(e.logement);
  return [...(photo?.startsWith('stockage://') ? [photo] : []), ...[...g.libres, ...g.acces].map((x) => x.media?.fichier ?? '').filter(estFichierGuide)];
}

/**
 * La vue du voyageur. `lien` donne l'adresse signée d'un fichier déposé
 * (undefined : pas montré). Codes, wifi, accès et guides d'accès seulement
 * dans la fenêtre des codes ; avant, chaque texte passe par masquerCodes et
 * n'est pas montré s'il contient encore un code ou le wifi du logement.
 */
export function vueSejour(e: EntreesSejour, lien: (fichier: string) => string | undefined = () => undefined): VueSejour {
  const r = e.reservation;
  const l = e.logement;
  const f = l?.fiche;
  const codes = codesVisibles(r, e.aujourdhui);
  const secrets = secretsDuLivret(l);
  const sur = (t: string | undefined): string | undefined => {
    const brut = t?.trim();
    if (!brut) return undefined;
    if (codes) return brut;
    // Le wifi (nom ou mot de passe) cherché AVANT le masquage : masquerCodes en couperait les chiffres
    // (« soleil2026 » → « soleil[code…] ») et le reste du mot de passe passerait.
    if (contientCodeAcces(brut, { wifiCode: f?.wifiCode ?? '', wifiNom: f?.wifiNom ?? '' })) return undefined;
    // Code postal, année, distance, numéro de bus : lisibles ; toute autre suite de chiffres masquée.
    const masque = masquerCodesLivret(brut).trim();
    // Un code de l'accès ou cité ailleurs, ou un code court sans le mot « code » (« Portail : 482 ») : le texte attend les 48 h.
    return masque && !contientCodeAcces(masque, secrets) && !codeProbable(masque) ? masque : undefined;
  };
  const versGuide = (g: GuideLogement): GuideSejour | null => {
    const adresse = estLienGuide(g.media?.url) ? g.media.url!.trim() : estFichierGuide(g.media?.fichier) ? lien(g.media.fichier!) : undefined;
    return adresse ? { id: g.id, titre: g.titre.trim().slice(0, 120), type: g.media.type, lien: adresse } : null;
  };
  const g = guidesPermis(l, codes);
  const photo = photoDuLogement(l);
  // Règles de l'annonce (plateforme) seulement si l'équipe n'a pas écrit les siennes : jamais deux règlements qui se contredisent.
  const c = sur(f?.regles) ? undefined : l?.descriptif?.conditions;
  const conditions = c
    ? {
        ...(typeof c.animaux === 'boolean' ? { animaux: c.animaux } : {}),
        ...(typeof c.fumeur === 'boolean' ? { fumeur: c.fumeur } : {}),
        ...(typeof c.fetes === 'boolean' ? { fetes: c.fetes } : {}),
        ...(c.calme && /^\d{2}:\d{2}$/.test(c.calme.debut) && /^\d{2}:\d{2}$/.test(c.calme.fin) ? { calme: { debut: c.calme.debut, fin: c.calme.fin } } : {}),
      }
    : undefined;
  const formulaire = etatFormulaire(r, e.checkin, e.aujourdhui);
  const wifiNom = f?.wifiNom?.trim();
  // Avant l'heure, une rue qui cite un code du logement (« digicode 4821 ») : seulement le code postal et la ville.
  const rue = l?.adresse?.trim();
  const adresse = l ? [rue && (codes || !citeUnCode(rue, l)) ? rue : undefined, [l.codePostal?.trim(), l.ville?.trim()].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '';
  const plateforme = PLATEFORMES[r.canal];
  const heureDepart = /^([01]\d|2[0-3]):[0-5]\d/.exec(f?.heureDepart?.trim() ?? '')?.[0] ?? '11:00';
  const pendant = e.aujourdhui < r.depart || (e.aujourdhui === r.depart && (e.heure ?? '00:00') < heureDepart);
  return {
    conciergerie: e.conciergerie,
    prenom: prenomDe(r.voyageur?.nom),
    canal: r.canal,
    arrivee: r.arrivee,
    depart: r.depart,
    nuits: r.nuits,
    voyageurs: r.voyageur?.nbPersonnes ?? 1,
    moment: e.aujourdhui < r.arrivee ? 'avant' : pendant ? 'pendant' : 'apres',
    logement: {
      // Le titre vu par les voyageurs sur la plateforme ; jamais le nom interne (il peut citer le propriétaire).
      nom: (l?.descriptif?.titre?.trim() || '').slice(0, 120),
      ville: (l?.ville?.trim() || '').slice(0, 80),
      adresse,
      ...(photo ? (photo.startsWith('stockage://') ? (lien(photo) ? { photo: lien(photo) } : {}) : { photo }) : {}),
      capacite: l?.capacite && l.capacite > 0 ? Math.min(l.capacite, MAX_VOYAGEURS) : MAX_VOYAGEURS,
      // Champs libres eux aussi : même règle que les autres textes (« 16:00, boîte 4821 »).
      ...(sur(f?.heureArrivee) ? { heureArrivee: sur(f?.heureArrivee) } : {}),
      ...(sur(f?.heureDepart) ? { heureDepart: sur(f?.heureDepart) } : {}),
      ...(sur(f?.parking) ? { parking: sur(f?.parking) } : {}),
      ...(sur(l?.descriptif?.textes?.transports) ? { transports: sur(l?.descriptif?.textes?.transports) } : {}),
      ...(sur(f?.regles) ? { regles: sur(f?.regles) } : {}),
      ...(conditions && Object.keys(conditions).length ? { conditions } : {}),
      ...(sur(f?.aSavoir) ? { aSavoir: sur(f?.aSavoir) } : {}),
      ...(sur(f?.consignesDepart) ? { consignesDepart: sur(f?.consignesDepart) } : {}),
      questions: (f?.questions ?? [])
        .filter((q) => q?.question?.trim() && q.reponse?.trim())
        .slice(0, 30)
        .map((q) => ({ question: sur(q.question), reponse: sur(q.reponse) }))
        .filter((q): q is { question: string; reponse: string } => !!q.question && !!q.reponse),
    },
    guides: g.libres.map(versGuide).filter((x): x is GuideSejour => !!x),
    acces: codes
      ? {
          visible: true,
          ...(f?.acces?.trim() ? { texte: f.acces.trim() } : {}),
          ...(wifiNom ? { wifi: { nom: wifiNom, ...(f?.wifiCode?.trim() ? { code: f.wifiCode.trim() } : {}) } } : {}),
          guides: g.acces.map(versGuide).filter((x): x is GuideSejour => !!x),
        }
      : { visible: false, ...(e.aujourdhui < codesVisiblesLe(r.arrivee) ? { aPartirDu: codesVisiblesLe(r.arrivee) } : {}) },
    checkin: {
      ouvert: e.checkinOuvert,
      fait: !!e.checkin,
      ...(e.checkin?.envoyeLe ? { envoyeLe: e.checkin.envoyeLe } : {}),
      modifiable: e.checkinOuvert && formulaire.modifiable,
      ...(formulaire.raison ? { raison: formulaire.raison } : {}),
      // Le lien est un porteur (messagerie, équipe, plateforme) : les fiches de police n'en ressortent jamais.
      ...(e.checkin && formulaire.modifiable
        ? {
            saisie: {
              arriveeEstimee: e.checkin.arriveeEstimee,
              nbPersonnes: e.checkin.nbPersonnes,
              reglesAcceptees: true,
              tousFrancais: e.checkin.tousFrancais,
              fiches: [],
            },
            ...(e.checkin.fiches?.length
              ? { fichesEnvoyees: { fiches: e.checkin.fiches.length, personnes: e.checkin.fiches.reduce((n, f) => n + 1 + (f.enfants ?? 0), 0) } }
              : {}),
          }
        : {}),
    },
    contact: plateforme ?? {
      ...(e.contacts?.email ? { email: e.contacts.email } : {}),
      ...(e.contacts?.telephone ? { telephone: e.contacts.telephone } : {}),
    },
  };
}

/* ========================================================= côté équipe */

/** Ce que la fiche d'une réservation montre à l'équipe (api/sejour.ts, action « equipe »). */
export interface SuiviSejour {
  etat: EtatLienSejour;
  /** Lien à copier (absent : séjour annulé, lien expiré, ou secret pas encore posé). */
  lien?: string;
  lienJusquAu?: DateISO;
  /** Pourquoi il n'y a pas de lien alors que le séjour est ouvert. */
  raison?: string;
  /** Check-in ; pour un compte qui n'est pas gérant, sans les fiches de police (fichesReservees). */
  checkin?: CheckinEnLigne;
  /** Compte « opérations » : nombre de fiches de police, leur contenu reste aux gérants (règle de la base). */
  fichesReservees?: number;
}

/**
 * Check-in montré par la fiche d'une réservation : complet pour un gérant ;
 * pour un compte « opérations », sans les fiches de police (comme la règle
 * « acces exterieurs reserves aux gerants » de la base), leur nombre seulement.
 */
export function suiviCheckin(c: CheckinEnLigne | undefined, gerant: boolean): Pick<SuiviSejour, 'checkin' | 'fichesReservees'> {
  if (!c) return {};
  if (gerant) return { checkin: c };
  const n = c.fiches?.length ?? 0;
  return { checkin: { ...c, fiches: [] }, ...(n ? { fichesReservees: n } : {}) };
}

/** Démo : check-ins gardés dans ce navigateur, jamais ailleurs. */
export const CLE_DEMO_CHECKINS = 'lm-erp-demo-checkins';

/** Espace des données d'un séjour sans espace (base d'avant les espaces) : Label Maison. */
export const espaceDuSejour = (espace: string | null | undefined): string => (idEspaceValide(espace) ? espace.toLowerCase() : ID_LABEL_MAISON);
