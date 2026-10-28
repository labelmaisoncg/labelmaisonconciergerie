import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plug, Plus } from 'lucide-react';
import { Button, ButtonLink, EmptyState, FilterChips, IconButton, PageHeader, SearchInput, useCreationParUrl } from '../../ui';
import { useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import type { StatutLogement } from '../../data/types';
import { CarteLogement } from './_composants/CarteLogement';
import { statsLogement } from './_composants/stats';
import { EditionLogement } from './EditionLogement';
import { OngletsLogements } from './_composants/OngletsLogements';

const STATUTS: StatutLogement[] = ['actif', 'lancement', 'pause', 'sorti'];

/**
 * Logements en cartes, comme des annonces : photo, note, ville, prochain
 * événement, prix de la nuit. Dans tout espace, même sans plateforme
 * connectée, un logement s'ajoute à la main (« + » de l'en-tête, ou l'écran vide) ;
 * il se relie ensuite à son annonce depuis sa fiche.
 */
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
  // Lecture seule : rien ne s'enregistre, pas de création.
  const creer = d.lectureSeule ? undefined : () => setCreation(true);

  return (
    <>
      <PageHeader
        titre="Logements"
        actions={
          d.logements.length > 0 && (
            // Deux icônes, comme une app : la prise (plateformes et synchronisation), puis « + » (nouveau logement).
            <div className="flex items-center gap-2">
              <ButtonLink
                to="/erp/logements/connexions"
                aria-label={connecte ? 'Plateformes et synchronisation' : 'Connecter Airbnb, Booking…'}
                title={connecte ? 'Plateformes et synchronisation' : 'Connecter Airbnb, Booking…'}
                icone={<Plug />}
                className="w-9 px-0"
              />
              {creer && (
                <IconButton label="Ajouter un logement" variant="secondary" onClick={creer}>
                  <Plus />
                </IconButton>
              )}
            </div>
          )
        }
      />
      {d.logements.length > 0 && <OngletsLogements />}

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
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink to="/erp/logements/connexions" variant="primary" icone={<Plug />}>
                Connecter Airbnb, Booking…
              </ButtonLink>
              {creer && (
                <Button icone={<Plus />} onClick={creer}>
                  Ajouter à la main
                </Button>
              )}
            </div>
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(16.5rem,1fr))] gap-x-6 gap-y-9">
          {/* Autant de colonnes que la largeur le permet (16,5 rem au moins par carte, menu latéral compris) :
              1 sur téléphone, 2 sur tablette, 3 à 1280 px, 4 à 1440 px — la ligne « ville · type · voyageurs » reste entière. */}
          {filtrees.map(({ l, s }) => (
            <CarteLogement key={l.id} logement={l} stats={s} />
          ))}
        </div>
      )}

      <EditionLogement ouvert={creation && !d.lectureSeule} onFermer={() => setCreation(false)} onCree={(id) => naviguer(id)} />
    </>
  );
}
