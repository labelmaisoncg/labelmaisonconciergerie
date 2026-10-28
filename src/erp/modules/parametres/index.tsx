import { Navigate, Route, Routes } from 'react-router-dom';
import { PageHeader, Tabs } from '../../ui';
import Utilisateurs from './Utilisateurs';
import Integrations from './Integrations';
import Donnees from './Donnees';
import Entreprise from './Entreprise';
import Application from './Application';
import Acces from './Acces';
import Espaces from './Espaces';
import AnnoncesEquipe from './AnnoncesEquipe';
import ActionsIA from './ActionsIA';
import { useErp } from '../../data/store';
import { espaceOuvert, estLabelMaison } from '../../data/espaces';
import { AUJOURDHUI } from '../../data/format';
import { actionsVisibles, etatAffiche } from '../../data/copilote';

/**
 * Module Paramètres : l'équipe et ses rôles, les annonces à l'équipe (gérant),
 * les plateformes (synchronisation), les accès des propriétaires et des
 * responsables opérationnels à leur espace,
 * l'app et ses notifications, la société et sa sauvegarde, ce que l'IA a
 * fait (Actions de l'IA, gérant) ; pour les gérants de Label Maison (la
 * plateforme), les espaces des conciergeries invitées.
 */
export default function Module() {
  const d = useErp();
  // Accès (invitations, absences) : le gérant seul.
  const gerant = d.utilisateur.role === 'gerant';
  // Réponses proposées par l'IA qui attendent l'envoi de l'équipe : compteur de l'onglet.
  const aEnvoyer = gerant ? actionsVisibles(d.actionsAgent, AUJOURDHUI).filter((a) => a.etat === 'a_confirmer' && etatAffiche(a, d.filsMessages).aEnvoyer).length : 0;
  const plateforme = gerant && estLabelMaison(espaceOuvert());
  return (
    <>
      <PageHeader titre="Paramètres" />
      <Tabs
        label="Sections des paramètres"
        onglets={[
          { cle: 'utilisateurs', libelle: 'Équipe', to: '/erp/parametres', end: true },
          { cle: 'plateformes', libelle: 'Plateformes', to: '/erp/parametres/plateformes' },
          ...(gerant ? [{ cle: 'acces', libelle: 'Accès', to: '/erp/parametres/acces' }] : []),
          { cle: 'application', libelle: 'Application', to: '/erp/parametres/application' },
          // Messages du gérant à l'équipe (Accueil de chacun) : pas l'annonce d'un logement.
          ...(gerant ? [{ cle: 'annonces-equipe', libelle: 'Annonces à l’équipe', to: '/erp/parametres/annonces-equipe' }] : []),
          // Ce que Claude et l'agent ont fait, avec « Annuler » : le gérant seul (la base aussi).
          ...(gerant ? [{ cle: 'actions-ia', libelle: 'Actions de l’IA', to: '/erp/parametres/actions-ia', ...(aEnvoyer ? { compteur: aEnvoyer } : {}) }] : []),
          { cle: 'societe', libelle: 'Société', to: '/erp/parametres/societe' },
          ...(plateforme ? [{ cle: 'espaces', libelle: 'Espaces', to: '/erp/parametres/espaces' }] : []),
        ]}
      />
      <Routes>
        <Route index element={<Utilisateurs />} />
        <Route path="plateformes" element={<Integrations />} />
        <Route path="acces" element={<Acces />} />
        <Route path="annonces-equipe" element={gerant ? <AnnoncesEquipe /> : <Navigate to="/erp/parametres" replace />} />
        <Route path="actions-ia" element={gerant ? <ActionsIA /> : <Navigate to="/erp/parametres" replace />} />
        <Route path="espaces" element={plateforme ? <Espaces /> : <Navigate to="/erp/parametres" replace />} />
        <Route path="application" element={<Application />} />
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
        <Route path="notifications" element={<Navigate to="/erp/parametres/application" replace />} />
        <Route path="*" element={<Navigate to="/erp/parametres" replace />} />
      </Routes>
    </>
  );
}
