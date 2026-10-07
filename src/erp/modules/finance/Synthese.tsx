import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronRight, Landmark, PiggyBank, Wallet } from 'lucide-react';
import { useErp } from '../../data/store';
import { AUJOURDHUI, euros, moisAnnee, nombre, pourcentage } from '../../data/format';
import { COMMISSION_CIBLE_MAX, COMMISSION_CIBLE_MIN } from '../../data/constantes';
import { fenetreMois } from '../../data/selectors';
import { Aide, Badge, Card, CardHeader, FilterChips, PageHeader, ProgressBar } from '../../ui';
import { fenetre12Mois, fenetrePeriode, derniersMois, rentabiliteParLogement, serieMensuelle, synthese } from './_calculs';
import { AXE, COULEURS, eurosAxe, Infobulle } from './_composants/graphiques';
import { CarteMontant } from './_composants/CarteMontant';
import { FinanceVide, financeSansActivite } from './_composants/FinanceVide';
import type { PageFinanceProps } from './_composants/types';

type Periode = 'mois' | 'precedent' | 'annee';

export default function Synthese({ onglets }: PageFinanceProps) {
  const d = useErp();
  const vide = financeSansActivite(d);
  return (
    <>
      <PageHeader titre="Finance" />
      {onglets}
      {vide ? <FinanceVide /> : <Contenu />}
    </>
  );
}

