/**
 * Formats d'affichage (euros, dates FR, pluriels) et arithmétique de dates.
 *
 * Tout calcul « aujourd'hui » passe par AUJOURDHUI, jamais par new Date() :
 * - en production (données réelles), c'est la date du jour à Paris, prise au
 *   chargement de la page (le store recharge la page au changement de jour) ;
 * - en démo (VITE_ERP_DEMO=1), la date est figée pour que la maquette reste stable.
 */
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MODE_DEMO } from './config';
import type { Centimes, DateISO } from './types';

/** Date figée du jeu de démonstration. */
export const DATE_DEMO: DateISO = '2026-09-24';

const PARIS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function partiesParis(d: Date): Record<string, string> {
  return Object.fromEntries(PARIS.formatToParts(d).map((p) => [p.type, p.value]));
}

const deux = (n: number) => String(n).padStart(2, '0');

/** Date du jour à Paris, 'YYYY-MM-DD', quel que soit le fuseau de l'appareil. */
export function dateParis(d: Date = new Date()): DateISO {
  const p = partiesParis(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Horodatage ISO à l'heure de Paris avec son décalage : « 2026-09-24T10:30:00+02:00 ». */
export function horodatageParis(d: Date = new Date()): string {
  const p = partiesParis(d);
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const ecart = Math.round((local - Math.floor(d.getTime() / 1000) * 1000) / 60000);
  const abs = Math.abs(ecart);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${ecart < 0 ? '-' : '+'}${deux(Math.floor(abs / 60))}:${deux(abs % 60)}`;
}

/** Aujourd'hui : date réelle à Paris (production) ou date figée (démo). */
export const AUJOURDHUI: DateISO = MODE_DEMO ? DATE_DEMO : dateParis();
/** Heure de référence au chargement (figée en démo). */
export const MAINTENANT = MODE_DEMO ? `${AUJOURDHUI}T10:30:00+02:00` : horodatageParis();

/* ------------------------------------------------------------------ argent */

const EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const EUROS_RONDS = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/** 123456 → « 1 234,56 € ». `arrondi` masque les centimes. */
export function euros(centimes: Centimes, arrondi = false): string {
  return (arrondi ? EUROS_RONDS : EUROS).format(centimes / 100);
}

/** Euros saisis (ex. « 12,5 ») → centimes entiers ; NaN si illisible. */
export function versCentimes(saisie: string | number): Centimes {
  const n = typeof saisie === 'number' ? saisie : Number(saisie.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/* ----------------------------------------------------------------- nombres */

const NOMBRE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function nombre(n: number, decimales = 0): string {
  return decimales
    ? new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      }).format(n)
    : NOMBRE.format(n);
}

/** Valeur impossible à calculer faute de données (base vide, division par zéro). */
export const SANS_DONNEE = 'Aucune donnée';

/** 0.734 → « 73 % » ; `decimales` pour « 73,4 % ». Ratio incalculable : « Aucune donnée ». */
export function pourcentage(ratio: number, decimales = 0): string {
  if (!Number.isFinite(ratio)) return SANS_DONNEE;
  return `${nombre(ratio * 100, decimales)} %`;
}

/** pluriel(3, 'nuit') → « 3 nuits » ; forme plurielle explicite si irrégulière. */
export function pluriel(n: number, singulier: string, pluriel?: string): string {
  const mot = Math.abs(n) >= 2 ? (pluriel ?? `${singulier}s`) : singulier;
  return `${nombre(n)} ${mot}`;
}

/** Note voyageur : 4.8 → « 4,8 ». */
export function note(n: number | undefined): string {
  return n === undefined || !Number.isFinite(n) ? '-' : nombre(n, 1);
}

/* ------------------------------------------------------------------- dates */

function versDate(valeur: string): Date {
  return parseISO(valeur);
}

/** « 24 sept. 2026 » */
export function dateCourte(valeur: string): string {
  return format(versDate(valeur), 'd MMM yyyy', { locale: fr });
}

/** « mer. 24 sept. » */
export function dateJour(valeur: string): string {
  return format(versDate(valeur), 'EEE d MMM', { locale: fr });
}

/** « 24 sept. » */
export function jourMois(valeur: string): string {
  return format(versDate(valeur), 'd MMM', { locale: fr });
}

/** « septembre 2026 » (à partir d'une date ou d'une période 'YYYY-MM'). */
export function moisAnnee(valeur: string): string {
  const iso = valeur.length === 7 ? `${valeur}-01` : valeur;
  return format(versDate(iso), 'MMMM yyyy', { locale: fr });
}

/** « 24 sept. 2026 à 10:30 » */
export function dateHeure(horodatage: string): string {
  return `${dateCourte(horodatage.slice(0, 10))} à ${heure(horodatage)}`;
}

/** « 10:30 » */
// Toujours à l'heure de Paris, quel que soit le fuseau du navigateur.
const HEURE_PARIS = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

export function heure(horodatage: string): string {
  return HEURE_PARIS.format(new Date(horodatage));
}

/** Libellé relatif à AUJOURDHUI : « aujourd'hui », « demain », « dans 3 jours », « il y a 5 jours ». */
export function relatif(valeur: string, reference: DateISO = AUJOURDHUI): string {
  const d = ecartJours(reference, valeur.slice(0, 10));
  if (d === 0) return "aujourd'hui";
  if (d === 1) return 'demain';
  if (d === -1) return 'hier';
  return d > 0 ? `dans ${pluriel(d, 'jour')}` : `il y a ${pluriel(-d, 'jour')}`;
}

/* -------------------------------------------------- arithmétique de dates */

/** Décale une date 'YYYY-MM-DD' de n jours. */
export function ajouterJours(date: DateISO, n: number): DateISO {
  return format(addDays(versDate(date), n), 'yyyy-MM-dd');
}

/** Nombre de jours calendaires de `de` à `a` (positif si `a` est après). */
export function ecartJours(de: DateISO, a: DateISO): number {
  return differenceInCalendarDays(versDate(a), versDate(de));
}

/** Premier jour du mois de `date`. */
export function debutMois(date: DateISO): DateISO {
  return `${date.slice(0, 7)}-01`;
}

/** Premier jour du mois suivant `date`. */
export function debutMoisSuivant(date: DateISO): DateISO {
  const [a, m] = date.slice(0, 7).split('-').map(Number);
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
}

/** Période 'YYYY-MM' de `date`. */
export function periode(date: DateISO): string {
  return date.slice(0, 7);
}

/** Initiales pour un avatar : « Abdel Karim » → « AK ». */
export function initiales(nom: string): string {
  const mots = nom.replace(/^(SCI|SAS|SARL|SASU)\s+/i, '').split(/\s+/).filter(Boolean);
  return ((mots[0]?.[0] ?? '') + (mots[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Horodatage d'une action : l'instant réel à Paris (démo : date figée, heure réelle). */
export function horodatageMaintenant(): string {
  if (!MODE_DEMO) return horodatageParis();
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${AUJOURDHUI}T${hh}:${mm}:${ss}+02:00`;
}
