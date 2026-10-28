import { useMemo } from 'react';
import { useErp } from '../data/store';
import { incidentsOuverts, missionPrestataire } from '../data/selectors';
import type { CleCompteur } from '../modules/registry';
import { AUJOURDHUI } from '../data/format';
import { aTraiterLe } from '../data/crm';
import { attendEquipe } from '../data/attente-equipe';

/** Compteurs de la barre latérale (à traiter, pas des totaux). */
export function useCompteurs(): Record<CleCompteur, number> {
  const { missions, filsMessages, incidents, crm } = useErp();
  return useMemo(
    () => ({
      missionsAAttribuer: missions.filter((m) => m.statut === 'a_attribuer' && missionPrestataire(m) && m.date >= AUJOURDHUI).length,
      // Même définition que « À répondre » dans la messagerie : confiées par l'agent ou sans réponse.
      messagesEnAttente: filsMessages.filter(attendEquipe).length,
      incidentsOuverts: incidentsOuverts(incidents).length,
      // Nouvelles demandes du site et relances arrivées à échéance.
      contactsAAppeler: crm.filter((c) => aTraiterLe(c, AUJOURDHUI)).length,
    }),
    [missions, filsMessages, incidents, crm],
  );
}
