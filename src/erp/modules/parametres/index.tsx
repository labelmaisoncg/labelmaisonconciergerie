import { Navigate, Route, Routes } from 'react-router-dom';
import { PageHeader, Tabs } from '../../ui';
import Utilisateurs from './Utilisateurs';
import Integrations from './Integrations';
import Donnees from './Donnees';
import Entreprise from './Entreprise';

/** Module Paramètres : utilisateurs et rôles, intégrations, données de démo, entreprise. */
export default function Module() {
  return (
    <>
      <PageHeader
        fil={[{ libelle: 'ERP', to: '/erp' }, { libelle: 'Paramètres' }]}
        titre="Paramètres"
        sousTitre="Qui a accès à quoi, services connectés et identité de la société."
      />
      <Tabs
        label="Sections des paramètres"
        onglets={[
          { cle: 'utilisateurs', libelle: 'Utilisateurs & rôles', to: '/erp/parametres', end: true },
          { cle: 'integrations', libelle: 'Intégrations', to: '/erp/parametres/integrations' },
          { cle: 'donnees', libelle: 'Données de démo', to: '/erp/parametres/donnees' },
          { cle: 'entreprise', libelle: 'Entreprise', to: '/erp/parametres/entreprise' },
        ]}
      />
      <Routes>
        <Route index element={<Utilisateurs />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="donnees" element={<Donnees />} />
        <Route path="entreprise" element={<Entreprise />} />
        <Route path="*" element={<Navigate to="/erp/parametres" replace />} />
      </Routes>
    </>
  );
}
