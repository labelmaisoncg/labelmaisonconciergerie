import { useMemo } from 'react';
import { useErp } from '../data/store';
import { incidentsOuverts } from '../data/selectors';
import type { CleCompteur } from '../modules/registry';
import { AUJOURDHUI } from '../data/format';

/** Compteurs de la barre latérale (à traiter, pas des totaux). */
export function useCompteurs(): Record<CleCompteur, number> {
  const { missions, filsMessages, incidents } = useErp();
  return useMemo(
    () => ({
      missionsAAttribuer: missions.filter((m) => m.statut === 'a_attribuer' && m.date >= AUJOURDHUI).length,
      // Même définition que « Pour vous » dans la messagerie : confiées par l'agent ou sans réponse.
      messagesEnAttente: filsMessages.filter((f) => f.statut !== 'clos' && (f.statut === 'escalade' || f.traitePar === 'en_attente')).length,
      incidentsOuverts: incidentsOuverts(incidents).length,
    }),
    [missions, filsMessages, incidents],
  );
}
