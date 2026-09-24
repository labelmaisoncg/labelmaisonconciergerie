import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import type { MoisMarge } from '../../../analyse';
import { euros, moisAnnee } from '../../../data/format';

const VERT = '#2f7d55';
const ROUGE = '#b42318';
const GRILLE = 'rgba(20,17,14,0.08)';
const AXE = { fontSize: 11.5, fill: 'rgba(20,17,14,0.6)' };

function Infobulle({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const m = payload[0].payload as MoisMarge & { libelle: string };
  return (
    <div className="rounded-lg border border-(--lm-bord) bg-(--lm-surface) px-3 py-2 text-[12.5px] shadow-(--lm-ombre-haute)">
      <p className="mb-1 font-semibold text-(--lm-encre)">
        {moisAnnee(`${m.mois}-01`)}
        {m.partiel ? ' (en cours)' : ''}
      </p>
      <p className="lm-chiffres text-(--lm-encre-2)">CA : {euros(m.ca, true)}</p>
      <p className="lm-chiffres text-(--lm-encre-2)">Coûts : {euros(m.couts, true)}</p>
      <p className="lm-chiffres font-medium text-(--lm-encre)">Marge : {euros(m.marge, true)}</p>
    </div>
  );
}

/** Marge Label Maison mois par mois (barres vertes ou rouges), mois sans données masqués. */
export function GraphiqueMarge({ mois }: { mois: MoisMarge[] }) {
  const donnees = mois.filter((m) => m.avecDonnees).map((m) => ({ ...m, libelle: moisAnnee(`${m.mois}-01`).slice(0, 4) }));
  const resume = donnees.map((m) => `${m.mois} : ${euros(m.marge, true)}`).join(', ');
  if (!donnees.length) return <p className="text-[13px] text-(--lm-encre-3)">Pas encore de mois complet sous mandat.</p>;
  return (
    <figure aria-label={`Marge mensuelle : ${resume}`} className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={donnees} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRILLE} />
          <XAxis dataKey="libelle" tick={AXE} axisLine={false} tickLine={false} />
          <YAxis tick={AXE} axisLine={false} tickLine={false} width={52} tickFormatter={(v: number) => euros(v, true)} />
          <ReferenceLine y={0} stroke="rgba(20,17,14,0.3)" />
          <Tooltip content={<Infobulle />} cursor={{ fill: 'rgba(169,124,48,0.08)' }} />
          <Bar dataKey="marge" name="Marge" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {donnees.map((m) => (
              <Cell key={m.mois} fill={m.marge < 0 ? ROUGE : VERT} fillOpacity={m.partiel ? 0.5 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
