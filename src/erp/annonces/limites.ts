/**
 * Limites de caractères des plateformes pour les textes d'une annonce,
 * relevées en octobre 2026. L'ERP ne publie jamais une annonce : ces limites
 * servent aux textes que l'équipe copie puis colle elle-même sur Airbnb ou
 * Booking.com (src/erp/annonces/textes.ts).
 *
 * Airbnb (pas de page officielle qui donne le chiffre ; relevé par les
 * gestionnaires connectés à Airbnb, et confirmé par l'erreur d'Airbnb au-delà) :
 *   - titre : 50 caractères au plus, espaces compris ; ni symbole ni emoji ;
 *   - description de l'annonce : 500 caractères au plus (les rubriques
 *     « Le logement », « Accès des voyageurs »… ont chacune leur champ).
 *   Sources :
 *   - https://help.supercontrol.co.uk/a/1633773-airbnb-new-content-character-limit-restrictions-full-content-only
 *     (« 50 characters (max) for the Property name and 500 characters (max)
 *     for the property Listing description », depuis le 5 juillet 2022) ;
 *   - https://www.ownerrez.com/support/articles/channel-management-api-integrations-property-field-differences
 *     (Airbnb : titre 1 à 50, description 1 à 500) ;
 *   - https://help.guestyforhosts.com/hc/en-gb/articles/11783015183133
 *     (50 caractères, espaces compris) ;
 *   - https://www.airbnb.com/help/article/3021 (« don't use symbols or emojis
 *     in your title », rien de trompeur).
 *   Airbnb conseille 32 caractères pour que le titre s'affiche en entier sur
 *   téléphone : c'est la longueur visée, pas une limite.
 *
 * Booking.com (documentation officielle des partenaires connectés) :
 *   - nom de l'établissement (le titre vu par les voyageurs) : 3 à 255
 *     caractères ; ni numéro de téléphone (pas plus de 5 chiffres de suite),
 *     ni emoji, pas tout en majuscules ; seulement des lettres, des chiffres
 *     et ! # & ` ' " - , ; caractères latins ;
 *     https://developers.booking.com/connectivity/docs/tsk-create-property
 *   - description de l'établissement : 65 535 caractères au plus ;
 *     https://developers.booking.com/connectivity/docs/property-api/description-endpoint/managing-property-description
 *   Les gestionnaires connectés conseillent 80 caractères au plus pour le
 *   nom d'une location (OwnerRez : 3 à 80).
 *
 * Une seule description pour les deux plateformes : elle tient dans la plus
 * courte (500, Airbnb). Trois titres : chacun tient dans 50 (Airbnb), donc
 * aussi chez Booking.com.
 */

export type PlateformeAnnonce = 'airbnb' | 'booking';

export interface LimitesPlateforme {
  nom: string;
  titre: { min: number; max: number; conseille: number };
  description: { max: number };
}

export const LIMITES_PLATEFORMES: Record<PlateformeAnnonce, LimitesPlateforme> = {
  airbnb: { nom: 'Airbnb', titre: { min: 1, max: 50, conseille: 32 }, description: { max: 500 } },
  booking: { nom: 'Booking.com', titre: { min: 3, max: 255, conseille: 80 }, description: { max: 65_535 } },
};

/** Limite qui vaut pour les deux plateformes : la plus courte. */
export const TITRE_MAX = Math.min(LIMITES_PLATEFORMES.airbnb.titre.max, LIMITES_PLATEFORMES.booking.titre.max);
export const TITRE_MIN = Math.max(LIMITES_PLATEFORMES.airbnb.titre.min, LIMITES_PLATEFORMES.booking.titre.min);
export const DESCRIPTION_MAX = Math.min(LIMITES_PLATEFORMES.airbnb.description.max, LIMITES_PLATEFORMES.booking.description.max);
/** En dessous, la description est trop pauvre pour être utile (qualité, pas une règle des plateformes). */
export const DESCRIPTION_MIN = 160;
/** Trois titres proposés par logement (cahier A6). */
export const NOMBRE_TITRES = 3;
/** Booking.com refuse un nom avec plus de 5 chiffres de suite (numéro de téléphone). */
export const CHIFFRES_DE_SUITE_MAX = 5;
