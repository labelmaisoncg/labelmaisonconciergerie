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
 * zone du linge inchangée.
 *
 * Fichier hors de l'ERP (middleware) : pas dans tsc.
 * Lancement (Node 20+) :
 *   node_modules/.bin/esbuild scripts/verifier-connexion-erp.ts --bundle --platform=node --format=esm \
 *     --log-level=error --outfile=/tmp/verifier-connexion-erp.mjs && node /tmp/verifier-connexion-erp.mjs
 */
import crypto from 'node:crypto';
import vm from 'node:vm';
import middleware from '../middleware';

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
}
const ABDEL: Compte = { id: '11111111-2222-4333-8444-555555555555', email: 'abdel@exemple.fr', membre: true };
const INCONNU: Compte = { id: '99999999-2222-4333-8444-555555555555', email: 'inconnu@exemple.fr', membre: false };
const EQUIPE: Compte = { id: '22222222-2222-4333-8444-555555555555', email: 'equipe@labelmaisoncg.fr', membre: true };
const COMPTES = [ABDEL, INCONNU, EQUIPE];
const jetonDe = (c: Compte) => `acces-${c.id}`;

let base: 'historique' | 'espaces' | 'en-panne' = 'historique';
const appels: string[] = [];
const rafraichissements: string[] = [];
/** Rafraîchissement : jeton → compte qu'il ouvre (un autre compte pour éprouver le contrôle). */
const proprietaireRafraichir = new Map<string, Compte>();

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });

const fauxFetch = async (entree: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
  const methode = (init?.method ?? 'GET').toUpperCase();
  const entetes = new Headers(init?.headers);
  appels.push(`${methode} ${url.pathname}${url.search}`);
  if (url.origin !== SUPA) throw new Error(`réseau interdit : ${url.href}`);
  const jeton = (entetes.get('authorization') ?? '').replace(/^Bearer /, '');
  const compte = COMPTES.find((c) => jetonDe(c) === jeton);

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
    return json({ espaces: compte?.membre ? [{ id: '4c4d0000-0000-4000-8000-000000000001', code: 'lm', nom: 'Label Maison', role: 'gerant' }] : [] });
  }
  if (url.pathname === '/rest/v1/membres') {
    if (entetes.get('accept-profile') !== 'erp') return json({ message: 'schéma' }, 400);
    const email = (url.searchParams.get('email') ?? '').replace(/^eq\./, '');
    return json(compte?.membre && email === compte.email ? [{ role: 'gerant' }] : []);
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
