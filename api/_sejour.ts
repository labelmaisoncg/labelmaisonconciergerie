// =============================================================================
// Livret d'accueil et check-in en ligne (cahier B2), côté serveur : secret
// des liens, lien d'un séjour (messages automatiques, fiche de la
// réservation), lecture d'un séjour dans la base de SON espace, purge des
// check-ins au passage planifié (api/erp-agent.ts). Règles pures :
// src/erp/data/sejour.ts ; route : api/sejour.ts.
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
//
// Variables d'environnement (projet Vercel du site) :
//   ACCES_SECRET   déjà là pour l'espace opérations (32 caractères au moins) :
//                  signe aussi les liens des séjours (signature séparée, voir
//                  sejour.ts). Absente : aucun lien (la ligne {lien_sejour}
//                  des messages automatiques est retirée, la fiche de la
//                  réservation dit ce qu'il manque). La changer coupe tous les
//                  liens de séjour déjà envoyés, comme les sessions des espaces.
//   SITE_URL       (facultative) site des liens, comme pour les autres liens
//                  (api/_acces-externe.ts, adresseSite).
//   ERP_PASSWORD, ERP_SERVEUR_MOT_DE_PASSE : lecture de la base, comme partout.
//
// Base : relancer supabase/erp-espaces.sql (ou erp-acces-gerants.sql pour une
// base d'avant les espaces). Tant que erp.checkin_en_ligne_pret() n'existe
// pas, le livret s'ouvre mais aucun check-in n'est enregistré : jamais de
// fiche de police sans ses règles (gérants seulement, pas d'archive).
// =============================================================================

import { espaceDe } from '../src/erp/data/acces-externe.js';
import { ID_LABEL_MAISON, estLabelMaison } from '../src/erp/data/espaces.js';
import { secretValide } from '../src/erp/data/proprietaire-acces.js';
import { dateParisISO } from '../src/erp/data/proprietaire.js';
import type { BaseErp } from '../src/erp/data/repull-synchro.js';
import {
  COLLECTION_CHECKINS,
  DUREE_LIENS_PAGE_S,
  fichiersDeLaVue,
  lienSejour,
  purgerCheckins,
  signerJetonSejour,
  vueSejour,
  type CheckinEnLigne,
  type VueSejour,
} from '../src/erp/data/sejour.js';
import type { Logement, Reservation } from '../src/erp/data/types';
import { adresseSite, baseAcces, contactsEspace, ficheEspace } from './_acces-externe.js';
import { espacesActifs } from './_erp-espaces.js';
import { configuration, signeurFichiersErp } from './_erp-repull.js';

/** Secret des liens de séjour ('' : aucun valable, pas de lien). */
export function secretSejour(): string {
  const s = (process.env.ACCES_SECRET || '').trim();
  return secretValide(s) ? s : '';
}

export const MESSAGE_SANS_SECRET =
  'Lien du séjour pas encore disponible : ajoutez ACCES_SECRET dans Vercel (Settings → Environment Variables, 32 caractères au moins, Production et Preview), puis redéployez.';

/** Lien du livret d'un séjour, sur le site fixe ; null sans secret. */
export async function lienSejourServeur(espace: string, reservationId: string): Promise<string | null> {
  const secret = secretSejour();
  if (!secret) return null;
  try {
    return lienSejour(adresseSite(), await signerJetonSejour(secret, { espace: espaceDe(espace), reservationId }));
  } catch {
    return null;
  }
}

/* ------------------------------------------------- base prête pour le check-in */

const PRET_MS = 5 * 60_000;
const prets = new Map<string, { valeur: boolean; jusqua: number }>();

/**
 * La base a-t-elle les règles du check-in (erp.checkin_en_ligne_pret, posée
 * par le même SQL que la règle « gérants seulement » et la fin de l'archive) ?
 * Gardé 5 minutes par espace ; une erreur vaut « non ».
 */
export async function checkinPret(base: BaseErp, espace: string): Promise<boolean> {
  const id = espaceDe(espace);
  const lu = prets.get(id);
  if (lu && lu.jusqua > Date.now()) return lu.valeur;
  const valeur = await base.rpc<unknown>('checkin_en_ligne_pret').then((v) => v === true, () => false);
  prets.set(id, { valeur, jusqua: Date.now() + PRET_MS });
  return valeur;
}

/** Tests : oublie l'état gardé. */
export const oublierCheckinPret = () => prets.clear();

/* ------------------------------------------------------------- un séjour */

export interface SejourLu {
  espace: string;
  base: BaseErp;
  reservation: Reservation;
  logement?: Logement;
  checkin?: CheckinEnLigne;
  /** Version de la ligne du check-in (écriture conditionnelle). */
  versionCheckin?: string;
}

