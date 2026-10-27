/**
 * Auto-contrôle de l'espace opérations (sans réseau ni navigateur) :
 *   - priorités et ordre de travail des incidents (urgents d'abord) ;
 *   - contrôles qualité proposés après un départ, échéance et retard ;
 *   - point « à revoir » → incident rattaché au logement, au séjour et au contrôle ;
 *   - absence : logements et incidents passent au remplaçant, aperçu avant
 *     confirmation, retour au titulaire après la période ;
 *   - vue d'une personne : ses logements seulement, voyageurs en « Prénom N. »,
 *     consignes d'accès le jour même ; responsable de pôle et agent de terrain ;
 *   - actions : périmètre, droits par rôle, collections écrites, photos,
 *     « ce logement n'est pas à moi », contrôle et ses incidents ;
 *   - invitation dans l'espace qui invite, session d'un genre refusée pour l'autre ;
 *   - notification « Urgence », jeu de démo.
 *
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-operations.ts --bundle --platform=node \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
 *     --outfile=/tmp/verifier-operations.cjs && node /tmp/verifier-operations.cjs
 */
import { completer } from './collections';
import { DATE_DEMO } from './format';
import { TYPES_NOTIFICATION, estActive, notificationUrgence } from './notifications';
import {
  POINTS_CONTROLE_DEFAUT,
  apercuAbsence,
  assigneLe,
  controlesAFaire,
  court,
  controlesEnRetard,
  echeanceApresDepart,
  graviteDe,
  incidentDepuisPoint,
  nouveauControle,
  pointsARevoir,
  pointsDuLogement,
  prioriteDe,
  programmeDuJour,
  responsableLe,
  suiviPar,
  trierIncidents,
  urgencesOuvertes,
  verifierAbsence,
  verifierControle,
  type DonneesOps,
} from './operations';
import { creerSeed } from './seed';
import type { Incident, Logement, Reservation } from './types';
import type { AbsenceMembre, ControleQualite } from './types-operations';
import { COLLECTIONS_OPS, appliquerAction, avecEcritures, conflitEcritures, fusionnerEcriture, fusionnerEcritures, perimetre, vueOperations, type ActionOperations, type ContexteAction, type EntreesOperations } from './espace-operations';
import { photoOperations } from './operations-fichiers';
import { inviterMembre } from './operations-acces';
import { lireSessionExterne, signerSessionExterne } from './acces-externe';
import { ID_LABEL_MAISON } from './espaces';

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}`);
  }
}
function section(titre: string) {
  console.log(`\n${titre}`);
}

const J = '2026-10-15';

/* ------------------------------------------------------------ fabriques */

const logement = (id: string, statut: Logement['statut'] = 'actif'): Logement =>
  ({ id, nom: `Logement ${id}`, statut, fiche: { heureArrivee: '16:00', heureDepart: '11:00' } }) as unknown as Logement;

const resa = (id: string, logementId: string, arrivee: string, depart: string, statut: Reservation['statut'] = 'terminee'): Reservation =>
  ({ id, logementId, arrivee, depart, statut, voyageur: { nom: `Voyageur ${id}` } }) as unknown as Reservation;

const incident = (id: string, o: Partial<Incident> = {}): Incident => ({
  id,
  logementId: 'L1',
  date: '2026-10-10',
  categorie: 'panne',
  gravite: 'moyenne',
  description: `Incident ${id}`,
  statut: 'ouvert',
  refacturable: 'aucun',
  preuves: [],
  ...o,
});

const base = (o: Partial<DonneesOps> = {}): DonneesOps => ({
  logements: [logement('L1'), logement('L2'), logement('L3'), logement('L4', 'sorti')],
  reservations: [],
  incidents: [],
  missions: [],
  equipe: [
    { id: 'A', nom: 'Alice Martin', role: 'pole', logementIds: ['L1', 'L2', 'L3'], actif: true },
    { id: 'B', nom: 'Bruno Petit', role: 'agent', logementIds: ['L1'], actif: true },
    { id: 'C', nom: 'Chloé Roux', role: 'agent', logementIds: ['L3'], actif: true },
  ],
  affectations: [
    { id: 'L1', responsableId: 'A', remplacantId: 'B' },
    { id: 'L2', responsableId: 'A' },
    { id: 'L3', responsableId: 'C', remplacantId: 'A', pointsControle: ['Propreté', ' ', 'Jacuzzi'] },
  ],
  absences: [],
  controles: [],
  ...o,
});

/* ---------------------------------------------------------- priorités */

section('Priorités et ordre de travail');
{
  verifier(prioriteDe({ gravite: 'haute' }) === 'urgente', 'gravité haute = urgent');
  verifier(prioriteDe({ gravite: 'moyenne' }) === 'normale' && prioriteDe({ gravite: 'faible' }) === 'normale', 'moyenne et faible = normal');
  verifier(graviteDe('urgente') === 'haute', 'urgent → gravité haute');
  verifier(graviteDe('normale') === 'moyenne', 'normal → gravité moyenne par défaut');
  verifier(graviteDe('normale', 'faible') === 'faible', 'normal garde une gravité faible déjà notée');
  verifier(graviteDe('normale', 'haute') === 'moyenne', 'urgent repassé en normal → moyenne');

  const liste = [
    incident('resolu-ancien', { statut: 'resolu', resoluLe: '2026-10-01', gravite: 'haute' }),
    incident('normal-vieux', { date: '2026-10-01' }),
    incident('urgent-encours', { gravite: 'haute', statut: 'en_cours', date: '2026-10-02' }),
    incident('urgent-nouveau', { gravite: 'haute', date: '2026-10-12' }),
    incident('normal-encours', { statut: 'en_cours', date: '2026-09-30' }),
    incident('resolu-recent', { statut: 'resolu', resoluLe: '2026-10-14' }),
  ];
  const ordre = trierIncidents(liste).map((i) => i.id);
  verifier(
    ordre.join(',') === 'urgent-nouveau,urgent-encours,normal-vieux,normal-encours,resolu-recent,resolu-ancien',
    `ordre : urgents (nouveaux d'abord), normaux, puis résolus du plus récent (obtenu ${ordre.join(',')})`,
  );
  verifier(urgencesOuvertes(liste).map((i) => i.id).join(',') === 'urgent-nouveau,urgent-encours', 'urgences ouvertes : ni normales ni résolues');
  verifier(liste[0].id === 'resolu-ancien', 'le tri ne modifie pas la liste d’origine');
}

/* ----------------------------------------------------- contrôles qualité */

