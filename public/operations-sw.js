/*
 * Service worker de l'app « Opérations » (portée /espace-operations), pour
 * les responsables de pôle et les agents de terrain. Celui de l'ERP
 * (public/erp-sw.js, portée /erp) est à part : chacun son cache, ses
 * notifications et ses écrans.
 *
 * - Notifications : affiche ce que le serveur envoie
 *   (api/_operations-notifications.ts, src/erp/data/notifications-operations.ts) ;
 *   un toucher ouvre le bon écran de l'espace.
 * - Cache : seulement les fichiers /assets/ (noms uniques à chaque version),
 *   jamais les pages, les données ni /api. Les pages passent toujours par le
 *   réseau (la session reste vérifiée par le serveur) ; sans réseau, une
 *   courte page « Pas de connexion ».
 *
 * Servi à la racine du site (hors de toute zone protégée) pour que le
 * navigateur puisse le charger sans session ; sa portée est /espace-operations.
 */
const CACHE = 'lm-ops-assets-v1';
const MAX_FICHIERS = 120;
const PAGE = '/espace-operations';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    (async () => {
      const noms = await caches.keys();
      // Seulement les anciens caches de cette app : ceux de l'ERP (lm-erp-…) ne sont jamais touchés.
      await Promise.all(noms.filter((n) => n.startsWith('lm-ops-') && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

const HORS_LIGNE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Opérations</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbfaf8;color:#14110e;font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:24px;text-align:center}
h1{font-size:20px;margin:0 0 6px}p{margin:0 0 20px;color:rgba(20,17,14,.68)}button{height:44px;padding:0 20px;border:0;border-radius:8px;background:#8a6424;color:#fff;font:inherit;font-weight:600}</style></head>
<body><main><h1>Pas de connexion internet</h1><p>Votre espace se rouvre dès le retour du réseau.</p><button onclick="location.reload()">Réessayer</button></main></body></html>`;

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

const dansLApp = (chemin) => chemin === PAGE || chemin.startsWith(`${PAGE}/`);

/** Adresse d'un écran de l'espace (même site, sous /espace-operations), sinon l'accueil de l'espace. */
function ecranDeLApp(u) {
  try {
    const x = new URL(String(u || ''), self.location.origin);
    return x.origin === self.location.origin && dansLApp(x.pathname) ? x.pathname + x.search : PAGE;
  } catch {
    return PAGE;
  }
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
  if (requete.mode === 'navigate' && dansLApp(url.pathname)) {
    evenement.respondWith(fetch(requete).catch(() => new Response(HORS_LIGNE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
  }
  // Tout le reste (dont /api/espace-operations) : réseau, sans cache.
});

self.addEventListener('push', (evenement) => {
  let d = {};
  try {
    d = evenement.data ? evenement.data.json() : {};
  } catch {
    d = { corps: evenement.data ? evenement.data.text() : '' };
  }
  const url = ecranDeLApp(d.url);
  evenement.waitUntil(
    self.registration.showNotification(d.titre || 'Opérations', {
      body: d.corps || '',
      icon: '/erp-app/icone-192.png',
      badge: '/erp-app/badge-96.png',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      lang: 'fr',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close();
  const cible = new URL(ecranDeLApp(evenement.notification.data && evenement.notification.data.url), self.location.origin).href;
  evenement.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const f of fenetres) {
        if (dansLApp(new URL(f.url).pathname)) {
          await f.focus();
          // L'espace ouvre l'écran sans recharger (src/erp/espace-operations/app-operations.ts).
          f.postMessage({ type: 'lm-ouvrir', url: cible });
          return;
        }
      }
      await self.clients.openWindow(cible);
    })(),
  );
});
