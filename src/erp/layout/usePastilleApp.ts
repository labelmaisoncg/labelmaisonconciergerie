import { useEffect } from 'react';
import { appliquerPastille, totalPastille } from '../data/pastille-app';
import { GROUPES, modulesDe } from '../modules/registry';
import { useCompteurs } from './useCompteurs';

/**
 * Pastille de l'icône de l'app (data/pastille-app.ts) : la somme des
 * pastilles de la barre du bas, posée à chaque changement et quand l'app
 * passe au premier ou à l'arrière-plan (une notification reçue pendant ce
 * temps a pu l'augmenter). Retirée à la déconnexion.
 */
export function usePastilleApp(): void {
  const compteurs = useCompteurs();
  const total = totalPastille(
    GROUPES.filter((g) => !g.bas)
      .flatMap((g) => modulesDe(g.cle))
      .map((m) => (m.compteur ? compteurs[m.compteur] : 0)),
  );

  useEffect(() => {
    appliquerPastille(total);
    const revoir = () => appliquerPastille(total);
    document.addEventListener('visibilitychange', revoir);
    return () => document.removeEventListener('visibilitychange', revoir);
  }, [total]);

  // Plus de session (déconnexion, autre compte) : plus de pastille.
  useEffect(() => () => appliquerPastille(0), []);
}
