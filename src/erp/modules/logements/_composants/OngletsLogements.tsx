import { Tabs } from '../../../ui';

/** Logements · Avis : deux vues de la même rubrique, sans entrée de menu de plus. */
export function OngletsLogements() {
  return (
    <Tabs
      label="Vues des logements"
      onglets={[
        { cle: 'liste', libelle: 'Tous', to: '/erp/logements', end: true },
        { cle: 'avis', libelle: 'Avis', to: '/erp/logements/avis' },
      ]}
    />
  );
}
