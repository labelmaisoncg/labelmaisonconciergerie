/**
 * Auto-contrôle de la pastille de l'icône de l'app (data/pastille-app.ts) :
 *   - total : somme des compteurs, entiers positifs seulement, bornée ;
 *   - selon le rôle : personnes à appeler pour le gérant seulement, rien en
 *     lecture seule ;
 *   - pose et retrait (setAppBadge / clearAppBadge), refus du système sans
 *     conséquence, nombre exact transmis au service worker ;
 *   - les types qui ajoutent 1 existent, et le service worker
 *     (public/erp-sw.js) a exactement la même liste, ignore les notifications
 *     d'essai, borne le nombre et garde son état hors du ménage des caches ;
 *   - l'envoi des notifications transmet bien le type au service worker.
 *
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-pastille.ts --bundle --platform=node \
 *     --format=esm --log-level=error --outfile=/tmp/verifier-pastille.mjs && node /tmp/verifier-pastille.mjs
 */
import { appliquerPastille, COMPTEURS_DU_GERANT, compteursPourRole, MESSAGE_PASTILLE, PASTILLE_MAX, totalPastille, TYPES_A_TRAITER } from './pastille-app';
import { TYPES_NOTIFICATION } from './notifications';

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

type Fs = { readFileSync: (p: string, e: string) => string; existsSync: (p: string) => boolean };
type Chemins = { join: (...p: string[]) => string; dirname: (p: string) => string };

function fauxNavigateur(o: { refuse?: boolean; sansBadge?: boolean } = {}) {
  const appels: string[] = [];
  const messages: unknown[] = [];
  const nav = {
    ...(o.sansBadge
      ? {}
      : {
          setAppBadge: (n?: number) => {
            appels.push(`pose ${n}`);
            return o.refuse ? Promise.reject(new Error('refusé')) : Promise.resolve();
          },
          clearAppBadge: () => {
            appels.push('retire');
            return Promise.resolve();
          },
        }),
    serviceWorker: { controller: { postMessage: (m: unknown) => messages.push(m) } },
  };
  return { nav, appels, messages };
}

