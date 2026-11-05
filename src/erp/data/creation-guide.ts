/**
 * Fiche logement → Fiche voyageur : « Nouveau guide », pas à pas
 * (modules/logements/onglets/GuidesFiche.tsx). La modification garde sa
 * fenêtre.
 *
 * Son titre, quand l'envoyer (facultatif), un lien ou un fichier, l'adresse
 * ou le fichier, s'il contient l'accès au logement, puis le récapitulatif.
 *
 * Mêmes règles et même ligne que l'ancienne fenêtre : titre
 * obligatoire, lien en https:// ou fichier déposé ; un fichier choisi garde
 * son type (vidéo, photo, document) ; « quand » et « accès » n'apparaissent
 * que remplis ; ajouteLe et ajoutePar à la création. Comme avant, rien n'est
 * enregistré tant que la fiche n'a pas été enregistrée (« Enregistrer »).
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */
import { estLienGuide } from './guides';
import type { GuideLogement, Horodatage, Id } from './types';

/* ------------------------------------------------------------------ guide */

export const ECRANS_GUIDE = ['titre', 'quand', 'source', 'media', 'acces', 'recapitulatif'] as const;
export type EcranGuide = (typeof ECRANS_GUIDE)[number];

/** Saisie d'un guide (aussi celle de la fenêtre « Modifier le guide »). */
export interface BrouillonGuide {
  titre: string;
  quand: string;
  source: 'lien' | 'fichier';
  url: string;
  fichier: string;
  nomFichier: string;
  type: GuideLogement['media']['type'];
  acces: boolean;
}

export const guideVide = (): BrouillonGuide => ({ titre: '', quand: '', source: 'lien', url: '', fichier: '', nomFichier: '', type: 'lien', acces: false });

/** Les choix (lien ou fichier, accès) sont dits au-dessus de « Continuer ». */
export const SANS_CHAMP_GUIDE = new Set(['source', 'acces', 'fichier']);

/** Erreurs d'un écran ; le récapitulatif réunit celles de tous les écrans. */
export function erreursGuide(ecran: EcranGuide, b: BrouillonGuide): Record<string, string> {
  if (ecran === 'recapitulatif') return { ...erreursGuide('titre', b), ...erreursGuide('media', b) };
  const r: Record<string, string> = {};
  if (ecran === 'titre' && !b.titre.trim()) r.titre = 'Donnez un titre au guide.';
  if (ecran === 'media') {
    if (b.source === 'lien') {
      if (!b.url.trim()) r.url = 'Collez l’adresse du guide.';
      else if (!estLienGuide(b.url)) r.url = 'Lien non valable\u00a0: copiez-le en entier, depuis «\u00a0Partager\u00a0».';
    } else if (!b.fichier) r.fichier = 'Choisissez un fichier.';
  }
  return r;
}

const ECRAN_DE_LA_CLE: Record<string, EcranGuide> = { titre: 'titre', url: 'media', fichier: 'media' };
export const ecranDeLaCleGuide = (cle: string): EcranGuide => ECRAN_DE_LA_CLE[cle] ?? 'recapitulatif';

export type ResultatGuide = { ok: true; guide: GuideLogement } | { ok: false; ecran: EcranGuide; erreur: string };

/** Ce qu'ajoute « Ajouter le guide » : la même ligne que l'ancienne fenêtre « Nouveau guide ». */
export function guideDepuisBrouillon(b: BrouillonGuide, o: { id: Id; maintenant: Horodatage; par: string }): ResultatGuide {
  const erreurs = Object.entries(erreursGuide('recapitulatif', b));
  if (erreurs.length) return { ok: false, ecran: ecranDeLaCleGuide(erreurs[0][0]), erreur: erreurs[0][1] };
  return {
    ok: true,
    guide: {
      id: o.id,
      titre: b.titre.trim(),
      ...(b.quand.trim() ? { quand: b.quand.trim() } : {}),
      media: b.source === 'lien' ? { type: 'lien', url: b.url.trim() } : { type: b.type === 'lien' ? 'document' : b.type, fichier: b.fichier },
      ...(b.acces ? { acces: true } : {}),
      ajouteLe: o.maintenant,
      ajoutePar: o.par,
    },
  };
}

/** Lignes du récapitulatif ; `libelleType` : « Vidéo », « Photo »… */
export function recapGuide(b: BrouillonGuide, libelleType: (t: GuideLogement['media']['type']) => string): { cle: string; ecran: Exclude<EcranGuide, 'recapitulatif'>; libelle: string; valeur: string }[] {
  return [
    { cle: 'titre', ecran: 'titre', libelle: 'Titre', valeur: b.titre.trim() },
    { cle: 'quand', ecran: 'quand', libelle: 'Quand l’envoyer', valeur: b.quand.trim() || 'Votre agent choisit d’après le titre' },
    b.source === 'lien'
      ? { cle: 'media', ecran: 'media', libelle: 'Lien', valeur: estLienGuide(b.url) ? b.url.trim() : '' }
      : { cle: 'media', ecran: 'media', libelle: b.fichier ? libelleType(b.type === 'lien' ? 'document' : b.type) : 'Fichier', valeur: b.fichier ? b.nomFichier || 'Fichier joint' : '' },
    { cle: 'acces', ecran: 'acces', libelle: 'Accès au logement', valeur: b.acces ? 'Oui : seulement aux voyageurs confirmés, dans les 48 h avant l’arrivée' : 'Non' },
  ];
}
