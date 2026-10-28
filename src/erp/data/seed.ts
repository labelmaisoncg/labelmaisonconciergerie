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
import { genererEquipeOps } from './seed-equipe';
import { creerRecommandations } from './seed-recommandations';
import { REGLAGES_AGENT_DEFAUT } from './reglages';
import { creerProgrammesDemo } from './seed-programmes';
import { creerVersionsAnnonce } from './seed-annonces';
import { creerContactsCrm } from './seed-crm';
import { creerActionsAgentDemo } from './seed-copilote';
import { creerDossiersDemo } from './seed-dossiers';
import { creerEspaceProprietaireDemo, prolongationDemo } from './seed-proprietaire';
import { positionDemo } from './seed-carte';
import { premiereAnnonce } from './annonces-equipe';
import { ESPACE_LABEL_MAISON } from './espaces';
import { nomConciergerie } from './marque-espace';
import { ID_REGLAGES_SUPPLEMENTS, type ReglagesSupplements } from './supplements';
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
          repull:
            canal === 'direct'
              ? undefined
              : { id: String(210400 + n), code: canal === 'airbnb' ? `HM${logement.id.slice(4, 8).toUpperCase()}${10400 + n}` : String(4410400 + n) },
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
      if (!duMois.length) continue;
      const courant = mois === '2026-08';
      const bloque = prestataireId === 'pre-perrin' && courant;
      paiements.push({
        id: `pay-${prestataireId.slice(4)}-${mois}`,
        prestataireId,
        periode: mois,
        missions: validees.map((m) => m.id),
        montantCentimes: validees.reduce((s, m) => s + m.tarifCentimes, 0),
        // Les missions refusées sont déjà exclues du montant (pas de validation,
        // pas de paiement) : aucune retenue ne s'y ajoute.
        retenueCentimes: 0,
        statut: bloque ? 'bloque' : courant && prestataireId === 'pre-eclat' ? 'a_payer' : 'paye',
        payeLe: bloque || (courant && prestataireId === 'pre-eclat') ? undefined : `${debutMoisSuivant(`${mois}-01`).slice(0, 7)}-08`,
      });
    }
  }
  return paiements;
}

/* -------------------------------------------------------- avis ciblés */

const AVIS_JUVISY: [number, string][] = [
  [3.5, 'Bruit des trains toute la nuit, impossible de dormir même fenêtres fermées.'],
  [4, 'Matelas fatigué et oreillers trop plats, mal dormi.'],
  [3.5, 'Boîte à clés bloquée à notre arrivée, 40 minutes d’attente dehors.'],
  [4, 'Logement bruyant côté gare, fenêtres à changer.'],
  [4.2, 'Literie à changer, le sommier grince.'],
  [3, 'Clés introuvables dans la boîte à clés, arrivée très compliquée.'],
  [4, 'Bruit de la rue et des trains, isolation insuffisante.'],
];

/**
 * Avis rendus volontairement typés pour que la démo montre un parc varié
 * (SPEC §10) : Juvisy Gare accumule les plaintes (bruit, literie, arrivée),
 * Paris 14 Alésia est le bien vitrine. Appliqué après la génération des
 * missions pour ne pas décaler le tirage aléatoire.
 */
function typerAvis(reservations: Reservation[]) {
  const juvisy = reservations.filter((r) => r.logementId === 'log-juvisy' && r.noteVoyageur !== undefined);
  juvisy.forEach((r, i) => {
    if (i % 2 === 0) {
      const [note, commentaire] = AVIS_JUVISY[(i / 2) % AVIS_JUVISY.length];
      r.noteVoyageur = note;
      r.commentaireVoyageur = commentaire;
    }
  });
  for (const r of reservations) {
    if (r.logementId === 'log-paris14' && r.noteVoyageur !== undefined && r.noteVoyageur < 4.6) {
      r.noteVoyageur = 5;
      r.commentaireVoyageur = 'Appartement superbe et impeccable, à deux pas du métro. Communication parfaite.';
    }
  }
  varierAvis(reservations);
}

/**
 * Textes d'avis propres à chaque logement (notes inchangées), en français et
 * en anglais, avec quelques messages privés : l'analyse des avis (thèmes,
 * sentiment, avis à lire en premier) montre un parc contrasté. Aucun tirage
 * aléatoire : la suite du jeu de démonstration reste la même.
 */
