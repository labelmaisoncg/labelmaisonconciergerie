/**
 * Classement du parc : score 0-100 par bien actif.
 *
 * Pondération : marge 35 %, occupation 20 %, note 20 %, charge
 * opérationnelle 15 %, conformité 10 %. Chaque composante est ramenée
 * linéairement entre 0 et 100 :
 * - marge / mois : 0 à 0 € ou moins, 100 à 400 € ou plus ;
 * - occupation (90 j) : 0 à 30 %, 100 à 90 % ;
 * - note (12 mois) : 0 à 4,0, 100 à 5,0 (50 si aucun avis) ;
 * - charge opérationnelle : 100 à 0 intervention pour 30 nuits, 0 à 3 ou plus ;
 * - conformité : 100, moins 40 par défaut grave de conformité, moins 15 par
 *   défaut mineur.
 */
import { logementsActifs } from '../data/selectors';
import type { DateISO, ErpDonnees } from '../data/types';
import { analyserBien } from './analyseBien';
import { contexteParc } from './contexte';
import type { AnalyseBien, ContexteParc, LigneParc } from './types';

const borne = (v: number, min: number, max: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));

export function scoreBien(a: AnalyseBien): number {
  const marge = borne(a.margeMois, 0, 40000);
  const occupation = borne(a.occupation90, 0.3, 0.9);
  const note = a.note12 === undefined ? 50 : borne(a.note12, 4, 5);
  const charge = a.kpis.find((k) => k.cle === 'chargeOps')?.valeur;
  const ops = charge === undefined ? 50 : 100 - borne(charge, 0, 3);
  const conformite = Math.max(
    0,
    100 - a.defauts.filter((d) => d.source === 'conformite').reduce((s, d) => s + (d.gravite === 'haute' ? 40 : 15), 0),
  );
  return Math.round(marge * 0.35 + occupation * 0.2 + note * 0.2 + ops * 0.15 + conformite * 0.1);
}

export interface AnalyseParc {
  lignes: LigneParc[];
  contexte: ContexteParc;
}

const cache = new WeakMap<ErpDonnees, Map<DateISO, AnalyseParc>>();

/** Tous les logements actifs, classés du meilleur score au moins bon. */
export function analyserParc(d: ErpDonnees, date: DateISO): AnalyseParc {
  const parDate = cache.get(d) ?? new Map<DateISO, AnalyseParc>();
  cache.set(d, parDate);
  const connu = parDate.get(date);
  if (connu) return connu;
  const lignes = logementsActifs(d.logements)
    .map((l) => {
      const analyse = analyserBien(d, l.id, date);
      const score = scoreBien(analyse);
      analyse.score = score;
      return { analyse, score, rang: 0, proprietaireId: l.proprietaireId };
    })
    .sort((a, b) => b.score - a.score)
    .map((x, i) => ({ ...x, rang: i + 1 }));
  const res = { lignes, contexte: contexteParc(d, date) };
  parDate.set(date, res);
  return res;
}
