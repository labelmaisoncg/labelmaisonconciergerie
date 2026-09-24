import { useMemo } from 'react';
import { BadgePercent, BedDouble, Camera, Coins, Euro, Home, Percent, Star, TrendingUp } from 'lucide-react';
import { useErp } from '../../../data/store';
import { euros, note, pourcentage } from '../../../data/format';
import { SEUIL_NOTE_CONTROLE } from '../../../data/constantes';
import { Stat } from '../../../ui';
import { aideKpi, LibelleAide } from '../../performance/_composants/commun';
import { HORIZONS, fenetresHorizon, mesurer, variation, type CleHorizon } from './calculs';

/** Explications des indicateurs sans seuil dédié dans analyse/seuils.ts. */
const AIDES = {
  actifs: 'Logements actifs : biens sous mandat signé et en ligne. Les biens en lancement attendent leur checklist complète (SPEC §2.2).',
  brut: 'Revenu brut géré : total payé par les voyageurs sur la période (frais de ménage inclus), proratisé à la nuit. C’est le volume d’affaires confié par les propriétaires.',
  commission: 'Commission Label Maison : pourcentage du mandat appliqué au revenu net de plateforme hors ménage. C’est le principal chiffre d’affaires de Label Maison.',
  adr: `${aideKpi('adr')} Ici : moyenne de tout le parc sur la période.`,
  effectif: 'Taux de commission effectif : commission divisée par le brut géré. Plus bas que le taux des mandats car calculé sur le brut (plateformes et ménage inclus). Cible des mandats : 18 à 20 %.',
  parLogement: 'Revenu par logement actif : brut géré divisé par le nombre de logements actifs. Permet de comparer les périodes à parc constant.',
};

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
        label={<LibelleAide texte={AIDES.actifs}>Logements actifs</LibelleAide>}
        valeur={actifs}
        icone={<Home />}
        aide={`${lancement} en lancement`}
        to="/erp/logements"
      />
      <Stat label={<LibelleAide texte={aideKpi('occupation')}>Taux d’occupation</LibelleAide>} valeur={pourcentage(cour.occupation)} icone={<BedDouble />}
        delta={variation(cour.occupation, prec.occupation, 'points', lib)} />
      <Stat label={<LibelleAide texte={AIDES.brut}>Revenu brut géré</LibelleAide>} valeur={euros(cour.revenuBrut, true)} icone={<Euro />}
        delta={variation(cour.revenuBrut, prec.revenuBrut, 'euros', lib)} to="/erp/finance" />
      <Stat label={<LibelleAide texte={AIDES.commission}>Commission Label Maison</LibelleAide>} valeur={euros(cour.commission, true)} icone={<Coins />}
        delta={variation(cour.commission, prec.commission, 'euros', lib)} to="/erp/finance" />
      <Stat label={<LibelleAide texte={AIDES.adr}>ADR (prix moyen par nuit)</LibelleAide>} valeur={euros(cour.adr, true)} icone={<TrendingUp />}
        delta={variation(cour.adr, prec.adr, 'euros', lib)} />
      <Stat label={<LibelleAide texte={aideKpi('revpar')}>RevPAR</LibelleAide>} valeur={euros(cour.revpar, true)} icone={<Percent />}
        delta={variation(cour.revpar, prec.revpar, 'euros', lib)} aide="par nuit disponible" />
      <Stat
        label={<LibelleAide texte={aideKpi('note')}>Note voyageur moyenne</LibelleAide>}
        valeur={note(cour.note)}
        icone={<Star />}
        tone={cour.note !== undefined && cour.note < SEUIL_NOTE_CONTROLE ? 'alerte' : 'neutre'}
        delta={variation(cour.note, prec.note, 'note', lib)}
        aide={cour.note === undefined ? 'aucune note sur la période' : undefined}
      />
      <Stat
        label={<LibelleAide texte={aideKpi('menagesPhotos')}>Ménages validés avec photos</LibelleAide>}
        valeur={pourcentage(cour.missionsValidees)}
        icone={<Camera />}
        tone={cour.missionsValidees < 0.9 ? 'alerte' : 'neutre'}
        delta={variation(cour.missionsValidees, prec.missionsValidees, 'points', lib)}
        to="/erp/menages"
      />
      <Stat
        label={<LibelleAide texte={AIDES.effectif}>Taux de commission effectif</LibelleAide>}
        valeur={cour.revenuBrut ? pourcentage(cour.commission / cour.revenuBrut, 1) : '-'}
        icone={<BadgePercent />}
        aide="commission / brut géré"
      />
      <Stat
        label={<LibelleAide texte={AIDES.parLogement}>Revenu par logement actif</LibelleAide>}
        valeur={actifs ? euros(Math.round(cour.revenuBrut / actifs), true) : '-'}
        icone={<Home />}
        aide="brut sur la période"
      />
    </div>
  );
}
