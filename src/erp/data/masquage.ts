/**
 * Coordonnées retirées d'un texte libre avant de le donner à l'IA : liens,
 * adresses e-mail et numéros de téléphone remplacés par « … ». Une seule
 * règle pour tout l'ERP : réponses aux avis (avis.ts, textePourIA) et
 * relances du CRM (crm-assistant.ts, contexteRelance).
 *
 * Le texte est d'abord nettoyé (NFKC, caractères invisibles retirés) : un
 * numéro coupé par un caractère invisible ou écrit en chiffres pleine
 * largeur est masqué comme les autres.
 *
 * Module pur ; imports en « .js » : il tourne aussi côté serveur.
 */
import { nettoyerTexte } from './messagerie-ia.js';

/** Lien (http, https, www). */
export const MOTIF_LIEN = /https?:\/\/\S+|www\.\S+/gi;
/** Adresse e-mail. */
export const MOTIF_EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
/**
 * Adresse e-mail déguisée : « jean (at) exemple point fr », « jean [at] exemple »,
 * « jean arobase exemple », « jean @ exemple . fr », ou « jean at exemple dot fr »
 * (avec « at » seul, seulement suivi d'un domaine et de son extension : « arrive
 * at noon » reste intact).
 */
const DOMAINE_SUITE = String.raw`(?:\s*(?:\.|[([{]\s*(?:dot|point)\s*[)\]}]|\s(?:dot|point)\s)\s*[\p{L}\p{N}-]+)`;
export const MOTIF_EMAIL_DEGUISE = new RegExp(
  String.raw`[\p{L}\p{N}._%+-]+\s*(?:[([{]\s*(?:at|arobase)\s*[)\]}]|\sarobase\s|@)\s*[\p{L}\p{N}-]+${DOMAINE_SUITE}*` +
    String.raw`|[\p{L}\p{N}._%+-]+\sat\s[\p{L}\p{N}-]+${DOMAINE_SUITE}*\s*(?:\.|[([{]\s*(?:dot|point)\s*[)\]}]|\s(?:dot|point)\s)\s*(?:fr|com|net|org|eu|io|be|ch|de|es|it|uk|co)(?![\p{L}\p{N}])`,
  'giu',
);
/** Numéro de téléphone (8 chiffres ou plus ; espaces, points, tirets, barres, soulignés ou parenthèses compris ; « + » devant). */
export const MOTIF_TELEPHONE = /\+?\(?\d[\d\s.\-/_()]{7,}\d/g;

/** Le texte, sans lien, e-mail ni téléphone (remplacés par « … »). */
export function masquerCoordonnees(texte: string | undefined | null): string {
  return nettoyerTexte(String(texte ?? ''))
    .replace(MOTIF_LIEN, '…')
    .replace(MOTIF_EMAIL, '…')
    .replace(MOTIF_EMAIL_DEGUISE, '…')
    .replace(MOTIF_TELEPHONE, '…');
}
