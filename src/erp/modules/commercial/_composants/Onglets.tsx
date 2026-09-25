import { Tabs } from '../../../ui';

/** Sous-navigation du module commercial. */
export function Onglets() {
  return (
    <Tabs
      label="Sections de la prospection"
      onglets={[
        { cle: 'pipeline', libelle: 'Vos contacts', to: '/erp/commercial', end: true },
        { cle: 'simulateur', libelle: 'Simulateur de revenus', to: '/erp/commercial/simulateur' },
        { cle: 'lancement', libelle: 'Préparer un contrat signé', to: '/erp/commercial/lancement' },
      ]}
    />
  );
}
