import { useState } from 'react';
import { Route, Routes, useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { AUJOURDHUI, dateJour } from '../../data/format';
import { useErp } from '../../data/store';
import { Button, PageHeader, Section, Tabs } from '../../ui';
import { TableauParc, Synthese } from './_composants/Classement';
import { useAnalyseParc } from './_composants/commun';
import { Glossaire } from './_composants/Glossaire';
import { Proposition } from './_composants/Proposition';
import { Suivi } from './_composants/Suivi';

const ONGLETS = ['classement', 'suivi', 'indicateurs'] as const;
type CleOnglet = (typeof ONGLETS)[number];

function PagePerformance() {
  const parc = useAnalyseParc();
  const { recommandations } = useErp();
  const [params, setParams] = useSearchParams();
  const [proposition, setProposition] = useState(false);
  const brut = params.get('onglet');
  const onglet: CleOnglet = (ONGLETS as readonly string[]).includes(brut ?? '') ? (brut as CleOnglet) : 'classement';
  const enCours = recommandations.filter((r) => r.statut !== 'realisee' && r.statut !== 'refusee').length;

  return (
    <>
      <PageHeader
        titre="Rentabilité"
        sousTitre={`Ce que chaque logement vous rapporte, ce qui cloche et quoi faire. Calculé sur les 90 derniers jours (au ${dateJour(AUJOURDHUI)}), mis à jour chaque semaine.`}
        actions={
          <Button variant="primary" icone={<FileText />} onClick={() => setProposition(true)}>
            Préparer des conseils pour un propriétaire
          </Button>
        }
      />
      <Synthese parc={parc} />
      <Tabs
        label="Vues de la performance"
        actif={onglet}
        onChange={(cle) => setParams(cle === 'classement' ? {} : { onglet: cle }, { replace: true })}
        onglets={[
          { cle: 'classement', libelle: 'Vos logements', compteur: parc.lignes.length },
          { cle: 'suivi', libelle: 'Conseils aux propriétaires', compteur: enCours },
          { cle: 'indicateurs', libelle: 'Comprendre les chiffres' },
        ]}
      />
      {onglet === 'classement' && (
        <Section description="Du plus au moins rentable. Cliquez sur un logement pour voir ce qui cloche et ce qui peut être amélioré.">
          <TableauParc parc={parc} />
        </Section>
      )}
      {onglet === 'suivi' && <Suivi />}
      {onglet === 'indicateurs' && <Glossaire />}
      {proposition && <Proposition onFermer={() => setProposition(false)} />}
    </>
  );
}

/** Module Performance des biens (SPEC §10). */
export default function Performance() {
  return (
    <Routes>
      <Route index element={<PagePerformance />} />
      <Route path="*" element={<PagePerformance />} />
    </Routes>
  );
}
