import { useEffect, useRef } from 'react';

/**
 * Comportements communs des fenêtres (Drawer, Modal) : Échap pour fermer,
 * focus déplacé dans le panneau puis rendu à l'élément d'origine, défilement
 * de la page bloqué.
 */
// Pile des fenêtres ouvertes : seule la plus haute réagit au clavier, pour
// qu'Échap ferme la Modal posée sur un Drawer sans fermer le Drawer.
const pile: symbol[] = [];

export function useFenetre<T extends HTMLElement>(ouvert: boolean, onFermer: () => void) {
  const ref = useRef<T>(null);
  const fermer = useRef(onFermer);
  fermer.current = onFermer;

  useEffect(() => {
    if (!ouvert) return;
    const precedent = document.activeElement as HTMLElement | null;
    const debordement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const moi = Symbol('fenetre');
    pile.push(moi);

    const touche = (e: globalThis.KeyboardEvent) => {
      if (pile[pile.length - 1] !== moi) return;
      if (e.key === 'Escape') fermer.current();
      if (e.key !== 'Tab' || !ref.current) return;
      // Piège à focus minimal : on boucle dans le panneau.
      const focusables = ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const premier = focusables[0];
      const dernier = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      }
    };
    document.addEventListener('keydown', touche);
    return () => {
      document.removeEventListener('keydown', touche);
      pile.splice(pile.indexOf(moi), 1);
      document.body.style.overflow = debordement;
      precedent?.focus?.();
    };
  }, [ouvert]);

  return ref;
}
