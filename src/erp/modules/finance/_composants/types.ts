import type { ReactNode } from 'react';

/** Chaque page reçoit la barre d'onglets du module, placée sous son en-tête. */
export interface PageFinanceProps {
  onglets: ReactNode;
}

/** Les onglets de la finance disent déjà où l'on est : pas de fil d'Ariane. */
export const FIL_FINANCE: { libelle: string; to?: string }[] = [];
