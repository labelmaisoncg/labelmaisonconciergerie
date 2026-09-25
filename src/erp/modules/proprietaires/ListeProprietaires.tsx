import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Users, Wallet } from 'lucide-react';
import { Avatar, Badge, Button, FilterChips, PageHeader, SearchInput, Stat, StatusBadge, Table, type Colonne, useCreationParUrl } from '../../ui';
import { useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { euros } from '../../data/format';
import type { Proprietaire, StatutMandat, TypeProprietaire } from '../../data/types';
import { revenuNet12Mois, statutMandatPrincipal } from './_composants/calculs';
import { FormProprietaire } from './FormProprietaire';
import { useRechercheUrl } from '../../ui/useRechercheUrl';

interface Ligne {
  p: Proprietaire;
  logements: number;
  actifs: number;
  net12: number;
  statut?: StatutMandat;
}

const TONS_TYPE = { particulier: 'neutre', sci: 'or', societe: 'info' } as const;
const TYPES: TypeProprietaire[] = ['particulier', 'sci', 'societe'];

export default function ListeProprietaires() {
  const d = useErp();
  const naviguer = useNavigate();
  const [recherche, setRecherche] = useRechercheUrl();
  const [types, setTypes] = useState<string[]>([]);
  const [creation, setCreation] = useCreationParUrl();

  const lignes = useMemo<Ligne[]>(
    () =>
      d.proprietaires.map((p) => {
        const siens = d.logements.filter((l) => l.proprietaireId === p.id);
        return {
          p,
          logements: siens.filter((l) => l.statut !== 'sorti').length,
          actifs: siens.filter((l) => l.statut === 'actif').length,
          net12: revenuNet12Mois(d, p.id),
          statut: statutMandatPrincipal(d.mandats, p.id),
        };
      }),
    [d],
  );

  const filtrees = lignes.filter(({ p }) => {
    if (types.length && !types.includes(p.type)) return false;
    const q = recherche.trim().toLowerCase();
    return !q || [p.nom, p.contact.email, p.contact.telephone, p.adresse].some((x) => x.toLowerCase().includes(q));
  });
  const totalNet = lignes.reduce((s, l) => s + l.net12, 0);

  const colonnes: Colonne<Ligne>[] = [
    {
      cle: 'nom',
      titre: 'Propriétaire',
      tri: (a, b) => a.p.nom.localeCompare(b.p.nom),
      rendu: ({ p }) => (
        <div className="flex min-w-[180px] items-center gap-2.5">
          <Avatar nom={p.nom} />
          <div className="min-w-0">
            <p className="truncate font-medium">{p.nom}</p>
            <p className="truncate text-[12px] text-(--lm-encre-2)">{p.contact.email}</p>
          </div>
        </div>
      ),
    },
    { cle: 'type', titre: 'Type', rendu: ({ p }) => <Badge tone={TONS_TYPE[p.type]}>{LIBELLES.typeProprietaire[p.type]}</Badge> },
    {
      cle: 'logements',
      titre: 'Logements',
      align: 'droite',
      tri: (a, b) => a.logements - b.logements,
      rendu: ({ logements, actifs }) => (
        <span>
          {logements}
          {actifs !== logements && <span className="text-(--lm-encre-3)"> ({actifs} actif{actifs > 1 ? 's' : ''})</span>}
        </span>
      ),
    },
    { cle: 'net', titre: 'Net 12 mois', align: 'droite', masquerMobile: true, tri: (a, b) => a.net12 - b.net12, rendu: ({ net12 }) => euros(net12, true) },
    {
      cle: 'mandat',
      titre: 'Contrat',
      rendu: ({ statut }) => (statut ? <StatusBadge type="statutMandat" valeur={statut} /> : <Badge tone="danger">Pas de contrat</Badge>),
    },
    { cle: 'tel', titre: 'Téléphone', masquerMobile: true, rendu: ({ p }) => <span className="whitespace-nowrap">{p.contact.telephone}</span> },
  ];

  return (
    <>
      <PageHeader
        titre="Propriétaires"
        sousTitre="Les personnes qui vous confient leur logement : leurs coordonnées, leurs biens, leur contrat et leurs relevés."
        actions={
          <Button variant="primary" icone={<Plus />} onClick={() => setCreation(true)}>
            Ajouter un propriétaire
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Propriétaires" valeur={d.proprietaires.length} icone={<Users />} aide={`dont ${d.proprietaires.filter((p) => p.type !== 'particulier').length} sociétés ou SCI`} />
        <Stat label="Avec un contrat signé" valeur={lignes.filter((l) => l.statut === 'signe').length} icone={<Building2 />} />
        <Stat label="Reversé sur 12 mois" valeur={euros(totalNet, true)} icone={<Wallet />} aide="estimation, séjours terminés" />
      </div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput valeur={recherche} onChange={setRecherche} placeholder="Un nom, un e-mail, un téléphone, une ville…" label="Rechercher un propriétaire" />
        <FilterChips
          label="Filtrer par type"
          actifs={types}
          onChange={setTypes}
          filtres={TYPES.map((t) => ({ cle: t, libelle: LIBELLES.typeProprietaire[t], compteur: d.proprietaires.filter((p) => p.type === t).length }))}
        />
      </div>
      <Table
        legende="Liste des propriétaires"
        colonnes={colonnes}
        lignes={filtrees}
        cleLigne={({ p }) => p.id}
        onLigneClick={({ p }) => naviguer(p.id)}
        triInitial={{ cle: 'nom', sens: 'asc' }}
        vide="Personne ne correspond à votre recherche."
      />
      <FormProprietaire ouvert={creation} onFermer={() => setCreation(false)} onCree={(id) => naviguer(id)} />
    </>
  );
}
