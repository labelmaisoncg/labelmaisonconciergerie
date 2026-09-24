/**
 * Jeu de démo complet : le référentiel vient de seed-referentiel.ts, le reste
 * (réservations, missions, linge, finance...) est généré de façon
 * déterministe (PRNG à graine fixe) pour rester cohérent d'un chargement à
 * l'autre. Les montants suivent les règles de selectors.ts.
 */
import { checklistMenageVierge, SEUIL_NOTE_CONTROLE } from './constantes';
import { AUJOURDHUI, ajouterJours, debutMoisSuivant, ecartJours } from './format';
import {
  LOGEMENTS,
  MANDATS,
  PRESTATAIRES,
  PROFILS,
  PROPRIETAIRES,
  PROSPECTS,
  UTILISATEURS,
} from './seed-referentiel';
import { genererOperations } from './seed-operations';
import type {
  CanalReservation,
  ErpDonnees,
  Facture,
  Logement,
  Mission,
  MouvementLinge,
  PaiementPrestataire,
  Reservation,
  StatutMission,
} from './types';

export { AUJOURDHUI };

const DEBUT_FENETRE = '2026-06-01';
const FIN_FENETRE = '2026-11-15';

/* ----------------------------------------------------------------- hasard */

/** mulberry32 : petit PRNG déterministe, suffisant pour une maquette. */
export function creerHasard(graine: number) {
  let a = graine >>> 0;
  const suivant = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    suivant,
    entre: (min: number, max: number) => min + Math.floor(suivant() * (max - min + 1)),
    chance: (p: number) => suivant() < p,
    choix: <T,>(liste: readonly T[]): T => liste[Math.floor(suivant() * liste.length)],
    /** Tirage pondéré : [[valeur, poids], ...] */
    pondere: <T,>(options: readonly [T, number][]): T => {
      const total = options.reduce((s, [, p]) => s + p, 0);
      let r = suivant() * total;
      for (const [v, p] of options) {
        r -= p;
        if (r < 0) return v;
      }
      return options[options.length - 1][0];
    },
  };
}

export type Hasard = ReturnType<typeof creerHasard>;

/* -------------------------------------------------------------- voyageurs */

const PRENOMS = [
  'Camille', 'Lucas', 'Manon', 'Hugo', 'Léa', 'Nathan', 'Chloé', 'Mathis', 'Inès', 'Julien',
  'Sarah', 'Maxime', 'Emma', 'Antoine', 'Clara', 'Romain', 'Jade', 'Thomas', 'Yasmine', 'Kevin',
  'Pauline', 'Adrien', 'Laura', 'Mehdi', 'Anaïs', 'Quentin', 'Nora', 'Benoît', 'Lina', 'Olivier',
];
const PRENOMS_ETRANGERS: [string, string][] = [
  ['Daniel', 'Allemagne'], ['Sofia', 'Italie'], ['James', 'Royaume-Uni'], ['Marta', 'Espagne'],
  ['Pieter', 'Pays-Bas'], ['Ana', 'Portugal'], ['Emily', 'États-Unis'], ['Lukas', 'Belgique'],
];
const INITIALES = 'ABCDEFGHJKLMNPRSTV';

const COMMENTAIRES_POSITIFS = [
  'Logement très propre et bien équipé, arrivée autonome sans souci.',
  'Parfait pour un déplacement professionnel, calme et proche des transports.',
  'Hôte réactif, tout était conforme aux photos.',
  'Très bon séjour, literie confortable. Nous reviendrons.',
  'Accueil impeccable, le guide du logement est très clair.',
  'Propre, bien situé, rien à redire.',
];
const COMMENTAIRES_MOYENS = [
  'Correct mais quelques traces de calcaire dans la douche.',
  'Bruit de la rue la nuit, fenêtres à améliorer.',
  'Il manquait des serviettes à notre arrivée.',
  'Wifi instable pendant le séjour.',
];

