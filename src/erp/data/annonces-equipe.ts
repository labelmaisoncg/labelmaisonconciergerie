/**
 * Annonces à l'équipe : un court message du gérant à tous les membres de son
 * espace (gérant, opérations, lecture), affiché en haut de l'Accueil tant que
 * chacun ne l'a pas fermé, et, si le gérant le demande, envoyé une seule fois
 * par notification aux appareils qui l'acceptent.
 *
 * À ne pas confondre avec l'annonce d'un logement sur Airbnb ou Booking
 * (collection versionsAnnonce, src/erp/annonces/) : rien ici ne touche les
 * plateformes.
 *
 * - Collection `annoncesEquipe` (erp.enregistrements), écrite par le gérant
 *   seul : la base refuse tout autre compte (erp.ecriture_gerant_seulement).
 * - « J'ai lu » reste sur l'appareil (localStorage, par espace et par
 *   personne) : un membre qui n'est pas gérant n'écrit rien dans la base.
 * - Un membre qui arrive plus tard voit les annonces encore publiées.
 * - Notification : le serveur relit l'annonce dans la base (jamais le texte
 *   du navigateur), clé d'idempotence `annonce-<id>`, rien pour une annonce
 *   retirée (notifications-envoi.ts, annoncerAEquipe).
 *
 * Module pur, contrôlé par verifier-annonces-equipe.ts. Imports en « .js » :
 * le serveur s'en sert (api/erp-notifications.ts).
 */
import { extrait, type GroupeNotification } from './notifications.js';
import type { Horodatage, Id } from './types';

/** Collection des annonces à l'équipe (une ligne par annonce). */
export const COLLECTION_ANNONCES_EQUIPE = 'annoncesEquipe';

/** Longueurs maximales saisies par le gérant. */
export const TITRE_MAX = 60;
export const TEXTE_MAX = 500;
/** Ce que montre une notification (écran verrouillé). */
export const TITRE_NOTIFICATION_MAX = 60;
export const TEXTE_NOTIFICATION_MAX = 140;
/** Annonces affichées ensemble sur l'Accueil (les suivantes après « J'ai lu »). */
export const AFFICHEES_MAX = 3;

export interface AnnonceEquipe {
  id: Id;
  titre: string;
  texte: string;
  publieeLe: Horodatage;
  /** Nom du gérant qui l'a publiée. */
  publieePar: string;
  /** Retirée par le gérant : plus affichée, plus jamais notifiée. */
  retireeLe?: Horodatage;
  retireePar?: string;
}

/** Ce que le gérant saisit. */
export interface SaisieAnnonce {
  titre: string;
  texte: string;
}

const ID = /^[A-Za-z0-9_-]{1,80}$/;

/** Identifiant d'annonce acceptable (aussi dans une adresse et une clé de notification). */
export const idAnnonceValide = (v: unknown): v is string => typeof v === 'string' && ID.test(v);

const dateValide = (v: unknown): v is string => typeof v === 'string' && !!v && !Number.isNaN(Date.parse(v));

/** Lecture tolérante d'une ligne : une ligne abîmée (sans titre, sans date) n'est jamais affichée ni envoyée. */
export function lireAnnonce(x: unknown): AnnonceEquipe | null {
  const a = x as Partial<Record<keyof AnnonceEquipe, unknown>> | null;
  if (!a || typeof a !== 'object' || !idAnnonceValide(a.id)) return null;
  const titre = typeof a.titre === 'string' ? a.titre.trim() : '';
  const texte = typeof a.texte === 'string' ? a.texte.trim() : '';
  if (!titre || !dateValide(a.publieeLe)) return null;
  const retiree = typeof a.retireeLe === 'string' && a.retireeLe.trim() !== '';
  return {
    id: a.id,
    titre,
    texte,
    publieeLe: a.publieeLe,
    publieePar: typeof a.publieePar === 'string' ? a.publieePar : '',
    ...(retiree ? { retireeLe: a.retireeLe as string, ...(typeof a.retireePar === 'string' ? { retireePar: a.retireePar } : {}) } : {}),
  };
}

const recentesDabord = (a: AnnonceEquipe, b: AnnonceEquipe) => Date.parse(b.publieeLe) - Date.parse(a.publieeLe) || b.id.localeCompare(a.id);

/** Annonces encore publiées (lisibles, non retirées), les plus récentes d'abord : la liste du gérant. */
export function annoncesPubliees(liste: readonly unknown[] | undefined): AnnonceEquipe[] {
  return (liste ?? [])
    .map(lireAnnonce)
    .filter((a): a is AnnonceEquipe => !!a && !a.retireeLe)
    .sort(recentesDabord);
}

/**
 * Ce qu'une personne voit en haut de l'Accueil : les annonces publiées, non
 * retirées, qu'elle n'a pas fermées sur cet appareil, les plus récentes
 * d'abord, `max` au plus.
 */