/** Le séjour, lu dans la base de SON espace seulement ; null : réservation introuvable. */
export async function lireSejour(espace: string, reservationId: string): Promise<SejourLu | null> {
  const id = espaceDe(espace);
  const base = baseAcces(id);
  const reservation = (await base.lire<Reservation>('reservations', [reservationId]))[0];
  if (!reservation || reservation.id !== reservationId) return null;
  const [logement, checkins] = await Promise.all([
    reservation.logementId ? base.lire<Logement>('logements', [reservation.logementId]).then((l) => l[0]) : Promise.resolve(undefined),
    base.lireVersions<CheckinEnLigne>(COLLECTION_CHECKINS, [reservationId]),
  ]);
  const c = checkins.find((x) => x.element.id === reservationId);
  return { espace: id, base, reservation, ...(logement ? { logement } : {}), ...(c ? { checkin: c.element, versionCheckin: c.version } : {}) };
}

/** Nom de la conciergerie du séjour : celui de l'espace ; Label Maison seulement s'il l'est vraiment. */
async function nomConciergerie(espace: string): Promise<{ nom: string; contacts?: { email?: string; telephone?: string } }> {
  const fiche = await ficheEspace(espace).catch(() => undefined);
  const c = contactsEspace(fiche, espace);
  return { nom: fiche?.nom ?? (estLabelMaison(espace) ? 'Label Maison' : 'Votre conciergerie'), ...(c ? { contacts: { email: c.email, telephone: c.telephone } } : {}) };
}

/** La vue du voyageur, photo et guides déposés signés (liens courts) dans l'espace du séjour. */
export async function vueDuSejour(s: SejourLu, pret: boolean, aujourdhui: string = dateParisISO()): Promise<VueSejour> {
  const { nom, contacts } = await nomConciergerie(s.espace);
  const entrees = { conciergerie: nom, reservation: s.reservation, logement: s.logement, checkin: s.checkin, aujourdhui, checkinOuvert: pret, ...(contacts ? { contacts } : {}) };
  const fichiers = fichiersDeLaVue(entrees);
  const signer = fichiers.length ? signeurFichiersErp({ ...configuration(), espace: s.espace }) : undefined;
  const liens = new Map<string, string>();
  await Promise.all(
    fichiers.map(async (f) => {
      const l = signer ? await signer(f, DUREE_LIENS_PAGE_S).catch(() => null) : null;
      if (l) liens.set(f, l);
    }),
  );
  return vueSejour(entrees, (f) => liens.get(f));
}

/* ------------------------------------------------------------------ purge */

/**
 * Passage planifié : dans chaque espace actif, efface les check-ins dont la
 * conservation est finie (6 mois après le départ, tout de suite pour une
 * réservation annulée). Quelques secondes au plus, jamais bloquant ; renvoie
 * un bilan court par espace (journal du serveur, sans aucune donnée).
 */
export async function purgeCheckinsDuJour(o: { limite?: number; maintenant?: Date } = {}): Promise<Record<string, string>> {
  const bilans: Record<string, string> = {};
  const limite = o.limite ?? Date.now() + 6_000;
  const aujourdhui = dateParisISO(o.maintenant ?? new Date());
  const travail = (async () => {
    let espaces: Awaited<ReturnType<typeof espacesActifs>> = [];
    try {
      espaces = await espacesActifs();
    } catch (e) {
      console.warn('[sejour] espaces illisibles', e instanceof Error ? e.message : e);
      return;
    }
    for (const fiche of espaces) {
      if (Date.now() > limite) break;
      try {
        const n = await purgerCheckins(baseAcces(fiche.id), aujourdhui);
        if (n) bilans[fiche.code] = `${n} check-in(s) effacé(s)`;
      } catch (e) {
        bilans[fiche.code] = e instanceof Error ? e.message : String(e);
        console.warn('[sejour] purge', fiche.code, bilans[fiche.code]);
      }
    }
    // Espaces fermés : le compte serveur n'y entre plus ; la base efface leurs check-ins échus
    // (erp.purger_checkins_espaces_fermes, supabase/erp-espaces.sql). Base d'avant les espaces, ou SQL
    // pas encore passé : la fonction manque, rien n'est fait.
    if (Date.now() <= limite) {
      const n = await baseAcces(ID_LABEL_MAISON).rpc<number>('purger_checkins_espaces_fermes').catch(() => 0);
      if (typeof n === 'number' && n > 0) bilans['espaces-fermes'] = `${n} check-in(s) effacé(s)`;
    }
  })();
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([travail, new Promise<void>((r) => (minuteur = setTimeout(r, Math.max(0, limite - Date.now()))))]);
  clearTimeout(minuteur);
  return bilans;
}
