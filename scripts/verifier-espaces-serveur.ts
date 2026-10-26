/**
 * Auto-contrôle des espaces côté serveur (api/_erp-repull.ts, api/_erp-espaces.ts
 * et les routes qui s'en servent) sans réseau : faux Supabase (comptes, mots de
 * passe, PostgREST avec la colonne espace et ses règles, fonctions erp.*,
 * coffre) et faux Repull, branchés sur le fetch global ; variables de Vercel
 * simulées.
 *
 * Vérifie : base pas encore préparée (tout comme avant, Label Maison seul),
 * compte serveur absent ou sans son rôle (compte d'équipe, Label Maison
 * seulement), compte serveur prêt (espace nommé par l'en-tête), réglages d'un
 * espace (workspace, clé propre, rien de Label Maison), passage quotidien sur
 * chaque espace, bouton d'un membre de Sens, webhooks (workspace inconnu
 * ignoré, workspace de Sens, adresse propre à un espace avec son secret).
 *
 * Fichier hors de l'ERP (api/ demande les types de Node) : pas dans tsc.
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild scripts/verifier-espaces-serveur.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{}' --log-level=error --outfile=/tmp/verifier-espaces-serveur.mjs \
 *     && node /tmp/verifier-espaces-serveur.mjs
 */
import crypto from 'node:crypto';
import { ID_LABEL_MAISON, MESSAGE_BASE_PAS_PREPAREE } from '../src/erp/data/espaces';
import { ID_SELECTION } from '../src/erp/data/repull-synchro';
import { MESSAGE_COMPTE_SERVEUR, baseErp, configuration, etatBase, oublierEtatBase, variableManquante } from '../api/_erp-repull';
import { PLAFOND_IA_DEFAUT, codeEspaceDuWebhook, configurationEspace, espaceDemande, espacesActifs, workspaceDeLEvenement } from '../api/_erp-espaces';
import routeSynchro from '../api/erp-repull-sync';
import routeWebhook from '../api/erp-repull-webhook';
import routeAgenda from '../api/erp-agenda';

