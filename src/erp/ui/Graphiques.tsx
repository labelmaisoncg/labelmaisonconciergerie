/**
 * Graphiques de l'ERP (recharts), réglés une fois pour toutes : barres
 * arrondies, quadrillage discret, pas de ligne d'axe, courbe lissée sans
 * points (point au survol), infobulle sobre. Couleurs : jetons de erp.css.
 */
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const GRILLE = 'var(--lm-bord)';
const AXE = { fontSize: 11.5, fill: 'var(--lm-encre-3)' } as const;

interface EntreeInfobulle {
  value?: number | string | Array<number | string>;
  payload?: Record<string, unknown>;
}

function Infobulle({ active, payload, label, formater }: { active?: boolean; payload?: EntreeInfobulle[]; label?: string | number; formater: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-(--lm-bord) bg-(--lm-surface) px-3 py-2 text-[12.5px] shadow-(--lm-ombre-haute)">
      {label !== undefined && <p className="text-(--lm-encre-2)">{label}</p>}
      <p className="lm-chiffres font-semibold text-(--lm-encre)">{formater(Number(payload[0].value ?? 0))}</p>
    </div>
  );
}

export interface PointBarre {
  libelle: string;
  valeur: number;
  /** Barre mise en avant (période en cours). */
  courant?: boolean;
}

/** Barres verticales : une par période (ex. revenu par mois). */
export function GraphiqueBarres({
  points,
  formater,
  formaterAxe,
  label,
  hauteur = 200,
}: {
  points: PointBarre[];
  formater: (v: number) => string;
  formaterAxe: (v: number) => string;
  /** Description accessible du graphique. */
  label: string;
  hauteur?: number;
}) {
  return (
    <div role="img" aria-label={label} style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={GRILLE} />
          <XAxis dataKey="libelle" axisLine={false} tickLine={false} tick={AXE} interval="preserveStartEnd" minTickGap={8} />
          <YAxis axisLine={false} tickLine={false} tick={AXE} width={48} tickFormatter={formaterAxe} />
          <Tooltip cursor={{ fill: 'var(--lm-or-lavis)' }} content={<Infobulle formater={formater} />} />
          <Bar
            dataKey="valeur"
            radius={[6, 6, 0, 0]}
            isAnimationActive={false}
            shape={(p: { x?: number; y?: number; width?: number; height?: number; payload?: PointBarre }) => {
              const { x = 0, y = 0, width = 0, height = 0 } = p;
              const r = Math.min(6, width / 2, height);
              const h = Math.max(0, height);
              return (
                <path
                  d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + h} Z`}
                  fill={p.payload?.courant ? 'var(--lm-or-texte)' : 'var(--lm-or-clair)'}
                />
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface PointCourbe {
  libelle: string;
  valeur: number;
}

/** Courbe lissée avec aire légère ; `repere` trace une ligne verticale (ex. aujourd'hui). */
export function GraphiqueCourbe({
  points,
  formater,
  formaterAxe,
  label,
  repere,
  repereLibelle,
  domaine,
  paliers,
  hauteur = 200,
}: {
  points: PointCourbe[];
  formater: (v: number) => string;
  formaterAxe: (v: number) => string;
  label: string;
  repere?: string;
  repereLibelle?: string;
  /** Bornes de l'axe vertical ; 'auto' laisse le graphique choisir. */
  domaine?: [number | 'auto', number | 'auto'];
  /** Valeurs par jour (prix) : marches plutôt que courbe lissée. */
  paliers?: boolean;
  hauteur?: number;
}) {
  return (
    <div role="img" aria-label={label} style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 14, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="lm-aire" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--lm-or)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--lm-or)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRILLE} />
          <XAxis dataKey="libelle" axisLine={false} tickLine={false} tick={AXE} interval="preserveStartEnd" minTickGap={16} />
          <YAxis axisLine={false} tickLine={false} tick={AXE} width={52} tickFormatter={formaterAxe} domain={domaine ?? ['auto', 'auto']} />
          <Tooltip cursor={{ stroke: 'var(--lm-bord-fort)' }} content={<Infobulle formater={formater} />} />
          {repere && (
            <ReferenceLine
              x={repere}
              stroke="var(--lm-encre-3)"
              strokeDasharray="3 3"
              label={repereLibelle ? { value: repereLibelle, position: 'top', fill: 'var(--lm-encre-3)', fontSize: 11 } : undefined}
            />
          )}
          <Area
            type={paliers ? 'stepAfter' : 'monotone'}
            dataKey="valeur"
            stroke="var(--lm-or-texte)"
            strokeWidth={2}
            fill="url(#lm-aire)"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--lm-or-texte)', stroke: 'var(--lm-surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
