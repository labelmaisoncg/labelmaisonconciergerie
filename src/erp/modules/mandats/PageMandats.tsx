import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilePen, FileSignature, Percent, Plus, RefreshCcw } from 'lucide-react';
import { Badge, Button, FilterChips, PageHeader, SearchInput, Stat, StatusBadge, Table, type Colonne } from '../../ui';
import { useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { COMMISSION_CIBLE_MIN } from '../../data/constantes';
import { dateCourte, euros, nombre } from '../../data/format';
import { logementById, proprietaireById } from '../../data/selectors';
import type { Mandat, StatutMandat } from '../../data/types';
import { DetailMandat } from './DetailMandat';
import { FormMandat } from './FormMandat';

const STATUTS: StatutMandat[] = ['brouillon', 'envoye', 'signe', 'resilie'];
const sousCible = (m: Mandat) => m.statut !== 'resilie' && m.commissionPct < COMMISSION_CIBLE_MIN;

export default function PageMandats() {
  const d = useErp();
  const [params, setParams] = useSearchParams();
  const [recherche, setRecherche] = useState('');
  const [filtres, setFiltres] = useState<string[]>([]);
  const [form, setForm] = useState<{ ouvert: boolean; mandat?: Mandat }>({ ouvert: false });

  const selection = d.mandats.find((m) => m.id === params.get('mandat'));
  const ouvrir = (id?: string) => setParams(id ? { mandat: id } : {}, { replace: !id });

  const lignes = useMemo(
    () =>
      d.mandats.map((m) => ({
        m,
        proprietaire: proprietaireById(d, m.proprietaireId)?.nom ?? 'Inconnu',
        logement: logementById(d, m.logementId)?.nom ?? 'Inconnu',
      })),
    [d],
  );
  type Ligne = (typeof lignes)[number];

  const filtrees = lignes.filter(({ m, proprietaire, logement }) => {
    const statuts = filtres.filter((f) => f !== 'sous_cible');
    if (statuts.length && !statuts.includes(m.statut)) return false;
    if (filtres.includes('sous_cible') && !sousCible(m)) return false;
    const q = recherche.trim().toLowerCase();
    return !q || [m.reference, proprietaire, logement].some((x) => x.toLowerCase().includes(q));
  });

  const signes = d.mandats.filter((m) => m.statut === 'signe');
  const enAttente = d.mandats.filter((m) => m.statut === 'brouillon' || m.statut === 'envoye').length;
  const aRenegocier = d.mandats.filter((m) => m.statut === 'signe' && m.commissionPct < COMMISSION_CIBLE_MIN).length;
  const moyenne = signes.length ? signes.reduce((s, m) => s + m.commissionPct, 0) / signes.length : 0;

  const colonnes: Colonne<Ligne>[] = [
    { cle: 'ref', titre: 'Référence', tri: (a, b) => a.m.reference.localeCompare(b.m.reference), rendu: ({ m }) => <span className="font-medium whitespace-nowrap">{m.reference}</span> },
    {
      cle: 'prop',
      titre: 'Propriétaire',
      tri: (a, b) => a.proprietaire.localeCompare(b.proprietaire),
      rendu: ({ m, proprietaire }) => (
        <Link to={`/erp/proprietaires/${m.proprietaireId}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap hover:text-(--lm-or) hover:underline">
          {proprietaire}
        </Link>
      ),
    },
    {
      cle: 'log',
      titre: 'Logement',
      masquerMobile: true,
      rendu: ({ m, logement }) => (
        <Link to={`/erp/logements/${m.logementId}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap hover:text-(--lm-or) hover:underline">
          {logement}
        </Link>
      ),
    },
    {
      cle: 'com',
      titre: 'Commission',
      align: 'droite',
      tri: (a, b) => a.m.commissionPct - b.m.commissionPct,
      rendu: ({ m }) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {sousCible(m) && <Badge tone="alerte">Sous la cible</Badge>}
          {nombre(m.commissionPct, m.commissionPct % 1 ? 1 : 0)} %
        </span>
      ),
    },
    { cle: 'menage', titre: 'Frais ménage', align: 'droite', masquerMobile: true, rendu: ({ m }) => euros(m.fraisMenageCentimes) },
    { cle: 'debut', titre: 'Début', masquerMobile: true, tri: (a, b) => a.m.dateDebut.localeCompare(b.m.dateDebut), rendu: ({ m }) => <span className="whitespace-nowrap">{dateCourte(m.dateDebut)}</span> },
    { cle: 'essai', titre: 'Fin d’essai', masquerMobile: true, rendu: ({ m }) => (m.periodeEssaiFin ? <span className="whitespace-nowrap">{dateCourte(m.periodeEssaiFin)}</span> : '-') },
    { cle: 'statut', titre: 'Statut', rendu: ({ m }) => <StatusBadge type="statutMandat" valeur={m.statut} /> },
    { cle: 'signe', titre: 'Signé le', masquerMobile: true, tri: (a, b) => (a.m.signeLe ?? '').localeCompare(b.m.signeLe ?? ''), rendu: ({ m }) => (m.signeLe ? <span className="whitespace-nowrap">{dateCourte(m.signeLe)}</span> : '-') },
  ];

  return (
    <>
      <PageHeader
        titre="Mandats"
        sousTitre="Aucun logement ne passe actif sans mandat écrit signé. Commission cible de 18 à 20 %, migration des anciens mandats au renouvellement."
        fil={[{ libelle: 'Référentiel' }, { libelle: 'Mandats' }]}
        actions={
          <Button variant="primary" icone={<Plus />} onClick={() => setForm({ ouvert: true })}>
            Nouveau mandat
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Mandats signés" valeur={signes.length} icone={<FileSignature />} aide={`sur ${d.mandats.length} au total`} />
        <Stat label="En attente de signature" valeur={enAttente} icone={<FilePen />} tone={enAttente ? 'alerte' : 'neutre'} aide="brouillons et envoyés" />
        <Stat label="Commission moyenne" valeur={`${nombre(moyenne, 1)} %`} icone={<Percent />} aide="mandats signés" />
        <Stat
          label="Mandats à renégocier au renouvellement"
          valeur={aRenegocier}
          icone={<RefreshCcw />}
          tone={aRenegocier ? 'alerte' : 'neutre'}
          aide={`sous ${COMMISSION_CIBLE_MIN} %`}
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput valeur={recherche} onChange={setRecherche} placeholder="Référence, propriétaire, logement" label="Rechercher un mandat" />
        <FilterChips
          label="Filtrer les mandats"
          actifs={filtres}
          onChange={setFiltres}
          filtres={[
            ...STATUTS.map((s) => ({ cle: s, libelle: LIBELLES.statutMandat[s], compteur: d.mandats.filter((m) => m.statut === s).length })),
            { cle: 'sous_cible', libelle: 'Sous la cible', compteur: d.mandats.filter(sousCible).length },
          ]}
        />
      </div>

      <Table
        legende="Liste des mandats"
        colonnes={colonnes}
        lignes={filtrees}
        cleLigne={({ m }) => m.id}
        onLigneClick={({ m }) => ouvrir(m.id)}
        ligneActive={selection?.id}
        triInitial={{ cle: 'ref', sens: 'desc' }}
        vide="Aucun mandat ne correspond aux filtres."
      />

      <DetailMandat mandat={selection} onFermer={() => ouvrir()} onModifier={(m) => setForm({ ouvert: true, mandat: m })} />
      <FormMandat
        ouvert={form.ouvert}
        mandat={form.mandat}
        onFermer={() => setForm({ ouvert: false })}
        onEnregistre={(m) => ouvrir(m.id)}
      />
    </>
  );
}
