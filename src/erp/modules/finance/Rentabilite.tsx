import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useErp } from '../../data/store';
import { euros, nombre, pourcentage } from '../../data/format';
import { COMMISSION_CIBLE_MIN } from '../../data/constantes';
import { Badge, FilterChips, PageHeader, Stat, Table, type Colonne } from '../../ui';
import { fenetre12Mois, rentabiliteParLogement, type LigneRentabilite } from './_calculs';
import { FIL_FINANCE, type PageFinanceProps } from './_composants/types';

/** Sous ce taux de marge (marge / CA Label Maison), le logement est signalé. */
const SEUIL_MARGE_FAIBLE = 0.25;

function alertes(l: LigneRentabilite) {
  const a: { libelle: string; ton: 'danger' | 'alerte' }[] = [];
  const actif = l.commission + l.fraisMenage > 0;
  if (l.marge < 0) a.push({ libelle: 'Marge négative', ton: 'danger' });
  else if (actif && l.tauxMarge < SEUIL_MARGE_FAIBLE) a.push({ libelle: 'Marge faible', ton: 'alerte' });
  if (l.commissionPct !== undefined && l.commissionPct < COMMISSION_CIBLE_MIN) a.push({ libelle: `Mandat à ${nombre(l.commissionPct)} %`, ton: 'alerte' });
  if (l.fraisMenage < l.coutMenage) a.push({ libelle: 'Ménage déficitaire', ton: 'alerte' });
  return a;
}

const signe = (v: number) => (v < 0 ? `- ${euros(-v, true)}` : euros(v, true));

export default function Rentabilite({ onglets }: PageFinanceProps) {
  const d = useErp();
  const [surveiller, setSurveiller] = useState(false);
  const toutes = useMemo(() => rentabiliteParLogement(d, fenetre12Mois()), [d]);
  const lignes = surveiller ? toutes.filter((l) => alertes(l).length) : toutes;

  const somme = (k: keyof Pick<LigneRentabilite, 'brut' | 'commission' | 'fraisMenage' | 'coutMenage' | 'charges' | 'marge'>) =>
    toutes.reduce((s, l) => s + l[k], 0);
  const negatives = toutes.filter((l) => l.marge < 0).length;
  const sousCible = toutes.filter((l) => l.commissionPct !== undefined && l.commissionPct < COMMISSION_CIBLE_MIN);
  const aSurveiller = toutes.filter((l) => alertes(l).length).length;

  const colonnes: Colonne<LigneRentabilite>[] = [
    {
      cle: 'nom',
      titre: 'Logement',
      rendu: (l) => (
        <span className="block min-w-44">
          <Link to={`/erp/logements/${l.logementId}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-(--lm-or) hover:underline">
            {l.nom}
          </Link>
          <span className="mt-1 flex flex-wrap gap-1">
            {alertes(l).map((a) => (
              <Badge key={a.libelle} tone={a.ton} point>
                {a.libelle}
              </Badge>
            ))}
          </span>
        </span>
      ),
      tri: (a, b) => a.nom.localeCompare(b.nom),
    },
    { cle: 'pct', titre: 'Mandat', align: 'droite', rendu: (l) => (l.commissionPct === undefined ? '-' : `${nombre(l.commissionPct)} %`), tri: (a, b) => (a.commissionPct ?? 0) - (b.commissionPct ?? 0) },
    { cle: 'brut', titre: 'Revenu brut géré', align: 'droite', rendu: (l) => <span className="text-(--lm-encre-2)">{euros(l.brut, true)}</span>, tri: (a, b) => a.brut - b.brut },
    { cle: 'commission', titre: 'Commission LM', align: 'droite', rendu: (l) => euros(l.commission, true), tri: (a, b) => a.commission - b.commission },
    { cle: 'frais', titre: 'Ménage encaissé', align: 'droite', rendu: (l) => euros(l.fraisMenage, true), tri: (a, b) => a.fraisMenage - b.fraisMenage, masquerMobile: true },
    { cle: 'cout', titre: 'Coût ménage', align: 'droite', rendu: (l) => signe(-l.coutMenage), tri: (a, b) => a.coutMenage - b.coutMenage, masquerMobile: true },
    { cle: 'charges', titre: 'Charges affectées', align: 'droite', rendu: (l) => (l.charges ? signe(-l.charges) : '-'), tri: (a, b) => a.charges - b.charges, masquerMobile: true },
    {
      cle: 'marge',
      titre: 'Marge LM',
      align: 'droite',
      rendu: (l) => <span className={`font-semibold ${l.marge < 0 ? 'text-(--lm-danger)' : ''}`}>{signe(l.marge)}</span>,
      tri: (a, b) => a.marge - b.marge,
    },
    { cle: 'taux', titre: 'Taux de marge', align: 'droite', rendu: (l) => (l.commission + l.fraisMenage ? pourcentage(l.tauxMarge) : '-'), tri: (a, b) => a.tauxMarge - b.tauxMarge },
  ];

  return (
    <>
      <PageHeader
        fil={[...FIL_FINANCE, { libelle: 'Rentabilité par logement' }]}
        titre="Rentabilité par logement"
        sousTitre="Compte de résultat Label Maison par logement sur 12 mois glissants : commission + frais de ménage encaissés, moins coût des ménages validés et charges affectées."
      />
      {onglets}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="CA Label Maison, 12 mois" valeur={euros(somme('commission') + somme('fraisMenage'), true)} aide={`sur ${euros(somme('brut'), true)} de revenu brut géré`} />
        <Stat label="Marge après ménage et charges" valeur={signe(somme('marge'))} tone={somme('marge') < 0 ? 'danger' : 'succes'} />
        <Stat label="Logements en marge négative" valeur={nombre(negatives)} tone={negatives ? 'danger' : 'neutre'} />
        <Stat
          label={`Mandats sous ${COMMISSION_CIBLE_MIN} %`}
          valeur={nombre(sousCible.length)}
          tone={sousCible.length ? 'alerte' : 'neutre'}
          aide={sousCible.length ? 'À migrer au renouvellement' : undefined}
        />
      </div>

      <FilterChips
        className="mb-3"
        label="Affichage"
        unique
        actifs={[surveiller ? 'surveiller' : 'tous']}
        onChange={(a) => setSurveiller(a[0] === 'surveiller')}
        filtres={[
          { cle: 'tous', libelle: 'Tous les logements', compteur: toutes.length },
          { cle: 'surveiller', libelle: 'À surveiller', compteur: aSurveiller },
        ]}
      />

      <Table
        legende="Rentabilité par logement sur 12 mois"
        colonnes={colonnes}
        lignes={lignes}
        cleLigne={(l) => l.logementId}
        triInitial={{ cle: 'marge', sens: 'asc' }}
        vide="Aucun logement à surveiller."
      />
      <p className="mt-3 text-[12.5px] text-(--lm-encre-3)">
        Coût ménage : missions de ménage et de linge validées uniquement (pas de validation, pas de paiement). Charges générales non réparties. Marge faible : moins de{' '}
        {pourcentage(SEUIL_MARGE_FAIBLE)} du chiffre d’affaires du logement.
      </p>
    </>
  );
}
