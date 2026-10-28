// =============================================================================
// /api/sejour — livret d'accueil et check-in en ligne d'un séjour (cahier B2).
//
// Voyageur (sans compte, page /sejour#<jeton>) : POST seulement, depuis le
// site (Origin), jeton dans le corps (jamais dans l'adresse) :
//   POST { action: 'vue', jeton }                     ce que la page montre
//   POST { action: 'checkin', jeton, checkin, langue } enregistre le check-in,
//                                                     renvoie la vue à jour
// Le jeton signé désigne une réservation dans UN espace : tout est lu et
// écrit dans la base de cet espace seulement. Réservation annulée : rien
// (410) ; lien expiré quelques jours après le départ : rien (410). Codes et
// wifi : règle des 48 h appliquée ici, jamais par le navigateur.
//
// Équipe (Authorization: Bearer <session Supabase>, gérant ou opérations de
// l'espace de l'en-tête x-erp-espace) :
//   GET ?action=equipe&reservationId=…   lien à copier, check-in envoyé
//
// Écritures : la seule ligne du check-in de CE séjour (collection
// checkinsEnLigne, id = réservation), bornée (taille, champs contrôlés,
// MAX_ENVOIS_CHECKIN envois par séjour, frein par adresse IP, écriture
// conditionnelle). Rien vers les plateformes, rien pour l'IA.
// Règles : src/erp/data/sejour.ts ; briques : api/_sejour.ts.
// =============================================================================

import { verifierMembre } from '../src/erp/data/repull-synchro.js';
import { dateParisISO } from '../src/erp/data/proprietaire.js';
import {
  COLLECTION_CHECKINS,
  MESSAGES_REFUS_CHECKIN,
  TAILLE_MAX_ENVOI,
  etatLienSejour,
  lienValableJusquAu,
  lireJetonSejour,
  lireSaisieCheckin,
  nouveauCheckin,
  suiviCheckin,
  type CheckinEnLigne,
  type LangueSejour,
  type SuiviSejour,
} from '../src/erp/data/sejour.js';
import type { Reservation } from '../src/erp/data/types';
import { baseAcces } from './_acces-externe.js';
import { espaceDemande } from './_erp-espaces.js';
import { lireCorps, repondre } from './_erp-repull.js';
import { adresseIp, freinEnvois, provenanceSite } from './_garde-formulaire.js';
import { MESSAGE_SANS_SECRET, checkinPret, lienSejourServeur, lireSejour, secretSejour, vueDuSejour } from './_sejour.js';

/** Appels du livret par adresse IP (lecture et envoi), par instance : un frein, pas un mur. */
const tropDAppels = freinEnvois(60, 15 * 60_000);
/** Envois du formulaire par adresse IP. */
const tropDEnvois = freinEnvois(10, 60 * 60_000);
/** Jetons refusés par adresse IP : au-delà, plus rien n'est vérifié pour elle pendant 15 minutes. */
const tropDeRefus = freinEnvois(10, 15 * 60_000);
const refusRecents = new Map<string, number>();

const MESSAGES = {
  inconnu: { fr: 'Ce lien n’est pas valable. Ouvrez le lien reçu dans votre messagerie de réservation.', en: 'This link is not valid. Open the link from your booking messages.' },
  annule: { fr: 'Ce séjour a été annulé.', en: 'This stay has been cancelled.' },
  expire: { fr: 'Ce lien a expiré.', en: 'This link has expired.' },
  pas_pret: { fr: 'Le check-in en ligne n’est pas encore ouvert. Écrivez-nous dans la messagerie.', en: 'Online check-in is not open yet. Please message us.' },
  conflit: { fr: 'Votre check-in vient d’être modifié ailleurs. Rechargez la page, puis réessayez.', en: 'Your check-in was just changed elsewhere. Reload the page and try again.' },
  trop: { fr: 'Trop d’essais : patientez quelques minutes.', en: 'Too many attempts: please wait a few minutes.' },
  erreur: { fr: 'Une erreur est survenue. Réessayez dans un instant.', en: 'Something went wrong. Please try again in a moment.' },
} as const;

