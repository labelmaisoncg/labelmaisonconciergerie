/**
 * Point d'un logement sur la carte : sa couleur et son icône (jamais la
 * couleur seule), et un « ! » foncé posé dessus quand un problème est
 * signalé, sans cacher la couleur. Le même point sert de repère sur la
 * carte, dans la légende et dans la liste.
 */
import type { ReactNode } from 'react';
import { BedDouble, Check, Sparkles } from 'lucide-react';
import type { EtatCarte } from '../data/carte';
import { cn } from '../ui';

const STYLES: Record<EtatCarte, { fond: string; icone: ReactNode }> = {
  reserve: { fond: 'bg-(--lm-carte-reserve)', icone: <BedDouble /> },
  libre: { fond: 'bg-(--lm-carte-libre)', icone: <Check /> },
  menage: { fond: 'bg-(--lm-carte-menage)', icone: <Sparkles /> },
};

const TAILLES = {
  /** Repère de la carte. */
  md: { rond: 'size-7 ring-2 [&_svg]:size-4', badge: 'size-4 text-[10.5px] -top-1.5 -right-1.5' },
  /** Légende, liste, fiche. */
  sm: { rond: 'size-5 ring-0 [&_svg]:size-3', badge: 'size-3.5 text-[9.5px] -top-1 -right-1.5' },
};

/** « ! » d'un problème signalé (posé sur un point, ou seul dans la légende). */
export function BadgeProbleme({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-full bg-(--lm-carte-probleme) leading-none font-bold text-white ring-2 ring-white', className)}>
      !
    </span>
  );
}

export function PastilleEtat({ etat, probleme, taille = 'sm', className }: { etat: EtatCarte; probleme?: boolean; taille?: keyof typeof TAILLES; className?: string }) {
  const t = TAILLES[taille];
  return (
    <span aria-hidden className={cn('relative grid shrink-0 place-items-center rounded-full text-white ring-white', STYLES[etat].fond, t.rond, taille === 'md' && 'shadow-(--lm-carte-ombre)', className)}>
      {STYLES[etat].icone}
      {probleme && <BadgeProbleme className={cn('absolute', t.badge)} />}
    </span>
  );
}
