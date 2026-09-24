/**
 * Seuils d'interprétation des indicateurs d'un bien (SPEC §10).
 *
 * Chaque indicateur a trois niveaux : « bon », « correct », « faible ». Les
 * seuils sont ceux que Label Maison applique pour décider de garder, de
 * renégocier ou de sortir un bien ; ils sont expliqués en français simple
 * pour que tout le monde (associés, propriétaires) lise la même chose.
 *
 * Unités des valeurs passées à `interpreter` :
 * - ratios entre 0 et 1 (occupation, marge %, ménages avec photos) ;
 * - ratios « vs parc » autour de 1 (1 = médiane du parc) ;
 * - centimes pour les montants ; minutes pour les délais ; lettre pour le DPE.
 */
import { euros, nombre, pourcentage } from '../data/format';

export type NiveauKpi = 'bon' | 'correct' | 'faible';

export type CleKpi =
  | 'occupation'
  | 'adr'
  | 'revpar'
  | 'note'
  | 'margeMois'
  | 'margePct'
  | 'commission'
  | 'couvertureMenage'
  | 'incidents'
  | 'chargeOps'
  | 'menagesPhotos'
  | 'delaiReponse'
  | 'nuitsRestantes'
  | 'dpe';

export interface SeuilKpi {
  libelle: string;
  /** Ce que mesure l'indicateur, en une phrase. */
  description: string;
  /** Pourquoi Label Maison le suit. */
  pourquoi: string;
  /** Sens favorable : plus haut est mieux, ou plus bas est mieux. */
  sens: 'haut' | 'bas';
  /** Limite du niveau « bon » (incluse). */
  bon: number;
  /** Limite sous (ou au-dessus de) laquelle le niveau est « faible » (exclue). */
  faible: number;
  /** Textes des trois niveaux, affichés dans le glossaire et les infobulles. */
  lecture: Record<NiveauKpi, string>;
  /** Affichage d'une valeur. */
  formater: (v: number) => string;
}

const pct = (v: number) => pourcentage(v);
const ratioParc = (v: number) => `${v >= 1 ? '+' : ''}${nombre((v - 1) * 100)} % vs parc`;

