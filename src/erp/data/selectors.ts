/**
 * Calculs partagés : indicateurs du tableau de bord (SPEC §6), règles métier
 * (SPEC §2) et accès courants. Fonctions pures, sans état.
 *
 * Conventions de calcul :
 * - montantBrutCentimes = total payé par le voyageur, frais de ménage inclus ;
 * - revenu d'hébergement = brut − frais de ménage ;
 * - commission Label Maison = (brut − commission plateforme − frais de ménage)
 *   × commissionPct du mandat ; les frais de ménage reviennent en plus à
 *   Label Maison, qui paie le prestataire ;
 * - les montants d'un séjour à cheval sur une fenêtre sont proratisés à la nuit.
 */
import {
  PLAFOND_NUITS_RESIDENCE_PRINCIPALE,
  SEUIL_NOTE_CONTROLE,
} from './constantes';
import { AUJOURDHUI, ajouterJours, debutMois, debutMoisSuivant, ecartJours } from './format';
import type {
  Centimes,
  DateISO,
  DocumentPrestataire,
  ErpDonnees,
  EtapeProspect,
  Facture,
  Id,
  Incident,
  Logement,
  Mandat,
  Mission,
  MouvementLinge,
  Prestataire,
  Prospect,
  Reservation,
  TypeDocument,
} from './types';

/** Fenêtre [debut, fin[ en dates ISO. */
export interface Fenetre {
  debut: DateISO;
  fin: DateISO;
}

export type Verdict = { ok: true } | { ok: false; raisons: string[] };

/* ----------------------------------------------------------------- fenêtres */

export function fenetreJours(jours: number, fin: DateISO = AUJOURDHUI): Fenetre {
  return { debut: ajouterJours(fin, -jours), fin };
}

export function fenetreMois(date: DateISO = AUJOURDHUI): Fenetre {
  return { debut: debutMois(date), fin: debutMoisSuivant(date) };
}

export function joursDansFenetre(f: Fenetre): number {
  return Math.max(0, ecartJours(f.debut, f.fin));
}

/** Nuits d'un séjour comprises dans la fenêtre. */
export function nuitsDansFenetre(r: Reservation, f: Fenetre): number {
  const debut = r.arrivee > f.debut ? r.arrivee : f.debut;
  const fin = r.depart < f.fin ? r.depart : f.fin;
  return Math.max(0, ecartJours(debut, fin));
}

/* ------------------------------------------------------------ accès simples */

export function parId<T extends { id: Id }>(liste: T[], id: Id | undefined): T | undefined {
  return id ? liste.find((x) => x.id === id) : undefined;
}

export const logementById = (d: Pick<ErpDonnees, 'logements'>, id?: Id) => parId(d.logements, id);
export const proprietaireById = (d: Pick<ErpDonnees, 'proprietaires'>, id?: Id) => parId(d.proprietaires, id);
export const prestataireById = (d: Pick<ErpDonnees, 'prestataires'>, id?: Id) => parId(d.prestataires, id);
export const reservationById = (d: Pick<ErpDonnees, 'reservations'>, id?: Id) => parId(d.reservations, id);

export function estActive(r: Reservation): boolean {
  return r.statut !== 'annulee';
}

export function reservationsDuLogement(reservations: Reservation[], logementId: Id): Reservation[] {
  return reservations
    .filter((r) => r.logementId === logementId)
    .sort((a, b) => a.arrivee.localeCompare(b.arrivee));
}

/** Mandat en vigueur d'un logement (signé de préférence, sinon le plus récent non résilié). */
export function mandatDuLogement(mandats: Mandat[], logementId: Id): Mandat | undefined {
  const siens = mandats.filter((m) => m.logementId === logementId);
  return (
    siens.find((m) => m.statut === 'signe') ??
    siens.filter((m) => m.statut !== 'resilie').sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))[0] ??
    siens[0]
  );
}

export function logementsActifs(logements: Logement[]): Logement[] {
  return logements.filter((l) => l.statut === 'actif');
}

