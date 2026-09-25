import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, List, PauseCircle, Percent, Plug, Plus, Rocket } from 'lucide-react';
import {
  Button,
  ButtonLink,
  EmptyState,
  FilterChips,
  PageHeader,
  SearchInput,
  Select,
  Stat,
  StatusBadge,
  Table,
  cn,
  type Colonne,
  useCreationParUrl,
} from '../../ui';
import { useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { euros, jourMois, note, pourcentage } from '../../data/format';
import { fenetreJours, logementsActifs, proprietaireById, tauxOccupation } from '../../data/selectors';
import type { Logement, StatutLogement } from '../../data/types';
import { CarteLogement } from './_composants/CarteLogement';
import { statsLogement, type StatsLogement } from './_composants/stats';
import { VisuelLogement } from './_composants/Visuel';
import { EditionLogement } from './EditionLogement';
import { BadgeCommission, BadgeRentabilite, triMarge, useEconomieParc, type EconomieBien } from './_composants/EconomieBien';

type Ligne = { l: Logement; s: StatsLogement; proprietaire: string; eco: EconomieBien };
const STATUTS: StatutLogement[] = ['actif', 'lancement', 'pause', 'sorti'];

function lireVue(): 'cartes' | 'tableau' {
  try {
    return window.localStorage.getItem('lm-erp-logements-vue') === 'tableau' ? 'tableau' : 'cartes';
  } catch {
    return 'cartes';
  }
}

export default function ListeLogements() {
  const d = useErp();
  const naviguer = useNavigate();
  const [recherche, setRecherche] = useState('');
  const [statuts, setStatuts] = useState<string[]>([]);
  const [ville, setVille] = useState('');
  const [vue, setVueEtat] = useState(lireVue);
  const [creation, setCreation] = useCreationParUrl();

  const setVue = (v: 'cartes' | 'tableau') => {
    setVueEtat(v);
    try {
      window.localStorage.setItem('lm-erp-logements-vue', v);
    } catch {
      /* préférence non mémorisée */
    }
  };

  const economie = useEconomieParc(d.donnees);
  const lignes = useMemo<Ligne[]>(
    () =>
      d.logements.map((l) => ({
        l,
        s: statsLogement(d, l),
        proprietaire: proprietaireById(d, l.proprietaireId)?.nom ?? 'Propriétaire inconnu',
        eco: economie.get(l.id)!,
      })),
    [d, economie],
  );
  const villes = useMemo(() => [...new Set(d.logements.map((l) => l.ville))].sort(), [d.logements]);

  const filtrees = lignes.filter(({ l, proprietaire }) => {
    if (statuts.length && !statuts.includes(l.statut)) return false;
    if (ville && l.ville !== ville) return false;
    const q = recherche.trim().toLowerCase();
    return !q || [l.nom, l.ville, l.adresse, proprietaire, l.numeroEnregistrement ?? ''].some((x) => x.toLowerCase().includes(q));
  });

  const compte = (s: StatutLogement) => d.logements.filter((l) => l.statut === s).length;
  const occupation = tauxOccupation(d.reservations, logementsActifs(d.logements), fenetreJours(30));

  const colonnes: Colonne<Ligne>[] = [
    {
      cle: 'nom',
      titre: 'Logement',
      tri: (a, b) => a.l.nom.localeCompare(b.l.nom),
      rendu: ({ l }) => (
        <div className="flex min-w-[200px] items-center gap-3">
          <VisuelLogement logement={l} taille="sm" className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className="truncate font-medium">{l.nom}</p>
            <p className="truncate text-[12px] text-(--lm-encre-2)">{l.ville}</p>
          </div>
        </div>
      ),
    },
    { cle: 'type', titre: 'Type', rendu: ({ l }) => `${LIBELLES.typeLogement[l.type]} · ${l.capacite} pers.`, masquerMobile: true },
    { cle: 'proprietaire', titre: 'Propriétaire', rendu: ({ proprietaire }) => proprietaire, masquerMobile: true },
    { cle: 'statut', titre: 'Statut', rendu: ({ l }) => <StatusBadge type="statutLogement" valeur={l.statut} /> },
    {
      cle: 'commission',
      titre: 'Commission',
      tri: (a, b) => (a.eco.commissionPct ?? -1) - (b.eco.commissionPct ?? -1),
      rendu: ({ eco }) => <BadgeCommission eco={eco} />,
    },
    {
      cle: 'marge',
      titre: 'Marge LM / mois',
      align: 'droite',
      tri: (a, b) => triMarge(a.eco, b.eco),
      rendu: ({ eco }) => <BadgeRentabilite eco={eco} />,
    },
    { cle: 'occ', titre: 'Occ. 30 j', align: 'droite', tri: (a, b) => a.s.occupation30 - b.s.occupation30, rendu: ({ s }) => pourcentage(s.occupation30) },
    { cle: 'rev', titre: 'Revenu 30 j', align: 'droite', masquerMobile: true, tri: (a, b) => a.s.revenu30 - b.s.revenu30, rendu: ({ s }) => euros(s.revenu30, true) },
    { cle: 'note', titre: 'Note', align: 'droite', masquerMobile: true, tri: (a, b) => (a.s.note ?? 0) - (b.s.note ?? 0), rendu: ({ s }) => note(s.note) },
    {
      cle: 'arrivee',
      titre: 'Prochaine arrivée',
      masquerMobile: true,
      rendu: ({ s }) => (s.prochaineArrivee ? jourMois(s.prochaineArrivee.arrivee) : <span className="text-(--lm-encre-3)">Aucune</span>),
    },
  ];

  return (
    <>
      <PageHeader
        titre="Logements"
        sousTitre="Le référentiel des biens confiés : fiche voyageur, checklist de lancement, linge et canaux de diffusion."
        fil={[{ libelle: 'Référentiel' }, { libelle: 'Logements' }]}
        actions={
          <>
            <ButtonLink to="/erp/logements/connexions" variant="primary" icone={<Plug />}>
              Connecter Airbnb, Booking…
            </ButtonLink>
            <Button icone={<Plus />} onClick={() => setCreation(true)}>
              Nouveau logement
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Logements actifs" valeur={compte('actif')} icone={<Home />} aide={`sur ${d.logements.length} au référentiel`} />
        <Stat label="En lancement" valeur={compte('lancement')} icone={<Rocket />} tone={compte('lancement') ? 'alerte' : 'neutre'} aide="checklist bloquante" />
        <Stat label="En pause" valeur={compte('pause')} icone={<PauseCircle />} />
        <Stat label="Occupation moyenne" valeur={pourcentage(occupation)} icone={<Percent />} aide="logements actifs, 30 derniers jours" />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput valeur={recherche} onChange={setRecherche} placeholder="Nom, ville, propriétaire, n° d’enregistrement" label="Rechercher un logement" />
        <FilterChips
          label="Filtrer par statut"
          filtres={STATUTS.map((s) => ({ cle: s, libelle: LIBELLES.statutLogement[s], compteur: compte(s) }))}
          actifs={statuts}
          onChange={setStatuts}
        />
        <div className="flex items-center gap-2 lg:ml-auto">
          <Select aria-label="Filtrer par ville" value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Toutes les villes" options={villes.map((v) => ({ valeur: v, libelle: v }))} className="w-48" />
          <div role="group" aria-label="Affichage" className="flex rounded-lg border border-(--lm-bord-fort) bg-(--lm-surface) p-0.5">
            {(
              [
                ['cartes', LayoutGrid, 'Cartes'],
                ['tableau', List, 'Tableau'],
              ] as const
            ).map(([v, Icone, libelle]) => (
              <button
                key={v}
                type="button"
                aria-pressed={vue === v}
                aria-label={`Affichage en ${libelle.toLowerCase()}`}
                title={libelle}
                onClick={() => setVue(v)}
                className={cn('grid h-8 w-8 place-items-center rounded-md text-(--lm-encre-2)', vue === v && 'bg-(--lm-or-lavis) text-(--lm-brun)')}
              >
                <Icone className="size-4" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>

      {d.logements.length === 0 ? (
        <EmptyState
          icone={<Plug />}
          titre="Pas encore de logement"
          description="Connectez Airbnb, Booking.com ou votre logiciel de gestion, puis choisissez vos logements : ils arrivent ici avec leurs réservations."
          action={
            <ButtonLink to="/erp/logements/connexions" variant="primary" icone={<Plug />}>
              Connecter Airbnb, Booking…
            </ButtonLink>
          }
        />
      ) : filtrees.length === 0 ? (
        <EmptyState
          titre="Aucun logement ne correspond"
          description="Modifiez la recherche ou les filtres."
          action={
            <Button onClick={() => { setRecherche(''); setStatuts([]); setVille(''); }}>Réinitialiser les filtres</Button>
          }
        />
      ) : vue === 'cartes' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtrees.map(({ l, s, eco }) => (
            <CarteLogement key={l.id} logement={l} stats={s} economie={eco} />
          ))}
        </div>
      ) : (
        <Table
          legende="Liste des logements"
          colonnes={colonnes}
          lignes={filtrees}
          cleLigne={({ l }) => l.id}
          onLigneClick={({ l }) => naviguer(l.id)}
          triInitial={{ cle: 'nom', sens: 'asc' }}
        />
      )}

      <EditionLogement ouvert={creation} onFermer={() => setCreation(false)} onCree={(id) => naviguer(id)} />
    </>
  );
}