export const SEUILS: Record<CleKpi, SeuilKpi> = {
  occupation: {
    libelle: 'Taux d’occupation',
    description: 'Nuits vendues divisées par les nuits où le bien était proposé à la location (90 derniers jours).',
    pourquoi: 'Un bien peu occupé rapporte peu de commission mais coûte autant en gestion.',
    sens: 'haut', bon: 0.7, faible: 0.55,
    lecture: { bon: '70 % ou plus : le bien se loue bien.', correct: 'Entre 55 et 70 % : dans la moyenne, marge de progrès.', faible: 'Moins de 55 % : prix, annonce ou attractivité à revoir.' },
    formater: pct,
  },
  adr: {
    libelle: 'Prix moyen par nuit (ADR)',
    description: 'Revenu d’hébergement (hors frais de ménage) divisé par les nuits vendues, comparé à la médiane du parc.',
    pourquoi: 'Montre si le bien se vend au bon prix par rapport aux autres biens gérés.',
    sens: 'haut', bon: 1, faible: 0.85,
    lecture: { bon: 'Au niveau de la médiane du parc ou au-dessus.', correct: 'Jusqu’à 15 % sous la médiane.', faible: 'Plus de 15 % sous la médiane : bien sous-valorisé ou moins attractif.' },
    formater: ratioParc,
  },
  revpar: {
    libelle: 'RevPAR vs parc',
    description: 'Revenu d’hébergement par nuit disponible (occupation × prix), comparé à la médiane du parc.',
    pourquoi: 'C’est l’indicateur qui résume le mieux la performance commerciale d’un bien.',
    sens: 'haut', bon: 1, faible: 0.85,
    lecture: { bon: 'Au niveau de la médiane du parc ou au-dessus.', correct: 'Jusqu’à 15 % sous la médiane.', faible: 'Plus de 15 % sous la médiane.' },
    formater: ratioParc,
  },
  note: {
    libelle: 'Note voyageurs',
    description: 'Moyenne des notes laissées par les voyageurs sur 12 mois (sur 5).',
    pourquoi: 'Sous 4,6 les plateformes déclassent l’annonce ; sous 4,5 Airbnb peut la suspendre.',
    sens: 'haut', bon: 4.8, faible: 4.6,
    lecture: { bon: '4,8 ou plus : excellent, le bien est mis en avant.', correct: 'Entre 4,6 et 4,8 : correct, surveiller les commentaires.', faible: 'Moins de 4,6 : visibilité en baisse, corriger les causes.' },
    formater: (v) => nombre(v, 2),
  },
  margeMois: {
    libelle: 'Marge Label Maison / mois',
    description: 'Commission + frais de ménage encaissés, moins ménages payés, charges du bien, incidents non refacturés et quote-part des frais de structure, ramenés à 30 jours.',
    pourquoi: 'C’est ce que le bien rapporte réellement à Label Maison.',
    sens: 'haut', bon: 25000, faible: 10000,
    lecture: { bon: '250 € ou plus par mois : bien rentable.', correct: 'Entre 100 et 250 € : rentable mais fragile.', faible: 'Moins de 100 € : le bien couvre à peine son coût de gestion.' },
    formater: (v) => euros(v, true),
  },
  margePct: {
    libelle: 'Taux de marge',
    description: 'Marge Label Maison divisée par le chiffre d’affaires Label Maison du bien.',
    pourquoi: 'Mesure la part du chiffre d’affaires qui reste après les coûts directs.',
    sens: 'haut', bon: 0.35, faible: 0.2,
    lecture: { bon: '35 % ou plus.', correct: 'Entre 20 et 35 %.', faible: 'Moins de 20 % : coûts trop lourds pour ce que le bien rapporte.' },
    formater: pct,
  },
  commission: {
    libelle: 'Taux de commission',
    description: 'Pourcentage prélevé par Label Maison sur le revenu net de plateforme (hors ménage), fixé au mandat.',
    pourquoi: 'La cible Label Maison est 18 à 20 %. Les anciens mandats à 10 % sont à renégocier.',
    sens: 'haut', bon: 18, faible: 15,
    lecture: { bon: '18 % ou plus : dans la cible.', correct: 'Entre 15 et 18 % : sous la cible.', faible: 'Moins de 15 % : à renégocier au renouvellement.' },
    formater: (v) => `${nombre(v)} %`,
  },
  couvertureMenage: {
    libelle: 'Couverture du ménage',
    description: 'Frais de ménage facturés au voyageur divisés par le coût moyen d’un ménage payé au prestataire.',
    pourquoi: 'Le ménage ne doit jamais coûter plus qu’il ne rapporte (linge et produits en plus).',
    sens: 'haut', bon: 1.15, faible: 1,
    lecture: { bon: 'Frais au moins 15 % au-dessus du coût.', correct: 'Frais à peine au-dessus du coût.', faible: 'Frais inférieurs au coût : chaque séjour fait perdre de l’argent.' },
    formater: (v) => `${nombre(v * 100)} %`,
  },
  incidents: {
    libelle: 'Incidents / 30 nuits',
    description: 'Nombre d’incidents déclarés rapporté à 30 nuits vendues (12 mois).',
    pourquoi: 'Chaque incident coûte du temps, de l’argent et souvent une note.',
    sens: 'bas', bon: 0.5, faible: 1.5,
    lecture: { bon: 'Au plus 0,5 incident pour 30 nuits.', correct: 'Jusqu’à 1,5 incident pour 30 nuits.', faible: 'Plus de 1,5 : bien fragile ou mal équipé.' },
    formater: (v) => nombre(v, 1),
  },
  chargeOps: {
    libelle: 'Charge opérationnelle',
    description: 'Interventions hors ménage courant (incidents, maintenance, contrôles) pour 30 nuits vendues.',
    pourquoi: 'Mesure le temps que le bien consomme à l’équipe, en plus des ménages.',
    sens: 'bas', bon: 1, faible: 2.5,
    lecture: { bon: 'Au plus 1 intervention pour 30 nuits.', correct: 'Entre 1 et 2,5.', faible: 'Plus de 2,5 : bien chronophage.' },
    formater: (v) => nombre(v, 1),
  },
  menagesPhotos: {
    libelle: 'Ménages validés avec photos',
    description: 'Part des ménages passés validés avec photos avant et après (90 jours).',
    pourquoi: 'Règle SPEC §2.4 : sans photos, pas de validation ni de paiement.',
    sens: 'haut', bon: 0.95, faible: 0.85,
    lecture: { bon: '95 % ou plus.', correct: 'Entre 85 et 95 %.', faible: 'Moins de 85 % : contrôle du prestataire à renforcer.' },
    formater: pct,
  },
  delaiReponse: {
    libelle: 'Délai de réponse',
    description: 'Temps moyen entre un message voyageur et la réponse (agent ou humain), en minutes.',
    pourquoi: 'Les plateformes récompensent les réponses en moins d’une heure.',
    sens: 'bas', bon: 15, faible: 60,
    lecture: { bon: '15 minutes ou moins.', correct: 'Entre 15 et 60 minutes.', faible: 'Plus d’une heure : risque sur la note et le classement.' },
    formater: (v) => `${nombre(v)} min`,
  },
  nuitsRestantes: {
    libelle: 'Nuits restantes (120 nuits)',
    description: 'Pour une résidence principale : nuits encore vendables cette année avant le plafond légal de 120.',
    pourquoi: 'Au-delà de 120 nuits, la location est illégale (SPEC §2.10).',
    sens: 'haut', bon: 30, faible: 10,
    lecture: { bon: '30 nuits ou plus en réserve.', correct: 'Entre 10 et 30 nuits : planifier la fin de saison.', faible: 'Moins de 10 nuits : fermer le calendrier bientôt.' },
    formater: (v) => nombre(v),
  },
  dpe: {
    libelle: 'DPE',
    description: 'Classe énergétique du bien. Loi Le Meur : F minimum depuis 2025, E en 2028, D en 2034 pour un meublé de tourisme.',
    pourquoi: 'Un DPE trop bas interdit la location à court terme à l’échéance.',
    sens: 'haut', bon: 3, faible: 2,
    lecture: { bon: 'A à D : conforme jusqu’en 2034 au moins.', correct: 'E : conforme jusqu’en 2034, travaux à prévoir.', faible: 'F ou G : location interdite ou menacée dès 2028.' },
    formater: (v) => 'GFEDCBA'[v] ?? '-',
  },
};

