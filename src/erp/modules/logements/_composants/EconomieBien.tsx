/**
 * Les deux chiffres qui comptent sur chaque logement : la commission du mandat
 * et la rentabilité pour Label Maison (marge par mois, analyse sur 90 jours).
 * Réutilisé par la liste des logements, la fiche logement et la fiche
 * propriétaire, avec le même vocabulaire que la page Performance.
 */
import { useMemo } from 'react';
import { analyserBien } from '../../../analyse';
import { COMMISSION_CIBLE_MIN } from '../../../data/constantes';
import { AUJOURDHUI, euros, nombre } from '../../../data/format';
import { mandatDuLogement } from '../../../data/selectors';
import type { Centimes, ErpDonnees, Id } from '../../../data/types';
import { Badge } from '../../../ui';

export interface EconomieBien {
  /** Commission du mandat (signé en priorité), absente sans mandat. */
  commissionPct?: number;
  sousCible: boolean;
  /** Assez de recul (30 jours de données) pour juger la rentabilité. */
  aDonnees: boolean;
  rentable: boolean;
  margeMois: Centimes;
}

export function economieBien(d: ErpDonnees, logementId: Id): EconomieBien {
  const mandat = mandatDuLogement(d.mandats.filter((m) => m.statut !== 'resilie'), logementId) ?? mandatDuLogement(d.mandats, logementId);
  const commissionPct = mandat?.commissionPct;
  const sousCible = commissionPct !== undefined && commissionPct < COMMISSION_CIBLE_MIN;
  try {
    const a = analyserBien(d, logementId, AUJOURDHUI);
    const aDonnees = a.kpis.some((k) => k.cle === 'margeMois' && k.valeur !== undefined);
    return { commissionPct, sousCible, aDonnees, rentable: a.rentable, margeMois: a.margeMois };
  } catch {
    return { commissionPct, sousCible, aDonnees: false, rentable: false, margeMois: 0 };
  }
}

/** Économie de tous les logements, calculée une fois par état des données. */
export function useEconomieParc(d: ErpDonnees): Map<Id, EconomieBien> {
  return useMemo(() => new Map(d.logements.map((l) => [l.id, economieBien(d, l.id)])), [d]);
}

export function BadgeCommission({ eco, className }: { eco: EconomieBien; className?: string }) {
  if (eco.commissionPct === undefined) {
    return <Badge tone="danger" className={className}>Pas de mandat</Badge>;
  }
  return (
    <Badge
      tone={eco.sousCible ? 'alerte' : 'neutre'}
      className={className}
      title={eco.sousCible ? `Sous la cible de ${COMMISSION_CIBLE_MIN} % : à renégocier au renouvellement.` : 'Commission du mandat, dans la cible.'}
    >
      Commission {nombre(eco.commissionPct, Number.isInteger(eco.commissionPct) ? 0 : 1)} %{eco.sousCible ? ', sous la cible' : ''}
    </Badge>
  );
}

const signe = (c: Centimes) => `${c > 0 ? '+' : ''}${euros(c, true)}`;

export function BadgeRentabilite({ eco, avecMarge = true, complet = false, className }: { eco: EconomieBien; avecMarge?: boolean; complet?: boolean; className?: string }) {
  if (!eco.aDonnees) {
    return <Badge tone="neutre" className={className} title="Moins de 30 jours de données : rentabilité pas encore mesurable.">Rentabilité à venir</Badge>;
  }
  return (
    <Badge
      tone={eco.rentable ? 'succes' : 'danger'}
      className={className}
      title={`${eco.rentable ? 'Rentable' : 'Non rentable'} pour Label Maison : marge moyenne sur 90 jours, après ménages, charges, incidents et frais de structure.`}
    >
      {eco.rentable ? 'Rentable' : 'Non rentable'}
      {complet && ' pour Label Maison'}
      {avecMarge && <span className="lm-chiffres">{` · ${signe(eco.margeMois)} / mois`}</span>}
    </Badge>
  );
}

/** Tri : marge croissante, les biens sans recul en dernier. */
export const triMarge = (a: EconomieBien, b: EconomieBien) =>
  Number(b.aDonnees) - Number(a.aDonnees) || a.margeMois - b.margeMois;
