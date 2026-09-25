import { Navigate, Route, Routes } from 'react-router-dom';
import { useErp } from '../../data/store';
import { facturesEnRetard, paiementsAFaire } from '../../data/selectors';
import { Tabs } from '../../ui';
import Synthese from './Synthese';
import Releves from './Releves';
import Factures from './Factures';
import Paiements from './Paiements';
import Charges from './Charges';
import Rentabilite from './Rentabilite';

/** Module Finance : synthèse, relevés, factures, paiements, charges, rentabilité. */
export default function Module() {
  const d = useErp();
  const onglets = [
    { cle: 'synthese', libelle: 'Vue d’ensemble', to: '/erp/finance', end: true },
    { cle: 'releves', libelle: 'Relevés des propriétaires', to: '/erp/finance/releves' },
    { cle: 'factures', libelle: 'Factures', to: '/erp/finance/factures', compteur: facturesEnRetard(d.factures).length || undefined },
    { cle: 'paiements', libelle: 'Payer les prestataires', to: '/erp/finance/paiements', compteur: paiementsAFaire(d).length || undefined },
    { cle: 'charges', libelle: 'Vos dépenses', to: '/erp/finance/charges' },
    { cle: 'rentabilite', libelle: 'Rentabilité par logement', to: '/erp/finance/rentabilite' },
  ];
  const t = <Tabs onglets={onglets} label="Sections de la finance" className="lm-sans-impression" />;
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
