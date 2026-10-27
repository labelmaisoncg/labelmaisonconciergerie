/**
 * L'espace opérations en app installable (« Opérations »), côté navigateur :
 * manifeste et service worker à part de ceux de l'ERP
 * (public/operations-app, public/operations-sw.js, portée
 * /espace-operations), proposition d'installation, appareil, abonnement
 * aux notifications.
 *
 * Volontairement indépendant de data/application.ts (l'app de l'ERP) :
 * même site, mais autre app, autre service worker, autres souvenirs dans le
 * navigateur. Les notifications passent par /api/espace-operations (session
 * de l'espace) ; ce module ne fait que demander l'autorisation et transmettre
 * l'abonnement.
 */
import { lireLienAcces } from '../data/acces-externe';
import { b64url, deB64url } from '../data/web-push';

export const URL_SERVICE_WORKER_OPS = '/operations-sw.js';
export const PORTEE_OPS = '/espace-operations';
export const URL_MANIFESTE_OPS = '/operations-app/manifest.webmanifest';
/** Nom de l'app sur l'écran d'accueil. */
export const NOM_APP_OPS = 'Opérations';

export type AppareilOps = 'iphone' | 'android' | 'ordinateur';
export const NOM_APPAREIL_OPS: Record<AppareilOps, string> = { iphone: 'iPhone', android: 'Android', ordinateur: 'Ordinateur' };

/** L'appareil, pour expliquer l'installation avec les bons mots. */
export function appareilOps(): AppareilOps {
  if (typeof navigator === 'undefined') return 'ordinateur';
  const ua = navigator.userAgent || '';
  // iPad récent : se présente comme un Mac, mais tactile.
  const ipad = /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
  if (/iPhone|iPad|iPod/.test(ua) || ipad) return 'iphone';
  if (/Android/i.test(ua)) return 'android';
  return 'ordinateur';
}

/** Ouvert comme une app (écran d'accueil), et non dans un onglet. */
export function ouverteEnApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

/* -------------------------------------------- proposition d'installation */

interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let propositionEnAttente: EvenementInstallation | null = null;
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

/** Mémoire « l'app Opérations est installée » (distincte de celle de l'ERP). */
const CLE_INSTALLEE = 'lm-ops-app-installee';

function retenirInstallation(): void {
  try {
    window.localStorage.setItem(CLE_INSTALLEE, '1');
  } catch {
    /* stockage indisponible : la page reproposera l'installation */
  }
}

if (typeof window !== 'undefined') {
  // Chrome, Edge, Android : le navigateur propose l'installation ; on la garde pour notre bouton.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    propositionEnAttente = e as EvenementInstallation;
    prevenir();
  });
  window.addEventListener('appinstalled', () => {
    propositionEnAttente = null;
    retenirInstallation();
    prevenir();
  });
}

/** Le navigateur installe-t-il l'app d'un toucher (fenêtre du système) ? */
export const installationDirecte = () => !!propositionEnAttente;

/** L'app est-elle installée sur cet appareil (ouverte en app, ou installée depuis ce navigateur) ? */
export function dejaInstallee(): boolean {
  if (ouverteEnApp()) {
    retenirInstallation();
    return true;
  }
  try {
    return window.localStorage.getItem(CLE_INSTALLEE) === '1';
  } catch {
    return false;
  }
}

export function surChangementInstallation(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

/** Ouvre la fenêtre d'installation du navigateur (vrai : installée). */
export async function installerApp(): Promise<boolean> {
  const p = propositionEnAttente;
  if (!p) return false;
  await p.prompt();
  const choix = await p.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
  propositionEnAttente = null;
  if (choix.outcome === 'accepted') retenirInstallation();
  prevenir();
  return choix.outcome === 'accepted';
}

/* ------------------------------------------------------- démarrage */

function assurer(selecteur: string, creer: () => HTMLElement): void {
  if (!document.head.querySelector(selecteur)) document.head.appendChild(creer());
}

/**
 * Manifeste et balises de l'écran d'accueil (la coquille de la page les a
 * déjà ; ici pour une arrivée depuis une autre page du site), service
 * worker (version construite seulement), et écrans ouverts par une
 * notification touchée alors que l'app est ouverte (`ouvrir` reçoit
 * « ?onglet=…&incident=… »).
 */
export function demarrerAppOps(ouvrir: (recherche: string) => void): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const manifeste = document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (manifeste && manifeste.getAttribute('href') !== URL_MANIFESTE_OPS) manifeste.setAttribute('href', URL_MANIFESTE_OPS);
  const meta = (name: string, content: string) => () => Object.assign(document.createElement('meta'), { name, content });
  assurer('link[rel="manifest"]', () => Object.assign(document.createElement('link'), { rel: 'manifest', href: URL_MANIFESTE_OPS }));
  assurer('meta[name="apple-mobile-web-app-capable"]', meta('apple-mobile-web-app-capable', 'yes'));
  assurer('meta[name="apple-mobile-web-app-title"]', meta('apple-mobile-web-app-title', NOM_APP_OPS));
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return () => undefined;
  navigator.serviceWorker.register(URL_SERVICE_WORKER_OPS, { scope: PORTEE_OPS }).catch((e) => console.warn('[app] service worker non enregistré', e));
  const ecouter = (e: MessageEvent) => {
    const d = e.data as { type?: string; url?: string } | null;
    if (d?.type !== 'lm-ouvrir' || typeof d.url !== 'string') return;
    const u = new URL(d.url, window.location.origin);
    if (u.origin === window.location.origin && u.pathname.startsWith(PORTEE_OPS)) ouvrir(u.search);
  };
  navigator.serviceWorker.addEventListener('message', ecouter);
  return () => navigator.serviceWorker.removeEventListener('message', ecouter);
}