function voyageur(h: Hasard) {
  if (h.chance(0.16)) {
    const [prenom, pays] = h.choix(PRENOMS_ETRANGERS);
    return { nom: `${prenom} ${h.choix(INITIALES.split(''))}.`, pays };
  }
  return { nom: `${h.choix(PRENOMS)} ${h.choix(INITIALES.split(''))}.`, pays: 'France' };
}

/* ------------------------------------------------------------ réservations */

const TAUX_PLATEFORME: Record<CanalReservation, number> = {
  airbnb: 0.155,
  booking: 0.17,
  direct: 0,
  autre: 0,
};

function prixNuit(h: Hasard, base: number, nuit: string, paris: boolean): number {
  const jour = new Date(`${nuit}T12:00:00`).getDay();
  const mois = Number(nuit.slice(5, 7));
  let prix = base;
  if (jour === 5 || jour === 6) prix *= 1.12;
  if (paris && (mois === 7 || mois === 8)) prix *= 1.08;
  if (!paris && mois === 8) prix *= 0.94;
  prix *= 0.93 + h.suivant() * 0.14;
  return Math.round(prix);
}

/** Probabilité qu'un séjour futur soit déjà réservé, selon son éloignement. */
function dejaReserve(joursAvant: number): number {
  if (joursAvant <= 7) return 0.95;
  if (joursAvant <= 21) return 0.8;
  if (joursAvant <= 45) return 0.55;
  return 0.3;
}

function genererReservations(h: Hasard): Reservation[] {
  const reservations: Reservation[] = [];
  let n = 0;
  for (const logement of LOGEMENTS) {
    const profil = PROFILS[logement.id];
    if (!profil) continue;
    const mandat = MANDATS.find((m) => m.logementId === logement.id)!;
    const debut = profil.enLigneDepuis > DEBUT_FENETRE ? profil.enLigneDepuis : DEBUT_FENETRE;
    const fin = profil.horsLigneLe ?? FIN_FENETRE;
    let curseur = ajouterJours(debut, h.entre(0, 2));

    while (curseur < fin) {
      const nuits = h.pondere<number>([[1, 10], [2, 30], [3, 25], [4, 14], [5, 9], [6, 5], [7, 4], [10, 2], [14, 1]]);
      const depart = ajouterJours(curseur, nuits);
      if (depart > fin) break;
      const ecartAvant = ecartJours(AUJOURDHUI, curseur);
      const reserve = ecartAvant <= 0 || h.chance(dejaReserve(ecartAvant));

      if (reserve) {
        n += 1;
        const canal = h.pondere<CanalReservation>([['airbnb', 72], ['booking', 20], ['direct', 8]]);
        const paris = logement.ville === 'Paris';
        let hebergement = 0;
        for (let i = 0; i < nuits; i++) hebergement += prixNuit(h, profil.prixNuit, ajouterJours(curseur, i), paris);
        const fraisMenage = mandat.fraisMenageCentimes;
        const brut = hebergement * 100 + fraisMenage;
        const annulee = h.chance(0.04);
        const statut: Reservation['statut'] = annulee
          ? 'annulee'
          : depart <= AUJOURDHUI
            ? 'terminee'
            : curseur <= AUJOURDHUI
              ? 'en_cours'
              : 'confirmee';
        const v = voyageur(h);
        const r: Reservation = {
          id: `res-${String(n).padStart(4, '0')}`,
          logementId: logement.id,
          canal,
          voyageur: { ...v, nbPersonnes: Math.min(logement.capacite, h.entre(1, Math.max(2, logement.capacite - 1))) },
          arrivee: curseur,
          depart,
          nuits,
          statut,
          montantBrutCentimes: brut,
          commissionPlateformeCentimes: Math.round(brut * TAUX_PLATEFORME[canal]),
          fraisMenageCentimes: fraisMenage,
          channexBookingId: canal === 'direct' ? undefined : `CHX-${logement.id.slice(4, 8).toUpperCase()}-${10400 + n}`,
        };
        if (statut === 'terminee' && h.chance(0.78)) {
          const noteTiree = h.pondere<number>([[5, 52], [4.8, 18], [4.6, 12], [4.2, 7], [4, 6], [3.5, 3], [3, 2]]);
          r.noteVoyageur = noteTiree;
          r.commentaireVoyageur = noteTiree >= 4.6 ? h.choix(COMMENTAIRES_POSITIFS) : h.choix(COMMENTAIRES_MOYENS);
        }
        reservations.push(r);
      }
      const ecart = Math.round(h.pondere<number>([[0, 40], [1, 25], [2, 15], [3, 8], [4, 7], [6, 5]]) * profil.tension);
      curseur = ajouterJours(depart, ecart);
    }
  }
  return reservations.sort((a, b) => a.arrivee.localeCompare(b.arrivee));
}