/** Séjour en cours dans un logement à une date donnée. */
export function sejourEnCours(reservations: Reservation[], logementId: Id, date: DateISO = AUJOURDHUI) {
  return reservations.find(
    (r) => r.logementId === logementId && estActive(r) && r.arrivee <= date && r.depart > date,
  );
}

/* --------------------------------------------------------- agenda du jour */

export function arriveesDuJour(reservations: Reservation[], date: DateISO = AUJOURDHUI) {
  return reservations.filter((r) => estActive(r) && r.arrivee === date);
}

export function departsDuJour(reservations: Reservation[], date: DateISO = AUJOURDHUI) {
  return reservations.filter((r) => estActive(r) && r.depart === date);
}

export function missionsDuJour(missions: Mission[], date: DateISO = AUJOURDHUI) {
  return missions
    .filter((m) => m.date === date && m.statut !== 'annulee')
    .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
}

export interface JourAgenda {
  date: DateISO;
  arrivees: Reservation[];
  departs: Reservation[];
  missions: Mission[];
}

/** Les n prochains jours (aujourd'hui inclus) avec arrivées, départs et missions. */
export function prochainsJours(d: Pick<ErpDonnees, 'reservations' | 'missions'>, n = 7, depuis: DateISO = AUJOURDHUI): JourAgenda[] {
  return Array.from({ length: n }, (_, i) => {
    const date = ajouterJours(depuis, i);
    return {
      date,
      arrivees: arriveesDuJour(d.reservations, date),
      departs: departsDuJour(d.reservations, date),
      missions: missionsDuJour(d.missions, date),
    };
  });
}

/* --------------------------------------------------------------- montants */

export function revenuHebergement(r: Reservation): Centimes {
  return r.montantBrutCentimes - r.fraisMenageCentimes;
}

/** Base commissionnable : brut − commission plateforme − frais de ménage. */
export function baseCommissionnable(r: Reservation): Centimes {
  return r.montantBrutCentimes - r.commissionPlateformeCentimes - r.fraisMenageCentimes;
}

export function commissionReservation(r: Reservation, mandat: Mandat | undefined): Centimes {
  return mandat ? Math.round((baseCommissionnable(r) * mandat.commissionPct) / 100) : 0;
}

/** Ce qui revient au propriétaire pour un séjour. */
export function netProprietaire(r: Reservation, mandat: Mandat | undefined): Centimes {
  return baseCommissionnable(r) - commissionReservation(r, mandat);
}

function prorata(montant: Centimes, r: Reservation, f: Fenetre): Centimes {
  return r.nuits ? Math.round((montant * nuitsDansFenetre(r, f)) / r.nuits) : 0;
}

/** Revenu brut géré sur la fenêtre (proratisé à la nuit). */
export function revenuBrut(reservations: Reservation[], f: Fenetre): Centimes {
  return reservations.filter(estActive).reduce((s, r) => s + prorata(r.montantBrutCentimes, r, f), 0);
}

/** Commission Label Maison sur la fenêtre, au pourcentage de chaque mandat. */
export function commissionLabelMaison(reservations: Reservation[], mandats: Mandat[], f: Fenetre): Centimes {
  return reservations
    .filter(estActive)
    .reduce((s, r) => s + prorata(commissionReservation(r, mandatDuLogement(mandats, r.logementId)), r, f), 0);
}

/* -------------------------------------------------------- occupation / prix */

export function nuitsVendues(reservations: Reservation[], f: Fenetre, logementId?: Id): number {
  return reservations
    .filter((r) => estActive(r) && (!logementId || r.logementId === logementId))
    .reduce((s, r) => s + nuitsDansFenetre(r, f), 0);
}

/** Taux d'occupation (0..1) des logements donnés sur la fenêtre. */
export function tauxOccupation(reservations: Reservation[], logements: Logement[], f: Fenetre): number {
  const ids = new Set(logements.map((l) => l.id));
  const dispo = logements.length * joursDansFenetre(f);
  if (!dispo) return 0;
  return nuitsVendues(reservations.filter((r) => ids.has(r.logementId)), f) / dispo;
}

