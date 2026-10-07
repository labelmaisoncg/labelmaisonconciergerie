import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { Button, EmptyState, PageHeader, StatusBadge, Tabs } from '../../ui';
import { useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { avancementChecklist, incidentsOuverts, logementById } from '../../data/selectors';
import { VisuelLogement } from './_composants/Visuel';
import { completudeFiche } from './_composants/stats';
import { EditionLogement } from './EditionLogement';
import { OngletVueEnsemble } from './onglets/VueEnsemble';
import { OngletLancement } from './onglets/Lancement';
import { OngletFiche } from './onglets/FicheVoyageur';
import { OngletLinge } from './onglets/Linge';
import { OngletCanaux } from './onglets/Canaux';
import { OngletHistorique } from './onglets/Historique';
import { OngletPerformance } from './onglets/Performance';

const ONGLETS = ['apercu', 'performance', 'lancement', 'fiche', 'linge', 'canaux', 'historique'] as const;
type CleOnglet = (typeof ONGLETS)[number];

export default function DetailLogement() {
  const { id } = useParams();
  const d = useErp();
  const [params, setParams] = useSearchParams();
  const [edition, setEdition] = useState(false);
  const l = logementById(d, id);

  if (!l) {
    return (
      <>
        <PageHeader titre="Logement introuvable" fil={[{ libelle: 'Logements', to: '/erp/logements' }]} />
        <EmptyState
          titre="Ce logement n’existe pas ou a été supprimé"
          action={
            <Link to="/erp/logements" className="text-sm font-medium text-(--lm-or-texte) hover:underline">
              Retour à la liste
            </Link>
          }
        />
      </>
    );
  }

  const brut = params.get('onglet');
  const onglet: CleOnglet = (ONGLETS as readonly string[]).includes(brut ?? '') ? (brut as CleOnglet) : 'apercu';
  const changer = (cle: string) => setParams(cle === 'apercu' ? {} : { onglet: cle }, { replace: true });
  const av = avancementChecklist(l);
  const fiche = completudeFiche(l.fiche);
  const incidents = incidentsOuverts(d.incidents).filter((i) => i.logementId === l.id).length;

  return (
    <>
      <PageHeader
        fil={[{ libelle: 'Logements', to: '/erp/logements' }, { libelle: l.nom }]}
        titre={
          <span className="flex items-center gap-3">
            <VisuelLogement logement={l} taille="sm" className="hidden size-11 shrink-0 rounded-xl sm:grid" />
            <span className="min-w-0">{l.nom}</span>
          </span>
        }
        sousTitre={
          // Une seule ligne : l'adresse, le propriétaire et l'économie du bien sont dans les onglets.
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {l.statut !== 'actif' && <StatusBadge type="statutLogement" valeur={l.statut} />}
            <span>
              {l.ville} · {LIBELLES.typeLogement[l.type]} · {l.surfaceM2} m² · {l.capacite} voyageurs
            </span>
          </span>
        }
        actions={
          <Button icone={<Pencil />} onClick={() => setEdition(true)}>
            Modifier
          </Button>
        }
      />

      <Tabs
        label="Sections du logement"
        actif={onglet}
        onChange={changer}
        onglets={[
          { cle: 'apercu', libelle: 'Vue d’ensemble' },
          { cle: 'performance', libelle: 'Performance' },
          // Compteur seulement s'il reste quelque chose à faire.
          { cle: 'lancement', libelle: 'Lancement', compteur: av.faits < av.total ? av.total - av.faits : undefined },
          { cle: 'fiche', libelle: 'Fiche voyageur', compteur: fiche.manquants.length || undefined },
          { cle: 'linge', libelle: 'Linge' },
          { cle: 'canaux', libelle: 'Annonces & canaux' },
          { cle: 'historique', libelle: 'Historique', compteur: incidents || undefined },
        ]}
      />

      {onglet === 'apercu' && <OngletVueEnsemble logement={l} allerA={changer} />}
      {onglet === 'performance' && <OngletPerformance logement={l} />}
      {onglet === 'lancement' && <OngletLancement logement={l} />}
      {onglet === 'fiche' && <OngletFiche logement={l} />}
      {onglet === 'linge' && <OngletLinge logement={l} />}
      {onglet === 'canaux' && <OngletCanaux logement={l} />}
      {onglet === 'historique' && <OngletHistorique logement={l} />}

      <EditionLogement ouvert={edition} onFermer={() => setEdition(false)} logement={l} />
    </>
  );
}
