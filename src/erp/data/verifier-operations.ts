/**
 * Auto-contrôle de l'espace Opérations (sans réseau ni navigateur) :
 *   - priorités et ordre de travail des incidents (urgents d'abord) ;
 *   - contrôles qualité proposés après un départ, échéance et retard ;
 *   - point « à revoir » → incident rattaché au logement, au séjour et au contrôle ;
 *   - absence : logements et incidents passent au remplaçant, aperçu avant
 *     confirmation, retour au titulaire après la période ;
 *   - droits par rôle, cinquième onglet du téléphone ;
 *   - notification « Urgence », jeu de démo, recherche.
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
  cinquiemeOnglet,
  controlesAFaire,
  controlesEnRetard,
  droitsOperations,
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
import type { AbsenceMembre, ControleQualite, Incident, Logement, Reservation } from './types';
import { construireIndex } from '../layout/recherche/moteur';

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
    { id: 'A', nom: 'Alice Martin', role: 'superviseur', actif: true },
    { id: 'B', nom: 'Bruno Petit', role: 'technicien', actif: true },
    { id: 'C', nom: 'Chloé Roux', role: 'accueil', actif: true },
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

/* ----------------------------------------------------------------- droits */

section('Droits par rôle et barre du téléphone');
{
  verifier(JSON.stringify(droitsOperations('gerant')) === '{"voir":true,"agir":true}', 'gérant : voit et agit');
  verifier(JSON.stringify(droitsOperations('operations')) === '{"voir":true,"agir":true}', 'opérations : voit et agit');
  verifier(JSON.stringify(droitsOperations('lecture')) === '{"voir":true,"agir":false}', 'lecture seule : consulte seulement');
  verifier(JSON.stringify(droitsOperations('prestataire')) === '{"voir":false,"agir":false}', 'prestataire : pas d’accès');
  verifier(!droitsOperations('gerant', true).agir, 'compte en lecture seule : rien ne s’écrit');
  verifier(cinquiemeOnglet('operations') === 'operations' && cinquiemeOnglet('gerant') === 'crm' && cinquiemeOnglet('lecture') === 'crm', '5ᵉ onglet : Opérations pour le rôle opérations, CRM sinon');
  verifier(cinquiemeOnglet('gerant', 'operations') === 'operations' && cinquiemeOnglet('operations', 'crm') === 'crm', 'le choix de l’appareil l’emporte');
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
  verifier(u?.variantes[0].url === '/erp/operations/incidents?id=u', 'le toucher ouvre l’incident');
  const a = notificationUrgence(incident('a', { assigneA: 'B' }), 'T2', 'Bruno Petit');
  verifier(a?.cle === 'urgence-a-B' && !a.urgente && a.variantes[0].titre === 'Incident confié à Bruno P. · T2', 'confié : une notification par personne, nom abrégé');
  verifier(notificationUrgence(incident('a', { assigneA: 'C' }), 'T2', 'Chloé Roux')?.cle === 'urgence-a-C', 'confié à quelqu’un d’autre : nouvelle clé, nouvelle notification');
}

/* --------------------------------------------------------- jeu de démo */

section('Jeu de démo et intégration');
{
  const s = creerSeed();
  verifier(s.equipe.length === 3 && s.equipe.every((m) => /^06 39 98 /.test(m.telephone ?? '')), '3 membres fictifs, numéros réservés à la fiction');
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
  const index = construireIndex(s);
  verifier(index.some((e) => e.type === 'membre' && e.to.startsWith('/erp/operations/equipe')), 'recherche : l’équipe');
  verifier(index.filter((e) => e.type === 'incident').every((e) => e.to.startsWith('/erp/operations/incidents?id=')), 'recherche : les incidents ouvrent l’espace Opérations');
}

console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
(globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
