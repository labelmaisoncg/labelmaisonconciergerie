import type { ReactNode } from 'react';

/** Chaque page reçoit la barre d'onglets du module, placée sous son en-tête. */
export interface PageFinanceProps {
  onglets: ReactNode;
}

export const FIL_FINANCE = [{ libelle: 'Finance', to: '/erp/finance' }];
