/**
 * Règles d'automatisation qui tournent dans l'ERP (store.tsx, et la page
 * Automatisations si elle revient).
 *
 * Channel manager (octobre 2026) : ménages, linge, prestataires, finance et
 * annonces sortent de l'ERP (BNB Cleaning reprendra ménages et linge). Leurs
 * règles ne tournent plus, sinon elles créeraient missions et alertes que
 * plus aucun écran n'affiche. Les règles des finances (relance-factures,
 * facturation-mensuelle, paiement-prestataire) écriraient des factures, que
 * seule la base numérote : elles ne doivent jamais tourner depuis le
 * navigateur (verifier-synchro.ts le contrôle). Restent celles qui servent
 * les logements et les voyageurs.
 */
import { REGLES } from '../automatisations';

export const REGLES_CHANNEL_MANAGER: ReadonlySet<string> = new Set(['activation-logement', 'plafond-120-nuits', 'messages-en-attente']);

/** Clés des règles à faire tourner : channel manager seulement, selon les interrupteurs (sinon leur valeur par défaut). */
export function clesActives(actives: Record<string, boolean>): string[] {
  return REGLES.filter((r) => REGLES_CHANNEL_MANAGER.has(r.cle) && (actives[r.cle] ?? r.actifParDefaut)).map((r) => r.cle);
}