const AVIS_VARIES: Record<string, { bons: string[]; moyens: string[] }> = {
  'log-corbeil-t2': {
    bons: [
      'Vue superbe sur la Seine et appartement très calme. Literie confortable.',
      'Très bien situé, à deux pas de la gare. Hôte réactif et arrivée autonome facile.',
      'Lovely flat by the river, very quiet and clean. Great location.',
      'Appartement propre et lumineux, cuisine bien équipée. Nous reviendrons.',
    ],
    moyens: [
      'Emplacement idéal mais la salle de bain n’était pas très propre, traces de calcaire.',
      'Poussière sous les lits et vaisselle à relaver. Dommage, le quartier est agréable.',
      'Difficile de se garer le soir, et quelques cheveux dans la douche.',
    ],
  },
  'log-corbeil-t3': {
    bons: [
      'Parfait pour une famille : cuisine très bien équipée, lit bébé et jeux pour les enfants.',
      'Logement spacieux, literie confortable et propre. Communication parfaite.',
      'Great family apartment, well equipped kitchen and comfortable beds. The host was very helpful.',
      'Tout était conforme aux photos, rien à redire.',
    ],
    moyens: [
      'Un peu bruyant côté rue le samedi soir, sinon logement agréable.',
      'Instructions d’arrivée peu claires : une demi-heure d’attente devant la porte.',
      'Wifi très lent et chauffage difficile à régler.',
      'Bon séjour mais un peu cher pour la prestation.',
    ],
  },
  'log-evry-t2': {
    bons: [
      'Hôte très réactif, réponses rapides à chaque message. Proche du RER et des commerces.',
      'Ideal for a business trip: quiet, close to the station and great wifi.',
      'Très bon rapport qualité-prix, logement propre et pratique.',
      'Accueil chaleureux et guide du logement très clair.',
    ],
    moyens: [
      'Le wifi ne fonctionnait pas pendant deux jours, gênant pour le télétravail.',
      'Logement correct mais on entend tout chez les voisins.',
      'Wifi unstable and the shower had no hot water one morning.',
    ],
  },
  'log-evry-cosy': {
    bons: [
      'Appartement cosy et impeccable, très bien décoré. Arrivée autonome sans souci.',
      'Very clean and cosy, the check-in was easy. We loved our stay.',
      'Super séjour, propre et calme. Merci pour l’accueil.',
    ],
    moyens: [
      'Boîte à clés difficile à ouvrir, il a fallu appeler l’hôte.',
      'Canapé-lit inconfortable pour le troisième voyageur.',
      'Matelas trop mou, mal dormi. Le reste était correct.',
    ],
  },
  'log-lisses': {
    bons: [
      'Maison très calme avec un beau jardin, parfait pour se reposer.',
      'Peaceful house with a lovely garden, spotless and well equipped.',
      'Propre, spacieux et calme. Les enfants ont adoré le jardin.',
      'Accueil adorable et logement conforme à l’annonce.',
    ],
    moyens: ['Un peu loin des transports, la voiture est indispensable.', 'Joli jardin mais logement un peu cher pour la saison.'],
  },
  'log-soisy': {
    bons: [
      'Cadre magnifique au bord de la Seine, très calme. Lits très confortables.',
      'Beautiful spot by the river, comfortable beds and a very responsive host.',
      'Logement fidèle à l’annonce, propre et bien équipé.',
    ],
    moyens: [
      'Il manquait du papier toilette et du café à notre arrivée.',
      'Vaisselle insuffisante et four en panne.',
      'Ménage pas fait correctement, des traces sur le sol.',
    ],
  },
  'log-massy': {
    bons: [
      'Perfect location near the TGV station, modern and well equipped flat.',
      'Idéal pour un déplacement pro, à deux pas du RER B. Arrivée très simple.',
      'Clean, quiet and great value for money.',
      'Appartement moderne et propre, tout fonctionne.',
    ],
    moyens: ['Bruit de l’autoroute la nuit, fenêtres à changer.', 'A bit expensive for the size, and the walls are thin.', 'Climatisation en panne pendant la canicule.'],
  },
  'log-paris14': {
    bons: [
      'Appartement superbe et impeccable, à deux pas du métro. Communication parfaite.',
      'Charmant, très propre et parfaitement situé. Hôte aux petits soins.',
      'Wonderful stay, spotless flat in a lovely neighbourhood. Highly recommend.',
      'Tout était parfait : literie confortable, cuisine bien équipée, quartier calme.',
    ],
    moyens: [],
  },
};

