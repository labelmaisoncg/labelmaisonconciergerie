/**
 * Relier un logement créé à la main à son annonce (Airbnb, Booking.com…),
 * et le délier après une erreur. Règles pures, sans réseau : utilisées par
 * l'écran (fiche du logement, page Connexions) et par le serveur
 * (repull-connexion.ts, api/erp-repull-connexion.ts), qui les revérifie
 * toujours sur ses propres données.
 *
 * Relier ne change rien sur les plateformes : le logement reçoit
 * `repull.id` (l'identifiant de l'annonce), puis l'annonce entre dans les
 * logements suivis de l'espace. La synchronisation met alors à jour CE
 * logement au lieu d'en créer un second (repull-synchro.ts, indexer) : nom,
 * photos, description, réservations et messages viennent de l'annonce ;
 * propriétaire, mandat, checklist, serrure, linge, numéro
 * d'enregistrement, adresse et position sur la carte restent ceux de
 * l'équipe (versLogement, repull.ts).
 *
 * Délier n'est permis que tant que rien de l'annonce n'est arrivé sur le
 * logement (ni réservation ni conversation) : le logement reprend alors ce
 * qu'il était avant le lien. Au-delà, défaire le lien voudrait déplacer
 * réservations, conversations et ménages : ce n'est pas fait ici.
 *
 * Ce module n'importe que des types et des constantes (il tourne aussi côté
 * serveur, hors de Vite).
 */
import { PREFIXE_REPULL } from './repull.js';
import type { ChampsAnnonce, FilMessages, Horodatage, Logement, Reservation } from './types';

/** Champs que l'annonce remplit ou remplace : gardés au moment du lien, rendus par « Délier ». */
export const CHAMPS_ANNONCE = [
  'nom',
  'adresse',
  'ville',
  'capacite',
  'chambres',
  'surfaceM2',
  'lits',
  'fiche',
  'annonces',
  'photoUrl',
  'photos',
  'descriptif',
  'tarifs',
] as const satisfies readonly (keyof ChampsAnnonce)[];

/** Identifiant d'annonce acceptable (celui du service de connexion : chiffres, lettres, « - », « _ »). */
const FORME_ANNONCE = /^[A-Za-z0-9_-]{1,64}$/;

export type Verdict = { ok: true } | { ok: false; erreur: string; statut: number };

const refus = (erreur: string, statut = 400): Verdict => ({ ok: false, erreur, statut });

/** Créé à la main (ou par un dossier propriétaire) : pas importé d'une annonce. */
export const creeALaMain = (l: Pick<Logement, 'id'>): boolean => !l.id.startsWith(PREFIXE_REPULL);

/** Relié à une annonce (importé, ou relié à la main). */
export const relie = (l: Pick<Logement, 'repull'>): boolean => !!l.repull?.id;

/** Relier et délier : un gérant, hors lecture seule. */
export const peutRelier = (role: string | undefined, lectureSeule = false): boolean => role === 'gerant' && !lectureSeule;

/** La ligne « Pas encore relié à une annonce » s'affiche-t-elle pour ce logement ? */
export const aRelier = (l: Pick<Logement, 'id' | 'repull' | 'statut'>): boolean => creeALaMain(l) && !relie(l) && l.statut !== 'sorti';

/**
 * Logement de l'espace déjà relié à cette annonce : importé (« repull-… »)
 * ou relié à la main, même en pause. Le logement relié à la main passe
 * d'abord, comme pour la synchronisation.
 */
export function logementDeLAnnonce<L extends Pick<Logement, 'id' | 'repull'>>(annonce: string, logements: readonly L[]): L | undefined {
  const lies = logements.filter((l) => l.repull?.id === annonce);
  return lies.find((l) => creeALaMain(l)) ?? lies[0];
}

