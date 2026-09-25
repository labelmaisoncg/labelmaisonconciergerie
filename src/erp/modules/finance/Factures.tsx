import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useErp } from '../../data/store';
import { AUJOURDHUI, dateCourte, euros, pluriel } from '../../data/format';
import { joursRetard, statutReel } from './_calculs';
import { LIBELLES } from '../../data/libelles';
import { facturesEnRetard, montantTtc, proprietaireById } from '../../data/selectors';
import type { Facture, StatutFacture } from '../../data/types';
import { Badge, Button, PageHeader, Stat, StatusBadge, Table, Toolbar, type Colonne, useCreationParUrl } from '../../ui';
import { DetailFacture } from './_composants/DetailFacture';
import { NouvelleFacture } from './_composants/NouvelleFacture';
import { FIL_FINANCE, type PageFinanceProps } from './_composants/types';
import { useRechercheUrl } from '../../ui/useRechercheUrl';

const FILTRES: StatutFacture[] = ['brouillon', 'emise', 'en_retard', 'payee', 'annulee'];

export default function Factures({ onglets }: PageFinanceProps) {
  const d = useErp();
  const [filtres, setFiltres] = useState<string[]>([]);
  const [recherche, setRecherche] = useRechercheUrl();
  const [ouverte, setOuverte] = useState<string>();
  const [creation, setCreation] = useCreationParUrl();

  const nomDestinataire = (f: Facture) => proprietaireById(d, f.proprietaireId)?.nom ?? LIBELLES.destinataire[f.destinataire];

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return d.factures
      .filter((f) => !filtres.length || filtres.includes(statutReel(f)))
      .filter((f) => !q || f.numero.toLowerCase().includes(q) || nomDestinataire(f).toLowerCase().includes(q));
  }, [d, filtres, recherche]); // eslint-disable-line react-hooks/exhaustive-deps

  const retard = facturesEnRetard(d.factures);
  const aEncaisser = d.factures.filter((f) => f.statut === 'emise' || f.statut === 'en_retard');
  const payeesMois = d.factures.filter((f) => f.statut === 'payee' && f.payeeLe?.startsWith(AUJOURDHUI.slice(0, 7)));
  const somme = (l: Facture[]) => l.reduce((s, f) => s + montantTtc(f), 0);

  const colonnes: Colonne<Facture>[] = [
    { cle: 'numero', titre: 'Numéro', rendu: (f) => <span className="lm-chiffres font-medium">{f.numero}</span>, tri: (a, b) => a.numero.localeCompare(b.numero) },
    {
      cle: 'destinataire',
      titre: 'Destinataire',
      rendu: (f) => (
        <span>
          {nomDestinataire(f)}
          <span className="block text-[12px] text-(--lm-encre-3)">{LIBELLES.typeFacture[f.type]}</span>
        </span>
      ),
      tri: (a, b) => nomDestinataire(a).localeCompare(nomDestinataire(b)),
    },
    { cle: 'emission', titre: 'Émise le', rendu: (f) => dateCourte(f.dateEmission), tri: (a, b) => a.dateEmission.localeCompare(b.dateEmission), masquerMobile: true },
    {
      cle: 'echeance',
      titre: 'Échéance',
      rendu: (f) =>
        statutReel(f) === 'en_retard' ? (
          <span className="font-medium text-(--lm-danger)">
            {dateCourte(f.echeance)}
            <span className="block text-[12px]">{pluriel(joursRetard(f), 'jour')} de retard</span>
          </span>
        ) : (
          dateCourte(f.echeance)
        ),
      tri: (a, b) => a.echeance.localeCompare(b.echeance),
    },
    { cle: 'ht', titre: 'HT', align: 'droite', rendu: (f) => euros(f.montantHtCentimes), tri: (a, b) => a.montantHtCentimes - b.montantHtCentimes, masquerMobile: true },
    { cle: 'ttc', titre: 'TTC', align: 'droite', rendu: (f) => <span className="font-semibold">{euros(montantTtc(f))}</span>, tri: (a, b) => montantTtc(a) - montantTtc(b) },
    { cle: 'statut', titre: 'Statut', rendu: (f) => <StatusBadge type="statutFacture" valeur={statutReel(f)} /> },
  ];

  const facture = d.factures.find((f) => f.id === ouverte);

  return (
    <>
      <PageHeader
        fil={[...FIL_FINANCE, { libelle: 'Factures' }]}
        titre="Factures"
        sousTitre="Les factures que vous envoyez : commissions, ménages, prestations. Elles sont numérotées à la suite (LM-2026-…)."
        actions={
          <Button variant="primary" icone={<Plus />} onClick={() => setCreation(true)}>
            Nouvelle facture
          </Button>
        }
      />
      {onglets}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Pas payées à temps" valeur={euros(somme(retard), true)} tone={retard.length ? 'danger' : 'neutre'} aide={pluriel(retard.length, 'facture')} />
        <Stat label="À recevoir (TTC)" valeur={euros(somme(aEncaisser), true)} aide={pluriel(aEncaisser.length, 'facture')} />
        <Stat label="Reçu ce mois-ci (TTC)" valeur={euros(somme(payeesMois), true)} tone="succes" aide={pluriel(payeesMois.length, 'facture')} />
      </div>

      <Toolbar
        recherche={{ valeur: recherche, onChange: setRecherche, placeholder: 'Numéro ou destinataire', label: 'Rechercher une facture' }}
        filtres={{
          label: 'Filtrer par statut',
          actifs: filtres,
          onChange: setFiltres,
          filtres: FILTRES.map((s) => ({ cle: s, libelle: LIBELLES.statutFacture[s], compteur: d.factures.filter((f) => statutReel(f) === s).length })),
        }}
        actions={filtres.length ? <Badge tone="or">{pluriel(lignes.length, 'facture')}</Badge> : undefined}
      />

      <Table
        legende="Factures"
        colonnes={colonnes}
        lignes={lignes}
        cleLigne={(f) => f.id}
        onLigneClick={(f) => setOuverte(f.id)}
        ligneActive={ouverte}
        triInitial={{ cle: 'numero', sens: 'desc' }}
        vide="Aucune facture ne correspond. Essayez d’enlever un filtre."
      />

      {facture && <DetailFacture key={facture.id} facture={facture} destinataire={nomDestinataire(facture)} onFermer={() => setOuverte(undefined)} />}
      <NouvelleFacture ouvert={creation} onFermer={() => setCreation(false)} onCree={(id) => setOuverte(id)} />
    </>
  );
}
