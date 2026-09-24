import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, UserPlus } from 'lucide-react';
import { euros, nombre } from '../../data/format';
import { LIBELLES } from '../../data/libelles';
import { COMMISSION_CIBLE_MIN } from '../../data/constantes';
import type { TypeLogement } from '../../data/types';
import { Alert, Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select, cn } from '../../ui';
import { useAvis } from './_composants/Avis';
import { NouveauProspect } from './_composants/NouveauProspect';
import { Onglets } from './_composants/Onglets';
import { PARAMETRES_DEFAUT, TAUX_COMPARES, simuler, type ParametresSimulation } from './_composants/simulation';

type CleNum = Exclude<keyof ParametresSimulation, 'ville' | 'type'>;

const CHAMPS: { cle: CleNum; label: string; aide?: string; min: number; max: number; pas?: number }[] = [
  { cle: 'capacite', label: 'Capacité (personnes)', min: 1, max: 20 },
  { cle: 'prixNuitEuros', label: 'Prix moyen par nuit (€)', min: 1, max: 2000 },
  { cle: 'occupationPct', label: 'Taux d’occupation (%)', aide: 'Essonne : 55 à 75 % selon la saison.', min: 0, max: 100 },
  { cle: 'plateformePct', label: 'Frais plateforme (%)', aide: 'Frais de service hôte (Airbnb environ 15 %).', min: 0, max: 30, pas: 0.5 },
  { cle: 'dureeSejourNuits', label: 'Durée moyenne de séjour (nuits)', min: 1, max: 30, pas: 0.5 },
  { cle: 'fraisMenageEuros', label: 'Frais de ménage par séjour (€)', aide: 'Payés par le voyageur, en plus du prix des nuits.', min: 0, max: 300 },
];

function Ligne({ libelle, valeur, fort, signe }: { libelle: string; valeur: number; fort?: boolean; signe?: '-' }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-2', fort && 'border-t border-(--lm-bord-fort) pt-3')}>
      <dt className={cn('text-[13.5px]', fort ? 'font-semibold text-(--lm-encre)' : 'text-(--lm-encre-2)')}>{libelle}</dt>
      <dd className={cn('lm-chiffres', fort ? 'text-[20px] font-semibold text-(--lm-encre)' : 'text-[14px] text-(--lm-encre)')}>
        {signe}{signe && ' '}{euros(valeur, true)}
      </dd>
    </div>
  );
}