/* ------------------------------------------------------------ assertions */

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string, detail?: unknown) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}`, detail === undefined ? '' : JSON.stringify(detail).slice(0, 600));
  }
}
function section(titre: string) {
  console.log(`\n${titre}`);
}
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });

const LM = ID_LABEL_MAISON;
const SENS = '5e5e0000-0000-4000-8000-000000000002';
const VIDE = '7a7a0000-0000-4000-8000-000000000003';

/* ------------------------------------------------- faux Supabase + Repull */

interface Ligne {
  espace: string;
  collection: string;
  id: string;
  donnees: unknown;
}

class Monde {
  historique = true;
  serveurPret = false;
  comptes: Record<string, { mdp: string; jeton: string }> = {
    'equipe@labelmaisoncg.fr': { mdp: 'mdp-equipe', jeton: 'jeton-equipe' },
    'serveur@labelmaisoncg.fr': { mdp: 'mdp-serveur', jeton: 'jeton-serveur' },
    'gerant-b@exemple.invalid': { mdp: 'x', jeton: 'jeton-sens' },
  };
  membres = [
    { espace: LM, email: 'equipe@labelmaisoncg.fr', role: 'gerant' },
    { espace: SENS, email: 'gerant-b@exemple.invalid', role: 'gerant' },
  ];
  espaces = [
    { id: LM, code: 'label-maison', nom: 'Label Maison', repull_workspace: null as string | null, config: {} as Record<string, unknown> },
    { id: SENS, code: 'sens', nom: 'Sens', repull_workspace: '1204' as string | null, config: {} as Record<string, unknown> },
    { id: VIDE, code: 'vide', nom: 'Vide', repull_workspace: null as string | null, config: {} as Record<string, unknown> },
  ];
  coffre = new Map<string, string>();
  lignes = new Map<string, Ligne>();
  base: { methode: string; chemin: string; url: URL; jeton: string; espace: string | null; corps: unknown }[] = [];
  repull: { methode: string; chemin: string; workspace: string | null; cle: string }[] = [];

  emailDe = (jeton: string) => Object.entries(this.comptes).find(([, c]) => c.jeton === jeton)?.[0];
  poser(espace: string, collection: string, e: { id: string }) {
    this.lignes.set(`${espace}\u0000${collection}\u0000${e.id}`, { espace, collection, id: e.id, donnees: e });
  }
  /** Lignes écrites (POST) dans un espace, toutes collections. */
  ecritures(espace: string) {
    return this.base.filter((r) => r.methode === 'POST' && r.chemin === 'enregistrements' && (r.corps as Ligne[]).every((l) => (l.espace ?? LM) === espace));
  }
  oublier() {
    this.base = [];
    this.repull = [];
  }
  permis(jeton: string, entete: string | null): string[] {
    const email = this.emailDe(jeton);
    if (!email) return [];
    if (this.historique) return email === 'equipe@labelmaisoncg.fr' ? [LM] : [];
    if (email === 'serveur@labelmaisoncg.fr') return this.serveurPret && entete ? [entete] : [];
    return this.membres.filter((m) => m.email === email && (!entete || m.espace === entete)).map((m) => m.espace);
  }

  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    const h = new Headers(init?.headers);
    const methode = (init?.method ?? 'GET').toUpperCase();
    const jeton = (h.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (url.hostname === 'api.repull.dev') {
      this.repull.push({ methode, chemin: url.pathname, workspace: h.get('x-workspace-id'), cle: jeton });
      return json({ data: [], pagination: { hasMore: false, nextCursor: null } });
    }
    if (url.pathname === '/auth/v1/token') {
      const { email, password } = JSON.parse(String(init?.body)) as { email: string; password: string };
      const c = this.comptes[email];
      return c && c.mdp === password ? json({ access_token: c.jeton, expires_in: 3600 }) : json({ error: 'invalid_grant' }, 400);
    }
    if (url.pathname === '/auth/v1/user') {
      const email = this.emailDe(jeton);
      return email ? json({ email }) : json({}, 401);
    }
    const chemin = url.pathname.replace(/^\/rest\/v1\//, '');
    const corps = init?.body ? JSON.parse(String(init.body)) : undefined;
    const entete = h.get('x-erp-espace');
    this.base.push({ methode, chemin, url, jeton, espace: entete, corps });
    const email = this.emailDe(jeton);
    if (!email) return json({ code: 'PGRST301' }, 401);
    if (chemin.startsWith('rpc/')) {
      if (this.historique) return json({ code: 'PGRST202', message: `Could not find the function erp.${chemin.slice(4)}` }, 404);
      const serveur = email === 'serveur@labelmaisoncg.fr' && this.serveurPret;
      if (chemin === 'rpc/qui_suis_je') {
        const espaces = serveur ? [] : this.membres.filter((m) => m.email === email).map((m) => ({ ...this.espaces.find((e) => e.id === m.espace)!, role: m.role }));
        return json({ email, serveur, espaces });
      }
      if (chemin === 'rpc/espaces_actifs') return json(serveur ? this.espaces : this.espaces.filter((e) => this.permis(jeton, null).includes(e.id)));
      if (chemin === 'rpc/secret_espace') {
        const { p_espace, p_nom } = corps as { p_espace: string; p_nom: string };
        return json(serveur && p_espace !== LM ? (this.coffre.get(`${p_espace}:${p_nom}`) ?? null) : null);
      }
      return json({ code: 'PGRST202' }, 404);
    }
    if (chemin === 'membres') return json(this.membres.filter((m) => m.espace === LM && this.permis(jeton, null).includes(LM)).map(({ email: e, role }) => ({ email: e, role })));
    const avecEspace = url.searchParams.has('espace') || (Array.isArray(corps) && corps.some((l) => 'espace' in l));
    if (this.historique && avecEspace) return json({ code: '42703', message: 'column enregistrements.espace does not exist' }, 400);
    const permis = this.permis(jeton, entete);
    if (methode === 'GET') {
      const p = url.searchParams;
      const egal = (k: string) => p.get(k)?.replace(/^eq\./, '');
      const ids = p.get('id')?.startsWith('in.') ? new Set(p.get('id')!.replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''))) : null;
      return json(
        [...this.lignes.values()]
          .filter((l) => permis.includes(l.espace) && (!egal('espace') || l.espace === egal('espace')) && l.collection === egal('collection') && (!ids || ids.has(l.id)))
          .map((l) => ({ id: l.id, donnees: l.donnees })),
      );
    }
    for (const l of corps as Partial<Ligne>[]) {
      const espace = l.espace ?? LM;
      if (!permis.includes(espace)) return json({ code: '42501', message: 'new row violates row-level security policy' }, 403);
      this.poser(espace, l.collection!, l.donnees as { id: string });
    }
    return new Response(null, { status: 201 });
  };
}

/* ------------------------------------------------- requêtes et réponses */

function reponse() {
  const r = {
    statut: 0,
    corps: undefined as unknown as Record<string, any>,
    entetes: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      r.entetes[k] = v;
    },
    status(s: number) {
      r.statut = s;
      return r;
    },
    json(c: Record<string, any>) {
      r.corps = c;
      return r;
    },
    end() {
      return r;
    },
  };
  return r;
}

function requete(o: { methode?: string; entetes?: Record<string, string>; corps?: unknown; query?: Record<string, string> }) {
  return { method: o.methode ?? 'POST', headers: o.entetes ?? {}, body: o.corps ?? {}, query: o.query ?? {} };
}

function webhook(ev: Record<string, unknown>, secret: string, query: Record<string, string> = {}) {
  const corps = JSON.stringify({ eventId: crypto.randomUUID(), ...ev });
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac('sha256', secret).update(`${t}.${corps}`).digest('hex');
  return {
    method: 'POST',
    query,
    headers: { 'x-repull-signature': `t=${t},v1=${v1}` },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(corps);
    },
  };
}

/* --------------------------------------------------------------- scénarios */

async function principal() {
  console.warn = () => undefined;
  console.log = ((l: unknown, ...reste: unknown[]) => {
    if (typeof l === 'string' && l.startsWith('[')) return;
    process.stdout.write(`${[l, ...reste].join(' ')}\n`);
  }) as typeof console.log;
  const monde = new Monde();
  (globalThis as { fetch: typeof fetch }).fetch = monde.fetch as typeof fetch;
  const env = process.env;
  for (const k of ['ERP_SERVEUR_MOT_DE_PASSE', 'ANTHROPIC_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VITE_ERP_EMAIL_EQUIPE']) delete env[k];
  Object.assign(env, { REPULL_API_KEY: 'sk_test_lm', ERP_PASSWORD: 'mdp-equipe', CRON_SECRET: 'secret-cron', REPULL_WEBHOOK_SECRET_ERP: 'whsec_lm' });
  const selection = (espace: string) => monde.poser(espace, 'repull', { id: ID_SELECTION, annonces: ['1'], limite: null, majLe: '2026-10-01T10:00:00+02:00', majPar: 'test' } as { id: string });
  selection(LM);
  selection(SENS);

  section('Outils');
  verifier(espaceDemande({ headers: { 'x-erp-espace': SENS.toUpperCase() } }) === SENS && espaceDemande({ headers: { 'x-erp-espace': 'sens' } }) === undefined && espaceDemande({ headers: {} }) === undefined, 'espace de l’appel : uuid de l’en-tête seulement');
  verifier(workspaceDeLEvenement({ workspaceId: 1204 }) === '1204' && workspaceDeLEvenement({ data: { workspaceId: '77' } }) === '77' && workspaceDeLEvenement({}) === undefined, 'workspace d’un événement');
  verifier(codeEspaceDuWebhook({ query: { espace: 'Sens' } }) === 'sens' && codeEspaceDuWebhook({ query: { espace: 'label-maison' } }) === undefined && codeEspaceDuWebhook({ query: {} }) === undefined, 'espace de l’adresse du webhook');

  section('Base pas encore préparée : comme avant');
  {
    const c = configuration();
    verifier((await etatBase(c)).mode === 'historique', 'état : historique');
    monde.oublier();
    await baseErp(c).lire('crm');
    const r = monde.base[monde.base.length - 1];
    verifier(r.jeton === 'jeton-equipe' && r.espace === null && !r.url.searchParams.has('espace'), 'compte d’équipe, sans en-tête ni filtre', { jeton: r.jeton, espace: r.espace });
    let m = '';
    await baseErp(c, SENS).lire('crm').catch((e: Error) => (m = e.message));
    verifier(m === MESSAGE_BASE_PAS_PREPAREE, 'autre espace : « Base pas encore préparée »', m);
    verifier((await espacesActifs(c)).map((e) => e.id).join() === LM, 'espaces actifs : Label Maison seul');
    m = '';
    await configurationEspace(SENS).catch((e: Error) => (m = e.message));
    verifier(m === MESSAGE_BASE_PAS_PREPAREE, 'réglages d’un autre espace : refusés', m);
    monde.oublier();
    const res = reponse();
    await routeSynchro(requete({ entetes: { authorization: 'Bearer secret-cron' } }), res);
    verifier(res.statut === 200 && typeof res.corps?.statut === 'string', 'passage quotidien : même réponse qu’avant (Label Maison seul)', res.corps);
    verifier(monde.repull.length > 0 && monde.repull.every((a) => a.workspace === null && a.cle === 'sk_test_lm'), 'Repull : clé de Label Maison, sans workspace');
    verifier(monde.base.every((r) => r.espace === null), 'base : aucune requête avec espace');
  }

  section('Base préparée, compte serveur pas prêt');
  monde.historique = false;
  env.ERP_SERVEUR_MOT_DE_PASSE = 'mdp-serveur';
  oublierEtatBase();
  {
    const c = configuration();
    const e = await etatBase(c);
    verifier(e.mode === 'espaces' && !e.serveur, 'état : espaces, sans compte serveur (rôle absent)', e);
    monde.oublier();
    await baseErp(c).lire('crm');
    const r = monde.base[monde.base.length - 1];
    verifier(r.jeton === 'jeton-equipe' && r.espace === LM && r.url.searchParams.get('espace') === `eq.${LM}`, 'Label Maison : compte d’équipe, en-tête et filtre de Label Maison', { jeton: r.jeton, espace: r.espace });
    let m = '';
    await baseErp(c, SENS).lire('crm').catch((x: Error) => (m = x.message));
    verifier(m === MESSAGE_COMPTE_SERVEUR, 'autre espace : jamais avec le compte d’équipe', m);
    m = '';
    await configurationEspace(SENS).catch((x: Error) => (m = x.message));
    verifier(m === MESSAGE_COMPTE_SERVEUR, 'réglages de Sens : compte serveur exigé', m);
  }
  env.ERP_SERVEUR_MOT_DE_PASSE = 'mauvais';
  oublierEtatBase();
  verifier((await etatBase(configuration())).serveur === false, 'mot de passe serveur refusé : compte d’équipe (Label Maison)');

  section('Compte serveur prêt');
  monde.serveurPret = true;
  env.ERP_SERVEUR_MOT_DE_PASSE = 'mdp-serveur';
  oublierEtatBase();
  {
    const c = configuration();
    verifier((await etatBase(c)).serveur, 'état : compte serveur prêt');
    monde.oublier();
    await baseErp(c).lire('crm');
    await baseErp(c, SENS).lire('crm');
    const [a, b] = monde.base.filter((r) => r.chemin === 'enregistrements');
    verifier(a.jeton === 'jeton-serveur' && a.espace === LM && b.jeton === 'jeton-serveur' && b.espace === SENS && b.url.searchParams.get('espace') === `eq.${SENS}`, 'compte serveur : l’espace nommé par l’en-tête', [a.espace, b.espace]);
    verifier((await espacesActifs(c)).map((e) => e.code).join() === 'label-maison,sens,vide', 'espaces actifs : tous, Label Maison d’abord');
    const lm = await configurationEspace(LM);
    verifier(lm.cle === 'sk_test_lm' && !lm.workspace && lm.secretWebhook === 'whsec_lm' && lm.plafondIAMois === undefined, 'Label Maison : variables de Vercel, sans plafond', lm);
    const sens = await configurationEspace(SENS);
    verifier(sens.espace === SENS && sens.cle === 'sk_test_lm' && sens.workspace === '1204' && sens.secretWebhook === '' && sens.plafondIAMois === PLAFOND_IA_DEFAUT && sens.nomEspace === 'Sens', 'Sens : clé du compte dans SON workspace, aucun secret de Label Maison', sens);
    monde.coffre.set(`${SENS}:repull_cle`, 'sk_test_sens');
    monde.espaces[1].config = { agent: { plafondMois: 50 } };
    const propre = await configurationEspace(SENS);
    verifier(propre.cle === 'sk_test_sens' && propre.workspace === '1204' && propre.plafondIAMois === 50, 'Sens : sa propre clé (coffre) et son plafond', propre);
    monde.coffre.delete(`${SENS}:repull_cle`);
    const vide = await configurationEspace(VIDE);
    verifier(vide.cle === '' && /pas encore relié/.test(variableManquante(vide) ?? ''), 'espace sans workspace ni clé : Repull coupé, jamais la clé de Label Maison', vide);
    let m = '';
    await configurationEspace('9a9a0000-0000-4000-8000-000000000009').catch((x: Error) => (m = x.message));
    verifier(/inconnu/.test(m), 'espace inconnu : refusé', m);
  }

  section('Passage quotidien sur chaque espace');
  {
    monde.oublier();
    const res = reponse();
    await routeSynchro(requete({ entetes: { authorization: 'Bearer secret-cron' } }), res);
    verifier(res.statut === 200 && res.corps?.espaces?.['label-maison'] && res.corps?.espaces?.sens && !('vide' in res.corps.espaces), 'Label Maison puis Sens ; l’espace sans Repull est sauté', res.corps);
    const premierSens = monde.repull.findIndex((a) => a.workspace === '1204');
    verifier(premierSens > 0 && monde.repull.slice(0, premierSens).every((a) => a.workspace === null) && monde.repull.slice(premierSens).every((a) => a.workspace === '1204'), 'Repull : Label Maison sans workspace, puis Sens toujours avec le sien');
    verifier(monde.ecritures(SENS).length > 0 && monde.ecritures(SENS).every((r) => r.espace === SENS) && monde.ecritures(LM).every((r) => r.espace === LM), 'chaque espace écrit chez lui');
  }

  section('Bouton d’un membre');
  {
    // Le passage quotidien vient d'avoir lieu : sans cet oubli, le bouton attendrait 10 minutes.
    monde.lignes.delete(`${SENS}\u0000repull\u0000etat`);
    monde.oublier();
    let res = reponse();
    await routeSynchro(requete({ entetes: { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS } }), res);
    verifier(res.statut === 200, 'gérant de Sens : synchronisation de Sens', res.corps);
    verifier(monde.repull.length > 0 && monde.repull.every((a) => a.workspace === '1204'), 'Repull : workspace de Sens sur chaque appel');
    verifier(monde.ecritures(LM).length === 0, 'rien écrit dans Label Maison');
    res = reponse();
    await routeSynchro(requete({ entetes: { authorization: 'Bearer jeton-equipe', 'x-erp-espace': SENS } }), res);
    verifier(res.statut === 403, 'compte de Label Maison avec l’en-tête de Sens : refusé', res.corps);
    res = reponse();
    await routeAgenda(requete({ methode: 'GET', entetes: { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS } }), res);
    verifier(res.statut === 403 && res.corps?.code === 'espace', 'agenda du CRM : Label Maison seulement pour l’instant', res.corps);
  }

  section('Webhooks');
  {
    const message = { event: 'reservation.message.received', data: { object: { conversationId: 1 } } };
    monde.oublier();
    let res = reponse();
    await routeWebhook(webhook({ ...message, workspaceId: 9999 }, 'whsec_lm'), res);
    verifier(res.statut === 200 && res.corps?.ignore === 'workspace' && monde.repull.length === 0 && monde.ecritures(LM).length === 0, 'workspace inconnu : ignoré, jamais versé dans Label Maison', res.corps);
    monde.oublier();
    res = reponse();
    await routeWebhook(webhook({ ...message, workspaceId: 1204 }, 'whsec_lm'), res);
    verifier(res.statut === 200 && monde.repull.length > 0 && monde.repull.every((a) => a.workspace === '1204'), 'workspace de Sens : relu dans le workspace de Sens', monde.repull);
    verifier(monde.ecritures(SENS).length > 0 && monde.ecritures(LM).length === 0, 'écrit dans Sens seulement');
    monde.oublier();
    res = reponse();
    await routeWebhook(webhook(message, 'whsec_lm'), res);
    verifier(res.statut === 200 && monde.repull.every((a) => a.workspace === null) && monde.ecritures(LM).length > 0 && monde.ecritures(SENS).length === 0, 'sans workspace : Label Maison, comme avant');
    res = reponse();
    await routeWebhook(webhook(message, 'whsec_lm', { espace: 'sens' }), res);
    verifier(res.statut === 503, 'adresse de Sens sans secret rangé : refusée (le secret de Label Maison ne vaut pas)', res.corps);
    monde.coffre.set(`${SENS}:repull_webhook`, 'whsec_sens');
    res = reponse();
    await routeWebhook(webhook(message, 'whsec_lm', { espace: 'sens' }), res);
    verifier(res.statut === 401, 'adresse de Sens signée avec le secret de Label Maison : refusée', res.statut);
    monde.oublier();
    res = reponse();
    await routeWebhook(webhook(message, 'whsec_sens', { espace: 'sens' }), res);
    verifier(res.statut === 200 && monde.ecritures(SENS).length > 0 && monde.ecritures(LM).length === 0, 'adresse de Sens, son secret : traité dans Sens', res.corps);
    res = reponse();
    await routeWebhook(webhook(message, 'whsec_sens', { espace: 'inconnu' }), res);
    verifier(res.statut === 404, 'espace inconnu : 404', res.statut);
  }

  process.stdout.write(`\n${reussis} contrôles réussis, ${echecs} en échec.\n`);
  process.exitCode = echecs ? 1 : 0;
}

principal().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
