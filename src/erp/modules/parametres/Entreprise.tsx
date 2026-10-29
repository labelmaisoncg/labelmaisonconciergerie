/**
 * Paramètres → Société : l'identité légale de la conciergerie de l'espace
 * (raison sociale, forme, SIRET, adresse du siège, régime de TVA, mentions),
 * imprimée sur ses factures mensuelles et en tête de ses bilans. Le gérant
 * la modifie ; les autres la lisent.
 *
 * Label Maison garde par défaut son identité d'avant (franchise en base de
 * TVA) ; un autre espace ne voit jamais celle de Label Maison
 * (data/identite-conciergerie.ts).
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { espaceOuvert, type Espace } from '../../data/espaces';
import { horodatageMaintenant } from '../../data/format';
import {
  MENTION_FRANCHISE_TVA,
  REGIMES_TVA,
  type ChampIdentite,
  erreursIdentite,
  formaterSiret,
  identiteConciergerie,
  normaliserIdentite,
  reglageSociete,
} from '../../data/identite-conciergerie';
import { nomConciergerie } from '../../data/marque-espace';
import { useErp } from '../../data/store';
import type { IdentiteSociete, RegimeTva } from '../../data/types';
import { Button, Card, CardHeader, Field, Input, Segmente, Textarea } from '../../ui';

type Saisie = Omit<IdentiteSociete, 'tvaPct'> & { tvaPct: string };

const versSaisie = (i: IdentiteSociete): Saisie => ({ ...i, tvaPct: String(i.tvaPct).replace('.', ','), numeroTva: i.numeroTva ?? '', mentions: i.mentions ?? '' });
const depuisSaisie = (s: Saisie): IdentiteSociete => normaliserIdentite({ ...s, tvaPct: Number(s.tvaPct.replace(',', '.')) });

export default function Entreprise() {
  const d = useErp();
  const espace = espaceOuvert();
  const gerant = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  const identite = useMemo(() => identiteConciergerie({ reglages: d.donnees.reglages }, espace), [d.donnees.reglages, espace]);
  return gerant ? <Formulaire identite={identite} espace={espace} /> : <Lecture identite={identite} nom={nomConciergerie(espace)} />;
}

function Lecture({ identite: i, nom }: { identite: IdentiteSociete & { enregistree: boolean }; nom: string }) {
  const lignes: [string, string][] = [
    ['Dénomination', i.raisonSociale || nom || 'Votre conciergerie'],
    ...(i.forme ? [['Forme juridique', i.forme] as [string, string]] : []),
    ...(i.siret ? [['SIRET', formaterSiret(i.siret)] as [string, string]] : []),
    ...(i.adresse ? [['Siège', i.adresse] as [string, string]] : []),
    ['TVA', i.regimeTva === 'franchise' ? 'Franchise en base (art. 293 B du CGI)' : `TVA facturée à ${String(i.tvaPct).replace('.', ',')} %`],
    ...(i.numeroTva ? [['N° de TVA', i.numeroTva] as [string, string]] : []),
  ];
  return (
    <Card>
      <CardHeader titre="Identité" description="Elle figure sur vos factures et en tête de vos bilans." />
      <dl className="divide-y divide-(--lm-bord) text-[13.5px]">
        {lignes.map(([l, v]) => (
          <div key={l} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-2 sm:grid-cols-[160px_minmax(0,1fr)]">
            <dt className="text-(--lm-encre-2)">{l}</dt>
            <dd className="lm-chiffres font-medium break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {!i.enregistree && !i.siret && <p className="mt-2 text-[12.5px] text-(--lm-encre-2)">Le gérant renseigne ici l’identité légale de la société.</p>}
    </Card>
  );
}

/** Ordre des champs à l'écran : le premier en erreur reçoit le focus. */
const ORDRE_CHAMPS: ChampIdentite[] = ['raisonSociale', 'siret', 'adresse', 'tvaPct', 'numeroTva'];
const idChamp = (c: ChampIdentite) => `societe-${c}`;