section('Contrôles qualité après un départ');
{
  const d = base({
    reservations: [
      // L1 : départ il y a 2 jours avec arrivée le même jour → à faire ce jour-là, donc en retard.
      resa('r1', 'L1', '2026-10-10', '2026-10-13'),
      resa('r1b', 'L1', '2026-10-13', '2026-10-20', 'en_cours'),
      // L2 : départ hier sans arrivée le même jour → à faire aujourd'hui, pas en retard.
      resa('r2', 'L2', '2026-10-11', '2026-10-14'),
      // L3 : départ aujourd'hui.
      resa('r3', 'L3', '2026-10-12', J),
      // Hors fenêtre, annulée, logement sorti.
      resa('r-vieux', 'L2', '2026-10-01', '2026-10-05'),
      resa('r-annulee', 'L3', '2026-10-10', '2026-10-14', 'annulee'),
      resa('r-sorti', 'L4', '2026-10-10', '2026-10-14'),
      // Départ futur : rien encore.
      resa('r-futur', 'L2', '2026-10-15', '2026-10-18', 'confirmee'),
    ],
  });
  verifier(echeanceApresDepart(d.reservations[0], d.reservations) === '2026-10-13', 'arrivée le jour du départ : à faire le jour même');
  verifier(echeanceApresDepart(d.reservations[2], d.reservations) === '2026-10-15', 'sinon : à faire le lendemain');

  const aFaire = controlesAFaire(d, J);
  const cles = aFaire.map((c) => c.cle);
  verifier(cles.join(',') === 'depart-r1,depart-r2,depart-r3', `proposés : r1 (en retard d'abord), r2, r3 (obtenu ${cles.join(',')})`);
  verifier(aFaire[0].enRetard && !aFaire[1].enRetard && !aFaire[2].enRetard, 'seul r1 est en retard');
  verifier(!cles.some((c) => /vieux|annulee|sorti|futur/.test(c)), 'ni départ trop ancien, ni annulé, ni logement sorti, ni départ à venir');

  // Un contrôle enregistré pour le séjour remplace la proposition ; un contrôle fait la retire.
  const commence: ControleQualite = nouveauControle(d, { id: 'ctl-r2', logementId: 'L2', reservationId: 'r2', echeance: '2026-10-15' });
  const fait: ControleQualite = { ...nouveauControle(d, { id: 'ctl-r3', logementId: 'L3', reservationId: 'r3', echeance: J }), statut: 'fait' };
  const planifie: ControleQualite = nouveauControle(d, { id: 'ctl-plan', logementId: 'L2', echeance: '2026-10-12' });
  const d2 = { ...d, controles: [commence, fait, planifie] };
  const cles2 = controlesAFaire(d2, J).map((c) => c.cle);
  verifier(cles2.includes('ctl-r2') && !cles2.includes('depart-r2'), 'contrôle commencé : remplace la proposition du même séjour');
  verifier(!cles2.includes('depart-r3') && !cles2.includes('ctl-r3'), 'contrôle fait : plus à faire');
  verifier(controlesEnRetard(d2, J).map((c) => c.cle).sort().join(',') === 'ctl-plan,depart-r1', 'en retard : la proposition r1 et le contrôle planifié dépassé');

  verifier(pointsDuLogement(d, 'L1').join('|') === POINTS_CONTROLE_DEFAUT.join('|'), 'modèle par défaut : propreté, linge, consommables, équipements, état général');
  verifier(POINTS_CONTROLE_DEFAUT.join('|') === 'Propreté|Linge|Consommables|Équipements|État général', 'les cinq points du modèle');
  verifier(pointsDuLogement(d, 'L3').join('|') === 'Propreté|Jacuzzi', 'points propres au logement (vides ignorés)');
  verifier(commence.points.length === 5 && commence.points.every((p) => !p.etat) && commence.statut === 'a_faire', 'nouveau contrôle : points du logement, rien de coché');

  const rempli: ControleQualite = { ...commence, points: commence.points.map((p, k) => ({ ...p, etat: k === 1 ? undefined : 'ok' })) };
  verifier(verifierControle(rempli) === 'Un point sans réponse : OK ou À revoir.', 'un point sans réponse : refusé');
  const sansNote = { ...rempli, points: rempli.points.map((p) => ({ ...p, etat: 'ok' as const })) };
  verifier(verifierControle(sansNote) === 'Donnez une note sur 5.', 'sans note : refusé');
  verifier(verifierControle({ ...sansNote, note: 4 }) === null, 'complet avec note : accepté');
  verifier(verifierControle({ ...sansNote, note: 6 }) !== null, 'note hors de 1 à 5 : refusée');
}

/* ------------------------------------------------- à revoir → incident */

section('Point « à revoir » → incident');
{
  const c: ControleQualite = {
    id: 'ctl-1',
    logementId: 'L1',
    reservationId: 'r1',
    echeance: J,
    statut: 'a_faire',
    points: [
      { id: 'p1', libelle: 'Propreté', etat: 'a_revoir', commentaire: 'Traces sur le miroir.', photo: 'demo://controles/p1.jpg' },
      { id: 'p2', libelle: 'Linge', etat: 'a_revoir', incidentId: 'inc-deja' },
      { id: 'p3', libelle: 'Équipements', etat: 'ok' },
      { id: 'p4', libelle: 'Jacuzzi', etat: 'a_revoir' },
    ],
  };
  verifier(pointsARevoir(c).map((p) => p.id).join(',') === 'p1,p4', 'à revoir sans incident : p1 et p4 (p2 a déjà le sien)');
  const i = incidentDepuisPoint(c, c.points[0], J);
  verifier(i.logementId === 'L1' && i.reservationId === 'r1' && i.controleId === 'ctl-1', 'rattaché au logement, au séjour et au contrôle');
  verifier(i.categorie === 'menage' && i.gravite === 'moyenne', 'propreté → catégorie ménage, priorité normale');
  verifier(i.description.includes('propreté à revoir') && i.description.includes('Traces sur le miroir.'), 'description : le point et le commentaire');
  verifier(i.preuves.length === 1 && i.preuves[0] === 'demo://controles/p1.jpg', 'la photo du point devient la preuve');
  verifier(incidentDepuisPoint(c, c.points[1], J).categorie === 'linge', 'linge → catégorie linge');
  verifier(incidentDepuisPoint(c, c.points[2], J).categorie === 'panne', 'équipements → catégorie panne');
  verifier(incidentDepuisPoint(c, c.points[3], J).categorie === 'autre', 'point inconnu → autre');
}

/* ------------------------------------------------------------- absences */

