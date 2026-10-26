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
 * Servi à la racine du site (hors de la zone protégée /erp) pour que le
 * navigateur puisse le charger sans session ; sa portée est /erp.
 */
const CACHE = 'lm-erp-assets-v1';
const MAX_FICHIERS = 120;

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
  evenement.waitUntil(
    self.registration.showNotification(titre, {
      body: d.corps || '',
      icon: '/erp-app/icone-192.png',
      badge: '/erp-app/badge-96.png',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      lang: 'fr',
      data: { url: typeof d.url === 'string' && d.url.startsWith('/erp') ? d.url : '/erp' },
    }),
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