/** Prix moyen par nuit vendue (hors frais de ménage). */
export function adr(reservations: Reservation[], f: Fenetre): Centimes {
  const nuits = nuitsVendues(reservations, f);
  if (!nuits) return 0;
  const revenu = reservations.filter(estActive).reduce((s, r) => s + prorata(revenuHebergement(r), r, f), 0);
  return Math.round(revenu / nuits);
}

/** Revenu d'hébergement par nuit disponible. */
export function revpar(reservations: Reservation[], logements: Logement[], f: Fenetre): Centimes {
  const dispo = logements.length * joursDansFenetre(f);
  if (!dispo) return 0;
  const ids = new Set(logements.map((l) => l.id));
  const revenu = reservations
    .filter((r) => estActive(r) && ids.has(r.logementId))
    .reduce((s, r) => s + prorata(revenuHebergement(r), r, f), 0);
  return Math.round(revenu / dispo);
}

/** Note voyageur moyenne des séjours terminés dans la fenêtre (undefined si aucune). */
export function noteMoyenne(reservations: Reservation[], f: Fenetre): number | undefined {
  const notes = reservations
    .filter((r) => r.noteVoyageur !== undefined && r.depart >= f.debut && r.depart < f.fin)
    .map((r) => r.noteVoyageur!);
  return notes.length ? notes.reduce((s, n) => s + n, 0) / notes.length : undefined;
}

/** Nuits louées sur l'année civile (compteur des 120 nuits en résidence principale). */
export function nuitsAnnee(reservations: Reservation[], logementId: Id, annee = Number(AUJOURDHUI.slice(0, 4))) {
  const f = { debut: `${annee}-01-01`, fin: `${annee + 1}-01-01` };
  const nuits = nuitsVendues(reservations, f, logementId);
  return { nuits, plafond: PLAFOND_NUITS_RESIDENCE_PRINCIPALE, restant: PLAFOND_NUITS_RESIDENCE_PRINCIPALE - nuits };
}

/* --------------------------------------------------------------- missions */

export function aPhotosAvantApres(m: Mission): boolean {
  return m.photos.some((p) => p.moment === 'avant') && m.photos.some((p) => p.moment === 'apres');
}

/** Règle SPEC §2.4 : checklist complète ET photos avant/après. */
export function missionValidable(m: Mission): Verdict {
  const raisons: string[] = [];
  const restants = m.checklist.filter((c) => !c.fait).length;
  if (restants) raisons.push(`Checklist incomplète : ${restants} point${restants > 1 ? 's' : ''} non coché${restants > 1 ? 's' : ''}.`);
  if (!m.photos.some((p) => p.moment === 'avant')) raisons.push('Photos « avant » manquantes.');
  if (!m.photos.some((p) => p.moment === 'apres')) raisons.push('Photos « après » manquantes.');
  return raisons.length ? { ok: false, raisons } : { ok: true };
}

/** Part des ménages passés de la fenêtre validés avec photos avant et après (0..1). */
/** Ménages passés de la fenêtre (base du taux de validation avec photos). */
export function nbMenagesPasses(missions: Mission[], f: Fenetre): number {
  return missions.filter((m) => m.type === 'menage' && m.statut !== 'annulee' && m.date >= f.debut && m.date < f.fin && m.date < AUJOURDHUI).length;
}

export function tauxMissionsValideesAvecPhotos(missions: Mission[], f: Fenetre): number {
  const passees = missions.filter(
    (m) => m.type === 'menage' && m.statut !== 'annulee' && m.date >= f.debut && m.date < f.fin && m.date < AUJOURDHUI,
  );
  if (!passees.length) return 0;
  return passees.filter((m) => m.statut === 'validee' && aPhotosAvantApres(m)).length / passees.length;
}

/** Missions sans prestataire dans les `heures` prochaines heures (48 h par défaut). */
export function missionsAAttribuerSous(missions: Mission[], heures = 48, depuis: DateISO = AUJOURDHUI): Mission[] {
  const limite = ajouterJours(depuis, Math.ceil(heures / 24));
  return missions.filter((m) => m.statut === 'a_attribuer' && m.date >= depuis && m.date <= limite);
}

