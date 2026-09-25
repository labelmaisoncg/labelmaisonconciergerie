import { Building2, Percent } from 'lucide-react';
import { useErp } from '../../data/store';
import { nombre, pluriel } from '../../data/format';
import { COMMISSION_CIBLE_MAX, COMMISSION_CIBLE_MIN } from '../../data/constantes';
import { Card, CardHeader } from '../../ui';
import { ENTREPRISE } from '../finance/_composants/entreprise';

export default function Entreprise() {
  const { mandats } = useErp();
  const signes = mandats.filter((m) => m.statut === 'signe');
  const anciens = signes.filter((m) => m.commissionPct < COMMISSION_CIBLE_MIN);
  const lignes: [string, string][] = [
    ['Dénomination', ENTREPRISE.raisonSociale],
    ['Forme juridique', `${ENTREPRISE.forme} (société par actions simplifiée unipersonnelle)`],
    ['SIRET', ENTREPRISE.siret],
    ['Siège', `${ENTREPRISE.adresse}, ${ENTREPRISE.ville}`],
    ['Site', ENTREPRISE.site],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader titre="Identité" description="Les informations qui apparaissent sur vos contrats, factures et relevés." actions={<Building2 className="size-4 text-(--lm-encre-3)" aria-hidden />} />
        <dl className="divide-y divide-(--lm-bord) text-[13.5px]">
          {lignes.map(([l, v]) => (
            <div key={l} className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 py-2">
              <dt className="text-(--lm-encre-2)">{l}</dt>
              <dd className="lm-chiffres font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[12.5px] text-(--lm-encre-2)">Jamais « micro-entreprise » dans les documents : la société est une SASU.</p>
      </Card>
      <Card>
        <CardHeader titre="Conditions commerciales" actions={<Percent className="size-4 text-(--lm-encre-3)" aria-hidden />} />
        <p className="lm-chiffres text-[28px] leading-none font-semibold">
          {COMMISSION_CIBLE_MIN} à {COMMISSION_CIBLE_MAX} %
        </p>
        <p className="mt-1 text-[13px] text-(--lm-encre-2)">Commission cible des nouveaux mandats, plus frais de ménage facturés à chaque séjour.</p>
        <p className="mt-4 text-[13px]">
          {anciens.length
            ? `${pluriel(anciens.length, 'mandat signé', 'mandats signés')} sur ${nombre(signes.length)} encore aux anciennes conditions (${[...new Set(anciens.map((m) => `${nombre(m.commissionPct)} %`))].join(', ')}) : migration à proposer au renouvellement.`
            : 'Tous les mandats signés sont dans la cible.'}
        </p>
      </Card>
    </div>
  );
}
