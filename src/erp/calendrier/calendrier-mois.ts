/**
 * Règles pures du calendrier mensuel, à la manière de l'app Airbnb (côté
 * hôte) : des mois les uns sous les autres, les séjours en bandes qui vont
 * du milieu du jour d'arrivée au milieu du jour de départ, le nom du
 * voyageur une fois au début de la bande.
 *
 * Rien d'ici ne connaît le store de l'ERP ni la session du propriétaire :
 * un mois est une liste de jours (`JourCalendrier`) et de séjours. L'espace
 * propriétaire les reçoit du serveur (« Prénom N. ») ; l'ERP les calcule
 * sur ses réservations (prénom complet). Vérifié par
 * data/verifier-proprietaire.ts.
 */
import { jourMois } from '../data/format';
import { ecartJoursISO, ecartMois, moisEntre, moisPrecedent, moisSuivant } from '../data/proprietaire';
import type { CanalReservation, DateISO } from '../data/types';
import type { JourCalendrier, SejourCalendrierVue } from '../data/types-proprietaire';

export type { JourCalendrier };

/** Séjour posé sur le calendrier ; `id` : la réservation à ouvrir dans l'ERP (absent pour le propriétaire). */
export interface SejourCalendrier extends SejourCalendrierVue {
  id?: string;
}

/** Un mois prêt à afficher. */
export interface MoisCalendrier {
  mois: string;
  jours: JourCalendrier[];
  sejours: SejourCalendrier[];
  nuitsReservees: number;
  nuitsLibres: number;
  occupation: number;
}

/** Initiales des jours, du lundi au dimanche. */
export const JOURS_SEMAINE = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Mois chargés à la fois en défilant (vers l'avant comme vers l'arrière). */
export const MOIS_PAR_PAS = 3;
/** Jusqu'où le défilement remonte et avance, à partir du mois en cours. */
export const MOIS_ARRIERE_MAX = 12;
export const MOIS_AVANT_MAX = 12;

export { ecartMois, moisEntre, moisPrecedent, moisSuivant };

/** Cases vides avant le 1er (grille qui commence le lundi). */
export function decalageDuMois(mois: string): number {
  return (new Date(`${mois}-01T12:00:00Z`).getUTCDay() + 6) % 7;
}

/** Les semaines du mois : des lignes de 7 cases, `null` hors du mois. */
export function lignesDuMois(mois: string, jours: readonly JourCalendrier[]): (JourCalendrier | null)[][] {
  const cases: (JourCalendrier | null)[] = [...Array.from({ length: decalageDuMois(mois) }, () => null), ...jours];
  while (cases.length % 7) cases.push(null);
  const lignes: (JourCalendrier | null)[][] = [];
  for (let i = 0; i < cases.length; i += 7) lignes.push(cases.slice(i, i + 7));
  return lignes;
}

/**
 * Un morceau de bande sur une ligne du calendrier. `de` et `a` en cases
 * (0..7, demi-cases comprises) : la bande commence au milieu du jour
 * d'arrivée et finit au milieu du jour de départ ; coupée net au bord du
 * mois ou de la ligne.
 */
export interface BandeCalendrier {
  sejour: SejourCalendrier;
  ligne: number;
  de: number;
  a: number;
  /** Le séjour commence ici (bout arrondi à gauche, écart avec la bande d'avant). */
  arrivee: boolean;
  /** Le séjour finit ici (bout arrondi à droite, écart avec la bande d'après). */
  depart: boolean;
  /** Premier morceau du séjour dans ce mois : il porte le nom. */
  libelle: boolean;
}

/**
 * Appariement séjour ↔ bande : les morceaux de bande de chaque séjour,
 * ligne par ligne. Le nom va sur le premier morceau d'au moins une case
 * (un séjour qui commence un dimanche n'a qu'une demi-case sur sa ligne :
 * le nom passe à la ligne suivante) ; à défaut, sur le premier. Un
 * chassé-croisé le même jour donne deux bandes qui se touchent au milieu de
 * la case (le composant les sépare d'un filet).
 */
export function bandesDuMois(mois: string, jours: readonly JourCalendrier[], sejours: readonly SejourCalendrier[]): BandeCalendrier[] {
  const n = jours.length;
  if (!n) return [];
  const premier = `${mois}-01`;
  const decalage = decalageDuMois(mois);
  const res: BandeCalendrier[] = [];
  for (const s of [...sejours].sort((x, y) => x.arrivee.localeCompare(y.arrivee))) {
    const iArrivee = ecartJoursISO(premier, s.arrivee);
    const iDepart = ecartJoursISO(premier, s.depart);
    if (iDepart < 0 || iArrivee >= n || iDepart <= iArrivee) continue;
    const arriveeIci = iArrivee >= 0;
    const departIci = iDepart < n;
    // Position en cases dans la grille (demi-case au départ et à l'arrivée).
    const debut = arriveeIci ? decalage + iArrivee + 0.5 : decalage;
    const fin = departIci ? decalage + iDepart + 0.5 : decalage + n;
    const morceaux: BandeCalendrier[] = [];
    for (let ligne = Math.floor(debut / 7); ligne * 7 < fin; ligne++) {
      const de = Math.max(debut, ligne * 7) - ligne * 7;
      const a = Math.min(fin, ligne * 7 + 7) - ligne * 7;
      if (a <= de) continue;
      morceaux.push({ sejour: s, ligne, de, a, arrivee: arriveeIci && debut >= ligne * 7, depart: departIci && fin <= ligne * 7 + 7, libelle: false });
    }
    const large = morceaux.find((m) => m.a - m.de >= 1) ?? morceaux[0];
    if (large) large.libelle = true;
    res.push(...morceaux);
  }
  return res;
}

