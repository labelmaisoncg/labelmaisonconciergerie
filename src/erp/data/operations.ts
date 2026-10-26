/**
 * Espace opérations (responsables de pôle et agents de terrain, octobre
 * 2026) : les règles, sans écran ni réseau. Partagées par le serveur
 * (api/espace-operations.ts), la démo et l'ERP (Paramètres → Accès), et
 * vérifiées par verifier-operations.ts.
 *
 * - Priorité d'un incident : « Urgent » = gravité haute, « Normal » sinon.
 * - Contrôle qualité : proposé après chaque départ des 3 derniers jours, à
 *   faire le jour même s'il y a une arrivée ce jour-là, sinon le lendemain ;
 *   en retard au-delà. Un point « à revoir » propose un incident.
 * - Absence : pendant la période, les logements du membre et ses incidents
 *   ouverts passent au remplaçant du logement (sinon à celui de l'absence).
 *   Rien n'est réécrit : la règle s'applique tant que l'absence dure.
 *
 * Ménage, linge et consommables restent hors de l'ERP (BNB Cleaning) : ici,
 * seulement le contrôle de ce qui a été fait.
 *
 * Imports en « .js » : ce module tourne aussi sous Node (fonctions Vercel).
 */
import type { CategorieIncident, DateISO, ErpDonnees, GraviteIncident, Id, Incident, Mission, Reservation } from './types';
import type { AbsenceMembre, AffectationLogement, ControleQualite, MembreEquipe, PointControle, RoleOperations } from './types-operations';

/** Ce que l'espace lit (seules les collections opérations sont écrites). */
export type DonneesOps = Pick<
  ErpDonnees,
  'logements' | 'reservations' | 'incidents' | 'missions' | 'equipe' | 'affectations' | 'absences' | 'controles'
>;

export const ROLES_OPERATIONS: Record<RoleOperations, string> = {
  pole: 'Responsable de pôle',
  agent: 'Agent de terrain',
};

