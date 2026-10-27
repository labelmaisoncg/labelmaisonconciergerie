/**
 * Auto-contrôle de la connexion à l'ERP (middleware.ts) sans réseau : faux
 * Supabase (comptes, erp.qui_suis_je, erp.membres, rafraîchissement) branché
 * sur le fetch global, variables de Vercel simulées.
 *
 * Vérifie : page e-mail + mot de passe sans « Retour au site », connexion d'un
 * membre (base d'avant les espaces et après), refus d'un non-membre, d'un
 * jeton invalide, d'une demande venue d'un autre site, d'un corps non JSON,
 * redirection ouverte impossible, ancien cookie (mot de passe partagé)
 * refusé, cookie modifié refusé, relais : session remise une fois puis
 * effacée, lié au compte, jamais la session du compte d'équipe, page des
 * liens « mot de passe oublié » (script valide, rien de dangereux injecté),
 * « Créer mon compte » (lien #creer=…&code=… : code gardé sur l'appareil,
 * adresse fixe, rien d'envoyé ; sans code ou base d'avant les espaces : pas
 * de création, message prévu ; deux saisies, 8 caractères, inscription vers
 * le site fixe, même réponse qu'un compte existe ou non, jamais de connexion
 * depuis la création ; dernière étape : mot de passe envoyé avec le code ;
 * compte refusé : retour au formulaire), activation par le code (compte créé
 * avant par un autre : rien sans code ; faux code, code expiré ou déjà
 * servi : refus neutre ; mot de passe posé, autres sessions fermées, puis
 * activation et session renouvelée ; membre lié à la passe 1 sans code ;
 * invitation de conciergerie sans code : rien), raison du refus (espace
 * suspendu, invitation expirée ou annulée), invitation à créer l'espace
 * d'une conciergerie (en attente : entre ; échue ou de forme inconnue :
 * refusée ; base d'avant les espaces : inchangée), zone du linge inchangée.
 *
 * Fichier hors de l'ERP (middleware) : pas dans tsc.
 * Lancement (Node 20+) :
 *   node_modules/.bin/esbuild scripts/verifier-connexion-erp.ts --bundle --platform=node --format=esm \
 *     --log-level=error --outfile=/tmp/verifier-connexion-erp.mjs && node /tmp/verifier-connexion-erp.mjs
 */
import crypto from 'node:crypto';
import vm from 'node:vm';
import middleware from '../middleware';
import { MESSAGE_LIEN_PERIME as MESSAGE_LIEN_PERIME_APPLI } from '../src/erp/data/invitation';

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

/* ------------------------------------------------------------ environnement */

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const MDP_ERP = 'mot-de-passe-equipe-de-test';
const MDP_LINGE = 'linge-de-test';
env.ERP_PASSWORD = MDP_ERP;
env.LINGE_PASSWORD = MDP_LINGE;

const SITE = 'https://www.labelmaisoncg.fr';
const SUPA = 'https://ftfwnomkbjtlpijdevgx.supabase.co';

/* ------------------------------------------------------------ faux Supabase */

interface Compte {
  id: string;
  email: string;
  membre: boolean;
  /** Adresse telle qu'écrite dans erp.membres, si elle diffère (casse). */
  stocke?: string;
}
const ABDEL: Compte = { id: '11111111-2222-4333-8444-555555555555', email: 'abdel@exemple.fr', membre: true };
const INCONNU: Compte = { id: '99999999-2222-4333-8444-555555555555', email: 'inconnu@exemple.fr', membre: false };
const EQUIPE: Compte = { id: '22222222-2222-4333-8444-555555555555', email: 'equipe@labelmaisoncg.fr', membre: true };
const COMPTES = [ABDEL, INCONNU, EQUIPE];
const jetonDe = (c: Compte) => `acces-${c.id}`;

let base: 'historique' | 'espaces' | 'en-panne' = 'historique';
/** Invitations à créer l'espace d'une conciergerie (champ invitations_espace de erp.qui_suis_je), par compte. */
const invitationsEspace = new Map<string, unknown>();
const appels: string[] = [];
const rafraichissements: string[] = [];
/** Rafraîchissement : jeton → compte qu'il ouvre (un autre compte pour éprouver le contrôle). */
const proprietaireRafraichir = new Map<string, Compte>();

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });

/* ---------------------------------- comptes invités (activation par le code) */
// GoTrue (sessions, mot de passe, fermeture des autres sessions) et erp.activer
// / erp.qui_suis_je simulés : un jeton porte son instant d'émission (iat) et sa
// session ; la base ne reconnaît un compte lié qu'avec un jeton émis après
// l'activation (lieLe), comme erp.jeton_apres.

interface CompteInvite {
  id: string;
  email: string;
  motDePasse: string;
  lie: boolean;
  /** Instant de l'activation ; null : lié d'office (passe 1). */
  lieLe: number | null;
  genre?: 'membre' | 'espace';
  /** Champs de refus rendus par erp.qui_suis_je (espaces_suspendus, invitations_espace_closes). */
  refus?: Record<string, unknown>;
}
interface SessionInvite {
  acces: string;
  rafraichir: string;
}
let horloge = 1000;
let compteurInvites = 0;
const jetonsInvites = new Map<string, { compte: CompteInvite; iat: number; session: string }>();
const rafraichissementsInvites = new Map<string, { compte: CompteInvite; session: string }>();
const codesInvitation = new Map<string, { email: string; genre: 'membre' | 'espace'; utilise: boolean; expire: boolean }>();
const appelsInvites: string[] = [];
let panneDeconnexion = false;
const MESSAGE_NEUTRE =
  'Ce compte n’a pas accès à l’ERP. Vous avez reçu une invitation ? Ouvrez son lien sur cet appareil. Sinon, demandez à un gérant de vous ajouter.';
/** Code refusé (déjà servi, remplacé, expiré) et pas d'accès : on ne renvoie pas vers ce même lien. */
const MESSAGE_LIEN_PERIME = 'Ce lien d’invitation n’est plus valable (déjà utilisé, remplacé ou expiré) : demandez qu’on vous le renvoie.';

function compteInvite(email: string, motDePasse: string): CompteInvite {
  const c: CompteInvite = { id: `aaaaaaaa-0000-4000-8000-${String(++compteurInvites).padStart(12, '0')}`, email, motDePasse, lie: false, lieLe: null };
  return c;
}
function emettre(compte: CompteInvite, session: string): SessionInvite {
  const iat = ++horloge;
  const s = { acces: `jeton:${compte.id}:${iat}:${session}`, rafraichir: `rafr:${compte.id}:${iat}:${session}` };
  jetonsInvites.set(s.acces, { compte, iat, session });
  rafraichissementsInvites.set(s.rafraichir, { compte, session });
  return s;
}
const ouvrirSession = (compte: CompteInvite): SessionInvite => emettre(compte, `s${++horloge}`);

function fauxInvites(url: URL, methode: string, init: RequestInit | undefined, jeton: string): Response {
  const j = jetonsInvites.get(jeton);
  if (j) appelsInvites.push(`${jeton} ${methode} ${url.pathname}${url.search}`);
  const corps = JSON.parse(String(init?.body ?? '') || '{}') as Record<string, unknown>;
  if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
    const r = String(corps.refresh_token ?? '');
    const s = rafraichissementsInvites.get(r);
    if (!s) return json({ error: 'invalid_grant', error_description: 'Invalid Refresh Token: Refresh Token Not Found' }, 400);
    rafraichissementsInvites.delete(r);
    const n = emettre(s.compte, s.session);
    return json({ access_token: n.acces, refresh_token: n.rafraichir, user: { id: s.compte.id } });
  }
  if (!j) return json({ msg: 'invalid JWT' }, 401);
  const c = j.compte;
  // GoTrue refuse le jeton d'une session fermée ; PostgREST ne regarde que le jeton.
  const ouverte = [...rafraichissementsInvites.values()].some((x) => x.session === j.session);
  if (url.pathname === '/auth/v1/user' && methode === 'GET') return ouverte ? json({ id: c.id, email: c.email }) : json({ msg: 'Session not found' }, 403);
  if (url.pathname === '/auth/v1/user' && methode === 'PUT') {
    if (!ouverte) return json({ msg: 'Session not found' }, 403);
    if (corps.password === c.motDePasse) return json({ code: 422, error_code: 'same_password', msg: 'New password should be different from the old password.' }, 422);
    c.motDePasse = String(corps.password);
    return json({ id: c.id, email: c.email });
  }
  if (url.pathname === '/auth/v1/logout' && url.searchParams.get('scope') === 'others') {
    if (panneDeconnexion) return json({ msg: 'boom' }, 500);
    if (!ouverte) return json({ msg: 'Session not found' }, 403);
    for (const [k, v] of rafraichissementsInvites) if (v.compte === c && v.session !== j.session) rafraichissementsInvites.delete(k);
    return new Response(null, { status: 204 });
  }
  if (url.pathname === '/rest/v1/rpc/activer') {
    const code = codesInvitation.get(String(corps.p_code ?? ''));
    if (!code || code.utilise || code.expire || code.email !== c.email) return json({ code: '42501', message: 'Invitation introuvable ou plus valable.' }, 403);
    code.utilise = true;
    c.lie = true;
    c.lieLe = horloge;
    c.genre = code.genre;
    return json({ genre: code.genre });
  }
  if (url.pathname === '/rest/v1/rpc/qui_suis_je') {
    const vaut = c.lie && (c.lieLe === null || j.iat > c.lieLe);
    return json({
      espaces: vaut && c.genre !== 'espace' ? [{ id: '4c4d0000-0000-4000-8000-000000000001', code: 'lm', nom: 'Label Maison', role: 'gerant' }] : [],
      invitations_espace: vaut && c.genre === 'espace' ? [{ nom_espace: 'Côte', expire_le: new Date(Date.now() + 86_400_000).toISOString() }] : [],
      ...(c.refus ?? {}),
    });
  }
  return json({ message: 'inconnu' }, 404);
}


