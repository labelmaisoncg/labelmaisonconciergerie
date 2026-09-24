import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { useErp } from '../../data/store';
import { AUJOURDHUI, euros, moisAnnee, nombre, pluriel } from '../../data/format';
import { LIBELLES } from '../../data/libelles';
import { Alert, Field, PageHeader, Select, Stat, Table, type Colonne } from '../../ui';
import { derniersMois } from './_calculs';
import { lignesPaiement, type LignePaiement } from './_composants/paiements';
import { BadgePaiement, DetailPaiement } from './_composants/DetailPaiement';
import { FIL_FINANCE, type PageFinanceProps } from './_composants/types';

export default function Paiements({ onglets }: PageFinanceProps) {
  const d = useErp();
  const periodes = useMemo(() => derniersMois(12).reverse(), []);
  const [periode, setPeriode] = useState(periodes[1]);
  const [ouverte, setOuverte] = useState<string>();
  const lignes = useMemo(() => lignesPaiement(d, periode), [d, periode]);
  const ligne = lignes.find((l) => l.cle === ouverte);

  const aPayer = lignes.filter((l) => l.statut === 'a_payer');
  const bloques = lignes.filter((l) => l.statut === 'bloque');
  const exclues = lignes.reduce((s, l) => s + l.exclues.length, 0);
  const enCours = periode === AUJOURDHUI.slice(0, 7);

  const colonnes: Colonne<LignePaiement>[] = [
    {
      cle: 'prestataire',
      titre: 'Prestataire',
      rendu: (l) => (
        <span>
          <span className="font-medium">{l.prestataire.nom}</span>
          <span className="block text-[12px] text-(--lm-encre-3)">{LIBELLES.typePrestataire[l.prestataire.type]}</span>
        </span>
      ),
      tri: (a, b) => a.prestataire.nom.localeCompare(b.prestataire.nom),
    },
    { cle: 'validees', titre: 'Validées', align: 'droite', rendu: (l) => nombre(l.validees.length), tri: (a, b) => a.validees.length - b.validees.length },
    {
      cle: 'exclues',
      titre: 'Non validées (exclues)',
      align: 'droite',
      rendu: (l) => (l.exclues.length ? <span className="font-medium text-(--lm-alerte)">{nombre(l.exclues.length)}</span> : '0'),
      masquerMobile: true,
    },
    { cle: 'montant', titre: 'Montant validé', align: 'droite', rendu: (l) => euros(l.montant), masquerMobile: true },
    { cle: 'retenue', titre: 'Retenue', align: 'droite', rendu: (l) => (l.retenue ? `- ${euros(l.retenue)}` : '-'), masquerMobile: true },
    { cle: 'net', titre: 'Net à verser', align: 'droite', rendu: (l) => <span className="font-semibold">{euros(l.net)}</span>, tri: (a, b) => a.net - b.net },
    { cle: 'statut', titre: 'Statut', rendu: (l) => <BadgePaiement ligne={l} /> },
  ];

  return (
    <>
      <PageHeader
        fil={[...FIL_FINANCE, { libelle: 'Paiements prestataires' }]}
        titre="Paiements prestataires"
        sousTitre="Calculés à partir des missions de la période. Pas de validation, pas de paiement : seules les missions validées (checklist et photos avant/après) sont payées."
      />
      {onglets}

      <div className="mb-5 flex flex-wrap items-end gap-4">
        <Field label="Période" className="w-full sm:w-60">
          <Select value={periode} onChange={(e) => setPeriode(e.target.value)} options={periodes.map((p) => ({ valeur: p, libelle: moisAnnee(p) }))} />
        </Field>
        {enCours && <p className="pb-2 text-[12.5px] text-(--lm-encre-2)">Période en cours : montants provisoires.</p>}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="À payer" valeur={euros(aPayer.reduce((s, l) => s + l.net, 0), true)} tone={aPayer.length ? 'alerte' : 'neutre'} aide={pluriel(aPayer.length, 'prestataire')} />
        <Stat label="Paiements bloqués" valeur={nombre(bloques.length)} tone={bloques.length ? 'danger' : 'neutre'} aide={bloques[0]?.paiement?.motifRetenue ? 'Motif indiqué au détail' : undefined} />
        <Stat label="Missions non validées exclues" valeur={nombre(exclues)} tone={exclues ? 'alerte' : 'neutre'} aide="Non payées tant qu’elles ne sont pas validées" />
      </div>

      {exclues > 0 && (
        <Alert tone="info" icone={<Info />} className="mb-4" titre="Missions exclues du paiement">
          {pluriel(exclues, 'mission')} de {moisAnnee(periode)} ne {exclues > 1 ? 'sont' : 'est'} pas validée{exclues > 1 ? 's' : ''}. Ouvrez un prestataire pour voir le motif et
          faire valider les missions dans le module Ménages.
        </Alert>
      )}

      <Table
        legende={`Paiements prestataires, ${moisAnnee(periode)}`}
        colonnes={colonnes}
        lignes={lignes}
        cleLigne={(l) => l.cle}
        onLigneClick={(l) => setOuverte(l.cle)}
        ligneActive={ouverte}
        triInitial={{ cle: 'net', sens: 'desc' }}
        vide={`Aucune mission de prestataire en ${moisAnnee(periode)}.`}
      />

      {ligne && <DetailPaiement key={ligne.cle} ligne={ligne} onFermer={() => setOuverte(undefined)} />}
    </>
  );
}
