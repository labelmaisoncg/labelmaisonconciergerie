import { useEffect } from 'react';
import { appliquerPastille, compteursPourRole, totalPastille } from '../data/pastille-app';
import { useErp } from '../data/store';
import { GROUPES, modulesDe } from '../modules/registry';
import { useCompteurs } from './useCompteurs';

/**
 * Pastille de l'icône de l'app (data/pastille-app.ts) : la somme des
 * pastilles de la barre du bas que cette personne doit traiter, posée à
 * chaque changement et quand l'app passe au premier ou à l'arrière-plan (une
 * notification reçue pendant ce temps a pu l'augmenter). Retirée par
 * seDeconnecter (store.tsx), pas en quittant cet écran : « Installer l'app »
 * ou « Autoriser Claude » s'affichent hors du cadre, la session continue.
 */
export function usePastilleApp(): void {
  const compteurs = useCompteurs();
  const { utilisateur } = useErp();
  const total = totalPastille(
    compteursPourRole(
      utilisateur.role,
      GROUPES.filter((g) => !g.bas)
        .flatMap((g) => modulesDe(g.cle))
        .flatMap((m) => (m.compteur ? [{ cle: m.compteur, n: compteurs[m.compteur] }] : [])),
    ),
  );

  useEffect(() => {
    appliquerPastille(total);
    const revoir = () => appliquerPastille(total);
    document.addEventListener('visibilitychange', revoir);
    return () => document.removeEventListener('visibilitychange', revoir);
  }, [total]);
}
