import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { Button, EmptyState, PageHeader, StatusBadge, Tabs } from '../../ui';
import { useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { pluriel } from '../../data/format';
import { logementById } from '../../data/selectors';
import { completudeFiche } from './_composants/stats';
import { SupprimerLogement } from './_composants/SupprimerLogement';
import { peutSupprimerLogement } from '../../data/suppression-logement';
import { EditionLogement } from './EditionLogement';
import { OngletVueEnsemble } from './onglets/VueEnsemble';
import { OngletFiche } from './onglets/FicheVoyageur';
import { OngletHistorique } from './onglets/Historique';

/** Trois onglets, comme un channel manager : l'aperçu, ce que lit l'agent, l'historique. */
const ONGLETS = ['apercu', 'fiche', 'historique'] as const;
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
  // Anciennes adresses (performance, linge, canaux, lancement…) : on retombe sur l'aperçu.
  const onglet: CleOnglet = (ONGLETS as readonly string[]).includes(brut ?? '') ? (brut as CleOnglet) : 'apercu';
  const changer = (cle: string) => setParams(cle === 'apercu' ? {} : { onglet: cle }, { replace: true });
  const manquants = completudeFiche(l.fiche).manquants.length;

  return (
    <>
      <PageHeader
        fil={[{ libelle: 'Logements', to: '/erp/logements' }, { libelle: l.nom }]}
        titre={l.nom}
        sousTitre={
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {l.statut !== 'actif' && <StatusBadge type="statutLogement" valeur={l.statut} />}
            <span>
              {[l.ville, LIBELLES.typeLogement[l.type], l.capacite ? `${l.capacite} voyageurs` : '', l.chambres ? pluriel(l.chambres, 'chambre') : '']
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        }
        actions={
          <Button icone={<Pencil />} onClick={() => setEdition(true)}>
            Modifier
          </Button>
        }
        // Supprimer : à part, une corbeille tout en haut à droite (gérant seulement).
        coin={peutSupprimerLogement(d.utilisateur.role, d.lectureSeule) ? <SupprimerLogement logement={l} /> : undefined}
      />

      <Tabs
        label="Sections du logement"
        actif={onglet}
        onChange={changer}
        onglets={[
          { cle: 'apercu', libelle: 'Aperçu' },
          // Compteur seulement s'il manque quelque chose à l'agent.
          { cle: 'fiche', libelle: 'Infos pour votre agent', compteur: manquants || undefined },
          { cle: 'historique', libelle: 'Historique' },
        ]}
      />

      {onglet === 'apercu' && <OngletVueEnsemble logement={l} />}
      {onglet === 'fiche' && <OngletFiche logement={l} />}
      {onglet === 'historique' && <OngletHistorique logement={l} />}

      <EditionLogement ouvert={edition} onFermer={() => setEdition(false)} logement={l} />
    </>
  );
}
