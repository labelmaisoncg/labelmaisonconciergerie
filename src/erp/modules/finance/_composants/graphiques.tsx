/**
 * Réglages communs des graphiques Finance (recharts). Palette validée
 * (daltonisme, contraste) : bleu = argent des propriétaires, or = chiffre
 * d'affaires Label Maison, vert = marge.
 */
import { euros } from '../../../data/format';

export const COULEURS = {
  brut: '#4F7FC0',
  ca: '#B8862F',
  marge: '#2F9170',
  grille: 'rgba(20,17,14,0.08)',
  axe: 'rgba(20,17,14,0.5)',
} as const;

export const AXE = { fontSize: 11.5, fill: COULEURS.axe } as const;

/** Montant compact pour les axes : 12 400 € → « 12 k€ ». */
export function eurosAxe(centimes: number): string {
  const e = centimes / 100;
  const k = Math.abs(e) / 1000;
  if (k < 1) return `${Math.round(e)} €`;
  return `${(e / 1000).toLocaleString('fr-FR', { maximumFractionDigits: k < 10 ? 1 : 0 })} k€`;
}

interface EntreeInfobulle {
  name?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
}

/** Infobulle sobre, montants en euros, texte à l'encre (pas à la couleur de la série). */
export function Infobulle({ active, payload, label }: { active?: boolean; payload?: EntreeInfobulle[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-(--lm-bord) bg-(--lm-surface) px-3 py-2 text-[12.5px] shadow-(--lm-ombre-haute)">
      {label !== undefined && <p className="mb-1 font-medium text-(--lm-encre)">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.name)} className="flex items-center gap-2 text-(--lm-encre-2)">
          <span aria-hidden className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="lm-chiffres font-medium text-(--lm-encre)">{euros(Number(p.value ?? 0), true)}</span>
        </p>
      ))}
    </div>
  );
}
