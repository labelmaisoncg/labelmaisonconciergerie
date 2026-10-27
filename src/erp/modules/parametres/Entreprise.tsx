import { Building2 } from 'lucide-react';
import { espaceOuvert, estLabelMaison } from '../../data/espaces';
import { nomConciergerie } from '../../data/marque-espace';
import { Card, CardHeader } from '../../ui';
import { ENTREPRISE } from '../finance/_composants/entreprise';

export default function Entreprise() {
  const espace = espaceOuvert();
  // Identité légale de Label Maison : dans son espace seulement (jamais celle d'une autre conciergerie).
  const labelMaison = estLabelMaison(espace);
  const lignes: [string, string][] = labelMaison
    ? [
        ['Dénomination', ENTREPRISE.raisonSociale],
        ['Forme juridique', `${ENTREPRISE.forme} (société par actions simplifiée unipersonnelle)`],
        ['SIRET', ENTREPRISE.siret],
        ['Siège', `${ENTREPRISE.adresse}, ${ENTREPRISE.ville}`],
        ['Site', ENTREPRISE.site],
      ]
    : [['Nom', nomConciergerie(espace) || 'Votre conciergerie']];
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
      {!labelMaison && (
        <p className="mt-2 text-[12.5px] text-(--lm-encre-2)">Raison sociale, SIRET et siège ne se règlent pas encore ici : vos documents officiels restent les vôtres.</p>
      )}
    </Card>
  );
}
