/**
 * Vue « Mois » des réservations : le calendrier de l'app Airbnb (côté hôte),
 * le même composant que l'espace propriétaire (src/erp/calendrier), pour le
 * logement choisi, sur les réservations déjà chargées (hors annulées). La
 * bande porte le nom complet du voyageur ; la toucher ouvre la fiche de la
 * réservation. Chaque pilule porte la pastille de couleur de son logement
 * (data/couleurs-logement.ts) ; les bandes restent à l'encre, comme dans
 * l'espace propriétaire (un seul logement à la fois). Lecture seule : rien
 * ne part vers Airbnb ou Booking.
 */
import { useCallback, useMemo, useState } from 'react';
import { CalendrierDefilant, CalendrierMois, PilulesLogement, ligneChiffres, moisEntre, type ChargeurMois, type MoisCalendrier } from '../../../calendrier';
import { calendrierMoisReservations } from '../../../data/calendrier-reservations';
import { AUJOURDHUI } from '../../../data/format';
import { moisDe } from '../../../data/proprietaire';
import type { Logement, Reservation } from '../../../data/types';
import { useCouleursLogements } from '../../logements/_composants/PastilleLogement';

interface Props {
  logements: Logement[];
  reservations: Reservation[];
  onOuvrir: (r: Reservation) => void;
  /** Logement présélectionné (`?logement=`). */
  logementInitial?: string;
}

/** Mois calculés, par logement puis par mois, avec les réservations qui les ont produits : d'autres réservations, tout est recalculé. */
interface Cache {
  pour: readonly Reservation[];
  mois: Record<string, Record<string, MoisCalendrier>>;
}

const VIDE: Record<string, MoisCalendrier> = {};

export function CalendrierMensuel({ logements, reservations, onOuvrir, logementInitial }: Props) {
  const [choix, setChoix] = useState<string | undefined>(() => (logements.some((l) => l.id === logementInitial) ? logementInitial : logements[0]?.id));
  const logementId = logements.some((l) => l.id === choix) ? choix : logements[0]?.id;
  const [cache, setCache] = useState<Cache>({ pour: reservations, mois: {} });
  const connus = useMemo(() => (cache.pour === reservations && logementId && cache.mois[logementId]) || VIDE, [cache, reservations, logementId]);
  const charger = useCallback<ChargeurMois>(
    async (de, a) => {
      if (!logementId) return { ok: true };
      const calcules = Object.fromEntries(moisEntre(de, a).map((m) => [m, calendrierMoisReservations(reservations, logementId, m)]));
      setCache((c) => {
        const base = c.pour === reservations ? c.mois : {};
        return { pour: reservations, mois: { ...base, [logementId]: { ...base[logementId], ...calcules } } };
      });
      return { ok: true };
    },
    [reservations, logementId],
  );
  const parId = useMemo(() => new Map(reservations.map((r) => [r.id, r])), [reservations]);
  const { teintes } = useCouleursLogements();

  if (!logementId) return <p className="text-[14px] text-(--lm-encre-2)">Aucun logement actif pour l’instant.</p>;
  return (
    <div className="w-full max-w-[44rem]">
      <PilulesLogement logements={logements.map((l) => ({ id: l.id, nom: l.nom }))} choisi={logementId} onChoisir={setChoix} teintes={teintes} className="mb-4" />
      <CalendrierDefilant
        moisInitial={moisDe(AUJOURDHUI)}
        connus={connus}
        charger={charger}
        rendreMois={(mois, m) => (
          <CalendrierMois
            mois={mois}
            jours={m.jours}
            sejours={m.sejours}
            aujourdhui={AUJOURDHUI}
            chiffres={ligneChiffres(m)}
            onSejour={(s) => {
              const r = s.id ? parId.get(s.id) : undefined;
              if (r) onOuvrir(r);
            }}
          />
        )}
      />
    </div>
  );
}
