import { useMemo, useState } from 'react';
import { BarChart3, Briefcase } from 'lucide-react';
import { useErp } from '../../data/store';
import { AUJOURDHUI } from '../../data/format';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PageHeader, Section } from '../../ui';
import { Agenda } from './_composants/Agenda';
import { ATraiter } from './_composants/ATraiter';
import { Aujourdhui } from './_composants/Aujourdhui';
import { BandeKpi } from './_composants/BandeKpi';
import { Graphiques } from './_composants/Graphiques';
import { Segmente } from './_composants/Segmente';
import { construireATraiter, type Vue } from './_composants/aTraiter';
import { HORIZONS, type CleHorizon } from './_composants/calculs';
import { KpiCommerciaux, PipelineResume, ProprietairesAAppeler, RelevesAEnvoyer } from './_composants/VueCommerciale';

const CLE_VUE = 'lm-erp-tdb-vue';

function lireVue(defaut: Vue): Vue {
  try {
    const v = window.localStorage.getItem(CLE_VUE);
    return v === 'kamel' || v === 'abdel' ? v : defaut;
  } catch {
    return defaut;
  }
}

function salutation(nom: string) {
  return `Bonjour ${nom.split(' ')[0]}`;
}

/** Tableau de bord : le cockpit du matin et la réunion du lundi. */
export default function TableauDeBord() {
  const d = useErp();
  const [vue, setVueEtat] = useState<Vue>(() => lireVue(d.utilisateur.role === 'operations' ? 'kamel' : 'abdel'));
  const [horizon, setHorizon] = useState<CleHorizon>('30j');

  const setVue = (v: Vue) => {
    setVueEtat(v);
    try {
      window.localStorage.setItem(CLE_VUE, v);
    } catch {
      /* préférence non mémorisée */
    }
  };

  const tous = useMemo(() => construireATraiter(d.donnees), [d.donnees]);
  const elements = tous.filter((e) => e.vues.includes(vue));
  const urgentes = elements.filter((e) => e.priorite === 1).length;
  const date = format(parseISO(AUJOURDHUI), 'EEEE d MMMM yyyy', { locale: fr });

  const choixVue = (
    <Segmente<Vue>
      label="Vue du tableau de bord"
      valeur={vue}
      onChange={setVue}
      options={[
        { cle: 'kamel', libelle: <><BarChart3 aria-hidden />Vue Kamel<span className="hidden md:inline">&nbsp;(opérations & chiffres)</span></> },
        { cle: 'abdel', libelle: <><Briefcase aria-hidden />Vue Abdel<span className="hidden md:inline">&nbsp;(commercial & propriétaires)</span></> },
      ]}
    />
  );

  const choixHorizon = (
    <Segmente<CleHorizon> label="Période des indicateurs" valeur={horizon} onChange={setHorizon} options={HORIZONS.map((h) => ({ cle: h.cle, libelle: h.libelle }))} />
  );

  return (
    <>
      <PageHeader
        titre={salutation(d.utilisateur.nom)}
        sousTitre={<>{date.charAt(0).toUpperCase() + date.slice(1)}. Tout va-t-il bien cette semaine ?</>}
        actions={choixVue}
      />

      <Aujourdhui alertes={elements.length} urgentes={urgentes} />

      {vue === 'kamel' ? (
        <>
          <Section titre="Indicateurs" description="Calculés depuis les réservations, mandats et missions, jamais saisis à la main." actions={choixHorizon}>
            <BandeKpi horizon={horizon} />
          </Section>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:mb-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div id="a-traiter" className="scroll-mt-20">
              <ATraiter elements={elements} />
            </div>
            <Agenda />
          </div>
          <Section titre="Tendances">
            <Graphiques horizon={horizon} />
          </Section>
        </>
      ) : (
        <>
          <Section titre="Commercial">
            <KpiCommerciaux />
          </Section>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:mb-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div id="a-traiter" className="scroll-mt-20">
              <ATraiter elements={elements} titre="À traiter (commercial & propriétaires)" />
            </div>
            <PipelineResume />
          </div>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:mb-8 lg:grid-cols-2 [&>*]:min-w-0">
            <ProprietairesAAppeler />
            <RelevesAEnvoyer />
          </div>
          <Section titre="Chiffres clés" description="Pour la réunion du lundi." actions={choixHorizon}>
            <BandeKpi horizon={horizon} />
          </Section>
          <Section>
            <div className="max-w-2xl">
              <Agenda />
            </div>
          </Section>
        </>
      )}
    </>
  );
}
