/**
 * Démonstration (VITE_ERP_DEMO=1) du livret et du check-in en ligne : les
 * check-ins restent dans ce navigateur (CLE_DEMO_CHECKINS), lus par la page
 * /sejour?apercu=<réservation> et par la fiche de la réservation dans l'ERP.
 * Jamais utilisé en production.
 */
import { CLE_DEMO_CHECKINS, type CheckinEnLigne } from '../data/sejour';

export function checkinsDemo(): Record<string, CheckinEnLigne> {
  try {
    const x = JSON.parse(window.localStorage.getItem(CLE_DEMO_CHECKINS) ?? '{}') as Record<string, CheckinEnLigne>;
    return x && typeof x === 'object' && !Array.isArray(x) ? x : {};
  } catch {
    return {};
  }
}

/** Enregistre un check-in de démonstration ; faux si le navigateur refuse (navigation privée). */
export function garderCheckinDemo(c: CheckinEnLigne): boolean {
  try {
    window.localStorage.setItem(CLE_DEMO_CHECKINS, JSON.stringify({ ...checkinsDemo(), [c.id]: c }));
    return true;
  } catch {
    return false;
  }
}

/** Lien de démonstration d'un séjour (sur ce poste). */
export const lienSejourDemo = (reservationId: string): string => `${window.location.origin}/sejour?apercu=${encodeURIComponent(reservationId)}`;