/* ---------------------------------------------------------------- missions */

function tarifMenage(prestataireId: string | undefined, logement: Logement): number {
  const p = PRESTATAIRES.find((x) => x.id === prestataireId);
  return p?.tarifs.find((t) => t.typeLogement === logement.type)?.montantCentimes ?? 3500;
}

function horodatage(date: string, heure: string): string {
  return `${date}T${heure}:00+02:00`;
}

function photos(missionId: string, date: string, avant: number, apres: number) {
  const liste: Mission['photos'] = [];
  for (let i = 1; i <= avant; i++) {
    liste.push({ url: `demo://photos/${missionId}/avant-${i}.jpg`, moment: 'avant', prisLe: horodatage(date, `11:${String(10 + i * 2).padStart(2, '0')}`) });
  }
  for (let i = 1; i <= apres; i++) {
    liste.push({ url: `demo://photos/${missionId}/apres-${i}.jpg`, moment: 'apres', prisLe: horodatage(date, `13:${String(20 + i * 3).padStart(2, '0')}`) });
  }
  return liste;
}

/** Suspension de Lucas Perrin (RC Pro expirée le 15 août). */
const FIN_PERRIN = '2026-08-15';

/** Prestataire du ménage à une date donnée (Perrin a tenu Juvisy jusqu'à sa suspension). */
function prestataireMenage(logementId: string, date: string): string {
  if (logementId === 'log-juvisy' && date < FIN_PERRIN) return 'pre-perrin';
  return PROFILS[logementId].prestataireMenageId;
}

function genererMissions(h: Hasard, reservations: Reservation[]): Mission[] {
  const missions: Mission[] = [];
  let refuseePosee = false;
  for (const r of reservations) {
    if (r.statut === 'annulee') continue;
    const logement = LOGEMENTS.find((l) => l.id === r.logementId)!;
    const id = `mis-${r.id.slice(4)}`;
    const ecart = ecartJours(AUJOURDHUI, r.depart);
    const prestataireId = prestataireMenage(r.logementId, r.depart);
    let statut: StatutMission;
    if (ecart < -4) statut = 'validee';
    else if (ecart < 0) statut = h.chance(0.35) ? 'a_valider' : 'validee';
    else if (ecart === 0) statut = h.chance(0.5) ? 'en_cours' : 'attribuee';
    else if (ecart <= 2) statut = h.chance(0.3) ? 'a_attribuer' : 'attribuee';
    else if (ecart <= 10) statut = h.chance(0.12) ? 'a_attribuer' : 'attribuee';
    else statut = h.chance(0.15) ? 'a_attribuer' : 'attribuee';

    // Une mission refusée : la dernière de Lucas Perrin avant sa suspension.
    if (!refuseePosee && statut === 'validee' && r.logementId === 'log-juvisy' && r.depart >= '2026-08-01') {
      statut = 'refusee';
      refuseePosee = true;
    }

    const checklist = checklistMenageVierge();
    let listePhotos: Mission['photos'] = [];
    let commentaire: string | undefined;
    if (statut === 'validee') {
      checklist.forEach((c) => (c.fait = true));
      listePhotos = photos(id, r.depart, h.entre(2, 3), h.entre(3, 5));
    } else if (statut === 'a_valider') {
      checklist.forEach((c) => (c.fait = true));
      // Une mission sur deux à valider n'a pas encore ses photos « après » : la règle bloque.
      listePhotos = photos(id, r.depart, 2, h.chance(0.5) ? 0 : 3);
      if (!listePhotos.some((p) => p.moment === 'apres')) commentaire = 'Photos après non transmises.';
    } else if (statut === 'refusee') {
      checklist.forEach((c, i) => (c.fait = i < 5));
      listePhotos = photos(id, r.depart, 1, 1);
      commentaire = 'Salle de bain non faite, cheveux dans la douche. Mission refusée, repassage demandé.';
    } else if (statut === 'en_cours') {
      checklist.forEach((c, i) => (c.fait = i < 3));
      listePhotos = photos(id, r.depart, 2, 0);
    }

    const noteBasse = r.noteVoyageur !== undefined && r.noteVoyageur < SEUIL_NOTE_CONTROLE;
    const controleQualite = noteBasse || h.chance(0.1);
    missions.push({
      id,
      type: 'menage',
      logementId: r.logementId,
      reservationId: r.id,
      prestataireId: statut === 'a_attribuer' ? undefined : prestataireId,
      date: r.depart,
      heureDebut: logement.fiche.heureDepart,
      heureFinMax: logement.fiche.heureArrivee,
      statut,
      checklist,
      photos: listePhotos,
      tarifCentimes: tarifMenage(prestataireId, logement),
      controleQualite,
      noteControle: controleQualite && statut === 'validee' ? h.pondere<number>([[5, 5], [4, 4], [3, 1]]) : undefined,
      commentaire,
    });
  }
  return missions;
}

