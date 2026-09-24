import { Route, Routes } from 'react-router-dom';
import Lancement from './Lancement';
import Pipeline from './Pipeline';
import Simulateur from './Simulateur';

/** Module Commercial : pipeline propriétaires, simulateur, lancement d'un mandat. */
export default function Commercial() {
  return (
    <Routes>
      <Route index element={<Pipeline />} />
      <Route path="simulateur" element={<Simulateur />} />
      <Route path="lancement" element={<Lancement />} />
      <Route path="*" element={<Pipeline />} />
    </Routes>
  );
}