/** Retours privés (jamais repris dans une réponse publique) ajoutés à quelques avis. */
const MESSAGES_PRIVES = [
  'La douche fuit un peu, à vérifier.',
  'Merci encore, le petit mot d’accueil nous a beaucoup touchés.',
  'Le détecteur de fumée bipe, la pile est sans doute à changer.',
  'Les voisins du dessus étaient bruyants vers minuit.',
];

function varierAvis(reservations: Reservation[]) {
  let prive = 0;
  for (const [logementId, pool] of Object.entries(AVIS_VARIES)) {
    let bon = 0;
    let moyen = 0;
    reservations
      .filter((r) => r.logementId === logementId && r.noteVoyageur !== undefined)
      .forEach((r, i) => {
        const note = r.noteVoyageur!;
        const texte = note >= 4.6 ? pool.bons[bon++ % pool.bons.length] : pool.moyens.length ? pool.moyens[moyen++ % pool.moyens.length] : undefined;
        if (texte) r.commentaireVoyageur = texte;
        if (i % 5 === 2 && r.commentaireVoyageur) r.commentaireVoyageur = `${r.commentaireVoyageur}\n\nMessage privé : ${MESSAGES_PRIVES[prive++ % MESSAGES_PRIVES.length]}`;
      });
  }
}

/* ------------------------------------------------------------- assemblage */

/** Photos du site, pour que la démo montre une vraie galerie. */
const PHOTOS_DEMO = [
  '/images/real/logement-salon-poster.jpg',
  '/images/real/logement-suite.jpg',
  '/images/real/logement-hero.jpg',
  '/images/real/logement-sdb-poster.jpg',
  '/images/real/hero-logement-exception.jpg',
  '/images/real/logement-riad-poster.jpg',
  '/images/real/jacuzzi.jpg',
];

/** Annonce de démonstration : ce que les plateformes renverraient (couchage, conditions, prix de base). */
function descriptifDemo(l: Logement, base: number, i: number): Logement['descriptif'] {
  const couchage = l.chambres
    ? Array.from({ length: Math.min(l.chambres, 4) }, (_, k) => ({ piece: `Chambre ${k + 1}`, lits: k === 0 ? '1 lit queen size' : '2 lits simples' }))
    : [{ piece: 'Pièce principale', lits: '1 lit double' }];
  if (l.capacite > couchage.length * 2) couchage.push({ piece: 'Salon', lits: '1 canapé-lit' });
  return {
    titre: `${l.type === 'maison' ? 'Maison' : l.type === 'studio' ? 'Studio' : 'Appartement'} lumineux à ${l.ville}`,
    textes: {
      resume: `Un ${l.type === 'maison' ? 'logement' : 'appartement'} calme et lumineux, à deux pas des commerces de ${l.ville}.`,
      description: 'Cuisine équipée, linge de maison fourni, arrivée autonome à toute heure.\n\nIdéal pour un séjour en famille ou un déplacement professionnel.',
      quartier: 'Boulangerie, supermarché et pharmacie à moins de 5 minutes à pied.',
      transports: 'RER à 10 minutes à pied, Paris en 35 minutes.',
    },
    couchage,
    sallesDeBain: l.chambres > 2 ? 2 : 1,
    conditions: {
      animaux: i % 3 === 0,
      fumeur: false,
      fetes: false,
      enfants: true,
      calme: { debut: '22:00', fin: '08:00' },
      annulation: i % 2 ? 'Modérée' : 'Flexible',
      arrivee: 'Boîte à clés',
      arriveeJusqua: '23:00',
    },
    sejour: { nuitsMin: l.capacite > 4 ? 2 : 1, reservationInstantanee: true },
    prix: { devise: 'EUR', nuit: Math.round(base / 100) * 100, weekend: Math.round((base * 1.25) / 100) * 100, menage: 4000 + l.chambres * 1000, remiseSemainePct: 10 },
    ...(i % 3 === 0 ? { frais: ['Animal : 15 € par séjour (en option)'] } : {}),
  };
}

