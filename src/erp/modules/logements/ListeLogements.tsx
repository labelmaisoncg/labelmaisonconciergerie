import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plug, Plus } from 'lucide-react';
import { Button, ButtonLink, EmptyState, FilterChips, MenuActions, PageHeader, SearchInput, useCreationParUrl } from '../../ui';
import { useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import type { StatutLogement } from '../../data/types';
import { CarteLogement } from './_composants/CarteLogement';
import { statsLogement } from './_composants/stats';
import { EditionLogement } from './EditionLogement';

const STATUTS: StatutLogement[] = ['actif', 'lancement', 'pause', 'sorti'];

/** Logements en cartes : photo, prochain événement, prix ou occupation, note. */
export default function ListeLogements() {
  const d = useErp();
  const naviguer = useNavigate();
  const [recherche, setRecherche] = useState('');
  const [statuts, setStatuts] = useState<string[]>([]);
  const [creation, setCreation] = useCreationParUrl();

  const lignes = useMemo(() => d.logements.map((l) => ({ l, s: statsLogement(d, l) })), [d]);
  const presents = STATUTS.filter((s) => d.logements.some((l) => l.statut === s));
  const filtrees = lignes
    .filter(({ l }) => {
      if (statuts.length && !statuts.includes(l.statut)) return false;
      const q = recherche.trim().toLowerCase();
      return !q || [l.nom, l.ville, l.adresse].some((x) => x.toLowerCase().includes(q));
    })
    // Actifs d'abord, puis par nom.
    .sort((a, b) => STATUTS.indexOf(a.l.statut) - STATUTS.indexOf(b.l.statut) || a.l.nom.localeCompare(b.l.nom, 'fr'));
  const connecte = d.logements.some((l) => l.repull?.id);

  return (
    <>
      <PageHeader
        titre="Logements"
        actions={
          d.logements.length > 0 && (
            <MenuActions
              texte
              label="Plus"
              actions={[
                { libelle: connecte ? 'Plateformes et logements suivis' : 'Connecter Airbnb, Booking…', icone: <Plug />, to: '/erp/logements/connexions' },
                { libelle: 'Ajouter un logement à la main', icone: <Plus />, onClick: () => setCreation(true) },
              ]}
            />
          )
        }
      />

      {d.logements.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput valeur={recherche} onChange={setRecherche} placeholder="Nom, ville, adresse" label="Rechercher un logement" />
          {presents.length > 1 && (
            <FilterChips
              label="Filtrer par statut"
              filtres={presents.map((s) => ({ cle: s, libelle: LIBELLES.statutLogement[s], compteur: d.logements.filter((l) => l.statut === s).length }))}
              actifs={statuts}
              onChange={setStatuts}
            />
          )}
        </div>
      )}

      {d.logements.length === 0 ? (
        <EmptyState
          icone={<Plug />}
          titre="Pas encore de logement"
          description="Connectez Airbnb ou Booking : vos logements arrivent avec leurs photos, réservations et messages."
          action={
            <ButtonLink to="/erp/logements/connexions" variant="primary" icone={<Plug />}>
              Connecter Airbnb, Booking…
            </ButtonLink>
          }
        />
      ) : filtrees.length === 0 ? (
        <EmptyState
          titre="Aucun logement ne correspond"
          action={
            <Button
              onClick={() => {
                setRecherche('');
                setStatuts([]);
              }}
            >
              Tout afficher
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtrees.map(({ l, s }) => (
            <CarteLogement key={l.id} logement={l} stats={s} />
          ))}
        </div>
      )}

      <EditionLogement ouvert={creation} onFermer={() => setCreation(false)} onCree={(id) => naviguer(id)} />
    </>
  );
}
