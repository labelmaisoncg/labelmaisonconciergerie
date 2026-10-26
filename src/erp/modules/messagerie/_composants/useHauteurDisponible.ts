import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Hauteur qui reste sous un élément jusqu'au bas de la fenêtre (moins la
 * marge du bas de page) : la boîte de réception tient pile dans l'écran, sans
 * défilement de page. La position est mesurée depuis le haut du document, si
 * bien qu'un défilement ne change rien ; on remesure au redimensionnement.
 */
export function useHauteurDisponible<T extends HTMLElement>(margeBas: number, minimum = 480) {
  const ref = useRef<T>(null);
  const [hauteur, setHauteur] = useState<number>();

  useLayoutEffect(() => {
    const mesurer = () => {
      const el = ref.current;
      if (!el) return;
      const haut = el.getBoundingClientRect().top + window.scrollY;
      setHauteur(Math.max(minimum, Math.floor(window.innerHeight - haut - margeBas)));
    };
    mesurer();
    // Un bandeau (synchronisation, lecture seule) peut apparaître juste après le premier rendu.
    const t = window.setTimeout(mesurer, 400);
    window.addEventListener('resize', mesurer);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', mesurer);
    };
  }, [margeBas, minimum]);

  return [ref, hauteur] as const;
}
