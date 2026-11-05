import type { RoleUtilisateur } from './types';
import type { TypeNotification } from './notifications';

/**
 * Pastille rouge sur l'icône de l'app installée, comme une vraie app
 * (demande de l'utilisateur). iPhone : iOS 16.4 ou plus, app ajoutée à
 * l'écran d'accueil, notifications autorisées. Android : selon le lanceur.
 *
 * - App ouverte : le nombre exact, la somme des pastilles de la barre du bas
 *   que cette personne doit traiter (messages qui attendent une réponse ;
 *   personnes à appeler pour le gérant, qui seul rappelle ; rien pour un
 *   compte en lecture seule), repris à chaque changement et quand l'app passe
 *   au premier ou à l'arrière-plan. Retirée à la déconnexion.
 * - App fermée : le service worker (public/erp-sw.js) ajoute 1 à chaque
 *   notification qui apporte une chose à traiter (TYPES_A_TRAITER), jamais
 *   pour une notification d'essai ; l'app remet le nombre exact à sa
 *   prochaine ouverture.
 */

/** Types de notification qui ajoutent une chose comptée dans la barre du bas. Même liste que public/erp-sw.js. */
export const TYPES_A_TRAITER: readonly TypeNotification[] = ['message', 'agent_main', 'probleme', 'lead'];

/** Plus grand nombre envoyé au système (au-delà, l'icône n'a plus la place). */
export const PASTILLE_MAX = 9999;

/** Message de l'app au service worker : le nombre exact, pour repartir de là à la prochaine notification. */
export const MESSAGE_PASTILLE = 'lm-pastille';

/** Compteurs de la barre du bas qui ne concernent que le gérant (c'est lui qui rappelle les demandes). */
export const COMPTEURS_DU_GERANT: readonly string[] = ['contactsAAppeler'];

/**
 * Les compteurs de la barre du bas que compte l'icône de cette personne :
 * tous pour le gérant, sans les personnes à appeler pour les autres rôles,
 * aucun pour un compte en lecture seule (il ne traite rien).
 */
export function compteursPourRole(role: RoleUtilisateur, compteurs: readonly { cle: string; n: number }[]): number[] {
  if (role === 'lecture') return [];
  return compteurs.filter((c) => role === 'gerant' || !COMPTEURS_DU_GERANT.includes(c.cle)).map((c) => c.n);
}

/** Total de l'icône : la somme des compteurs, entiers positifs seulement, bornée. */
export function totalPastille(compteurs: readonly number[]): number {
  const somme = compteurs.reduce((s, n) => s + (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0), 0);
  return Math.min(somme, PASTILLE_MAX);
}

type NavigateurPastille = {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
  serviceWorker?: { controller?: { postMessage: (m: unknown) => void } | null };
};

/** Pose (ou retire, à 0) la pastille de l'icône et prévient le service worker. Sans effet là où ce n'est pas pris en charge. */
export function appliquerPastille(n: number, nav: NavigateurPastille | undefined = typeof navigator === 'undefined' ? undefined : (navigator as unknown as NavigateurPastille)): void {
  if (!nav) return;
  const total = totalPastille([n]);
  try {
    const p = total > 0 ? nav.setAppBadge?.(total) : nav.clearAppBadge?.();
    p?.catch(() => undefined);
  } catch {
    /* refusé (notifications non autorisées) : rien à faire */
  }
  try {
    nav.serviceWorker?.controller?.postMessage({ type: MESSAGE_PASTILLE, n: total });
  } catch {
    /* service worker absent ou en cours de remplacement */
  }
}
