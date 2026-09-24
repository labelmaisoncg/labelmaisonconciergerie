import { Tabs } from '../../../ui';

/** Sous-navigation du module commercial. */
export function Onglets() {
  return (
    <Tabs
      label="Sections du module commercial"
      onglets={[
        { cle: 'pipeline', libelle: 'Pipeline', to: '/erp/commercial', end: true },
        { cle: 'simulateur', libelle: 'Simulateur de revenus', to: '/erp/commercial/simulateur' },
        { cle: 'lancement', libelle: 'Lancer un mandat', to: '/erp/commercial/lancement' },
      ]}
    />
  );
}