const fauxFetch = async (entree: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
  const methode = (init?.method ?? 'GET').toUpperCase();
  const entetes = new Headers(init?.headers);
  appels.push(`${methode} ${url.pathname}${url.search}`);
  if (url.origin !== SUPA) throw new Error(`réseau interdit : ${url.href}`);
  const jeton = (entetes.get('authorization') ?? '').replace(/^Bearer /, '');
  const compte = COMPTES.find((c) => jetonDe(c) === jeton);
  if (jetonsInvites.has(jeton) || (url.pathname === '/auth/v1/token' && /"refresh_token":"rafr:/.test(String(init?.body ?? '')))) {
    return fauxInvites(url, methode, init, jeton);
  }

  if (url.pathname === '/auth/v1/user' && methode === 'GET') {
    return compte ? json({ id: compte.id, email: compte.email.toUpperCase() }) : json({ msg: 'invalid JWT' }, 401);
  }
  if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
    const r = String(JSON.parse(String(init?.body ?? '{}')).refresh_token ?? '');
    rafraichissements.push(r);
    const c = proprietaireRafraichir.get(r);
    if (!c) return json({ error: 'invalid_grant' }, 400);
    proprietaireRafraichir.delete(r);
    return json({ access_token: jetonDe(c), refresh_token: `${r}-suivant`, user: { id: c.id } });
  }
  if (url.pathname === '/auth/v1/token') return json({ error: 'interdit dans ce test' }, 400); // connexion par mot de passe
  if (url.pathname === '/rest/v1/rpc/qui_suis_je') {
    if (base === 'en-panne') return json({ message: 'boom' }, 500);
    if (base === 'historique') return json({ code: 'PGRST202', message: 'Could not find the function erp.qui_suis_je' }, 404);
    if (entetes.get('content-profile') !== 'erp') return json({ message: 'schéma' }, 400);
    const invitations = compte && invitationsEspace.has(compte.id) ? { invitations_espace: invitationsEspace.get(compte.id) } : {};
    return json({ espaces: compte?.membre ? [{ id: '4c4d0000-0000-4000-8000-000000000001', code: 'lm', nom: 'Label Maison', role: 'gerant' }] : [], ...invitations });
  }
  if (url.pathname === '/rest/v1/membres') {
    if (entetes.get('accept-profile') !== 'erp') return json({ message: 'schéma' }, 400);
    // erp.membres tel que saisi (casse comprise) ; RLS : toute la table pour
    // un membre, sa seule ligne (même adresse, sans la casse) sinon.
    const table = COMPTES.filter((c) => c.membre).map((c) => c.stocke ?? c.email);
    const moi = compte?.email.toLowerCase() ?? '';
    const visibles = table.some((e) => e.toLowerCase() === moi) ? table : table.filter((e) => e.toLowerCase() === moi);
    const filtre = url.searchParams.get('email') ?? '';
    const garde = (e: string) => {
      if (filtre.startsWith('eq.')) return e === filtre.slice(3);
      if (!filtre.startsWith('ilike.')) return false;
      // Motif LIKE de PostgREST : « * » et « % » = n'importe quoi, « _ » = un caractère, « \ » échappe.
      let re = '';
      const m = filtre.slice(6);
      for (let i = 0; i < m.length; i++) {
        const c = m[i];
        if (c === '\\' && i + 1 < m.length) re += m[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        else if (c === '%' || c === '*') re += '.*';
        else if (c === '_') re += '.';
        else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      return new RegExp(`^${re}$`, 'i').test(e);
    };
    return json(visibles.filter(garde).map(() => ({ role: 'gerant' })));
  }
  return json({ message: 'inconnu' }, 404);
};
(globalThis as unknown as { fetch: typeof fauxFetch }).fetch = fauxFetch;

/* ------------------------------------------------------------ outils */

async function appeler(chemin: string, o: { methode?: string; cookies?: Record<string, string>; corps?: unknown; entetes?: Record<string, string> } = {}) {
  const entetes = new Headers(o.entetes);
  if (o.cookies) entetes.set('cookie', Object.entries(o.cookies).map(([k, v]) => `${k}=${v}`).join('; '));
  let body: string | undefined;
  if (o.corps !== undefined) {
    body = typeof o.corps === 'string' ? o.corps : JSON.stringify(o.corps);
    if (!entetes.has('content-type')) entetes.set('content-type', 'application/json');
  }
  const r = await middleware(new Request(`${SITE}${chemin}`, { method: o.methode ?? (body ? 'POST' : 'GET'), headers: entetes, body }));
  return r;
}

function cookiesPoses(r: Response): Record<string, { valeur: string; attributs: string }> {
  const res: Record<string, { valeur: string; attributs: string }> = {};
  for (const ligne of r.headers.getSetCookie()) {
    const [paire, ...attr] = ligne.split(';');
    const i = paire.indexOf('=');
    res[paire.slice(0, i).trim()] = { valeur: paire.slice(i + 1), attributs: attr.join(';') };
  }
  return res;
}

const MEME_ORIGINE = { origin: SITE };
const connexion = (c: Compte, rafraichir = `rafr-${c.id}`, suite = '/erp/logements?onglet=photos', entetes = MEME_ORIGINE) => {
  proprietaireRafraichir.set(rafraichir, c);
  return appeler('/erp/connexion', { corps: { access_token: jetonDe(c), refresh_token: rafraichir, suite }, entetes });
};

function ancienCookie(secret: string): string {
  const exp = String(Math.floor(Date.now() / 1000) + 3600);
  const sig = crypto.createHmac('sha256', secret).update(exp).digest('base64url');
  return `${exp}.${sig}`;
}

/* ------------------------------------------------------------ contrôles */

async function principal() {
  section('Page de connexion de l’ERP');
  {
    const r = await appeler('/erp');
    const html = await r!.text();
    verifier(r!.status === 401, 'sans session : page de connexion (401)', r!.status);
    verifier(html.includes('Adresse e-mail') && html.includes('type="email"') && html.includes('autocomplete="username"'), 'champ adresse e-mail');
    verifier(html.includes('Mot de passe') && html.includes('autocomplete="current-password"'), 'champ mot de passe');
    verifier(html.includes('Mot de passe oublié ?'), '« Mot de passe oublié ? »');
    verifier(!html.includes('Retour au site'), 'plus de « Retour au site » sur l’ERP');
    verifier(!html.includes('name="motdepasse" placeholder="Entrez le mot de passe"'), 'plus de mot de passe partagé');
    verifier(!html.includes(MDP_ERP), 'le mot de passe d’équipe n’apparaît jamais dans la page');
    verifier(r!.headers.get('x-frame-options') === 'SAMEORIGIN' && /frame-ancestors 'self'/.test(r!.headers.get('content-security-policy') ?? ''), 'page jamais dans le cadre d’un autre site');
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    verifier(scripts.length === 1, 'un seul script');
    let compile = true;
    try {
      new vm.Script(scripts[0] ?? '');
    } catch (e) {
      compile = false;
      console.error(e);
    }
    verifier(compile, 'script de la page valide');
    verifier(/type === 'recovery' \|\| type === 'invite'/.test(scripts[0] ?? '') && html.includes('id="f-nouveau"'), 'liens reçus par e-mail : « Choisissez votre mot de passe »');
    verifier((scripts[0] ?? '').includes('/auth/v1/recover?redirect_to=') && (scripts[0] ?? '').includes('https://www.labelmaisoncg.fr/erp'), 'mot de passe oublié : retour sur /erp');
    verifier((scripts[0] ?? '').includes('lm-erp-auth'), 'session restée sur l’appareil effacée avant d’ouvrir l’application');

    const piege = await appeler('/erp/logements?x=%3C/script%3E%3Cscript%3Ealert(1)%3C/script%3E');
    const html2 = await piege!.text();
    verifier(!/<\/script><script>alert/i.test(html2), 'adresse piégée : rien d’exécutable injecté');

    const g = await appeler('/erp/connexion');
    verifier(g!.status === 200 && (await g!.text()).includes('Adresse e-mail'), 'GET /erp/connexion : la page');
    const d = await appeler('/erp/deconnexion');
    verifier(/erp_session=;.*Max-Age=0/.test(d!.headers.get('set-cookie') ?? ''), 'déconnexion : session effacée');
  }

  section('Connexion d’un membre (base d’avant les espaces)');
  let sessionAbdel = '';
  let relaisAbdel = '';
  {
    base = 'historique';
    const r = await connexion(ABDEL);
    const corps = (await r!.json()) as { ok?: boolean; suite?: string };
    const c = cookiesPoses(r!);
    verifier(r!.status === 200 && corps.ok === true, 'membre : connecté', corps);
    verifier(corps.suite === '/erp/logements?onglet=photos', 'retour vers la page demandée', corps.suite);
    sessionAbdel = c.erp_session?.valeur ?? '';
    relaisAbdel = c.erp_relais?.valeur ?? '';
    verifier(sessionAbdel.startsWith(`v2.${ABDEL.id}.`), 'session v2 liée au compte', sessionAbdel.slice(0, 50));
    verifier(/HttpOnly/.test(c.erp_session?.attributs ?? '') && /Secure/.test(c.erp_session?.attributs ?? '') && /Path=\/erp\b/.test(c.erp_session?.attributs ?? ''), 'session : HttpOnly, Secure, Path=/erp');
    verifier(/HttpOnly/.test(c.erp_relais?.attributs ?? '') && /SameSite=Strict/.test(c.erp_relais?.attributs ?? '') && /Path=\/erp\/session/.test(c.erp_relais?.attributs ?? '') && /Max-Age=300/.test(c.erp_relais?.attributs ?? ''), 'relais : HttpOnly, Strict, /erp/session, 5 minutes');
    verifier(!relaisAbdel.includes(`rafr-${ABDEL.id}`), 'relais : jeton encodé et signé, pas en clair');
    verifier(appels.some((a) => a.startsWith('GET /rest/v1/membres')), 'base d’avant les espaces : erp.membres lu');

    const ouvert = await appeler('/erp', { cookies: { erp_session: sessionAbdel } });
    verifier(ouvert === undefined, 'avec la session : /erp s’ouvre');
    const sous = await appeler('/erp/reservations', { cookies: { erp_session: sessionAbdel } });
    verifier(!!sous?.headers.get('x-middleware-rewrite')?.endsWith('/erp'), 'sous-route : coquille de l’application');
    const deja = await appeler('/erp/connexion', { cookies: { erp_session: sessionAbdel } });
    verifier(deja!.status === 303 && deja!.headers.get('location') === '/erp', 'déjà connecté : /erp/connexion renvoie à /erp');

    const ouverte = await connexion(ABDEL, 'rafr-x', 'https://exemple-piege.fr/erp');
    verifier(((await ouverte!.json()) as { suite?: string }).suite === '/erp', 'pas de redirection hors de l’ERP');
    const piege2 = await connexion(ABDEL, 'rafr-y', '/erp/deconnexion');
    verifier(((await piege2!.json()) as { suite?: string }).suite === '/erp', 'pas de retour vers la déconnexion');
  }

  section('Refus');
  {
    base = 'historique';
    const non = await connexion(INCONNU);
    const corps = (await non!.json()) as { erreur?: string };
    verifier(non!.status === 403 && /n’a pas accès à l’ERP/.test(corps.erreur ?? ''), 'non-membre : 403 et message clair', corps);
    verifier(cookiesPoses(non!).erp_session === undefined, 'non-membre : aucune session');

    base = 'espaces';
    const nonE = await connexion(INCONNU);
    verifier(nonE!.status === 403, 'espaces : non-membre refusé');
    const ouiE = await connexion(EQUIPE);
    verifier(ouiE!.status === 200 && cookiesPoses(ouiE!).erp_session?.valeur.startsWith(`v2.${EQUIPE.id}.`), 'espaces : compte d’équipe (membre) connecté par le formulaire');
    verifier(appels.some((a) => a === 'POST /rest/v1/rpc/qui_suis_je'), 'espaces : erp.qui_suis_je interrogé');

    base = 'en-panne';
    const panne = await connexion(ABDEL);
    verifier(panne!.status === 502 && cookiesPoses(panne!).erp_session === undefined, 'base en panne : 502, aucune session');
    base = 'historique';

    const faux = await appeler('/erp/connexion', { corps: { access_token: 'n-importe-quoi', refresh_token: 'r' }, entetes: MEME_ORIGINE });
    verifier(faux!.status === 401 && cookiesPoses(faux!).erp_session === undefined, 'jeton invalide : 401');
    const vide = await appeler('/erp/connexion', { corps: {}, entetes: MEME_ORIGINE });
    verifier(vide!.status === 400, 'jetons absents : 400');

    const autre = await connexion(ABDEL, 'rafr-z', '/erp', { origin: 'https://site-piege.example' });
    verifier(autre!.status === 403 && cookiesPoses(autre!).erp_session === undefined, 'autre site (Origin) : refusé');
    const sansOrigine = await connexion(ABDEL, 'rafr-w', '/erp', { 'sec-fetch-site': 'cross-site' } as unknown as typeof MEME_ORIGINE);
    verifier(sansOrigine!.status === 403, 'autre site (Sec-Fetch-Site) : refusé');
    const rien = await connexion(ABDEL, 'rafr-v', '/erp', {} as typeof MEME_ORIGINE);
    verifier(rien!.status === 403, 'origine inconnue : refusé');
    const formulaire = await appeler('/erp/connexion', {
      corps: `motdepasse=${encodeURIComponent(MDP_ERP)}&suite=%2Ferp`,
      entetes: { ...MEME_ORIGINE, 'content-type': 'application/x-www-form-urlencoded' },
    });
    verifier(formulaire!.status === 415 && cookiesPoses(formulaire!).erp_session === undefined, 'ancien formulaire (mot de passe partagé) : refusé');
  }

  section('Anciens cookies et cookies modifiés');
  {
    const ancien = await appeler('/erp', { cookies: { erp_session: ancienCookie(MDP_ERP) } });
    verifier(ancien?.status === 401, 'ancien cookie (mot de passe partagé) : reconnexion demandée');
    const [v, compte, exp, sig] = sessionAbdel.split('.');
    const autreCompte = await appeler('/erp', { cookies: { erp_session: [v, INCONNU.id, exp, sig].join('.') } });
    verifier(autreCompte?.status === 401, 'compte changé dans le cookie : refusé');
    const autreExp = await appeler('/erp', { cookies: { erp_session: [v, compte, String(Number(exp) + 999), sig].join('.') } });
    verifier(autreExp?.status === 401, 'échéance changée : refusée');
    const autreSecret = await appeler('/erp', { cookies: { erp_session: sessionAbdel } });
    verifier(autreSecret === undefined, 'cookie intact : accepté');
    env.ERP_PASSWORD = 'nouveau-mot-de-passe-equipe';
    const change = await appeler('/erp', { cookies: { erp_session: sessionAbdel } });
    verifier(change?.status === 401, 'ERP_PASSWORD changé : toutes les sessions tombent');
    env.ERP_PASSWORD = MDP_ERP;
    const linge = await appeler('/erp', { cookies: { erp_session: ancienCookie(MDP_LINGE) } });
    verifier(linge?.status === 401, 'cookie du linge : n’ouvre pas l’ERP');
  }

  section('Relais vers l’application (/erp/session)');
  {
    const avant = appels.filter((a) => a.includes('grant_type=password')).length;
    const sans = await appeler('/erp/session', { methode: 'POST' });
    verifier(sans!.status === 401, 'sans session : 401');
    const get = await appeler('/erp/session', { cookies: { erp_session: sessionAbdel } });
    verifier(get!.status === 405, 'GET : 405');

    const ok = await appeler('/erp/session', { methode: 'POST', cookies: { erp_session: sessionAbdel, erp_relais: relaisAbdel }, entetes: { 'sec-fetch-site': 'same-origin' } });
    const d = (await ok!.json()) as { ok?: boolean; access_token?: string; refresh_token?: string };
    verifier(ok!.status === 200 && d.access_token === jetonDe(ABDEL) && !!d.refresh_token, 'relais : session du compte remise', d);
    verifier(rafraichissements.includes(`rafr-${ABDEL.id}`), 'relais : le jeton de la connexion est échangé');
    verifier(/erp_relais=;.*Max-Age=0/.test(ok!.headers.get('set-cookie') ?? ''), 'relais effacé après usage');

    const encore = await appeler('/erp/session', { methode: 'POST', cookies: { erp_session: sessionAbdel, erp_relais: relaisAbdel } });
    verifier(encore!.status === 409, 'relais déjà servi : 409');
    const sansRelais = await appeler('/erp/session', { methode: 'POST', cookies: { erp_session: sessionAbdel } });
    verifier(sansRelais!.status === 409, 'sans relais : 409 (connexion de l’application)');

    // Relais d'Abdel présenté avec la session d'un autre compte.
    const rEquipe = await connexion(EQUIPE, 'rafr-equipe');
    const sessionEquipe = cookiesPoses(rEquipe!).erp_session?.valeur ?? '';
    const r2 = await connexion(ABDEL, 'rafr-abdel-2');
    const relais2 = cookiesPoses(r2!).erp_relais?.valeur ?? '';
    const croise = await appeler('/erp/session', { methode: 'POST', cookies: { erp_session: sessionEquipe, erp_relais: relais2 } });
    verifier(croise!.status === 409, 'relais d’un autre compte : refusé');
    const [c, r, s] = relais2.split('.');
    const modifie = await appeler('/erp/session', { methode: 'POST', cookies: { erp_session: sessionAbdel, erp_relais: [c, r.slice(0, -2) + 'AA', s].join('.') } });
    verifier(modifie!.status === 409, 'relais modifié : refusé');

    // Le rafraîchissement ouvre un autre compte que celui de la session : refusé.
    const r3 = await connexion(ABDEL, 'rafr-detourne');
    proprietaireRafraichir.set('rafr-detourne', INCONNU);
    const detourne = await appeler('/erp/session', { methode: 'POST', cookies: { erp_session: sessionAbdel, erp_relais: cookiesPoses(r3!).erp_relais?.valeur ?? '' } });
    verifier(detourne!.status === 409, 'session d’un autre compte au rafraîchissement : refusée');

    const r4 = await connexion(ABDEL, 'rafr-site');
    const site = await appeler('/erp/session', { methode: 'POST', cookies: { erp_session: sessionAbdel, erp_relais: cookiesPoses(r4!).erp_relais?.valeur ?? '' }, entetes: { 'sec-fetch-site': 'cross-site' } });
    verifier(site!.status === 403, 'appel depuis un autre site : refusé');

    const apres = appels.filter((a) => a.includes('grant_type=password')).length;
    verifier(avant === 0 && apres === 0, 'jamais de connexion au compte d’équipe par le serveur', { avant, apres });
  }

  section('Rien d’identifiant dans l’adresse (formulaire sans script)');
  {
    const r = await appeler('/erp');
    const html = await r!.text();
    for (const id of ['f-connexion', 'f-nouveau', 'f-confirmer']) {
      const balise = new RegExp(`<form id="${id}"[^>]*>`).exec(html)?.[0] ?? '';
      verifier(/method="post"/.test(balise) && /action="\/erp\/connexion"/.test(balise), `${id} : envoi en POST vers /erp/connexion`, balise);
    }
    const champs = [...html.matchAll(/<input[^>]*>/g)].map((m) => m[0]).filter((i) => /id="(email|mdp|nouveau)"/.test(i));
    verifier(champs.length === 3 && champs.every((i) => !/\sname=/.test(i)), 'champs d’identifiants sans « name » : rien ne part sans le script', champs);
    verifier(html.includes('<noscript>') && /JavaScript/.test(html), 'sans script : message clair');

    const g = await appeler('/erp/logements?onglet=photos&email=a%40b.fr&motdepasse=SECRET123&Password=X9&access_token=JETON');
    const h = await g!.text();
    verifier(!h.includes('SECRET123') && !h.includes('a@b.fr') && !h.includes('a%40b.fr') && !h.includes('X9') && !h.includes('JETON'), 'adresse avec identifiants : jamais recopiée dans la page');
    verifier(h.includes('"suite":"/erp/logements?onglet=photos"'), 'les autres paramètres restent dans l’adresse de retour', /"suite":"[^"]*"/.exec(h)?.[0]);

    const sansScript = await appeler('/erp/connexion', {
      corps: 'suite=%2Ferp',
      entetes: { ...MEME_ORIGINE, 'content-type': 'application/x-www-form-urlencoded', accept: 'text/html,application/xhtml+xml' },
    });
    const page = await sansScript!.text();
    verifier(sansScript!.status === 415 && page.includes('La connexion demande JavaScript') && !cookiesPoses(sansScript!).erp_session, 'formulaire envoyé sans script : page claire, aucune session');

    const viaJson = await connexion(ABDEL, 'rafr-suite', '/erp/crm?motdepasse=SECRET&vue=liste');
    verifier(((await viaJson!.json()) as { suite?: string }).suite === '/erp/crm?vue=liste', 'retour après connexion : identifiants retirés de l’adresse');
  }

  section('Lien reçu par e-mail : jamais de connexion sans geste');
  {
    const html = await (await appeler('/erp'))!.text();
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])[0] ?? '';
    const jwt = (email: string) => `x.${Buffer.from(JSON.stringify({ email })).toString('base64url')}.y`;
    const essai = (hash: string) => {
      const ecouteurs: Record<string, (ev: { preventDefault(): void }) => void> = {};
      const elements: Record<string, Record<string, unknown>> = {};
      const el = (id: string) =>
        (elements[id] ??= {
          id,
          hidden: id === 'f-nouveau' || id === 'f-confirmer',
          textContent: '',
          value: '',
          disabled: false,
          focus() {},
          select() {},
          addEventListener(type: string, f: (ev: { preventDefault(): void }) => void) {
            ecouteurs[`${id}:${type}`] = f;
          },
          querySelectorAll: () => [],
        });
      const envois: string[] = [];
      vm.runInNewContext(script, {
        document: { getElementById: el },
        location: { hash, pathname: '/erp', search: '', replace() {} },
        history: { state: null, replaceState() {} },
        URLSearchParams,
        localStorage: { removeItem() {} },
        atob: (b: string) => Buffer.from(b, 'base64').toString('binary'),
        escape,
        fetch: (u: string, o: { method?: string; body?: string } = {}) => {
          envois.push(`${o.method ?? 'GET'} ${u} ${o.body ?? ''}`);
          return new Promise(() => {});
        },
        Object,
        String,
        JSON,
        Error,
        decodeURIComponent,
      });
      return { ecouteurs, elements, envois };
    };

    const piege = essai(`#access_token=${jwt('attaquant@exemple.fr')}&refresh_token=rafr-attaquant&type=signup`);
    verifier(!piege.envois.some((a) => a.startsWith('POST /erp/connexion')), 'type=signup : rien n’est envoyé sans geste', piege.envois);
    verifier(piege.elements['f-confirmer']?.hidden === false && piege.elements['f-connexion']?.hidden === true, 'type=signup : confirmation affichée');
    verifier(String(piege.elements['intro-confirmer']?.textContent).includes('attaquant@exemple.fr'), 'la confirmation nomme le compte', piege.elements['intro-confirmer']?.textContent);
    piege.ecouteurs['f-confirmer:submit']?.({ preventDefault() {} });
    verifier(piege.envois.some((a) => a.startsWith('POST /erp/connexion')), 'après « Ouvrir l’ERP » : connexion');

    const nu = essai(`#access_token=${jwt('x@exemple.fr')}&refresh_token=r`);
    verifier(!nu.envois.some((a) => a.startsWith('POST /erp/connexion')) && nu.elements['f-confirmer']?.hidden === false, 'jeton sans type : confirmation, rien d’envoyé');
    const autre = essai(`#access_token=${jwt('x@exemple.fr')}&refresh_token=r&type=magiclink`);
    verifier(!autre.envois.some((a) => a.startsWith('POST /erp/connexion')), 'type=magiclink : rien d’envoyé sans geste');
    autre.ecouteurs['autre-compte:click']?.({ preventDefault() {} });
    verifier(autre.elements['f-connexion']?.hidden === false && autre.elements['f-confirmer']?.hidden === true, '« Utiliser un autre compte » : retour au formulaire');

    const recup = essai(`#access_token=${jwt('moi@exemple.fr')}&refresh_token=r&type=recovery`);
    verifier(!recup.envois.length && recup.elements['f-nouveau']?.hidden === false, 'type=recovery : choix du mot de passe, rien d’envoyé');
    verifier(String(recup.elements['intro-nouveau']?.textContent).includes('moi@exemple.fr'), 'type=recovery : le compte est nommé');
  }

  section('« Créer mon compte » (page d’accès)');
  {
    const html = await (await appeler('/erp'))!.text();
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])[0] ?? '';
    const balise = /<form id="f-creer"[^>]*>/.exec(html)?.[0] ?? '';
    verifier(/method="post"/.test(balise) && /action="\/erp\/connexion"/.test(balise) && /\shidden/.test(balise), 'formulaire de création : caché d’abord, en POST vers /erp/connexion', balise);
    const champs = [...html.matchAll(/<input[^>]*>/g)].map((m) => m[0]).filter((i) => /id="creer-(email|mdp|mdp2)"/.test(i));
    verifier(champs.length === 3 && champs.every((i) => !/\sname=/.test(i)), 'champs de création sans « name » : rien ne part dans l’adresse sans le script', champs);
    verifier(champs.filter((i) => /type="password"/.test(i) && /autocomplete="new-password"/.test(i) && /minlength="8"/.test(i)).length === 2, 'mot de passe deux fois, nouveau, 8 caractères au moins');
    verifier(html.includes('id="vers-creer"') && html.includes('Vous avez reçu une invitation&nbsp;?') && html.includes('J’ai déjà un compte'), 'lien « Vous avez reçu une invitation ? Créer mon compte » et retour « J’ai déjà un compte »');
    verifier(/<button type="submit"><svg[^>]*>(?:(?!<\/svg>)[\s\S])*<circle cx="9" cy="7" r="4"\/>[\s\S]*?<\/svg> Créer mon compte<\/button>/.test(html), '« Créer mon compte » : icône d’ajout de personne, pas la clé');
    verifier(html.includes('Accès réservé aux équipes invitées.') && !html.includes('Accès réservé à l\'équipe Label Maison.'), 'pied : « Accès réservé aux équipes invitées. »');
    verifier(script.includes("'/auth/v1/signup?redirect_to=' + encodeURIComponent(C.retour)") && html.includes('"retour":"https://www.labelmaisoncg.fr/erp"'), 'inscription auprès de Supabase, retour sur le site fixe /erp');
    verifier(html.includes('"invitation":"lm-erp-invitation"'), 'code d’invitation gardé sous la même clé que l’application (lm-erp-invitation)');

    type Reponse = { ok: boolean; status: number; json: () => Promise<unknown> };
    const CODE = 'Code-Invitation_0123456789abcdefghijklmnopq';
    const essai = (
      hash: string,
      o: {
        inscription?: { statut: number; corps: unknown };
        connexion?: { statut: number; corps: unknown };
        base?: 'espaces' | 'historique';
        stockage?: Record<string, string>;
      } = {},
    ) => {
      const ecouteurs: Record<string, (ev: { preventDefault(): void }) => void> = {};
      const elements: Record<string, Record<string, unknown>> = {};
      const el = (id: string) =>
        (elements[id] ??= {
          id,
          hidden: ['f-nouveau', 'f-confirmer', 'f-creer', 'f-finir', 'f-role', 'info'].includes(id),
          textContent: '',
          value: '',
          readOnly: false,
          disabled: false,
          focus() {
            focus.push(id);
          },
          select() {},
          addEventListener(type: string, f: (ev: { preventDefault(): void }) => void) {
            ecouteurs[`${id}:${type}`] = f;
          },
          querySelectorAll: () => [],
        });
      const focus: string[] = [];
      const envois: { methode: string; url: string; corps: string }[] = [];
      const stockage = new Map<string, string>(Object.entries(o.stockage ?? {}));
      const remplace: string[] = [];
      const repondre = (statut: number, corps: unknown): Promise<Reponse> =>
        Promise.resolve({ ok: statut < 300, status: statut, json: () => Promise.resolve(corps) });
      vm.runInNewContext(script, {
        document: { getElementById: el },
        location: {
          hash,
          pathname: '/erp',
          search: '',
          replace(u: string) {
            remplace.push(u);
          },
        },
        history: { state: null, replaceState() {} },
        URLSearchParams,
        localStorage: {
          getItem: (k: string) => stockage.get(k) ?? null,
          setItem: (k: string, v: string) => void stockage.set(k, v),
          removeItem: (k: string) => void stockage.delete(k),
        },
        atob: (b: string) => Buffer.from(b, 'base64').toString('binary'),
        escape,
        fetch: (u: string, f: { method?: string; body?: string } = {}): Promise<Reponse> => {
          envois.push({ methode: f.method ?? 'GET', url: u, corps: f.body ?? '' });
          if (u.endsWith('/rest/v1/rpc/activer')) {
            return o.base === 'historique'
              ? repondre(404, { code: 'PGRST202', message: 'Could not find the function erp.activer(p_code)' })
              : repondre(401, { code: '42501', message: 'permission denied for function activer' });
          }
          if (u.includes('/auth/v1/signup') && o.inscription) return repondre(o.inscription.statut, o.inscription.corps);
          if (u === '/erp/connexion' && o.connexion) return repondre(o.connexion.statut, o.connexion.corps);
          if (u.includes('/auth/v1/token?grant_type=password')) return repondre(200, { access_token: jwt('moi@exemple.fr'), refresh_token: 'r' });
          return new Promise(() => {});
        },
        Object,
        String,
        JSON,
        Error,
        Date,
        Promise,
        decodeURIComponent,
        encodeURIComponent,
      });
      const attendre = async () => {
        for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
      };
      const soumettre = async (form = 'f-creer') => {
        ecouteurs[`${form}:submit`]?.({ preventDefault() {} });
        await attendre();
      };
      return { ecouteurs, elements, envois, focus, soumettre, attendre, stockage, remplace };
    };
    const jwt = (email: string) => `x.${Buffer.from(JSON.stringify({ email })).toString('base64url')}.y`;
    const gardee = (email: string, code = CODE, expire = Date.now() + 86_400_000) => ({ 'lm-erp-invitation': JSON.stringify({ email, code, expire }) });
    const versConnexion = (t: ReturnType<typeof essai>) => t.envois.filter((e) => e.url === '/erp/connexion');
    const SANS_CODE = 'Pour créer votre compte, ouvrez le lien de l’invitation reçue par e-mail, sur cet appareil.';
    const FERMEE = 'La création de compte n’est pas encore ouverte : demandez à un gérant de vous ajouter.';

    // Lien d'invitation avec son code : création, adresse fixe, code gardé sur l'appareil, rien qui connecte.
    const lien = essai(`#creer=${encodeURIComponent('Marie.Durand+erp@exemple.fr')}&code=${CODE}`);
    await lien.attendre();
    verifier(lien.elements['f-creer']?.hidden === false && lien.elements['f-connexion']?.hidden === true && lien.elements['note-creer']?.hidden === true, 'lien #creer=…&code=… : écran « Créer mon compte »');
    verifier(lien.elements['creer-email']?.value === 'marie.durand+erp@exemple.fr' && lien.elements['creer-email']?.readOnly === true && lien.focus.at(-1) === 'creer-mdp', 'adresse de l’invitation (« + » compris), fixe ; curseur sur le mot de passe', lien.elements['creer-email']);
    const garde = JSON.parse(lien.stockage.get('lm-erp-invitation') ?? '{}') as { email?: string; code?: string; expire?: number };
    verifier(garde.email === 'marie.durand+erp@exemple.fr' && garde.code === CODE && (garde.expire ?? 0) > Date.now() + 13 * 86_400_000, 'code gardé sur l’appareil (adresse, code, 14 jours)', garde);
    verifier(!versConnexion(lien).length && lien.envois.every((e) => e.url.endsWith('/rest/v1/rpc/activer') && !e.corps.includes(CODE)), 'lien #creer= : rien n’est envoyé sans geste (seul l’état de la base est demandé, sans le code)', lien.envois);

    // Sans code (ancien lien, lien recopié à la main) : pas de création, on dit d'ouvrir le lien.
    const sansCode = essai(`#creer=${encodeURIComponent('marie@exemple.fr')}`);
    await sansCode.attendre();
    verifier(sansCode.elements['f-creer']?.hidden === true && sansCode.elements['f-connexion']?.hidden === false && sansCode.elements.info?.textContent === SANS_CODE, 'lien sans code : pas de création, « ouvrez le lien de l’invitation… »', sansCode.elements.info?.textContent);
    verifier(!sansCode.stockage.size, 'lien sans code : rien de gardé');
    const codeFaux = essai(`#creer=${encodeURIComponent('marie@exemple.fr')}&code=court`);
    await codeFaux.attendre();
    verifier(codeFaux.elements['f-creer']?.hidden === true && !codeFaux.stockage.size, 'code de forme invalide : ignoré');
    const autreAdresse = essai(`#creer=${encodeURIComponent('marie@exemple.fr')}`, { stockage: gardee('paul@exemple.fr') });
    await autreAdresse.attendre();
    verifier(autreAdresse.elements['f-creer']?.hidden === true, 'lien d’une autre adresse que l’invitation gardée : pas de création à son nom');
    const piege = essai(`#creer=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E&code=${CODE}`);
    await piege.attendre();
    verifier(piege.elements['f-creer']?.hidden === true && !piege.stockage.size && piege.elements['creer-email']?.value === '', 'adresse piégée dans le lien : ignorée, rien de gardé', piege.elements['creer-email']?.value);

    // Base d'avant les espaces : « Créer mon compte » fermé, avec le message prévu.
    const historique = essai(`#creer=${encodeURIComponent('marie@exemple.fr')}&code=${CODE}`, { base: 'historique' });
    await historique.attendre();
    verifier(historique.elements['f-creer']?.hidden === true && historique.elements['f-connexion']?.hidden === false && historique.elements.info?.textContent === FERMEE, 'base d’avant les espaces : création fermée, « pas encore ouverte(s) »', historique.elements.info?.textContent);
    const historiqueNote = essai('', { base: 'historique' });
    historiqueNote.ecouteurs['vers-creer:click']?.({ preventDefault() {} });
    historiqueNote.ecouteurs['role-equipe:click']?.({ preventDefault() {} });
    await historiqueNote.attendre();
    verifier(historiqueNote.elements.info?.textContent === FERMEE, 'base d’avant les espaces : le lien « Créer mon compte » le dit aussi');
    verifier(historique.elements['note-creer']?.hidden === true && historiqueNote.elements['note-creer']?.hidden === true, 'base d’avant les espaces : « Vous avez reçu une invitation ? Créer mon compte » n’est plus proposé');

    // Contrôles avant l'envoi.
    const court = essai(`#creer=a%40exemple.fr&code=${CODE}`);
    court.elements['creer-mdp'].value = 'court';
    court.elements['creer-mdp2'].value = 'court';
    await court.soumettre();
    verifier(!court.envois.some((e) => e.url.includes('/signup')) && /trop court/.test(String(court.elements.erreur?.textContent)), 'mot de passe de moins de 8 caractères : refusé avant l’envoi', court.elements.erreur?.textContent);
    const differents = essai(`#creer=a%40exemple.fr&code=${CODE}`);
    differents.elements['creer-mdp'].value = 'un-bon-mot-de-passe';
    differents.elements['creer-mdp2'].value = 'un-autre-mot-de-passe';
    await differents.soumettre();
    verifier(!differents.envois.some((e) => e.url.includes('/signup')) && /différents/.test(String(differents.elements.erreur?.textContent)), 'deux saisies différentes : refusé avant l’envoi', differents.elements.erreur?.textContent);

    // Envoi : même message qu'un compte existe ou non, jamais de connexion.
    const MESSAGE = 'Ouvrez sur cet appareil le lien reçu par e-mail pour confirmer votre adresse.';
    const creer = async (reponse: { statut: number; corps: unknown }) => {
      const t = essai(`#creer=nouveau%40exemple.fr&code=${CODE}`, { inscription: reponse });
      await t.attendre();
      t.elements['creer-mdp'].value = 'un-bon-mot-de-passe';
      t.elements['creer-mdp2'].value = 'un-bon-mot-de-passe';
      await t.soumettre();
      return t;
    };
    const nouveau = await creer({ statut: 200, corps: { id: 'u1', email: 'nouveau@exemple.fr', identities: [{ id: 'i' }] } });
    const envoi = nouveau.envois.find((e) => e.url.includes('/auth/v1/signup'));
    verifier(!!envoi && envoi.methode === 'POST' && envoi.url === `${SUPA}/auth/v1/signup?redirect_to=${encodeURIComponent('https://www.labelmaisoncg.fr/erp')}`, 'inscription : POST /auth/v1/signup, retour vers https://www.labelmaisoncg.fr/erp', envoi?.url);
    verifier(JSON.parse(envoi?.corps ?? '{}').email === 'nouveau@exemple.fr' && !envoi!.url.includes('un-bon-mot-de-passe') && !envoi!.corps.includes(CODE), 'mot de passe dans le corps, jamais dans l’adresse ; le code ne part pas chez Supabase');
    verifier(String(nouveau.elements.info?.textContent).startsWith(MESSAGE) && nouveau.elements.info?.hidden === false, 'nouveau compte : « Ouvrez le lien reçu par e-mail… »', nouveau.elements.info?.textContent);
    verifier(nouveau.elements['f-connexion']?.hidden === false && nouveau.elements['f-creer']?.hidden === true && nouveau.elements.email?.value === 'nouveau@exemple.fr', 'ensuite : formulaire de connexion avec l’adresse');
    verifier(nouveau.elements['creer-mdp']?.value === '' && nouveau.elements['creer-mdp2']?.value === '', 'mots de passe effacés des champs');
    verifier(!!nouveau.stockage.get('lm-erp-invitation'), 'le code reste gardé jusqu’à la confirmation de l’adresse');
    const existant = await creer({ statut: 200, corps: { id: 'u2', email: 'nouveau@exemple.fr', identities: [] } });
    const deja = await creer({ statut: 422, corps: { code: 422, error_code: 'user_already_exists', msg: 'User already registered' } });
    verifier(existant.elements.info?.textContent === nouveau.elements.info?.textContent && deja.elements.info?.textContent === nouveau.elements.info?.textContent && deja.elements.erreur?.hidden !== false, 'compte déjà existant (réponse masquée ou « already registered ») : exactement le même message', [existant.elements.info?.textContent, deja.elements.erreur?.textContent]);
    const session = await creer({ statut: 200, corps: { access_token: 'jeton-direct', refresh_token: 'r', user: { id: 'u3' } } });
    verifier(!versConnexion(session).length && String(session.elements.info?.textContent).startsWith(MESSAGE), 'session rendue par Supabase (confirmation coupée) : jamais de connexion depuis la création', session.envois.map((e) => e.url));
    const limite = await creer({ statut: 429, corps: { error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' } });
    verifier(/Trop de tentatives/.test(String(limite.elements.erreur?.textContent)) && limite.elements['f-creer']?.hidden === false, 'trop de demandes : message clair, on reste sur la création');
    const fermee = await creer({ statut: 422, corps: { error_code: 'signup_disabled', msg: 'Signups not allowed for this instance' } });
    verifier(/pas ouverte/.test(String(fermee.elements.erreur?.textContent)), 'inscriptions fermées dans Supabase : message clair', fermee.elements.erreur?.textContent);
    const faible = await creer({ statut: 422, corps: { error_code: 'weak_password', msg: 'Password should be at least 10 characters.' } });
    verifier(/trop court/.test(String(faible.elements.erreur?.textContent)), 'mot de passe refusé par Supabase : traduit', faible.elements.erreur?.textContent);

    // « Créer mon compte » ⇄ connexion.
    const bascule = essai('', { stockage: gardee('moi@exemple.fr') });
    bascule.elements.email.value = 'autre@exemple.fr';
    bascule.ecouteurs['vers-creer:click']?.({ preventDefault() {} });
    await bascule.attendre();
    verifier(bascule.elements['f-creer']?.hidden === false && bascule.elements['creer-email']?.value === 'moi@exemple.fr', '« Créer mon compte » avec une invitation gardée : à l’adresse de l’invitation');
    bascule.ecouteurs['deja-compte:click']?.({ preventDefault() {} });
    verifier(bascule.elements['f-connexion']?.hidden === false && bascule.elements['f-creer']?.hidden === true && bascule.elements['note-creer']?.hidden === false, '« J’ai déjà un compte » : retour à la connexion');
    // Sans invitation sur l'appareil : d'abord « Vous êtes : » (propriétaire, terrain, équipe d'une conciergerie).
    const sansInvitation = essai('');
    sansInvitation.elements.email.value = 'moi@exemple.fr';
    sansInvitation.ecouteurs['vers-creer:click']?.({ preventDefault() {} });
    await sansInvitation.attendre();
    verifier(
      sansInvitation.elements['f-role']?.hidden === false && sansInvitation.elements['f-connexion']?.hidden === true && sansInvitation.elements['f-creer']?.hidden === true && sansInvitation.elements['note-creer']?.hidden === true,
      '« Créer mon compte » sans invitation : le choix « Vous êtes : » d’abord',
    );
    const htmlRole = await (await appeler('/erp')).text();
    verifier(
      /id="role-proprietaire" href="\/espace-proprietaire"/.test(htmlRole) && /href="\/espace-operations"/.test(htmlRole) && htmlRole.includes('id="role-equipe"') && htmlRole.includes('Agent ou responsable de pôle') && htmlRole.includes('Équipe d’une conciergerie'),
      'choix : Propriétaire → /espace-proprietaire, Agent ou responsable de pôle → /espace-operations, Équipe d’une conciergerie → la création',
    );
    sansInvitation.ecouteurs['role-equipe:click']?.({ preventDefault() {} });
    await sansInvitation.attendre();
    verifier(sansInvitation.elements['f-creer']?.hidden === true && sansInvitation.elements['f-role']?.hidden === true && sansInvitation.elements.info?.textContent === SANS_CODE, '« Équipe d’une conciergerie » sans invitation sur l’appareil : « ouvrez le lien de l’invitation… »');
    const retourRole = essai('');
    retourRole.ecouteurs['vers-creer:click']?.({ preventDefault() {} });
    retourRole.ecouteurs['role-retour:click']?.({ preventDefault() {} });
    verifier(retourRole.elements['f-connexion']?.hidden === false && retourRole.elements['f-role']?.hidden === true && retourRole.elements['note-creer']?.hidden === false, '« J’ai déjà un compte » depuis le choix : retour à la connexion');

    // Lien de confirmation de l'adresse, invitation gardée pour ce compte : la dernière étape (mot de passe).
    const confirme = essai(`#access_token=${jwt('nouveau@exemple.fr')}&refresh_token=r&type=signup`, {
      stockage: gardee('nouveau@exemple.fr'),
      connexion: { statut: 200, corps: { ok: true, suite: '/erp', invitation: 'activee' } },
    });
    verifier(!confirme.envois.length && confirme.elements['f-finir']?.hidden === false && confirme.elements['f-confirmer']?.hidden === true && confirme.elements['note-creer']?.hidden === true, 'confirmation d’un compte invité : « Dernière étape », rien d’envoyé');
    verifier(String(confirme.elements['intro-finir']?.textContent).includes('nouveau@exemple.fr'), 'la dernière étape nomme le compte', confirme.elements['intro-finir']?.textContent);
    confirme.elements['finir-mdp'].value = 'court';
    await confirme.soumettre('f-finir');
    verifier(!versConnexion(confirme).length && /trop court/.test(String(confirme.elements.erreur?.textContent)), 'dernière étape : mot de passe trop court refusé avant l’envoi');
    confirme.elements['finir-mdp'].value = 'un-bon-mot-de-passe';
    confirme.elements['finir-mdp2'].value = 'un-bon-mot-de-pase';
    await confirme.soumettre('f-finir');
    verifier(!versConnexion(confirme).length && /différents/.test(String(confirme.elements.erreur?.textContent)), 'dernière étape : deux saisies différentes refusées avant l’envoi (une faute de frappe ne devient pas le mot de passe)');
    confirme.elements['finir-mdp2'].value = 'un-bon-mot-de-passe';
    await confirme.soumettre('f-finir');
    const corpsFinir = JSON.parse(versConnexion(confirme)[0]?.corps ?? '{}') as Record<string, unknown>;
    verifier(corpsFinir.code === CODE && corpsFinir.mot_de_passe === 'un-bon-mot-de-passe' && corpsFinir.access_token === jwt('nouveau@exemple.fr'), 'dernière étape : jetons, code et mot de passe envoyés à /erp/connexion', corpsFinir);
    verifier(!confirme.stockage.has('lm-erp-invitation') && confirme.remplace.at(-1) === '/erp', 'invitation activée : code effacé de l’appareil, l’ERP s’ouvre', [...confirme.stockage.keys()]);

    // Confirmation d'un autre compte que l'invitation gardée : le code ne part pas.
    const autreCompte = essai(`#access_token=${jwt('pirate@exemple.fr')}&refresh_token=r&type=signup`, { stockage: gardee('nouveau@exemple.fr') });
    verifier(autreCompte.elements['f-confirmer']?.hidden === false && autreCompte.elements['f-finir']?.hidden === true, 'confirmation d’un autre compte : la confirmation ordinaire');
    autreCompte.ecouteurs['f-confirmer:submit']?.({ preventDefault() {} });
    await autreCompte.attendre();
    verifier(!versConnexion(autreCompte)[0]?.corps.includes(CODE), 'confirmation d’un autre compte : le code n’est jamais envoyé', versConnexion(autreCompte)[0]?.corps);

    // Connexion par mot de passe avec une invitation gardée pour cette adresse : code et mot de passe partent ensemble.
    const parMdp = essai('', { stockage: gardee('moi@exemple.fr'), connexion: { statut: 200, corps: { ok: true, suite: '/erp', invitation: 'refusee' } } });
    parMdp.elements.email.value = 'moi@exemple.fr';
    parMdp.elements.mdp.value = 'mon-mot-de-passe';
    await parMdp.soumettre('f-connexion');
    const corpsMdp = JSON.parse(versConnexion(parMdp)[0]?.corps ?? '{}') as Record<string, unknown>;
    verifier(corpsMdp.code === CODE && corpsMdp.mot_de_passe === 'mon-mot-de-passe', 'connexion avec invitation gardée : code et mot de passe envoyés', corpsMdp);
    verifier(!parMdp.stockage.has('lm-erp-invitation'), 'code refusé par la base : effacé de l’appareil');

    // Serveur : « il manque le mot de passe » → la dernière étape.
    const manque = essai(`#access_token=${jwt('moi@exemple.fr')}&refresh_token=r&type=magiclink`, {
      connexion: { statut: 409, corps: { ok: false, code: 'mot_de_passe', erreur: 'Pour finir…' } },
    });
    manque.ecouteurs['f-confirmer:submit']?.({ preventDefault() {} });
    await manque.attendre();
    verifier(manque.elements['f-finir']?.hidden === false && manque.elements['f-confirmer']?.hidden === true, 'serveur : mot de passe demandé → « Dernière étape »');

    // S1 : compte refusé après « Ouvrir l’ERP avec le compte… » : retour au formulaire de connexion.
    const refuse = essai(`#access_token=${jwt('inconnu@exemple.fr')}&refresh_token=r&type=signup`, {
      connexion: { statut: 403, corps: { ok: false, erreur: 'Ce compte n’a pas accès à l’ERP.' } },
    });
    refuse.ecouteurs['f-confirmer:submit']?.({ preventDefault() {} });
    await refuse.attendre();
    verifier(refuse.elements['f-connexion']?.hidden === false && refuse.elements['f-confirmer']?.hidden === true && refuse.elements.email?.value === 'inconnu@exemple.fr', 'compte refusé : retour au formulaire de connexion (adresse reprise)');
    verifier(/n’a pas accès/.test(String(refuse.elements.erreur?.textContent)) && refuse.elements.erreur?.hidden === false, 'compte refusé : le message reste affiché', refuse.elements.erreur?.textContent);

    // S2 : lien expiré.
    const expire = essai('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    verifier(/ou refaites « Créer mon compte »/.test(String(expire.elements.erreur?.textContent)), 'lien expiré : « … ou refaites « Créer mon compte » »', expire.elements.erreur?.textContent);
  }

  section('Invitation à créer l’espace d’une conciergerie');
  {
    const SENS_INVITE: Compte = { id: '66666666-2222-4333-8444-555555555555', email: 'gerante@sens.exemple', membre: false };
    COMPTES.push(SENS_INVITE);
    const dans = (jours: number) => new Date(Date.now() + jours * 86_400_000).toISOString();
    base = 'espaces';
    invitationsEspace.set(SENS_INVITE.id, [{ nom_espace: 'Sens', expire_le: dans(6) }]);
    let r = await connexion(SENS_INVITE);
    verifier(r!.status === 200 && cookiesPoses(r!).erp_session?.valeur.startsWith(`v2.${SENS_INVITE.id}.`), 'invitation en attente : session posée (l’application montre la création de l’espace)', r!.status);
    invitationsEspace.set(SENS_INVITE.id, [{ nom_espace: 'Sens' }]);
    r = await connexion(SENS_INVITE);
    verifier(r!.status === 200, 'invitation sans échéance donnée : acceptée', r!.status);
    for (const [forme, valeur] of [
      ['échue', [{ nom_espace: 'Sens', expire_le: dans(-1) }]],
      ['échéance illisible', [{ nom_espace: 'Sens', expire_le: 'bientôt' }]],
      ['liste vide', []],
      ['objet au lieu d’une liste', { nom_espace: 'Sens' }],
      ['liste de textes', ['Sens']],
      ['valeur nulle', null],
    ] as [string, unknown][]) {
      invitationsEspace.set(SENS_INVITE.id, valeur);
      r = await connexion(SENS_INVITE);
      verifier(r!.status === 403 && !cookiesPoses(r!).erp_session, `invitation ${forme} : refusé comme un non-membre`, r!.status);
    }
    invitationsEspace.delete(SENS_INVITE.id);
    r = await connexion(SENS_INVITE);
    const corps = (await r!.json()) as { erreur?: string };
    verifier(r!.status === 403 && /n’a pas accès à l’ERP/.test(corps.erreur ?? ''), 'sans invitation : refusé, même message qu’avant', corps);
    base = 'historique';
    invitationsEspace.set(SENS_INVITE.id, [{ nom_espace: 'Sens', expire_le: dans(6) }]);
    r = await connexion(SENS_INVITE);
    verifier(r!.status === 403, 'base d’avant les espaces : rien ne change (erp.membres seulement)', r!.status);
    invitationsEspace.delete(SENS_INVITE.id);
  }

  section('Activation par le code de l’invitation (/erp/connexion)');
  {
    base = 'espaces';
    const CODE_MEMBRE = 'Code-Membre_0123456789abcdefghijklmnopqrstu';
    const CODE_ESPACE = 'Code-Espace_0123456789abcdefghijklmnopqrstu';
    const CODE_EXPIRE = 'Code-Expire_0123456789abcdefghijklmnopqrstu';
    // Le futur membre : quelqu'un a créé le compte à son adresse AVANT lui (mot de passe connu de lui
    // seul), puis la victime a confirmé l'adresse (elle attendait justement un e-mail).
    const victime = compteInvite('victime@exemple.fr', 'mdp-de-l-attaquant');
    codesInvitation.set(CODE_MEMBRE, { email: 'victime@exemple.fr', genre: 'membre', utilise: false, expire: false });
    codesInvitation.set(CODE_EXPIRE, { email: 'victime@exemple.fr', genre: 'membre', utilise: false, expire: true });
    const attaquant = ouvrirSession(victime);
    const lienConfirmation = ouvrirSession(victime);
    const entrer = (s: SessionInvite, extra: Record<string, unknown> = {}) =>
      appeler('/erp/connexion', { corps: { access_token: s.acces, refresh_token: s.rafraichir, suite: '/erp', ...extra }, entetes: MEME_ORIGINE });

    let r = await entrer(attaquant);
    let corps = (await r!.json()) as { erreur?: string; code?: string; invitation?: string };
    verifier(r!.status === 403 && corps.erreur === MESSAGE_NEUTRE && !cookiesPoses(r!).erp_session, 'compte créé avant le membre, sans code : refusé (message neutre)', corps);
    r = await entrer(lienConfirmation);
    verifier(r!.status === 403, 'même compte confirmé par la victime, sans code : refusé', r!.status);

    r = await entrer(lienConfirmation, { code: CODE_MEMBRE });
    corps = (await r!.json()) as typeof corps;
    verifier(r!.status === 409 && corps.code === 'mot_de_passe' && !cookiesPoses(r!).erp_session, 'code sans mot de passe : 409, le mot de passe est demandé', corps);
    verifier(!codesInvitation.get(CODE_MEMBRE)!.utilise && victime.motDePasse === 'mdp-de-l-attaquant', '… et rien n’a changé');
    r = await entrer(lienConfirmation, { code: CODE_MEMBRE, mot_de_passe: 'court' });
    verifier(r!.status === 409, 'mot de passe de moins de 8 caractères : redemandé', r!.status);

    r = await entrer(lienConfirmation, { code: CODE_EXPIRE, mot_de_passe: 'mdp-de-la-victime' });
    corps = (await r!.json()) as typeof corps;
    verifier(r!.status === 403 && corps.erreur === MESSAGE_LIEN_PERIME && corps.invitation === 'refusee', 'code expiré : refusé, « ce lien n’est plus valable », code à oublier', corps);
    const sessionApres = ouvrirSession(victime);
    r = await entrer(sessionApres, { code: 'Code-Faux_0123456789abcdefghijklmnopqrstuvw', mot_de_passe: 'mdp-de-la-victime' });
    corps = (await r!.json()) as typeof corps;
    verifier(r!.status === 403 && corps.erreur === MESSAGE_LIEN_PERIME && corps.invitation === 'refusee' && !cookiesPoses(r!).erp_session, 'faux code : refusé, « ce lien n’est plus valable » (pas de boucle vers le même lien)', corps);
    verifier(MESSAGE_LIEN_PERIME === MESSAGE_LIEN_PERIME_APPLI, 'même message dans l’application (src/erp/data/invitation.ts)');

    // La victime, avec le bon code : mot de passe posé, autres sessions fermées, compte lié, session renouvelée.
    const victimeSession = ouvrirSession(victime);
    const avant = Date.now();
    r = await entrer(victimeSession, { code: CODE_MEMBRE, mot_de_passe: 'mdp-de-la-victime' });
    corps = (await r!.json()) as typeof corps;
    const c = cookiesPoses(r!);
    verifier(r!.status === 200 && corps.invitation === 'activee' && c.erp_session?.valeur.startsWith(`v2.${victime.id}.`), 'bon code et mot de passe : accès activé, session posée', corps);
    verifier(victime.motDePasse === 'mdp-de-la-victime', 'le mot de passe de l’attaquant ne vaut plus');
    verifier(codesInvitation.get(CODE_MEMBRE)!.utilise, 'code consommé');
    verifier(!rafraichissementsInvites.has(attaquant.rafraichir) && !rafraichissementsInvites.has(lienConfirmation.rafraichir), 'autres sessions du compte fermées (logout scope=others)');
    verifier(Date.now() - avant >= 1000, 'session renouvelée après l’activation (jetons datés à la seconde)');
    const ordre = appelsInvites.filter((a) => a.startsWith(victimeSession.acces)).map((a) => a.split(' ').slice(1).join(' '));
    verifier(
      ordre.join(' | ') === 'GET /auth/v1/user | POST /rest/v1/rpc/qui_suis_je | PUT /auth/v1/user | POST /auth/v1/logout?scope=others | POST /rest/v1/rpc/activer',
      'ordre : vérifier le compte (et qu’il n’est pas déjà membre), poser le mot de passe, fermer les autres sessions, puis activer',
      ordre,
    );
    const relais = c.erp_relais?.valeur ?? '';
    verifier(!relais.includes(Buffer.from(victimeSession.rafraichir).toString('base64url')), 'le relais porte la session renouvelée, pas celle d’avant l’activation');

    // L'attaquant, avec son ancien jeton (émis avant l'activation) ou en se rafraîchissant : rien.
    r = await entrer(attaquant);
    verifier((r!.status === 401 || r!.status === 403) && !cookiesPoses(r!).erp_session, 'jeton émis avant l’activation (session fermée) : refusé', r!.status);
    r = await appeler('/erp/connexion', { corps: { access_token: attaquant.acces, refresh_token: attaquant.rafraichir, suite: '/erp', code: CODE_MEMBRE, mot_de_passe: 'mdp-de-l-attaquant-2' }, entetes: MEME_ORIGINE });
    verifier(r!.status !== 200 && victime.motDePasse === 'mdp-de-la-victime', 'code déjà servi, depuis la session de l’attaquant : rien', r!.status);

    // Un membre lié à la passe 1 (sans date d'activation) entre sans code.
    const ancien = compteInvite('ancien@exemple.fr', 'mdp');
    ancien.lie = true;
    r = await entrer(ouvrirSession(ancien));
    verifier(r!.status === 200, 'membre lié à la passe 1 : entre sans code', r!.status);
    // Déjà membre, avec un code resté sur l'appareil (ou reçu d'un autre espace) : il n'est pas utilisé.
    const ancienSession = ouvrirSession(ancien);
    const autreSession = ouvrirSession(ancien);
    r = await entrer(ancienSession, { code: 'Code-Reste_0123456789abcdefghijklmnopqrstu', mot_de_passe: 'autre-mot-de-passe' });
    corps = (await r!.json()) as typeof corps;
    const appelsAncien = appelsInvites.filter((a) => a.startsWith(ancienSession.acces)).map((a) => a.split(' ').slice(1).join(' '));
    verifier(
      r!.status === 200 && corps.invitation === 'refusee' && ancien.motDePasse === 'mdp' && rafraichissementsInvites.has(autreSession.rafraichir) && !appelsAncien.some((a) => /PUT|logout|activer/.test(a)),
      'déjà membre avec un code : il entre, mot de passe et autres sessions intacts, rien n’est lié, le code est à oublier',
      { statut: r!.status, corps, appelsAncien },
    );

    // Invitation d'une conciergerie : sans son code, rien ; avec, l'écran de création.
    const gerante = compteInvite('gerante@cote.exemple', 'mdp-gerante');
    codesInvitation.set(CODE_ESPACE, { email: 'gerante@cote.exemple', genre: 'espace', utilise: false, expire: false });
    r = await entrer(ouvrirSession(gerante));
    verifier(r!.status === 403, 'invitation de conciergerie sans son code : refusée', r!.status);
    r = await entrer(ouvrirSession(gerante), { code: CODE_ESPACE, mot_de_passe: 'mdp-gerante' });
    corps = (await r!.json()) as typeof corps;
    verifier(r!.status === 200 && corps.invitation === 'activee', 'invitation de conciergerie avec son code (même mot de passe) : entre pour créer son espace', corps);

    // Panne en fermant les autres sessions : on n'active pas.
    const prudent = compteInvite('prudent@exemple.fr', 'mdp');
    codesInvitation.set('Code-Prudent_0123456789abcdefghijklmnopqrst', { email: 'prudent@exemple.fr', genre: 'membre', utilise: false, expire: false });
    panneDeconnexion = true;
    r = await entrer(ouvrirSession(prudent), { code: 'Code-Prudent_0123456789abcdefghijklmnopqrst', mot_de_passe: 'mdp-prudent' });
    panneDeconnexion = false;
    verifier(r!.status === 502 && !codesInvitation.get('Code-Prudent_0123456789abcdefghijklmnopqrst')!.utilise && !cookiesPoses(r!).erp_session, 'autres sessions pas fermées : rien n’est activé, le code reste', r!.status);

    // C2 : la raison du refus, quand la base la donne.
    const suspendu = compteInvite('suspendu@sens.exemple', 'mdp');
    suspendu.refus = { espaces_suspendus: [{ nom: 'Sens' }] };
    r = await entrer(ouvrirSession(suspendu));
    corps = (await r!.json()) as typeof corps;
    verifier(r!.status === 403 && corps.erreur === 'L’espace Sens est suspendu : contactez Label Maison. Rien n’est effacé.' && !cookiesPoses(r!).erp_session, 'espace suspendu : refus, avec la raison', corps);
    const echue = compteInvite('echue@cote.exemple', 'mdp');
    echue.refus = { invitations_espace_closes: [{ nom_espace: 'Côte', motif: 'expiree' }] };
    r = await entrer(ouvrirSession(echue));
    corps = (await r!.json()) as typeof corps;
    verifier(r!.status === 403 && corps.erreur === 'Votre invitation a expiré : demandez-en une nouvelle à Label Maison.', 'invitation expirée : refus, avec la raison', corps);
    echue.refus = { invitations_espace_closes: [{ nom_espace: 'Côte', motif: 'annulee' }] };
    r = await entrer(ouvrirSession(echue));
    corps = (await r!.json()) as typeof corps;
    verifier(r!.status === 403 && /a été annulée/.test(corps.erreur ?? ''), 'invitation annulée : refus, avec la raison', corps);
    echue.refus = { espaces_suspendus: 'Sens', invitations_espace_closes: [{ motif: 'autre' }] };
    r = await entrer(ouvrirSession(echue));
    corps = (await r!.json()) as typeof corps;
    verifier(r!.status === 403 && corps.erreur === MESSAGE_NEUTRE, 'raison illisible : message neutre', corps);
    base = 'historique';
  }

  section('Robustesse');
  {
    let erreur = '';
    let statut: number | undefined;
    try {
      statut = (await appeler('/erp', { cookies: { erp_session: '%E0%A4%A' } }))?.status;
    } catch (e) {
      erreur = (e as Error).message;
    }
    verifier(!erreur && statut === 401, 'cookie avec un « % » mal formé : page de connexion, pas d’erreur 500', erreur || statut);
    let erreurLinge = '';
    try {
      statut = (await appeler('/linge', { cookies: { linge_session: '%' } }))?.status;
    } catch (e) {
      erreurLinge = (e as Error).message;
    }
    verifier(!erreurLinge && statut === 401, 'linge : même chose', erreurLinge || statut);

    base = 'historique';
    const MIXTE: Compte = { id: '44444444-2222-4333-8444-555555555555', email: 'mixte@exemple.fr', stocke: 'Mixte@Exemple.fr', membre: true };
    COMPTES.push(MIXTE);
    const m = await connexion(MIXTE);
    verifier(m!.status === 200, 'base d’avant les espaces : adresse saisie avec des majuscules reconnue', m!.status);
    const JOKER: Compte = { id: '55555555-2222-4333-8444-555555555555', email: 'a_b@exemple.fr', membre: true };
    COMPTES.push(JOKER);
    appels.length = 0;
    const j = await connexion(JOKER);
    verifier(j!.status === 200 && appels.some((a) => a.includes('email=ilike.a%5C_b%40exemple.fr')), '« _ » échappé dans la recherche de l’adresse', appels.filter((a) => a.includes('membres')));

    const d = await appeler('/erp/deconnexion', { cookies: { erp_session: sessionAbdel, erp_relais: 'x' } });
    const effaces = d!.headers.getSetCookie();
    verifier(effaces.some((c) => /^erp_session=;.*Max-Age=0/.test(c)) && effaces.some((c) => /^erp_relais=;.*Path=\/erp\/session;.*Max-Age=0/.test(c)), 'déconnexion : session et relais effacés', effaces);
  }

  section('Zone du linge inchangée');
  {
    const page = await appeler('/linge');
    const html = await page!.text();
    verifier(page!.status === 401 && html.includes('name="motdepasse"') && html.includes('Retour au site') && !html.includes('Adresse e-mail'), 'linge : mot de passe partagé et « Retour au site »');
    const mauvais = await appeler('/linge/connexion', { corps: 'motdepasse=faux&suite=%2Flinge', entetes: { 'content-type': 'application/x-www-form-urlencoded' } });
    verifier(mauvais!.status === 401, 'linge : mauvais mot de passe refusé');
    const bon = await appeler('/linge/connexion', { corps: `motdepasse=${MDP_LINGE}&suite=%2Flinge`, entetes: { 'content-type': 'application/x-www-form-urlencoded' } });
    const cookie = cookiesPoses(bon!).linge_session?.valeur ?? '';
    verifier(bon!.status === 303 && /^\d+\./.test(cookie), 'linge : bon mot de passe, session');
    verifier((await appeler('/linge', { cookies: { linge_session: cookie } })) === undefined, 'linge : ouvert avec sa session');
    verifier((await appeler('/erp', { cookies: { erp_session: cookie } }))?.status === 401, 'session du linge : n’ouvre pas l’ERP');
  }

  section('Configuration absente');
  {
    delete env.ERP_PASSWORD;
    const r = await appeler('/erp');
    const html = await r!.text();
    verifier(r!.status === 503 && html.includes('ERP_PASSWORD') && !html.includes('Retour au site'), 'ERP_PASSWORD absent : accès refusé (503), sans « Retour au site »');
    env.ERP_PASSWORD = MDP_ERP;
  }

  process.stdout.write(`\n${reussis} contrôles réussis, ${echecs} en échec.\n`);
  if (echecs) process.exitCode = 1;
}

void principal();