/** Démo : photos, prix par nuit des 60 prochains jours (plus cher le week-end) et annonce, comme lus sur les plateformes. */
/** Guides de démonstration : adresses factices évidentes (exemple.invalid), jamais envoyées. */
function guidesDemo(id: string): NonNullable<Logement['fiche']['guides']> {
  return [
    {
      id: `${id}-guide-cle`,
      titre: 'Récupérer la clé',
      quand: 'Quand le voyageur demande comment entrer dans le logement',
      media: { type: 'video', url: 'https://videos.exemple.invalid/recuperer-la-cle' },
      acces: true,
      ajouteLe: `${AUJOURDHUI}T09:00:00+02:00`,
      ajoutePar: 'Abdel',
    },
    {
      id: `${id}-guide-plaques`,
      titre: 'Allumer les plaques de cuisson',
      quand: 'Quand le voyageur n’arrive pas à cuisiner',
      media: { type: 'lien', url: 'https://videos.exemple.invalid/plaques' },
      ajouteLe: `${AUJOURDHUI}T09:05:00+02:00`,
      ajoutePar: 'Abdel',
    },
  ];
}

const QUESTIONS_DEMO = [
  { id: 'q-poubelles', question: 'Où jeter les poubelles ?', reponse: 'Local au rez-de-chaussée, à droite de l’entrée. Sortie le mardi soir.' },
  { id: 'q-chauffage', question: 'Comment marche le chauffage ?', reponse: 'Thermostat dans l’entrée : appuyez sur + pour monter la température.' },
];

function habiller(logements: Logement[]): Logement[] {
  return logements.map((l, i) => {
    if (l.statut === 'sorti') return l;
    const base = 6500 + l.capacite * 1500 + (i % 3) * 1000;
    const jours = Array.from({ length: 60 }, (_, k) => {
      const date = ajouterJours(AUJOURDHUI, k);
      const jour = new Date(`${date}T12:00:00Z`).getUTCDay();
      const weekEnd = jour === 5 || jour === 6;
      return { date, prixCentimes: Math.round((base * (weekEnd ? 1.25 : 1)) / 100) * 100, libre: (k * 7 + i * 3) % 5 > 1 };
    });
    if (l.id === 'log-massy') {
      // Une annonce uniquement Booking.com : la connexion ne transmet ni photo ni prix (cas réel) ;
      // repli, note de lecture et prix constaté sur les séjours.
      const { prix: _prix, ...descriptif } = descriptifDemo(l, base, i) ?? {};
      return {
        ...l,
        photoUrl: undefined,
        descriptif,
        annonces: [{ canal: 'booking', connecte: true }],
        repull: {
          id: '219001',
          canaux: [{ plateforme: 'booking', idExterne: '9910001', actif: true }],
          lecture: {
            photos: 'aucune',
            prix: 'aucun',
            raisonPhotos: 'Booking.com : accès refusé',
            raisonPrix: 'Calendrier : aucun prix enregistré ; Booking.com : accès refusé',
            le: AUJOURDHUI,
          },
        },
      };
    }
    const photos = [0, 1, 2, 3, 4, 5].map((k) => PHOTOS_DEMO[(i + k) % PHOTOS_DEMO.length]);
    // Démo : guides (liens factices) et questions fréquentes sur les deux premiers logements.
    const fiche = i < 2 ? { ...l.fiche, guides: guidesDemo(l.id), questions: QUESTIONS_DEMO } : l.fiche;
    return { ...l, fiche, photos, tarifs: { devise: 'EUR', luLe: `${AUJOURDHUI}T06:17:00+02:00`, jours }, descriptif: descriptifDemo(l, base, i) };
  });
}

/** Démo : chaque logement près du centre de sa commune (seed-carte.ts), jamais sur une adresse réelle. */
function placer(logements: Logement[]): Logement[] {
  return logements.map((l) => {
    const position = positionDemo(l);
    return position ? { ...l, position } : l;
  });
}

/**
 * Démo : les nuits réservées sont « prises » dans le calendrier lu sur les
 * plateformes, comme chez Airbnb ; les autres restent libres, sauf une
 * nuit fermée par le propriétaire de temps en temps (prix conseillés,
 * calendrier des réservations).
 */
function calendrierReserve(logements: Logement[], reservations: Reservation[]): Logement[] {
  return logements.map((l, i) => {
    if (!l.tarifs) return l;
    const siennes = reservations.filter((r) => r.logementId === l.id && r.statut !== 'annulee');
    const jours = l.tarifs.jours.map((j, k) => ({
      ...j,
      libre: !siennes.some((r) => r.arrivee <= j.date && j.date < r.depart) && (k + i * 5) % 23 !== 7,
      // Une nuit saisie à 19 € par erreur (anomalie « prix inhabituel »).
      ...(l.id === 'log-lisses' && k === 17 ? { prixCentimes: 1900 } : {}),
    }));
    return { ...l, tarifs: { ...l.tarifs, jours } };
  });
}

