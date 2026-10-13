/**
 * Vérification du connecteur MCP du CRM (src/erp/data/crm-mcp.ts) : protocole
 * JSON-RPC et outils, sur un CRM en mémoire (aucune base, aucun réseau).
 *
 * Lancement :
 *   node_modules/.bin/esbuild src/erp/data/verifier-crm-mcp.ts --bundle --platform=node \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-crm-mcp.cjs \
 *     && node /tmp/verifier-crm-mcp.cjs
 */
import { OUTILS, traiterMcp, type ContexteMcp } from './crm-mcp';
import { creerContactsCrm } from './seed-crm';
import type { ContactCrm } from './types';

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
const ctx: ContexteMcp = {
  depot: {
    tous: async () => [...base.values()].map((c) => structuredClone(c)),
    un: async (id) => (base.has(id) ? structuredClone(base.get(id)!) : undefined),
    enregistrer: async (c) => {
      ecritures++;
      base.set(c.id, structuredClone(c));
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
  verifier(/CRM d'appels/.test((init as any).result?.instructions ?? ''), 'initialize : instructions en français pour Claude');
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
  verifier(noms.join() === 'crm_resume,crm_chercher,crm_voir,crm_ajouter,crm_modifier,crm_noter_appel', `6 outils (${noms.join(', ')})`);
  verifier(liste.result.tools.every((t: any) => t.inputSchema?.type === 'object' && t.description && typeof t.annotations?.readOnlyHint === 'boolean'), 'chaque outil : schéma, description, annotations');
  verifier(!noms.some((x: string) => /suppr|delete/.test(x)), 'aucun outil de suppression');
  verifier(OUTILS.filter((o) => o.annotations.readOnlyHint).map((o) => o.name).join() === 'crm_resume,crm_chercher,crm_voir', 'lecture seule bien signalée');

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
  const outilInconnu = (await appel('tools/call', { name: 'crm_supprimer', arguments: { id } })) as any;
  verifier(outilInconnu.error?.code === -32602 && base.has(id), 'outil inexistant (suppression) : erreur, contact intact');
  const enPanne: ContexteMcp = { ...ctx, depot: { ...ctx.depot, tous: async () => Promise.reject(new Error('réseau')) } };
  const panne = (await traiterMcp({ jsonrpc: '2.0', id: 99, method: 'tools/call', params: { name: 'crm_resume', arguments: {} } }, enPanne)) as any;
  verifier(panne.corps.result.isError === true && /momentanément inaccessible/.test(panne.corps.result.content[0].text), 'base injoignable : erreur lisible, pas de plantage');

  console.log(`${ok} contrôles réussis, ${ko} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = ko ? 1 : 0;
}

void main();
