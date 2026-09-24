import { Route, Routes } from 'react-router-dom';
import ListeLogements from './ListeLogements';
import DetailLogement from './DetailLogement';

/** Module Logements : liste (/erp/logements) et fiche détaillée (/erp/logements/:id). */
export default function ModuleLogements() {
  return (
    <Routes>
      <Route index element={<ListeLogements />} />
      <Route path=":id" element={<DetailLogement />} />
      <Route path="*" element={<ListeLogements />} />
    </Routes>
  );
}
