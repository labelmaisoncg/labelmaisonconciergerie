/**
 * Couleur de chaque logement dans les réservations (Planning, Mois,
 * Séjours) : une pastille devant son nom. On reconnaît le logement d'un coup
 * d'œil ; le nom reste toujours écrit (rien n'est dit par la couleur seule).
 * Les bandes de séjour, elles, gardent leur sens : la plateforme dans le
 * Planning, l'encre dans Mois (un seul logement à la fois).
 *
 * - Huit teintes sourdes, jetons `--lm-logement-*` de erp.css, assez foncées
 *   pour un texte blanc, et loin des couleurs qui ont déjà un sens (encre
 *   Airbnb, sarcelle Booking, or des réservations directes, violet « Autre »,
 *   info, succès, danger, alerte) : vérifié par verifier-couleurs-logement.ts.
 * - La couleur d'un logement ne change que si on la change pour lui. Elle
 *   est enregistrée une fois : à la création (enregistrerLogement), au
 *   premier import d'une annonce, et à la synchronisation pour un logement
 *   importé qui n'en a pas encore (celle qu'il affiche déjà). Choisie
 *   ensuite dans « Modifier le logement ».
 * - Sans couleur enregistrée (logement ancien, démo) : couleur d'office
 *   selon le rang de son identifiant parmi tous les logements (tri
 *   numérique), sans tenir compte des couleurs choisies ni du statut. Choisir
 *   la couleur d'un logement, ou en sortir un, ne change donc la couleur
 *   d'aucun autre.
 *
 * Imports en « .js » : ce module tourne aussi côté serveur (synchronisation).
 */
import type { CouleurLogement, Id, Logement } from './types';

export interface TeinteLogement {
  cle: CouleurLogement;
  /** Nom lu par les lecteurs d'écran (« Ardoise »). */
  nom: string;
  /** Couleur de la pastille : un jeton de erp.css. */
  teinte: string;
}

/** Dans l'ordre d'attribution : les quatre premières, de teintes très éloignées, sont celles d'un petit parc. */
export const COULEURS_LOGEMENT: readonly TeinteLogement[] = [
  { cle: 'ardoise', nom: 'Ardoise', teinte: 'var(--lm-logement-ardoise)' },
  { cle: 'prune', nom: 'Prune', teinte: 'var(--lm-logement-prune)' },
  { cle: 'olive', nom: 'Olive', teinte: 'var(--lm-logement-olive)' },
  { cle: 'cacao', nom: 'Cacao', teinte: 'var(--lm-logement-cacao)' },
  { cle: 'petrole', nom: 'Pétrole', teinte: 'var(--lm-logement-petrole)' },
  { cle: 'framboise', nom: 'Framboise', teinte: 'var(--lm-logement-framboise)' },
  { cle: 'myrtille', nom: 'Myrtille', teinte: 'var(--lm-logement-myrtille)' },
  { cle: 'sapin', nom: 'Sapin', teinte: 'var(--lm-logement-sapin)' },
];

const PAR_CLE = new Map(COULEURS_LOGEMENT.map((c) => [c.cle, c]));

/** Valeur lue en base : une couleur connue, sinon rien (couleur d'office). */
export function teinteConnue(v: unknown): TeinteLogement | undefined {
  return typeof v === 'string' ? PAR_CLE.get(v as CouleurLogement) : undefined;
}

/** Tri des identifiants : « repull-101 » avant « repull-1000 ». */
const ordre = (a: string, b: string) => a.localeCompare(b, 'fr', { numeric: true });

type AvecCouleur = Pick<Logement, 'id' | 'couleur'>;

/**
 * La couleur de chaque logement de l'espace. Passer tous les logements (pas
 * seulement ceux affichés) : la couleur d'un logement ne dépend pas de l'écran.
 */
export function couleursDesLogements(logements: readonly AvecCouleur[]): Map<Id, TeinteLogement> {
  const rang = new Map([...logements].map((l) => l.id).sort(ordre).map((id, i) => [id, i]));
  return new Map(logements.map((l) => [l.id, teinteConnue(l.couleur) ?? COULEURS_LOGEMENT[(rang.get(l.id) ?? 0) % COULEURS_LOGEMENT.length]]));
}

/** Couleur d'un nouveau logement : la moins portée parmi celles des logements existants (à égalité, dans l'ordre de la palette). */
export function couleurLibre(logements: readonly AvecCouleur[]): CouleurLogement {
  const usages = new Map<CouleurLogement, number>(COULEURS_LOGEMENT.map((c) => [c.cle, 0]));
  for (const c of couleursDesLogements(logements).values()) usages.set(c.cle, (usages.get(c.cle) ?? 0) + 1);
  let retenue = COULEURS_LOGEMENT[0].cle;
  for (const c of COULEURS_LOGEMENT) if ((usages.get(c.cle) ?? 0) < (usages.get(retenue) ?? 0)) retenue = c.cle;
  return retenue;
}

/**
 * Synchronisation : la couleur à enregistrer pour chaque logement importé
 * (`estImporte` : créé par l'import d'une annonce, pas un logement fait à la
 * main puis relié, qui doit redevenir tel quel au « Délier ») qui n'en a pas
 * encore : celle qu'il affiche déjà (rien ne change à l'écran). Champ propre
 * à l'ERP : rien ne part vers les plateformes.
 */
export function couleursAEnregistrer<T extends AvecCouleur>(logements: readonly T[], estImporte: (l: T) => boolean): Map<Id, CouleurLogement> {
  const affichees = couleursDesLogements(logements);
  const r = new Map<Id, CouleurLogement>();
  for (const l of logements) if (estImporte(l) && !teinteConnue(l.couleur)) r.set(l.id, affichees.get(l.id)!.cle);
  return r;
}

/** Couleur → teinte, pour les composants partagés qui ne connaissent que des identifiants. */
export function teintesDesLogements(couleurs: ReadonlyMap<Id, TeinteLogement>): Map<Id, string> {
  return new Map([...couleurs].map(([id, c]) => [id, c.teinte]));
}
