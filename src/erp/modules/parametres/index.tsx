import { Navigate, Route, Routes } from 'react-router-dom';
import { PageHeader, Tabs } from '../../ui';
import Utilisateurs from './Utilisateurs';
import Integrations from './Integrations';
import Donnees from './Donnees';
import Entreprise from './Entreprise';

/** Module Paramètres : l'équipe et ses rôles, les plateformes (synchronisation), la société et sa sauvegarde. */
export default function Module() {
  return (
    <>
      <PageHeader titre="Paramètres" />
      <Tabs
        label="Sections des paramètres"
        onglets={[
          { cle: 'utilisateurs', libelle: 'Équipe', to: '/erp/parametres', end: true },
          { cle: 'plateformes', libelle: 'Plateformes', to: '/erp/parametres/plateformes' },
          { cle: 'societe', libelle: 'Société', to: '/erp/parametres/societe' },
        ]}
      />
      <Routes>
        <Route index element={<Utilisateurs />} />
        <Route path="plateformes" element={<Integrations />} />
        <Route
          path="societe"
          element={
            <div className="flex max-w-3xl flex-col gap-4">
              <Entreprise />
              <Donnees />
            </div>
          }
        />
        {/* Anciennes adresses. */}
        <Route path="integrations" element={<Navigate to="/erp/parametres/plateformes" replace />} />
        <Route path="donnees" element={<Navigate to="/erp/parametres/societe" replace />} />
        <Route path="entreprise" element={<Navigate to="/erp/parametres/societe" replace />} />
        <Route path="*" element={<Navigate to="/erp/parametres" replace />} />
      </Routes>
    </>
  );
}
