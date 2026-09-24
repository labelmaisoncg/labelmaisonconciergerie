import type { ErpDonnees, Id, Mission, PaiementPrestataire, Prestataire, StatutPaiementPrestataire } from '../../../data/types';

export interface LignePaiement {
  cle: string;
  prestataire: Prestataire;
  periode: string;
  /** Seules les missions validées sont payées (SPEC §2.4). */
  validees: Mission[];
  /** Missions de la période exclues du paiement faute de validation. */
  exclues: Mission[];
  montant: number;
  retenue: number;
  net: number;
  paiement?: PaiementPrestataire;
  statut: StatutPaiementPrestataire | 'a_preparer';
}

/** Paiements d'une période, recalculés à partir des missions (jamais saisis). */
export function lignesPaiement(d: Pick<ErpDonnees, 'missions' | 'prestataires' | 'paiementsPrestataires'>, periode: string): LignePaiement[] {
  const ids = new Set<Id>([
    ...d.missions.filter((m) => m.prestataireId && m.date.startsWith(periode) && m.statut !== 'annulee').map((m) => m.prestataireId!),
    ...d.paiementsPrestataires.filter((p) => p.periode === periode).map((p) => p.prestataireId),
  ]);
  return [...ids].flatMap((id) => {
    const prestataire = d.prestataires.find((p) => p.id === id);
    if (!prestataire) return [];
    const siennes = d.missions.filter((m) => m.prestataireId === id && m.date.startsWith(periode) && m.statut !== 'annulee');
    const validees = siennes.filter((m) => m.statut === 'validee');
    const exclues = siennes.filter((m) => m.statut !== 'validee');
    const paiement = d.paiementsPrestataires.find((p) => p.prestataireId === id && p.periode === periode);
    // Un paiement effectué est figé ; sinon on recalcule depuis les missions validées.
    const montant = paiement?.statut === 'paye' ? paiement.montantCentimes : validees.reduce((s, m) => s + m.tarifCentimes, 0);
    const retenue = paiement?.retenueCentimes ?? 0;
    return [
      {
        cle: `${id}:${periode}`,
        prestataire,
        periode,
        validees,
        exclues,
        montant,
        retenue,
        net: montant - retenue,
        paiement,
        statut: paiement?.statut ?? (validees.length ? 'a_payer' : 'a_preparer'),
      },
    ];
  });
}
