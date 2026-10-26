import { Building2 } from 'lucide-react';
import { Card, CardHeader } from '../../ui';
import { ENTREPRISE } from '../finance/_composants/entreprise';

export default function Entreprise() {
  const lignes: [string, string][] = [
    ['Dénomination', ENTREPRISE.raisonSociale],
    ['Forme juridique', `${ENTREPRISE.forme} (société par actions simplifiée unipersonnelle)`],
    ['SIRET', ENTREPRISE.siret],
    ['Siège', `${ENTREPRISE.adresse}, ${ENTREPRISE.ville}`],
    ['Site', ENTREPRISE.site],
  ];
  return (
    <Card>
      <CardHeader titre="Identité" actions={<Building2 className="size-4 text-(--lm-encre-3)" aria-hidden />} />
      <dl className="divide-y divide-(--lm-bord) text-[13.5px]">
        {lignes.map(([l, v]) => (
          <div key={l} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-2 sm:grid-cols-[160px_minmax(0,1fr)]">
            <dt className="text-(--lm-encre-2)">{l}</dt>
            <dd className="lm-chiffres font-medium break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
