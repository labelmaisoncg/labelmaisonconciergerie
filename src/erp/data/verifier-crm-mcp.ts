/**
 * Vérification du connecteur Claude (MCP) : protocole JSON-RPC, outils du CRM
 * (crm-mcp.ts) et du channel manager (cm-mcp.ts), sur des données en mémoire
 * (jeu de démonstration ; aucune base, aucun réseau).
 *
 * Lancement :
 *   node_modules/.bin/esbuild src/erp/data/verifier-crm-mcp.ts --bundle --platform=node \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-crm-mcp.cjs \
 *     && node /tmp/verifier-crm-mcp.cjs
 */
import { INSTRUCTIONS_SERVEUR, OUTILS, instructionsServeur, outilsDeLEspace, traiterMcp, type ContexteMcp } from './crm-mcp';
import { ID_LABEL_MAISON } from './espaces';
import { avecEspace, espaceDuJeton } from './oauth-regles';
import { attendEquipe, prenomInitiale } from './cm-mcp';
import { creerContactsCrm } from './seed-crm';
import { creerSeed } from './seed';
import { fenetreJours } from './selectors';
import { mesurer as mesurerAccueil } from '../modules/tableau-de-bord/_composants/calculs';
import type { ContactCrm, FilMessages } from './types';
import type { ActionAgent } from './types-copilote';

let ok = 0;
let ko = 0;
function verifier(condition: boolean, libelle: string) {
  if (condition) ok++;
  else {
    ko++;
    console.log(`  ✗ ${libelle}`);
  }
}

const base = new Map<string, ContactCrm>(creerContactsCrm().map((c) => [c.id, c]));
let ecritures = 0;
// Channel manager : jeu de démonstration (date du jour 2026-09-24) et une conversation piège
// (e-mail, téléphone, code wifi et code d'accès dans les messages).
const seed = creerSeed();
const logementPiege = seed.logements.find((l) => l.fiche?.wifiCode)!;
logementPiege.fiche = { ...logementPiege.fiche, acces: 'Boîte à clés, code 4821.' };
const filPiege: FilMessages = {
  id: 'fil-piege',
  logementId: logementPiege.id,
  canal: 'airbnb',
  voyageur: 'Marie-Claire Dupont',
  statut: 'ouvert',
  traitePar: 'en_attente',
  dernierMessageLe: '2026-09-24T09:00:00+02:00',
  messages: [
    { id: 'p1', auteur: 'hote', texte: `Le wifi : ${logementPiege.fiche.wifiCode}, la boîte : 4821.`, envoyeLe: '2026-09-23T18:00:00+02:00' },
    { id: 'p2', auteur: 'voyageur', texte: 'Merci ! Écrivez-moi à marie.dupont@exemple.fr ou au 06 12 34 56 78 (ou +33 6 12 34 56 78).', envoyeLe: '2026-09-24T09:00:00+02:00' },
  ],
};
const fils = new Map<string, FilMessages>([...seed.filsMessages, filPiege].map((f) => [f.id, f]));
let ecrituresFils = 0;
// Traces des actions de Claude (copilote.ts) : chaque écriture doit en avoir une.
const traces = new Map<string, ActionAgent>();
const ctx: ContexteMcp = {
  depot: {
    tous: async () => [...base.values()].map((c) => structuredClone(c)),
    un: async (id) => (base.has(id) ? structuredClone(base.get(id)!) : undefined),
    enregistrer: async (c) => {
      ecritures++;
      base.set(c.id, structuredClone(c));
    },
  },
  cm: {
    logements: async () => structuredClone(seed.logements),
    reservations: async () => structuredClone(seed.reservations),
    fils: async () => [...fils.values()].map((f) => structuredClone(f)),
    fil: async (id) => (fils.has(id) ? structuredClone(fils.get(id)!) : undefined),
    enregistrerFil: async (f) => {
      ecrituresFils++;
      fils.set(f.id, structuredClone(f));
    },
  },
  actions: {
    enregistrer: async (a) => {
      traces.set(a.id, structuredClone(a));
    },
  },
  aujourdhui: () => '2026-09-24',
  maintenant: () => '2026-09-24T15:00:00+02:00',
};

