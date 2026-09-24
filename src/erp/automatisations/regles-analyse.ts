/**
 * Règle de pilotage : revue hebdomadaire de la performance des biens (SPEC §10).
 */
import { analyserParc, LIBELLES_RECOMMANDATION } from '../analyse';
import type { RecommandationProprietaire } from '../data/types';
import { collecteur } from './outils';
import type { Regle } from './types';

/** Semaine ISO 'AAAA-Sxx' d'une date 'YYYY-MM-DD' (calcul UTC, sans date système). */
export function semaineIso(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const jour = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - jour);
  const debutAnnee = Date.UTC(d.getUTCFullYear(), 0, 1);
  const semaine = Math.ceil(((d.getTime() - debutAnnee) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-S${String(semaine).padStart(2, '0')}`;
}

export const revuePerformance: Regle = {
  cle: 'revue-performance',
  nom: 'Revue de performance des biens',
  description:
    'Chaque semaine, l’ERP analyse chaque logement actif : un bien « à sortir » ou « à renégocier » lève une alerte, et chaque amélioration détectée qui n’est pas encore suivie est ajoutée au suivi des recommandations, statut « à proposer ».',
  spec: '§10',
  domaine: 'pilotage',
  declencheur: 'quotidien',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    const semaine = semaineIso(ctx.date);
    const suivies = new Set((d.recommandations ?? []).map((r) => `${r.logementId}|${r.code}`));
    const ids = new Set((d.recommandations ?? []).map((r) => r.id));

    for (const { analyse } of analyserParc(d, ctx.date).lignes) {
      const l = analyse.logement;
      if (analyse.recommandation === 'sortir' || analyse.recommandation === 'renegocier') {
        const sortir = analyse.recommandation === 'sortir';
        c.evenement(
          sortir ? 'alerte' : 'action',
          `${semaine}:${l.id}:${analyse.recommandation}`,
          `${l.nom} : ${LIBELLES_RECOMMANDATION[analyse.recommandation].toLowerCase()}. ${analyse.verdictRentabilite} ${analyse.justification[0] ?? ''}`.trim(),
          'logement',
          l.id,
        );
      }
      for (const a of analyse.ameliorations) {
        const id = `reco-${l.id}-${a.code}`;
        if (suivies.has(`${l.id}|${a.code}`) || ids.has(id)) continue;
        const reco: RecommandationProprietaire = {
          id,
          logementId: l.id,
          proprietaireId: l.proprietaireId,
          code: a.code,
          titre: a.titre,
          detail: a.pourquoi,
          impactEstimeCentimesMois: a.impactEstime.centimesMois,
          impactSur: a.impactEstime.sur,
          porteur: a.porteur,
          statut: 'a_proposer',
          creeLe: ctx.date,
        };
        c.creer('recommandations', reco, `${a.titre} (${l.nom}) ajoutée au suivi, à proposer.`);
        ids.add(id);
      }
    }
    return c.res;
  },
};