/** Missions nécessitant un contrôle qualité (tirage 1/10 ou note voyageur basse). */
export function missionsAControler(missions: Mission[], reservations: Reservation[]): Mission[] {
  return missions.filter((m) => {
    if (m.type !== 'menage') return false;
    const r = m.reservationId ? reservations.find((x) => x.id === m.reservationId) : undefined;
    return m.controleQualite || (r?.noteVoyageur !== undefined && r.noteVoyageur < SEUIL_NOTE_CONTROLE);
  });
}

/* ------------------------------------------------------------ prestataires */

/** Statut réel d'un document à une date (une date dépassée l'emporte sur le statut saisi). */
export function statutDocument(doc: DocumentPrestataire, date: DateISO = AUJOURDHUI): DocumentPrestataire['statut'] {
  if (doc.statut === 'manquant') return 'manquant';
  if (doc.valideJusquau && doc.valideJusquau < date) return 'expire';
  return doc.statut;
}

const LIBELLES_DOCS: Record<TypeDocument, string> = {
  contrat: 'Contrat signé',
  rc_pro: 'Attestation RC Pro',
  urssaf: 'Attestation de vigilance URSSAF',
  kbis: 'Extrait Kbis',
  autre: 'Autre document',
};

export function libelleDocument(type: TypeDocument): string {
  return LIBELLES_DOCS[type];
}

/** Règle SPEC §2.3 : contrat + RC Pro + URSSAF valides, prestataire actif. */
export function prestataireConforme(p: Prestataire, date: DateISO = AUJOURDHUI): Verdict {
  const raisons: string[] = [];
  if (p.statut !== 'actif') raisons.push(`Prestataire ${p.statut === 'suspendu' ? 'suspendu' : 'sorti'}.`);
  for (const type of ['contrat', 'rc_pro', 'urssaf'] as const) {
    const doc = p.documents.find((d) => d.type === type);
    const statut = doc ? statutDocument(doc, date) : 'manquant';
    if (statut !== 'valide') raisons.push(`${LIBELLES_DOCS[type]} ${statut === 'expire' ? 'expirée' : 'manquante'}.`);
  }
  return raisons.length ? { ok: false, raisons } : { ok: true };
}

export interface AlerteDocument {
  prestataire: Prestataire;
  document: DocumentPrestataire;
  joursRestants: number;
  statut: 'expire' | 'manquant' | 'expire_bientot';
}

/** Documents expirés, manquants ou expirant sous `jours` jours (prestataires non sortis). */
export function documentsAlertes(prestataires: Prestataire[], jours = 30, date: DateISO = AUJOURDHUI): AlerteDocument[] {
  const alertes: AlerteDocument[] = [];
  for (const p of prestataires.filter((x) => x.statut !== 'sorti')) {
    for (const doc of p.documents) {
      const statut = statutDocument(doc, date);
      const joursRestants = doc.valideJusquau ? ecartJours(date, doc.valideJusquau) : 0;
      if (statut === 'manquant' || statut === 'expire') alertes.push({ prestataire: p, document: doc, joursRestants, statut });
      else if (doc.valideJusquau && joursRestants <= jours) alertes.push({ prestataire: p, document: doc, joursRestants, statut: 'expire_bientot' });
    }
  }
  return alertes.sort((a, b) => a.joursRestants - b.joursRestants);
}

/* ---------------------------------------------------------------- logements */

/** Règle SPEC §2.1 : mandat signé ET checklist de lancement complète. */
export function logementActivable(l: Logement, mandats: Mandat[]): Verdict {
  const raisons: string[] = [];
  const mandat = mandatDuLogement(mandats, l.id);
  if (!mandat || mandat.statut !== 'signe') raisons.push('Le mandat de gestion n’est pas signé.');
  for (const c of l.checklistLancement.filter((x) => !x.fait)) raisons.push(`À faire : ${c.libelle}.`);
  return raisons.length ? { ok: false, raisons } : { ok: true };
}

