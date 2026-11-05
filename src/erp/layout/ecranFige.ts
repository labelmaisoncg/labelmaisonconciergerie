/** Réglage d'écran de l'app ERP (le même que la coquille /erp, scripts/spa-shells.mjs). */
export const VIEWPORT_ERP = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

/**
 * Écran figé comme une app sur téléphone et tablette : pas de zoom au
 * pincement ni au double tap. Safari sur iPhone ignore « user-scalable=no » :
 * ses gestes de zoom sont donc aussi bloqués ici. Le reste (rebond, zoom
 * automatique des champs, zones qui défilent) est réglé dans erp.css.
 *
 * Le réglage d'écran est aussi posé ici : la coquille /erp l'a déjà, mais en
 * arrivant du site sans recharger la page (même application), on gardait
 * celui du site, où le zoom est permis. Il est rendu au site en sortant.
 */
export function figerEcran(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const avant = meta?.getAttribute('content') ?? null;
  meta?.setAttribute('content', VIEWPORT_ERP);
  const tactile = !!window.matchMedia?.('(pointer: coarse)').matches;
  const bloquer = (e: Event) => e.preventDefault();
  const gestes = ['gesturestart', 'gesturechange', 'gestureend'];
  if (tactile) for (const g of gestes) document.addEventListener(g, bloquer, { passive: false });
  return () => {
    if (tactile) for (const g of gestes) document.removeEventListener(g, bloquer);
    if (meta && avant !== null) meta.setAttribute('content', avant);
  };
}
