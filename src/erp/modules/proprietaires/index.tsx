import { Route, Routes } from 'react-router-dom';
import ListeProprietaires from './ListeProprietaires';
import DetailProprietaire from './DetailProprietaire';

/** Module Propriétaires : liste et fiche (/erp/proprietaires/:id). */
export default function ModuleProprietaires() {
  return (
    <Routes>
      <Route index element={<ListeProprietaires />} />
      <Route path=":id" element={<DetailProprietaire />} />
      <Route path="*" element={<ListeProprietaires />} />
    </Routes>
  );
}