section('Absences et remplaçants');
{
  const absenceA: AbsenceMembre = { id: 'abs-A', membreId: 'A', du: '2026-10-14', au: '2026-10-18', remplacantId: 'C' };
  const d = base({
    absences: [absenceA],
    incidents: [
      incident('i-L1', { assigneA: 'A', logementId: 'L1' }),
      incident('i-L2', { assigneA: 'A', logementId: 'L2', gravite: 'haute' }),
      incident('i-resolu', { assigneA: 'A', statut: 'resolu' }),
      incident('i-B', { assigneA: 'B' }),
    ],
  });

  verifier(responsableLe(d, 'L1', '2026-10-13').membreId === 'A', 'avant l’absence : le responsable');
  const l1 = responsableLe(d, 'L1', J);
  verifier(l1.membreId === 'B' && l1.remplace === 'A', 'pendant : le remplaçant du logement (B pour L1)');
  verifier(responsableLe(d, 'L2', J).membreId === 'C', 'logement sans remplaçant : celui de l’absence (C)');
  verifier(responsableLe(d, 'L1', '2026-10-19').membreId === 'A', 'après : retour au responsable habituel');
  verifier(responsableLe(d, 'L3', J).membreId === 'C', 'les logements des autres ne bougent pas');
  verifier(assigneLe(d, d.incidents[0], J).membreId === 'B' && assigneLe(d, d.incidents[1], J).membreId === 'C', 'incidents : même règle que les logements');
  verifier(assigneLe(d, d.incidents[3], J).membreId === 'B', 'incident d’un membre présent : inchangé');

  // Remplaçant absent lui aussi : on suit son propre remplaçant ; boucle : personne.
  const chaine = { ...d, absences: [absenceA, { id: 'abs-B', membreId: 'B', du: '2026-10-10', au: '2026-10-20', remplacantId: 'C' }] };
  verifier(responsableLe(chaine, 'L1', J).membreId === 'C', 'remplaçant absent : son remplaçant prend la suite');
  const boucle = { ...d, absences: [{ ...absenceA, remplacantId: 'B' }, { id: 'abs-B', membreId: 'B', du: '2026-10-10', au: '2026-10-20', remplacantId: 'A' }] };
  const s = responsableLe(boucle, 'L1', J);
  verifier(!s.membreId && s.remplace === 'A', 'tout le monde absent : personne (sans boucle infinie)');
  verifier(suiviPar(d, undefined, 'L1', J).membreId === undefined, 'sans titulaire : personne');

  const apercu = apercuAbsence({ ...d, absences: [] }, absenceA, J);
  verifier(apercu.logements.map((x) => `${x.logementId}>${x.vers}`).join(',') === 'L1>B,L2>C', `aperçu logements : L1 → B, L2 → C (obtenu ${apercu.logements.map((x) => `${x.logementId}>${x.vers}`).join(',')})`);
  verifier(apercu.incidents.map((x) => `${x.incidentId}>${x.vers}`).join(',') === 'i-L2>C,i-L1>B', 'aperçu incidents ouverts (urgents d’abord), pas les résolus');
  verifier(apercu.sansRemplacant === 0, 'aperçu : tout le monde a un remplaçant');
  const sansSecours = apercuAbsence({ ...d, absences: [] }, { ...absenceA, remplacantId: undefined }, J);
  verifier(sansSecours.sansRemplacant === 2 && !sansSecours.logements.find((x) => x.logementId === 'L2')?.vers, 'sans remplaçant d’absence : L2 et son incident sans personne');
  const futur = apercuAbsence({ ...d, absences: [] }, { ...absenceA, du: '2026-11-01', au: '2026-11-03' }, J);
  verifier(futur.logements.length === 2, 'aperçu d’une absence future : calculé au premier jour');

  verifier(verifierAbsence({ ...absenceA, id: 'n', au: '2026-10-01' }, []) === 'La fin doit être après le début.', 'dates à l’envers : refusé');
  verifier(verifierAbsence({ ...absenceA, id: 'n', remplacantId: 'A' }, []) !== null, 'se remplacer soi-même : refusé');
  verifier(verifierAbsence({ ...absenceA, id: 'n', du: '2026-10-16', au: '2026-10-25' }, [absenceA]) !== null, 'chevauchement pour la même personne : refusé');
  verifier(verifierAbsence({ ...absenceA, id: 'n', membreId: 'B' }, [absenceA]) === null, 'même période pour une autre personne : accepté');
  verifier(verifierAbsence(absenceA, [absenceA]) === null, 'modifier une absence : ne se chevauche pas elle-même');
}

/* ------------------------------------------------------- vue d'une personne */

const entrees = (o: Partial<EntreesOperations> = {}): EntreesOperations => ({
  ...base({
    logements: [
      { ...logement('L1'), fiche: { heureArrivee: '16:00', heureDepart: '11:00', acces: 'Boîte à clés, code 1234.' } } as unknown as Logement,
      logement('L2'),
      { ...logement('L3'), fiche: { heureArrivee: '15:00', heureDepart: '10:00', acces: 'Digicode 9876.' } } as unknown as Logement,
      logement('L4', 'sorti'),
      logement('L9'),
    ],
    reservations: [
      { ...resa('r-L1', 'L1', J, '2026-10-18', 'confirmee'), voyageur: { nom: 'Jean-Pierre Dupont', nbPersonnes: 3, email: 'jp@exemple.invalid', telephone: '06 00 00 00 00' } } as unknown as Reservation,
      resa('r-L3', 'L3', '2026-10-20', '2026-10-22', 'confirmee'),
      resa('r-L9', 'L9', J, '2026-10-17', 'confirmee'),
    ],
    incidents: [
      incident('i-B', { logementId: 'L1', assigneA: 'B' }),
      incident('i-A', { logementId: 'L2', assigneA: 'A', gravite: 'haute' }),
      incident('i-C', { logementId: 'L3', assigneA: 'C' }),
      incident('i-L9', { logementId: 'L9' }),
    ],
    equipe: base().equipe.map((m) => ({ ...m, email: `${m.id.toLowerCase()}@exemple.fr` })),
  }),
  signalementsLogement: [],
  ...o,
});