/**
 * Suppléments de la démo (cahier B7) : arrivée plus tôt et départ plus tard
 * sur les logements en location, ménage supplémentaire sur les grands
 * logements, navette près des gares. Réglés par Abdel (gérant).
 */
function supplementsDemo(logements: readonly Logement[]): ReglagesSupplements {
  const blocs: ReglagesSupplements['logements'] = {};
  for (const l of logements.filter((x) => x.statut === 'actif')) {
    blocs[l.id] = {
      arrivee_anticipee: { actif: true, prixCentimes: 2000, heure: '12:00', selonPlanning: true },
      depart_tardif: { actif: true, prixCentimes: 2000, heure: '14:00', selonPlanning: true },
      ...(l.capacite >= 6 ? { menage_supplementaire: { actif: true, prixCentimes: 4500, conditions: 'À prévoir la veille' } } : {}),
      ...(['log-juvisy', 'log-massy'].includes(l.id) ? { navette: { actif: true, prixCentimes: 3000, conditions: 'Depuis la gare ou l’aéroport d’Orly' } } : {}),
    };
  }
  return { id: ID_REGLAGES_SUPPLEMENTS, logements: blocs, majLe: `${AUJOURDHUI}T08:30:00+02:00`, majPar: 'Abdel' };
}

export function creerSeed(): ErpDonnees {
  const h = creerHasard(20260924);
  const reservations = prolongationDemo(genererReservations(h));
  const missions = genererMissions(h, reservations);
  typerAvis(reservations);
  const linge = genererLinge(missions);
  const operations = genererOperations(reservations, missions, linge.ecart);
  const toutesMissions = [...missions, ...operations.missions];

  const prestataires = PRESTATAIRES.map((p) => ({
    ...p,
    missionsRealisees: toutesMissions.filter((m) => m.prestataireId === p.id && m.statut === 'validee').length,
  }));

  const recommandations = creerRecommandations();
  const ops = genererEquipeOps(reservations, operations.incidents);

  const donnees = {
    proprietaires: structuredClone(PROPRIETAIRES),
    mandats: structuredClone(MANDATS),
    logements: placer(calendrierReserve(habiller(structuredClone(LOGEMENTS)), reservations)),
    reservations,
    filsMessages: operations.filsMessages,
    missions: toutesMissions,
    prestataires: structuredClone(prestataires),
    mouvementsLinge: linge.mouvements,
    incidents: ops.incidents,
    factures: genererFactures(reservations),
    paiementsPrestataires: genererPaiements(missions),
    charges: operations.charges,
    prospects: structuredClone(PROSPECTS),
    crm: creerContactsCrm(),
    dossiers: creerDossiersDemo(),
    utilisateurs: structuredClone(UTILISATEURS),
    journal: operations.journal,
    recommandations,
    versionsAnnonce: creerVersionsAnnonce({ logements: LOGEMENTS, reservations, recommandations }),
    reglages: [{ ...REGLAGES_AGENT_DEFAUT, actif: true }, supplementsDemo(LOGEMENTS)],
    equipe: ops.equipe,
    accesOperations: ops.accesOperations,
    affectations: ops.affectations,
    absences: ops.absences,
    controles: ops.controles,
    signalementsLogement: ops.signalementsLogement,
    conseilsPrix: [],
    // Le premier message du gérant, comme on le publierait en un clic (Paramètres → Annonces à l'équipe).
    annoncesEquipe: [{ id: 'aeq-bonjour', ...premiereAnnonce(nomConciergerie(ESPACE_LABEL_MAISON)), publieeLe: `${AUJOURDHUI}T08:45:00+02:00`, publieePar: 'Abdel' }],
    actionsAgent: [] as ErpDonnees['actionsAgent'],
  };
  const complet = { ...donnees, ...creerEspaceProprietaireDemo(donnees) };
  const avecProgrammes = { ...complet, ...creerProgrammesDemo(complet) };
  // Actions de l'IA (copilote) : tirées des contacts et conversations finaux, pour que « Annuler » y marche.
  return { ...avecProgrammes, actionsAgent: creerActionsAgentDemo(avecProgrammes) };
}
