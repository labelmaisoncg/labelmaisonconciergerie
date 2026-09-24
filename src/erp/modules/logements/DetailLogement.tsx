import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Pencil } from 'lucide-react';
import { Button, EmptyState, PageHeader, StatusBadge, Tabs } from '../../ui';
import { useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { avancementChecklist, incidentsOuverts, logementById, proprietaireById } from '../../data/selectors';
import { VisuelLogement } from './_composants/Visuel';
import { completudeFiche } from './_composants/stats';
import { EditionLogement } from './EditionLogement';
import { OngletVueEnsemble } from './onglets/VueEnsemble';
import { OngletLancement } from './onglets/Lancement';
import { OngletFiche } from './onglets/FicheVoyageur';
import { OngletLinge } from './onglets/Linge';
import { OngletCanaux } from './onglets/Canaux';
import { OngletHistorique } from './onglets/Historique';

const ONGLETS = ['apercu', 'lancement', 'fiche', 'linge', 'canaux', 'historique'] as const;
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
            <Link to="/erp/logements" className="text-sm font-medium text-(--lm-or) hover:underline">
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
  const prop = proprietaireById(d, l.proprietaireId);
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
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge type="statutLogement" valeur={l.statut} />
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {l.adresse}, {l.codePostal} {l.ville}
            </span>
            <span>
              {LIBELLES.typeLogement[l.type]} · {l.surfaceM2} m² · {l.capacite} voyageurs
            </span>
            {prop && (
              <Link to={`/erp/proprietaires/${prop.id}`} className="text-(--lm-or) hover:underline">
                {prop.nom}
              </Link>
            )}
          </span>
        }
        actions={
          <>
            <Link
              to="/erp/logements"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-(--lm-encre-2) hover:bg-(--lm-neutre-lavis)"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Liste
            </Link>
            <Button icone={<Pencil />} onClick={() => setEdition(true)}>
              Modifier
            </Button>
          </>
        }
      />

      <Tabs
        label="Sections du logement"
        actif={onglet}
        onChange={changer}
        onglets={[
          { cle: 'apercu', libelle: 'Vue d’ensemble' },
          { cle: 'lancement', libelle: `Lancement ${av.faits}/${av.total}` },
          { cle: 'fiche', libelle: `Fiche voyageur ${Math.round(fiche.ratio * 100)} %` },
          { cle: 'linge', libelle: 'Linge' },
          { cle: 'canaux', libelle: 'Annonces & canaux' },
          { cle: 'historique', libelle: 'Historique', compteur: incidents || undefined },
        ]}
      />

      {onglet === 'apercu' && <OngletVueEnsemble logement={l} allerA={changer} />}
      {onglet === 'lancement' && <OngletLancement logement={l} />}
      {onglet === 'fiche' && <OngletFiche logement={l} />}
      {onglet === 'linge' && <OngletLinge logement={l} />}
      {onglet === 'canaux' && <OngletCanaux logement={l} />}
      {onglet === 'historique' && <OngletHistorique logement={l} />}

      <EditionLogement ouvert={edition} onFermer={() => setEdition(false)} logement={l} />
    </>
  );
}