section('Vue d’une personne : ses logements, rien d’autre');
{
  const e = entrees();
  verifier([...perimetre(e, 'A')].sort().join() === 'L1,L2,L3' && [...perimetre(e, 'B')].join() === 'L1', 'périmètre : les logements confiés par le gérant, encore gérés');
  verifier(perimetre({ ...e, equipe: e.equipe.map((m) => (m.id === 'B' ? { ...m, actif: false } : m)) }, 'B').size === 0, 'plus dans l’équipe : plus rien');
  const vA = vueOperations(e, 'A', { aujourdhui: J })!;
  const texteA = JSON.stringify(vA);
  verifier(vA.logements.map((l) => l.id).join() === 'L1,L2,L3' && !texteA.includes('L9') && !texteA.includes('L4'), 'pôle : ni logement d’un autre périmètre, ni logement sorti');
  verifier(vA.incidents.map((i) => i.id).sort().join() === 'i-A,i-B,i-C', 'pôle : tous les incidents de ses logements');
  const sejour = vA.sejours.find((x) => x.id === 'r-L1');
  verifier(!/Dupont|jp@|06 00 00/.test(texteA) && sejour?.voyageur === 'Jean-Pierre D.' && sejour.nbPersonnes === 3, 'voyageur : « Prénom N. » et nombre de personnes, ni nom, ni contact');
  verifier(vA.logements.find((l) => l.id === 'L1')?.acces === 'Boîte à clés, code 1234.' && !vA.logements.find((l) => l.id === 'L3')?.acces, 'accès : le jour où il y a quelque chose à faire (arrivée sur L1), pas avant (L3)');
  verifier(vA.equipe.map((m) => m.id).join() === 'A,B,C' && !texteA.includes('@'), 'pôle : les personnes de ses logements, sans adresse e-mail');
  const vB = vueOperations(e, 'B', { aujourdhui: J })!;
  verifier(vB.logements.map((l) => l.id).join() === 'L1' && vB.incidents.map((i) => i.id).join() === 'i-B', 'agent : son logement et ses incidents seulement');
  verifier(vB.equipe.length === 1 && vB.absences.length === 0 && vB.affectations.length === 0, 'agent : ni équipe, ni absences, ni affectations');
  verifier(!/Chloé|L3|Digicode/.test(JSON.stringify(vB)), 'agent : rien des autres logements ni des autres personnes');
  verifier(vueOperations(e, 'Z', { aujourdhui: J }) === null, 'personne inconnue : pas de vue');
  const signe = vueOperations(
    { ...e, incidents: [incident('i-p', { logementId: 'L1', assigneA: 'B', preuves: ['stockage://erp-fichiers/operations/B/a.jpg', 'stockage://erp-fichiers/autre.jpg'] })] },
    'B',
    { aujourdhui: J, photo: (u) => (u.includes('/operations/') ? `https://signe.test/${u.slice(-5)}` : undefined) },
  )!;
  verifier(signe.incidents[0].photos.join() === 'https://signe.test/a.jpg', 'photos : liens signés seulement, les autres retirées');
}

/* ----------------------------------------------------------------- actions */

section('Actions : périmètre, droits, écritures');
{
  let n = 0;
  const ctx: ContexteAction = { aujourdhui: J, maintenant: `${J}T09:00:00.000Z`, nouvelId: (p) => `${p}-${++n}`, photoAcceptee: (u) => u.startsWith('stockage://erp-fichiers/operations/') };
  const e = entrees();
  const ecrites = new Set<string>();
  const agir = (membre: string, a: ActionOperations, x = e) => {
    const r = appliquerAction(x, membre, a, ctx);
    if (r.ok) r.ecritures.forEach((w) => ecrites.add(w.collection));
    return r;
  };
  const element = <T,>(r: ReturnType<typeof agir>, collection = r.ok ? r.ecritures[0]?.collection : undefined) =>
    (r.ok ? r.ecritures.find((w) => w.collection === collection)?.element : undefined) as T | undefined;

  let r = agir('B', { type: 'signaler', logementId: 'L3', urgent: true, description: 'Fuite d’eau sous l’évier.' });
  verifier(!r.ok && r.statut === 403, 'signaler hors de ses logements : refusé');
  r = agir('B', { type: 'signaler', logementId: 'L1', urgent: true, description: 'court' });
  verifier(!r.ok && r.statut === 400, 'description trop courte : refusée');
  r = agir('B', { type: 'signaler', logementId: 'L1', urgent: true, description: 'Fuite d’eau sous l’évier.', photos: ['https://ailleurs.test/x.jpg'] });
  verifier(!r.ok, 'photo venue d’ailleurs : refusée');
  r = agir('B', { type: 'signaler', logementId: 'L1', urgent: true, description: 'Fuite d’eau sous l’évier.', reservationId: 'r-L9', photos: ['stockage://erp-fichiers/operations/B/f.jpg'] });
  const cree = element<Incident>(r);
  verifier(r.ok && r.ecritures.length === 1 && r.ecritures[0].collection === 'incidents', 'signaler : un incident, rien d’autre');
  verifier(
    cree?.gravite === 'haute' && cree.signalePar === 'B' && cree.assigneA === 'A' && !cree.reservationId && cree.preuves.length === 1 && r.ok && r.aNotifier.includes(cree.id),
    'urgent, signalé par l’agent, confié au responsable du logement, séjour d’un autre logement ignoré, gérant prévenu',
  );

  r = agir('B', { type: 'assigner', incidentId: 'i-B', membreId: 'B' });
  verifier(!r.ok && r.statut === 403, 'agent : confier un incident, réservé au pôle');
  r = agir('B', { type: 'resoudre', incidentId: 'i-B' });
  verifier(!r.ok && r.statut === 403, 'agent : clore un incident, réservé au pôle');
  r = agir('B', { type: 'prendre', incidentId: 'i-B' });
  verifier(element<Incident>(r)?.statut === 'en_cours', 'agent : prend en charge un incident qui lui est confié');
  r = agir('B', { type: 'noter', incidentId: 'i-C', texte: 'Vu.' });
  verifier(!r.ok && r.statut === 404, 'agent : incident d’un autre logement introuvable');
  r = agir('A', { type: 'assigner', incidentId: 'i-B', membreId: 'C' });
  verifier(!r.ok, 'pôle : confier à quelqu’un qui ne suit pas le logement, refusé');
  r = agir('A', { type: 'assigner', incidentId: 'i-B', membreId: 'A' });
  verifier(element<Incident>(r)?.assigneA === 'A' && r.ok && r.aNotifier.includes('i-B'), 'pôle : confier, la personne est prévenue');
  r = agir('A', { type: 'resoudre', incidentId: 'i-A', texte: 'Plombier passé.' });
  const resolu = element<Incident>(r);
  verifier(resolu?.statut === 'resolu' && resolu.resoluLe === J && resolu.historique?.at(-1)?.texte === 'Réglé : Plombier passé.', 'pôle : clore, noté dans l’historique');
  r = agir('A', { type: 'priorite', incidentId: 'i-C', urgent: true });
  verifier(element<Incident>(r)?.gravite === 'haute' && r.ok && r.aNotifier.includes('i-C'), 'pôle : passer en urgent, l’équipe est prévenue');

  r = agir('B', { type: 'pas-a-moi', logementId: 'L1', motif: 'Je ne m’en occupe plus.' });
  verifier(r.ok && r.ecritures[0].collection === 'signalementsLogement' && element<{ statut: string }>(r)?.statut === 'ouvert', '« ce logement n’est pas à moi » : un signalement ouvert pour le gérant');
  const apres = r.ok ? avecEcritures(e, r.ecritures) : e;
  const vueApres = vueOperations(apres, 'B', { aujourdhui: J })!;
  verifier(vueApres.logements.length === 1 && vueApres.logements[0].signale === true, 'le logement reste dans son espace, marqué « signalé »');
  r = agir('B', { type: 'pas-a-moi', logementId: 'L1' }, apres);
  verifier(r.ok && r.ecritures.length === 0, 'deuxième signalement : rien de plus');

  r = agir('B', { type: 'absence', membreId: 'B', du: J, au: '2026-10-20' });
  verifier(!r.ok && r.statut === 403, 'agent : absences, réservées au pôle');
  r = agir('A', { type: 'absence', membreId: 'B', du: J, au: '2026-10-20', remplacantId: 'A' });
  const absence = element<AbsenceMembre>(r);
  verifier(absence?.membreId === 'B' && absence.remplacantId === 'A', 'pôle : absence notée avec son remplaçant');
  const avecAbsence = r.ok ? avecEcritures(e, r.ecritures) : e;
  r = agir('A', { type: 'absence-annuler', id: absence?.id ?? '' }, avecAbsence);
  verifier(!!element<AbsenceMembre>(r)?.annuleeLe, 'pôle : absence annulée (gardée pour l’historique)');
  r = agir('A', { type: 'affectation', logementId: 'L1', responsableId: 'B', remplacantId: 'C' });
  verifier(!r.ok, 'remplaçant qui ne suit pas le logement : refusé');
  r = agir('A', { type: 'affectation', logementId: 'L9', responsableId: 'A' });
  verifier(!r.ok && r.statut === 403, 'affectation hors de ses logements : refusée');
  r = agir('B', { type: 'affectation', logementId: 'L1', responsableId: 'B' });
  verifier(!r.ok && r.statut === 403, 'agent : affectations, réservées au pôle');

  const ctl = nouveauControle(e, { id: 'ctl-x', logementId: 'L1', echeance: J });
  const avecCtl = { ...e, controles: [ctl] };
  r = agir(
    'B',
    { type: 'controle', cle: 'ctl-x', points: ctl.points.map((p, k) => ({ id: p.id, etat: k === 0 ? 'a_revoir' : 'ok', ...(k === 0 ? { commentaire: 'Traces.' } : {}) })), note: 3, terminer: true, incidentsPour: ['p1'] },
    avecCtl,
  );
  const fait = element<ControleQualite>(r, 'controles');
  const issu = element<Incident>(r, 'incidents');
  verifier(fait?.statut === 'fait' && fait.parId === 'B' && fait.points[0].incidentId === issu?.id && issu?.controleId === 'ctl-x', 'contrôle : fait par l’agent, un incident relié au point à revoir');
  r = agir('B', { type: 'controle', cle: 'ctl-x', points: [], terminer: true }, avecCtl);
  verifier(!r.ok, 'contrôle incomplet : refusé');
  r = agir('B', { type: 'controle', cle: 'ctl-x', points: [{ id: 'p1', etat: 'ok', photo: 'https://ailleurs.test/p.jpg' }], terminer: false }, avecCtl);
  verifier(!r.ok, 'contrôle : photo venue d’ailleurs refusée');

  verifier(
    [...ecrites].every((c) => (COLLECTIONS_OPS as readonly string[]).includes(c)) && ['incidents', 'controles', 'absences', 'signalementsLogement'].every((c) => ecrites.has(c)),
    `collections écrites : opérations seulement, jamais réservations ni logements (${[...ecrites].join(', ')})`,
  );
}

