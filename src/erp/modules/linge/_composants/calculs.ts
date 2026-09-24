/**
 * Position du linge d'un logement, à partir de sa dotation et du bilan des
 * mouvements (selectors.bilanLinge) :
 * - sale : sorti sale, pas encore envoyé en blanchisserie ;
 * - blanchisserie : envoyé, pas encore revenu propre ;
 * - perdu : pertes et rebuts cumulés ;
 * - en place : le reste de la dotation (au logement ou en réserve propre).
 */
import { bilanLinge } from '../../../data/selectors';
import type { Logement, MouvementLinge } from '../../../data/types';

export interface PositionArticle {
  article: string;
  dotation: number;
  enPlace: number;
  sale: number;
  blanchisserie: number;
  perdu: number;
}

export interface PositionLogement {
  logement: Logement;
  articles: PositionArticle[];
  total: Omit<PositionArticle, 'article'>;
}

export function positionLinge(logement: Logement, mouvements: MouvementLinge[]): PositionLogement {
  const bilan = bilanLinge(mouvements, logement.id);
  const noms = new Set([...logement.dotationLinge.map((a) => a.article), ...bilan.keys()]);
  const articles = [...noms].map((article) => {
    const b = bilan.get(article);
    const dotation = logement.dotationLinge.find((a) => a.article === article)?.quantite ?? 0;
    const sale = Math.max(0, (b?.sortie_sale ?? 0) - (b?.envoi_blanchisserie ?? 0));
    const blanchisserie = Math.max(0, (b?.envoi_blanchisserie ?? 0) - (b?.retour_propre ?? 0));
    const perdu = (b?.perte ?? 0) + (b?.rebut ?? 0);
    return { article, dotation, sale, blanchisserie, perdu, enPlace: Math.max(0, dotation - sale - blanchisserie - perdu) };
  });
  const somme = (k: keyof Omit<PositionArticle, 'article'>) => articles.reduce((s, a) => s + a[k], 0);
  return {
    logement,
    articles,
    total: { dotation: somme('dotation'), enPlace: somme('enPlace'), sale: somme('sale'), blanchisserie: somme('blanchisserie'), perdu: somme('perdu') },
  };
}

export function totalArticles(m: MouvementLinge): number {
  return m.articles.reduce((s, a) => s + a.quantite, 0);
}

/** Référence d'envoi inscrite dans la description d'un incident d'écart. */
export const refEnvoi = (envoiId: string) => `Réf. envoi ${envoiId}`;
