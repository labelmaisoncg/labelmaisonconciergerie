import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilePen, FileSignature, Percent, Plus } from 'lucide-react';
import { Badge, Button, FilterChips, PageHeader, SearchInput, Stat, StatusBadge, Table, type Colonne, useCreationParUrl } from '../../ui';
import { useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { COMMISSION_CIBLE_MIN } from '../../data/constantes';
import { dateCourte, euros, nombre } from '../../data/format';
import { logementById, proprietaireById } from '../../data/selectors';
import type { Mandat, StatutMandat } from '../../data/types';
import { DetailMandat } from './DetailMandat';
import { FormMandat } from './FormMandat';
import { useRechercheUrl } from '../../ui/useRechercheUrl';

const STATUTS: StatutMandat[] = ['brouillon', 'envoye', 'signe', 'resilie'];
const sousCible = (m: Mandat) => m.statut !== 'resilie' && m.commissionPct < COMMISSION_CIBLE_MIN;

export default function PageMandats() {
  const d = useErp();
  const [params, setParams] = useSearchParams();
  const [recherche, setRecherche] = useRechercheUrl();
  const [filtres, setFiltres] = useState<string[]>([]);
  const [form, setFormEtat] = useState<{ ouvert: boolean; mandat?: Mandat }>({ ouvert: false });
  const [creationUrl, setCreationUrl] = useCreationParUrl();
  const setForm = (f: { ouvert: boolean; mandat?: Mandat }) => {
    if (!f.ouvert && creationUrl) setCreationUrl(false);
    setFormEtat(f);
  };

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
        titre="Contrats de gestion"
        sousTitre="Le contrat (mandat) signé avec chaque propriétaire. Un logement ne se met en ligne qu’avec un contrat signé."
        actions={
          <Button variant="primary" icone={<Plus />} onClick={() => setForm({ ouvert: true })}>
            Nouveau contrat
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Signés" valeur={signes.length} icone={<FileSignature />} aide={`sur ${d.mandats.length} au total`} />
        <Stat label="En attente de signature" valeur={enAttente} icone={<FilePen />} tone={enAttente ? 'alerte' : 'neutre'} aide="brouillons et contrats envoyés" />
        <Stat
          label="Commission moyenne"
          valeur={`${nombre(moyenne, 1)} %`}
          icone={<Percent />}
          tone={aRenegocier ? 'alerte' : 'neutre'}
          aide={aRenegocier ? `${aRenegocier} contrat${aRenegocier > 1 ? 's' : ''} sous ${COMMISSION_CIBLE_MIN} %, à revoir au renouvellement` : 'objectif : 18 à 20 %'}
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput valeur={recherche} onChange={setRecherche} placeholder="Une référence, un propriétaire, un logement…" label="Rechercher un contrat" />
        <FilterChips
          label="Filtrer les contrats"
          actifs={filtres}
          onChange={setFiltres}
          filtres={[
            ...STATUTS.map((s) => ({ cle: s, libelle: LIBELLES.statutMandat[s], compteur: d.mandats.filter((m) => m.statut === s).length })),
            { cle: 'sous_cible', libelle: 'Commission trop basse', compteur: d.mandats.filter(sousCible).length },
          ]}
        />
      </div>

      <Table
        legende="Liste des contrats de gestion"
        colonnes={colonnes}
        lignes={filtrees}
        cleLigne={({ m }) => m.id}
        onLigneClick={({ m }) => ouvrir(m.id)}
        ligneActive={selection?.id}
        triInitial={{ cle: 'ref', sens: 'desc' }}
        vide="Aucun contrat ne correspond. Essayez d’enlever un filtre."
      />

      <DetailMandat mandat={selection} onFermer={() => ouvrir()} onModifier={(m) => setForm({ ouvert: true, mandat: m })} />
      <FormMandat
        ouvert={form.ouvert || creationUrl}
        mandat={form.mandat}
        onFermer={() => setForm({ ouvert: false })}
        onEnregistre={(m) => ouvrir(m.id)}
      />
    </>
  );
}
