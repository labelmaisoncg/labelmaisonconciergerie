import { Navigate, Route, Routes } from 'react-router-dom';
import { PageHeader, Tabs } from '../../ui';
import Utilisateurs from './Utilisateurs';
import Integrations from './Integrations';
import Donnees from './Donnees';
import Entreprise from './Entreprise';

/** Module Paramètres : utilisateurs et rôles, intégrations, données (export), entreprise. */
export default function Module() {
  return (
    <>
      <PageHeader
        titre="Paramètres"
        sousTitre="Votre équipe, les services branchés à l’ERP et les informations de votre société."
      />
      <Tabs
        label="Sections des paramètres"
        onglets={[
          { cle: 'utilisateurs', libelle: 'Votre équipe', to: '/erp/parametres', end: true },
          { cle: 'integrations', libelle: 'Services connectés', to: '/erp/parametres/integrations' },
          { cle: 'donnees', libelle: 'Sauvegarde', to: '/erp/parametres/donnees' },
          { cle: 'entreprise', libelle: 'Votre société', to: '/erp/parametres/entreprise' },
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