/** Date 'AAAA-MM-JJ' décalée de n jours (dates calendaires, sans fuseau). */
export function ajouterJours(d: DateISO, n: number): DateISO {
  const t = Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/* --------------------------------------------------------------- incidents */

export type Priorite = 'urgente' | 'normale';
export const PRIORITES: Record<Priorite, string> = { urgente: 'Urgent', normale: 'Normal' };

export const estUrgent = (i: Pick<Incident, 'gravite'>) => i.gravite === 'haute';
export const prioriteDe = (i: Pick<Incident, 'gravite'>): Priorite => (estUrgent(i) ? 'urgente' : 'normale');
/** Une priorité choisie à l'écran ; « Normal » garde une gravité faible déjà notée. */
export function graviteDe(p: Priorite, actuelle?: GraviteIncident): GraviteIncident {
  if (p === 'urgente') return 'haute';
  return actuelle && actuelle !== 'haute' ? actuelle : 'moyenne';
}

const RANG_STATUT = { ouvert: 0, en_cours: 1, resolu: 2 } as const;

/**
 * Ordre de travail : urgents d'abord, puis les nouveaux avant ceux déjà pris
 * en charge, puis le plus ancien ; les résolus à la fin, du plus récent au
 * plus ancien.
 */
export function trierIncidents<I extends Pick<Incident, 'gravite' | 'statut' | 'date' | 'resoluLe'>>(incidents: I[]): I[] {
  return incidents.slice().sort((a, b) => {
    const ra = a.statut === 'resolu' ? 1 : 0;
    const rb = b.statut === 'resolu' ? 1 : 0;
    if (ra !== rb) return ra - rb;
    if (ra) return (b.resoluLe ?? b.date).localeCompare(a.resoluLe ?? a.date);
    return Number(estUrgent(b)) - Number(estUrgent(a)) || RANG_STATUT[a.statut] - RANG_STATUT[b.statut] || a.date.localeCompare(b.date);
  });
}

export const incidentsOuverts = (incidents: Incident[]) => incidents.filter((i) => i.statut !== 'resolu');
export const urgencesOuvertes = (incidents: Incident[]) => trierIncidents(incidents.filter((i) => i.statut !== 'resolu' && estUrgent(i)));

/* --------------------------------------------------- absences et remplaçants */

export const affectationDe = (d: Pick<DonneesOps, 'affectations'>, logementId: Id): AffectationLogement | undefined =>
  d.affectations.find((a) => a.id === logementId);

/** Absences qui comptent (les annulées sont gardées pour l'historique, sans effet). */
export const absencesValables = (absences: AbsenceMembre[]) => absences.filter((a) => a && !a.annuleeLe);

/** Absence en cours ce jour-là (bornes comprises). */
export function absenceLe(absences: AbsenceMembre[], membreId: Id | undefined, date: DateISO): AbsenceMembre | undefined {
  if (!membreId) return undefined;
  return absences.find((a) => !a.annuleeLe && a.membreId === membreId && a.du <= date && date <= a.au);
}

export interface Suivi {
  /** Qui s'en occupe ce jour-là (undefined : personne de disponible). */
  membreId?: Id;
  /** Le titulaire absent, quand quelqu'un le remplace (ou que personne ne peut). */
  remplace?: Id;
}

/**
 * Qui suit un logement ou un incident ce jour-là : le titulaire, ou s'il est
 * absent le remplaçant du logement, sinon celui de l'absence ; et ainsi de
 * suite si le remplaçant est absent lui aussi (sans boucle).
 */
export function suiviPar(d: Pick<DonneesOps, 'affectations' | 'absences'>, titulaire: Id | undefined, logementId: Id | undefined, date: DateISO): Suivi {
  if (!titulaire) return {};
  const vus = new Set<Id>();
  const remplacantLogement = logementId ? affectationDe(d, logementId)?.remplacantId : undefined;
  let courant: Id | undefined = titulaire;
  while (courant) {
    const absence = absenceLe(d.absences, courant, date);
    if (!absence) return courant === titulaire ? { membreId: courant } : { membreId: courant, remplace: titulaire };
    vus.add(courant);
    const candidat: Id | undefined = remplacantLogement && !vus.has(remplacantLogement) ? remplacantLogement : absence.remplacantId;
    courant = candidat && !vus.has(candidat) ? candidat : undefined;
  }
  return { remplace: titulaire };
}

export const responsableLe = (d: Pick<DonneesOps, 'affectations' | 'absences'>, logementId: Id, date: DateISO): Suivi =>
  suiviPar(d, affectationDe(d, logementId)?.responsableId, logementId, date);

export const assigneLe = (d: Pick<DonneesOps, 'affectations' | 'absences'>, i: Pick<Incident, 'assigneA' | 'logementId'>, date: DateISO): Suivi =>
  suiviPar(d, i.assigneA, i.logementId, date);

export interface ApercuAbsence {
  logements: { logementId: Id; vers?: Id }[];
  incidents: { incidentId: Id; logementId: Id; vers?: Id }[];
  /** Lignes sans personne pour reprendre. */
  sansRemplacant: number;
}

/**
 * Ce qui change pendant une absence, montré avant de la confirmer : les
 * logements dont le membre est responsable et ses incidents ouverts, avec
 * qui les reprend (le premier jour de l'absence, ou aujourd'hui si elle a
 * commencé). `logementIds` : limité aux logements de qui regarde.
 */
export function apercuAbsence(d: DonneesOps, absence: AbsenceMembre, aujourdhui: DateISO, logementIds?: ReadonlySet<Id>): ApercuAbsence {
  const date = absence.du > aujourdhui ? absence.du : aujourdhui;
  const avec = { affectations: d.affectations, absences: [...d.absences.filter((a) => a.id !== absence.id), absence] };
  const dans = (id: Id) => !logementIds || logementIds.has(id);
  const actifs = new Set(d.logements.filter((l) => l.statut !== 'sorti' && dans(l.id)).map((l) => l.id));
  const logements = d.affectations
    .filter((a) => a.responsableId === absence.membreId && actifs.has(a.id))
    .map((a) => ({ logementId: a.id, vers: responsableLe(avec, a.id, date).membreId }));
  const incidents = trierIncidents(incidentsOuverts(d.incidents).filter((i) => i.assigneA === absence.membreId && dans(i.logementId))).map((i) => ({
    incidentId: i.id,
    logementId: i.logementId,
    vers: assigneLe(avec, i, date).membreId,
  }));
  return { logements, incidents, sansRemplacant: [...logements, ...incidents].filter((x) => !x.vers).length };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Une absence enregistrable : dates dans l'ordre, pas de chevauchement, pas son propre remplaçant. */
export function verifierAbsence(absence: AbsenceMembre, absences: AbsenceMembre[]): string | null {
  if (!absence.membreId) return 'Choisissez la personne absente.';
  if (!DATE.test(absence.du ?? '') || !DATE.test(absence.au ?? '')) return 'Indiquez les dates de début et de fin.';
  if (absence.au < absence.du) return 'La fin doit être après le début.';
  if (absence.remplacantId === absence.membreId) return 'Une personne ne peut pas se remplacer elle-même.';
  const chevauche = absencesValables(absences).find((a) => a.id !== absence.id && a.membreId === absence.membreId && a.du <= absence.au && absence.du <= a.au);
  if (chevauche) return 'Une absence est déjà notée sur ces dates pour cette personne.';
  return null;
}

/** Absences en cours ou qui commencent dans les `jours` prochains jours. */
export function absencesProches(absences: AbsenceMembre[], aujourdhui: DateISO, jours = 7): AbsenceMembre[] {
  const limite = ajouterJours(aujourdhui, jours);
  return absencesValables(absences).filter((a) => a.au >= aujourdhui && a.du <= limite).sort((a, b) => a.du.localeCompare(b.du));
}

/* ------------------------------------------------------- contrôles qualité */

/** Modèle par défaut (personnalisable par logement). */
export const POINTS_CONTROLE_DEFAUT = ['Propreté', 'Linge', 'Consommables', 'Équipements', 'État général'];
/** Départs pris en compte pour proposer un contrôle (aujourd'hui et les 2 jours d'avant). */
export const FENETRE_CONTROLE_JOURS = 2;

export function pointsDuLogement(d: Pick<DonneesOps, 'affectations'>, logementId: Id): string[] {
  const propres = affectationDe(d, logementId)?.pointsControle?.map((p) => String(p).trim()).filter(Boolean);
  return propres?.length ? propres : POINTS_CONTROLE_DEFAUT;
}

/** À faire le jour du départ si un voyageur arrive ce jour-là, sinon le lendemain. */
export function echeanceApresDepart(r: Reservation, reservations: Reservation[]): DateISO {
  const memeJour = reservations.some((x) => x.id !== r.id && x.logementId === r.logementId && x.statut !== 'annulee' && x.arrivee === r.depart);
  return memeJour ? r.depart : ajouterJours(r.depart, 1);
}

export interface ControleAFaire {
  /** Clé stable : l'id du contrôle enregistré, sinon `depart-<réservation>`. */
  cle: string;
  /** Déjà commencé ou planifié ; sinon proposé d'après un départ. */
  controle?: ControleQualite;
  logementId: Id;
  reservationId?: Id;
  echeance: DateISO;
  enRetard: boolean;
}

/** Contrôles à faire (enregistrés et proposés après un départ), en retard d'abord, puis par échéance. */
export function controlesAFaire(d: DonneesOps, aujourdhui: DateISO): ControleAFaire[] {
  const actifs = new Set(d.logements.filter((l) => l.statut !== 'sorti').map((l) => l.id));
  const dejaVus = new Set(d.controles.map((c) => c.reservationId).filter(Boolean));
  const liste: ControleAFaire[] = d.controles
    .filter((c) => c.statut === 'a_faire' && actifs.has(c.logementId))
    .map((c) => ({ cle: c.id, controle: c, logementId: c.logementId, reservationId: c.reservationId, echeance: c.echeance, enRetard: c.echeance < aujourdhui }));
  const depuis = ajouterJours(aujourdhui, -FENETRE_CONTROLE_JOURS);
  for (const r of d.reservations) {
    if (r.statut === 'annulee' || r.depart < depuis || r.depart > aujourdhui || !actifs.has(r.logementId) || dejaVus.has(r.id)) continue;
    const echeance = echeanceApresDepart(r, d.reservations);
    liste.push({ cle: `depart-${r.id}`, logementId: r.logementId, reservationId: r.id, echeance, enRetard: echeance < aujourdhui });
  }
  return liste.sort((a, b) => Number(b.enRetard) - Number(a.enRetard) || a.echeance.localeCompare(b.echeance) || a.cle.localeCompare(b.cle));
}

export const controlesEnRetard = (d: DonneesOps, aujourdhui: DateISO) => controlesAFaire(d, aujourdhui).filter((c) => c.enRetard);

/** Contrôle prêt à remplir (points du logement, rien de coché). */
export function nouveauControle(
  d: Pick<DonneesOps, 'affectations'>,
  a: { id: Id; logementId: Id; reservationId?: Id; echeance: DateISO },
): ControleQualite {
  return {
    id: a.id,
    logementId: a.logementId,
    ...(a.reservationId ? { reservationId: a.reservationId } : {}),
    echeance: a.echeance,
    statut: 'a_faire',
    points: pointsDuLogement(d, a.logementId).map((libelle, k) => ({ id: `p${k + 1}`, libelle })),
  };
}

/** Ce qui manque pour terminer un contrôle (null : il peut être enregistré). */
export function verifierControle(c: Pick<ControleQualite, 'points' | 'note'>): string | null {
  const sans = c.points.filter((p) => !p.etat).length;
  if (sans) return sans > 1 ? `${sans} points sans réponse : OK ou À revoir.` : 'Un point sans réponse : OK ou À revoir.';
  if (!c.note || c.note < 1 || c.note > 5) return 'Donnez une note sur 5.';
  return null;
}

/** Points « à revoir » qui n'ont pas encore leur incident. */
export const pointsARevoir = (c: Pick<ControleQualite, 'points'>): PointControle[] => c.points.filter((p) => p.etat === 'a_revoir' && !p.incidentId);

const CATEGORIE_POINT: [RegExp, CategorieIncident][] = [
  [/propre|ménage|menage|sale/i, 'menage'],
  [/linge|drap|serviette/i, 'linge'],
  [/équipement|equipement|appareil|électro|electro|chauff|eau/i, 'panne'],
  [/état|etat|casse|abîm|abim|mur|meuble/i, 'casse'],
  [/clé|cle|serrure|accès|acces|boîte|boite/i, 'acces'],
];

/** Incident proposé pour un point « à revoir » (rattaché au logement, au séjour et au contrôle). */
export function incidentDepuisPoint(c: ControleQualite, p: PointControle, date: DateISO): Omit<Incident, 'id' | 'statut' | 'refacturable'> {
  const categorie = CATEGORIE_POINT.find(([r]) => r.test(p.libelle))?.[1] ?? 'autre';
  const detail = p.commentaire?.trim();
  return {
    logementId: c.logementId,
    ...(c.reservationId ? { reservationId: c.reservationId } : {}),
    date,
    categorie,
    gravite: 'moyenne',
    description: `Contrôle qualité : ${p.libelle.toLowerCase()} à revoir.${detail ? ` ${detail}` : ''}`,
    preuves: p.photo ? [p.photo] : [],
    controleId: c.id,
  };
}

/** Contrôles faits d'un logement (ou de tous), du plus récent au plus ancien. */
export function historiqueControles(controles: ControleQualite[], logementId?: Id): ControleQualite[] {
  return controles
    .filter((c) => c.statut === 'fait' && (!logementId || c.logementId === logementId))
    .sort((a, b) => (b.realiseLe ?? b.echeance).localeCompare(a.realiseLe ?? a.echeance));
}

/* -------------------------------------------------------- programme du jour */

export type TypeProgramme = 'depart' | 'controle' | 'intervention' | 'arrivee';

export interface ElementProgramme {
  cle: string;
  type: TypeProgramme;
  heure?: string;
  logementId: Id;
  reservationId?: Id;
  missionId?: Id;
  /** Contrôle à faire (pour l'ouvrir d'un toucher). */
  controle?: ControleAFaire;
}

const ORDRE_PROGRAMME: Record<TypeProgramme, number> = { depart: 0, controle: 1, intervention: 2, arrivee: 3 };

/**
 * Programme du jour : départs, contrôles à faire (pas encore en retard :
 * ceux-là ont leur propre liste), interventions (maintenance et contrôles
 * hors ménage), arrivées ; par heure, un contrôle juste après le départ du
 * logement.
 */
export function programmeDuJour(d: DonneesOps, date: DateISO): ElementProgramme[] {
  const fiche = (id: Id) => d.logements.find((l) => l.id === id)?.fiche;
  const actives = d.reservations.filter((r) => r.statut !== 'annulee');
  const liste: ElementProgramme[] = [
    ...actives.filter((r) => r.depart === date).map((r): ElementProgramme => ({ cle: `d-${r.id}`, type: 'depart', heure: fiche(r.logementId)?.heureDepart, logementId: r.logementId, reservationId: r.id })),
    ...actives.filter((r) => r.arrivee === date).map((r): ElementProgramme => ({ cle: `a-${r.id}`, type: 'arrivee', heure: fiche(r.logementId)?.heureArrivee, logementId: r.logementId, reservationId: r.id })),
    ...controlesAFaire(d, date)
      .filter((c) => !c.enRetard)
      .map((c): ElementProgramme => ({ cle: `c-${c.cle}`, type: 'controle', logementId: c.logementId, reservationId: c.reservationId, controle: c })),
    ...d.missions
      .filter((m: Mission) => m.date === date && (m.type === 'maintenance' || m.type === 'controle') && m.statut !== 'annulee' && m.statut !== 'refusee')
      .map((m): ElementProgramme => ({ cle: `m-${m.id}`, type: 'intervention', heure: m.heureDebut, logementId: m.logementId, missionId: m.id })),
  ];
  // Sans heure connue : en fin de journée ; un contrôle se place juste après le départ du logement.
  const minutes = (h?: string) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(h ?? '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60;
  };
  const cle = (e: ElementProgramme) => minutes(e.type === 'controle' ? (fiche(e.logementId)?.heureDepart ?? '12:00') : e.heure);
  return liste.sort((a, b) => cle(a) - cle(b) || ORDRE_PROGRAMME[a.type] - ORDRE_PROGRAMME[b.type] || a.cle.localeCompare(b.cle));
}

/* ------------------------------------------------------------------ équipe */

export const membreDe = (equipe: MembreEquipe[], id?: Id) => (id ? equipe.find((m) => m.id === id) : undefined);
/** Membres qui peuvent recevoir un logement ou un incident. */
export const membresActifs = (equipe: MembreEquipe[]) => equipe.filter((m) => m.actif).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
/** « Clara Dumas » → « Clara D. ». */
export function court(nom?: string): string {
  const [p, n] = String(nom ?? '').trim().split(/\s+/);
  return p ? `${p}${n ? ` ${n[0]}.` : ''}` : '';
}
