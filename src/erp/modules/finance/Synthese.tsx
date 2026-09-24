import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Landmark, PiggyBank, Receipt, Wallet } from 'lucide-react';
import { useErp } from '../../data/store';
import { AUJOURDHUI, euros, moisAnnee, nombre, pourcentage } from '../../data/format';
import { COMMISSION_CIBLE_MAX, COMMISSION_CIBLE_MIN } from '../../data/constantes';
import { fenetreMois } from '../../data/selectors';
import { Alert, Badge, Card, CardHeader, FilterChips, PageHeader, ProgressBar } from '../../ui';
import { fenetre12Mois, fenetrePeriode, derniersMois, rentabiliteParLogement, serieMensuelle, synthese } from './_calculs';
import { AXE, COULEURS, eurosAxe, Infobulle } from './_composants/graphiques';
import { CarteMontant } from './_composants/CarteMontant';
import type { PageFinanceProps } from './_composants/types';

type Periode = 'mois' | 'precedent' | 'annee';

export default function Synthese({ onglets }: PageFinanceProps) {
  const d = useErp();
  const [periode, setPeriode] = useState<Periode>('mois');
  const mois = derniersMois(2);
  const fenetre = useMemo(
    () => (periode === 'mois' ? fenetreMois(AUJOURDHUI) : periode === 'precedent' ? fenetrePeriode(derniersMois(2)[0]) : fenetre12Mois()),
    [periode],
  );
  const libelle = periode === 'annee' ? '12 derniers mois' : moisAnnee(periode === 'mois' ? mois[1] : mois[0]);

  const s = useMemo(() => synthese(d, fenetre), [d, fenetre]);
  const serie = useMemo(() => serieMensuelle(d), [d]);
  const parLogement = useMemo(
    () => rentabiliteParLogement(d, fenetre).filter((l) => l.brut > 0).sort((a, b) => b.commission + b.fraisMenage - (a.commission + a.fraisMenage)),
    [d, fenetre],
  );
  const sousCible = d.mandats.filter((m) => m.statut === 'signe' && m.commissionPct < COMMISSION_CIBLE_MIN);
  const tauxOk = s.tauxEffectif * 100 >= COMMISSION_CIBLE_MIN;
  const tva = Math.round(s.commission * 0.2);

  return (
    <>
      <PageHeader
        titre="Finance"
        sousTitre="Combien a-t-on gagné, sur quoi, et qui doit quoi. L’argent des propriétaires et le chiffre d’affaires de Label Maison sont toujours séparés."
      />
      {onglets}

      <FilterChips
        label="Période"
        unique
        className="mb-4"
        actifs={[periode]}
        onChange={(a) => a[0] && setPeriode(a[0] as Periode)}
        filtres={[
          { cle: 'mois', libelle: `Mois en cours (${moisAnnee(mois[1])})` },
          { cle: 'precedent', libelle: moisAnnee(mois[0]) },
          { cle: 'annee', libelle: '12 derniers mois' },
        ]}
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <CarteMontant
          couleur={COULEURS.brut}
          icone={<Landmark />}
          titre="Revenu brut géré"
          precision="pour le compte des propriétaires"
          montant={s.brut}
          note="Payé par les voyageurs, frais de ménage inclus. Ce n’est pas notre chiffre d’affaires : la plus grande part est reversée aux propriétaires."
        />
        <CarteMontant
          couleur={COULEURS.ca}
          icone={<Wallet />}
          titre="Chiffre d’affaires Label Maison"
          precision="commissions + frais de ménage"
          montant={s.ca}
          lignes={[
            ['Commissions de gestion', s.commission],
            ['Frais de ménage encaissés', s.fraisMenage],
          ]}
          note={s.brut ? `Soit ${pourcentage(s.ca / s.brut, 1)} du revenu brut géré.` : undefined}
          accent
        />
        <CarteMontant
          couleur={COULEURS.marge}
          icone={<PiggyBank />}
          titre="Marge après ménage et charges"
          precision="ce qui reste à Label Maison"
          montant={s.marge}
          lignes={[
            ['Chiffre d’affaires', s.ca],
            ['Coût ménage (missions validées)', -s.coutMenage],
            ['Charges', -s.charges],
          ]}
          note={s.ca ? `Taux de marge : ${pourcentage(s.marge / s.ca)} du chiffre d’affaires.` : undefined}
        />
      </div>
      <p className="mb-6 text-[12.5px] text-(--lm-encre-3)">Période : {libelle}. Montants des séjours proratisés à la nuit ; frais de ménage comptés au départ du voyageur.</p>

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader titre="Revenu brut géré, 12 mois" description="Argent des propriétaires, transite par Label Maison." />
          <div className="h-60" role="img" aria-label="Histogramme du revenu brut géré sur 12 mois">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={COULEURS.grille} />
                <XAxis dataKey="libelle" tick={AXE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={eurosAxe} tick={AXE} tickLine={false} axisLine={false} width={48} />
                <Tooltip content={<Infobulle />} cursor={{ fill: 'rgba(20,17,14,0.04)' }} />
                <Bar dataKey="brut" name="Revenu brut géré" fill={COULEURS.brut} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader titre="Chiffre d’affaires Label Maison et marge, 12 mois" description="Commissions + frais de ménage, puis marge après ménage et charges." />
          <div className="h-60" role="img" aria-label="Histogramme du chiffre d’affaires Label Maison et courbe de marge sur 12 mois">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={COULEURS.grille} />
                <XAxis dataKey="libelle" tick={AXE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={eurosAxe} tick={AXE} tickLine={false} axisLine={false} width={48} />
                <Tooltip content={<Infobulle />} cursor={{ fill: 'rgba(20,17,14,0.04)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ca" name="CA Label Maison" fill={COULEURS.ca} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line dataKey="marge" name="Marge" stroke={COULEURS.marge} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: COULEURS.marge }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" flush>
          <div className="p-4 pb-2 sm:p-5 sm:pb-2">
            <CardHeader
              titre="Chiffre d’affaires par logement"
              description={`${libelle}. Détail complet dans l’onglet Rentabilité.`}
              actions={<Link to="/erp/finance/rentabilite" className="text-[13px] font-medium text-(--lm-or) hover:underline">Voir la rentabilité</Link>}
            />
          </div>
          <ul className="divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
            {parLogement.length === 0 && <li className="px-5 py-8 text-center text-sm text-(--lm-encre-3)">Aucun séjour sur la période.</li>}
            {parLogement.map((l) => {
              const ca = l.commission + l.fraisMenage;
              return (
                <li key={l.logementId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 sm:px-5">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{l.nom}</span>
                  {l.commissionPct !== undefined && l.commissionPct < COMMISSION_CIBLE_MIN && <Badge tone="alerte">Mandat {nombre(l.commissionPct)} %</Badge>}
                  <span className="lm-chiffres w-28 text-right text-[12.5px] text-(--lm-encre-2)" title="Revenu brut géré">{euros(l.brut, true)} brut</span>
                  <span className="lm-chiffres w-24 text-right text-[13.5px] font-semibold">{euros(ca, true)}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader titre="Taux de commission effectif" description={`Cible ${COMMISSION_CIBLE_MIN} à ${COMMISSION_CIBLE_MAX} % de la base commissionnable.`} />
            <p className="lm-chiffres text-[28px] leading-none font-semibold">{pourcentage(s.tauxEffectif, 1)}</p>
            <ProgressBar className="mt-3" valeur={s.tauxEffectif / (COMMISSION_CIBLE_MAX / 100)} tone={tauxOk ? 'succes' : 'alerte'} label={tauxOk ? 'Dans la cible' : 'Sous la cible'} />
            {sousCible.length > 0 && (
              <p className="mt-3 text-[12.5px] text-(--lm-encre-2)">
                {nombre(sousCible.length)} mandat{sousCible.length > 1 ? 's' : ''} signé{sousCible.length > 1 ? 's' : ''} sous {COMMISSION_CIBLE_MIN} % (anciennes conditions) : migration à proposer au renouvellement.{' '}
                <Link to="/erp/mandats" className="font-medium text-(--lm-or) hover:underline">Voir les mandats</Link>
              </p>
            )}
          </Card>
          <Card>
            <CardHeader titre="Aide TVA" description="Estimation, à valider avec l’expert-comptable." actions={<Receipt className="size-4 text-(--lm-encre-3)" aria-hidden />} />
            <dl className="space-y-1.5 text-[13px]">
              <LigneTva libelle="Chiffre d’affaires HT" valeur={euros(s.ca)} />
              <LigneTva libelle="dont commissions HT" valeur={euros(s.commission)} />
              <LigneTva libelle="TVA collectée estimée (20 % des commissions)" valeur={euros(tva)} fort />
            </dl>
            <p className="mt-2 text-[12px] text-(--lm-encre-3)">Traitement TVA des frais de ménage refacturés et régime applicable à confirmer.</p>
          </Card>
        </div>
      </div>

      <Alert tone="neutre" className="mt-6" titre="Comment lire ces chiffres">
        Revenu brut géré : total payé par les voyageurs, qui appartient aux propriétaires. Chiffre d’affaires Label Maison : commissions de gestion
        (calculées sur le brut moins commission plateforme et frais de ménage) plus frais de ménage. Ne jamais annoncer le revenu brut géré comme
        chiffre d’affaires.
      </Alert>
    </>
  );
}

function LigneTva({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-(--lm-encre-2)">{libelle}</dt>
      <dd className={`lm-chiffres whitespace-nowrap ${fort ? 'font-semibold text-(--lm-encre)' : ''}`}>{valeur}</dd>
    </div>
  );
}
