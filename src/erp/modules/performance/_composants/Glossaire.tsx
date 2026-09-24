import { SEUILS, type CleKpi } from '../../../analyse';
import { Card } from '../../../ui';
import { BadgeNiveau } from './commun';

/** « Comprendre les indicateurs » : chaque KPI, ce qu'il mesure et ses seuils. */
export function Glossaire() {
  return (
    <>
      <p className="mb-4 max-w-3xl text-[13.5px] text-(--lm-encre-2)">
        Chaque indicateur est calculé depuis les données de l’ERP (réservations, mandats, missions, incidents, charges, messagerie), jamais saisi à la
        main. Les seuils ci-dessous colorent les valeurs partout dans l’ERP : vert bon, ambre correct, rouge faible.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(SEUILS) as CleKpi[]).map((cle) => {
          const s = SEUILS[cle];
          return (
            <Card key={cle} className="flex flex-col gap-2">
              <h3 className="text-[14.5px] font-semibold text-(--lm-encre)">{s.libelle}</h3>
              <p className="text-[13px] text-(--lm-encre-2)">{s.description}</p>
              <p className="text-[12.5px] text-(--lm-encre-3)">{s.pourquoi}</p>
              <dl className="mt-1 grid gap-1.5 text-[12.5px]">
                {(['bon', 'correct', 'faible'] as const).map((n) => (
                  <div key={n} className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-start gap-2">
                    <dt>
                      <BadgeNiveau niveau={n} />
                    </dt>
                    <dd className="text-(--lm-encre)">{s.lecture[n]}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          );
        })}
        <Card className="flex flex-col gap-2 md:col-span-2 xl:col-span-3">
          <h3 className="text-[14.5px] font-semibold text-(--lm-encre)">Verdict et score</h3>
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-(--lm-encre-2)">
            <li><strong>Sortir</strong> : conformité bloquante (n° d’enregistrement manquant, DPE G), ou 3 mois de suite de marge négative avec une note sous 4,5.</li>
            <li><strong>Renégocier</strong> : marge fragile (moins de 250 € par mois ou 35 % du CA) alors que la commission est sous 18 % ou que les frais de ménage ne couvrent pas le ménage.</li>
            <li><strong>Développer</strong> : rentable, note 4,8 ou plus, occupation 70 % ou plus, aucun défaut grave.</li>
            <li><strong>Surveiller</strong> : non rentable, ou un défaut grave, ou deux défauts moyens. <strong>Garder</strong> : tout le reste.</li>
            <li>Score 0-100 : marge 35 %, occupation 20 %, note 20 %, charge opérationnelle 15 %, conformité 10 %.</li>
            <li>La marge inclut une quote-part des frais de structure (logiciels, assurance, produits, carburant) répartie à parts égales entre biens actifs.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