/* -------------------------------------------------------------------- linge */

function jeuParSejour(logement: Logement) {
  const doubles = logement.lits.filter((l) => l.type !== 'simple').reduce((s, l) => s + l.nombre, 0);
  const simples = logement.lits.filter((l) => l.type === 'simple').reduce((s, l) => s + l.nombre, 0);
  const couchages = doubles * 2 + simples;
  return [
    ...(doubles ? [{ article: 'Drap housse 140', quantite: doubles }, { article: 'Housse de couette 240', quantite: doubles }] : []),
    ...(simples ? [{ article: 'Drap housse 90', quantite: simples }, { article: 'Housse de couette 140', quantite: simples }] : []),
    { article: 'Taie d’oreiller', quantite: couchages },
    { article: 'Serviette de bain', quantite: Math.min(couchages, 4) },
    { article: 'Serviette de toilette', quantite: Math.min(couchages, 4) },
    { article: 'Tapis de bain', quantite: 1 },
  ];
}

function genererLinge(missions: Mission[]): { mouvements: MouvementLinge[]; ecart?: EcartSeed } {
  const mouvements: MouvementLinge[] = [];
  let n = 0;
  const id = () => `lin-${String(++n).padStart(4, '0')}`;
  const depuis = ajouterJours(AUJOURDHUI, -21);

  for (const m of missions) {
    if (m.date < depuis || m.date > AUJOURDHUI || m.statut === 'a_attribuer') continue;
    const logement = LOGEMENTS.find((l) => l.id === m.logementId)!;
    const jeu = jeuParSejour(logement);
    mouvements.push({ id: id(), logementId: m.logementId, date: m.date, type: 'sortie_sale', articles: jeu, prestataireId: m.prestataireId, missionId: m.id });
    mouvements.push({ id: id(), logementId: m.logementId, date: m.date, type: 'mise_en_place', articles: jeu, prestataireId: m.prestataireId, missionId: m.id });
  }

  // Tournées blanchisserie : enlèvement le lundi, retour le jeudi.
  let ecart: EcartSeed | undefined;
  for (const lundi of ['2026-09-07', '2026-09-14', '2026-09-21']) {
    // Soisy en premier : c'est là qu'on pose l'écart d'inventaire de la démo.
    const actifs = LOGEMENTS.filter((l) => l.statut === 'actif');
    actifs.sort((x, y) => Number(y.id === 'log-soisy') - Number(x.id === 'log-soisy'));
    for (const logement of actifs) {
      const sales = mouvements.filter(
        (x) => x.logementId === logement.id && x.type === 'sortie_sale' && x.date < lundi && x.date >= ajouterJours(lundi, -7),
      );
      if (!sales.length) continue;
      const articles = cumuler(sales.flatMap((x) => x.articles));
      mouvements.push({ id: id(), logementId: logement.id, date: lundi, type: 'envoi_blanchisserie', articles, prestataireId: 'pre-blanchisserie' });
      const jeudi = ajouterJours(lundi, 3);
      if (jeudi > AUJOURDHUI) continue;
      let retour = articles;
      if (!ecart && lundi === '2026-09-14') {
        ecart = { logementId: logement.id, date: jeudi, article: articles[0].article };
        retour = articles.map((a, i) => (i === 0 ? { ...a, quantite: a.quantite - 1 } : a));
      }
      mouvements.push({ id: id(), logementId: logement.id, date: jeudi, type: 'retour_propre', articles: retour, prestataireId: 'pre-blanchisserie' });
    }
  }

  mouvements.push(
    { id: id(), logementId: 'log-corbeil-t3', date: '2026-09-11', type: 'rebut', articles: [{ article: 'Serviette de bain', quantite: 2 }], note: 'Taches de fond de teint indélébiles.' },
    { id: id(), logementId: 'log-paris14', date: '2026-09-19', type: 'rebut', articles: [{ article: 'Housse de couette 240', quantite: 1 }], note: 'Déchirée au lavage.' },
    { id: id(), logementId: 'log-evry-t2', date: '2026-09-03', type: 'perte', articles: [{ article: 'Serviette de toilette', quantite: 1 }], note: 'Non retrouvée après le départ, voyageur prévenu.' },
  );
  return { mouvements: mouvements.sort((a, b) => a.date.localeCompare(b.date)), ecart };
}