async function principal() {
  section('1. Total');
  verifier(totalPastille([]) === 0, 'rien : 0');
  verifier(totalPastille([3, 20]) === 23, 'messages 3 + CRM 20 = 23');
  verifier(totalPastille([2, -4, Number.NaN, Number.POSITIVE_INFINITY, 1.7]) === 3, 'négatifs, NaN et infini ignorés, décimales arrondies vers le bas');
  verifier(totalPastille([PASTILLE_MAX, 5]) === PASTILLE_MAX, `borné à ${PASTILLE_MAX}`);

  section('1 bis. Selon le rôle');
  {
    const barre = [
      { cle: 'messagesEnAttente', n: 4 },
      { cle: 'contactsAAppeler', n: 20 },
    ];
    verifier(totalPastille(compteursPourRole('gerant', barre)) === 24, 'gérant : messages + personnes à appeler (24)');
    verifier(totalPastille(compteursPourRole('operations', barre)) === 4, 'opérations : les messages seulement (4), c’est le gérant qui rappelle');
    verifier(totalPastille(compteursPourRole('prestataire', barre)) === 4, 'prestataire : sans les personnes à appeler');
    verifier(totalPastille(compteursPourRole('lecture', barre)) === 0, 'lecture seule : aucune pastille');
  }

  section('2. Pose, retrait, service worker');
  {
    const f = fauxNavigateur();
    appliquerPastille(7, f.nav);
    verifier(f.appels.join() === 'pose 7', 'un nombre positif pose la pastille');
    verifier(JSON.stringify(f.messages) === JSON.stringify([{ type: MESSAGE_PASTILLE, n: 7 }]), 'le service worker reçoit le nombre exact');
    appliquerPastille(0, f.nav);
    verifier(f.appels.at(-1) === 'retire', 'à 0, la pastille est retirée (pas « 0 » affiché)');
    verifier(JSON.stringify(f.messages.at(-1)) === JSON.stringify({ type: MESSAGE_PASTILLE, n: 0 }), 'le service worker repart de 0');
  }
  {
    const f = fauxNavigateur({ refuse: true });
    let leve = false;
    try {
      appliquerPastille(4, f.nav);
      await new Promise((r) => setTimeout(r, 0));
    } catch {
      leve = true;
    }
    verifier(!leve && f.appels.join() === 'pose 4', 'refus du système (notifications non autorisées) : sans erreur');
  }
  {
    const f = fauxNavigateur({ sansBadge: true });
    let leve = false;
    try {
      appliquerPastille(4, f.nav);
    } catch {
      leve = true;
    }
    verifier(!leve && f.messages.length === 1, 'navigateur sans pastille : rien ne casse, le service worker est quand même prévenu');
  }
  let leveSansNav = false;
  try {
    appliquerPastille(3, undefined);
  } catch {
    leveSansNav = true;
  }
  verifier(!leveSansNav, 'sans navigateur (serveur, tests) : sans effet');

  section('3. Types qui ajoutent 1');
  const connus = new Set(TYPES_NOTIFICATION.map((t) => t.type));
  verifier(TYPES_A_TRAITER.length > 0 && TYPES_A_TRAITER.every((t) => connus.has(t)), 'chaque type compté est un vrai type de notification');
  for (const t of ['message', 'agent_main', 'probleme', 'lead'] as const) verifier(TYPES_A_TRAITER.includes(t), `« ${t} » ajoute une chose à traiter`);
  for (const t of ['reservation', 'avis', 'rappel', 'agent_repondu', 'synchro', 'prix'] as const) verifier(!TYPES_A_TRAITER.includes(t), `« ${t} » n'ajoute rien`);

  section('4. Service worker (public/erp-sw.js) et envoi');
  const proc = (globalThis as { process?: { versions?: { node?: string }; cwd(): string } }).process;
  if (!proc?.versions?.node) {
    verifier(false, 'Node requis pour lire le service worker');
  } else {
    const nomFs = 'node:fs';
    const nomChemins = 'node:path';
    const fs = (await import(/* @vite-ignore */ nomFs)) as unknown as Fs;
    const chemins = (await import(/* @vite-ignore */ nomChemins)) as unknown as Chemins;
    let dossier = proc.cwd();
    for (let i = 0; i < 6 && !fs.existsSync(chemins.join(dossier, 'public/erp-sw.js')); i++) dossier = chemins.dirname(dossier);
    const sw = fs.readFileSync(chemins.join(dossier, 'public/erp-sw.js'), 'utf8');
    const liste = /const TYPES_A_TRAITER = \[([^\]]*)\];/.exec(sw)?.[1] ?? '';
    const typesSw = [...liste.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    verifier(JSON.stringify(typesSw) === JSON.stringify([...TYPES_A_TRAITER].sort()), `même liste de types dans le service worker (${typesSw.join(', ')})`);
    verifier(new RegExp(`const PASTILLE_MAX = ${PASTILLE_MAX};`).test(sw), 'même borne dans le service worker');
    verifier(/d\.tag\.startsWith\('test-'\)/.test(sw), 'une notification d’essai n’ajoute rien');
    verifier(sw.includes(`d.type !== '${MESSAGE_PASTILLE}'`) && /Number\.isInteger\(d\.n\) \|\| d\.n < 0 \|\| d\.n > PASTILLE_MAX/.test(sw), 'le nombre reçu de l’app est vérifié avant d’être gardé');
    const cachePastille = /const CACHE_PASTILLE = '([^']+)';/.exec(sw)?.[1] ?? '';
    verifier(cachePastille !== '' && !cachePastille.startsWith('lm-erp-'), 'l’état de la pastille échappe au ménage des caches à l’activation (préfixe lm-erp-)');
    verifier(/self\.navigator\.setAppBadge !== 'function'\) return;/.test(sw), 'navigateur sans pastille : le service worker n’essaie pas');
    verifier(/Promise\.all\(\[\s*compte \? augmenterPastille\(\) : null,\s*self\.registration\.showNotification/.test(sw), 'la notification s’affiche toujours, pastille ou pas');

    const envoi = fs.readFileSync(chemins.join(dossier, 'src/erp/data/notifications-envoi.ts'), 'utf8');
    verifier(/\{ titre: v\.titre, corps: v\.corps, url: v\.url, tag: g\.cle, type: v\.type \}/.test(envoi), 'l’envoi transmet le type au service worker');
    const registre = fs.readFileSync(chemins.join(dossier, 'src/erp/modules/registry.tsx'), 'utf8');
    const cles = /export type CleCompteur = ([^;]+);/.exec(registre)?.[1] ?? '';
    verifier(COMPTEURS_DU_GERANT.every((c) => cles.includes(`'${c}'`)), 'les compteurs réservés au gérant existent bien dans le menu');
    const magasin = fs.readFileSync(chemins.join(dossier, 'src/erp/data/store.tsx'), 'utf8');
    verifier(/arreterSynchro\(\);\s*appliquerPastille\(0\);\s*await deconnexionSupabase\(\);/.test(magasin), 'déconnexion : la pastille est retirée avant de quitter la session');
    const crochet = fs.readFileSync(chemins.join(dossier, 'src/erp/layout/usePastilleApp.ts'), 'utf8');
    verifier(crochet.includes('compteursPourRole(') && crochet.includes('utilisateur.role'), 'l’app compte selon le rôle de la personne');
    const essai = fs.readFileSync(chemins.join(dossier, 'api/erp-notifications.ts'), 'utf8');
    verifier(/notificationTest\(`test-/.test(essai), 'la notification d’essai a une clé « test-… » (ignorée par la pastille)');
  }

  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  if (echecs) throw new Error(`${echecs} contrôle(s) en échec`);
}

void principal();