/* ------------------------------------------------------- audit de sécurité */

section('Audit : codes d’accès, noms, absences, contrôles faits, entrées, photos, fusion');
{
  let n = 0;
  const ctx: ContexteAction = { aujourdhui: J, maintenant: `${J}T09:00:00.000Z`, nouvelId: (p) => `${p}-a${++n}`, photoAcceptee: (u) => photoOperations(u, '', 'B') };
  const acces = (e: EntreesOperations, membre: string, logementId: string, jour = J) => vueOperations(e, membre, { aujourdhui: jour })!.logements.find((l) => l.id === logementId)?.acces;

  // I1 : le code d'un logement, le jour même, à qui en a la charge (responsable ou remplaçant) ou au pôle.
  const e = entrees();
  verifier(!acces(e, 'B', 'L1'), 'I1 : agent qui n’est pas responsable du logement : pas de code le jour d’une arrivée');
  verifier(!!acces(e, 'A', 'L1'), 'I1 : le responsable (et pôle) : le code le jour de l’arrivée');
  const absenceA: AbsenceMembre = { id: 'abs-a', membreId: 'A', du: J, au: J };
  verifier(!!acces({ ...e, absences: [absenceA] }, 'B', 'L1'), 'I1 : son remplaçant, le jour où il remplace : le code');
  verifier(!acces(e, 'A', 'L1', '2026-10-14'), 'I1 : la veille de l’arrivée : pas de code');
  const enRetard = entrees({ reservations: [], controles: [nouveauControle(e, { id: 'ctl-vieux', logementId: 'L1', echeance: '2026-09-01' })] });
  verifier(!acces(enRetard, 'A', 'L1'), 'I1 : contrôle en retard depuis des semaines : pas de code tous les jours');
  const duJour = entrees({ reservations: [], controles: [nouveauControle(e, { id: 'ctl-jour', logementId: 'L3', echeance: J })] });
  verifier(!!acces(duJour, 'C', 'L3') && !acces(duJour, 'B', 'L3'), 'I1 : contrôle prévu ce jour-là : le code au responsable du logement, à lui seul');

  // Noms : adresse ou numéro jamais affichés (même règle que l'espace propriétaire).
  const masque = entrees({
    reservations: [
      { ...resa('r-mail', 'L1', J, '2026-10-18', 'confirmee'), voyageur: { nom: 'jean.dupont@gmail.com', nbPersonnes: 2 } } as unknown as Reservation,
      { ...resa('r-tel', 'L1', '2026-10-19', '2026-10-20', 'confirmee'), voyageur: { nom: '+33 6 12 34 56 78', nbPersonnes: 1 } } as unknown as Reservation,
    ],
  });
  const noms = vueOperations(masque, 'A', { aujourdhui: J })!.sejours.map((s) => s.voyageur);
  verifier(noms.join() === 'Voyageur,Voyageur', `noms : adresse et numéro deviennent « Voyageur » (obtenu ${noms.join(', ')})`);
  verifier(court('jean.dupont@gmail.com') === '' && court('Clara Dumas') === 'Clara D.', 'court() : un nom d’équipe abrégé, jamais une adresse');

  // Absences : pas pour quelqu'un qui suit aussi des logements hors du pôle ; motif jamais montré ni saisi ici.
  const avecD = entrees({ equipe: [...e.equipe, { id: 'D', nom: 'Denis Roy', role: 'agent', logementIds: ['L1', 'L9'], actif: true }] });
  let r = appliquerAction(avecD, 'A', { type: 'absence', membreId: 'D', du: J, au: '2026-10-20', remplacantId: 'B' }, ctx);
  verifier(!r.ok && r.statut === 403, 'absence d’une personne qui suit aussi des logements hors du pôle : refusée (c’est au gérant)');
  verifier(responsableLe(avecD, 'L9', J).membreId === undefined, 'L9 ne passe à personne d’autre');
  const maladie: AbsenceMembre = { id: 'abs-m', membreId: 'B', du: J, au: '2026-10-20', remplacantId: 'A', motif: 'Arrêt maladie', creeLe: J, par: 'Gérant' };
  const avecMotif = entrees({ absences: [maladie] });
  const vueA = vueOperations(avecMotif, 'A', { aujourdhui: J })!;
  verifier(vueA.absences.length === 1 && !('motif' in vueA.absences[0]) && !JSON.stringify(vueA).includes('maladie'), 'absence : le pôle voit les dates, jamais le motif');
  r = appliquerAction(avecMotif, 'A', { type: 'absence', id: 'abs-m', membreId: 'B', du: J, au: '2026-10-22', remplacantId: 'A' }, ctx);
  verifier(!r.ok && r.statut === 403, 'absence notée par le gérant : le pôle ne la change pas');
  r = appliquerAction(avecMotif, 'A', { type: 'absence-annuler', id: 'abs-m' }, ctx);
  verifier(!r.ok && r.statut === 403, 'absence notée par le gérant : le pôle ne l’annule pas');

  // Contre-audit : une absence du gérant pour quelqu'un qui a aussi un logement hors du pôle (D : L1 et L9).
  const duGerant: AbsenceMembre = { id: 'abs-g', membreId: 'D', du: J, au: '2026-10-20', remplacantId: 'B', creeLe: J, par: 'Gérant' };
  const avecDuGerant = { ...avecD, absences: [duGerant] };
  r = appliquerAction(avecDuGerant, 'A', { type: 'absence', id: 'abs-g', membreId: 'B', du: '2026-11-10', au: '2026-11-11' }, ctx);
  verifier(!r.ok && r.statut === 403, 'contre-audit : l’absence du gérant ne se réattribue pas à quelqu’un d’autre');
  r = appliquerAction(avecDuGerant, 'A', { type: 'absence-annuler', id: 'abs-g' }, ctx);
  verifier(!r.ok && r.statut === 403, 'contre-audit : l’absence du gérant ne s’annule pas depuis l’espace');
  // Même notée par un pôle (données anciennes), elle ne se change pas si la personne suit des logements hors du pôle.
  const parPoleHors: AbsenceMembre = { ...duGerant, id: 'abs-p', parMembreId: 'A' };
  r = appliquerAction({ ...avecD, absences: [parPoleHors] }, 'A', { type: 'absence', id: 'abs-p', membreId: 'B', du: J, au: J }, ctx);
  verifier(!r.ok && r.statut === 403, 'contre-audit : absence de quelqu’un qui suit des logements hors du pôle, non modifiable');
  r = appliquerAction({ ...avecD, absences: [parPoleHors] }, 'A', { type: 'absence-annuler', id: 'abs-p' }, ctx);
  verifier(!r.ok && r.statut === 403, 'contre-audit : ni annulable');
  r = appliquerAction(e, 'A', { type: 'absence', membreId: 'C', du: J, au: '2026-10-18' }, ctx);
  const absParPole = r.ok ? (r.ecritures[0].element as AbsenceMembre) : undefined;
  verifier(absParPole?.parMembreId === 'A', 'absence notée par le pôle : marquée comme telle');
  const apresPole = r.ok ? avecEcritures(e, r.ecritures) : e;
  r = appliquerAction(apresPole, 'A', { type: 'absence', id: absParPole?.id, membreId: 'C', du: J, au: '2026-10-19' }, ctx);
  verifier(r.ok && (r.ecritures[0].element as AbsenceMembre).parMembreId === 'A', 'le pôle change l’absence qu’il a notée');
  r = appliquerAction(apresPole, 'A', { type: 'absence-annuler', id: absParPole?.id ?? '' }, ctx);
  verifier(r.ok, 'et peut l’annuler');
  const vueD = vueOperations(avecD, 'A', { aujourdhui: J })!;
  verifier(vueD.equipe.find((m) => m.id === 'D')?.absenceParGerant === true && !vueD.equipe.find((m) => m.id === 'B')?.absenceParGerant, 'vue du pôle : qui se note chez le gérant (sans dire quels autres logements)');

  // Contrôle fait : ni réécrit par un autre agent, ni le lendemain ; le pôle peut, avec l'historique.
  const fait: ControleQualite = {
    ...nouveauControle(e, { id: 'ctl-f', logementId: 'L1', echeance: J }),
    statut: 'fait',
    parId: 'B',
    realiseLe: `${J}T08:00:00.000Z`,
    note: 2,
  };
  fait.points = fait.points.map((p, k) => ({ ...p, etat: k ? 'ok' : 'a_revoir', ...(k ? {} : { commentaire: 'Sale.' }) }));
  const avecFait = entrees({ equipe: avecD.equipe, controles: [fait] });
  const reecrire = (membre: string, jour = J) =>
    appliquerAction(avecFait, membre, { type: 'controle', cle: 'ctl-f', points: [{ id: 'p1', etat: 'ok', commentaire: '' }], note: 5, terminer: true }, { ...ctx, aujourdhui: jour });
  r = reecrire('D');
  verifier(!r.ok && r.statut === 403, 'contrôle fait par un autre agent : réécriture refusée');
  r = reecrire('B', '2026-10-16');
  verifier(!r.ok && r.statut === 403, 'contrôle fait : son auteur, le lendemain, refusé');
  r = reecrire('B');
  const parAuteur = r.ok ? (r.ecritures[0].element as ControleQualite) : undefined;
  verifier(parAuteur?.note === 5 && parAuteur.historique?.length === 1, 'contrôle fait : son auteur, le jour même, avec une ligne d’historique');
  // Contre-audit : « finir plus tard » sur un contrôle fait, vérifié et tracé comme le reste.
  r = appliquerAction(avecFait, 'B', { type: 'controle', cle: 'ctl-f', points: [{ id: 'p1', commentaire: 'Propre en fait.', photo: '' }], terminer: false }, ctx);
  const sansTerminer = r.ok ? (r.ecritures[0].element as ControleQualite) : undefined;
  verifier(sansTerminer?.statut === 'fait' && sansTerminer.historique?.length === 1, 'contre-audit : contrôle fait, « finir plus tard » : une ligne d’historique, toujours fait');
  r = appliquerAction(avecFait, 'B', { type: 'controle', cle: 'ctl-f', points: [{ id: 'p1', etat: undefined }], note: 0, terminer: false } as ActionOperations, ctx);
  verifier(!r.ok, 'contre-audit : contrôle fait vidé (note retirée) sans « terminer » : refusé');
  r = reecrire('A', '2026-10-20');
  const parPole = r.ok ? (r.ecritures[0].element as ControleQualite) : undefined;
  verifier(parPole?.parId === 'B' && parPole.realiseLe === fait.realiseLe && parPole.historique?.[0]?.par === 'Alice Martin', 'contrôle fait : le pôle peut, l’auteur et la date restent, l’historique dit qui');

  // Entrées mal formées : un refus, jamais une exception.
  let exception = '';
  try {
    r = appliquerAction(avecFait, 'A', { type: 'controle', cle: 'ctl-f', points: [], terminer: true, note: 3, incidentsPour: 'p1' as unknown as string[] }, ctx);
    verifier(!r.ok && r.statut === 400, 'incidentsPour qui n’est pas une liste : refus 400');
    r = appliquerAction(avecFait, 'A', { type: 'controle', cle: 'ctl-f', points: 'x' as unknown as [], terminer: false }, ctx);
    verifier(!r.ok && r.statut === 400, 'points qui ne sont pas une liste : refus 400');
    r = appliquerAction(avecFait, 'A', null as unknown as ActionOperations, ctx);
    verifier(!r.ok, 'opération absente : refusée');
    // Contre-audit : valeurs qui ne sont pas du texte (dont { toString: null }).
    const piege = { toString: null } as unknown as string;
    for (const op of [
      42,
      'x',
      { type: 'signaler', logementId: 'L1', description: piege, urgent: true },
      { type: 'signaler', logementId: 'L1', description: 'Fuite d’eau sous l’évier.', urgent: true, photos: [piege] },
      { type: 'noter', incidentId: { a: 1 } },
      { type: 'absence', membreId: ['B'], du: piege, au: piege },
      { type: 'controle', cle: piege, points: [{ id: piege, photo: piege }], note: piege, terminer: true },
      { type: 'pas-a-moi', logementId: 'L1', motif: piege },
    ]) {
      r = appliquerAction(avecFait, 'A', op as unknown as ActionOperations, ctx);
      // Refusée, ou acceptée sans la valeur piégée (un motif illisible est ignoré).
      verifier(!r.ok || r.ecritures.every((w) => !Object.values(w.element).includes(piege)), `entrée piégée, sans exception : ${JSON.stringify(op)}`);
    }
  } catch (x) {
    exception = (x as Error).message;
  }
  verifier(!exception, `entrées mal formées : aucune exception (${exception})`);

  // Photos : seulement celles déposées par cette personne, dans cet espace.
  verifier(photoOperations('stockage://erp-fichiers/operations/B/lqx1-abc123.jpg', '', 'B'), 'photo : la sienne, acceptée');
  verifier(!photoOperations('stockage://erp-fichiers/operations/Z/lqx1-abc123.jpg', '', 'B'), 'photo : celle d’un autre membre, refusée');
  verifier(!photoOperations('stockage://erp-fichiers/operations/B/lqx1-abc123.jpg', ''), 'photo : sans personne connue, refusée');
  verifier(!photoOperations('stockage://erp-fichiers/5e5e0000-0000-4000-8000-000000000002/operations/B/a.jpg', '', 'B'), 'photo : autre espace, refusée');
  verifier(!photoOperations('stockage://erp-fichiers/operations/B/../proprietaires/x.pdf', '', 'B') && !photoOperations('stockage://erp-fichiers/operations/B/x.pdf', '', 'B'), 'photo : autre dossier ou autre type de fichier, refusés');
  r = appliquerAction(e, 'B', { type: 'noter', incidentId: 'i-B', photos: ['stockage://erp-fichiers/operations/C/autre.jpg'] }, ctx);
  verifier(!r.ok, 'noter avec la photo d’un autre : refusé');

  // Fusion : une modification faite entre la lecture et l'écriture n'est pas écrasée.
  const avant = incident('i-f', { historique: [{ le: 'h0', par: 'A', texte: 'Signalé.' }] });
  const apres: Incident = { ...avant, statut: 'en_cours', historique: [...avant.historique!, { le: 'h2', par: 'B', texte: 'Pris en charge.' }] };
  const relu: Incident = { ...avant, description: 'Corrigé par le gérant.', historique: [...avant.historique!, { le: 'h1', par: 'G', texte: 'Note du gérant.' }] };
  const fusion = fusionnerEcriture(avant, apres, relu);
  verifier(
    fusion.statut === 'en_cours' && fusion.description === 'Corrigé par le gérant.' && fusion.historique?.map((h) => h.le).join() === 'h0,h1,h2',
    'fusion : champ changé repris, champ du gérant gardé, historique complété',
  );
  // Contre-audit : « prendre » un incident que le gérant vient de régler : refus, rien d'écrit.
  const pris = appliquerAction(e, 'B', { type: 'prendre', incidentId: 'i-B' }, ctx);
  const regleEntreTemps = new Map([['incidents/i-B', { ...e.incidents.find((i) => i.id === 'i-B')!, statut: 'resolu' as const, resoluLe: J }]]);
  verifier(pris.ok && /vient d’être réglé/.test(conflitEcritures(e, pris.ecritures, regleEntreTemps) ?? ''), 'contre-audit : incident réglé entre-temps, « prendre » refusé avec un message clair');
  verifier(pris.ok && conflitEcritures(e, pris.ecritures, new Map([['incidents/i-B', e.incidents.find((i) => i.id === 'i-B')!]])) === null, 'pas de conflit quand rien n’a changé entre-temps');
  const note = appliquerAction(e, 'B', { type: 'noter', incidentId: 'i-B', texte: 'Passé voir.' }, ctx);
  verifier(note.ok && conflitEcritures(e, note.ecritures, regleEntreTemps) === null, 'ajouter un mot sur un incident réglé entre-temps : pas un conflit (le statut ne change pas)');
  if (pris.ok) {
    const fusionRegle = fusionnerEcritures(e, pris.ecritures, regleEntreTemps)[0].element as Incident;
    verifier(fusionRegle.statut === 'resolu' && fusionRegle.resoluLe === J, 'fusion seule : un statut changé entre-temps reste (défense en plus du refus)');
  }
  const nouveaux = fusionnerEcritures(e, [{ collection: 'incidents', element: incident('i-neuf') }], new Map());
  verifier(nouveaux[0].element.id === 'i-neuf', 'fusion : un nouvel enregistrement s’écrit tel quel');
}