let n = 0;
async function appel(method: string, params?: Record<string, unknown>) {
  const r = await traiterMcp({ jsonrpc: '2.0', id: ++n, method, ...(params ? { params } : {}) }, ctx);
  return r.statut === 200 ? (r.corps as { result?: any; error?: { code: number; message: string } }) : { statut: r.statut };
}
async function outil(name: string, args: Record<string, unknown> = {}) {
  const r = await appel('tools/call', { name, arguments: args });
  const res = (r as { result: { content: { text: string }[]; structuredContent?: any; isError?: boolean } }).result;
  return { erreur: !!res.isError, texte: res.content[0].text, donnees: res.structuredContent };
}

async function main() {
  // Protocole
  const init = await appel('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  verifier((init as any).result?.protocolVersion === '2025-06-18' && !!(init as any).result?.capabilities?.tools, 'initialize : version reprise, outils annoncés');
  verifier(/CRM d'appels/.test((init as any).result?.instructions ?? '') && /cm_resume/.test((init as any).result?.instructions ?? ''), 'initialize : instructions en français pour Claude (CRM et channel manager)');
  verifier((init as any).result?.serverInfo?.name === 'label-maison' && (init as any).result?.serverInfo?.title === 'Label Maison' && (init as any).result?.serverInfo?.version === '2.1.0', 'serveur « Label Maison » 2.1.0 (copilote)');
  const inconnue = await appel('initialize', { protocolVersion: '2099-01-01' });
  verifier((inconnue as any).result?.protocolVersion === '2025-06-18', 'version inconnue : le serveur propose la sienne');
  const notif = await traiterMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx);
  verifier(notif.statut === 202, 'notification : 202 sans corps');
  verifier((await traiterMcp({ id: 1, method: 'ping' }, ctx)).statut === 400, 'message sans jsonrpc 2.0 : 400');
  verifier(((await appel('ping')) as any).result !== undefined, 'ping');
  verifier(((await appel('n/importe')) as any).error?.code === -32601, 'méthode inconnue : -32601');
  const lot = await traiterMcp([{ jsonrpc: '2.0', id: 'a', method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/x' }], ctx);
  verifier(lot.statut === 200 && Array.isArray((lot as any).corps) && (lot as any).corps.length === 1, 'lot : une réponse par requête, notifications ignorées');

  const liste = (await appel('tools/list')) as any;
  const noms = liste.result.tools.map((t: { name: string }) => t.name);
  const NOUVEAUX = 'cm_resume,logements_lister,logement_voir,reservations_periode,reservation_voir,conversations_a_repondre,conversation_voir,conversation_pas_besoin_de_repondre,reponse_preparer,indicateurs';
  const COPILOTE = 'reponse_proposer,menage_creer,facture_preparer,prix_conseils';
  verifier(noms.join() === `crm_resume,crm_chercher,crm_voir,crm_ajouter,crm_modifier,crm_noter_appel,${NOUVEAUX},${COPILOTE}`, `6 outils du CRM gardés, puis 10 du channel manager, puis 4 du copilote (${noms.join(', ')})`);
  verifier(!noms.some((x: string) => /envoy|send|message_envoyer/.test(x)), 'aucun outil d’envoi aux voyageurs');
  verifier(liste.result.tools.every((t: any) => t.inputSchema?.type === 'object' && t.description && typeof t.annotations?.readOnlyHint === 'boolean'), 'chaque outil : schéma, description, annotations');
  verifier(!noms.some((x: string) => /suppr|delete/.test(x)), 'aucun outil de suppression');
  verifier(
    OUTILS.filter((o) => !o.annotations.readOnlyHint).map((o) => o.name).join() === 'crm_ajouter,crm_modifier,crm_noter_appel,conversation_pas_besoin_de_repondre,reponse_proposer,menage_creer,facture_preparer',
    'lecture seule bien signalée (écritures : CRM, « pas besoin de répondre », réponse proposée, ménage interne, brouillon de facture ; prix conseillés en lecture)',
  );

  // Lecture
  const avantLecture = ecritures;
  const r = await outil('crm_resume');
  verifier(!r.erreur && r.donnees.total === 8 && r.donnees.par_etape['À appeler'] === 2, 'résumé : total et compte par étape');
  verifier(r.donnees.a_appeler_aujourdhui === 3 && r.donnees.liste_du_jour.some((c: any) => c.nom === 'Julie Moreau'), 'résumé : à appeler aujourd’hui (nouvelles + relance du jour)');
  const parTel = await outil('crm_chercher', { recherche: '+33 6 00 00 00 05' });
  verifier(parTel.donnees.total === 1 && parTel.donnees.contacts[0].nom === 'Nadia Haddad', 'recherche par téléphone au format +33');
  const parEtape = await outil('crm_chercher', { statuts: ['signe', 'pas_interesse'] });
  verifier(parEtape.donnees.total === 2, 'filtre par étapes');
  const page = await outil('crm_chercher', { limite: 3 });
  verifier(page.donnees.renvoyes === 3 && page.donnees.suite === 3, 'pagination : limite et suite');
  const voir = await outil('crm_voir', { id: 'crm-demo-03' });
  verifier(voir.donnees.historique.length === 3 && voir.donnees.appels_sans_reponse === 2 && /erp\/crm\?contact=crm-demo-03/.test(voir.donnees.lien_erp), 'fiche : historique, tentatives, lien ERP');
  verifier(ecritures === avantLecture, 'les outils de lecture n’écrivent rien');

  // Écriture
  const doublon = await outil('crm_ajouter', { nom: 'Sophie M.', telephone: '06 00 00 00 01' });
  verifier(!doublon.erreur && doublon.donnees.cree === false && doublon.donnees.contact.id === 'crm-demo-01', 'ajout d’un doublon : rien créé, fiche existante renvoyée');
  const ajout = await outil('crm_ajouter', { nom: 'Paul Nouveau', telephone: '0611223344', ville: 'Lisses', suivi_par: 'kamel', relance_le: '2026-09-25' });
  verifier(ajout.donnees.cree === true && ajout.donnees.contact.statut === 'a_appeler' && ajout.donnees.contact.suivi_par === 'kamel' && base.size === 9, 'ajout : « À appeler », suivi et relance');
  verifier((await outil('crm_ajouter', { nom: 'Sans moyen' })).erreur, 'ajout sans téléphone ni e-mail refusé');
  const id = ajout.donnees.contact.id as string;

  const appelPasJoint = await outil('crm_noter_appel', { id, resultat: 'pas_de_reponse', relance_le: '2026-09-26' });
  verifier(appelPasJoint.donnees.etape === 'À rappeler' && base.get(id)!.tentatives === 1 && base.get(id)!.relanceLe === '2026-09-26', 'appel sans réponse : « À rappeler », tentative, relance');
  const appelJoint = await outil('crm_noter_appel', { id, resultat: 'joint', texte: 'Visite à prévoir' });
  verifier(appelJoint.donnees.etape === 'Contacté' && base.get(id)!.historique[0].texte === 'Visite à prévoir', 'appel joint : « Contacté », texte gardé');

  const modif = await outil('crm_modifier', { id, statut: 'en_attente', en_attente_de: 'Travaux', relance_le: '', ajouter_note: 'Rappeler en décembre', suivi_par: '' });
  const apres = base.get(id)!;
  verifier(!modif.erreur && apres.statut === 'en_attente' && apres.motifAttente === 'Travaux' && apres.relanceLe === undefined && apres.responsable === undefined, 'modifier : étape, motif, relance et suivi effacés');
  verifier(apres.historique.some((t) => t.texte === 'Rappeler en décembre') && apres.historique.some((t) => /Contacté → En attente/.test(t.texte ?? '')), 'modifier : note et changement d’étape dans l’historique');
  verifier(apres.historique[0].par === 'Claude', 'traces signées « Claude »');

  // Erreurs utiles
  const mauvaiseDate = await outil('crm_modifier', { id, relance_le: '26/09/2026' });
  verifier(mauvaiseDate.erreur && /AAAA-MM-JJ/.test(mauvaiseDate.texte), 'date invalide : message clair');
  const mauvaisId = await outil('crm_voir', { id: 'inconnu' });
  verifier(mauvaisId.erreur && /crm_chercher/.test(mauvaisId.texte), 'id inconnu : renvoie vers crm_chercher');
  const mauvaisStatut = await outil('crm_modifier', { id, statut: 'gagne' });
  verifier(mauvaisStatut.erreur && /a_appeler/.test(mauvaisStatut.texte), 'étape inconnue : liste des étapes valides');
  verifier((await outil('crm_modifier', { id, nom: '' })).erreur, 'nom vidé refusé');
  verifier((await outil('crm_voir', { id: 'x),collection.eq.journal' })).erreur, 'identifiant hors format refusé avant la base');
  await outil('crm_modifier', { id, notes: 'Première version' });
  await outil('crm_modifier', { id, notes: 'Seconde version' });
  verifier(base.get(id)!.notes === 'Seconde version' && base.get(id)!.historique.some((t) => /Ancienne version : Première version/.test(t.texte ?? '')), 'notes remplacées : ancienne version gardée dans l’historique');
  const longues = 'x'.repeat(3000);
  await outil('crm_modifier', { id, notes: longues });
  await outil('crm_modifier', { id, notes: 'Troisième version' });
  verifier(base.get(id)!.historique.some((t) => t.texte === `Notes remplacées. Ancienne version : ${longues}`), 'notes longues remplacées : ancienne version gardée en entier');
  const outilInconnu = (await appel('tools/call', { name: 'crm_supprimer', arguments: { id } })) as any;
  verifier(outilInconnu.error?.code === -32602 && base.has(id), 'outil inexistant (suppression) : erreur, contact intact');
  const enPanne: ContexteMcp = { ...ctx, depot: { ...ctx.depot, tous: async () => Promise.reject(new Error('réseau')) } };
  const panne = (await traiterMcp({ jsonrpc: '2.0', id: 99, method: 'tools/call', params: { name: 'crm_resume', arguments: {} } }, enPanne)) as any;
  verifier(panne.corps.result.isError === true && /momentanément inaccessible/.test(panne.corps.result.content[0].text), 'base injoignable : erreur lisible, pas de plantage');

  await channelManager();
  await parEspace();

  // Copilote : chaque écriture faite par un outil a sa trace, posée avant elle.
  const faites = [...traces.values()].filter((t) => t.etat === 'faite' || t.etat === 'a_confirmer');
  verifier(faites.length === ecritures + ecrituresFils && faites.every((t) => t.source === 'claude' && !!t.outil && !!t.empreinte), `chaque écriture tracée (${faites.length} traces, ${ecritures + ecrituresFils} écritures)`);

  console.log(`${ok} contrôles réussis, ${ko} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = ko ? 1 : 0;
}

/* --------------------------------------------------------- channel manager */

/** Rien de sensible dans une réponse : wifi, code d'accès, e-mail, téléphone ou nom complet de voyageur. */
function sansDonneeSensible(x: unknown, libelle: string) {
  const t = JSON.stringify(x);
  const fuites = [logementPiege.fiche.wifiCode, '4821', 'marie.dupont@exemple.fr', '06 12 34 56 78', '+33 6 12 34 56 78', 'Dupont'].filter((v) => t.includes(v));
  const wifi = /"wifi(Nom|Code)"/.test(t);
  verifier(!fuites.length && !wifi, `${libelle} : aucune donnée sensible ${fuites.length ? `(${fuites.join(', ')})` : ''}`);
}

const eur = (c: number) => `${(c / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;

async function channelManager() {
  const J = '2026-09-24';
  const avant = { crm: ecritures, fils: ecrituresFils };
  const actives = seed.reservations.filter((x) => x.statut !== 'annulee');
  const attente = [...fils.values()].filter(attendEquipe);

  // cm_resume
  const r = await outil('cm_resume');
  verifier(!r.erreur && r.donnees.date === J && r.donnees.conversations_a_repondre === attente.length && attente.length > 0, `cm_resume : ${attente.length} conversations à répondre`);
  verifier(
    r.donnees.arrivees_aujourdhui.length === actives.filter((x) => x.arrivee === J).length && r.donnees.departs_aujourdhui.length === actives.filter((x) => x.depart === J).length,
    'cm_resume : arrivées et départs du jour',
  );
  verifier(r.donnees.sur_place_ce_soir === actives.filter((x) => x.arrivee <= J && x.depart > J).length && typeof r.donnees.contacts_a_appeler === 'number', 'cm_resume : sur place ce soir, appels du CRM');
  verifier(r.donnees.conversations.every((c: any) => /^\S+( \S\.)?$/.test(c.voyageur)), 'cm_resume : voyageurs « Prénom N. »');
  sansDonneeSensible(r.donnees, 'cm_resume');

  // logements_lister / logement_voir
  const ll = await outil('logements_lister');
  verifier(ll.donnees.total === seed.logements.length && ll.donnees.logements.every((l: any) => l.id && l.nom && l.statut && l.prochain_evenement), 'logements_lister : tous, avec statut et prochain événement');
  verifier(ll.donnees.logements.some((l: any) => l.prix_nuit) && ll.donnees.logements.filter((l: any) => l.prix_nuit).every((l: any) => l.statut === 'Actif'), 'logements_lister : prix de la nuit, seulement pour un logement en location');
  const actifs = await outil('logements_lister', { statut: 'actif' });
  verifier(actifs.donnees.total === seed.logements.filter((l) => l.statut === 'actif').length, 'logements_lister : filtre par statut');
  verifier((await outil('logements_lister', { statut: 'ouvert' })).erreur, 'logements_lister : statut inconnu refusé');
  const lv = await outil('logement_voir', { id: logementPiege.id });
  verifier(!lv.erreur && lv.donnees.nom === logementPiege.nom && lv.donnees.prix_14_nuits.length > 0 && lv.donnees.prix_14_nuits.length <= 14 && /logements\//.test(lv.donnees.lien_erp), 'logement_voir : fiche, 14 prochaines nuits au plus, lien ERP');
  sansDonneeSensible(lv.donnees, 'logement_voir');
  const parNom = await outil('logement_voir', { recherche: logementPiege.nom });
  verifier(!parNom.erreur && parNom.donnees.id === logementPiege.id, 'logement_voir : recherche par nom');
  const ambigu = await outil('logement_voir', { recherche: 'e' });
  verifier(ambigu.erreur && /Précisez l’id/.test(ambigu.texte), 'logement_voir : recherche ambiguë → liste des ids');
  verifier((await outil('logement_voir', { id: 'inconnu' })).erreur && (await outil('logement_voir', {})).erreur, 'logement_voir : id inconnu ou absent refusé');

  // reservations_periode / reservation_voir
  const jour = await outil('reservations_periode');
  verifier(jour.donnees.du === J && jour.donnees.au === J && jour.donnees.arrivees.every((x: any) => x.arrivee === J), 'reservations_periode : aujourd’hui par défaut');
  const semaine = await outil('reservations_periode', { du: '2026-09-21', au: '2026-09-27' });
  const dans = (d: string) => d >= '2026-09-21' && d <= '2026-09-27';
  verifier(
    semaine.donnees.arrivees.length === actives.filter((x) => dans(x.arrivee)).length &&
      semaine.donnees.departs.length === actives.filter((x) => dans(x.depart)).length &&
      semaine.donnees.sur_place.length === actives.filter((x) => x.arrivee <= '2026-09-27' && x.depart > '2026-09-21').length,
    'reservations_periode : arrivées, départs et sur place sur la période',
  );
  verifier(![...semaine.donnees.arrivees, ...semaine.donnees.departs, ...semaine.donnees.sur_place].some((x: any) => x.statut === 'Annulée'), 'reservations_periode : réservations annulées exclues');
  verifier((await outil('reservations_periode', { du: '2026-09-27', au: '2026-09-21' })).erreur, 'reservations_periode : « au » avant « du » refusé');
  verifier((await outil('reservations_periode', { du: '2026-01-01', au: '2026-12-31' })).erreur, 'reservations_periode : plus de 92 jours refusé');
  verifier((await outil('reservations_periode', { du: '24/09/2026' })).erreur, 'reservations_periode : date hors format refusée');
  const unSejour = actives.find((x) => x.commissionPlateformeCentimes > 0)!;
  const rv = await outil('reservation_voir', { id: unSejour.id });
  verifier(
    !rv.erreur && rv.donnees.montants.vous_recevez === eur(unSejour.montantBrutCentimes - unSejour.commissionPlateformeCentimes) && /reservations\//.test(rv.donnees.lien_erp),
    `reservation_voir : vous recevez = total − frais de la plateforme (${rv.donnees.montants?.vous_recevez})`,
  );
  sansDonneeSensible(rv.donnees, 'reservation_voir');
  verifier((await outil('reservation_voir', { id: 'x),collection.eq.journal' })).erreur, 'reservation_voir : identifiant hors format refusé');

  // Conversations
  const ar = await outil('conversations_a_repondre');
  verifier(ar.donnees.total === attente.length && ar.donnees.conversations.every((c: any) => attente.some((f) => f.id === c.id)), 'conversations_a_repondre : toutes celles qui attendent l’équipe');
  verifier(ar.donnees.conversations.find((c: any) => c.id === 'fil-piege')?.voyageur === 'Marie-Claire D.', 'conversations : nom au format « Prénom N. »');
  sansDonneeSensible(ar.donnees, 'conversations_a_repondre');
  const cv = await outil('conversation_voir', { id: 'fil-piege' });
  verifier(!cv.erreur && cv.donnees.messages.length === 2 && cv.donnees.attend_une_reponse === true, 'conversation_voir : messages et état');
  const [hote, voyageur] = cv.donnees.messages.map((m: { texte: string }) => m.texte);
  verifier(
    /\[e-mail masqué\]/.test(voyageur) && (voyageur.match(/\[téléphone masqué\]/g) ?? []).length === 2 && (hote.match(/••••/g) ?? []).length === 2,
    `conversation_voir : e-mail, téléphones et codes masqués (${voyageur} | ${hote})`,
  );
  sansDonneeSensible(cv.donnees, 'conversation_voir');
  const rp = await outil('reponse_preparer', { id: 'fil-piege' });
  verifier(!rp.erreur && rp.donnees.consignes.some((c: string) => /pas envoyée/.test(c)) && /messagerie\/fil-piege/.test(rp.donnees.lien_erp), 'reponse_preparer : contexte et consignes, rien n’est envoyé');
  sansDonneeSensible(rp.donnees, 'reponse_preparer');
  verifier((await outil('conversation_voir', { id: 'inconnue' })).erreur, 'conversation_voir : id inconnu refusé');
  verifier(ecritures === avant.crm && ecrituresFils === avant.fils, 'outils de lecture du channel manager : aucune écriture');

  const pb = await outil('conversation_pas_besoin_de_repondre', { id: 'fil-piege' });
  const apres = fils.get('fil-piege')!;
  verifier(
    !pb.erreur && pb.donnees.modifie === true && apres.statut === 'clos' && apres.traitePar === 'humain' && ecrituresFils === avant.fils + 1,
    'pas besoin de répondre : terminée, plus « en attente », une seule écriture dans l’ERP',
  );
  verifier(apres.messages.length === 2 && ecritures === avant.crm, 'pas besoin de répondre : aucun message ajouté ni envoyé, rien d’autre écrit');
  const encore = await outil('conversation_pas_besoin_de_repondre', { id: 'fil-piege' });
  verifier(encore.donnees.modifie === false && ecrituresFils === avant.fils + 1, 'pas besoin de répondre : déjà terminée, rien d’écrit');
  verifier((await outil('conversations_a_repondre')).donnees.total === attente.length - 1, 'la conversation sort de « À répondre »');

  // Indicateurs : mêmes chiffres que l'Accueil (data/selectors) sur 30 jours.
  const ind = await outil('indicateurs');
  const accueil = mesurerAccueil(seed, fenetreJours(30));
  verifier(
    ind.donnees.occupation === `${Math.round(accueil.occupation * 100)} %` &&
      ind.donnees.revenu_verse_par_les_plateformes === eur(accueil.revenu) &&
      ind.donnees.prix_moyen_par_nuit === eur(accueil.adr) &&
      ind.donnees.note_moyenne === (accueil.note === undefined ? 'aucun avis sur la période' : Math.round(accueil.note * 10) / 10),
    `indicateurs : mêmes chiffres que l’Accueil (${ind.donnees.occupation}, ${ind.donnees.revenu_verse_par_les_plateformes}, ${ind.donnees.prix_moyen_par_nuit}, ${ind.donnees.note_moyenne})`,
  );
  verifier(ind.donnees.periode.du === '2026-08-25' && ind.donnees.periode.au === '2026-09-23' && !!ind.donnees.periode_precedente, 'indicateurs : 30 derniers jours, comparés aux 30 précédents');
  const ete = await outil('indicateurs', { du: '2026-07-01', au: '2026-08-31' });
  verifier(!ete.erreur && ete.donnees.periode.jours === 62, 'indicateurs : période choisie');
  verifier((await outil('indicateurs', { du: '2026-09-10', au: '2026-09-01' })).erreur, 'indicateurs : période à l’envers refusée');

  verifier(prenomInitiale('Daniel A.') === 'Daniel A.' && prenomInitiale('Alex Morgan') === 'Alex M.' && prenomInitiale('') === 'Voyageur', 'noms « Prénom N. »');
}

/* ------------------------------------------------------- un espace par jeton */

async function parEspace() {
  const SENS = '5e5e0000-0000-4000-8000-000000000002';
  const valeur = 'A'.repeat(21) + '_-' + 'z9'.repeat(10); // 43 caractères base64url
  verifier(avecEspace(ID_LABEL_MAISON, valeur) === valeur && avecEspace(SENS, valeur) === `${SENS}.${valeur}` && avecEspace(SENS.toUpperCase(), valeur) === `${SENS}.${valeur}`, 'jeton : Label Maison sans préfixe, un autre espace préfixé');
  verifier(espaceDuJeton(valeur) === ID_LABEL_MAISON && espaceDuJeton(`${SENS}.${valeur}`) === SENS, 'espace du jeton : sans préfixe Label Maison, sinon celui du préfixe');
  for (const [quoi, jeton] of [
    ['préfixe Label Maison explicite (jamais émis)', `${ID_LABEL_MAISON}.${valeur}`],
    ['préfixe en majuscules', `${SENS.toUpperCase()}.${valeur}`],
    ['préfixe qui n’est pas un identifiant', `sens.${valeur}`],
    ['valeur trop courte', `${SENS}.${valeur.slice(1)}`],
    ['valeur trop longue', `${valeur}x`],
    ['caractère interdit', `${SENS}.${valeur.slice(1)}+`],
    ['deux préfixes', `${SENS}.${SENS}.${valeur}`],
    ['vide', ''],
    ['pas un texte', 42],
  ] as [string, unknown][]) {
    verifier(espaceDuJeton(jeton) === null, `espace du jeton : ${quoi} → refusé`);
  }

  // Instructions : Label Maison inchangées, un autre espace à son nom, sans rien de Label Maison.
  verifier(instructionsServeur() === INSTRUCTIONS_SERVEUR && instructionsServeur({ id: ID_LABEL_MAISON, nom: 'Label Maison' }) === INSTRUCTIONS_SERVEUR, 'instructions de Label Maison : inchangées');
  const sens = instructionsServeur({ id: SENS, nom: 'Sens' });
  verifier(sens.startsWith('Sens ') && /cm_resume/.test(sens) && /crm_noter_appel/.test(sens) && !/Essonne|Label Maison|formulaires audit/.test(sens), `instructions de Sens : son nom, mêmes outils, rien de Label Maison (${sens.slice(0, 80)})`);
  const ctxSens: ContexteMcp = { ...ctx, espace: { id: SENS, nom: 'Sens' } };
  const init = (await traiterMcp({ jsonrpc: '2.0', id: 7, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, ctxSens)) as any;
  verifier(init.corps.result.serverInfo.title === 'Sens' && init.corps.result.serverInfo.name === 'label-maison' && init.corps.result.instructions === sens, 'initialize avec le jeton de Sens : « Sens », mêmes outils');
  const panne = (await traiterMcp(
    { jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'crm_resume', arguments: {} } },
    { ...ctxSens, depot: { ...ctx.depot, tous: async () => Promise.reject(new Error('réseau')) } },
  )) as any;
  verifier(/données de l’espace Sens/.test(panne.corps.result.content[0].text) && !/Label Maison/.test(panne.corps.result.content[0].text), `erreur de base au nom de l’espace (${panne.corps.result.content[0].text})`);

  // « Suivi par » : Abdel et Kamel à Label Maison seulement ; Claude ne le voit ni ne le règle ailleurs.
  verifier(outilsDeLEspace() === OUTILS && outilsDeLEspace({ id: ID_LABEL_MAISON }) === OUTILS, 'outils de Label Maison : exactement ceux d’avant');
  const listeSens = (await traiterMcp({ jsonrpc: '2.0', id: 9, method: 'tools/list' }, ctxSens)) as any;
  const outilsSens = listeSens.corps.result.tools as { name: string; description: string; inputSchema: { properties?: Record<string, unknown> } }[];
  verifier(
    outilsSens.map((o) => o.name).join() === OUTILS.map((o) => o.name).join() && outilsSens.every((o) => !('suivi_par' in (o.inputSchema.properties ?? {})) && !/suivi_par|abdel|kamel/i.test(o.description)),
    'outils de Sens : les mêmes, sans « suivi_par » ni Abdel ou Kamel',
  );
  verifier(OUTILS.filter((o) => 'suivi_par' in ((o.inputSchema as { properties?: object }).properties ?? {})).length === 3, 'Label Maison garde « suivi_par » (chercher, ajouter, modifier)');
  verifier(!/le suivi/.test(sens) && /le suivi/.test(INSTRUCTIONS_SERVEUR), 'instructions de Sens : sans « le suivi »');
  const appelSens = async (name: string, args: Record<string, unknown>) =>
    ((await traiterMcp({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name, arguments: args } }, ctxSens)) as any).corps.result as { isError?: boolean; content: { text: string }[]; structuredContent?: any };
  const avant = ecritures;
  for (const [nom, args] of [
    ['crm_modifier', { id: 'crm-demo-06', suivi_par: 'abdel' }],
    ['crm_modifier', { id: 'crm-demo-06', suivi_par: '' }],
    ['crm_ajouter', { nom: 'Prospect Sens', telephone: '0699887766', suivi_par: 'kamel' }],
    ['crm_chercher', { suivi_par: 'abdel' }],
  ] as [string, Record<string, unknown>][]) {
    const r = await appelSens(nom, args);
    verifier(r.isError === true && /suivi_par/.test(r.content[0].text), `Sens, ${nom} avec suivi_par : refusé (${r.content[0].text})`);
  }
  verifier(ecritures === avant, 'Sens : rien d’écrit avec suivi_par');
  const ficheSens = await appelSens('crm_voir', { id: 'crm-demo-06' });
  verifier(!ficheSens.isError && ficheSens.structuredContent?.nom === 'Pierre Dubois' && !('suivi_par' in ficheSens.structuredContent), 'Sens : fiche sans « suivi_par »');
  const ficheLM = await outil('crm_voir', { id: 'crm-demo-06' });
  verifier(ficheLM.donnees.suivi_par === 'abdel', 'Label Maison : fiche avec « suivi_par » comme avant');
}

void main();
