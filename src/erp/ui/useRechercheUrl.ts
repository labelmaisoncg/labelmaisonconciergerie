import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Champ de recherche d'une liste, prérempli par l'adresse (`?q=`) : la
 * recherche globale (« Voir tout ») ouvre ainsi la liste déjà filtrée.
 */
export function useRechercheUrl(): [string, (q: string) => void] {
  const [params] = useSearchParams();
  const depuisUrl = params.get('q') ?? '';
  const [q, setQ] = useState(depuisUrl);
  useEffect(() => {
    if (depuisUrl) setQ(depuisUrl);
  }, [depuisUrl]);
  return [q, setQ];
}
