import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useErp } from '../../data/store';
import { facturesEnRetard, paiementsAFaire } from '../../data/selectors';
import { MenuActions, Tabs, type Onglet } from '../../ui';
import Synthese from './Synthese';
import Releves from './Releves';
import Factures from './Factures';
import Paiements from './Paiements';
import Charges from './Charges';
import Rentabilite from './Rentabilite';

/** Onglets moins utilisés : rangés dans « Plus », affichés seulement quand on y est. */
const SECONDAIRES: (Onglet & { to: string })[] = [
  { cle: 'charges', libelle: 'Vos dépenses', to: '/erp/finance/charges' },
  { cle: 'rentabilite', libelle: 'Rentabilité par logement', to: '/erp/finance/rentabilite' },
];

/** Module Finance : synthèse, relevés, factures, paiements, charges, rentabilité. */
export default function Module() {
  const d = useErp();
  const { pathname } = useLocation();
  const principaux: Onglet[] = [
    { cle: 'synthese', libelle: 'Vue d’ensemble', to: '/erp/finance', end: true },
    { cle: 'releves', libelle: 'Relevés', to: '/erp/finance/releves' },
    { cle: 'factures', libelle: 'Factures', to: '/erp/finance/factures', compteur: facturesEnRetard(d.factures).length || undefined },
    { cle: 'paiements', libelle: 'Prestataires', to: '/erp/finance/paiements', compteur: paiementsAFaire(d).length || undefined },
  ];
  const courant = SECONDAIRES.find((o) => pathname.startsWith(o.to));
  const autres = SECONDAIRES.filter((o) => o !== courant);
  const t = (
    <div className="lm-sans-impression mb-5 flex items-center gap-2 border-b border-(--lm-bord)">
      <Tabs onglets={courant ? [...principaux, courant] : principaux} label="Sections de la finance" className="mb-0 min-w-0 flex-1 border-b-0" />
      <MenuActions label="Plus" texte className="mb-1 shrink-0" actions={autres.map((o) => ({ libelle: o.libelle, to: o.to }))} />
    </div>
  );
  return (
    <>
      <Routes>
        <Route index element={<Synthese onglets={t} />} />
        <Route path="releves" element={<Releves onglets={t} />} />
        <Route path="factures" element={<Factures onglets={t} />} />
        <Route path="paiements" element={<Paiements onglets={t} />} />
        <Route path="charges" element={<Charges onglets={t} />} />
        <Route path="rentabilite" element={<Rentabilite onglets={t} />} />
        <Route path="*" element={<Navigate to="/erp/finance" replace />} />
      </Routes>
    </>
  );
}
