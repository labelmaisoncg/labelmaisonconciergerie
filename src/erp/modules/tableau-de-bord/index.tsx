import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useErp } from '../../data/store';
import { AUJOURDHUI } from '../../data/format';
import { PageHeader, Section } from '../../ui';
import { Agenda } from './_composants/Agenda';
import { ATraiter } from './_composants/ATraiter';
import { Aujourdhui } from './_composants/Aujourdhui';
import { Demarrage } from './_composants/Demarrage';
import { BandeKpi } from './_composants/BandeKpi';
import { BiensASurveiller } from './_composants/BiensASurveiller';
import { Graphiques } from './_composants/Graphiques';
import { Segmente } from './_composants/Segmente';
import { construireATraiter } from './_composants/aTraiter';
import { HORIZONS, type CleHorizon } from './_composants/calculs';
import { KpiCommerciaux, PipelineResume, ProprietairesAAppeler, RelevesAEnvoyer } from './_composants/VueCommerciale';

/**
 * Tableau de bord unique, le même pour toute l'équipe : opérations,
 * chiffres, performance des biens et commercial sur une seule page.
 */
export default function TableauDeBord() {
  const d = useErp();
  const [horizon, setHorizon] = useState<CleHorizon>('30j');
  const elements = useMemo(() => construireATraiter(d.donnees), [d.donnees]);
  const urgentes = elements.filter((e) => e.priorite === 1).length;
  const date = format(parseISO(AUJOURDHUI), 'EEEE d MMMM yyyy', { locale: fr });

  return (
    <>
      <PageHeader
        titre={`Bonjour ${d.utilisateur.nom.split(' ')[0]}`}
        sousTitre={<>{date.charAt(0).toUpperCase() + date.slice(1)}. Tout va-t-il bien cette semaine ?</>}
      />

      <Demarrage />

      <Aujourdhui alertes={elements.length} urgentes={urgentes} />

      <Section
        titre="Indicateurs"
        description="Calculés depuis les réservations, mandats et missions, jamais saisis à la main. Survolez « ? » pour lire chaque indicateur."
        actions={
          <Segmente<CleHorizon>
            label="Période des indicateurs"
            valeur={horizon}
            onChange={setHorizon}
            options={HORIZONS.map((h) => ({ cle: h.cle, libelle: h.libelle }))}
          />
        }
      >
        <BandeKpi horizon={horizon} />
      </Section>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:mb-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <div id="a-traiter" className="scroll-mt-20">
          <ATraiter elements={elements} />
        </div>
        <BiensASurveiller />
      </div>

      <Section titre="Tendances">
        <Graphiques horizon={horizon} />
      </Section>

      <Section titre="Commercial" description="Pipeline propriétaires et signatures du mois.">
        <KpiCommerciaux />
        <div className="mt-4">
          <PipelineResume />
        </div>
      </Section>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:mb-8 lg:grid-cols-2 [&>*]:min-w-0">
        <ProprietairesAAppeler />
        <RelevesAEnvoyer />
      </div>

      <Section>
        <Agenda />
      </Section>
    </>
  );
}