function Contenu() {
  const d = useErp();
  const [periode, setPeriode] = useState<Periode>('mois');
  const mois = derniersMois(2);
  const fenetre = useMemo(
    () => (periode === 'mois' ? fenetreMois(AUJOURDHUI) : periode === 'precedent' ? fenetrePeriode(derniersMois(2)[0]) : fenetre12Mois()),
    [periode],
  );

  const s = useMemo(() => synthese(d, fenetre), [d, fenetre]);
  const serie = useMemo(() => {
    const toute = serieMensuelle(d);
    // Pas de mois vides avant le premier séjour géré (6 mois affichés au minimum).
    const premier = toute.findIndex((m) => m.brut > 0);
    return toute.slice(Math.max(0, Math.min(premier < 0 ? 0 : premier, toute.length - 6)));
  }, [d]);
  const parLogement = useMemo(
    () => rentabiliteParLogement(d, fenetre).filter((l) => l.brut > 0).sort((a, b) => b.commission + b.fraisMenage - (a.commission + a.fraisMenage)),
    [d, fenetre],
  );
  const sousCible = d.mandats.filter((m) => m.statut === 'signe' && m.commissionPct < COMMISSION_CIBLE_MIN);
  const tauxOk = s.tauxEffectif * 100 >= COMMISSION_CIBLE_MIN;
  const tva = Math.round(s.commission * 0.2);

  return (
    <>
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

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <CarteMontant
          couleur={COULEURS.brut}
          icone={<Landmark />}
          titre="Payé par les voyageurs"
          montant={s.brut}
          note="Ménage compris. La plus grande partie est reversée aux propriétaires."
        />
        <CarteMontant
          couleur={COULEURS.ca}
          icone={<Wallet />}
          titre="Ce que vous facturez"
          montant={s.ca}
          lignes={[
            ['Commissions de gestion', s.commission],
            ['Frais de ménage encaissés', s.fraisMenage],
          ]}
          note={`${s.brut ? `Soit ${pourcentage(s.ca / s.brut, 1)} de ce qu’ont payé les voyageurs. ` : ''}TVA à prévoir : ${euros(tva, true)} (20 % des commissions).`}
          accent
        />
        <CarteMontant
          couleur={COULEURS.marge}
          icone={<PiggyBank />}
          titre="Ce qu’il vous reste"
          montant={s.marge}
          lignes={[
            ['Chiffre d’affaires', s.ca],
            ['Ménages payés aux prestataires', -s.coutMenage],
            ['Vos dépenses', -s.charges],
          ]}
          note={s.ca ? `Il vous reste ${pourcentage(s.marge / s.ca)} de ce que vous facturez.` : undefined}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" flush>
          <div className="p-4 pb-2 sm:p-5 sm:pb-2">
            <CardHeader
              titre="Par logement"
              actions={<Link to="/erp/finance/rentabilite" className="text-[13px] font-medium text-(--lm-or-texte) hover:underline">Rentabilité</Link>}
            />
          </div>
          <ul className="divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
            {parLogement.length === 0 && <li className="px-5 py-8 text-center text-sm text-(--lm-encre-3)">Pas de séjour sur cette période.</li>}
            {parLogement.map((l) => (
              <li key={l.logementId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 sm:px-5">
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{l.nom}</span>
                {l.commissionPct !== undefined && l.commissionPct < COMMISSION_CIBLE_MIN && <Badge tone="alerte">Commission {nombre(l.commissionPct)} %</Badge>}
                <span className="lm-chiffres w-24 text-right text-[13.5px] font-semibold">{euros(l.commission + l.fraisMenage, true)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="self-start">
          <CardHeader titre="Votre commission moyenne" />
          <p className="lm-chiffres text-[28px] leading-none font-semibold">{pourcentage(s.tauxEffectif, 1)}</p>
          <ProgressBar className="mt-3" valeur={s.tauxEffectif / (COMMISSION_CIBLE_MAX / 100)} tone={tauxOk ? 'succes' : 'alerte'} label={tauxOk ? 'Dans l’objectif' : 'En dessous de l’objectif'} />
          {sousCible.length > 0 && (
            <Link to="/erp/mandats" className="mt-3 inline-block text-[12.5px] font-medium text-(--lm-or-texte) hover:underline">
              {nombre(sousCible.length)} contrat{sousCible.length > 1 ? 's' : ''} à revoir
            </Link>
          )}
        </Card>
      </div>

      <details className="group mb-6">
        <summary className="mb-3 inline-flex cursor-pointer list-none items-center gap-1.5 text-[13.5px] font-medium text-(--lm-encre-2) hover:text-(--lm-or-texte) [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 text-(--lm-or-texte) transition-transform group-open:rotate-90" aria-hidden />
          Voir l’évolution mois par mois
        </summary>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader titre="Payé par les voyageurs" />
            <div className="h-60" role="img" aria-label="Histogramme mensuel de ce qu’ont payé les voyageurs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={COULEURS.grille} />
                  <XAxis dataKey="libelle" tick={AXE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tickFormatter={eurosAxe} tick={AXE} tickLine={false} axisLine={false} width={48} />
                  <Tooltip content={<Infobulle />} cursor={{ fill: 'rgba(20,17,14,0.04)' }} />
                  <Bar dataKey="brut" name="Payé par les voyageurs" fill={COULEURS.brut} radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <CardHeader titre="Facturé et ce qu’il vous reste" />
            <div className="h-60" role="img" aria-label="Histogramme mensuel de ce que vous facturez et courbe de ce qu’il vous reste">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={serie} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={COULEURS.grille} />
                  <XAxis dataKey="libelle" tick={AXE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tickFormatter={eurosAxe} tick={AXE} tickLine={false} axisLine={false} width={48} />
                  <Tooltip content={<Infobulle />} cursor={{ fill: 'rgba(20,17,14,0.04)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="ca" name="Facturé" fill={COULEURS.ca} radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Line type="monotone" dataKey="marge" name="Il vous reste" stroke={COULEURS.marge} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: COULEURS.marge }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </details>

      <Aide titre="Comment lire ces chiffres ?">
        <p>
          « Payé par les voyageurs » appartient surtout aux propriétaires : cet argent passe par vous, mais ce n’est pas votre chiffre d’affaires. Ce que vous
          facturez, ce sont vos commissions (calculées sur le prix du séjour, sans la part de la plateforme ni le ménage) et les frais de ménage. Ce qu’il vous
          reste, c’est ce montant moins le coût des ménages et vos dépenses.
        </p>
        <p className="mt-2">
          Un séjour à cheval sur deux mois est partagé nuit par nuit ; le ménage compte le jour du départ. Objectif de commission : {COMMISSION_CIBLE_MIN} à{' '}
          {COMMISSION_CIBLE_MAX} %. La TVA est une estimation (20 % des commissions) : vérifiez-la avec votre expert-comptable, notamment pour les frais de ménage.
        </p>
      </Aide>
    </>
  );
}
