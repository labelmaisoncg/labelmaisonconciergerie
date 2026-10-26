/**
 * L'ERP en app installable, côté navigateur : manifeste et service worker
 * (public/erp-app, public/erp-sw.js), proposition d'installation, appareil
 * (iPhone, Android, ordinateur) et abonnement aux notifications.
 *
 * Les notifications passent par /api/erp-notifications (serveur) ; ce module
 * ne fait que demander l'autorisation au navigateur et transmettre
 * l'abonnement.
 */
import { b64url, deB64url } from './web-push';

export const URL_SERVICE_WORKER = '/erp-sw.js';
export const PORTEE = '/erp';
export const URL_MANIFESTE = '/erp-app/manifest.webmanifest';

export type Appareil = 'iphone' | 'android' | 'ordinateur';

/** L'appareil, pour expliquer l'installation avec les bons mots. */
export function appareil(): Appareil {
  if (typeof navigator === 'undefined') return 'ordinateur';
  const ua = navigator.userAgent || '';
  // iPad récent : se présente comme un Mac, mais tactile.
  const ipad = /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
  if (/iPhone|iPad|iPod/.test(ua) || ipad) return 'iphone';
  if (/Android/i.test(ua)) return 'android';
  return 'ordinateur';
}

export const NOM_APPAREIL: Record<Appareil, string> = { iphone: 'iPhone', android: 'Android', ordinateur: 'Ordinateur' };

/** L'ERP est-il ouvert comme une app installée (et non dans un onglet) ? */
export function estInstallee(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

/** Safari sur iPhone hors de l'app installée : pas de notifications avant l'installation. */
export const iphoneHorsApp = () => appareil() === 'iphone' && !estInstallee();

/* -------------------------------------------- proposition d'installation */

interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let propositionEnAttente: EvenementInstallation | null = null;
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

/** Mémoire « l'app est installée » : le navigateur la garde après l'installation. */
const CLE_INSTALLEE = 'lm-erp-app-installee';

function retenirInstallation(): void {
  try {
    window.localStorage.setItem(CLE_INSTALLEE, '1');
  } catch {
    /* stockage indisponible : la proposition pourra revenir */
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

/** Le navigateur sait-il installer l'app d'un clic (bouton « Installer ») ? */
export const installationDirecte = () => !!propositionEnAttente;

/** L'app est-elle installée sur cet appareil (ouverte en app, ou installée depuis ce navigateur) ? */
export function dejaInstallee(): boolean {
  if (estInstallee()) {
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
export async function installer(): Promise<boolean> {
  const p = propositionEnAttente;
  if (!p) return false;
  await p.prompt();
  const choix = await p.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
  propositionEnAttente = null;
  if (choix.outcome === 'accepted') retenirInstallation();
  prevenir();
  return choix.outcome === 'accepted';
}

/* --------------------------------------------------- service worker */

/** Manifeste présent même si l'ERP a été ouvert depuis une autre page du site. */
export function assurerManifeste(): void {
  if (typeof document === 'undefined' || document.querySelector('link[rel="manifest"]')) return;
  const l = document.createElement('link');
  l.rel = 'manifest';
  l.href = URL_MANIFESTE;
  document.head.appendChild(l);
}

/**
 * Enregistre le service worker (version construite seulement) et suit les
 * notifications touchées alors que l'app est ouverte (`naviguer`).
 */
export function demarrerApplication(naviguer: (chemin: string) => void): () => void {
  assurerManifeste();
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || import.meta.env.DEV) return () => undefined;
  navigator.serviceWorker.register(URL_SERVICE_WORKER, { scope: PORTEE }).catch((e) => console.warn('[app] service worker non enregistré', e));
  const ecouter = (e: MessageEvent) => {
    const d = e.data as { type?: string; url?: string } | null;
    if (d?.type !== 'lm-ouvrir' || typeof d.url !== 'string') return;
    const u = new URL(d.url, window.location.origin);
    if (u.origin === window.location.origin && u.pathname.startsWith('/erp')) naviguer(u.pathname + u.search);
  };
  navigator.serviceWorker.addEventListener('message', ecouter);
  return () => navigator.serviceWorker.removeEventListener('message', ecouter);
}

/* ------------------------------------------------------- notifications */

export type EtatAutorisation = 'accordee' | 'refusee' | 'a-demander' | 'indisponible';

/** Ce navigateur sait-il recevoir des notifications (iPhone : seulement dans l'app installée) ? */
export function notificationsPossibles(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function autorisation(): EtatAutorisation {
  if (!notificationsPossibles()) return 'indisponible';
  const p = Notification.permission;
  return p === 'granted' ? 'accordee' : p === 'denied' ? 'refusee' : 'a-demander';
}

async function enregistrement(): Promise<ServiceWorkerRegistration | null> {
  if (!notificationsPossibles()) return null;
  const r = (await navigator.serviceWorker.getRegistration(PORTEE)) ?? (await navigator.serviceWorker.register(URL_SERVICE_WORKER, { scope: PORTEE }).catch(() => null));
  if (!r) return null;
  await navigator.serviceWorker.ready.catch(() => undefined);
  return r;
}

/** Abonnement actuel de cet appareil (null : pas abonné). */
export async function abonnementActuel(): Promise<PushSubscription | null> {
  const r = await enregistrement();
  return r ? r.pushManager.getSubscription().catch(() => null) : null;
}

/** Abonnement au format attendu par le serveur. */
export function versAbonnement(s: PushSubscription): { endpoint: string; keys: { p256dh: string; auth: string } } {
  const cle = (n: 'p256dh' | 'auth') => {
    const b = s.getKey(n);
    return b ? b64url(new Uint8Array(b)) : '';
  };
  return { endpoint: s.endpoint, keys: { p256dh: cle('p256dh'), auth: cle('auth') } };
}

/**
 * Demande l'autorisation (dans un geste de l'utilisateur) et abonne cet
 * appareil avec la clé publique du serveur. Renvoie l'abonnement, ou null.
 */
export async function sAbonner(clePublique: string): Promise<PushSubscription | null> {
  if (!notificationsPossibles()) return null;
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

/** Coupe les notifications sur cet appareil. */
export async function seDesabonner(): Promise<string | null> {
  const s = await abonnementActuel();
  if (!s) return null;
  const endpoint = s.endpoint;
  await s.unsubscribe().catch(() => undefined);
  return endpoint;
}