/** Écart d'inventaire posé volontairement dans la démo (repris par un incident). */
export interface EcartSeed {
  logementId: string;
  date: string;
  article: string;
}

function cumuler(lignes: { article: string; quantite: number }[]) {
  const total = new Map<string, number>();
  for (const l of lignes) total.set(l.article, (total.get(l.article) ?? 0) + l.quantite);
  return [...total].map(([article, quantite]) => ({ article, quantite }));
}

/* ------------------------------------------------------------------ finance */

/** Commission Label Maison d'une réservation (cf. selectors.commissionReservation). */
function commission(r: Reservation, pct: number): number {
  return Math.round(((r.montantBrutCentimes - r.commissionPlateformeCentimes - r.fraisMenageCentimes) * pct) / 100);
}

function genererFactures(reservations: Reservation[]): Facture[] {
  const factures: Facture[] = [];
  let n = 40;
  const retards = new Set(['pro-sci-tilleuls:2026-07', 'pro-mansouri:2026-08']);
  for (const mois of ['2026-06', '2026-07', '2026-08', '2026-09']) {
    for (const p of PROPRIETAIRES) {
      const lignes: Facture['lignes'] = [];
      for (const m of MANDATS.filter((x) => x.proprietaireId === p.id && x.statut !== 'brouillon')) {
        const logement = LOGEMENTS.find((l) => l.id === m.logementId)!;
        const duMois = reservations.filter((r) => r.logementId === m.logementId && r.statut !== 'annulee' && r.depart.startsWith(mois));
        if (!duMois.length) continue;
        const total = duMois.reduce((s, r) => s + commission(r, m.commissionPct), 0);
        lignes.push({ libelle: `Commission de gestion ${m.commissionPct} % · ${logement.nom} (${duMois.length} séjours)`, quantite: 1, puCentimes: total });
        lignes.push({ libelle: `Frais de ménage · ${logement.nom}`, quantite: duMois.length, puCentimes: m.fraisMenageCentimes });
      }
      if (!lignes.length) continue;
      const emission = debutMoisSuivant(`${mois}-01`).replace(/-01$/, '-05');
      const echeance = ajouterJours(emission, 15);
      const cle = `${p.id}:${mois}`;
      let statut: Facture['statut'];
      if (emission > AUJOURDHUI) statut = 'brouillon';
      else if (retards.has(cle)) statut = 'en_retard';
      else if (echeance < AUJOURDHUI) statut = 'payee';
      else statut = 'emise';
      n += 1;
      factures.push({
        id: `fac-${n}`,
        numero: `LM-2026-${String(n).padStart(4, '0')}`,
        type: 'commission',
        destinataire: 'proprietaire',
        proprietaireId: p.id,
        dateEmission: emission,
        echeance,
        montantHtCentimes: lignes.reduce((s, l) => s + l.quantite * l.puCentimes, 0),
        tvaPct: 20,
        statut,
        payeeLe: statut === 'payee' ? ajouterJours(emission, 6 + (n % 7)) : undefined,
        lignes,
      });
    }
  }
  factures.push({
    id: 'fac-lancement-linas',
    numero: 'LM-2026-0090',
    type: 'prestation',
    destinataire: 'proprietaire',
    proprietaireId: 'pro-lambert',
    dateEmission: '2026-09-15',
    echeance: '2026-09-30',
    montantHtCentimes: 39000,
    tvaPct: 20,
    statut: 'emise',
    lignes: [
      { libelle: 'Mise en service : photos, annonce, inventaire contradictoire', quantite: 1, puCentimes: 29000 },
      { libelle: 'Étiquetage du linge (dotation complète)', quantite: 1, puCentimes: 10000 },
    ],
  });
  return factures;
}

