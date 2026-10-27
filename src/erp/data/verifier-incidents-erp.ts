/**
 * Auto-contrôle des incidents côté ERP (sans réseau ni navigateur) :
 *   - un incident signalé depuis l'espace opérations remonte dans le « À faire »
 *     de l'accueil et sur la fiche du logement, avec un lien qui le montre ;
 *   - « Je m’en occupe », « Marquer réglé », « Ajouter un mot » du gérant ;
 *   - « Ce logement n’est pas à moi » remonte dans le « À faire » ;
 *   - la notification « Urgence » ouvre la fiche, l'incident en vue ;
 *   - remplaçant d'une absence : seulement quelqu'un qui suit déjà ses logements.
 *
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-incidents-erp.ts --bundle --platform=node \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
 *     --outfile=/tmp/verifier-incidents-erp.mjs --format=esm && node /tmp/verifier-incidents-erp.mjs
 */
import { construireATraiter } from '../modules/tableau-de-bord/_composants/aTraiter.js';
import { DATE_DEMO } from './format';
import { ajouterMot, incidentsATraiter, incidentsDuLogement, lienIncident, marquerRegle, prendreEnCharge } from './incidents-erp';
import { LIBELLES } from './libelles';
import { notificationUrgence } from './notifications';
import type { DonneesOps } from './operations';
import { appliquerAction, avecEcritures, remplacantsPossibles, type ContexteAction, type EntreesOperations } from './espace-operations';
import { creerSeed } from './seed';
import type { ErpDonnees, Incident, Logement } from './types';

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

let n = 0;
const ctx: ContexteAction = { aujourdhui: DATE_DEMO, maintenant: `${DATE_DEMO}T09:00:00.000Z`, nouvelId: (p) => `${p}-test-${++n}` };

section('Incident signalé depuis l’espace opérations → visible dans l’ERP');
{
  const d0 = creerSeed();
  const sansIncidents: ErpDonnees = { ...d0, incidents: [], signalementsLogement: [] };
  verifier(!construireATraiter(sansIncidents, DATE_DEMO).some((e) => e.type === 'urgence' || e.type === 'incident'), 'sans incident : aucune ligne d’incident dans le « À faire »');

  const r = appliquerAction(sansIncidents as unknown as EntreesOperations, 'eq-yanis', { type: 'signaler', logementId: 'log-massy', urgent: true, description: 'Fuite d’eau sous l’évier de la cuisine.' }, ctx);
  verifier(r.ok, `Yanis signale une urgence à Massy (${r.ok ? 'ok' : r.erreur})`);
  if (r.ok) {
    const d = avecEcritures(sansIncidents as unknown as EntreesOperations, r.ecritures) as unknown as ErpDonnees;
    const cree = d.incidents.find((i) => i.id === r.id)!;
    verifier(!!cree && cree.logementId === 'log-massy' && cree.gravite === 'haute' && cree.signalePar === 'eq-yanis', 'l’incident est écrit dans la collection de l’ERP (urgent, signalé par Yanis)');

    const afaire = construireATraiter(d, DATE_DEMO);
    const urgence = afaire.find((e) => e.type === 'urgence');
    verifier(urgence?.titre === 'Une urgence signalée' && urgence.ton === 'danger' && urgence.priorite === 1, '« À faire » : « Une urgence signalée », en rouge, pour aujourd’hui');
    verifier(urgence?.to === `/erp/logements/log-massy?incident=${encodeURIComponent(cree.id)}`, '« À faire » : la ligne ouvre la fiche du logement, l’incident en vue');
    verifier(!!urgence?.details[0].includes('Fuite d’eau'), '« À faire » : le détail dit le logement et ce qui se passe');
    verifier(afaire[0]?.type === 'urgence' || afaire[0]?.priorite === 1, 'l’urgence est parmi les premières lignes');

    const fiche = incidentsDuLogement(d, 'log-massy');
    verifier(fiche.ouverts.map((i) => i.id).includes(cree.id) && !fiche.regles.length, 'fiche du logement : l’incident est dans « Incidents ouverts »');
    verifier(!incidentsDuLogement(d, 'log-paris14').ouverts.some((i) => i.id === cree.id), 'fiche d’un autre logement : rien');

    const notif = notificationUrgence(cree, 'Massy Atlantis');
    verifier(notif?.variantes[0].url === lienIncident(cree), 'la notification « Urgence » ouvre la fiche, l’incident en vue (même lien)');

    // Le gérant agit depuis l'ERP : mêmes mots que l'espace opérations.
    const le = `${DATE_DEMO}T10:00:00.000Z`;
    const pris = prendreEnCharge(cree, 'Abdel', le);
    verifier(pris.statut === 'en_cours' && LIBELLES.statutIncident[pris.statut] === 'On s’en occupe' && pris.historique?.at(-1)?.texte === 'Pris en charge.' && pris.historique?.at(-1)?.par === 'Abdel', '« Je m’en occupe » : « On s’en occupe », avec une ligne d’historique');
    verifier(prendreEnCharge(pris, 'Abdel', le) === pris, '« Je m’en occupe » deux fois : rien ne change');
    const mot = ajouterMot(pris, 'Abdel', le, '  Plombier prévenu, passage demain.  ');
    verifier(mot.statut === 'en_cours' && mot.historique?.at(-1)?.texte === 'Plombier prévenu, passage demain.', '« Ajouter un mot » : une ligne, le statut ne change pas');
    verifier(ajouterMot(pris, 'Abdel', le, '   ') === pris, 'mot vide : rien ne change');
    const regle = marquerRegle(mot, 'Abdel', le);
    verifier(regle.statut === 'resolu' && regle.resoluLe === DATE_DEMO && LIBELLES.statutIncident.resolu === 'Réglé', '« Marquer réglé » : « Réglé », daté du jour');
    const apres = { ...d, incidents: d.incidents.map((i) => (i.id === regle.id ? regle : i)) };
    verifier(!construireATraiter(apres, DATE_DEMO).some((e) => e.type === 'urgence'), 'réglé : la ligne d’urgence disparaît du « À faire »');
    verifier(incidentsDuLogement(apres, 'log-massy').regles.some((i) => i.id === regle.id), 'réglé : il passe dans « Voir les réglés »');
  }

  const normal: Incident = { id: 'inc-normal', logementId: 'log-soisy', date: DATE_DEMO, categorie: 'casse', gravite: 'moyenne', description: 'Verre cassé', statut: 'ouvert', refacturable: 'aucun', preuves: [] };
  const avecNormal = { ...sansIncidents, incidents: [normal] };
  const ligne = construireATraiter(avecNormal, DATE_DEMO).find((e) => e.type === 'incident');
  verifier(ligne?.titre === 'Un incident ouvert' && ligne.ton === 'alerte' && ligne.priorite === 2, 'incident normal : « Un incident ouvert », pas en rouge');
  verifier(incidentsATraiter(avecNormal).urgences.length === 0, 'incident normal : pas une urgence');
}

