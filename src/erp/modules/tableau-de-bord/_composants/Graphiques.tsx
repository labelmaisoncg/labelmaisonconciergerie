import { useMemo, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { useErp } from '../../../data/store';
import { euros, note, pourcentage } from '../../../data/format';
import { logementsActifs, tauxOccupation } from '../../../data/selectors';
import { Card, CardHeader } from '../../../ui';
import { fenetresHorizon, serieMensuelle, type CleHorizon } from './calculs';

/* Palette validée (or de la charte + bleu ardoise, contrastes et daltonisme OK). */
const OR = '#A97C30';
const ARDOISE = '#3D6DB5';
const GRILLE = 'rgba(20,17,14,0.08)';
const AXE = { fontSize: 11.5, fill: 'rgba(20,17,14,0.6)' };

type Formateur = (v: number) => string;

function Infobulle({ active, payload, label, formats }: TooltipProps<number, string> & { formats: Record<string, Formateur> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-(--lm-bord) bg-(--lm-surface) px-3 py-2 text-[12.5px] shadow-(--lm-ombre-haute)">
      <p className="mb-1 font-semibold text-(--lm-encre)">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="lm-chiffres flex items-center gap-2 text-(--lm-encre-2)">
          <span aria-hidden className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name} : <span className="font-medium text-(--lm-encre)">{p.value === undefined || p.value === null ? '-' : formats[String(p.dataKey)](Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

function Legende({ items }: { items: { libelle: string; couleur: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-3 text-[12px] text-(--lm-encre-2)">
      {items.map((i) => (
        <li key={i.libelle} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ background: i.couleur }} />
          {i.libelle}
        </li>
      ))}
    </ul>
  );
}

function Cadre({ titre, description, actions, children, resume }: { titre: string; description: string; actions?: ReactNode; children: ReactNode; resume: string }) {
  return (
    <Card>
      <CardHeader titre={titre} description={description} actions={actions} />
      <figure aria-label={resume} className="h-60 w-full">
        {children}
      </figure>
    </Card>
  );
}

const eurosK = (c: number) => (c >= 100000 ? `${Math.round(c / 100000)} k€` : euros(c, true));

export function Graphiques({ horizon }: { horizon: CleHorizon }) {
  const d = useErp();
  const serie = useMemo(() => serieMensuelle(d.donnees, 6), [d.donnees]);
  const occupation = useMemo(() => {
    const f = fenetresHorizon(horizon).courante;
    return logementsActifs(d.logements)
      .map((l) => ({ nom: l.nom, taux: tauxOccupation(d.reservations, [l], f) }))
      .sort((a, b) => b.taux - a.taux);
  }, [d.logements, d.reservations, horizon]);

  const formatsRevenu = { revenuBrut: (v: number) => euros(v, true), commission: (v: number) => euros(v, true) };
  const dernier = serie[serie.length - 1];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Cadre
        titre="Revenu brut et commission"
        description="6 derniers mois, mois en cours inclus (réservations confirmées)."
        actions={<Legende items={[{ libelle: 'Revenu brut géré', couleur: OR }, { libelle: 'Commission Label Maison', couleur: ARDOISE }]} />}
        resume={`Revenu brut ${dernier ? euros(dernier.revenuBrut, true) : ''} ce mois, commission ${dernier ? euros(dernier.commission, true) : ''}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={serie} barGap={2} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRILLE} />
            <XAxis dataKey="libelle" tick={AXE} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={eurosK} tick={AXE} axisLine={false} tickLine={false} width={56} />
            <Tooltip cursor={{ fill: 'rgba(169,124,48,0.08)' }} content={<Infobulle formats={formatsRevenu} />} />
            <Bar dataKey="revenuBrut" name="Revenu brut" fill={OR} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="commission" name="Commission" fill={ARDOISE} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </Cadre>

      <Cadre
        titre="Note voyageur moyenne"
        description="Par mois de départ. Une note sous 4,5 déclenche un contrôle qualité."
        resume={dernier?.note === undefined ? 'Aucune note voyageur sur le dernier mois.' : `Note moyenne du mois : ${note(dernier.note)}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={serie} margin={{ top: 16, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRILLE} />
            <XAxis dataKey="libelle" tick={AXE} axisLine={false} tickLine={false} />
            <YAxis domain={[4, 5]} ticks={[4, 4.5, 5]} tickFormatter={(v: number) => note(v)} tick={AXE} axisLine={false} tickLine={false} width={44} />
            <Tooltip content={<Infobulle formats={{ note: (v) => `${note(v)} / 5` }} />} />
            <Line type="monotone" dataKey="note" name="Note" stroke={OR} strokeWidth={2} isAnimationActive={false} dot={{ r: 4, fill: OR, stroke: '#fff', strokeWidth: 2 }} connectNulls>
              <LabelList dataKey="note" position="top" formatter={(v: number) => note(v)} style={{ fontSize: 11, fill: 'rgba(20,17,14,0.6)' }} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </Cadre>

      <Card className="lg:col-span-2">
        <CardHeader titre="Occupation par logement" description="Logements actifs, sur la période sélectionnée." />
        {occupation.length ? (
          <figure aria-label="Taux d’occupation par logement" style={{ height: Math.max(160, occupation.length * 34 + 24) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={occupation} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={GRILLE} />
                <XAxis type="number" domain={[0, 1]} tickFormatter={(v: number) => pourcentage(v)} tick={AXE} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="nom" tick={AXE} axisLine={false} tickLine={false} width={150} />
                <Tooltip cursor={{ fill: 'rgba(169,124,48,0.08)' }} content={<Infobulle formats={{ taux: (v) => pourcentage(v) }} />} />
                <Bar dataKey="taux" name="Occupation" fill={OR} radius={[0, 4, 4, 0]} maxBarSize={18}>
                  <LabelList dataKey="taux" position="right" formatter={(v: number) => pourcentage(v)} style={{ fontSize: 11.5, fill: '#14110E' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </figure>
        ) : (
          <p className="text-sm text-(--lm-encre-3)">Aucun logement actif.</p>
        )}
      </Card>
    </div>
  );
}
