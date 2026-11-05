import { demandesATraiter, peutVoirDemandes } from '../../../data/demandes-proprietaires';
import { useErp } from '../../../data/store';
import { Tabs } from '../../../ui';

/**
 * Logements · Avis · Demandes : vues de la même rubrique, sans entrée de menu
 * de plus. « Demandes » (celles des propriétaires, avec le nombre qui attend
 * une réponse) : le gérant seulement.
 */
export function OngletsLogements() {
  const d = useErp();
  const gerant = peutVoirDemandes(d.utilisateur.role);
  const attente = gerant ? demandesATraiter(d.demandesProprietaires).length : 0;
  return (
    <Tabs
      label="Vues des logements"
      onglets={[
        { cle: 'liste', libelle: 'Tous', to: '/erp/logements', end: true },
        { cle: 'avis', libelle: 'Avis', to: '/erp/logements/avis' },
        ...(gerant ? [{ cle: 'demandes', libelle: 'Demandes', to: '/erp/logements/demandes', ...(attente ? { compteur: attente } : {}) }] : []),
      ]}
    />
  );
}