/* ---------------------------------------------------------- notifications */

section('Notification « Urgence »');
{
  const t = TYPES_NOTIFICATION.find((x) => x.type === 'urgence');
  verifier(t?.defaut === true && estActive({}, 'urgence') && !estActive({ urgence: false }, 'urgence'), 'type « Urgence » : actif par défaut, désactivable');
  verifier(notificationUrgence(incident('n'), 'Studio') === null, 'incident normal sans personne : rien');
  verifier(notificationUrgence(incident('r', { gravite: 'haute', statut: 'resolu' }), 'Studio') === null, 'incident résolu : rien');
  const u = notificationUrgence(incident('u', { gravite: 'haute' }), 'Studio Évry');
  verifier(u?.cle === 'urgence-u-personne' && u.urgente && u.variantes[0].type === 'urgence' && u.variantes[0].titre === 'Urgence · Studio Évry', 'urgent : notification immédiate « Urgence · logement »');
  verifier(u?.variantes[0].url === '/erp/logements/L1?onglet=historique', 'le toucher ouvre l’historique du logement (ses incidents)');
  const a = notificationUrgence(incident('a', { assigneA: 'B' }), 'T2', 'Bruno Petit');
  verifier(a?.cle === 'urgence-a-B' && !a.urgente && a.variantes[0].titre === 'Incident confié à Bruno P. · T2', 'confié : une notification par personne, nom abrégé');
  verifier(notificationUrgence(incident('a', { assigneA: 'C' }), 'T2', 'Chloé Roux')?.cle === 'urgence-a-C', 'confié à quelqu’un d’autre : nouvelle clé, nouvelle notification');
}

