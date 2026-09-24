import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarClock, Coins, FileSignature, KanbanSquare, List, Percent, Plus, Target } from 'lucide-react';
import { useErp } from '../../data/store';
import { ETAPES_PIPELINE } from '../../data/constantes';
import { AUJOURDHUI, euros, moisAnnee, pourcentage } from '../../data/format';
import { LIBELLES } from '../../data/libelles';
import { actionsCommercialesDues, commissionPotentielle, signaturesDuMois, valeurPipeline } from '../../data/selectors';
import type { EtapeProspect, Prospect, Responsable, SourceProspect } from '../../data/types';
import { Button, PageHeader, SearchInput, Select, Stat, cn } from '../../ui';
import { useAvis } from './_composants/Avis';
import type { ActionsProspect } from './_composants/CarteProspect';
import { FicheProspect } from './_composants/FicheProspect';
import { Kanban } from './_composants/Kanban';
import { ListeProspects } from './_composants/ListeProspects';
import { NouveauProspect } from './_composants/NouveauProspect';
import { Onglets } from './_composants/Onglets';

type Affichage = 'tableau' | 'liste';

export default function Pipeline() {
  const d = useErp();
  const naviguer = useNavigate();
  const [params, setParams] = useSearchParams();
  const { afficher, rendu: avis } = useAvis();
  const [affichage, setAffichage] = useState<Affichage>('tableau');
  const [recherche, setRecherche] = useState('');
  const [source, setSource] = useState<SourceProspect | ''>('');
  const [responsable, setResponsable] = useState<Responsable | ''>('');
  const [etape, setEtape] = useState<EtapeProspect | ''>('');
  const [avecPerdus, setAvecPerdus] = useState(false);
  const [creation, setCreation] = useState(false);

  const ouvertId = params.get('prospect') ?? undefined;
  const ouvert = d.prospects.find((p) => p.id === ouvertId);
  const ouvrir = (p: Prospect) => setParams({ prospect: p.id });
  const fermer = () => setParams({});

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return d.prospects.filter(
      (p) =>
        (!q || `${p.nom} ${p.ville} ${p.typeBien} ${p.notes}`.toLowerCase().includes(q)) &&
        (!source || p.source === source) &&
        (!responsable || p.responsable === responsable) &&
        (!etape || p.etape === etape),
    );
  }, [d.prospects, recherche, source, responsable, etape]);

  const signes = d.prospects.filter((p) => p.etape === 'signe').length;
  const perdus = d.prospects.filter((p) => p.etape === 'perdu').length;
  const dues = actionsCommercialesDues(d.prospects);

  const lancer = (p: Prospect) => naviguer(`/erp/commercial/lancement?prospect=${p.id}`);

  const changer = (p: Prospect, cible: EtapeProspect) => {
    const avant = p.etape;
    const r = d.avancerProspect(p.id, cible);
    if (!r.ok) return afficher({ ton: 'danger', texte: r.erreur });
    afficher({
      ton: cible === 'perdu' ? 'alerte' : 'succes',
      texte: `${p.nom} : ${LIBELLES.etapeProspect[cible]}.`,
      action: (
        <button type="button" className="text-[12.5px] font-medium text-(--lm-or) hover:underline" onClick={() => { d.avancerProspect(p.id, avant); afficher({ ton: 'info', texte: 'Changement annulé.' }); }}>
          Annuler
        </button>
      ),
    });
  };

  const deplacer = (id: string, cible: EtapeProspect) => {
    const p = d.prospects.find((x) => x.id === id);
    if (!p || p.etape === cible) return;
    if (cible === 'signe') return lancer(p);
    changer(p, cible);
  };

  const actions: ActionsProspect = {
    ouvrir,
    lancer,
    perdu: (p) => changer(p, 'perdu'),
    relancer: (p) => changer(p, 'contact'),
    suivante: (p) => {
      const suivante = ETAPES_PIPELINE[ETAPES_PIPELINE.indexOf(p.etape) + 1];
      if (!suivante) return;
      if (suivante === 'signe') return lancer(p);
      changer(p, suivante);
    },
  };

  const opts = <K extends string>(r: Record<K, string>) => (Object.keys(r) as K[]).map((k) => ({ valeur: k, libelle: r[k] }));

  return (
    <>
      <PageHeader
        fil={[{ libelle: 'Commercial' }, { libelle: 'Pipeline' }]}
        titre="Pipeline propriétaires"
        sousTitre="D’où viennent les prochains logements. Un prospect signé passe par le lancement du mandat."
        actions={
          <>
            <Button icone={<FileSignature />} onClick={() => naviguer('/erp/commercial/lancement')}>Lancer un mandat</Button>
            <Button variant="primary" icone={<Plus />} onClick={() => setCreation(true)}>Nouveau prospect</Button>
          </>
        }
      />
      <Onglets />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Valeur du pipeline" valeur={euros(valeurPipeline(d.prospects), true)} icone={<Target />} aide="revenu annuel estimé en cours" />
        <Stat label="Commission potentielle" valeur={euros(commissionPotentielle(d.prospects, 18), true)} icone={<Coins />} aide="à 18 % par an" />
        <Stat label="Taux de conversion" valeur={signes + perdus ? pourcentage(signes / (signes + perdus)) : '-'} icone={<Percent />} aide={`${signes} signés, ${perdus} perdus`} />
        <Stat label="Signatures du mois" valeur={signaturesDuMois(d.mandats).length} icone={<FileSignature />} aide={moisAnnee(AUJOURDHUI)} />
        <Stat label="Actions dues" valeur={dues.length} icone={<CalendarClock />} tone={dues.length ? 'alerte' : 'neutre'} aide="en retard ou du jour" />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <SearchInput valeur={recherche} onChange={setRecherche} placeholder="Nom, ville, bien, notes" label="Rechercher un prospect" />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select aria-label="Filtrer par source" value={source} onChange={(e) => setSource(e.target.value as SourceProspect | '')} placeholder="Toutes sources" options={opts(LIBELLES.sourceProspect)} className="sm:w-44" />
          <Select aria-label="Filtrer par responsable" value={responsable} onChange={(e) => setResponsable(e.target.value as Responsable | '')} placeholder="Tous responsables" options={[{ valeur: 'abdel', libelle: 'Abdel' }, { valeur: 'kamel', libelle: 'Kamel' }]} className="sm:w-40" />
          <Select aria-label="Filtrer par étape" value={etape} onChange={(e) => setEtape(e.target.value as EtapeProspect | '')} placeholder="Toutes étapes" options={opts(LIBELLES.etapeProspect)} className="sm:w-40" />
          {affichage === 'tableau' && (
            <label className="inline-flex h-9 items-center gap-2 text-[13px] text-(--lm-encre-2)">
              <input type="checkbox" checked={avecPerdus || etape === 'perdu'} onChange={(e) => setAvecPerdus(e.target.checked)} className="size-4 accent-(--lm-or)" />
              Afficher les perdus
            </label>
          )}
        </div>
        <div role="group" aria-label="Affichage" className="inline-flex self-start rounded-lg border border-(--lm-bord-fort) bg-(--lm-surface) p-0.5 lg:ml-auto">
          {([['tableau', 'Tableau', KanbanSquare], ['liste', 'Liste', List]] as const).map(([cle, lib, Icone]) => (
            <button key={cle} type="button" aria-pressed={affichage === cle} onClick={() => setAffichage(cle)}
              className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium', affichage === cle ? 'bg-(--lm-or) text-white' : 'text-(--lm-encre-2) hover:text-(--lm-encre)')}>
              <Icone aria-hidden className="size-4" />
              {lib}
            </button>
          ))}
        </div>
      </div>

      {affichage === 'tableau' ? (
        <>
          <p className="mb-2 hidden text-[12px] text-(--lm-encre-3) lg:block">Glissez une carte vers une autre colonne pour changer d’étape. Déposer sur « Signé » ouvre le lancement du mandat.</p>
          <Kanban prospects={filtres} actions={actions} deplacer={deplacer} avecPerdus={avecPerdus || etape === 'perdu'} />
        </>
      ) : (
        <ListeProspects prospects={filtres} ouvrir={ouvrir} actif={ouvertId} />
      )}

      <FicheProspect prospect={ouvert} onFermer={fermer} onLancer={lancer} onEnregistre={(p) => afficher({ ton: 'succes', texte: `Fiche de ${p.nom} enregistrée.` })} />
      <NouveauProspect
        ouvert={creation}
        onFermer={() => setCreation(false)}
        onCree={(p) => {
          setCreation(false);
          afficher({ ton: 'succes', texte: `${p.nom} ajouté au pipeline (${LIBELLES.etapeProspect[p.etape]}).` });
        }}
      />
      {avis}
    </>
  );
}
