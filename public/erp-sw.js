/*
 * Service worker de l'app ERP Label Maison (portée /erp).
 *
 * - Notifications : affiche ce que le serveur envoie (api/erp-notifications,
 *   src/erp/data/notifications-envoi.ts) ; un toucher ouvre le bon écran.
 * - Cache : seulement les fichiers /assets/ (noms uniques à chaque version),
 *   jamais les pages, les données ni /api. Les pages passent toujours par le
 *   réseau (la connexion reste vérifiée par le serveur) ; sans réseau, une
 *   courte page « Pas de connexion ».
 *
 * - Pastille de l'icône (src/erp/data/pastille-app.ts) : +1 à chaque
 *   notification qui apporte une chose à traiter (TYPES_A_TRAITER, même liste
 *   que l'app), jamais pour une notification d'essai ; l'app ouverte envoie le
 *   nombre exact (message « lm-pastille »), gardé ici pour repartir de là.
 *
 * Servi à la racine du site (hors de la zone protégée /erp) pour que le
 * navigateur puisse le charger sans session ; sa portée est /erp.
 */
const CACHE = 'lm-erp-assets-v1';
const MAX_FICHIERS = 120;
// Hors du préfixe « lm-erp- » : le ménage de l'activation ne l'efface pas.
const CACHE_PASTILLE = 'lm-pastille';
const CLE_PASTILLE = '/__pastille';
const TYPES_A_TRAITER = ['message', 'agent_main', 'probleme', 'lead'];
const PASTILLE_MAX = 9999;

async function lirePastille() {
  try {
    const r = await (await caches.open(CACHE_PASTILLE)).match(CLE_PASTILLE);
    const n = r ? Number(await r.text()) : 0;
    return Number.isInteger(n) && n >= 0 ? Math.min(n, PASTILLE_MAX) : 0;
  } catch {
    return 0;
  }
}

async function ecrirePastille(n) {
  try {
    await (await caches.open(CACHE_PASTILLE)).put(CLE_PASTILLE, new Response(String(n)));
  } catch {
    /* stockage indisponible : la prochaine ouverture de l'app remet le bon nombre */
  }
}

async function augmenterPastille() {
  if (!self.navigator || typeof self.navigator.setAppBadge !== 'function') return;
  const n = Math.min((await lirePastille()) + 1, PASTILLE_MAX);
  await ecrirePastille(n);
  try {
    await self.navigator.setAppBadge(n);
  } catch {
    /* notifications non autorisées : pas de pastille */
  }
}

self.addEventListener('message', (evenement) => {
  const d = evenement.data;
  if (!d || d.type !== 'lm-pastille' || !Number.isInteger(d.n) || d.n < 0 || d.n > PASTILLE_MAX) return;
  evenement.waitUntil(ecrirePastille(d.n));
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    (async () => {
      const noms = await caches.keys();
      await Promise.all(noms.filter((n) => n.startsWith('lm-erp-') && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

const HORS_LIGNE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Label Maison</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbfaf8;color:#14110e;font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:24px;text-align:center}
h1{font-size:20px;margin:0 0 6px}p{margin:0 0 20px;color:rgba(20,17,14,.68)}button{height:44px;padding:0 20px;border:0;border-radius:10px;background:#8a6424;color:#fff;font:inherit;font-weight:600}</style></head>
<body><main><h1>Pas de connexion internet</h1><p>L’app Label Maison se rouvre dès le retour du réseau.</p><button onclick="location.reload()">Réessayer</button></main></body></html>`;

async function fichierEnCache(requete) {
  const cache = await caches.open(CACHE);
  const trouve = await cache.match(requete);
  if (trouve) return trouve;
  const reponse = await fetch(requete);
  if (reponse.ok && reponse.type === 'basic') {
    await cache.put(requete, reponse.clone());
    const cles = await cache.keys();
    if (cles.length > MAX_FICHIERS) await Promise.all(cles.slice(0, cles.length - MAX_FICHIERS).map((c) => cache.delete(c)));
  }
  return reponse;
}

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/assets/')) {
    evenement.respondWith(fichierEnCache(requete));
    return;
  }
  if (requete.mode === 'navigate' && (url.pathname === '/erp' || url.pathname.startsWith('/erp/'))) {
    evenement.respondWith(
      fetch(requete).catch(() => new Response(HORS_LIGNE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })),
    );
  }
  // Tout le reste (dont /api et la base de données) : réseau, sans cache.
});

self.addEventListener('push', (evenement) => {
  let d = {};
  try {
    d = evenement.data ? evenement.data.json() : {};
  } catch {
    d = { corps: evenement.data ? evenement.data.text() : '' };
  }
  const titre = d.titre || 'Label Maison';
  const compte = TYPES_A_TRAITER.includes(d.type) && !(typeof d.tag === 'string' && d.tag.startsWith('test-'));
  evenement.waitUntil(
    Promise.all([
      compte ? augmenterPastille() : null,
      self.registration.showNotification(titre, {
        body: d.corps || '',
        icon: '/erp-app/icone-192.png',
        badge: '/erp-app/badge-96.png',
        tag: d.tag || undefined,
        renotify: !!d.tag,
        lang: 'fr',
        data: { url: typeof d.url === 'string' && d.url.startsWith('/erp') ? d.url : '/erp' },
      }),
    ]),
  );
});

self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close();
  const cible = new URL((evenement.notification.data && evenement.notification.data.url) || '/erp', self.location.origin).href;
  evenement.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const f of fenetres) {
        if (new URL(f.url).pathname.startsWith('/erp')) {
          await f.focus();
          // L'app suit le lien sans recharger (src/erp/data/application.ts).
          f.postMessage({ type: 'lm-ouvrir', url: cible });
          return;
        }
      }
      await self.clients.openWindow(cible);
    })(),
  );
});
