// =============================================================================
// /api/espace-proprietaire — l'espace en ligne des propriétaires.
//
// Chaque accès appartient à l'espace qui l'a créé (Label Maison, Sens…) : il
// y est écrit, lu et revérifié, jamais ailleurs (api/_acces-externe.ts).
//
// Gérant (Authorization: Bearer <session Supabase>, en-tête x-erp-espace,
// membre gérant de cet espace) :
//   GET  ?action=etat                                  espace ouvert ? e-mails ?
//   POST { action: 'inviter', proprietaireId, email }  invitation « Créer mon compte »
//                                                      (code à usage unique, 7 jours) ;
//                                                      compte déjà créé : 409 « deja »
//   POST { action: 'retirer', proprietaireId }         accès retiré, sessions fermées
//                                                      (le compte Supabase reste, sans rien ouvrir)
//   GET  ?action=relances                              relances de l'espace et réglages
//   POST { action: 'relance-envoyer', id }             envoi d'une relance à valider
//   POST { action: 'relance-annuler', id }
//   POST { action: 'relances-reglages', reglages }     mode, étapes (jours), actif
//
// Propriétaire (compte Supabase : adresse e-mail et mot de passe ; le jeton
// Supabase, en Authorization: Bearer, ne sert qu'à prouver son identité ici) :
//   POST { action: 'activer', code, espace }  première entrée : le code de
//                                             l'invitation relie l'accès à SON
//                                             compte (adresse confirmée, jeton
//                                             d'une connexion au mot de passe,
//                                             jamais la seule session d'un lien
//                                             reçu), puis cookie de session
//   POST { action: 'entrer', espace?,         connexion ensuite : l'accès est
//          fermerAutres? }                     (nouveau mot de passe : les
//                                             autres sessions se ferment)
//                                             retrouvé par le compte (uid),
//                                             jamais par l'adresse → cookie
//   GET  ?action=vue&mois=AAAA-MM             son espace (session)
//   GET  ?action=calendrier&de=AAAA-MM&a=AAAA-MM
//                                             les mois du calendrier de `de` à `a`
//                                             (12 au plus ; 12 mois en arrière,
//                                             18 en avant ; sinon 400)
//   GET  ?action=document&id=…                un document, par lien signé de 2 minutes
//   POST { action: 'sortir' }
//
// Lecture seule pour le propriétaire : il ne modifie rien. Calculs :
// src/erp/data/proprietaire.ts.
// =============================================================================

import { verifierMembre } from '../src/erp/data/repull-synchro.js';
import { MESSAGE_BASE_PAS_PREPAREE, estLabelMaison } from '../src/erp/data/espaces.js';
import { ACCES_RETIRE, MESSAGES_ENTREE, MESSAGE_AUTRE_MOYEN, MESSAGE_INVITATION_PERIMEE, MESSAGE_MOT_DE_PASSE_REQUIS, MESSAGE_NON_CONFIRME, MESSAGE_SESSION_REFUSEE } from '../src/erp/data/acces-externe.js';
import { calendrierPlage, dateParisISO, moisDePlage, moisValide, proprietaireAutorise, vueProprietaire } from '../src/erp/data/proprietaire.js';
import { avecNouveauLien, emailValide, empreinteJeton, inviter, normaliserEmail, nouveauJeton, retirer } from '../src/erp/data/proprietaire-acces.js';
import { facturePartagee } from '../src/erp/data/relances.js';
import type { Facture } from '../src/erp/data/types';
import type { AccesProprietaire } from '../src/erp/data/types-proprietaire';
import { MESSAGE_COMPTE_SERVEUR, lireCorps, repondre } from './_erp-repull.js';
import { espaceDemande } from './_erp-espaces.js';
import { adresseIp, freinEnvois, provenanceSite } from './_garde-formulaire.js';
import {
  activerAvecCompte,
  avecEmailFiche,
  baseAcces,
  contactsEspace,
  cookieSessionEfface,
  entrerAvecCompte,
  expediteurEspace,
  ficheEspace,
  jetonPorteur,
  lienCreationDAcces,
  lireSessionAcces,
  verifierCompteSupabase,
} from './_acces-externe.js';
import { annulerRelance, ecrireReglagesRelances, envoyerRelance, lireReglagesRelances, lireRelances } from './_relances.js';
import { documentsFermes, ecrireAcces, entreesCalendrier, entreesDuProprietaire, envoyerLien, etatEspace, lienDocument, lireAcces, lireDocument, lireProprietaire, photosSignees } from './_proprietaire.js';

