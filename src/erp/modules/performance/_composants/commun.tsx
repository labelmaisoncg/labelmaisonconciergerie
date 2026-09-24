/**
 * Briques partagées du module Performance (réutilisées par la fiche logement
 * et le tableau de bord) : analyse mémorisée, badges, cellules interprétées.
 */
import { useMemo, type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  analyserBien,
  analyserParc,
  interpreter,
  LIBELLE_NIVEAU,
  LIBELLES_RECOMMANDATION,
  LIBELLES_STATUT_RECO,
  SEUILS,
  TON_NIVEAU,
  TONS_RECOMMANDATION,
  TONS_STATUT_RECO,
  type CleKpi,
  type NiveauKpi,
  type Recommandation,
} from '../../../analyse';
import { AUJOURDHUI } from '../../../data/format';
import { useErp } from '../../../data/store';
import type { StatutRecommandation } from '../../../data/types';
import { Badge, TON_LAVIS, cn } from '../../../ui';

export function useAnalyseParc() {
  const { donnees } = useErp();
  return useMemo(() => analyserParc(donnees, AUJOURDHUI), [donnees]);
}

export function useAnalyseBien(logementId: string) {
  const { donnees } = useErp();
  return useMemo(() => {
    const l = donnees.logements.find((x) => x.id === logementId);
    return l ? analyserBien(donnees, logementId, AUJOURDHUI) : undefined;
  }, [donnees, logementId]);
}

export function BadgeRecommandation({ valeur, className }: { valeur: Recommandation; className?: string }) {
  return (
    <Badge tone={TONS_RECOMMANDATION[valeur]} point className={className}>
      {LIBELLES_RECOMMANDATION[valeur]}
    </Badge>
  );
}

export function BadgeStatutReco({ valeur }: { valeur: StatutRecommandation }) {
  return <Badge tone={TONS_STATUT_RECO[valeur]}>{LIBELLES_STATUT_RECO[valeur]}</Badge>;
}

export function BadgeNiveau({ niveau, className }: { niveau: NiveauKpi; className?: string }) {
  return (
    <Badge tone={TON_NIVEAU[niveau]} className={className}>
      {LIBELLE_NIVEAU[niveau]}
    </Badge>
  );
}

/** Texte d'aide complet d'un indicateur (infobulle). */
export function aideKpi(cle: CleKpi): string {
  const s = SEUILS[cle];
  return `${s.libelle} : ${s.description} Bon : ${s.lecture.bon} Correct : ${s.lecture.correct} Faible : ${s.lecture.faible}`;
}

/** Pastille « ? » non interactive portant l'explication en infobulle. */
export function Aide({ texte, className }: { texte: string; className?: string }) {
  return (
    <span role="img" aria-label={`Explication : ${texte}`} title={texte} className={cn('inline-flex cursor-help align-middle text-(--lm-encre-3) hover:text-(--lm-or)', className)}>
      <HelpCircle className="size-3.5" aria-hidden />
    </span>
  );
}

/** Libellé d'indicateur suivi de sa pastille d'aide. */
export function LibelleAide({ children, texte }: { children: ReactNode; texte: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <Aide texte={texte} />
    </span>
  );
}

/** Valeur colorée selon son niveau d'interprétation, avec explication en infobulle. */
export function CelluleKpi({ cle, valeur, affichage }: { cle: CleKpi; valeur: number | undefined; affichage?: ReactNode }) {
  if (valeur === undefined || !Number.isFinite(valeur)) return <span className="text-(--lm-encre-3)">-</span>;
  const { niveau, explication } = interpreter(cle, valeur);
  return (
    <span
      title={`${LIBELLE_NIVEAU[niveau]}. ${explication}`}
      className={cn('lm-chiffres inline-block rounded-md px-1.5 py-0.5 text-[13px] font-medium whitespace-nowrap', TON_LAVIS[TON_NIVEAU[niveau]])}
    >
      {affichage ?? SEUILS[cle].formater(valeur)}
      <span className="sr-only"> ({LIBELLE_NIVEAU[niveau]})</span>
    </span>
  );
}
