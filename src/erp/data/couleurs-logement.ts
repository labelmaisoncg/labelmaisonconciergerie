/**
 * Couleur de chaque logement dans les calendriers (Réservations : Planning,
 * Mois, Séjours) : une pastille devant son nom, et ses séjours à venir de
 * cette couleur dans la vue Mois. On reconnaît le logement d'un coup d'œil ;
 * le nom reste toujours écrit (rien n'est dit par la couleur seule).
 *
 * - Huit teintes sourdes, accordées aux couleurs Label Maison, toutes assez
 *   foncées pour un texte blanc (contraste 4,5:1 au moins, vérifié par
 *   verifier-couleurs-logement.ts). Aucune ne reprend la couleur d'un canal
 *   du Planning (encre Airbnb, sarcelle Booking, or des réservations
 *   directes) : une bande colorée ne se lit pas comme un canal.
 * - Une couleur choisie (« Modifier le logement ») est gardée telle quelle.
 * - Sinon, attribution d'office : les logements en service d'abord (sortis à
 *   la fin), puis dans l'ordre de leur identifiant, chacun prend la teinte la
 *   moins utilisée (à égalité, dans l'ordre de la palette). Ainsi, jusqu'à
 *   huit logements, deux logements n'ont jamais la même couleur.
 */
import type { CouleurLogement, Id, Logement } from './types';

export interface TeinteLogement {
  cle: CouleurLogement;
  /** Nom lu par les lecteurs d'écran (« Bleu »). */
  nom: string;
  /** Couleur de la pastille et des bandes. */
  teinte: string;
}

/** Dans l'ordre d'attribution : les quatre premières sont les plus éloignées les unes des autres. */
export const COULEURS_LOGEMENT: readonly TeinteLogement[] = [
  { cle: 'bleu', nom: 'Bleu', teinte: '#2f5f8f' },
  { cle: 'terre', nom: 'Terre cuite', teinte: '#a24a2a' },
  { cle: 'vert', nom: 'Vert', teinte: '#2f6b4f' },
  { cle: 'prune', nom: 'Prune', teinte: '#7b3f6e' },
  { cle: 'framboise', nom: 'Framboise', teinte: '#a3304f' },
  { cle: 'olive', nom: 'Olive', teinte: '#5d6a1e' },
  { cle: 'indigo', nom: 'Indigo', teinte: '#4a4f9e' },
  { cle: 'cacao', nom: 'Cacao', teinte: '#6e4b3a' },
];

const PAR_CLE = new Map(COULEURS_LOGEMENT.map((c) => [c.cle, c]));

/** Valeur lue en base : une couleur connue, sinon rien (attribution d'office). */
export function teinteConnue(v: unknown): TeinteLogement | undefined {
  return typeof v === 'string' ? PAR_CLE.get(v as CouleurLogement) : undefined;
}

/**
 * La couleur de chaque logement de l'espace. Passer tous les logements (pas
 * seulement ceux affichés) : la couleur d'un logement ne dépend pas de l'écran.
 */
export function couleursDesLogements(logements: readonly Pick<Logement, 'id' | 'statut' | 'couleur'>[]): Map<Id, TeinteLogement> {
  const resultat = new Map<Id, TeinteLogement>();
  const usages = new Map<CouleurLogement, number>(COULEURS_LOGEMENT.map((c) => [c.cle, 0]));
  const aAttribuer: Pick<Logement, 'id' | 'statut'>[] = [];
  for (const l of logements) {
    const choisie = teinteConnue(l.couleur);
    if (choisie) {
      resultat.set(l.id, choisie);
      usages.set(choisie.cle, (usages.get(choisie.cle) ?? 0) + 1);
    } else aAttribuer.push(l);
  }
  aAttribuer.sort((a, b) => Number(a.statut === 'sorti') - Number(b.statut === 'sorti') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const l of aAttribuer) {
    let retenue = COULEURS_LOGEMENT[0];
    for (const c of COULEURS_LOGEMENT) if ((usages.get(c.cle) ?? 0) < (usages.get(retenue.cle) ?? 0)) retenue = c;
    resultat.set(l.id, retenue);
    usages.set(retenue.cle, (usages.get(retenue.cle) ?? 0) + 1);
  }
  return resultat;
}

/** Couleur → teinte, pour les composants partagés qui ne connaissent que des identifiants. */
export function teintesDesLogements(couleurs: ReadonlyMap<Id, TeinteLogement>): Map<Id, string> {
  return new Map([...couleurs].map(([id, c]) => [id, c.teinte]));
}
