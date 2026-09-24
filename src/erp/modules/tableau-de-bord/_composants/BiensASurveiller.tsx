import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import type { Recommandation } from '../../../analyse';
import { euros } from '../../../data/format';
import { Card, CardHeader, EmptyState } from '../../../ui';
import { BadgeRecommandation, useAnalyseParc } from '../../performance/_composants/commun';

const ORDRE: Partial<Record<Recommandation, number>> = { sortir: 0, renegocier: 1, surveiller: 2 };

/** Biens dont l'analyse demande une décision : sortir, renégocier ou surveiller. */
export function BiensASurveiller() {
  const { lignes } = useAnalyseParc();
  const liste = lignes
    .filter((l) => ORDRE[l.analyse.recommandation] !== undefined)
    .sort((a, b) => ORDRE[a.analyse.recommandation]! - ORDRE[b.analyse.recommandation]! || a.score - b.score);
  const rentables = lignes.filter((l) => l.analyse.rentable).length;

  return (
    <Card flush className="h-full">
      <CardHeader
        className="mb-0 border-b border-(--lm-bord) px-4 pt-4 pb-3"
        titre="Biens à surveiller"
        description={`${rentables} bien${rentables > 1 ? 's' : ''} rentable${rentables > 1 ? 's' : ''} sur ${lignes.length}. Analyse sur 90 jours.`}
        actions={
          <Link to="/erp/performance" className="text-[12.5px] font-medium text-(--lm-or) hover:underline">
            Performance des biens
          </Link>
        }
      />
      {liste.length ? (
        <ul className="divide-y divide-(--lm-bord)">
          {liste.map(({ analyse: a }) => (
            <li key={a.logement.id}>
              <Link
                to={`/erp/logements/${a.logement.id}?onglet=performance`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-(--lm-surface-2) focus-visible:bg-(--lm-surface-2)"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-(--lm-encre)">{a.logement.nom}</span>
                    <BadgeRecommandation valeur={a.recommandation} />
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-(--lm-encre-2)">
                    <span className="lm-chiffres">{euros(a.margeMois, true)}</span> de marge / mois · {a.defauts.length} défaut{a.defauts.length > 1 ? 's' : ''}
                  </p>
                  {a.justification[0] && <p className="mt-0.5 truncate text-[12px] text-(--lm-encre-3)" title={a.justification[0]}>{a.justification[0]}</p>}
                </div>
                <ChevronRight className="mt-1 size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="m-4" icone={<CheckCircle2 />} titre="Aucun bien à risque" description="Tous les biens actifs sont à garder ou à développer." />
      )}
    </Card>
  );
}
