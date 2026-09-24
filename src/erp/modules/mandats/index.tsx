import { Route, Routes } from 'react-router-dom';
import PageMandats from './PageMandats';

/** Module Mandats : table des mandats, détail en panneau (?mandat=id). */
export default function ModuleMandats() {
  return (
    <Routes>
      <Route path="*" element={<PageMandats />} />
    </Routes>
  );
}
