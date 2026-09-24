/**
 * Cycle de vie d'une recommandation : à proposer → proposée → acceptée ou
 * refusée → réalisée. Chaque passage date l'étape ; le store journalise
 * l'upsert (traçabilité complète dans l'ERP).
 */
import type { Amelioration, AnalyseBien } from '../../../analyse';
import { AUJOURDHUI } from '../../../data/format';
import type { RecommandationProprietaire, StatutRecommandation } from '../../../data/types';

export const ETAPES: StatutRecommandation[] = ['a_proposer', 'proposee', 'acceptee', 'refusee', 'realisee'];

export interface Transition {
  vers: StatutRecommandation;
  libelle: string;
  variante: 'primary' | 'secondary' | 'ghost' | 'danger';
}

export const TRANSITIONS: Record<StatutRecommandation, Transition[]> = {
  a_proposer: [{ vers: 'proposee', libelle: 'Marquer proposée', variante: 'primary' }],
  proposee: [
    { vers: 'acceptee', libelle: 'Acceptée', variante: 'primary' },
    { vers: 'refusee', libelle: 'Refusée', variante: 'secondary' },
  ],
  acceptee: [{ vers: 'realisee', libelle: 'Réalisée', variante: 'primary' }],
  refusee: [{ vers: 'proposee', libelle: 'Reproposer', variante: 'secondary' }],
  realisee: [],
};

/** Nouvelle version d'une recommandation après passage à `statut`, dates cohérentes. */
export function faireAvancer(r: RecommandationProprietaire, statut: StatutRecommandation, date = AUJOURDHUI): RecommandationProprietaire {
  switch (statut) {
    case 'a_proposer':
      return { ...r, statut, proposeeLe: undefined, decideeLe: undefined, realiseeLe: undefined };
    case 'proposee':
      return { ...r, statut, proposeeLe: date, decideeLe: undefined, realiseeLe: undefined };
    case 'acceptee':
    case 'refusee':
      return { ...r, statut, proposeeLe: r.proposeeLe ?? date, decideeLe: date, realiseeLe: undefined };
    case 'realisee':
      return { ...r, statut, proposeeLe: r.proposeeLe ?? date, decideeLe: r.decideeLe ?? date, realiseeLe: date };
  }
}

/** Recommandation « à proposer » créée depuis une amélioration de l'analyse. */
export function depuisAmelioration(a: Amelioration, analyse: AnalyseBien): RecommandationProprietaire {
  const l = analyse.logement;
  return {
    id: `reco-${l.id}-${a.code}`,
    logementId: l.id,
    proprietaireId: l.proprietaireId,
    code: a.code,
    titre: a.titre,
    detail: a.pourquoi,
    impactEstimeCentimesMois: a.impactEstime.centimesMois,
    impactSur: a.impactEstime.sur,
    porteur: a.porteur,
    statut: 'a_proposer',
    creeLe: AUJOURDHUI,
  };
}

export const LIBELLE_PORTEUR = { proprietaire: 'Propriétaire', label_maison: 'Label Maison' } as const;
export const LIBELLE_COUT = { faible: 'Coût faible', moyen: 'Coût moyen', eleve: 'Coût élevé' } as const;
export const LIBELLE_IMPACT = { revenu_bien: 'revenu du bien', marge_label_maison: 'marge Label Maison' } as const;
