/**
 * Calculs propres à l'écran Ménages (urgence, délais, contrôles).
 * Les règles partagées restent dans data/selectors.ts.
 */
import { AUJOURDHUI, MAINTENANT, ajouterJours, pluriel } from '../../../data/format';
import { estActive } from '../../../data/selectors';
import type { ElementChecklist, ErpDonnees, Journal, Logement, Mission, Reservation } from '../../../data/types';
import type { Ton } from '../../../ui';

/** Prochaine arrivée dans le logement de la mission (le jour même inclus). */
export function prochaineArrivee(m: Mission, reservations: Reservation[]): Reservation | undefined {
  return reservations
    .filter((r) => r.logementId === m.logementId && estActive(r) && r.arrivee >= m.date && r.id !== m.reservationId)
    .sort((a, b) => a.arrivee.localeCompare(b.arrivee))[0];
}

const ms = (iso: string) => new Date(iso).getTime();

/** Heures entre MAINTENANT (maquette) et une date + heure locales. */
export function heuresAvant(date: string, heure: string): number {
  return Math.round((ms(`${date}T${heure}:00+02:00`) - ms(MAINTENANT)) / 3_600_000);
}

export interface Urgence {
  heures: number | undefined;
  libelle: string;
  ton: Ton;
}

/** Compte à rebours jusqu'à l'arrivée suivante du voyageur. */
export function urgence(m: Mission, d: Pick<ErpDonnees, 'reservations' | 'logements'>): Urgence {
  const suivante = prochaineArrivee(m, d.reservations);
  if (!suivante) return { heures: undefined, libelle: 'Aucune arrivée prévue', ton: 'neutre' };
  const logement = d.logements.find((l) => l.id === m.logementId);
  const h = heuresAvant(suivante.arrivee, logement?.fiche.heureArrivee ?? m.heureFinMax);
  const ton: Ton = h < 0 ? 'danger' : h <= 24 ? 'danger' : h <= 48 ? 'alerte' : 'neutre';
  let libelle: string;
  if (h < 0) libelle = 'Voyageur déjà arrivé';
  else if (h < 48) libelle = `Arrivée dans ${pluriel(h, 'heure')}`;
  else libelle = `Arrivée dans ${pluriel(Math.round(h / 24), 'jour')}`;
  return { heures: h, libelle, ton };
}

/** Délai moyen (heures) entre la dernière photo « après » et la validation, d'après le journal. */
export function delaiMoyenValidation(missions: Mission[], journal: Journal[]): { heures: number | undefined; echantillon: number } {
  const delais: number[] = [];
  for (const j of journal.filter((x) => x.action === 'Mission validée')) {
    const m = missions.find((x) => x.id === j.entiteId);
    const apres = m?.photos.filter((p) => p.moment === 'apres').map((p) => ms(p.prisLe));
    if (!apres?.length) continue;
    const h = (ms(j.horodatage) - Math.max(...apres)) / 3_600_000;
    if (h >= 0) delais.push(h);
  }
  if (!delais.length) return { heures: undefined, echantillon: 0 };
  return { heures: delais.reduce((s, x) => s + x, 0) / delais.length, echantillon: delais.length };
}

/** Lundi de la semaine d'une date. */
export function lundi(date: string): string {
  const jour = new Date(`${date}T12:00:00Z`).getUTCDay();
  return ajouterJours(date, -((jour + 6) % 7));
}

export const CHECKLIST_CONTROLE: ReadonlyArray<string> = [
  'Propreté salle de bain et WC',
  'Propreté cuisine et électroménager',
  'Linge : bon logement, propre, sans odeur ni humidité',
  'Sols et surfaces',
  'Consommables au niveau',
  'Photos de contrôle prises',
];

export function checklistControle(): ElementChecklist[] {
  return CHECKLIST_CONTROLE.map((libelle) => ({ libelle, fait: false }));
}

/** Contrôle physique déjà planifié pour une mission (même séjour). */
export function controlePlanifie(m: Mission, missions: Mission[]): Mission | undefined {
  return missions.find(
    (x) => x.type === 'controle' && x.statut !== 'annulee' && ((m.reservationId && x.reservationId === m.reservationId) || x.commentaire?.includes(m.id)),
  );
}

/** Mission de contrôle prête à enregistrer, le lendemain à 10 h. */
export function nouveauControle(m: Mission, id: string, logement?: Logement): Mission {
  return {
    id,
    type: 'controle',
    logementId: m.logementId,
    reservationId: m.reservationId,
    date: m.date >= AUJOURDHUI ? m.date : ajouterJours(AUJOURDHUI, 1),
    heureDebut: '10:00',
    heureFinMax: logement?.fiche.heureArrivee ?? '16:00',
    statut: 'a_attribuer',
    checklist: checklistControle(),
    photos: [],
    tarifCentimes: 0,
    controleQualite: false,
    commentaire: `Contrôle physique de la mission ${m.id}.`,
  };
}
