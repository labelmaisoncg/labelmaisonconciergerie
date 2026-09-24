/** Utilitaires de dates, tout en heure de Paris. */

const PARIS = 'Europe/Paris';

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export const aujourdhui = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

/** Heure locale à Paris (0-23) — les crons tournent en UTC, pas nous. */
export const heureParis = (): number =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: PARIS, hour: '2-digit', hour12: false }).format(new Date()));

export const ajouterJours = (iso: string, jours: number): string => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
};

/** « mardi 3 septembre » — on n'affiche jamais de AAAA-MM-JJ à un humain. */
export const enFrancais = (iso: string): string => {
  if (!iso) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: PARIS,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${iso}T12:00:00Z`));
};

export const estValide = (iso: unknown): iso is string =>
  typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso));
