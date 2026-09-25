import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Formulaire de création ouvert par l'adresse : `?nouveau=1` (liens de la
 * carte « Démarrage » du tableau de bord). Fermer le formulaire retire le
 * paramètre, pour qu'un rechargement ne le rouvre pas.
 */
export function useCreationParUrl(): [boolean, (ouvert: boolean) => void] {
  const [params, setParams] = useSearchParams();
  const demande = params.get('nouveau') === '1';
  const [ouvert, setOuvert] = useState(demande);
  useEffect(() => {
    if (demande) setOuvert(true);
  }, [demande]);
  const changer = useCallback(
    (valeur: boolean) => {
      setOuvert(valeur);
      if (!valeur && demande) {
        const suivants = new URLSearchParams(params);
        suivants.delete('nouveau');
        setParams(suivants, { replace: true });
      }
    },
    [demande, params, setParams],
  );
  return [ouvert, changer];
}