section('Mots et couleurs alignés sur l’espace opérations');
{
  verifier(LIBELLES.gravite.haute === 'Urgent', 'gravité haute : « Urgent », comme l’espace opérations');
  verifier(LIBELLES.statutIncident.ouvert === 'Nouveau', 'statut : « Nouveau »');
}

section('« Ce logement n’est pas à moi » → « À faire »');
{
  const d0 = creerSeed();
  const signale: ErpDonnees = {
    ...d0,
    signalementsLogement: [{ id: 'sig-1', logementId: 'log-linas', membreId: 'eq-yanis', le: `${DATE_DEMO}T08:00:00.000Z`, statut: 'ouvert' }],
  };
  const l = construireATraiter(signale, DATE_DEMO).find((e) => e.type === 'signalement');
  verifier(l?.to === '/erp/parametres/acces' && l.titre === 'Un logement signalé « pas à moi »', '« pas à moi » ouvert : une ligne qui mène à Accès');
  verifier(!!l?.details[0].startsWith('Yanis Lefort'), 'le détail dit qui l’a signalé');
  const traite = { ...signale, signalementsLogement: [{ ...signale.signalementsLogement[0], statut: 'traite' as const }] };
  verifier(!construireATraiter(traite, DATE_DEMO).some((e) => e.type === 'signalement'), 'traité : la ligne disparaît');
}

section('Remplaçant d’une absence : quelqu’un qui suit déjà ses logements');
{
  const logement = (id: string): Logement => ({ id, nom: `Logement ${id}`, statut: 'actif' }) as unknown as Logement;
  const base: DonneesOps & { signalementsLogement: [] } = {
    logements: [logement('L1'), logement('L2'), logement('L3')],
    reservations: [],
    incidents: [],
    missions: [],
    equipe: [
      { id: 'A', nom: 'Alice Martin', role: 'pole', logementIds: ['L1', 'L2', 'L3'], actif: true },
      { id: 'B', nom: 'Bruno Petit', role: 'agent', logementIds: ['L1', 'L2'], actif: true },
      { id: 'C', nom: 'Chloé Roux', role: 'agent', logementIds: ['L3'], actif: true },
      { id: 'D', nom: 'Dina Faure', role: 'agent', logementIds: ['L1'], actif: true },
    ],
    affectations: [
      { id: 'L1', responsableId: 'B' },
      { id: 'L2', responsableId: 'B' },
      { id: 'L3', responsableId: 'C', remplacantId: 'A' },
    ],
    absences: [],
    controles: [],
    signalementsLogement: [],
  };
  const pourB = remplacantsPossibles(base, 'B').sort();
  verifier(pourB.join(',') === 'A', `absence de Bruno (L1, L2 sans remplaçant propre) : seule Alice suit les deux (obtenu ${pourB.join(',')})`);
  verifier(!remplacantsPossibles(base, 'B').includes('D'), 'Dina ne suit que L1 : elle ne verrait pas L2, donc pas proposée');
  const pourC = remplacantsPossibles(base, 'C').sort();
  verifier(pourC.join(',') === 'A', `absence de Chloé (L3 a déjà un remplaçant) : quelqu’un qui partage un logement (obtenu ${pourC.join(',')})`);

  const e = base as unknown as EntreesOperations;
  const refuse = appliquerAction(e, 'A', { type: 'absence', membreId: 'B', du: DATE_DEMO, au: '2026-09-30', remplacantId: 'D' }, ctx);
  verifier(!refuse.ok && refuse.erreur === 'Choisissez un remplaçant qui suit déjà ses logements.', 'serveur : un remplaçant qui ne suit pas ses logements est refusé');
  const accepte = appliquerAction(e, 'A', { type: 'absence', membreId: 'B', du: DATE_DEMO, au: '2026-09-30', remplacantId: 'A' }, ctx);
  verifier(accepte.ok, `serveur : un remplaçant qui suit ses logements est accepté (${accepte.ok ? 'ok' : accepte.erreur})`);
}

console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
(globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
