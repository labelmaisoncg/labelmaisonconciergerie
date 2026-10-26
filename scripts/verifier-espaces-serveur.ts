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
 * chaque espace, bouton d'un membre de Sens, webhooks (événements tagués de
 * Label Maison traités comme avant tant qu'aucun autre espace n'a de
 * workspace, workspace de Sens, workspace inconnu ignoré ensuite, adresse
 * propre à un espace avec son secret, espace inconnu = signature fausse),
 * base qui recule (retour en arrière du SQL) relue aussitôt, espace
 * propriétaire (accès créé, lu et revérifié dans l'espace qui invite, lien
 * sans espace = Label Maison, cookie dont on change l'espace refusé,
 * « Recevoir mon lien » cherché dans chaque espace), relances de paiement
 * (passage quotidien de chaque espace, « proposer » n'envoie jamais seul,
 * pas d'expéditeur = pas d'envoi, expéditeur de l'espace, jamais deux fois,
 * arrêt au paiement).
 * Espace opérations (mêmes règles que l’espace propriétaire, logements de
 * la personne seulement, un cookie propriétaire ne vaut pas pour les
 * opérations).
 * Audit des accès extérieurs (octobre 2026) : liens toujours sur le site
 * fixe (Origin forgée sans effet), origines acceptées, adresse de la fiche
 * qui fait foi, usage unique et relance unique sous accès simultanés
 * (écriture conditionnelle sur maj_le), un lien toutes les 2 minutes,
 * jamais l'expéditeur de Label Maison faute de fiche, ids encodés.
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
import { BUDGET_ESPACE_DEFAUT, PLAFOND_IA_DEFAUT, codeEspaceDuWebhook, configurationEspace, espaceDemande, espaceDuWorkspace, espacesActifs, workspaceDeLEvenement } from '../api/_erp-espaces';
import routeSynchro from '../api/erp-repull-sync';
import routeWebhook from '../api/erp-repull-webhook';
import routeAgenda from '../api/erp-agenda';
import routeProprietaire from '../api/espace-proprietaire';
import routeOperations from '../api/espace-operations';
import { relancesDuJour } from '../api/_relances';
import { SITE_PAR_DEFAUT, adresseSite, baseAcces, contactsEspace, expediteurEspace } from '../api/_acces-externe';
import { origineAutorisee } from '../api/_garde-formulaire';
import { accesToujoursDeLaFiche, type AccesExterne } from '../src/erp/data/acces-externe';

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
  /** Version (colonne maj_le, changée à chaque écriture ; avec « + » comme un timestamptz). */
  maj_le: string;
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
  /** E-mails envoyés par Resend (relances, liens). */
  emails: { from: string; to: string[]; subject: string; text: string; replyTo?: unknown }[] = [];
  /** Panne passagère de erp.espaces_actifs (fiche d'espace illisible). */
  panneEspacesActifs = false;
  horloge = 0;

  emailDe = (jeton: string) => Object.entries(this.comptes).find(([, c]) => c.jeton === jeton)?.[0];
  poser(espace: string, collection: string, e: { id: string }) {
    this.horloge += 1;
    const maj_le = `2026-10-26T10:00:00.${String(this.horloge).padStart(6, '0')}+00:00`;
    this.lignes.set(`${espace}\u0000${collection}\u0000${e.id}`, { espace, collection, id: e.id, donnees: e, maj_le });
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
    if (url.hostname === 'api.resend.com') {
      const e = JSON.parse(String(init?.body)) as { from: string; to: string[]; subject: string; text: string; reply_to?: unknown };
      this.emails.push({ from: e.from, to: e.to, subject: e.subject, text: e.text, replyTo: e.reply_to });
      return json({ id: `email-${this.emails.length}` });
    }
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
      if (chemin === 'rpc/espaces_actifs' && this.panneEspacesActifs) return json({ message: 'panne passagère' }, 503);
      if (chemin === 'rpc/espaces_actifs') return json(serveur ? this.espaces : this.espaces.filter((e) => this.permis(jeton, null).includes(e.id)));
      if (chemin === 'rpc/secret_espace') {
        const { p_espace, p_nom } = corps as { p_espace: string; p_nom: string };
        return json(serveur && p_espace !== LM && entete === p_espace ? (this.coffre.get(`${p_espace}:${p_nom}`) ?? null) : null);
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
          .map((l) => ({ id: l.id, donnees: l.donnees, maj_le: l.maj_le })),
      );
    }
    if (methode === 'PATCH') {
      // Écriture conditionnelle (BaseErp.remplacerSi) : la ligne, si elle a encore la version lue.
      const p = url.searchParams;
      const egal = (k: string) => p.get(k)?.replace(/^eq\./, '');
      const espace = egal('espace') ?? LM;
      if (!permis.includes(espace) || !p.get('maj_le')) return json([]);
      const cle = `${espace}\u0000${egal('collection')}\u0000${egal('id')}`;
      const l = this.lignes.get(cle);
      if (!l || l.maj_le !== egal('maj_le')) return json([]);
      this.poser(espace, l.collection, (corps as { donnees: { id: string } }).donnees);
      const n = this.lignes.get(cle)!;
      return json([{ id: n.id, donnees: n.donnees, maj_le: n.maj_le }]);
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
  {
    const lm = { id: LM, code: 'label-maison', nom: 'Label Maison', repull_workspace: null, config: {} };
    const sens = { id: SENS, code: 'sens', nom: 'Sens', repull_workspace: '1204', config: {} };
    verifier(espaceDuWorkspace([lm], '555')?.id === LM, 'workspace d’un événement, Label Maison seul : Label Maison (comme avant)');
    verifier(espaceDuWorkspace([lm, { ...sens, repull_workspace: null }], '555')?.id === LM, 'aucun autre espace avec un workspace : Label Maison');
    verifier(espaceDuWorkspace([lm, sens], '1204')?.id === SENS && espaceDuWorkspace([lm, sens], '555') === null, 'Sens déclaré : son workspace chez lui, un inconnu ignoré');
    verifier(espaceDuWorkspace([{ ...lm, repull_workspace: '42' }, sens], '42')?.id === LM, 'Label Maison peut déclarer le sien');
  }

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
    monde.oublier();
    const w = reponse();
    await routeWebhook(webhook({ event: 'reservation.message.received', data: { object: {} }, workspaceId: 555 }, 'whsec_lm'), w);
    verifier(w.statut === 200 && !w.corps?.ignore && monde.repull.length > 0 && monde.ecritures(LM).length > 0, 'webhook tagué d’un workspace, base d’avant : traité pour Label Maison', w.corps);
  }

  section('Espace propriétaire, base pas encore préparée : Label Maison comme avant');
  const ORIGINE = { origin: 'https://labelmaisoncg.fr' };
  const EMAIL_PROPRIO = 'proprio@exemple.invalid';
  const jetonDuLien = (lien: string) => new URLSearchParams(String(lien).split('#')[1] ?? '').get('jeton') ?? '';
  const appelProprio = async (o: { methode?: string; entetes?: Record<string, string>; corps?: unknown; query?: Record<string, string> }) => {
    const res = reponse();
    await routeProprietaire(requete({ ...o, entetes: { ...ORIGINE, ...(o.entetes ?? {}) } }), res);
    return res;
  };
  const cookieDe = (res: { entetes: Record<string, string> }) => String(res.entetes['Set-Cookie'] ?? '').split(';')[0];
  // Factures partagées, échéance il y a `jours` jours.
  const ilYa = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString().slice(0, 10);
  const facture = (id: string, proprietaireId: string, joursDeRetard: number, o: Record<string, unknown> = {}) =>
    ({ id, numero: `N-${id}`, type: 'commission', destinataire: 'proprietaire', proprietaireId, dateEmission: ilYa(joursDeRetard + 15), echeance: ilYa(joursDeRetard), montantHtCentimes: 10000, tvaPct: 20, statut: 'emise', lignes: [], partageeLe: '2026-01-01T00:00:00.000Z', ...o }) as { id: string };
  const relance = (espace: string, id: string) => monde.lignes.get(`${espace}\u0000relancesPaiement\u0000${id}`)?.donnees as { statut?: string; motif?: string; envoyeePar?: string } | undefined;
  let cookieAlice = '';
  {
    env.PROPRIETAIRE_SECRET = 'secret-de-test-espace-proprietaire-0123456789';
    monde.poser(LM, 'proprietaires', { id: 'pro-a', nom: 'Alice Label', contact: { email: EMAIL_PROPRIO, telephone: '' } } as { id: string });
    monde.poser(LM, 'logements', { id: 'log-a', nom: 'Chez Alice', ville: 'Évry', statut: 'actif', proprietaireId: 'pro-a', capacite: 4, chambres: 1 } as { id: string });
    monde.poser(LM, 'reservations', { id: 'res-a', logementId: 'log-a', canal: 'airbnb', voyageur: { nom: 'Bob Martin', nbPersonnes: 2 }, arrivee: '2099-01-10', depart: '2099-01-12', nuits: 2, statut: 'confirmee', montantBrutCentimes: 20000, commissionPlateformeCentimes: 3000, fraisMenageCentimes: 4000 } as { id: string });
    let res = await appelProprio({ entetes: { authorization: 'Bearer jeton-equipe' }, corps: { action: 'inviter', proprietaireId: 'pro-a', email: EMAIL_PROPRIO } });
    verifier(res.statut === 200 && String(res.corps?.lien).includes(`/espace-proprietaire#espace=${LM}&jeton=`), 'invitation du gérant : lien de Label Maison', res.corps);
    const acces = monde.lignes.get(`${LM}\u0000accesProprietaires\u0000pro-a`)?.donnees as { espace?: string } | undefined;
    verifier(acces?.espace === LM && monde.base.filter((r) => r.chemin === 'enregistrements').every((r) => r.espace === null), 'accès rangé dans Label Maison, sans en-tête (base d’avant les espaces)', acces);
    // Ancien lien, sans espace : Label Maison.
    res = await appelProprio({ corps: { action: 'entrer', jeton: jetonDuLien(res.corps?.lien) } });
    cookieAlice = cookieDe(res);
    verifier(res.statut === 200 && cookieAlice.startsWith('lm_proprio='), 'lien sans espace : ouvert dans Label Maison', res.corps);
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAlice } });
    verifier(res.statut === 200 && res.corps?.vue?.conciergerie?.nom === 'Label Maison' && !!res.corps?.vue?.contacts && res.corps?.vue?.logements?.[0]?.id === 'log-a', 'vue de Label Maison, avec ses contacts', res.corps);
    // Relances, base d'avant les espaces : Label Maison seul, mode « proposer » par défaut.
    monde.poser(LM, 'factures', facture('fac-lm', 'pro-a', 6));
    monde.oublier();
    const bilan = await relancesDuJour();
    verifier((bilan['label-maison'] as { creees?: number })?.creees === 1 && monde.emails.length === 0, 'relances (base d’avant les espaces) : proposée, rien d’envoyé', bilan);
    verifier(relance(LM, 'fac-lm-r1')?.statut === 'proposee' && monde.base.every((r) => r.espace === null), 'relance rangée dans Label Maison, sans en-tête');
  }

  section('Espace opérations, base pas encore préparée : Label Maison comme avant');
  const EMAIL_OPS = 'terrain@exemple.invalid';
  const appelOps = async (o: { methode?: string; entetes?: Record<string, string>; corps?: unknown; query?: Record<string, string> }) => {
    const res = reponse();
    await routeOperations(requete({ ...o, entetes: { ...ORIGINE, ...(o.entetes ?? {}) } }), res);
    return res;
  };
  let cookieAgathe = '';
  {
    // Un seul secret pour les deux espaces : le genre est signé dans la session.
    env.ACCES_SECRET = 'secret-commun-des-espaces-exterieurs-0123456789';
    monde.poser(LM, 'logements', { id: 'log-b', nom: 'Pas pour Agathe', ville: 'Massy', statut: 'actif', proprietaireId: 'pro-b', capacite: 2, chambres: 1 } as { id: string });
    monde.poser(LM, 'equipe', { id: 'eq-a', nom: 'Agathe Terrain', role: 'pole', email: EMAIL_OPS, logementIds: ['log-a'], actif: true } as { id: string });
    let res = await appelOps({ entetes: { authorization: 'Bearer jeton-equipe' }, corps: { action: 'inviter', membreId: 'eq-a', email: EMAIL_OPS } });
    verifier(res.statut === 200 && String(res.corps?.lien).includes(`/espace-operations#espace=${LM}&jeton=`), 'opérations : invitation du gérant, lien de Label Maison', res.corps);
    verifier((monde.lignes.get(`${LM}\u0000accesOperations\u0000eq-a`)?.donnees as { espace?: string } | undefined)?.espace === LM, 'opérations : accès rangé dans Label Maison');
    res = await appelOps({ corps: { action: 'entrer', jeton: jetonDuLien(res.corps?.lien) } });
    cookieAgathe = cookieDe(res);
    verifier(res.statut === 200 && cookieAgathe.startsWith('lm_operations='), 'opérations : lien sans espace ouvert dans Label Maison', res.corps);
    res = await appelOps({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAgathe } });
    verifier(res.statut === 200 && res.corps?.vue?.logements?.map((l: { id: string }) => l.id).join() === 'log-a' && res.corps?.vue?.conciergerie?.nom === 'Label Maison', 'opérations : seulement ses logements, au nom de Label Maison', res.corps?.vue?.logements);
    res = await appelOps({ entetes: { cookie: cookieAgathe }, corps: { action: 'agir', operation: { type: 'signaler', logementId: 'log-b', urgent: true, description: 'Fuite sous l’évier de la cuisine.' } } });
    verifier(res.statut === 403, 'opérations : incident sur un logement qui n’est pas le sien refusé', res.corps);
    monde.oublier();
    res = await appelOps({ entetes: { cookie: cookieAgathe }, corps: { action: 'agir', operation: { type: 'signaler', logementId: 'log-a', urgent: true, description: 'Fuite sous l’évier de la cuisine.' } } });
    const ecrits = monde.base.filter((r) => r.methode === 'POST' && r.chemin === 'enregistrements');
    verifier(res.statut === 200 && res.corps?.vue?.incidents?.some((i: { urgent: boolean }) => i.urgent), 'opérations : urgence signalée, vue à jour', res.corps?.message);
    verifier(ecrits.length > 0 && ecrits.every((r) => (r.corps as { collection: string }[]).every((l) => l.collection === 'incidents')), 'opérations : seule la collection des incidents est écrite', ecrits.map((r) => r.corps));
    // Un cookie propriétaire ne vaut pas pour les opérations (genre signé dans la session).
    res = await appelOps({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAlice.replace(/^lm_proprio=/, 'lm_operations=') } });
    verifier(res.statut === 401, 'opérations : cookie propriétaire refusé', res.statut);
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
    verifier(sens.budgetMois === BUDGET_ESPACE_DEFAUT && BUDGET_ESPACE_DEFAUT < lm.budgetMois, 'Sens : sa propre part d’appels, plus petite que celle de Label Maison', sens.budgetMois);
    monde.espaces[1].config = { repull: { budgetMois: 0 } };
    verifier((await configurationEspace(SENS)).budgetMois === 0, 'part d’appels à 0 permise');
    monde.espaces[1].config = {};
    monde.oublier();
    await configurationEspace(SENS);
    verifier(monde.base.filter((r) => r.chemin === 'rpc/secret_espace').every((r) => r.espace === SENS), 'secrets du coffre demandés avec l’en-tête de l’espace');
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

  section('Webhook tagué, seul Label Maison configuré');
  {
    monde.espaces[1].repull_workspace = null;
    monde.oublier();
    const w = reponse();
    await routeWebhook(webhook({ event: 'reservation.message.received', data: { object: {} }, workspaceId: 555 }, 'whsec_lm'), w);
    verifier(w.statut === 200 && !w.corps?.ignore && monde.ecritures(LM).length > 0 && monde.repull.every((a) => a.workspace === null), 'aucun autre espace avec un workspace : traité pour Label Maison', w.corps);
    monde.espaces[1].repull_workspace = '1204';
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

  section('Espace propriétaire : chaque accès dans l’espace qui invite');
  {
    monde.poser(SENS, 'proprietaires', { id: 'pro-s', nom: 'Sophie Sens', contact: { email: EMAIL_PROPRIO, telephone: '' } } as { id: string });
    monde.poser(SENS, 'logements', { id: 'log-s', nom: 'Chez Sophie', ville: 'Sens', statut: 'actif', proprietaireId: 'pro-s', capacite: 2, chambres: 1 } as { id: string });
    monde.poser(SENS, 'reservations', { id: 'res-s', logementId: 'log-s', canal: 'booking', voyageur: { nom: 'Zoé Sensible', nbPersonnes: 1 }, arrivee: '2099-02-10', depart: '2099-02-12', nuits: 2, statut: 'confirmee', montantBrutCentimes: 20000, commissionPlateformeCentimes: 3000, fraisMenageCentimes: 4000 } as { id: string });
    monde.oublier();
    let res = await appelProprio({ entetes: { authorization: 'Bearer jeton-equipe', 'x-erp-espace': SENS }, corps: { action: 'inviter', proprietaireId: 'pro-s', email: EMAIL_PROPRIO } });
    verifier(res.statut === 403, 'compte de Label Maison avec l’en-tête de Sens : invitation refusée', res.corps);
    res = await appelProprio({ entetes: { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS }, corps: { action: 'inviter', proprietaireId: 'pro-s', email: EMAIL_PROPRIO } });
    verifier(res.statut === 200 && String(res.corps?.lien).includes(`#espace=${SENS}&jeton=`) && res.corps?.envoye === false, 'gérant de Sens : lien de Sens (pas d’expéditeur pour Sens : lien à copier)', res.corps);
    const lienSens = String(res.corps?.lien);
    verifier(
      (monde.lignes.get(`${SENS}\u0000accesProprietaires\u0000pro-s`)?.donnees as { espace?: string } | undefined)?.espace === SENS && !monde.lignes.has(`${LM}\u0000accesProprietaires\u0000pro-s`) && monde.ecritures(LM).length === 0,
      'accès écrit dans Sens seulement',
    );
    res = await appelProprio({ corps: { action: 'entrer', jeton: jetonDuLien(lienSens), espace: LM } });
    verifier(res.statut === 401, 'lien de Sens présenté à Label Maison : refusé', res.corps);
    res = await appelProprio({ corps: { action: 'entrer', jeton: jetonDuLien(lienSens), espace: SENS } });
    const cookieSophie = cookieDe(res);
    verifier(res.statut === 200 && !!cookieSophie, 'lien de Sens : session ouverte', res.corps);
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieSophie } });
    const texte = JSON.stringify(res.corps?.vue ?? {});
    verifier(res.statut === 200 && res.corps?.vue?.conciergerie?.nom === 'Sens' && res.corps?.vue?.logements?.map((l: { id: string }) => l.id).join() === 'log-s', 'propriétaire de Sens : son logement, au nom de Sens', res.corps);
    verifier(!/Alice|log-a|Bob|Label Maison|74954|labelmaisoncg/i.test(texte) && !res.corps?.vue?.contacts && /Zoé S\./.test(texte) && !/Sensible/.test(texte), 'rien de Label Maison (ni données, ni contacts), voyageur en « Prénom N. »', texte.slice(0, 300));
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAlice } });
    verifier(res.statut === 200 && res.corps?.vue?.logements?.map((l: { id: string }) => l.id).join() === 'log-a' && !/Sophie|log-s|Zoé/.test(JSON.stringify(res.corps?.vue)), 'propriétaire de Label Maison : rien de Sens', res.corps?.vue?.logements);
    // Cookie dont on change l'espace : la signature ne correspond plus.
    const [nom, valeur] = cookieSophie.split('=');
    const [corps, signature] = valeur.split('.');
    const charge = JSON.parse(Buffer.from(corps, 'base64url').toString()) as Record<string, unknown>;
    const falsifie = `${nom}=${Buffer.from(JSON.stringify({ ...charge, e: LM })).toString('base64url')}.${signature}`;
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: falsifie } });
    verifier(res.statut === 401, 'cookie dont l’espace est changé : refusé', res.statut);
    // « Recevoir mon lien » : la même adresse a un accès dans Label Maison et dans Sens.
    monde.oublier();
    res = await appelProprio({ corps: { action: 'lien', email: EMAIL_PROPRIO } });
    const liens = (e: string, id: string) => ((monde.lignes.get(`${e}\u0000accesProprietaires\u0000${id}`)?.donnees as { liens?: { motif: string }[] } | undefined)?.liens ?? []).filter((l) => l.motif === 'connexion').length;
    verifier(res.statut === 200 && liens(LM, 'pro-a') === 1 && liens(SENS, 'pro-s') === 1, 'demande de lien : un lien dans chaque espace où l’adresse a un accès', res.corps);
    const message = res.corps?.message;
    monde.oublier();
    res = await appelProprio({ corps: { action: 'lien', email: 'inconnu@exemple.invalid' } });
    verifier(res.statut === 200 && res.corps?.message === message && monde.base.every((r) => r.methode !== 'POST' || r.chemin !== 'enregistrements'), 'adresse inconnue : même réponse, rien d’écrit', res.corps);
  }

  section('Espace opérations : chaque accès dans l’espace qui invite');
  {
    monde.poser(SENS, 'equipe', { id: 'eq-s', nom: 'Samir Sens', role: 'agent', email: EMAIL_OPS, logementIds: ['log-s'], actif: true } as { id: string });
    let res = await appelOps({ entetes: { authorization: 'Bearer jeton-equipe', 'x-erp-espace': SENS }, corps: { action: 'inviter', membreId: 'eq-s', email: EMAIL_OPS } });
    verifier(res.statut === 403, 'opérations : compte de Label Maison avec l’en-tête de Sens, invitation refusée', res.corps);
    res = await appelOps({ entetes: { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS }, corps: { action: 'inviter', membreId: 'eq-s', email: EMAIL_OPS } });
    verifier(res.statut === 200 && String(res.corps?.lien).includes(`/espace-operations#espace=${SENS}&jeton=`) && res.corps?.envoye === false, 'opérations : gérant de Sens, lien de Sens à copier', res.corps);
    const lienSens = String(res.corps?.lien);
    verifier(!monde.lignes.has(`${LM}\u0000accesOperations\u0000eq-s`) && (monde.lignes.get(`${SENS}\u0000accesOperations\u0000eq-s`)?.donnees as { espace?: string } | undefined)?.espace === SENS, 'opérations : accès écrit dans Sens seulement');
    res = await appelOps({ corps: { action: 'entrer', jeton: jetonDuLien(lienSens), espace: LM } });
    verifier(res.statut === 401, 'opérations : lien de Sens présenté à Label Maison, refusé', res.corps);
    res = await appelOps({ corps: { action: 'entrer', jeton: jetonDuLien(lienSens), espace: SENS } });
    const cookieSamir = cookieDe(res);
    verifier(res.statut === 200 && !!cookieSamir, 'opérations : lien de Sens, session ouverte', res.corps);
    res = await appelOps({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieSamir } });
    const texte = JSON.stringify(res.corps?.vue ?? {});
    verifier(res.statut === 200 && res.corps?.vue?.logements?.map((l: { id: string }) => l.id).join() === 'log-s' && res.corps?.vue?.conciergerie?.nom === 'Sens', 'opérations : son logement de Sens, au nom de Sens', res.corps?.vue?.logements);
    verifier(!/Alice|log-a|Agathe|Label Maison/.test(texte), 'opérations : rien de Label Maison', texte.slice(0, 200));
    res = await appelOps({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAgathe } });
    verifier(res.statut === 200 && !/log-s|Samir|Sophie/.test(JSON.stringify(res.corps?.vue ?? {})), 'opérations : la personne de Label Maison ne voit rien de Sens');
    const [nom, valeur] = cookieSamir.split('=');
    const [corps, signature] = valeur.split('.');
    const charge = JSON.parse(Buffer.from(corps, 'base64url').toString()) as Record<string, unknown>;
    res = await appelOps({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: `${nom}=${Buffer.from(JSON.stringify({ ...charge, e: LM })).toString('base64url')}.${signature}` } });
    verifier(res.statut === 401, 'opérations : cookie dont l’espace est changé, refusé', res.statut);
    monde.oublier();
    res = await appelOps({ corps: { action: 'lien', email: EMAIL_OPS } });
    const liens = (e: string, id: string) => ((monde.lignes.get(`${e}\u0000accesOperations\u0000${id}`)?.donnees as { liens?: { motif: string }[] } | undefined)?.liens ?? []).filter((l) => l.motif === 'connexion').length;
    verifier(res.statut === 200 && liens(LM, 'eq-a') === 1 && liens(SENS, 'eq-s') === 1, 'opérations : demande de lien, un lien dans chaque espace où l’adresse a un accès', res.corps);

    // Agir : la photo d'un autre dossier refusée, l'incident écrit dans Sens seulement, relu avant d'écrire.
    const signaler = (photos: string[]) =>
      appelOps({ entetes: { cookie: cookieSamir }, corps: { action: 'agir', operation: { type: 'signaler', logementId: 'log-s', urgent: false, description: 'Volet cassé dans la chambre.', photos } } });
    res = await signaler(['stockage://erp-fichiers/operations/eq-s/lqx1-abc123.jpg']);
    verifier(res.statut === 400, 'opérations : photo hors du dossier de Sens, refusée', res.corps);
    monde.oublier();
    res = await signaler([]);
    const idIncident = String(res.corps?.id ?? '');
    verifier(
      res.statut === 200 && !!idIncident && monde.lignes.has(`${SENS}\u0000incidents\u0000${idIncident}`) && !monde.lignes.has(`${LM}\u0000incidents\u0000${idIncident}`),
      'opérations : incident signalé, écrit dans Sens seulement',
      [...monde.lignes.keys()].filter((k) => k.includes('incidents')),
    );
    verifier(monde.base.some((r) => r.methode === 'GET' && r.chemin === 'enregistrements' && r.url.searchParams.get('collection') === 'eq.incidents' && !!r.url.searchParams.get('id')?.startsWith('in.')), 'opérations : l’incident est relu juste avant d’être écrit');
  }

  section('Relances de paiement : chaque espace, son calendrier, son expéditeur');
  {
    env.RESEND_API_KEY = 're_test';
    env.CONTACT_FROM_EMAIL = 'Label Maison <bonjour@exemple.invalid>';
    monde.poser(SENS, 'factures', facture('fac-s', 'pro-s', 6));
    monde.poser(SENS, 'reglagesRelances', { id: 'relances', actif: true, mode: 'automatique', jours: [5, 15, 30] } as { id: string });
    monde.oublier();
    monde.emails = [];
    let res = reponse();
    await routeSynchro(requete({ entetes: { authorization: 'Bearer secret-cron' } }), res);
    verifier(relance(SENS, 'fac-s-r1')?.statut === 'proposee' && relance(SENS, 'fac-s-r1')?.motif === 'sans_expediteur', 'Sens, automatique sans expéditeur : la relance attend une validation', relance(SENS, 'fac-s-r1'));
    verifier(monde.emails.length === 0, 'passage quotidien : aucun e-mail (Label Maison « proposer », Sens sans expéditeur)', monde.emails);
    verifier(!monde.lignes.has(`${LM}\u0000relancesPaiement\u0000fac-s-r1`) && !monde.lignes.has(`${SENS}\u0000relancesPaiement\u0000fac-lm-r1`), 'relances rangées chacune dans son espace');
    const avant = [...monde.lignes.keys()].filter((k) => k.includes('relancesPaiement')).length;
    await routeSynchro(requete({ entetes: { authorization: 'Bearer secret-cron' } }), reponse());
    verifier([...monde.lignes.keys()].filter((k) => k.includes('relancesPaiement')).length === avant && monde.emails.length === 0, 'nouveau passage le même jour : rien de plus, rien d’envoyé');

    // Validation par un gérant : expéditeur de l'espace, une seule fois.
    const gerantLM = { authorization: 'Bearer jeton-equipe', 'x-erp-espace': LM };
    const gerantSens = { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS };
    res = await appelProprio({ entetes: gerantLM, corps: { action: 'relance-envoyer', id: 'fac-lm-r1' } });
    verifier(res.statut === 200 && monde.emails.length === 1 && monde.emails[0].from === env.CONTACT_FROM_EMAIL && monde.emails[0].to[0] === EMAIL_PROPRIO && /N-fac-lm/.test(monde.emails[0].subject), 'gérant de Label Maison : relance envoyée avec l’expéditeur de Label Maison', monde.emails);
    verifier(relance(LM, 'fac-lm-r1')?.statut === 'envoyee', 'relance notée envoyée');
    res = await appelProprio({ entetes: gerantLM, corps: { action: 'relance-envoyer', id: 'fac-lm-r1' } });
    verifier(res.statut === 409 && monde.emails.length === 1, 'deuxième envoi : refusé, jamais deux fois', res.corps);
    res = await appelProprio({ entetes: { ...gerantLM, 'x-erp-espace': SENS }, corps: { action: 'relance-envoyer', id: 'fac-s-r1' } });
    verifier(res.statut === 403, 'compte de Label Maison sur une relance de Sens : refusé', res.corps);
    res = await appelProprio({ entetes: gerantLM, corps: { action: 'relance-envoyer', id: 'fac-s-r1' } });
    verifier(res.statut === 409 && monde.emails.length === 1, 'relance de Sens demandée dans Label Maison : introuvable', res.corps);
    res = await appelProprio({ entetes: gerantSens, corps: { action: 'relance-envoyer', id: 'fac-s-r1' } });
    verifier(res.statut === 409 && monde.emails.length === 1 && relance(SENS, 'fac-s-r1')?.statut === 'proposee', 'Sens sans expéditeur : rien ne part (jamais celui de Label Maison)', res.corps);
    monde.espaces[1].config = { ...monde.espaces[1].config, email: { expediteur: 'Sens <bonjour@sens.invalid>' } };
    res = await appelProprio({ entetes: gerantSens, corps: { action: 'relance-envoyer', id: 'fac-s-r1' } });
    const mailSens = monde.emails[1];
    verifier(res.statut === 200 && mailSens?.from === 'Sens <bonjour@sens.invalid>' && /Sens/.test(mailSens.text) && !/Label Maison/.test(mailSens.text), 'Sens avec son expéditeur : envoyée en son nom', mailSens);
    res = await appelProprio({ methode: 'GET', query: { action: 'relances' }, entetes: gerantSens });
    verifier(res.statut === 200 && res.corps?.relances?.every((r: { factureId: string }) => r.factureId === 'fac-s') && res.corps?.reglages?.mode === 'automatique', 'liste des relances : celles de l’espace seulement', res.corps);

    // Automatique avec expéditeur : envoyée au passage, une seule fois.
    monde.poser(LM, 'reglagesRelances', { id: 'relances', actif: true, mode: 'automatique', jours: [5, 15, 30] } as { id: string });
    monde.poser(LM, 'factures', facture('fac-lm3', 'pro-a', 7));
    await routeSynchro(requete({ entetes: { authorization: 'Bearer secret-cron' } }), reponse());
    verifier(relance(LM, 'fac-lm3-r1')?.statut === 'envoyee' && relance(LM, 'fac-lm3-r1')?.envoyeePar === 'automatique' && monde.emails.length === 3, 'Label Maison automatique : envoyée au passage', monde.emails.length);
    await routeSynchro(requete({ entetes: { authorization: 'Bearer secret-cron' } }), reponse());
    verifier(monde.emails.length === 3, 'passage suivant : jamais renvoyée');

    // Arrêt au paiement.
    monde.poser(LM, 'reglagesRelances', { id: 'relances', actif: true, mode: 'proposer', jours: [5, 15, 30] } as { id: string });
    monde.poser(LM, 'factures', facture('fac-lm2', 'pro-a', 20));
    await routeSynchro(requete({ entetes: { authorization: 'Bearer secret-cron' } }), reponse());
    verifier(relance(LM, 'fac-lm2-r2')?.statut === 'proposee' && !relance(LM, 'fac-lm2-r1'), '20 jours de retard : seule l’étape J+15 est proposée');
    monde.poser(LM, 'factures', facture('fac-lm2', 'pro-a', 20, { statut: 'payee', payeeLe: ilYa(1) }));
    await routeSynchro(requete({ entetes: { authorization: 'Bearer secret-cron' } }), reponse());
    res = await appelProprio({ entetes: gerantLM, corps: { action: 'relance-envoyer', id: 'fac-lm2-r2' } });
    verifier(relance(LM, 'fac-lm2-r2')?.statut === 'sans_objet' && res.statut === 409 && monde.emails.length === 3, 'facture payée : relance sans objet, rien ne part', relance(LM, 'fac-lm2-r2'));

    // Ce que voit le propriétaire : ses factures partagées, le dernier rappel.
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAlice } });
    const factures = (res.corps?.vue?.factures ?? []) as { id: string; dernierRappel?: string }[];
    verifier(factures.some((f) => f.id === 'fac-lm' && !!f.dernierRappel) && !factures.some((f) => f.id === 'fac-s'), 'propriétaire de Label Maison : ses factures et leurs rappels, rien de Sens', factures);
    delete env.RESEND_API_KEY;
    delete env.CONTACT_FROM_EMAIL;
  }

  section('Audit des accès extérieurs (octobre 2026)');
  {
    env.RESEND_API_KEY = 're_test';
    env.CONTACT_FROM_EMAIL = 'Label Maison <bonjour@exemple.invalid>';
    const PIRATE = 'https://labelmaisonconciergerie-pirate.vercel.app';
    const APERCU = 'https://labelmaisonconciergerie-apercu-1.vercel.app';
    const gerantLM = { authorization: 'Bearer jeton-equipe', 'x-erp-espace': LM };
    const lienDuMail = (m?: { text: string }) => /Ouvrir mon espace : (\S+)/.exec(m?.text ?? '')?.[1] ?? '';
    const depuis = (origin: string, ip: string) => ({ origin, 'x-forwarded-for': ip });

    // B1 : origines acceptées, site des liens.
    verifier(SITE_PAR_DEFAUT === 'https://www.labelmaisoncg.fr' && adresseSite() === SITE_PAR_DEFAUT, 'site des liens : https://www.labelmaisoncg.fr par défaut', adresseSite());
    env.SITE_URL = 'https://site.exemple.invalid/chemin';
    const avecVariable = adresseSite();
    env.SITE_URL = 'http://site.exemple.invalid';
    const enHttp = adresseSite();
    delete env.SITE_URL;
    verifier(avecVariable === 'https://site.exemple.invalid' && enHttp === SITE_PAR_DEFAUT, 'SITE_URL : origine https seulement', [avecVariable, enHttp]);
    verifier(
      !origineAutorisee(PIRATE) && !origineAutorisee('https://labelmaisoncg.fr.pirate.example') && !origineAutorisee('http://labelmaisoncg.fr') && !origineAutorisee('null') && !origineAutorisee(''),
      'origines : plus de *.vercel.app, ni sous-domaine piégé, ni http, ni « null »',
    );
    verifier(['https://labelmaisoncg.fr', 'https://www.labelmaisoncg.fr', 'https://www.labelmaisoncgexperience.fr', 'https://www.labelmaisoncg.fr/espace-proprietaire?x=1'].every(origineAutorisee), 'origines : le site (avec ou sans www, ou une page)');
    verifier(!origineAutorisee(APERCU), 'aperçu Vercel : refusé sans ORIGINES_APERCU');
    env.ORIGINES_APERCU = `${APERCU}, https://autre-apercu.vercel.app`;
    verifier(origineAutorisee(APERCU) && !origineAutorisee(`${APERCU}.pirate.example`) && !origineAutorisee(PIRATE), 'ORIGINES_APERCU : origines exactes seulement');
    env.VERCEL_ENV = 'production';
    const localEnLigne = origineAutorisee('http://localhost:5173');
    delete env.VERCEL_ENV;
    verifier(!localEnLigne && origineAutorisee('http://localhost:5173'), 'localhost : jamais sur Vercel en ligne, permis en local');

    // B1 : l'invitation demandée depuis une page tierce garde le site fixe.
    monde.poser(LM, 'proprietaires', { id: 'pro-c', nom: 'Carla Audit', contact: { email: 'carla@exemple.invalid', telephone: '' } } as { id: string });
    monde.poser(LM, 'logements', { id: 'log-c', nom: 'Chez Carla', ville: 'Évry', statut: 'actif', proprietaireId: 'pro-c', capacite: 2, chambres: 1 } as { id: string });
    monde.emails = [];
    let res = await appelProprio({ entetes: { ...gerantLM, origin: PIRATE }, corps: { action: 'inviter', proprietaireId: 'pro-c', email: 'carla@exemple.invalid' } });
    verifier(res.statut === 200 && String(res.corps?.lien).startsWith(`${SITE_PAR_DEFAUT}/espace-proprietaire#espace=${LM}&jeton=`) && lienDuMail(monde.emails[0]).startsWith(`${SITE_PAR_DEFAUT}/`), 'invitation appelée avec une Origin tierce : lien et e-mail sur le site fixe', { lien: String(res.corps?.lien).replace(/jeton=.*/, 'jeton=…'), mail: lienDuMail(monde.emails[0]).replace(/jeton=.*/, 'jeton=…') });
    verifier((monde.lignes.get(`${LM}\u0000accesProprietaires\u0000pro-c`)?.donnees as { emailFiche?: string } | undefined)?.emailFiche === 'carla@exemple.invalid', 'invitation : adresse de la fiche relevée dans l’accès');
    const lienInvitation = String(res.corps?.lien);
    res = await appelProprio({ entetes: depuis(PIRATE, '198.51.100.1'), corps: { action: 'entrer', jeton: jetonDuLien(lienInvitation), espace: LM } });
    verifier(res.statut === 403 && !res.entetes['Set-Cookie'], 'entrer depuis une Origin tierce : refusé, pas de session', res.corps);
    res = await appelProprio({ entetes: depuis(PIRATE, '198.51.100.2'), corps: { action: 'lien', email: 'carla@exemple.invalid' } });
    verifier(res.statut === 403, '« Recevoir mon lien » depuis une Origin tierce : refusé', res.corps);
    monde.emails = [];
    res = await appelProprio({ entetes: depuis(APERCU, '198.51.100.3'), corps: { action: 'lien', email: 'carla@exemple.invalid' } });
    verifier(res.statut === 200 && monde.emails.length === 1 && lienDuMail(monde.emails[0]).startsWith(`${SITE_PAR_DEFAUT}/espace-proprietaire#`), 'demande depuis un aperçu autorisé : le lien reste sur le site fixe', lienDuMail(monde.emails[0]).replace(/jeton=.*/, 'jeton=…'));
    const lienCarla = lienDuMail(monde.emails[0]);

    // Minor 4 : un lien de connexion toutes les 2 minutes au plus, gardé dans l'accès.
    const nbConnexion = (e: string, c: string, id: string) => ((monde.lignes.get(`${e}\u0000${c}\u0000${id}`)?.donnees as { liens?: { motif: string }[] } | undefined)?.liens ?? []).filter((l) => l.motif === 'connexion').length;
    monde.emails = [];
    res = await appelProprio({ entetes: depuis('https://www.labelmaisoncg.fr', '198.51.100.4'), corps: { action: 'lien', email: 'carla@exemple.invalid' } });
    verifier(res.statut === 200 && monde.emails.length === 0 && nbConnexion(LM, 'accesProprietaires', 'pro-c') === 1, 'deuxième demande dans les 2 minutes (autre adresse IP) : même réponse, aucun lien de plus', { emails: monde.emails.length, liens: nbConnexion(LM, 'accesProprietaires', 'pro-c') });

    // A5 : le même lien présenté deux fois en même temps.
    const [e1, e2] = await Promise.all([
      appelProprio({ entetes: depuis('https://www.labelmaisoncg.fr', '198.51.100.5'), corps: { action: 'entrer', jeton: jetonDuLien(lienCarla), espace: LM } }),
      appelProprio({ entetes: depuis('https://www.labelmaisoncg.fr', '198.51.100.6'), corps: { action: 'entrer', jeton: jetonDuLien(lienCarla), espace: LM } }),
    ]);
    verifier([e1.statut, e2.statut].sort().join() === '200,401' && [e1, e2].filter((r) => !!r.entetes['Set-Cookie']).length === 1, 'lien à usage unique présenté deux fois en même temps : une seule session', [e1.statut, e2.statut]);
    const cookieCarla = cookieDe(e1.statut === 200 ? e1 : e2);
    res = await appelProprio({ corps: { action: 'entrer', jeton: jetonDuLien(lienCarla), espace: LM } });
    verifier(res.statut === 401 && res.corps?.code === 'utilise', 'troisième usage : refusé (déjà servi)', res.corps);
    res = await appelProprio({ corps: { action: 'entrer', jeton: jetonDuLien(lienInvitation), espace: LM } });
    verifier(res.statut === 200, 'l’invitation, autre lien, sert encore une fois (rien écrasé par la demande de lien)', res.corps);

    // I3 : l'adresse de la fiche fait foi (propriétaire).
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieCarla } });
    verifier(res.statut === 200, 'session de Carla ouverte', res.statut);
    monde.poser(LM, 'proprietaires', { id: 'pro-c', nom: 'Carla Audit', contact: { email: 'nouvelle-gerance@exemple.invalid', telephone: '' } } as { id: string });
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieCarla } });
    verifier(res.statut === 401, 'adresse changée dans la fiche du propriétaire sans « Retirer » : session refusée', res.statut);
    monde.emails = [];
    monde.poser(LM, 'accesProprietaires', { ...(monde.lignes.get(`${LM}\u0000accesProprietaires\u0000pro-c`)!.donnees as object), liens: [] } as { id: string });
    res = await appelProprio({ entetes: depuis('https://www.labelmaisoncg.fr', '198.51.100.7'), corps: { action: 'lien', email: 'carla@exemple.invalid' } });
    verifier(res.statut === 200 && monde.emails.length === 0 && nbConnexion(LM, 'accesProprietaires', 'pro-c') === 0, 'l’ancienne adresse ne reçoit plus de lien de connexion', monde.emails.map((m) => m.to));
    monde.poser(LM, 'proprietaires', { id: 'pro-c', nom: 'Carla Audit', contact: { email: 'Carla@Exemple.invalid ', telephone: '' } } as { id: string });
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieCarla } });
    verifier(res.statut === 200, 'adresse remise dans la fiche (casse et espaces mis à part) : session valable', res.statut);

    // I3 : règle pure, accès d'avant le relevé compris.
    const a = (o: Partial<AccesExterne>): AccesExterne => ({ id: 'x', email: 'a@x.invalid', statut: 'actif', version: 1, liens: [], ...o });
    verifier(
      accesToujoursDeLaFiche(a({}), { email: 'a@x.invalid' }) &&
        accesToujoursDeLaFiche(a({}), { email: '' }) &&
        !accesToujoursDeLaFiche(a({}), { email: 'b@x.invalid' }) &&
        !accesToujoursDeLaFiche(a({}), undefined) &&
        accesToujoursDeLaFiche(a({ emailFiche: 'f@x.invalid' }), { email: 'f@x.invalid' }) &&
        !accesToujoursDeLaFiche(a({ emailFiche: 'f@x.invalid' }), { email: '' }) &&
        !accesToujoursDeLaFiche(a({ emailFiche: '' }), { email: 'b@x.invalid' }) &&
        accesToujoursDeLaFiche(a({ emailFiche: '' }), { email: 'A@X.invalid' }),
      'règle de la fiche : même adresse, adresse relevée, accès ancien sans adresse de fiche ; fiche absente = non',
    );

    // I3 : même chose pour l'espace opérations (A2 de l'audit).
    monde.poser(LM, 'equipe', { id: 'eq-c', nom: 'Chloé Course', role: 'agent', email: 'chloe@exemple.invalid', logementIds: ['log-a'], actif: true } as { id: string });
    res = await appelOps({ entetes: gerantLM, corps: { action: 'inviter', membreId: 'eq-c', email: 'chloe@exemple.invalid' } });
    verifier(res.statut === 200 && String(res.corps?.lien).startsWith(`${SITE_PAR_DEFAUT}/espace-operations#`), 'opérations : lien d’invitation sur le site fixe', String(res.corps?.lien).replace(/jeton=.*/, 'jeton=…'));
    const lienChloe = String(res.corps?.lien);
    const [o1, o2] = await Promise.all([appelOps({ corps: { action: 'entrer', jeton: jetonDuLien(lienChloe), espace: LM } }), appelOps({ corps: { action: 'entrer', jeton: jetonDuLien(lienChloe), espace: LM } })]);
    verifier([o1.statut, o2.statut].sort().join() === '200,401', 'opérations : lien présenté deux fois en même temps, une seule session', [o1.statut, o2.statut]);
    const cookieChloe = cookieDe(o1.statut === 200 ? o1 : o2);
    monde.poser(LM, 'equipe', { id: 'eq-c', nom: 'Chloé Course', role: 'agent', email: 'remplacante@exemple.invalid', logementIds: ['log-a'], actif: true } as { id: string });
    res = await appelOps({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieChloe } });
    verifier(res.statut === 401, 'opérations : adresse changée dans la fiche équipe, session refusée', res.statut);
    monde.emails = [];
    res = await appelOps({ entetes: depuis('https://www.labelmaisoncg.fr', '198.51.100.8'), corps: { action: 'lien', email: 'chloe@exemple.invalid' } });
    verifier(res.statut === 200 && monde.emails.length === 0, 'opérations : l’ancienne adresse ne reçoit plus de lien', monde.emails.map((m) => m.to));
    res = await appelOps({ entetes: depuis(PIRATE, '198.51.100.9'), corps: { action: 'lien', email: EMAIL_OPS } });
    verifier(res.statut === 403, 'opérations : « Recevoir mon lien » depuis une Origin tierce, refusé', res.corps);

    // A3 : fiche d'espace introuvable, jamais l'expéditeur ni les contacts de Label Maison.
    verifier(expediteurEspace(undefined) === undefined && contactsEspace(undefined) === undefined, 'fiche d’espace absente : ni expéditeur ni contacts de Label Maison', expediteurEspace(undefined));
    verifier(expediteurEspace(undefined, LM)?.from === env.CONTACT_FROM_EMAIL && !!contactsEspace(undefined, LM) && expediteurEspace(undefined, SENS) === undefined, 'fiche illisible mais espace explicitement Label Maison : Label Maison ; Sens : rien');
    monde.poser(SENS, 'equipe', { id: 'eq-s2', nom: 'Sacha Sens', role: 'agent', email: 'sacha@exemple.invalid', logementIds: ['log-s'], actif: true } as { id: string });
    monde.emails = [];
    monde.panneEspacesActifs = true;
    res = await appelOps({ entetes: { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS }, corps: { action: 'inviter', membreId: 'eq-s2', email: 'sacha@exemple.invalid' } });
    monde.panneEspacesActifs = false;
    verifier(res.statut === 200 && res.corps?.envoye === false && monde.emails.length === 0, 'panne de la fiche de Sens pendant une invitation : aucun e-mail au nom de Label Maison (lien à copier)', { envoye: res.corps?.envoye, mails: monde.emails.map((m) => m.from) });

    // A4 : deux validations simultanées d'une même relance.
    monde.poser(LM, 'factures', facture('fac-x', 'pro-a', 6));
    monde.poser(LM, 'relancesPaiement', { id: 'fac-x-r1', factureId: 'fac-x', proprietaireId: 'pro-a', numero: 'N-fac-x', niveau: 1, joursApresEcheance: 5, dueLe: ilYa(1), statut: 'proposee', creeLe: new Date().toISOString() } as { id: string });
    monde.emails = [];
    const [r1, r2] = await Promise.all([appelProprio({ entetes: gerantLM, corps: { action: 'relance-envoyer', id: 'fac-x-r1' } }), appelProprio({ entetes: gerantLM, corps: { action: 'relance-envoyer', id: 'fac-x-r1' } })]);
    verifier(monde.emails.length === 1 && [r1.statut, r2.statut].sort().join() === '200,409' && relance(LM, 'fac-x-r1')?.statut === 'envoyee', 'relance validée deux fois en même temps : un seul e-mail', { statuts: [r1.statut, r2.statut], emails: monde.emails.length });
    verifier(/https:\/\/www\.labelmaisoncg\.fr\/espace-proprietaire/.test(monde.emails[0]?.text ?? ''), 'lien des relances : site fixe', monde.emails[0]?.text);
    monde.poser(LM, 'relancesPaiement', { id: 'fac-x-r2', factureId: 'fac-x', proprietaireId: 'pro-a', numero: 'N-fac-x', niveau: 2, joursApresEcheance: 15, dueLe: ilYa(1), statut: 'proposee', creeLe: new Date().toISOString() } as { id: string });
    monde.emails = [];
    const [r3, r4] = await Promise.all([appelProprio({ entetes: gerantLM, corps: { action: 'relance-annuler', id: 'fac-x-r2' } }), appelProprio({ entetes: gerantLM, corps: { action: 'relance-envoyer', id: 'fac-x-r2' } })]);
    const fin = relance(LM, 'fac-x-r2')?.statut;
    verifier([r3.statut, r4.statut].sort().join() === '200,409' && ((fin === 'annulee' && monde.emails.length === 0) || (fin === 'envoyee' && monde.emails.length === 1)), 'annuler et envoyer en même temps : l’un ou l’autre, jamais « annulée » avec un e-mail parti', { statuts: [r3.statut, r4.statut], fin, emails: monde.emails.length });

    // Minor 6 : facture voyageur rattachée au propriétaire, jamais partagée ni relancée.
    monde.poser(LM, 'factures', facture('fac-v', 'pro-a', 6, { destinataire: 'voyageur' }));
    await relancesDuJour();
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAlice } });
    verifier(!relance(LM, 'fac-v-r1') && !((res.corps?.vue?.factures ?? []) as { id: string }[]).some((f) => f.id === 'fac-v'), 'facture voyageur : ni montrée au propriétaire ni relancée', res.corps?.vue?.factures);

    // Minor 5 : ids encodés dans l'adresse de lecture.
    monde.oublier();
    await baseAcces(LM).lire('recette', ['a&b=c', 'd#e', 'f+g']);
    const lecture = monde.base.find((r) => r.methode === 'GET' && r.url.searchParams.get('collection') === 'eq.recette');
    verifier(lecture?.url.searchParams.get('id') === 'in.("a&b=c","d#e","f+g")' && !lecture?.url.searchParams.has('b'), 'lecture par ids : « & », « # », « + » encodés', lecture?.url.search);
    delete env.ORIGINES_APERCU;
    delete env.RESEND_API_KEY;
    delete env.CONTACT_FROM_EMAIL;
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
    verifier(res.statut === 401 && JSON.stringify(res.corps) === '{"ok":false}', 'adresse de Sens sans secret rangé : refusée comme une signature fausse', res.corps);
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
    verifier(res.statut === 401 && JSON.stringify(res.corps) === '{"ok":false}', 'espace inconnu : même réponse qu’une signature fausse', res);
    res = reponse();
    await routeWebhook(webhook(message, 'whsec_faux', { espace: 'sens' }), res);
    verifier(res.statut === 401 && JSON.stringify(res.corps) === '{"ok":false}', 'signature fausse : la même réponse', res.statut);
  }

  section('Retour en arrière du SQL');
  {
    const c = configuration();
    verifier((await etatBase(c)).serveur, 'état gardé : base préparée, compte serveur prêt');
    monde.historique = true;
    let m = '';
    await baseErp(c).lire('crm').catch((x: Error) => (m = x.message));
    verifier(m === MESSAGE_BASE_PAS_PREPAREE, 'colonne espace refusée : « Base pas encore préparée »', m);
    verifier((await etatBase(c)).mode === 'historique', 'état oublié aussitôt : la base est relue (historique)');
    monde.oublier();
    await baseErp(c).lire('crm');
    const r = monde.base[monde.base.length - 1];
    verifier(r.espace === null && r.jeton === 'jeton-equipe', 'Label Maison repart comme avant (compte d’équipe, sans espace)', r.espace);
  }

  process.stdout.write(`\n${reussis} contrôles réussis, ${echecs} en échec.\n`);
  process.exitCode = echecs ? 1 : 0;
}

principal().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
