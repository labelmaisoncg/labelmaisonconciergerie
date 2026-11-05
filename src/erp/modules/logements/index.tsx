import { Route, Routes } from 'react-router-dom';
import ListeLogements from './ListeLogements';
import DetailLogement from './DetailLogement';
import Connexions from './Connexions';
import AvisParc from './AvisParc';
import DemandesParc from './DemandesParc';

/**
 * Module Logements : liste (/erp/logements), connexion des plateformes et
 * choix des logements (/erp/logements/connexions), avis des voyageurs sur tout le
 * parc (/erp/logements/avis), demandes des propriétaires (/erp/logements/demandes,
 * gérant), fiche détaillée (/erp/logements/:id).
 */
export default function ModuleLogements() {
  return (
    <Routes>
      <Route index element={<ListeLogements />} />
      <Route path="connexions" element={<Connexions />} />
      <Route path="avis" element={<AvisParc />} />
      <Route path="demandes" element={<DemandesParc />} />
      <Route path=":id" element={<DetailLogement />} />
      <Route path="*" element={<ListeLogements />} />
    </Routes>
  );
}
