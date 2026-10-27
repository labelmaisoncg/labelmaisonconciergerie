import { useMemo } from 'react';
import { useErp } from '../../../data/store';
import { AUJOURDHUI } from '../../../data/format';
import { previsionParc } from '../../../data/previsionnel';
import { CartePrevisionnel } from '../../logements/_composants/Previsionnel';

/**
 * Prévisionnel du parc à 30, 60 et 90 jours (occupation et revenu
 * attendus). Seulement s'il y a des séjours à venir ou un historique
 * suffisant : jamais de carte à zéro.
 */
export function AVenir() {
  const d = useErp();
  const prevision = useMemo(() => previsionParc(d.logements, d.reservations, AUJOURDHUI), [d.logements, d.reservations]);
  if (!prevision) return null;
  return (
    <section aria-labelledby="a-venir-titre" className="mb-6">
      <h2 id="a-venir-titre" className="mb-3 text-[16px] font-semibold text-(--lm-encre)">
        À venir
      </h2>
      <CartePrevisionnel prevision={prevision} />
    </section>
  );
}
