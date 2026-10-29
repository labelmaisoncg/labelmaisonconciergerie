import { useMemo, useState, type ReactNode } from 'react';
import { useErp } from '../../data/store';
import { AUJOURDHUI, horodatageMaintenant } from '../../data/format';
import { HORIZON_MAX_JOURS, NIVEAUX_CONFIANCE, eurosRonds, lireElementsPrix, plusJours, type ReglagesPrix as Reglages } from '../../data/prix-conseils';
import type { Logement } from '../../data/types';
import { Interrupteur, Repli, Segmente } from '../../ui';
import { BornesLogement } from '../logements/_composants/PrixConseilles';

/** Un réglage : libellé à gauche, contrôle à droite ; `empile` : contrôle dessous sur téléphone (choix segmentés). */
function Ligne({ titre, detail, empile, children }: { titre: string; detail?: string; empile?: boolean; children: ReactNode }) {
  return (
    <div className={empile ? 'flex flex-col items-start gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4' : 'flex items-center justify-between gap-4 py-3'}>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-(--lm-encre)">{titre}</span>
        {detail && <span className="block text-[12.5px] text-(--lm-encre-2)">{detail}</span>}
      </span>
      {children}
    </div>
  );
}

const ECARTS = ['10', '15', '20', '30'] as const;
const HORIZONS = ['30', '45', String(HORIZON_MAX_JOURS)] as const;

/**
 * Réglages des prix conseillés (gérant) : repliés sous Plateformes. Les
 * conseils ne sont jamais appliqués par l'ERP : ils disent quoi changer
 * sur Airbnb ou Booking.
 */
export function ReglagesPrix() {
  const d = useErp();
  const { reglages, decisions } = useMemo(() => lireElementsPrix(d.conseilsPrix), [d.conseilsPrix]);
  const [bornes, setBornes] = useState<Logement | null>(null);
  if (d.utilisateur.role !== 'gerant') return null;
  const lecture = d.lectureSeule;
  const regler = (patch: Partial<Reglages>) => d.upsert('conseilsPrix', { ...reglages, ...patch, majLe: horodatageMaintenant(), majPar: d.utilisateur.nom });
  const niveau = [...NIVEAUX_CONFIANCE].reverse().find((n) => reglages.confianceMin >= n.valeur - 0.001)?.cle ?? 'tous';
  const depuis = plusJours(AUJOURDHUI, -30);
  const recentes = decisions.filter((x) => String(x.le).slice(0, 10) >= depuis);
  const faits = recentes.filter((x) => x.decision === 'fait').length;
  const logements = d.logements.filter((l) => l.statut === 'actif' || l.statut === 'pause');
  const bornesTexte = (l: Logement) => {
    const b = reglages.parLogement[l.id];
    if (!b?.plancher && !b?.plafond) return '';
    return [b.plancher ? `dès ${eurosRonds(b.plancher)}` : '', b.plafond ? `jusqu’à ${eurosRonds(b.plafond)}` : ''].filter(Boolean).join(', ');
  };

  return (
    <Repli
      titre="Prix conseillés"
      description={
        reglages.actif
          ? `Chaque matin, ce qu’il vaut la peine de changer sur Airbnb et Booking${recentes.length ? ` · ${faits} fait${faits > 1 ? 's' : ''} sur ${recentes.length} en 30 jours` : ''}.`
          : 'En pause : aucun conseil de prix.'
      }
    >
      <div className="-my-3 divide-y divide-(--lm-bord)">
        <Ligne titre="Conseils de prix" detail="Montrés sur l’Accueil et la page de chaque logement.">
          <Interrupteur actif={reglages.actif} onChange={(actif) => regler({ actif })} label="Conseils de prix" disabled={lecture} />
        </Ligne>
        <Ligne titre="Notification du matin" detail="Une seule par jour, après 8 h, s’il y a des prix à revoir.">
          <Interrupteur actif={reglages.notifications} onChange={(notifications) => regler({ notifications })} label="Notification du matin" disabled={lecture || !reglages.actif} />
        </Ligne>
        <Ligne titre="Écart maximal" empile detail="Jamais plus que cet écart avec le prix actuel.">
          <Segmente
            label="Écart maximal"
            options={ECARTS.map((v) => ({ valeur: v, libelle: `${v} %` }))}
            valeur={(ECARTS.find((v) => Number(v) === reglages.variationMaxPct) ?? '20') as (typeof ECARTS)[number]}
            onChange={(v) => !lecture && regler({ variationMaxPct: Number(v) })}
          />
        </Ligne>
        <Ligne titre="Jusqu’où regarder" empile detail="Les nuits des prochains jours.">
          <Segmente
            label="Jusqu’où regarder"
            options={HORIZONS.map((v) => ({ valeur: v, libelle: `${v} j` }))}
            valeur={(HORIZONS.find((v) => Number(v) === reglages.horizonJours) ?? String(HORIZON_MAX_JOURS)) as (typeof HORIZONS)[number]}
            onChange={(v) => !lecture && regler({ horizonJours: Number(v) })}
          />
        </Ligne>
        <Ligne titre="Conseils montrés" empile detail="« Sûrs » : seulement ceux que vos données appuient le plus.">
          <Segmente
            label="Conseils montrés"
            options={NIVEAUX_CONFIANCE.map((n) => ({ valeur: n.cle, libelle: n.libelle }))}
            valeur={niveau}
            onChange={(cle) => !lecture && regler({ confianceMin: NIVEAUX_CONFIANCE.find((n) => n.cle === cle)!.valeur })}
          />
        </Ligne>
        {logements.length > 0 && (
          <div className="py-3">
            <p className="text-[13.5px] font-medium text-(--lm-encre)">Plancher et plafond</p>
            <p className="text-[12.5px] text-(--lm-encre-2)">Aucun conseil en dessous ni au-dessus, logement par logement.</p>
            <ul className="mt-2 divide-y divide-(--lm-bord) rounded-lg border border-(--lm-bord)">
              {logements.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-(--lm-encre)">{l.nom}</span>
                  {bornesTexte(l) && <span className="shrink-0 text-[12.5px] text-(--lm-encre-2)">{bornesTexte(l)}</span>}
                  {!lecture && (
                    <button type="button" onClick={() => setBornes(l)} className="inline-flex min-h-8 shrink-0 items-center text-[13px] font-medium lm-lien" aria-label={`Plancher et plafond de ${l.nom}`}>
                      {bornesTexte(l) ? 'Modifier' : 'Choisir'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="py-3 text-[12.5px] text-(--lm-encre-3)">
          Calculés avec vos réservations : rythme de réservation, votre prix habituel, vos logements comparables, week-ends, vacances et jours fériés. Aucun prix de concurrent n’est encore relié.
        </p>
      </div>
      {bornes && <BornesLogement logement={bornes} onFermer={() => setBornes(null)} />}
    </Repli>
  );
}
