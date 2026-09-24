import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert } from '../../../ui';

export interface AvisContenu {
  ton: 'succes' | 'danger' | 'info' | 'alerte';
  texte: ReactNode;
  action?: ReactNode;
}

/** Message éphémère (succès d'une action, erreur métier) affiché en bas d'écran. */
export function useAvis(duree = 6000) {
  const [avis, setAvis] = useState<AvisContenu | null>(null);
  const minuteur = useRef<number | undefined>(undefined);

  const afficher = useCallback(
    (a: AvisContenu) => {
      window.clearTimeout(minuteur.current);
      setAvis(a);
      minuteur.current = window.setTimeout(() => setAvis(null), duree);
    },
    [duree],
  );
  const fermer = useCallback(() => setAvis(null), []);
  useEffect(() => () => window.clearTimeout(minuteur.current), []);

  const rendu = avis ? (
    <div aria-live="polite" className="fixed inset-x-4 bottom-4 z-[60] sm:left-auto sm:w-[26rem]">
      <Alert tone={avis.ton} actions={<>{avis.action}<button type="button" onClick={fermer} className="text-[12.5px] font-medium text-(--lm-encre-2) hover:text-(--lm-encre)">Fermer</button></>} className="shadow-(--lm-ombre-haute)">
        {avis.texte}
      </Alert>
    </div>
  ) : null;

  return { afficher, fermer, rendu };
}