export default function Simulateur() {
  const naviguer = useNavigate();
  const { afficher, rendu } = useAvis();
  const [p, setP] = useState<ParametresSimulation>(PARAMETRES_DEFAUT);
  const [creation, setCreation] = useState(false);
  const r = useMemo(() => simuler(p), [p]);
  const invalide = p.prixNuitEuros <= 0 || p.occupationPct <= 0 || p.occupationPct > 100;

  const maj = (cle: CleNum, v: string) => setP((x) => ({ ...x, [cle]: v === '' ? 0 : Number(v) }));

  return (
    <>
      <PageHeader
        fil={[{ libelle: 'Commercial', to: '/erp/commercial' }, { libelle: 'Simulateur' }]}
        titre="Simulateur de revenus"
        sousTitre="À faire tourner avec le propriétaire : ce que son bien peut rapporter, et ce qu’il touche net."
        actions={<Button variant="primary" icone={<UserPlus />} disabled={invalide} onClick={() => setCreation(true)}>Créer un prospect</Button>}
      />
      <Onglets />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader titre="Le bien" description="Hypothèses annuelles." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ville">
              <Input value={p.ville} onChange={(e) => setP((x) => ({ ...x, ville: e.target.value }))} />
            </Field>
            <Field label="Type de logement">
              <Select value={p.type} onChange={(e) => setP((x) => ({ ...x, type: e.target.value as TypeLogement }))}
                options={(Object.keys(LIBELLES.typeLogement) as TypeLogement[]).map((t) => ({ valeur: t, libelle: LIBELLES.typeLogement[t] }))} />
            </Field>
            {CHAMPS.map((c) => (
              <Field key={c.cle} label={c.label} aide={c.aide}
                erreur={(c.cle === 'prixNuitEuros' && p.prixNuitEuros <= 0) || (c.cle === 'occupationPct' && (p.occupationPct <= 0 || p.occupationPct > 100)) ? 'Valeur à renseigner.' : undefined}>
                <Input type="number" inputMode="decimal" min={c.min} max={c.max} step={c.pas ?? 1} value={p[c.cle] || ''} onChange={(e) => maj(c.cle, e.target.value)} className="lm-chiffres" />
              </Field>
            ))}
            <Field label="Commission Label Maison (%)" aide="Cible 18 à 20 % pour tout nouveau mandat." className="sm:col-span-2">
              <Select value={String(p.commissionPct)} onChange={(e) => setP((x) => ({ ...x, commissionPct: Number(e.target.value) }))}
                options={[10, 15, 18, 19, 20, 22, 25].map((t) => ({ valeur: String(t), libelle: `${t} %${t === 10 ? ' (ancien barème)' : t === 18 || t === 20 ? ' (cible)' : ''}` }))} />
            </Field>
          </div>
          {p.commissionPct < COMMISSION_CIBLE_MIN && (
            <Alert tone="alerte" className="mt-4" titre="Sous la commission cible">
              Les nouveaux mandats se signent entre 18 et 20 %. Le 10 % est réservé aux anciens mandats, migrés au renouvellement.
            </Alert>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              titre={<span className="inline-flex items-center gap-2"><Calculator className="size-4 text-(--lm-or)" aria-hidden />Estimation annuelle</span>}
              description={`${LIBELLES.typeLogement[p.type]} à ${p.ville || 'ville à préciser'}, ${p.capacite} pers. · ${nombre(r.nuits)} nuits louées, environ ${nombre(r.sejours)} séjours.`}
              actions={<Badge tone="or">{p.commissionPct} %</Badge>}
            />
            <dl>
              <Ligne libelle="Revenu brut des nuitées" valeur={r.revenuBrut} />
              <Ligne libelle={`Frais plateforme (${nombre(p.plateformePct, p.plateformePct % 1 ? 1 : 0)} %)`} valeur={r.fraisPlateforme} signe="-" />
              <Ligne libelle={`Commission Label Maison (${p.commissionPct} %)`} valeur={r.commission} signe="-" />
              <Ligne libelle="Net propriétaire par an" valeur={r.netProprietaire} fort />
            </dl>
            <p className="mt-2 text-[12.5px] text-(--lm-encre-2)">
              Soit <span className="lm-chiffres font-medium text-(--lm-encre)">{euros(Math.round(r.netProprietaire / 12), true)}</span> par mois en moyenne.
              Les frais de ménage ({euros(r.fraisMenageVoyageurs, true)} par an) sont payés par les voyageurs et couvrent le ménage professionnel.
            </p>
          </Card>

          <Card flush>
            <CardHeader className="mb-0 px-4 pt-4 pb-3" titre="Comparer les commissions" description="Même bien, trois barèmes Label Maison." />
            <div className="lm-defilement overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <caption className="sr-only">Comparaison des commissions à 10, 18 et 20 %</caption>
                <thead>
                  <tr className="border-y border-(--lm-bord) bg-(--lm-surface-2) text-[12px] text-(--lm-encre-2)">
                    <th scope="col" className="px-4 py-2 text-left font-medium">Barème</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Commission / an</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Net propriétaire / an</th>
                  </tr>
                </thead>
                <tbody>
                  {TAUX_COMPARES.map((t) => {
                    const s = simuler(p, t);
                    return (
                      <tr key={t} className={cn('border-b border-(--lm-bord) last:border-b-0', t === p.commissionPct && 'bg-(--lm-or-lavis)')}>
                        <th scope="row" className="px-4 py-2.5 text-left font-medium text-(--lm-encre)">
                          {t} % <span className="font-normal text-(--lm-encre-3)">{t === 10 ? 'ancien barème' : 'cible'}</span>
                        </th>
                        <td className="lm-chiffres px-4 py-2.5 text-right">{euros(s.commission, true)}</td>
                        <td className="lm-chiffres px-4 py-2.5 text-right font-semibold">{euros(s.netProprietaire, true)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <NouveauProspect
        ouvert={creation}
        onFermer={() => setCreation(false)}
        initial={{
          ville: p.ville,
          typeBien: `${LIBELLES.typeLogement[p.type]} ${p.capacite} pers.`,
          revenuEstimeAnnuelCentimes: r.base,
          etape: 'contact',
          prochaineAction: 'Envoyer l’estimation de revenus',
          notes: `Simulation : ${euros(p.prixNuitEuros * 100, true)} la nuit, ${p.occupationPct} % d’occupation, commission ${p.commissionPct} %. Net propriétaire estimé ${euros(r.netProprietaire, true)} par an.`,
        }}
        onCree={(x) => {
          setCreation(false);
          afficher({
            ton: 'succes',
            texte: `${x.nom} ajouté au pipeline avec cette estimation.`,
            action: <button type="button" className="text-[12.5px] font-medium text-(--lm-or) hover:underline" onClick={() => naviguer(`/erp/commercial?prospect=${x.id}`)}>Voir</button>,
          });
        }}
      />
      {rendu}
    </>
  );
}