/* --------------------------------------------------------- jeu de démo */

section('Jeu de démo et intégration');
{
  const s = creerSeed();
  verifier(s.equipe.length === 3 && s.equipe.every((m) => /^06 39 98 /.test(m.telephone ?? '') && /@exemple\.fr$/.test(m.email ?? '')), '3 membres fictifs, numéros et adresses réservés à la fiction');
  verifier(s.equipe.filter((m) => m.role === 'pole').length === 1 && s.accesOperations.length === 2 && s.signalementsLogement.length === 1, 'démo : une responsable de pôle, deux accès, un « pas à moi »');
  verifier(s.absences.length === 1 && !!s.absences[0].remplacantId, '1 absence avec son remplaçant');
  verifier(s.controles.length === 2 && controlesEnRetard(s, DATE_DEMO).filter((c) => c.controle).length === 1, '2 contrôles enregistrés, dont 1 en retard');
  const nouveaux = s.incidents.filter((i) => i.id === 'inc-12' || i.id === 'inc-13');
  verifier(nouveaux.length === 2 && nouveaux.filter((i) => i.gravite === 'haute').length === 1, '2 incidents de plus, dont 1 urgent');
  verifier(s.incidents.find((i) => i.id === 'inc-13')?.controleId === 'ctl-01' && s.controles[0].points.some((p) => p.incidentId === 'inc-13'), 'le point à revoir du contrôle fait est relié à son incident');
  const absente = s.absences[0];
  const repris = s.affectations.filter((a) => a.responsableId === absente.membreId).map((a) => responsableLe(s, a.id, DATE_DEMO));
  verifier(repris.length > 0 && repris.every((r) => r.membreId && r.membreId !== absente.membreId && r.remplace === absente.membreId), 'démo : les logements de la personne absente sont suivis par un remplaçant');
  verifier(s.incidents.every((i) => !i.assigneA || s.equipe.some((m) => m.id === i.assigneA)), 'chaque incident confié l’est à un membre existant');

  const p = programmeDuJour(s, DATE_DEMO);
  verifier(p.some((e) => e.type === 'depart') && p.some((e) => e.type === 'arrivee') && p.some((e) => e.type === 'controle'), 'programme du jour : départs, arrivées et contrôles');
  const horaires = p.filter((e) => e.heure).map((e) => Number(e.heure!.slice(0, 2)) * 60 + Number(e.heure!.slice(3, 5)));
  verifier(horaires.every((m, k) => k === 0 || horaires[k - 1] <= m), 'programme du jour : dans l’ordre des heures');
  const premierControle = p.findIndex((e) => e.type === 'controle');
  verifier(premierControle > p.findIndex((e) => e.type === 'depart') && premierControle < p.findIndex((e) => e.type === 'arrivee'), 'les contrôles se placent après les départs, avant les arrivées');
  verifier(p.filter((e) => e.type === 'controle').every((e) => e.controle && !e.controle.enRetard), 'programme : les contrôles pas encore en retard (les retards ont leur propre liste)');

  const ancienne = completer({ ...s, equipe: undefined, affectations: undefined, absences: undefined, controles: undefined } as never);
  verifier([ancienne.equipe, ancienne.affectations, ancienne.absences, ancienne.controles].every((c) => Array.isArray(c) && c.length === 0), 'ancienne sauvegarde : les nouvelles collections arrivent vides');
  verifier(controlesAFaire(ancienne, DATE_DEMO).length > 0 && programmeDuJour(ancienne, DATE_DEMO).length > 0, 'sans équipe : contrôles proposés et programme quand même');

  // Accueil « À faire » : mêmes règles (urgencesOuvertes, controlesEnRetard).
  verifier(urgencesOuvertes(s.incidents).length >= 1 && controlesEnRetard(s, DATE_DEMO).length >= 1, 'Accueil « À faire » : au moins une urgence et un contrôle en retard dans la démo');
}

