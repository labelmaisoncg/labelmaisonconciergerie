/**
 * Anomalies (A9) : ce qui semble anormal dans les réservations, les prix et
 * la tenue des logements, à vérifier par l'équipe. Montrées dans « À faire »
 * de l'Accueil ; les graves (`grave`) partent aussi en notification, une
 * seule fois chacune (passage du matin, api/_prix-conseils.ts).
 *
 * - Double réservation (grave) : deux séjours du même logement qui se
 *   chevauchent (souvent Airbnb et Booking.com en même temps).
 * - Départ sans personne en charge (grave) : un voyageur part aujourd'hui,
 *   demain ou après-demain et personne n'est prévu ce jour-là
 *   (operations.sansChargeLe).
 * - Réservation à vérifier : réservée le jour même de l'arrivée pour 7 nuits
 *   ou plus par un nouveau voyageur (grave), ou montants incohérents.
 * - Prix inhabituel : une nuit à moins de 50 % ou plus de 250 % du prix
 *   médian du logement sur les 60 prochains jours (faute de frappe probable).
 * - Plateformes pas mises à jour depuis plus de 24 h.
 * - Intégrité : des nuits réservées que l'occupation ne compte pas
 *   (séjours rattachés à un logement inconnu, ou occupation à 0 %).
 *
 * Module pur ; imports en « .js » : il tourne aussi côté serveur.
 */
import { mesurerOccupation } from './occupation.js';
import { sansChargeLe } from './operations.js';
import { ecartJours, eurosRonds, plusJours, prixNuitSejour, texteNuits } from './prix-conseils.js';
import type { DateISO, ErpDonnees, Horodatage, Id, Logement, Reservation } from './types';

export type TypeAnomalie = 'chevauchement' | 'sans_charge' | 'reservation_suspecte' | 'prix_anormal' | 'synchro_ancienne' | 'integrite';

export interface Anomalie {
  /** Stable : la même anomalie garde le même id d'un passage à l'autre. */
  id: string;
  type: TypeAnomalie;
  /** Grave : notifiée (une fois). */
  grave: boolean;
  logementId?: Id;
  /** Court, pour une ligne ou une notification. */
  titre: string;
  /** Une phrase. */
  detail: string;
  /** Écran à ouvrir (sous /erp). */
  lien: string;
}

export interface EntreesAnomalies extends Partial<Pick<ErpDonnees, 'equipe' | 'affectations' | 'absences'>> {
  logements: readonly Logement[];
  reservations: readonly Reservation[];
  aujourdhui: DateISO;
  maintenant: Horodatage;
  /** Dernière mise à jour réussie depuis les plateformes (absente : non vérifiée). */
  derniereSynchro?: Horodatage;
}

/** Seuils des anomalies. */
export const SEUILS_ANOMALIES = {
  /** Prix d'une nuit sous 50 % ou au-dessus de 250 % de la médiane du logement. */
  prixBas: 0.5,
  prixHaut: 2.5,
  /** Prix connus nécessaires pour une médiane. */
  prixMin: 7,
  /** Séjour long réservé le jour même : 7 nuits ou plus. */
  sejourLong: 7,
  /** Prix d'une nuit de séjour hors de [25 %, 400 %] du prix habituel : montant incohérent. */
  montantBas: 0.25,
  montantHaut: 4,
  /** Départ dans 0, 1 ou 2 jours. */
  joursDepart: 2,
  /** Mise à jour des plateformes plus vieille que 24 h. */
  synchroHeures: 24,
} as const;

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const jourMois = (d: DateISO) => `${Number(d.slice(8, 10))} ${MOIS[Number(d.slice(5, 7)) - 1] ?? ''}`.trim();
const plage = (a: DateISO, b: DateISO) => (a.slice(0, 7) === b.slice(0, 7) ? `${Number(a.slice(8, 10))}–${jourMois(b)}` : `${jourMois(a)} – ${jourMois(b)}`);
const CANAL: Record<string, string> = { airbnb: 'Airbnb', booking: 'Booking.com', direct: 'en direct', autre: 'autre plateforme' };
const prenom = (nom: string) => {
  const m = String(nom ?? '').trim().split(/\s+/).filter(Boolean);
  return m.length > 1 ? `${m[0]} ${m[m.length - 1].charAt(0).toUpperCase()}.` : m[0] || 'Un voyageur';
};
const quand = (j: number) => (j === 0 ? 'aujourd’hui' : j === 1 ? 'demain' : 'après-demain');

const active = (r: Reservation) => r.statut !== 'annulee';

/** Date de Paris d'un horodatage (« …T23:30:00Z » → le lendemain à Paris). */
function dateParisDe(h: string): DateISO | undefined {
  const t = Date.parse(h);
  if (!Number.isFinite(t)) return undefined;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
}