/** DPE en score : G = 0 ... A = 6 (seuils : D = 3 est « bon », E = 2 « correct »). */
export function scoreDpe(dpe: string | undefined): number | undefined {
  if (!dpe) return undefined;
  const i = 'GFEDCBA'.indexOf(dpe.toUpperCase());
  return i === -1 ? undefined : i;
}

export interface Interpretation {
  niveau: NiveauKpi;
  explication: string;
}

/** Niveau d'une valeur et phrase d'explication associée. */
export function interpreter(kpi: CleKpi, valeur: number | string): Interpretation {
  const s = SEUILS[kpi];
  if (kpi === 'dpe') {
    const n = typeof valeur === 'number' ? valeur : scoreDpe(valeur);
    const niveau: NiveauKpi = n === undefined || n <= 1 ? 'faible' : n === 2 ? 'correct' : 'bon';
    return { niveau, explication: `${s.description} ${s.lecture[niveau]}` };
  }
  const v = typeof valeur === 'number' ? valeur : Number(valeur);
  let niveau: NiveauKpi;
  if (s.sens === 'haut') niveau = v >= s.bon ? 'bon' : v < s.faible ? 'faible' : 'correct';
  else niveau = v <= s.bon ? 'bon' : v > s.faible ? 'faible' : 'correct';
  return { niveau, explication: `${s.description} ${s.lecture[niveau]}` };
}

/** Ton d'affichage d'un niveau (Badge, cellules colorées). */
export const TON_NIVEAU = { bon: 'succes', correct: 'alerte', faible: 'danger' } as const;
export const LIBELLE_NIVEAU: Record<NiveauKpi, string> = { bon: 'Bon', correct: 'Correct', faible: 'Faible' };