const langueDe = (v: unknown): LangueSejour => (v === 'en' ? 'en' : 'fr');

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  }
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const corps = req.method === 'POST' ? lireCorps(req) : {};
  const action = String((req.method === 'GET' ? req.query?.action : corps.action) ?? '');
  const langue = langueDe(corps.langue);

  try {
    /* -------------------------------------------------------------- équipe */
    if (action === 'equipe') {
      if (req.method !== 'GET') return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
      const entete = String(req.headers?.authorization || '');
      const jeton = /^Bearer\s+/i.test(entete) ? entete.replace(/^Bearer\s+/i, '').trim() : '';
      if (!jeton) return repondre(res, 401, { ok: false, erreur: 'Authentification requise.' });
      const membre = await verifierMembre(jeton, { espace: espaceDemande(req) });
      // Compte « lecture » ou d'un autre espace : rien. Les fiches de police : gérants seulement (règle de la base).
      if (!membre.ok) return repondre(res, membre.statut, { ok: false, erreur: membre.statut === 403 ? 'Réservé aux gérants et aux opérations de cet espace.' : membre.erreur });
      const reservationId = String(req.query?.reservationId ?? '');
      if (!reservationId || reservationId.length > 120) return repondre(res, 400, { ok: false, erreur: 'Réservation illisible.' });
      // Dans l'espace du membre seulement : une réservation d'un autre espace est introuvable.
      const base = baseAcces(membre.espace);
      const reservation = (await base.lire<Reservation>('reservations', [reservationId]))[0];
      if (!reservation) return repondre(res, 404, { ok: false, erreur: 'Réservation introuvable.' });
      const checkin = (await base.lire<CheckinEnLigne>(COLLECTION_CHECKINS, [reservationId]))[0];
      const etat = etatLienSejour(reservation, dateParisISO());
      // Compte « opérations » : heure d'arrivée et voyageurs, pas les fiches de police (gérants seulement, comme la base).
      const suivi: SuiviSejour = { etat, ...suiviCheckin(checkin, membre.role === 'gerant') };
      if (etat === 'ouvert') {
        const lien = await lienSejourServeur(membre.espace, reservation.id);
        if (lien) Object.assign(suivi, { lien, lienJusquAu: lienValableJusquAu(reservation.depart) });
        else suivi.raison = MESSAGE_SANS_SECRET;
      }
      return repondre(res, 200, { ok: true, suivi });
    }

    /* ------------------------------------------------------------ voyageur */
    if (action !== 'vue' && action !== 'checkin') return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
    if (req.method !== 'POST') return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
    if (!provenanceSite(req)) return repondre(res, 403, { ok: false, erreur: 'Demande refusée : ouvrez le lien reçu dans votre messagerie.' });
    const ip = adresseIp(req);
    // Une adresse qui a présenté trop de faux jetons attend : rien n'est vérifié pour elle.
    if ((refusRecents.get(ip) ?? 0) > Date.now() || tropDAppels(ip)) return repondre(res, 429, { ok: false, code: 'trop', erreur: MESSAGES.trop[langue] });
    if (JSON.stringify(corps).length > TAILLE_MAX_ENVOI) return repondre(res, 413, { ok: false, erreur: MESSAGES.erreur[langue] });
    const secret = secretSejour();
    if (!secret) return repondre(res, 503, { ok: false, code: 'ferme', erreur: MESSAGES.inconnu[langue] });

    const lu = await lireJetonSejour(secret, corps.jeton);
    const s = lu ? await lireSejour(lu.espace, lu.reservationId) : null;
    if (!lu || !s) {
      if (tropDeRefus(ip)) {
        refusRecents.set(ip, Date.now() + 15 * 60_000);
        if (refusRecents.size > 5000) refusRecents.clear();
      }
      return repondre(res, 404, { ok: false, code: 'inconnu', erreur: MESSAGES.inconnu[langue] });
    }
    const aujourdhui = dateParisISO();
    const etat = etatLienSejour(s.reservation, aujourdhui);
    // Annulée ou expirée : rien d'autre que le motif.
    if (etat !== 'ouvert') return repondre(res, 410, { ok: false, code: etat, erreur: MESSAGES[etat === 'annule' ? 'annule' : 'expire'][langue] });
    const pret = await checkinPret(s.base, s.espace);

    if (action === 'vue') return repondre(res, 200, { ok: true, vue: await vueDuSejour(s, pret, aujourdhui) });

    // action === 'checkin'
    if (tropDEnvois(ip)) return repondre(res, 429, { ok: false, code: 'trop', erreur: MESSAGES.trop[langue] });
    if (!pret) return repondre(res, 503, { ok: false, code: 'pas_pret', erreur: MESSAGES.pas_pret[langue] });
    const capacite = s.logement?.capacite && s.logement.capacite > 0 ? s.logement.capacite : 0;
    // « Garder les fiches » (modification) : reprises de la ligne gardée, jamais renvoyées par le lien.
    const saisie = lireSaisieCheckin(corps.checkin, { maxPersonnes: capacite, aujourdhui, ...(s.checkin?.fiches?.length ? { fichesPrecedentes: s.checkin.fiches } : {}) });
    if (!saisie.ok) return repondre(res, 400, { ok: false, code: 'champs', erreurs: saisie.erreurs, erreur: langue === 'en' ? 'Please check the highlighted fields.' : 'Vérifiez les champs signalés.' });
    const r = nouveauCheckin(s.checkin, saisie.saisie, { reservation: s.reservation, langue, maintenant: new Date().toISOString(), aujourdhui });
    if (!r.ok) return repondre(res, 409, { ok: false, code: r.raison, erreur: MESSAGES_REFUS_CHECKIN[r.raison][langue] });
    // Écriture conditionnelle : deux envois simultanés n'en font jamais qu'un (le compteur d'envois tient).
    const ecrit = s.checkin
      ? await s.base.remplacerSi(COLLECTION_CHECKINS, r.checkin, s.versionCheckin ?? '', 'sejour')
      : (await s.base.ajouterSiAbsent(COLLECTION_CHECKINS, [r.checkin], 'sejour')) === 1;
    if (!ecrit) return repondre(res, 409, { ok: false, code: 'conflit', erreur: MESSAGES.conflit[langue] });
    return repondre(res, 200, { ok: true, vue: await vueDuSejour({ ...s, checkin: r.checkin }, pret, aujourdhui) });
  } catch (e) {
    console.error('[sejour] échec', action, e instanceof Error ? e.message : e);
    return repondre(res, 500, { ok: false, erreur: MESSAGES.erreur[langue] });
  }
}