/** Freins des entrées (activer, entrer) : par adresse IP, puis par compte une fois le jeton vérifié (Supabase freine déjà les mots de passe). */
const tropDEssais = freinEnvois(30, 15 * 60_000);
const tropPourCeCompte = freinEnvois(15, 15 * 60_000);

const DOCUMENTS_FERMES = 'Les documents ne peuvent pas être ouverts pour l’instant. Contactez votre conciergerie.';

/** Supabase n'a pas répondu (panne, délai de 10 s) : on le dit, sans refuser la personne. */
const MESSAGE_COMPTE_INJOIGNABLE = 'La vérification de votre compte n’a pas abouti. Réessayez dans un instant.';

/** Compte déjà créé et relié : on ne réinvite pas, il se connecte. */
export const MESSAGE_COMPTE_DEJA = 'Ce propriétaire a déjà créé son compte : il se connecte avec son adresse et son mot de passe (« Mot de passe oublié ? » au besoin).';

const ESPACE_INTROUVABLE = 'Espace introuvable. Contactez votre conciergerie.';

/** Session du propriétaire pour `vue` et `calendrier` ; sans session valable, la réponse 401 est déjà envoyée. */
async function sessionProprietaire(req: any, res: any) {
  const s = await lireSessionAcces<AccesProprietaire>(req, 'proprietaire');
  if (!s.ok) {
    res.setHeader('Set-Cookie', cookieSessionEfface('proprietaire'));
    repondre(res, 401, s.raison === 'retire' ? { ok: false, code: 'retire', erreur: ACCES_RETIRE } : { ok: false, code: 'session', erreur: 'Connectez-vous pour ouvrir votre espace.' });
    return null;
  }
  return s;
}

/** Gérant de l'espace nommé par l'appel (sans en-tête : Label Maison, comme avant). */
async function membreGerant(req: any): Promise<{ ok: true; email: string; espace: string } | { ok: false; statut: number; erreur: string }> {
  const jeton = jetonPorteur(req);
  if (!jeton) return { ok: false, statut: 401, erreur: 'Authentification requise.' };
  const m = await verifierMembre(jeton, { espace: espaceDemande(req) });
  if (!m.ok) return m;
  if (m.role !== 'gerant') return { ok: false, statut: 403, erreur: 'Réservé au gérant.' };
  return { ok: true, email: m.email, espace: m.espace };
}

