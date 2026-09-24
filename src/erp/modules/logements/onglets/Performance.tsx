import { Link } from 'react-router-dom';
import { CheckCircle2, CircleAlert, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { SEUILS } from '../../../analyse';
import { dateCourte, euros } from '../../../data/format';
import { useErp } from '../../../data/store';
import type { Logement } from '../../../data/types';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, TON_LAVIS, cn } from '../../../ui';
import { Aide, BadgeNiveau, BadgeRecommandation, BadgeStatutReco, useAnalyseBien } from '../../performance/_composants/commun';
import { GraphiqueMarge } from '../../performance/_composants/GraphiqueMarge';
import { depuisAmelioration, LIBELLE_COUT, LIBELLE_PORTEUR } from '../../performance/_composants/suivi';

const TON_GRAVITE = { haute: 'danger', moyenne: 'alerte', faible: 'neutre' } as const;
const LIBELLE_GRAVITE = { haute: 'Grave', moyenne: 'Moyen', faible: 'Mineur' } as const;

/** Onglet « Performance » d'un logement : verdict, KPI interprétés, défauts, améliorations suivies. */
export function OngletPerformance({ logement }: { logement: Logement }) {
  const { recommandations, upsert } = useErp();
  const a = useAnalyseBien(logement.id);
  if (!a) return null;
  const suivies = recommandations.filter((r) => r.logementId === logement.id);
  const f = a.f90;
  const lignesCompte: [string, number][] = [
    ['Commission Label Maison', f.commission],
    ['Frais de ménage encaissés', f.fraisMenage],
    ['Ménages payés aux prestataires', -f.coutMenage],
    ['Charges affectées au bien', -f.charges],
    ['Incidents à la charge de Label Maison', -f.coutIncidents],
    ['Quote-part des frais de structure', -f.structure],
  ];

  return (
    <div className="grid grid-cols-1 gap-5">
      {logement.statut !== 'actif' && (
        <Alert tone="info">Ce logement n’est pas actif : l’analyse porte sur la période où il était sous mandat, s’il y en a une.</Alert>
      )}

      <Card className={cn('border-l-[3px]', a.rentable ? 'border-l-(--lm-succes)' : 'border-l-(--lm-danger)')}>
        <div className="flex flex-wrap items-start gap-4">
          <span aria-hidden className={cn('grid size-11 shrink-0 place-items-center rounded-xl [&_svg]:size-5', TON_LAVIS[a.rentable ? 'succes' : 'danger'])}>
            {a.rentable ? <TrendingUp /> : <TrendingDown />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-semibold text-(--lm-encre)">{a.verdictRentabilite}</h2>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-(--lm-encre-2)">
              Recommandation : <BadgeRecommandation valeur={a.recommandation} />
              {a.score !== undefined && <span>Score {a.score}/100</span>}
              {a.margeParNuit !== undefined && <span className="lm-chiffres">{euros(a.margeParNuit)} de marge par nuit vendue</span>}
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[13.5px] text-(--lm-encre)">
              {a.justification.map((j) => (
                <li key={j}>{j}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <section aria-labelledby="kpi-bien">
        <h2 id="kpi-bien" className="mb-3 text-[16px] font-semibold text-(--lm-encre)">Indicateurs du bien</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {a.kpis.map((k) => (
            <Card key={k.cle} className="flex flex-col gap-1 p-4 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="inline-flex items-center gap-1 text-[12.5px] font-medium text-(--lm-encre-2)">
                  {k.libelle}
                  <Aide texte={`${SEUILS[k.cle].description} Bon : ${SEUILS[k.cle].lecture.bon}`} />
                </p>
                {k.niveau && <BadgeNiveau niveau={k.niveau} />}
              </div>
              <p className="lm-chiffres text-[22px] leading-tight font-semibold text-(--lm-encre)">{k.affichage}</p>
              {k.detail && <p className="text-[12px] text-(--lm-encre-3)">{k.detail}</p>}
              {k.niveau && <p className="text-[12.5px] text-(--lm-encre-2)">{SEUILS[k.cle].lecture[k.niveau]}</p>}
            </Card>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader titre="Marge Label Maison, 12 mois" description="Mois sans mandat ni données masqués ; le mois en cours est estompé." />
          <GraphiqueMarge mois={a.mois} />
        </Card>
        <Card>
          <CardHeader titre="Compte du bien, 90 jours" description={`${f.jours} jours sous mandat, ${f.nuits} nuits vendues, ${f.sejours} départs.`} />
          <dl className="divide-y divide-(--lm-bord) text-[13.5px]">
            {lignesCompte.map(([libelle, v]) => (
              <div key={libelle} className="flex justify-between gap-3 py-1.5">
                <dt className="text-(--lm-encre-2)">{libelle}</dt>
                <dd className={cn('lm-chiffres', v < 0 && 'text-(--lm-danger)')}>{euros(v, true)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 py-2 font-semibold">
              <dt>Marge Label Maison</dt>
              <dd className={cn('lm-chiffres', f.marge < 0 ? 'text-(--lm-danger)' : 'text-(--lm-succes)')}>{euros(f.marge, true)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[12px] text-(--lm-encre-3)">Revenu brut géré sur la période : {euros(f.revenuBrut, true)}.</p>
        </Card>
      </div>

      <Card flush>
        <CardHeader className="mb-0 border-b border-(--lm-bord) px-4 pt-4 pb-3" titre="Défauts détectés" description="Repérés automatiquement dans les réservations, avis, incidents, linge, mandat et conformité." />
        {a.defauts.length ? (
          <ul className="divide-y divide-(--lm-bord)">
            {a.defauts.map((x) => (
              <li key={x.code} className="flex items-start gap-3 px-4 py-3">
                <CircleAlert aria-hidden className={cn('mt-0.5 size-4 shrink-0', x.gravite === 'haute' ? 'text-(--lm-danger)' : x.gravite === 'moyenne' ? 'text-(--lm-alerte)' : 'text-(--lm-encre-3)')} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-(--lm-encre)">{x.titre}</p>
                  <p className="text-[13px] text-(--lm-encre-2)">{x.detail}</p>
                </div>
                <Badge tone={TON_GRAVITE[x.gravite]}>{LIBELLE_GRAVITE[x.gravite]}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState className="m-4" icone={<CheckCircle2 />} titre="Aucun défaut détecté" description="Rien à signaler sur ce bien pour l’instant." />
        )}
      </Card>

      <Card flush>
        <CardHeader
          className="mb-0 border-b border-(--lm-bord) px-4 pt-4 pb-3"
          titre="Améliorations à suggérer"
          description="Ajoutez-les au suivi pour tracer la proposition, la décision du propriétaire et le résultat."
          actions={<Link to="/erp/performance?onglet=suivi" className="text-[12.5px] font-medium text-(--lm-or) hover:underline">Suivi des recommandations</Link>}
        />
        {a.ameliorations.length ? (
          <ul className="divide-y divide-(--lm-bord)">
            {a.ameliorations.map((x) => {
              const suivie = suivies.find((r) => r.code === x.code);
              return (
                <li key={x.code} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-(--lm-encre)">{x.titre}</p>
                    <p className="text-[13px] text-(--lm-encre-2)">{x.pourquoi}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone="succes">{x.impactEstime.texte}</Badge>
                      <Badge>{LIBELLE_COUT[x.cout]}</Badge>
                      <Badge tone={x.porteur === 'proprietaire' ? 'neutre' : 'or'}>{LIBELLE_PORTEUR[x.porteur]}</Badge>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {suivie ? (
                      <BadgeStatutReco valeur={suivie.statut} />
                    ) : (
                      <Button size="sm" icone={<Plus />} onClick={() => upsert('recommandations', depuisAmelioration(x, a))}>
                        Ajouter au suivi
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState className="m-4" icone={<CheckCircle2 />} titre="Aucune amélioration suggérée" description="Le bien ne présente pas de défaut qui appelle une action." />
        )}
      </Card>

      {suivies.length > 0 && (
        <Card flush>
          <CardHeader className="mb-0 border-b border-(--lm-bord) px-4 pt-4 pb-3" titre="Historique des recommandations" description={`${suivies.length} suivie${suivies.length > 1 ? 's' : ''} pour ce bien.`} />
          <ul className="divide-y divide-(--lm-bord)">
            {suivies.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-(--lm-encre)">{r.titre}</p>
                  <p className="text-[12px] text-(--lm-encre-3)">
                    Créée le {dateCourte(r.creeLe)}
                    {r.proposeeLe && `, proposée le ${dateCourte(r.proposeeLe)}`}
                    {r.decideeLe && `, décidée le ${dateCourte(r.decideeLe)}`}
                    {r.realiseeLe && `, réalisée le ${dateCourte(r.realiseeLe)}`}
                    {r.coutCentimes !== undefined && ` · coût ${euros(r.coutCentimes, true)}`}
                  </p>
                  {r.resultatObserve && <p className="mt-1 text-[13px] text-(--lm-encre-2)">{r.resultatObserve}</p>}
                </div>
                <BadgeStatutReco valeur={r.statut} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
