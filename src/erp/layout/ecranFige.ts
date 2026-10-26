/**
 * Écran figé comme une app sur téléphone et tablette : pas de zoom au
 * pincement ni au double tap. Safari sur iPhone ignore « user-scalable=no »
 * (scripts/spa-shells.mjs) : ses gestes de zoom sont donc aussi bloqués ici.
 * Le reste (rebond, zoom automatique des champs) est réglé dans erp.css.
 */
export function figerEcran(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia?.('(pointer: coarse)').matches) return () => undefined;
  const bloquer = (e: Event) => e.preventDefault();
  const gestes = ['gesturestart', 'gesturechange', 'gestureend'];
  for (const g of gestes) document.addEventListener(g, bloquer, { passive: false });
  return () => {
    for (const g of gestes) document.removeEventListener(g, bloquer);
  };
}