/** Erreur de base connue (espace pas prêt) : message clair au gérant. */
const messageBase = (e: unknown): string | undefined => {
  const m = e instanceof Error ? e.message : String(e ?? '');
  return m === MESSAGE_BASE_PAS_PREPAREE || m === MESSAGE_COMPTE_SERVEUR ? m : undefined;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  }
  res.setHeader('Referrer-Policy', 'no-referrer');
  const corps = req.method === 'POST' ? lireCorps(req) : {};
  const action = String((req.method === 'GET' ? req.query?.action : corps.action) ?? '');
  const etat = etatEspace();

  try {
    /* ------------------------------------------------- gérant : relances */
    if (action === 'relances' || action === 'relance-envoyer' || action === 'relance-annuler' || action === 'relances-reglages') {
      const g = await membreGerant(req);
      if (!g.ok) return repondre(res, g.statut, { ok: false, erreur: g.erreur });
      const b = baseAcces(g.espace);
      if (action === 'relances' && req.method === 'GET') {
        const [relances, reglages, fiche] = await Promise.all([lireRelances(b), lireReglagesRelances(b), ficheEspace(g.espace)]);
        return repondre(res, 200, { ok: true, relances, reglages, expediteur: !!expediteurEspace(fiche) && !!(process.env.RESEND_API_KEY || '').trim() });
      }
      if (req.method !== 'POST') return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
      if (action === 'relances-reglages') {
        const r = corps.reglages && typeof corps.reglages === 'object' ? (corps.reglages as Record<string, unknown>) : {};
        return repondre(res, 200, { ok: true, reglages: await ecrireReglagesRelances(b, r, g.email) });
      }
      const id = String(corps.id ?? '');
      const r = action === 'relance-envoyer' ? await envoyerRelance(await ficheEspace(g.espace), g.espace, id, g.email) : await annulerRelance(g.espace, id, g.email);
      return repondre(res, r.ok ? 200 : 409, r.ok ? { ok: true, relance: r.relance } : { ok: false, erreur: r.erreur, relance: r.relance });
    }

    /* ------------------------------------------------------------ gérant */
    if (action === 'etat' || action === 'inviter' || action === 'retirer') {
      const g = await membreGerant(req);
      if (!g.ok) return repondre(res, g.statut, { ok: false, erreur: g.erreur });
      if (action === 'etat') return repondre(res, 200, { ok: true, actif: etat.actif, email: etat.email, ...(etat.raison ? { raison: etat.raison } : {}) });
      if (req.method !== 'POST') return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
      if (!etat.actif) return repondre(res, 503, { ok: false, code: 'inactif', erreur: etat.raison });
      const proprietaireId = String(corps.proprietaireId ?? '');
      if (!proprietaireAutorise(proprietaireId)) return repondre(res, 400, { ok: false, erreur: 'Choisissez d’abord le propriétaire de ce logement.' });
      // Tout se passe dans l'espace du gérant : la fiche, l'accès, le lien.
      const b = baseAcces(g.espace);
      const proprietaire = await lireProprietaire(b, proprietaireId);
      if (!proprietaire) return repondre(res, 404, { ok: false, erreur: 'Propriétaire introuvable : enregistrez sa fiche, puis réessayez.' });
      const precedent = await lireAcces(b, proprietaireId);
      const maintenant = Date.now();

      if (action === 'retirer') {
        if (!precedent || precedent.statut === 'retire') return repondre(res, 200, { ok: true });
        await ecrireAcces(b, retirer(precedent, maintenant));
        return repondre(res, 200, { ok: true });
      }

      const email = normaliserEmail(corps.email);
      if (!emailValide(email)) return repondre(res, 400, { ok: false, erreur: 'Adresse e-mail du propriétaire invalide.' });
      // Seulement l'adresse de la fiche : réinviter l'ancienne après un changement rouvrirait l'accès à qui est parti.
      const deLaFiche = normaliserEmail(proprietaire.contact?.email ?? '');
      if (deLaFiche && deLaFiche !== email) {
        return repondre(res, 409, { ok: false, code: 'fiche', erreur: 'Cette adresse n’est pas celle de la fiche du propriétaire : enregistrez-la dans sa fiche, puis réessayez.' });
      }
      // Compte déjà créé et relié à cette adresse : rien à renvoyer, il se connecte.
      if (precedent && precedent.statut === 'actif' && precedent.compteActif && precedent.email === email) {
        return repondre(res, 409, { ok: false, code: 'deja', erreur: MESSAGE_COMPTE_DEJA });
      }
      const code = await nouveauJeton();
      // L'adresse de la fiche est relevée : si elle change ensuite sans « Retirer », l'accès ne vaut plus.
      const acces = avecNouveauLien(
        avecEmailFiche('proprietaire', inviter(precedent, { proprietaireId, email, par: g.email, maintenantMs: maintenant, espace: g.espace }), proprietaire),
        await empreinteJeton(code),
        'invitation',
        maintenant,
      );
      await ecrireAcces(b, acces);
      const lien = lienCreationDAcces('proprietaire', email, code, g.espace);
      const envoye = await envoyerLien({ fiche: await ficheEspace(g.espace).catch(() => undefined), email, nom: proprietaire.nom, lien });
      return repondre(res, 200, { ok: true, lien, envoye, espace: g.espace, expireLe: acces.liens[acces.liens.length - 1].expireLe });
    }

    /* ------------------------------------------------------ propriétaire */
    if (!etat.actif) return repondre(res, 503, { ok: false, code: 'inactif', erreur: 'L’espace propriétaire n’est pas encore ouvert. Contactez votre conciergerie.' });

    if ((action === 'activer' || action === 'entrer') && req.method === 'POST') {
      if (!provenanceSite(req)) return repondre(res, 403, { ok: false, erreur: 'Demande refusée : utilisez la page de l’espace propriétaire.' });
      if (tropDEssais(adresseIp(req))) return repondre(res, 429, { ok: false, erreur: 'Trop d’essais : patientez quelques minutes.' });
      // Le compte Supabase de la personne, vérifié auprès de Supabase (jamais sur la foi du jeton seul).
      const compte = await verifierCompteSupabase(jetonPorteur(req));
      if (compte === 'injoignable') return repondre(res, 503, { ok: false, code: 'supabase', erreur: MESSAGE_COMPTE_INJOIGNABLE });
      if (!compte) return repondre(res, 401, { ok: false, code: 'compte', erreur: MESSAGE_SESSION_REFUSEE });
      if (tropPourCeCompte(compte.email)) return repondre(res, 429, { ok: false, erreur: 'Trop d’essais : patientez quelques minutes.' });
      if (!compte.confirme) return repondre(res, 403, { ok: false, code: 'non_confirme', erreur: MESSAGE_NON_CONFIRME });
      if (action === 'activer') {
        const r = await activerAvecCompte<AccesProprietaire>('proprietaire', corps.code, compte, corps.espace);
        // Même phrase quoi qu'il manque (code inconnu, expiré, servi, autre adresse) ; l'accès retiré est dit tel quel.
        if (!r.ok) {
          if (r.raison === 'retire') return repondre(res, 401, { ok: false, code: 'retire', erreur: ACCES_RETIRE });
          // Session d'un lien reçu (confirmation, récupération) : le mot de passe du compte pourrait être celui d'un
          // autre (compte créé avant la personne, à son adresse) ; une connexion au mot de passe est exigée.
          if (r.raison === 'mot_de_passe') return repondre(res, 403, { ok: false, code: 'mot_de_passe', erreur: MESSAGE_MOT_DE_PASSE_REQUIS });
          if (r.raison === 'autre_moyen') return repondre(res, 403, { ok: false, code: 'autre_moyen', erreur: MESSAGE_AUTRE_MOYEN });
          return repondre(res, 401, { ok: false, code: 'invitation', erreur: MESSAGE_INVITATION_PERIMEE });
        }
        res.setHeader('Set-Cookie', r.cookie);
        return repondre(res, 200, { ok: true, espace: r.espace });
      }
      const r = await entrerAvecCompte<AccesProprietaire>('proprietaire', compte, corps.espace, Date.now(), { fermerAutres: corps.fermerAutres === true });
      if (!r.ok) return repondre(res, r.raison === 'autre_moyen' ? 403 : 401, { ok: false, code: r.raison, erreur: MESSAGES_ENTREE[r.raison] });
      res.setHeader('Set-Cookie', r.cookie);
      return repondre(res, 200, { ok: true, espace: r.espace });
    }

    if (action === 'sortir' && req.method === 'POST') {
      res.setHeader('Set-Cookie', cookieSessionEfface('proprietaire'));
      return repondre(res, 200, { ok: true });
    }

    if (action === 'vue' && req.method === 'GET') {
      const s = await sessionProprietaire(req, res);
      if (!s) return;
      const fiche = await ficheEspace(s.espace).catch(() => undefined);
      const entrees = await entreesDuProprietaire(s.base, s.acces.proprietaireId);
      const photos = await photosSignees(entrees.logements, s.espace);
      const mois = moisValide(req.query?.mois) ? String(req.query.mois) : undefined;
      const vue = vueProprietaire(entrees, s.acces.proprietaireId, {
        aujourdhui: dateParisISO(),
        mois,
        photo: (l) => photos.get(l.id),
        // Fiche illisible : Label Maison seulement si c'est explicitement son espace.
        conciergerie: { nom: fiche?.nom || (estLabelMaison(s.espace) ? 'Label Maison' : 'Votre conciergerie'), espace: s.espace, contacts: contactsEspace(fiche, s.espace) },
      });
      if (!vue) return repondre(res, 404, { ok: false, erreur: ESPACE_INTROUVABLE });
      // `espace` : la page le garde sur l'appareil (avec le nom), pour sa page de connexion.
      return repondre(res, 200, { ok: true, vue, espace: s.espace });
    }

    // Les mois du calendrier en défilant : mêmes contrôles que `vue` (session, propriétaire, bornes de sa période),
    // mêmes champs que `vue.calendrier`, rien de plus ; la plage est bornée (moisDePlage).
    if (action === 'calendrier' && req.method === 'GET') {
      const s = await sessionProprietaire(req, res);
      if (!s) return;
      const plage = moisDePlage(req.query?.de, req.query?.a, dateParisISO());
      if (!plage.ok) return repondre(res, 400, { ok: false, erreur: plage.erreur });
      const mois = calendrierPlage(await entreesCalendrier(s.base, s.acces.proprietaireId), s.acces.proprietaireId, plage.mois);
      if (!mois) return repondre(res, 404, { ok: false, erreur: ESPACE_INTROUVABLE });
      return repondre(res, 200, { ok: true, mois });
    }

    if (action === 'document' && req.method === 'GET') {
      const s = await lireSessionAcces<AccesProprietaire>(req, 'proprietaire');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      if (!s.ok) return res.status(401).end(s.raison === 'retire' ? ACCES_RETIRE : 'Session expirée : reconnectez-vous à votre espace propriétaire.');
      const doc = await lireDocument(s.base, String(req.query?.id ?? ''));
      // PDF d'une facture : seulement tant qu'elle est partagée avec lui.
      const factureVisible = !doc?.factureId || facturePartagee((await s.base.lire<Facture>('factures', [doc.factureId]))[0], s.acces.proprietaireId);
      const visible = !!doc && doc.proprietaireId === s.acces.proprietaireId && factureVisible;
      // Fichier de l'équipe que cet espace ne peut pas encore signer (compte serveur pas prêt) : le dire, plutôt qu'« introuvable ».
      if (visible && String(doc?.fichier ?? '').startsWith('stockage://')) {
        const ferme = await documentsFermes(s.espace);
        if (ferme) {
          console.warn('[espace-proprietaire] documents fermés pour l’espace', s.espace, ferme);
          return res.status(409).end(DOCUMENTS_FERMES);
        }
      }
      const lien = visible ? await lienDocument(String(doc?.fichier ?? ''), s.espace) : null;
      if (!lien) return res.status(404).end('Document introuvable.');
      res.setHeader('Location', lien);
      return res.status(302).end();
    }

    return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
  } catch (e) {
    const clair = messageBase(e);
    if (clair) return repondre(res, 503, { ok: false, code: 'espace', erreur: clair });
    console.error('[espace-proprietaire] échec', action, e instanceof Error ? e.message : e);
    return repondre(res, 500, { ok: false, erreur: 'Une erreur est survenue. Réessayez dans un instant.' });
  }
}
