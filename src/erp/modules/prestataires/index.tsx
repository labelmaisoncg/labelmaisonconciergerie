import { Route, Routes } from 'react-router-dom';
import { Detail } from './Detail';
import { Liste } from './Liste';

/** Module Prestataires : conformité (règle 2.3), qualité, tarifs et paiements. */
export default function Prestataires() {
  return (
    <Routes>
      <Route index element={<Liste />} />
      <Route path=":id" element={<Detail />} />
    </Routes>
  );
}