const mediane = (xs: number[]) => {
  const t = [...xs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};

export function detecterAnomalies(e: EntreesAnomalies): Anomalie[] {
  const res: Anomalie[] = [];
  const nom = (id: Id) => e.logements.find((l) => l.id === id)?.nom ?? 'Logement inconnu';
  const actives = e.reservations.filter(active);

  /* double réservation : même logement, nuits communes, séjour pas encore terminé */
  const parLogement = new Map<Id, Reservation[]>();
  for (const r of actives) if (r.depart > e.aujourdhui && r.arrivee < r.depart) parLogement.set(r.logementId, [...(parLogement.get(r.logementId) ?? []), r]);
  for (const [logementId, resas] of parLogement) {
    const tri = [...resas].sort((a, b) => a.arrivee.localeCompare(b.arrivee) || a.id.localeCompare(b.id));
    for (let i = 0; i < tri.length; i++) {
      for (let j = i + 1; j < tri.length && tri[j].arrivee < tri[i].depart; j++) {
        const [a, b] = [tri[i], tri[j]];
        const plateformes = a.canal !== b.canal ? `${CANAL[a.canal] ?? a.canal} et ${CANAL[b.canal] ?? b.canal}` : `deux réservations ${CANAL[a.canal] ?? a.canal}`;
        res.push({
          id: `chevauchement-${[a.id, b.id].sort().join('-')}`,
          type: 'chevauchement',
          grave: true,
          logementId,
          titre: `Risque de double réservation · ${nom(logementId)}`,
          detail: `${plateformes} se chevauchent : ${prenom(a.voyageur?.nom)} (${plage(a.arrivee, a.depart)}) et ${prenom(b.voyageur?.nom)} (${plage(b.arrivee, b.depart)}).`,
          lien: `/erp/reservations/${encodeURIComponent(b.id)}`,
        });
      }
    }
  }

  /* départ dans 0 à 2 jours sans personne en charge ce jour-là */
  if (e.equipe?.length && e.affectations) {
    const d = { logements: [...e.logements], equipe: e.equipe, affectations: e.affectations, absences: e.absences ?? [] };
    for (let j = 0; j <= SEUILS_ANOMALIES.joursDepart; j++) {
      const date = plusJours(e.aujourdhui, j);
      const departs = actives.filter((r) => r.depart === date);
      if (!departs.length) continue;
      const sans = new Set(sansChargeLe(d, date).map((x) => x.logementId));
      for (const r of departs) {
        if (!sans.has(r.logementId)) continue;
        res.push({
          id: `sans-charge-${r.logementId}-${date}`,
          type: 'sans_charge',
          grave: true,
          logementId: r.logementId,
          titre: `Départ ${quand(j)} sans personne en charge · ${nom(r.logementId)}`,
          detail: `${prenom(r.voyageur?.nom)} part ${quand(j)} et personne n’est prévu ce jour-là pour s’occuper du logement.`,
          lien: `/erp/logements/${encodeURIComponent(r.logementId)}`,
        });
      }
    }
  }

  /* réservation à vérifier */
  const prixHabituel = new Map<Id, number>();
  const depuis = plusJours(e.aujourdhui, -365);
  for (const l of e.logements) {
    const xs = actives.filter((r) => r.logementId === l.id && r.depart <= e.aujourdhui && r.depart > depuis).map(prixNuitSejour).filter((x): x is number => !!x);
    if (xs.length >= 5) prixHabituel.set(l.id, mediane(xs));
  }
  for (const r of actives) {
    if (r.depart < e.aujourdhui) continue;
    const signes: string[] = [];
    let grave = false;
    const reserveeLe = r.repull?.reserveeLe ? dateParisDe(r.repull.reserveeLe) : undefined;
    if (reserveeLe && reserveeLe === r.arrivee && r.nuits >= SEUILS_ANOMALIES.sejourLong) {
      const qui = r.repull?.voyageurId;
      const nomVoyageur = String(r.voyageur?.nom ?? '').trim().toLowerCase();
      const connu = e.reservations.some((x) => x.id !== r.id && ((qui && x.repull?.voyageurId === qui) || (!!nomVoyageur && String(x.voyageur?.nom ?? '').trim().toLowerCase() === nomVoyageur)));
      if (!connu) {
        signes.push(`réservée le jour même pour ${r.nuits} nuits par un nouveau voyageur`);
        grave = true;
      }
    }
    if (r.nuits > 0 && r.statut !== 'terminee') {
      const brut = r.montantBrutCentimes;
      const habituel = prixHabituel.get(r.logementId);
      const parNuit = prixNuitSejour(r);
      if (brut <= 0 && r.canal !== 'direct') signes.push('montant à zéro');
      else if (r.commissionPlateformeCentimes > brut || r.fraisMenageCentimes > brut) signes.push('commission ou ménage plus élevés que le total');
      else if (habituel && parNuit && (parNuit < habituel * SEUILS_ANOMALIES.montantBas || parNuit > habituel * SEUILS_ANOMALIES.montantHaut))
        signes.push(`${eurosRonds(parNuit)} la nuit, d’habitude ${eurosRonds(habituel)}`);
    }
    if (!signes.length) continue;
    res.push({
      id: `suspecte-${r.id}`,
      type: 'reservation_suspecte',
      grave,
      logementId: r.logementId,
      titre: `Réservation à vérifier · ${nom(r.logementId)}`,
      detail: `${prenom(r.voyageur?.nom)}, ${plage(r.arrivee, r.depart)} : ${signes.join(', ')}.`,
      lien: `/erp/reservations/${encodeURIComponent(r.id)}`,
    });
  }

  /* prix inhabituel sur les 60 prochains jours (nuits libres) */
  for (const l of e.logements) {
    if (l.statut === 'sorti' || !l.tarifs?.jours?.length) continue;
    const jours = l.tarifs.jours.filter((j) => j.date >= e.aujourdhui && j.prixCentimes > 0);
    if (jours.length < SEUILS_ANOMALIES.prixMin) continue;
    const m = mediane(jours.map((j) => j.prixCentimes));
    const etranges = jours.filter((j) => j.libre !== false && (j.prixCentimes < m * SEUILS_ANOMALIES.prixBas || j.prixCentimes > m * SEUILS_ANOMALIES.prixHaut));
    if (!etranges.length) continue;
    const premier = etranges[0];
    res.push({
      id: `prix-anormal-${l.id}`,
      type: 'prix_anormal',
      grave: false,
      logementId: l.id,
      titre: `Prix inhabituel · ${l.nom}`,
      detail: `${eurosRonds(premier.prixCentimes)} ${texteNuits(premier.date, plusJours(premier.date, 1))}${etranges.length > 1 ? ` (et ${etranges.length - 1} autre${etranges.length > 2 ? 's' : ''} nuit${etranges.length > 2 ? 's' : ''})` : ''}, d’habitude ${eurosRonds(m)} : à vérifier sur la plateforme.`,
      lien: `/erp/logements/${encodeURIComponent(l.id)}`,
    });
  }

  /* plateformes pas mises à jour */
  if (e.derniereSynchro) {
    const heures = (Date.parse(e.maintenant) - Date.parse(e.derniereSynchro)) / 3_600_000;
    if (Number.isFinite(heures) && heures > SEUILS_ANOMALIES.synchroHeures) {
      const jours = Math.floor(heures / 24);
      res.push({
        id: 'synchro-ancienne',
        type: 'synchro_ancienne',
        grave: false,
        titre: jours >= 2 ? `Airbnb et Booking pas mis à jour depuis ${jours} jours` : 'Airbnb et Booking pas mis à jour depuis hier',
        detail: 'Réservations, messages et prix peuvent manquer : relancez la mise à jour.',
        lien: '/erp/parametres/plateformes',
      });
    }
  }

  /* intégrité de l'occupation : 30 jours passés et 30 à venir */
  const fenetres = [
    { debut: plusJours(e.aujourdhui, -30), fin: e.aujourdhui },
    { debut: e.aujourdhui, fin: plusJours(e.aujourdhui, 30) },
  ];
  let orphelines = 0;
  let nonComptees = 0;
  for (const f of fenetres) {
    const m = mesurerOccupation(e.logements, e.reservations, f);
    orphelines += m.nuitsOrphelines;
    const reservees = actives.reduce((s, r) => s + Math.max(0, ecartJours(r.arrivee > f.debut ? r.arrivee : f.debut, r.depart < f.fin ? r.depart : f.fin)), 0);
    if (reservees > 0 && m.taux === 0) nonComptees += reservees;
  }
  if (orphelines || nonComptees) {
    res.push({
      id: 'integrite-occupation',
      type: 'integrite',
      grave: false,
      titre: 'Occupation à vérifier',
      detail: orphelines
        ? `${orphelines} nuit${orphelines > 1 ? 's' : ''} réservée${orphelines > 1 ? 's' : ''} ne ${orphelines > 1 ? 'sont' : 'est'} pas comptée${orphelines > 1 ? 's' : ''} : des séjours sont rattachés à un logement qui n’existe plus.`
        : `${nonComptees} nuits réservées, mais l’occupation calculée est de 0 %.`,
      lien: '/erp/reservations?vue=liste',
    });
  }
  return res;
}

/** Anomalies graves pas encore notifiées (mémoire : id → jour de la notification). */
export function anomaliesANotifier(anomalies: readonly Anomalie[], dejaNotifiees: Record<string, DateISO> | undefined): Anomalie[] {
  return anomalies.filter((a) => a.grave && !dejaNotifiees?.[a.id]);
}
