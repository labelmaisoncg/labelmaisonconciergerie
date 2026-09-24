/**
 * Façade de la page Automatisations sur l'état du store (règles actives +
 * journal), qui fait tourner le moteur au chargement et après chaque action.
 */
import { useErp } from '../../../data/store';
import { REGLES, type EvenementAuto } from '../../../automatisations';

export interface EtatAuto {
  actives: Record<string, boolean>;
  evenements: EvenementAuto[];
}

export function useEtatAuto() {
  const erp = useErp();
  const etat: EtatAuto = { actives: erp.reglesActives, evenements: erp.evenementsAuto };
  const clesActives = REGLES.filter((r) => erp.estRegleActive(r.cle)).map((r) => r.cle);
  return {
    etat,
    estActive: erp.estRegleActive,
    basculer: erp.basculerRegle,
    ajouterEvenements: erp.ajouterEvenementsAuto,
    viderJournal: erp.viderJournalAuto,
    clesActives,
  };
}
