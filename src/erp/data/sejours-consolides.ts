/**
 * Prolongations : des réservations qui se suivent (l'une arrive le jour où
 * l'autre part), du même voyageur, dans le même logement, forment UN séjour,
 * donc UN ménage. Le bilan du propriétaire (bilanMensuel, ficheLogement) et
 * sa facture mensuelle passent tous les deux par consoliderSejours : ils
 * comptent les mêmes séjours et les mêmes ménages.
 *
 * Séjour consolidé : de la première arrivée au dernier départ ; montants
 * encaissés et commissions des plateformes additionnés ; un seul ménage (le
 * plus élevé des frais de ménage des réservations regroupées) ; le voyageur
 * et la plateforme de la première réservation. Ses montants sont ensuite
 * répartis au prorata des nuits comme ceux d'une réservation.
 *
 * Même voyageur : même identifiant chez la plateforme quand les deux en ont
 * un ; sinon même nom complet (sans tenir compte des majuscules, accents et
 * espaces). Un nom générique (« Voyageur », « Guest ») ou vide ne regroupe
 * jamais rien. Une réservation annulée n'est jamais regroupée.
 *
 * Module pur (navigateur et serveur).
 */
import type { Id, Reservation } from './types';

/** Séjour, éventuellement fait de plusieurs réservations (ids dans l'ordre). */
export type SejourConsolide = Reservation & { reservations: Id[] };

const NOMS_GENERIQUES = new Set(['voyageur', 'voyageuse', 'guest', 'invite', 'invitee', 'client', 'cliente', 'reserved', 'not available', 'inconnu']);

const montant = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 0);

function nomNormalise(nom: unknown): string {
  const n = String(nom ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/[^\p{L}\p{N}@.+]+/gu, ' ')
    .trim();
  return NOMS_GENERIQUES.has(n) ? '' : n;
}

/** Les deux réservations sont-elles du même voyageur ? */
export function memeVoyageur(a: Pick<Reservation, 'voyageur' | 'repull'>, b: Pick<Reservation, 'voyageur' | 'repull'>): boolean {
  const ia = a.repull?.voyageurId ? String(a.repull.voyageurId) : '';
  const ib = b.repull?.voyageurId ? String(b.repull.voyageurId) : '';
  if (ia && ib) return ia === ib;
  const na = nomNormalise(a.voyageur?.nom);
  return !!na && na === nomNormalise(b.voyageur?.nom);
}

const jours = (de: string, a: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);

/**
 * Regroupe les prolongations. Les réservations reçues sont celles à
 * compter (déjà filtrées : celles du propriétaire, non annulées) ; le
 * résultat est trié par arrivée. Une réservation seule donne un séjour
 * identique à elle-même (plus `reservations: [son id]`).
 */
export function consoliderSejours(reservations: readonly Reservation[]): SejourConsolide[] {
  const tries = reservations
    .filter((r) => !!r && typeof r.arrivee === 'string' && typeof r.depart === 'string')
    .slice()
    .sort((a, b) => String(a.logementId).localeCompare(String(b.logementId)) || a.arrivee.localeCompare(b.arrivee) || a.depart.localeCompare(b.depart) || String(a.id).localeCompare(String(b.id)));
  const res: SejourConsolide[] = [];
  let derniere: Reservation | null = null;
  for (const r of tries) {
    const c: SejourConsolide | undefined = res[res.length - 1];
    const prolonge =
      !!c &&
      !!derniere &&
      r.statut !== 'annulee' &&
      c.statut !== 'annulee' &&
      r.logementId === c.logementId &&
      r.arrivee >= c.arrivee &&
      r.arrivee <= c.depart &&
      memeVoyageur(derniere, r);
    if (c && prolonge) {
      const depart: string = r.depart > c.depart ? r.depart : c.depart;
      res[res.length - 1] = {
        ...c,
        depart,
        nuits: jours(c.arrivee, depart),
        montantBrutCentimes: montant(c.montantBrutCentimes) + montant(r.montantBrutCentimes),
        commissionPlateformeCentimes: montant(c.commissionPlateformeCentimes) + montant(r.commissionPlateformeCentimes),
        // Un seul ménage pour le séjour entier.
        fraisMenageCentimes: Math.max(montant(c.fraisMenageCentimes), montant(r.fraisMenageCentimes)),
        voyageur: { ...c.voyageur, nbPersonnes: Math.max(montant(c.voyageur?.nbPersonnes), montant(r.voyageur?.nbPersonnes)) },
        reservations: [...c.reservations, r.id],
      };
    } else {
      res.push({ ...r, reservations: [r.id] });
    }
    derniere = r;
  }
  return res.sort((a, b) => a.arrivee.localeCompare(b.arrivee) || String(a.logementId).localeCompare(String(b.logementId)));
}

/** Nombre de prolongations d'un séjour (0 : une seule réservation). */
export const prolongations = (s: Partial<SejourConsolide>): number => Math.max(0, (s.reservations?.length ?? 1) - 1);