function Formulaire({ identite, espace }: { identite: IdentiteSociete & { enregistree: boolean }; espace: Pick<Espace, 'id'> }) {
  const d = useErp();
  const [s, setS] = useState<Saisie>(() => versSaisie(identite));
  const [tente, setTente] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  // Enregistrée ailleurs (autre appareil) : la saisie repart de la nouvelle version.
  useEffect(() => setS(versSaisie(identite)), [identite]);
  const propre = depuisSaisie(s);
  const erreurs = tente ? erreursIdentite({ ...s, tvaPct: Number(s.tvaPct.replace(',', '.')) }, espace) : {};
  const change = !identite.enregistree || JSON.stringify(propre) !== JSON.stringify(normaliserIdentite(identite));
  const maj = (champ: keyof Saisie, v: string) => {
    setEnregistre(false);
    setS((x) => ({ ...x, [champ]: v }));
  };

  const enregistrer = (e: FormEvent) => {
    e.preventDefault();
    setTente(true);
    const manquent = erreursIdentite({ ...s, tvaPct: Number(s.tvaPct.replace(',', '.')) }, espace);
    const premier = ORDRE_CHAMPS.find((c) => manquent[c]);
    if (premier) {
      // Le premier champ à corriger reçoit le focus (son erreur est annoncée).
      document.getElementById(idChamp(premier))?.focus();
      return;
    }
    d.upsert('reglages', reglageSociete(propre, { maintenant: horodatageMaintenant(), par: d.utilisateur.email }));
    setTente(false);
    setEnregistre(true);
  };

  return (
    <Card>
      <CardHeader titre="Identité" description="Elle figure sur vos factures et en tête de vos bilans." />
      <form onSubmit={enregistrer} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Raison sociale" requis erreur={erreurs.raisonSociale}>
            <Input id={idChamp('raisonSociale')} value={s.raisonSociale} onChange={(e) => maj('raisonSociale', e.target.value)} autoComplete="organization" maxLength={120} />
          </Field>
          <Field label="Forme juridique" aide="SASU, SARL, EI…">
            <Input value={s.forme} onChange={(e) => maj('forme', e.target.value)} maxLength={60} />
          </Field>
          <Field label="SIRET" requis erreur={erreurs.siret} aide="14 chiffres.">
            <Input id={idChamp('siret')} value={s.siret} onChange={(e) => maj('siret', e.target.value)} inputMode="numeric" maxLength={20} />
          </Field>
          <Field label="Adresse du siège" requis erreur={erreurs.adresse}>
            <Input id={idChamp('adresse')} value={s.adresse} onChange={(e) => maj('adresse', e.target.value)} autoComplete="street-address" maxLength={200} placeholder="N°, rue, code postal, ville" />
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-(--lm-encre)">TVA</p>
          <Segmente<RegimeTva> label="Régime de TVA" options={REGIMES_TVA} valeur={s.regimeTva} onChange={(v) => maj('regimeTva', v)} />
          <p className="mt-1.5 text-[12px] text-(--lm-encre-3)">
            {s.regimeTva === 'franchise' ? `Vos factures portent « ${MENTION_FRANCHISE_TVA} ».` : 'La TVA s’ajoute au total de vos factures.'}
          </p>
        </div>
        {s.regimeTva === 'tva' && (
          <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <Field label="Taux (%)" erreur={erreurs.tvaPct}>
              <Input id={idChamp('tvaPct')} value={s.tvaPct} onChange={(e) => maj('tvaPct', e.target.value)} inputMode="decimal" maxLength={6} />
            </Field>
            <Field label="N° de TVA intracommunautaire" erreur={erreurs.numeroTva} aide="Facultatif.">
              <Input id={idChamp('numeroTva')} value={s.numeroTva ?? ''} onChange={(e) => maj('numeroTva', e.target.value)} placeholder="FR12345678901" maxLength={20} />
            </Field>
          </div>
        )}

        <Field
          label="Mentions sur vos factures"
          aide="Facultatif. Ce texte s’ajoute en bas de vos factures ; pour une société (SCI…), les pénalités de retard et l’indemnité de 40 € y figurent toujours."
        >
          <Textarea
            rows={3}
            value={s.mentions ?? ''}
            onChange={(e) => maj('mentions', e.target.value)}
            maxLength={600}
            placeholder="Ex. Pas d’escompte pour paiement anticipé."
          />
        </Field>

        <div className="flex items-center justify-end gap-3">
          {/* Toujours présent : « Enregistré » est annoncé par les lecteurs d'écran dès qu'il apparaît. */}
          <span role="status" className="inline-flex items-center gap-1 text-[13px] font-medium text-(--lm-succes-texte)">
            {enregistre && !change && (
              <>
                <Check className="size-4" aria-hidden />
                Enregistré
              </>
            )}
          </span>
          <Button type="submit" variant="primary" disabled={!change}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Card>
  );
}