export function avancementChecklist(l: Logement): { faits: number; total: number; ratio: number } {
  const total = l.checklistLancement.length;
  const faits = l.checklistLancement.filter((c) => c.fait).length;
  return { faits, total, ratio: total ? faits / total : 0 };
}

/* -------------------------------------------------------------------- linge */

export interface EcartLinge {
  logementId: Id;
  article: string;
  manquant: number;
  /** Envoi en blanchisserie concerné. */
  envoiId: Id;
  date: DateISO;
}

/**
 * Écarts d'inventaire (SPEC §2.6) : pour chaque envoi en blanchisserie de plus
 * de `delaiJours` jours, articles non revenus dans ce délai.
 */
export function ecartsLinge(mouvements: MouvementLinge[], delaiJours = 5, date: DateISO = AUJOURDHUI): EcartLinge[] {
  const limite = ajouterJours(date, -delaiJours);
  const ecarts: EcartLinge[] = [];
  for (const envoi of mouvements.filter((m) => m.type === 'envoi_blanchisserie' && m.date <= limite)) {
    const fin = ajouterJours(envoi.date, delaiJours);
    const retours = mouvements.filter(
      (m) => m.type === 'retour_propre' && m.logementId === envoi.logementId && m.date > envoi.date && m.date <= fin,
    );
    for (const a of envoi.articles) {
      const revenus = retours.reduce(
        (s, r) => s + r.articles.filter((x) => x.article === a.article).reduce((t, x) => t + x.quantite, 0),
        0,
      );
      if (revenus < a.quantite) ecarts.push({ logementId: envoi.logementId, article: a.article, manquant: a.quantite - revenus, envoiId: envoi.id, date: envoi.date });
    }
  }
  return ecarts;
}

/** Quantités par article et par type de mouvement pour un logement. */
export function bilanLinge(mouvements: MouvementLinge[], logementId: Id) {
  const bilan = new Map<string, Record<MouvementLinge['type'], number>>();
  for (const m of mouvements.filter((x) => x.logementId === logementId)) {
    for (const a of m.articles) {
      const ligne =
        bilan.get(a.article) ??
        { sortie_sale: 0, envoi_blanchisserie: 0, retour_propre: 0, mise_en_place: 0, perte: 0, rebut: 0 };
      ligne[m.type] += a.quantite;
      bilan.set(a.article, ligne);
    }
  }
  return bilan;
}

/* -------------------------------------------------------------- incidents */

export function incidentsOuverts(incidents: Incident[]): Incident[] {
  return incidents.filter((i) => i.statut !== 'resolu');
}

/* --------------------------------------------------------------- commercial */

export function prospectsParEtape(prospects: Prospect[]): Record<EtapeProspect, Prospect[]> {
  const r: Record<EtapeProspect, Prospect[]> = {
    nouveau: [], contact: [], visite: [], proposition: [], negociation: [], signe: [], perdu: [],
  };
  for (const p of prospects) r[p.etape].push(p);
  return r;
}

/** Revenu annuel estimé des prospects encore en cours (ni signés ni perdus). */
export function valeurPipeline(prospects: Prospect[]): Centimes {
  return prospects
    .filter((p) => p.etape !== 'signe' && p.etape !== 'perdu')
    .reduce((s, p) => s + p.revenuEstimeAnnuelCentimes, 0);
}

/** Commission annuelle potentielle du pipeline au taux cible. */
export function commissionPotentielle(prospects: Prospect[], pct = 18): Centimes {
  return Math.round((valeurPipeline(prospects) * pct) / 100);
}

/** Mandats signés dans le mois de `date`. */
export function signaturesDuMois(mandats: Mandat[], date: DateISO = AUJOURDHUI): Mandat[] {
  const f = fenetreMois(date);
  return mandats.filter((m) => m.signeLe && m.signeLe >= f.debut && m.signeLe < f.fin);
}