/* ------------------------------------------- connexion dans l'app installée */

/**
 * Lien reçu par e-mail, collé dans l'app installée : l'adresse à ouvrir dans
 * l'app (« /espace-operations#espace=…&jeton=… »), ou null si ce n'est pas
 * un lien de l'espace opérations.
 */
export function lienColle(texte: string): string | null {
  try {
    const u = new URL(String(texte ?? '').trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.pathname.replace(/\/+$/, '') !== PORTEE_OPS) return null;
    const { jeton, espace } = lireLienAcces(u.hash);
    return jeton ? `${PORTEE_OPS}#espace=${espace}&jeton=${encodeURIComponent(jeton)}` : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------- notifications */

export type AutorisationOps = 'accordee' | 'refusee' | 'a-demander' | 'indisponible';

/** Ce navigateur sait-il recevoir des notifications (iPhone : seulement dans l'app installée) ? */
export function notificationsPossiblesOps(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function autorisationOps(): AutorisationOps {
  if (!notificationsPossiblesOps()) return 'indisponible';
  const p = Notification.permission;
  return p === 'granted' ? 'accordee' : p === 'denied' ? 'refusee' : 'a-demander';
}

async function enregistrement(): Promise<ServiceWorkerRegistration | null> {
  if (!notificationsPossiblesOps()) return null;
  const r = (await navigator.serviceWorker.getRegistration(PORTEE_OPS)) ?? (await navigator.serviceWorker.register(URL_SERVICE_WORKER_OPS, { scope: PORTEE_OPS }).catch(() => null));
  if (!r) return null;
  await navigator.serviceWorker.ready.catch(() => undefined);
  return r;
}

/** Abonnement actuel de cet appareil pour l'app Opérations (null : pas abonné). */
export async function abonnementOps(): Promise<PushSubscription | null> {
  if (!notificationsPossiblesOps()) return null;
  const r = await navigator.serviceWorker.getRegistration(PORTEE_OPS).catch(() => undefined);
  return r ? r.pushManager.getSubscription().catch(() => null) : null;
}

/** Abonnement au format attendu par le serveur. */
export function versAbonnementOps(s: PushSubscription): { endpoint: string; keys: { p256dh: string; auth: string } } {
  const cle = (n: 'p256dh' | 'auth') => {
    const b = s.getKey(n);
    return b ? b64url(new Uint8Array(b)) : '';
  };
  return { endpoint: s.endpoint, keys: { p256dh: cle('p256dh'), auth: cle('auth') } };
}

/**
 * Demande l'autorisation (dans le geste de l'utilisateur : obligatoire sur
 * iPhone) et abonne cet appareil avec la clé publique du serveur.
 */
export async function sAbonnerOps(clePublique: string): Promise<PushSubscription | null> {
  if (!notificationsPossiblesOps()) return null;
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const r = await enregistrement();
  if (!r) return null;
  const existant = await r.pushManager.getSubscription();
  const cle = deB64url(clePublique);
  // Clé du serveur changée : l'ancien abonnement ne recevrait plus rien.
  if (existant) {
    const actuelle = existant.options?.applicationServerKey;
    if (actuelle && b64url(new Uint8Array(actuelle)) === b64url(cle)) return existant;
    await existant.unsubscribe().catch(() => undefined);
  }
  return r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cle as unknown as BufferSource });
}

/** Coupe les notifications sur cet appareil ; rend l'adresse de l'abonnement coupé. */
export async function seDesabonnerOps(): Promise<string | null> {
  const s = await abonnementOps();
  if (!s) return null;
  const endpoint = s.endpoint;
  await s.unsubscribe().catch(() => undefined);
  return endpoint;
}
