import { useMemo } from 'react';
import { BadgePercent, BedDouble, Camera, Coins, Euro, Home, Percent, Star, TrendingUp } from 'lucide-react';
import { useErp } from '../../../data/store';
import { euros, note, pourcentage } from '../../../data/format';
import { SEUIL_NOTE_CONTROLE } from '../../../data/constantes';
import { Stat } from '../../../ui';
import { HORIZONS, fenetresHorizon, mesurer, variation, type CleHorizon } from './calculs';

/** Bande d'indicateurs (SPEC §6) avec comparaison à la période précédente. */
export function BandeKpi({ horizon }: { horizon: CleHorizon }) {
  const d = useErp();
  const { cour, prec } = useMemo(() => {
    const f = fenetresHorizon(horizon);
    return { cour: mesurer(d.donnees, f.courante), prec: mesurer(d.donnees, f.precedente) };
  }, [d.donnees, horizon]);
  const lib = HORIZONS.find((h) => h.cle === horizon)!.comparaison;
  const actifs = d.logements.filter((l) => l.statut === 'actif').length;
  const lancement = d.logements.filter((l) => l.statut === 'lancement').length;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Stat
        label="Logements actifs"
        valeur={actifs}
        icone={<Home />}
        aide={`${lancement} en lancement`}
        to="/erp/logements"
      />
      <Stat label="Taux d’occupation" valeur={pourcentage(cour.occupation)} icone={<BedDouble />}
        delta={variation(cour.occupation, prec.occupation, 'points', lib)} />
      <Stat label="Revenu brut géré" valeur={euros(cour.revenuBrut, true)} icone={<Euro />}
        delta={variation(cour.revenuBrut, prec.revenuBrut, 'euros', lib)} to="/erp/finance" />
      <Stat label="Commission Label Maison" valeur={euros(cour.commission, true)} icone={<Coins />}
        delta={variation(cour.commission, prec.commission, 'euros', lib)} to="/erp/finance" />
      <Stat label="ADR (prix moyen par nuit)" valeur={euros(cour.adr, true)} icone={<TrendingUp />}
        delta={variation(cour.adr, prec.adr, 'euros', lib)} />
      <Stat label="RevPAR" valeur={euros(cour.revpar, true)} icone={<Percent />}
        delta={variation(cour.revpar, prec.revpar, 'euros', lib)} aide="par nuit disponible" />
      <Stat
        label="Note voyageur moyenne"
        valeur={note(cour.note)}
        icone={<Star />}
        tone={cour.note !== undefined && cour.note < SEUIL_NOTE_CONTROLE ? 'alerte' : 'neutre'}
        delta={variation(cour.note, prec.note, 'note', lib)}
        aide={cour.note === undefined ? 'aucune note sur la période' : undefined}
      />
      <Stat
        label="Ménages validés avec photos"
        valeur={pourcentage(cour.missionsValidees)}
        icone={<Camera />}
        tone={cour.missionsValidees < 0.9 ? 'alerte' : 'neutre'}
        delta={variation(cour.missionsValidees, prec.missionsValidees, 'points', lib)}
        to="/erp/menages"
      />
      <Stat
        label="Taux de commission effectif"
        valeur={cour.revenuBrut ? pourcentage(cour.commission / cour.revenuBrut, 1) : '-'}
        icone={<BadgePercent />}
        aide="commission / brut géré"
      />
      <Stat
        label="Revenu par logement actif"
        valeur={actifs ? euros(Math.round(cour.revenuBrut / actifs), true) : '-'}
        icone={<Home />}
        aide="brut sur la période"
      />
    </div>
  );
}
