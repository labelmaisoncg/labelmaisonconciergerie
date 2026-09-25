import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronRight, Landmark, PiggyBank, Receipt, Wallet } from 'lucide-react';
import { useErp } from '../../data/store';
import { AUJOURDHUI, euros, moisAnnee, nombre, pourcentage } from '../../data/format';
import { COMMISSION_CIBLE_MAX, COMMISSION_CIBLE_MIN } from '../../data/constantes';
import { fenetreMois } from '../../data/selectors';
import { Aide, Badge, Card, CardHeader, FilterChips, PageHeader, ProgressBar } from '../../ui';
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
  const serie = useMemo(() => {
    const toute = serieMensuelle(d);
    // Pas de mois vides avant le premier séjour géré (6 mois affichés au minimum).
    const premier = toute.findIndex((m) => m.brut > 0);
    return toute.slice(Math.max(0, Math.min(premier < 0 ? 0 : premier, toute.length - 6)));
  }, [d]);
  const depuis = serie.length < 12 ? `Depuis ${moisAnnee(serie[0].periode)}, premier mois d’activité.` : '12 derniers mois.';
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
        sousTitre="Ce que vous avez gagné, et ce qui revient aux propriétaires."
      />
      {onglets}

      <Aide titre="Comment lire ces chiffres ?">
        « Payé par les voyageurs » appartient surtout aux propriétaires : cet argent passe par vous, mais ce n’est pas votre chiffre d’affaires. Ce que
        vous facturez, ce sont vos commissions (calculées sur le prix du séjour, sans la part de la plateforme ni le ménage) et les frais de ménage. Ce
        qu’il vous reste, c’est ce montant moins le coût des ménages et vos dépenses.
      </Aide>

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
          titre="Payé par les voyageurs"
          precision="l’argent des propriétaires, qui passe par vous"
          montant={s.brut}
          note="Ménage compris. La plus grande partie est reversée aux propriétaires."
        />
        <CarteMontant
          couleur={COULEURS.ca}
          icone={<Wallet />}
          titre="Ce que vous facturez"
          precision="vos commissions et les frais de ménage"
          montant={s.ca}
          lignes={[
            ['Commissions de gestion', s.commission],
            ['Frais de ménage encaissés', s.fraisMenage],
          ]}
          note={s.brut ? `Soit ${pourcentage(s.ca / s.brut, 1)} de ce qu’ont payé les voyageurs.` : undefined}
          accent
        />
        <CarteMontant
          couleur={COULEURS.marge}
          icone={<PiggyBank />}
          titre="Ce qu’il vous reste"
          precision="après les ménages et vos dépenses"
          montant={s.marge}
          lignes={[
            ['Chiffre d’affaires', s.ca],
            ['Ménages payés aux prestataires', -s.coutMenage],
            ['Vos dépenses', -s.charges],
          ]}
          note={s.ca ? `Il vous reste ${pourcentage(s.marge / s.ca)} de ce que vous facturez.` : undefined}
        />
      </div>
      <p className="mb-6 text-[12.5px] text-(--lm-encre-3)">{libelle}. Un séjour à cheval sur deux mois est partagé nuit par nuit ; le ménage compte le jour du départ.</p>

      <details className="group mb-6">
        <summary className="mb-3 inline-flex cursor-pointer list-none items-center gap-1.5 text-[13.5px] font-medium text-(--lm-encre-2) hover:text-(--lm-or) [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 text-(--lm-or) transition-transform group-open:rotate-90" aria-hidden />
          Voir l’évolution mois par mois
        </summary>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader titre="Payé par les voyageurs, mois par mois" description={`L’argent des propriétaires, qui passe par vous. ${depuis}`} />
          <div className="h-60" role="img" aria-label="Histogramme mensuel du revenu brut géré">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={COULEURS.grille} />
                <XAxis dataKey="libelle" tick={AXE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={eurosAxe} tick={AXE} tickLine={false} axisLine={false} width={48} />
                <Tooltip content={<Infobulle />} cursor={{ fill: 'rgba(20,17,14,0.04)' }} />
                <Bar dataKey="brut" name="Payé par les voyageurs" fill={COULEURS.brut} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader titre="Ce que vous facturez et ce qu’il vous reste, mois par mois" description={depuis} />
          <div className="h-60" role="img" aria-label="Histogramme mensuel du chiffre d’affaires Label Maison et courbe de marge">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={COULEURS.grille} />
                <XAxis dataKey="libelle" tick={AXE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={eurosAxe} tick={AXE} tickLine={false} axisLine={false} width={48} />
                <Tooltip content={<Infobulle />} cursor={{ fill: 'rgba(20,17,14,0.04)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ca" name="Facturé" fill={COULEURS.ca} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line dataKey="marge" name="Il vous reste" stroke={COULEURS.marge} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: COULEURS.marge }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      </details>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" flush>
          <div className="p-4 pb-2 sm:p-5 sm:pb-2">
            <CardHeader
              titre="Ce que vous facturez, logement par logement"
              description={libelle}
              actions={<Link to="/erp/finance/rentabilite" className="text-[13px] font-medium text-(--lm-or) hover:underline">Voir la rentabilité</Link>}
            />
          </div>
          <ul className="divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
            {parLogement.length === 0 && <li className="px-5 py-8 text-center text-sm text-(--lm-encre-3)">Pas de séjour sur cette période.</li>}
            {parLogement.map((l) => {
              const ca = l.commission + l.fraisMenage;
              return (
                <li key={l.logementId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 sm:px-5">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{l.nom}</span>
                  {l.commissionPct !== undefined && l.commissionPct < COMMISSION_CIBLE_MIN && <Badge tone="alerte">Commission {nombre(l.commissionPct)} %</Badge>}
                  <span className="lm-chiffres w-28 text-right text-[12.5px] text-(--lm-encre-2)" title="Payé par les voyageurs">{euros(l.brut, true)} payés</span>
                  <span className="lm-chiffres w-24 text-right text-[13.5px] font-semibold">{euros(ca, true)}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader titre="Votre commission moyenne" description={`Objectif : ${COMMISSION_CIBLE_MIN} à ${COMMISSION_CIBLE_MAX} %.`} />
            <p className="lm-chiffres text-[28px] leading-none font-semibold">{pourcentage(s.tauxEffectif, 1)}</p>
            <ProgressBar className="mt-3" valeur={s.tauxEffectif / (COMMISSION_CIBLE_MAX / 100)} tone={tauxOk ? 'succes' : 'alerte'} label={tauxOk ? 'Dans l’objectif' : 'En dessous de l’objectif'} />
            {sousCible.length > 0 && (
              <p className="mt-3 text-[12.5px] text-(--lm-encre-2)">
                {nombre(sousCible.length)} contrat{sousCible.length > 1 ? 's' : ''} sous {COMMISSION_CIBLE_MIN} % (anciennes conditions), à revoir au renouvellement.{' '}
                <Link to="/erp/mandats" className="font-medium text-(--lm-or) hover:underline">Voir les contrats</Link>
              </p>
            )}
          </Card>
          <Card>
            <CardHeader titre="TVA à prévoir" description="Une estimation, à vérifier avec votre expert-comptable." actions={<Receipt className="size-4 text-(--lm-encre-3)" aria-hidden />} />
            <dl className="space-y-1.5 text-[13px]">
              <LigneTva libelle="Facturé hors taxes" valeur={euros(s.ca)} />
              <LigneTva libelle="dont commissions HT" valeur={euros(s.commission)} />
              <LigneTva libelle="TVA à reverser (20 % des commissions)" valeur={euros(tva)} fort />
            </dl>
            <p className="mt-2 text-[12px] text-(--lm-encre-3)">La TVA sur les frais de ménage reste à confirmer avec le comptable.</p>
          </Card>
        </div>
      </div>

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