/* --------------------------------------------------- invitation et session */

async function invitationEtSession() {
  section('Invitation dans l’espace qui invite, session par genre');
  const AUTRE = '4c4d0000-0000-4000-8000-0000000000aa';
  const a = inviterMembre(undefined, { membreId: 'eq-1', espace: AUTRE, email: ' Agent@Exemple.fr ', par: 'g', maintenantMs: 0 });
  verifier(a.id === 'eq-1' && a.espace === AUTRE && a.email === 'agent@exemple.fr' && a.statut === 'invite' && a.version === 1, 'invitation : rangée dans l’espace du gérant, adresse en minuscules');
  verifier(inviterMembre(undefined, { membreId: 'eq-2', email: 'x@exemple.fr', par: 'g', maintenantMs: 0 }).espace === ID_LABEL_MAISON, 'sans espace (base d’avant) : Label Maison');
  const autre = inviterMembre({ ...a, statut: 'actif' }, { membreId: 'eq-1', espace: AUTRE, email: 'autre@exemple.fr', par: 'g', maintenantMs: 1 });
  verifier(autre.version === 2 && autre.statut === 'invite' && autre.liens.length === 0, 'autre adresse : sessions fermées, liens oubliés');

  const secret = 'secret-de-test-operations-0123456789-abcdef';
  const cookie = await signerSessionExterne(secret, { k: 'operations', p: 'eq-1', e: AUTRE, v: 1, exp: 2_000_000_000 });
  verifier((await lireSessionExterne(secret, cookie, 'operations', 1_000))?.e === AUTRE, 'session opérations lue avec son espace');
  verifier((await lireSessionExterne(secret, cookie, 'proprietaire', 1_000)) === null, 'session opérations refusée côté propriétaire');
  const proprio = await signerSessionExterne(secret, { k: 'proprietaire', p: 'pro-1', e: ID_LABEL_MAISON, v: 1, exp: 2_000_000_000 });
  verifier((await lireSessionExterne(secret, proprio, 'operations', 1_000)) === null, 'session propriétaire refusée côté opérations');
}

invitationEtSession().then(() => {
  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
});
