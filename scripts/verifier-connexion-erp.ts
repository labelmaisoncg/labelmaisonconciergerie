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
 * « Créer mon compte » (lien #creer= pré-rempli sans rien envoyer, deux
 * saisies, 8 caractères, inscription vers le site fixe, même réponse qu'un
 * compte existe ou non, jamais de connexion depuis la création), invitation
 * à créer l'espace d'une conciergerie (en attente : entre ; échue ou de
 * forme inconnue : refusée ; base d'avant les espaces : inchangée), zone du
 * linge inchangée.
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
    verifier(html.includes('id="vers-creer"') && html.includes('Créer mon compte') && html.includes('J’ai déjà un compte'), 'lien « Créer mon compte » et retour « J’ai déjà un compte »');
    verifier(script.includes("'/auth/v1/signup?redirect_to=' + encodeURIComponent(C.retour)") && html.includes('"retour":"https://www.labelmaisoncg.fr/erp"'), 'inscription auprès de Supabase, retour sur le site fixe /erp');

    type Reponse = { ok: boolean; status: number; json: () => Promise<unknown> };
    const essai = (hash: string, reponseInscription?: { statut: number; corps: unknown }) => {
      const ecouteurs: Record<string, (ev: { preventDefault(): void }) => void> = {};
      const elements: Record<string, Record<string, unknown>> = {};
      const el = (id: string) =>
        (elements[id] ??= {
          id,
          hidden: ['f-nouveau', 'f-confirmer', 'f-creer', 'info'].includes(id),
          textContent: '',
          value: '',
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
      vm.runInNewContext(script, {
        document: { getElementById: el },
        location: { hash, pathname: '/erp', search: '', replace() {} },
        history: { state: null, replaceState() {} },
        URLSearchParams,
        localStorage: { removeItem() {} },
        atob: (b: string) => Buffer.from(b, 'base64').toString('binary'),
        escape,
        fetch: (u: string, o: { method?: string; body?: string } = {}): Promise<Reponse> => {
          envois.push({ methode: o.method ?? 'GET', url: u, corps: o.body ?? '' });
          if (!u.includes('/auth/v1/signup') || !reponseInscription) return new Promise(() => {});
          const { statut, corps } = reponseInscription;
          return Promise.resolve({ ok: statut < 300, status: statut, json: () => Promise.resolve(corps) });
        },
        Object,
        String,
        JSON,
        Error,
        decodeURIComponent,
        encodeURIComponent,
      });
      const soumettre = async () => {
        ecouteurs['f-creer:submit']?.({ preventDefault() {} });
        for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
      };
      return { ecouteurs, elements, envois, focus, soumettre };
    };

    // Lien d'invitation : l'adresse pré-remplie, rien d'envoyé.
    const lien = essai(`#creer=${encodeURIComponent('Marie.Durand+erp@exemple.fr')}`);
    verifier(lien.elements['f-creer']?.hidden === false && lien.elements['f-connexion']?.hidden === true && lien.elements['note-creer']?.hidden === true, 'lien #creer= : écran « Créer mon compte »');
    verifier(lien.elements['creer-email']?.value === 'marie.durand+erp@exemple.fr' && lien.focus.at(-1) === 'creer-mdp', 'adresse pré-remplie (« + » compris), curseur sur le mot de passe', lien.elements['creer-email']?.value);
    verifier(!lien.envois.length, 'lien #creer= : rien n’est envoyé sans geste', lien.envois);
    const piege = essai('#creer=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
    verifier(piege.elements['creer-email']?.value === '' && piege.elements['f-creer']?.hidden === false, 'adresse piégée dans le lien : ignorée (champ vide)', piege.elements['creer-email']?.value);

    // Contrôles avant l'envoi.
    const court = essai('#creer=a%40exemple.fr');
    court.elements['creer-mdp'].value = 'court';
    court.elements['creer-mdp2'].value = 'court';
    await court.soumettre();
    verifier(!court.envois.length && /trop court/.test(String(court.elements.erreur?.textContent)), 'mot de passe de moins de 8 caractères : refusé avant l’envoi', court.elements.erreur?.textContent);
    const differents = essai('#creer=a%40exemple.fr');
    differents.elements['creer-mdp'].value = 'un-bon-mot-de-passe';
    differents.elements['creer-mdp2'].value = 'un-autre-mot-de-passe';
    await differents.soumettre();
    verifier(!differents.envois.length && /différents/.test(String(differents.elements.erreur?.textContent)), 'deux saisies différentes : refusé avant l’envoi', differents.elements.erreur?.textContent);
    const sansAdresse = essai('#creer=');
    sansAdresse.elements['creer-mdp'].value = 'un-bon-mot-de-passe';
    sansAdresse.elements['creer-mdp2'].value = 'un-bon-mot-de-passe';
    await sansAdresse.soumettre();
    verifier(!sansAdresse.envois.length && /adresse e-mail/i.test(String(sansAdresse.elements.erreur?.textContent)), 'sans adresse : demandée avant l’envoi');

    // Envoi : même message qu'un compte existe ou non, jamais de connexion.
    const MESSAGE = 'Ouvrez le lien reçu par e-mail pour confirmer votre adresse.';
    const creer = async (reponse: { statut: number; corps: unknown }) => {
      const t = essai('#creer=nouveau%40exemple.fr', reponse);
      t.elements['creer-mdp'].value = 'un-bon-mot-de-passe';
      t.elements['creer-mdp2'].value = 'un-bon-mot-de-passe';
      await t.soumettre();
      return t;
    };
    const nouveau = await creer({ statut: 200, corps: { id: 'u1', email: 'nouveau@exemple.fr', identities: [{ id: 'i' }] } });
    const envoi = nouveau.envois.find((e) => e.url.includes('/auth/v1/signup'));
    verifier(!!envoi && envoi.methode === 'POST' && envoi.url === `${SUPA}/auth/v1/signup?redirect_to=${encodeURIComponent('https://www.labelmaisoncg.fr/erp')}`, 'inscription : POST /auth/v1/signup, retour vers https://www.labelmaisoncg.fr/erp', envoi?.url);
    verifier(JSON.parse(envoi?.corps ?? '{}').email === 'nouveau@exemple.fr' && !envoi!.url.includes('un-bon-mot-de-passe'), 'mot de passe dans le corps, jamais dans l’adresse');
    verifier(String(nouveau.elements.info?.textContent).startsWith(MESSAGE) && nouveau.elements.info?.hidden === false, 'nouveau compte : « Ouvrez le lien reçu par e-mail… »', nouveau.elements.info?.textContent);
    verifier(nouveau.elements['f-connexion']?.hidden === false && nouveau.elements['f-creer']?.hidden === true && nouveau.elements.email?.value === 'nouveau@exemple.fr', 'ensuite : formulaire de connexion avec l’adresse');
    verifier(nouveau.elements['creer-mdp']?.value === '' && nouveau.elements['creer-mdp2']?.value === '', 'mots de passe effacés des champs');
    const existant = await creer({ statut: 200, corps: { id: 'u2', email: 'nouveau@exemple.fr', identities: [] } });
    const deja = await creer({ statut: 422, corps: { code: 422, error_code: 'user_already_exists', msg: 'User already registered' } });
    verifier(existant.elements.info?.textContent === nouveau.elements.info?.textContent && deja.elements.info?.textContent === nouveau.elements.info?.textContent && deja.elements.erreur?.hidden !== false, 'compte déjà existant (réponse masquée ou « already registered ») : exactement le même message', [existant.elements.info?.textContent, deja.elements.erreur?.textContent]);
    const session = await creer({ statut: 200, corps: { access_token: 'jeton-direct', refresh_token: 'r', user: { id: 'u3' } } });
    verifier(!session.envois.some((e) => e.url === '/erp/connexion') && String(session.elements.info?.textContent).startsWith(MESSAGE), 'session rendue par Supabase (confirmation coupée) : jamais de connexion depuis la création', session.envois.map((e) => e.url));
    const limite = await creer({ statut: 429, corps: { error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' } });
    verifier(/Trop de tentatives/.test(String(limite.elements.erreur?.textContent)) && limite.elements['f-creer']?.hidden === false, 'trop de demandes : message clair, on reste sur la création');
    const fermee = await creer({ statut: 422, corps: { error_code: 'signup_disabled', msg: 'Signups not allowed for this instance' } });
    verifier(/pas ouverte/.test(String(fermee.elements.erreur?.textContent)), 'inscriptions fermées dans Supabase : message clair', fermee.elements.erreur?.textContent);
    const faible = await creer({ statut: 422, corps: { error_code: 'weak_password', msg: 'Password should be at least 10 characters.' } });
    verifier(/trop court/.test(String(faible.elements.erreur?.textContent)), 'mot de passe refusé par Supabase : traduit', faible.elements.erreur?.textContent);

    // « Créer mon compte » ⇄ connexion.
    const bascule = essai('');
    bascule.elements.email.value = 'moi@exemple.fr';
    bascule.ecouteurs['vers-creer:click']?.({ preventDefault() {} });
    verifier(bascule.elements['f-creer']?.hidden === false && bascule.elements['creer-email']?.value === 'moi@exemple.fr', '« Créer mon compte » : l’adresse saisie suit');
    bascule.ecouteurs['deja-compte:click']?.({ preventDefault() {} });
    verifier(bascule.elements['f-connexion']?.hidden === false && bascule.elements['f-creer']?.hidden === true && bascule.elements['note-creer']?.hidden === false, '« J’ai déjà un compte » : retour à la connexion');

    // Le lien de confirmation (type=signup) demande toujours un geste : vérifié plus haut.
    const confirme = essai(`#access_token=x.${Buffer.from(JSON.stringify({ email: 'nouveau@exemple.fr' })).toString('base64url')}.y&refresh_token=r&type=signup`);
    verifier(!confirme.envois.length && confirme.elements['f-confirmer']?.hidden === false && confirme.elements['note-creer']?.hidden === true, 'lien de confirmation de l’adresse : « Ouvrir l’ERP avec le compte… », rien d’envoyé');
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
