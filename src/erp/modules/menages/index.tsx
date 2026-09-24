import { Route, Routes } from 'react-router-dom';
import { Detail } from './Detail';
import { Liste } from './Liste';

/** Module Ménages : missions (ménage, linge, contrôle, maintenance), preuves et validation. */
export default function Menages() {
  return (
    <Routes>
      <Route index element={<Liste />} />
      <Route path=":id" element={<Detail />} />
    </Routes>
  );
}