/** Logements créés à la main, pas encore reliés (hors « sorti »), par nom. */
export function logementsARelier<L extends Pick<Logement, 'id' | 'repull' | 'statut' | 'nom'>>(logements: readonly L[]): L[] {
  return logements.filter(aRelier).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/** Relier ce logement ferait-il dépasser le nombre de logements suivis permis par l'offre ? */
export function depasseLimite(choix: readonly string[], annonce: string, limite: number | null | undefined): boolean {
  if (limite === null || limite === undefined || choix.includes(annonce)) return false;
  return new Set(choix).size + 1 > limite;
}

/** Une annonce trouvée sur les plateformes de l'espace (page Connexions). */
export interface AnnonceConnue {
  id: string;
  nom?: string;
  statutRepull?: string;
}

/**
 * Le lien est-il permis ? Gérant ; logement de l'espace, créé à la main,
 * pas encore relié ; annonce trouvée sur les plateformes de CET espace, ni
 * archivée, ni déjà dans l'ERP (importée ou reliée, même en pause).
 */
export function verifierLiaison(o: {
  role: string | undefined;
  logementId: string;
  annonceId: string;
  logements: readonly Logement[];
  annonces: readonly AnnonceConnue[];
}): Verdict {
  if (!peutRelier(o.role)) return refus('Seul un gérant peut relier un logement à son annonce.', 403);
  if (!FORME_ANNONCE.test(o.annonceId)) return refus('Annonce illisible : rechargez la page.');
  const l = o.logements.find((x) => x.id === o.logementId);
  if (!l) return refus('Logement introuvable dans cet espace.', 404);
  if (!creeALaMain(l)) return refus('Ce logement vient déjà d’une annonce.', 409);
  if (relie(l)) return refus(l.repull?.id === o.annonceId ? 'Ce logement est déjà relié à cette annonce.' : 'Ce logement est déjà relié à une annonce.', 409);
  const a = o.annonces.find((x) => x.id === o.annonceId);
  if (!a || a.statutRepull === 'archived') return refus('Cette annonce n’est pas sur les plateformes connectées à cet espace : rechargez la liste.', 404);
  const deja = logementDeLAnnonce(o.annonceId, o.logements);
  if (deja) return refus(`Cette annonce est déjà dans l’ERP : ${deja.nom}.`, 409);
  return { ok: true };
}

/** Ce que l'annonce pourra remplacer, tel qu'il est maintenant (copie). */
function champsAnnonce(l: Logement): ChampsAnnonce {
  const avant: Record<string, unknown> = {};
  for (const k of CHAMPS_ANNONCE) if (l[k] !== undefined) avant[k] = JSON.parse(JSON.stringify(l[k]));
  return avant as ChampsAnnonce;
}

/** Le logement relié : `repull.id` posé, et ce qu'il était avant gardé pour « Délier ». */
export function lierLogement(l: Logement, annonce: string, o: { le: Horodatage; par: string }): Logement {
  return { ...l, repull: { id: annonce }, liaison: { annonce, le: o.le, par: o.par, avant: champsAnnonce(l) } };
}

/** Réservations et conversations arrivées de l'annonce sur ce logement. */
export function arriveesDeLAnnonce(
  logementId: string,
  reservations: readonly Pick<Reservation, 'logementId' | 'repull'>[],
  fils: readonly Pick<FilMessages, 'logementId' | 'repull'>[],
): { reservations: number; conversations: number } {
  return {
    reservations: reservations.filter((r) => r.logementId === logementId && !!r.repull?.id).length,
    conversations: fils.filter((f) => f.logementId === logementId && !!f.repull?.id).length,
  };
}

/**
 * « Délier » est-il permis ? Seulement pour un lien fait depuis la fiche
 * (on sait ce que le logement était avant), et tant que rien de l'annonce
 * n'est arrivé sur le logement.
 */
export function delierPossible(
  l: Logement,
  reservations: readonly Pick<Reservation, 'logementId' | 'repull'>[],
  fils: readonly Pick<FilMessages, 'logementId' | 'repull'>[],
): Verdict {
  if (!creeALaMain(l) || !relie(l) || !l.liaison || l.liaison.annonce !== l.repull?.id) return refus('Ce lien ne se retire pas d’ici.', 409);
  const a = arriveesDeLAnnonce(l.id, reservations, fils);
  if (a.reservations || a.conversations) {
    return refus('Des réservations ou des messages de l’annonce sont déjà arrivés sur ce logement : le lien ne se retire plus d’ici.', 409);
  }
  return { ok: true };
}

/** Le logement délié : sans annonce, avec ce qu'il était avant le lien. */
export function delierLogement(l: Logement): Logement {
  const { repull: _annonce, liaison, ...reste } = l;
  const suivant = { ...reste } as Record<string, unknown>;
  const avant = (liaison?.avant ?? {}) as Record<string, unknown>;
  for (const k of CHAMPS_ANNONCE) {
    if (k in avant) suivant[k] = avant[k];
    else delete suivant[k];
  }
  return suivant as unknown as Logement;
}