function genererPaiements(missions: Mission[]): PaiementPrestataire[] {
  const paiements: PaiementPrestataire[] = [];
  for (const mois of ['2026-06', '2026-07', '2026-08']) {
    for (const prestataireId of ['pre-ouali', 'pre-eclat', 'pre-perrin']) {
      const duMois = missions.filter((m) => m.prestataireId === prestataireId && m.date.startsWith(mois));
      const validees = duMois.filter((m) => m.statut === 'validee');
      const refusees = duMois.filter((m) => m.statut === 'refusee');
      if (!duMois.length) continue;
      const courant = mois === '2026-08';
      const bloque = prestataireId === 'pre-perrin' && courant;
      paiements.push({
        id: `pay-${prestataireId.slice(4)}-${mois}`,
        prestataireId,
        periode: mois,
        missions: validees.map((m) => m.id),
        montantCentimes: validees.reduce((s, m) => s + m.tarifCentimes, 0),
        retenueCentimes: refusees.reduce((s, m) => s + m.tarifCentimes, 0),
        motifRetenue: refusees.length ? 'Mission refusée au contrôle : pas de validation, pas de paiement.' : undefined,
        statut: bloque ? 'bloque' : courant && prestataireId === 'pre-eclat' ? 'a_payer' : 'paye',
        payeLe: bloque || (courant && prestataireId === 'pre-eclat') ? undefined : `${debutMoisSuivant(`${mois}-01`).slice(0, 7)}-08`,
      });
    }
  }
  return paiements;
}

/* ------------------------------------------------------------- assemblage */

export function creerSeed(): ErpDonnees {
  const h = creerHasard(20260924);
  const reservations = genererReservations(h);
  const missions = genererMissions(h, reservations);
  const linge = genererLinge(missions);
  const operations = genererOperations(reservations, missions, linge.ecart);
  const toutesMissions = [...missions, ...operations.missions];

  const prestataires = PRESTATAIRES.map((p) => ({
    ...p,
    missionsRealisees: toutesMissions.filter((m) => m.prestataireId === p.id && m.statut === 'validee').length,
  }));

  return {
    proprietaires: structuredClone(PROPRIETAIRES),
    mandats: structuredClone(MANDATS),
    logements: structuredClone(LOGEMENTS),
    reservations,
    filsMessages: operations.filsMessages,
    missions: toutesMissions,
    prestataires: structuredClone(prestataires),
    mouvementsLinge: linge.mouvements,
    incidents: operations.incidents,
    factures: genererFactures(reservations),
    paiementsPrestataires: genererPaiements(missions),
    charges: operations.charges,
    prospects: structuredClone(PROSPECTS),
    utilisateurs: structuredClone(UTILISATEURS),
    journal: operations.journal,
  };
}
