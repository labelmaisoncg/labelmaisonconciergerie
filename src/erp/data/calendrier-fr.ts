/**
 * Calendrier français utile aux prix : jours fériés (calculés pour toute
 * année) et vacances scolaires de la zone C (Essonne : académie de
 * Versailles ; Paris et Créteil aussi), en données fixes.
 *
 * Vacances scolaires : calendrier officiel de l'Éducation nationale
 * (education.gouv.fr), à compléter chaque année. Une période va du samedi
 * où les cours s'arrêtent (première nuit) au jour de la reprise (exclu).
 * Les dates de 2027 marquées « à vérifier » sont à confirmer à la parution
 * de l'arrêté.
 *
 * Module pur, sans import : il tourne aussi côté serveur (fonctions Vercel).
 */

export type DateISO = string;

const JOUR_MS = 86_400_000;
const enMs = (d: DateISO) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const versISO = (ms: number): DateISO => new Date(ms).toISOString().slice(0, 10);
const plusJours = (d: DateISO, n: number): DateISO => versISO(enMs(d) + n * JOUR_MS);

/** Dimanche de Pâques (algorithme grégorien anonyme). */
export function paques(annee: number): DateISO {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
}

const cache = new Map<number, Map<DateISO, string>>();

/** Les onze jours fériés de France métropolitaine d'une année, avec leur nom. */
export function joursFeries(annee: number): Map<DateISO, string> {
  const connu = cache.get(annee);
  if (connu) return connu;
  const p = paques(annee);
  const a = String(annee);
  const liste: [DateISO, string][] = [
    [`${a}-01-01`, 'Jour de l’an'],
    [plusJours(p, 1), 'Lundi de Pâques'],
    [`${a}-05-01`, 'Fête du Travail'],
    [`${a}-05-08`, 'Victoire 1945'],
    [plusJours(p, 39), 'Ascension'],
    [plusJours(p, 50), 'Lundi de Pentecôte'],
    [`${a}-07-14`, 'Fête nationale'],
    [`${a}-08-15`, 'Assomption'],
    [`${a}-11-01`, 'Toussaint'],
    [`${a}-11-11`, 'Armistice'],
    [`${a}-12-25`, 'Noël'],
  ];
  const m = new Map(liste);
  cache.set(annee, m);
  return m;
}

/** Nom du jour férié de cette date, s'il en est un. */
export function jourFerie(d: DateISO): string | undefined {
  return joursFeries(Number(d.slice(0, 4))).get(d);
}

/** Vacances scolaires, zone C : [première nuit, reprise[ et leur nom. */
export const VACANCES_ZONE_C: readonly { debut: DateISO; fin: DateISO; nom: string }[] = [
  { debut: '2025-10-18', fin: '2025-11-03', nom: 'vacances de la Toussaint' },
  { debut: '2025-12-20', fin: '2026-01-05', nom: 'vacances de Noël' },
  { debut: '2026-02-21', fin: '2026-03-09', nom: 'vacances d’hiver' },
  { debut: '2026-04-18', fin: '2026-05-04', nom: 'vacances de printemps' },
  { debut: '2026-05-14', fin: '2026-05-18', nom: 'pont de l’Ascension' },
  { debut: '2026-07-04', fin: '2026-09-01', nom: 'vacances d’été' },
  { debut: '2026-10-17', fin: '2026-11-02', nom: 'vacances de la Toussaint' },
  { debut: '2026-12-19', fin: '2027-01-04', nom: 'vacances de Noël' },
  // 2027 : à vérifier à la parution du calendrier officiel.
  { debut: '2027-02-06', fin: '2027-02-22', nom: 'vacances d’hiver' },
  { debut: '2027-04-03', fin: '2027-04-19', nom: 'vacances de printemps' },
  { debut: '2027-05-06', fin: '2027-05-10', nom: 'pont de l’Ascension' },
  { debut: '2027-07-03', fin: '2027-09-01', nom: 'vacances d’été' },
];

/** Nom des vacances scolaires (zone C) qui couvrent cette nuit, s'il y en a. */
export function vacancesScolaires(nuit: DateISO): string | undefined {
  return VACANCES_ZONE_C.find((v) => v.debut <= nuit && nuit < v.fin)?.nom;
}

/** Nuit de week-end : celle du vendredi ou du samedi. */
export function nuitDeWeekend(nuit: DateISO): boolean {
  const j = new Date(enMs(nuit)).getUTCDay();
  return j === 5 || j === 6;
}

export interface JourDemande {
  weekend: boolean;
  /** Veille de jour férié (ou jour férié) : nom du jour férié. */
  ferie?: string;
  /** Vacances scolaires de la zone C. */
  vacances?: string;
}

/**
 * Ce que le calendrier dit d'une nuit : week-end, veille de jour férié (les
 * voyageurs dorment la veille), vacances scolaires.
 */
export function jourDemande(nuit: DateISO): JourDemande {
  const ferie = jourFerie(plusJours(nuit, 1)) ?? jourFerie(nuit);
  const vacances = vacancesScolaires(nuit);
  return { weekend: nuitDeWeekend(nuit), ...(ferie ? { ferie } : {}), ...(vacances ? { vacances } : {}) };
}