export function annoncesVisibles(liste: readonly unknown[] | undefined, fermees: Iterable<string>, max = AFFICHEES_MAX): AnnonceEquipe[] {
  const lues = new Set(fermees);
  return annoncesPubliees(liste)
    .filter((a) => !lues.has(a.id))
    .slice(0, Math.max(0, max));
}

/* ------------------------------------------------------------- gérant */

/** Le premier message, au nom de la conciergerie de l'espace (nomConciergerie, marque-espace.ts). */
export function premiereAnnonce(nomConciergerie: string): SaisieAnnonce {
  const nom = (nomConciergerie ?? '').trim();
  return {
    titre: 'Bonjour 👋',
    texte: `Bienvenue dans l’app${nom ? ` ${nom}` : ''}. Les nouvelles de l’équipe s’afficheront ici.`,
  };
}

/**
 * Formulaire au premier affichage : le premier message, prêt à publier en un
 * clic, tant que l'espace n'a aucune annonce (même retirée) ; vide ensuite.
 */
export function brouillonInitial(liste: readonly unknown[] | undefined, nomConciergerie: string): SaisieAnnonce {
  return (liste ?? []).length === 0 ? premiereAnnonce(nomConciergerie) : { titre: '', texte: '' };
}

/** Texte propre : retours à la ligne gardés (trois au plus d'affilée), espaces en trop retirés. */
function nettoyerTexte(t: string): string {
  return String(t ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type ResultatPreparation = { ok: true; annonce: AnnonceEquipe } | { ok: false; erreurs: Partial<Record<keyof SaisieAnnonce, string>> };

/** Annonce prête à enregistrer, ou ce qui manque (phrases affichées sous les champs). */
export function preparerAnnonce(s: SaisieAnnonce, o: { id: Id; maintenant: Horodatage; par: string }): ResultatPreparation {
  const titre = String(s.titre ?? '').replace(/\s+/g, ' ').trim();
  const texte = nettoyerTexte(s.texte);
  const erreurs: Partial<Record<keyof SaisieAnnonce, string>> = {};
  if (!titre) erreurs.titre = 'Donnez un titre à l’annonce.';
  else if (titre.length > TITRE_MAX) erreurs.titre = `${TITRE_MAX} caractères au plus.`;
  if (!texte) erreurs.texte = 'Écrivez quelques mots.';
  else if (texte.length > TEXTE_MAX) erreurs.texte = `${TEXTE_MAX} caractères au plus.`;
  if (erreurs.titre || erreurs.texte || !idAnnonceValide(o.id)) return { ok: false, erreurs };
  return { ok: true, annonce: { id: o.id, titre, texte, publieeLe: o.maintenant, publieePar: o.par } };
}

/** Retirée : elle disparaît de l'Accueil de tous et ne part plus jamais en notification. */
export function retirerAnnonce(a: AnnonceEquipe, o: { maintenant: Horodatage; par: string }): AnnonceEquipe {
  return { ...a, retireeLe: o.maintenant, retireePar: o.par };
}

/* ------------------------------------------- « J'ai lu » (sur l'appareil) */

const PREFIXE_FERMEES = 'lm-erp-annonces-equipe-lues';
/** Annonces fermées retenues sur l'appareil (les plus récentes). */
export const FERMEES_MAX = 200;

/** Clé localStorage propre à l'espace et à la personne. */
export function cleFermees(espace: string, personne: string): string {
  return `${PREFIXE_FERMEES}:${String(espace ?? '').toLowerCase()}:${String(personne ?? '').trim().toLowerCase()}`;
}

/** Lecture tolérante de ce qui est rangé (rien, illisible ou abîmé : aucune annonce fermée). */
export function lireFermees(brut: string | null | undefined): string[] {
  if (!brut) return [];
  try {
    const v = JSON.parse(brut) as unknown;
    return Array.isArray(v) ? [...new Set(v.filter(idAnnonceValide))].slice(-FERMEES_MAX) : [];
  } catch {
    return [];
  }
}

/** Ajoute une annonce fermée (sans doublon, bornée). */
export function fermerAnnonce(fermees: readonly string[], id: Id): string[] {
  if (!idAnnonceValide(id) || fermees.includes(id)) return [...fermees];
  return [...fermees, id].slice(-FERMEES_MAX);
}

/* -------------------------------------------------------- notification */

/** Clé d'idempotence (journal des envois) : une annonce ne part jamais deux fois. */
export const cleNotificationAnnonce = (id: Id): string => `annonce-${id}`;

/** La notification d'une annonce : titre et texte tronqués, ouvre l'Accueil. */
export function notificationAnnonce(a: Pick<AnnonceEquipe, 'id' | 'titre' | 'texte'>): GroupeNotification {
  return {
    cle: cleNotificationAnnonce(a.id),
    variantes: [
      {
        type: 'annonce',
        titre: extrait(a.titre, TITRE_NOTIFICATION_MAX),
        corps: extrait(a.texte || a.titre, TEXTE_NOTIFICATION_MAX),
        url: '/erp',
      },
    ],
  };
}

/** Seul le gérant de l'espace prévient l'équipe. */
export const peutAnnoncer = (role: string | undefined | null): boolean => role === 'gerant';

export const MESSAGE_ANNONCE_RESERVEE = 'Réservé au gérant.';

export type DecisionEnvoiAnnonce =
  | { ok: true; groupe: GroupeNotification }
  | { ok: false; statut: 400 | 403 | 404 | 409; code: 'gerant' | 'id' | 'introuvable' | 'retiree'; erreur: string };

/**
 * Le serveur peut-il envoyer cette annonce ? `enregistree` est la ligne relue
 * dans la base (jamais ce qu'envoie le navigateur). Refus : compte qui n'est
 * pas gérant, identifiant illisible, annonce absente ou abîmée, annonce
 * retirée.
 */
export function deciderEnvoiAnnonce(o: { role: string | undefined | null; id: unknown; enregistree: unknown }): DecisionEnvoiAnnonce {
  if (!peutAnnoncer(o.role)) return { ok: false, statut: 403, code: 'gerant', erreur: MESSAGE_ANNONCE_RESERVEE };
  if (!idAnnonceValide(o.id)) return { ok: false, statut: 400, code: 'id', erreur: 'Annonce inconnue.' };
  const a = lireAnnonce(o.enregistree);
  if (!a || a.id !== o.id) return { ok: false, statut: 404, code: 'introuvable', erreur: 'Annonce introuvable : elle n’est pas encore enregistrée.' };
  if (a.retireeLe) return { ok: false, statut: 409, code: 'retiree', erreur: 'Cette annonce a été retirée : elle ne part pas.' };
  return { ok: true, groupe: notificationAnnonce(a) };
}

/* ------------------------------------------------- après « Publier » */

/** Ce qu'est devenue la notification demandée à la publication. */
export type IssueNotification =
  | { genre: 'sans' }
  | { genre: 'demo' }
  | { genre: 'non-enregistree' }
  | { genre: 'envoyee' }
  | { genre: 'deja-partie' }
  | { genre: 'aucun-appareil' }
  /** `reessayable` : erreur inattendue (réseau, serveur), l'action peut être relancée pour la même annonce. */
  | { genre: 'echec'; raison?: string; reessayable?: boolean };

/** Réponse de l'action « annoncer » (api/erp-notifications.ts) traduite pour l'écran. */
export function issueDeLaReponse(r: { envoyees?: number; dejaPartie?: boolean; appareils?: number }): IssueNotification {
  if (r.dejaPartie) return { genre: 'deja-partie' };
  if ((r.envoyees ?? 0) > 0) return { genre: 'envoyee' };
  return { genre: 'aucun-appareil' };
}

/** Refus connus de l'action « annoncer » : leur message est relayé tel quel. */
export const CODES_REFUS_ANNONCE: readonly string[] = ['gerant', 'introuvable', 'retiree', 'inactif', 'envoi'];

/**
 * Échec de l'action « annoncer » traduit pour l'écran : le message du
 * serveur pour un refus connu, sinon une phrase simple (jamais une erreur
 * technique) et la possibilité de réessayer.
 */
export function issueDeLErreur(code: string | undefined, message: string | undefined): IssueNotification {
  if (code && CODES_REFUS_ANNONCE.includes(code) && (message ?? '').trim()) return { genre: 'echec', raison: (message ?? '').trim() };
  return { genre: 'echec', reessayable: true };
}

/** Message affiché sous le formulaire : l'annonce est toujours publiée, la notification le dit en clair. */
export function messagePublication(i: IssueNotification): { ton: 'succes' | 'alerte'; texte: string } {
  switch (i.genre) {
    case 'sans':
      return { ton: 'succes', texte: 'Annonce publiée.' };
    case 'demo':
      return { ton: 'succes', texte: 'Annonce publiée. Démonstration : la notification partirait vers les appareils de l’équipe.' };
    case 'envoyee':
      return { ton: 'succes', texte: 'Annonce publiée. La notification est partie.' };
    case 'deja-partie':
      return { ton: 'succes', texte: 'Annonce publiée. Sa notification était déjà partie.' };
    case 'aucun-appareil':
      return { ton: 'succes', texte: 'Annonce publiée. Aucun appareil n’a activé ces notifications : elle s’affiche sur l’Accueil de chacun.' };
    case 'non-enregistree':
      return { ton: 'alerte', texte: 'Annonce publiée, mais pas encore enregistrée : la notification n’est pas partie.' };
    case 'echec': {
      const raison = (i.raison ?? '').trim() || (i.reessayable ? 'Réessayez dans un instant.' : '');
      return { ton: 'alerte', texte: `Annonce publiée, mais la notification n’est pas partie.${raison ? ` ${raison}` : ''}` };
    }
  }
}
