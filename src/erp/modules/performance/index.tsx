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
        fil={[{ libelle: 'Pilotage' }, { libelle: 'Performance des biens' }]}
        titre="Performance des biens"
        sousTitre={`Rentabilité, défauts et décision pour chaque bien actif, calculées sur les 90 derniers jours au ${dateJour(AUJOURDHUI)}. Revue automatique chaque semaine.`}
        actions={
          <Button variant="primary" icone={<FileText />} onClick={() => setProposition(true)}>
            Préparer une proposition
          </Button>
        }
      />
      <Synthese parc={parc} />
      <Tabs
        label="Vues de la performance"
        actif={onglet}
        onChange={(cle) => setParams(cle === 'classement' ? {} : { onglet: cle }, { replace: true })}
        onglets={[
          { cle: 'classement', libelle: 'Classement du parc', compteur: parc.lignes.length },
          { cle: 'suivi', libelle: 'Suivi des recommandations', compteur: enCours },
          { cle: 'indicateurs', libelle: 'Comprendre les indicateurs' },
        ]}
      />
      {onglet === 'classement' && (
        <Section description="Classés par score. Cliquez sur un bien pour son analyse complète : défauts, améliorations, marge mois par mois.">
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