/** Le séjour dont la nuit du jour au lendemain est réservée (le voyageur qui dort là ce soir). */
export function sejourDuJour(sejours: readonly SejourCalendrier[], date: DateISO): SejourCalendrier | undefined {
  return sejours.find((s) => s.arrivee <= date && date < s.depart);
}

/** Le séjour qui finit ce jour (quelqu'un se réveille dans le logement et part). */
export function sejourQuiPart(sejours: readonly SejourCalendrier[], date: DateISO): SejourCalendrier | undefined {
  return sejours.find((s) => s.depart === date);
}

const HORS = { avant: 'avant votre arrivée', apres: 'après votre départ', autre: 'séjour de l’ancien propriétaire' } as const;

/**
 * Libellé accessible d'un jour : « 12 nov. : arrivée de Marie D. »,
 * « 13 nov. : réservé, Marie D. », « 15 nov. : départ de Marie D. »,
 * « 16 nov. : libre », « 17 nov., aujourd’hui : libre ».
 */
export function libelleJour(j: JourCalendrier, sejours: readonly SejourCalendrier[], aujourdhui?: DateISO): string {
  const quand = `${jourMois(j.date)}${j.date === aujourdhui ? ', aujourd’hui' : ''}`;
  if (j.hors) return `${quand} : ${HORS[j.hors]}`;
  const arrive = j.arrivee ? sejourDuJour(sejours, j.date) : undefined;
  const part = j.depart ? sejourQuiPart(sejours, j.date) : undefined;
  const nom = (s: SejourCalendrier | undefined) => (s ? ` ${s.voyageur}` : '');
  if (arrive && part) return `${quand} : départ de${nom(part)}, arrivée de${nom(arrive)}`;
  if (arrive) return `${quand} : arrivée de${nom(arrive)}`;
  if (part) return `${quand} : départ de${nom(part)}`;
  if (j.occupe) {
    const s = sejourDuJour(sejours, j.date);
    return `${quand} : réservé${s ? `, ${s.voyageur}` : ''}`;
  }
  return `${quand} : libre`;
}

/** « 12 → 15 nov. » (« 28 oct. → 2 nov. » quand le mois change). */
export function datesSejour(s: Pick<SejourCalendrier, 'arrivee' | 'depart'>): string {
  const a = jourMois(s.arrivee);
  const d = jourMois(s.depart);
  const memeMois = s.arrivee.slice(0, 7) === s.depart.slice(0, 7);
  return memeMois ? `${a.split(' ')[0]} → ${d}` : `${a} → ${d}`;
}

/** Libellé complet d'une bande (bouton) : « Marie D., du 12 au 15 nov., 3 nuits ». */
export function libelleSejour(s: SejourCalendrier, nom: string = s.voyageur): string {
  const nuits = `${s.nuits} ${s.nuits >= 2 ? 'nuits' : 'nuit'}`;
  return `${nom}, du ${jourMois(s.arrivee)} au ${jourMois(s.depart)}, ${nuits}`;
}

export const CANAL_CALENDRIER: Record<CanalReservation, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  direct: 'Réservation directe',
  autre: 'Autre plateforme',
};

/**
 * « 12 nuits réservées · 19 libres · 39 % ». Sans séjour, pas de chiffres à
 * zéro : « 31 nuits libres » ; sans nuit à lui dans le mois (hors période) : rien.
 */
export function ligneChiffres(m: Pick<MoisCalendrier, 'nuitsReservees' | 'nuitsLibres' | 'occupation'>): string {
  const total = m.nuitsReservees + m.nuitsLibres;
  if (!total) return '';
  const r = m.nuitsReservees;
  const l = m.nuitsLibres;
  if (!r) return `${l} ${l >= 2 ? 'nuits libres' : 'nuit libre'}`;
  return `${r} ${r >= 2 ? 'nuits réservées' : 'nuit réservée'} · ${l} ${l >= 2 ? 'libres' : 'libre'} · ${Math.round(m.occupation * 100)} %`;
}

/**
 * Mois manquants d'une fenêtre, regroupés en plages contiguës `[de, a]` :
 * ce que le défilement demande au chargeur, 12 mois au plus par plage.
 */
export function plagesManquantes(mois: readonly string[], connu: (m: string) => boolean, max = 12): [string, string][] {
  const res: [string, string][] = [];
  let de: string | undefined;
  let a: string | undefined;
  const fermer = () => {
    if (de && a) res.push([de, a]);
    de = a = undefined;
  };
  for (const m of mois) {
    if (connu(m)) {
      fermer();
      continue;
    }
    if (de && a && (moisSuivant(a) !== m || ecartMois(de, m) + 1 > max)) fermer();
    de ??= m;
    a = m;
  }
  fermer();
  return res;
}