/** Prochaines actions commerciales en retard ou du jour. */
export function actionsCommercialesDues(prospects: Prospect[], date: DateISO = AUJOURDHUI): Prospect[] {
  return prospects
    .filter((p) => p.prochaineActionLe && p.prochaineActionLe <= date && p.etape !== 'signe' && p.etape !== 'perdu')
    .sort((a, b) => a.prochaineActionLe!.localeCompare(b.prochaineActionLe!));
}

/* ------------------------------------------------------------------ finance */

export function montantTtc(f: Facture): Centimes {
  return Math.round(f.montantHtCentimes * (1 + f.tvaPct / 100));
}

/** Factures en retard : statut en_retard, ou émises et échéance dépassée. */
export function facturesEnRetard(factures: Facture[], date: DateISO = AUJOURDHUI): Facture[] {
  return factures.filter((f) => f.statut === 'en_retard' || (f.statut === 'emise' && f.echeance < date));
}

export function paiementsAFaire(d: Pick<ErpDonnees, 'paiementsPrestataires'>) {
  return d.paiementsPrestataires.filter((p) => p.statut === 'a_payer');
}

/** Relevé mensuel d'un propriétaire (SPEC §2.7), séjours au départ dans le mois. */
export function releveProprietaire(
  d: Pick<ErpDonnees, 'reservations' | 'mandats' | 'logements'>,
  proprietaireId: Id,
  periode: string,
) {
  const logements = d.logements.filter((l) => l.proprietaireId === proprietaireId);
  const lignes = logements.flatMap((l) => {
    const mandat = mandatDuLogement(d.mandats, l.id);
    return d.reservations
      .filter((r) => r.logementId === l.id && estActive(r) && r.depart.startsWith(periode))
      .map((r) => ({
        reservation: r,
        logement: l,
        brut: r.montantBrutCentimes,
        commissionPlateforme: r.commissionPlateformeCentimes,
        fraisMenage: r.fraisMenageCentimes,
        commission: commissionReservation(r, mandat),
        net: netProprietaire(r, mandat),
      }));
  });
  const total = (k: 'brut' | 'commissionPlateforme' | 'fraisMenage' | 'commission' | 'net') =>
    lignes.reduce((s, l) => s + l[k], 0);
  return {
    lignes,
    totaux: {
      brut: total('brut'),
      commissionPlateforme: total('commissionPlateforme'),
      fraisMenage: total('fraisMenage'),
      commission: total('commission'),
      net: total('net'),
    },
  };
}

/* ------------------------------------------------------ indicateurs groupés */

/** Tous les indicateurs du tableau de bord (SPEC §6) en un appel. */
export function indicateurs(d: ErpDonnees, date: DateISO = AUJOURDHUI) {
  const actifs = logementsActifs(d.logements);
  const f30 = fenetreJours(30, date);
  const mois = fenetreMois(date);
  return {
    logementsActifs: actifs.length,
    logementsEnLancement: d.logements.filter((l) => l.statut === 'lancement').length,
    occupation30j: tauxOccupation(d.reservations, actifs, f30),
    revenuBrutMois: revenuBrut(d.reservations, mois),
    commissionMois: commissionLabelMaison(d.reservations, d.mandats, mois),
    adr30j: adr(d.reservations, f30),
    revpar30j: revpar(d.reservations, actifs, f30),
    noteMoyenne90j: noteMoyenne(d.reservations, fenetreJours(90, date)),
    tauxMissionsValidees30j: tauxMissionsValideesAvecPhotos(d.missions, f30),
    missionsAAttribuer48h: missionsAAttribuerSous(d.missions, 48, date).length,
    incidentsOuverts: incidentsOuverts(d.incidents).length,
    ecartsLinge: ecartsLinge(d.mouvementsLinge, 5, date).length,
    documentsAlertes: documentsAlertes(d.prestataires, 30, date).length,
    valeurPipeline: valeurPipeline(d.prospects),
    signaturesMois: signaturesDuMois(d.mandats, date).length,
    facturesEnRetard: facturesEnRetard(d.factures, date).length,
    paiementsAFaire: paiementsAFaire(d).length,
    messagesEnAttente: d.filsMessages.filter((f) => f.traitePar === 'en_attente').length,
  };
}
