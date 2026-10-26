// =============================================================================
// /api/espace-proprietaire — l'espace en ligne des propriétaires.
//
// Chaque accès appartient à l'espace qui l'a créé (Label Maison, Sens…) : il
// y est écrit, lu et revérifié, jamais ailleurs (api/_acces-externe.ts).
//
// Gérant (Authorization: Bearer <session Supabase>, en-tête x-erp-espace,
// membre gérant de cet espace) :
//   GET  ?action=etat                                  espace ouvert ? e-mails ?
//   POST { action: 'inviter', proprietaireId, email }  lien d'invitation (7 jours)
//   POST { action: 'retirer', proprietaireId }         accès retiré, sessions fermées
//   GET  ?action=relances                              relances de l'espace et réglages
//   POST { action: 'relance-envoyer', id }             envoi d'une relance à valider
//   POST { action: 'relance-annuler', id }
//   POST { action: 'relances-reglages', reglages }     mode, étapes (jours), actif
//
// Propriétaire (sans compte) :
//   POST { action: 'lien', email }            un lien par espace où l'adresse a
//                                             un accès (réponse toujours identique)
//   POST { action: 'entrer', jeton, espace }  lien à usage unique → cookie de session
//                                             (sans espace : Label Maison)
//   GET  ?action=vue&mois=AAAA-MM             son espace (session)
//   GET  ?action=document&id=…                un document, par lien signé de 2 minutes
//   POST { action: 'sortir' }
//
// Lecture seule pour le propriétaire : il ne modifie rien. Calculs :
// src/erp/data/proprietaire.ts.
// =============================================================================

import { verifierMembre } from '../src/erp/data/repull-synchro.js';
import { MESSAGE_BASE_PAS_PREPAREE } from '../src/erp/data/espaces.js';
import { dateParisISO, moisValide, proprietaireAutorise, vueProprietaire } from '../src/erp/data/proprietaire.js';
import { MESSAGES_REFUS, avecNouveauLien, emailValide, empreinteJeton, inviter, normaliserEmail, nouveauJeton, retirer } from '../src/erp/data/proprietaire-acces.js';
import { facturePartagee } from '../src/erp/data/relances.js';
import type { Facture } from '../src/erp/data/types';
import type { AccesProprietaire } from '../src/erp/data/types-proprietaire';
import { MESSAGE_COMPTE_SERVEUR, continuerApresReponse, lireCorps, repondre } from './_erp-repull.js';
import { espaceDemande } from './_erp-espaces.js';
import { adresseIp, freinEnvois, provenanceSite } from './_garde-formulaire.js';
import { accesParEmail, baseAcces, contactsEspace, cookieSessionEfface, entrerAvecLien, expediteurEspace, ficheEspace, lienDAcces, sessionAcces } from './_acces-externe.js';
import { annulerRelance, ecrireReglagesRelances, envoyerRelance, lireReglagesRelances, lireRelances } from './_relances.js';
import { ecrireAcces, entreesDuProprietaire, envoyerLien, etatEspace, lienDocument, lireAcces, lireDocument, lireProprietaire, photosSignees } from './_proprietaire.js';

const tropDeDemandes = freinEnvois(5, 60 * 60_000);
const tropPourCetteAdresse = freinEnvois(3, 60 * 60_000);
const tropDEssais = freinEnvois(20, 15 * 60_000);

const REPONSE_LIEN = 'Si cette adresse a accès à un espace propriétaire, un lien de connexion vient de lui être envoyé. Pensez à regarder dans les indésirables.';

/** Gérant de l'espace nommé par l'appel (sans en-tête : Label Maison, comme avant). */
async function membreGerant(req: any): Promise<{ ok: true; email: string; espace: string } | { ok: false; statut: number; erreur: string }> {
  const entete = String(req.headers?.authorization || '');
  const jeton = /^Bearer\s+/i.test(entete) ? entete.replace(/^Bearer\s+/i, '').trim() : '';
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
      const jeton = await nouveauJeton();
      const acces = avecNouveauLien(
        inviter(precedent, { proprietaireId, email, par: g.email, maintenantMs: maintenant, espace: g.espace }),
        await empreinteJeton(jeton),
        'invitation',
        maintenant,
      );
      await ecrireAcces(b, acces);
      const lien = lienDAcces(req, 'proprietaire', g.espace, jeton);
      const envoye = await envoyerLien({ fiche: await ficheEspace(g.espace), email, nom: proprietaire.nom, lien, motif: 'invitation' });
      return repondre(res, 200, { ok: true, lien, envoye, espace: g.espace, expireLe: acces.liens[acces.liens.length - 1].expireLe });
    }

    /* ------------------------------------------------------ propriétaire */
    if (!etat.actif) return repondre(res, 503, { ok: false, code: 'inactif', erreur: 'L’espace propriétaire n’est pas encore ouvert. Contactez votre conciergerie.' });

    if (action === 'lien' && req.method === 'POST') {
      if (!provenanceSite(req)) return repondre(res, 403, { ok: false, erreur: 'Demande refusée : utilisez la page de l’espace propriétaire.' });
      const email = normaliserEmail(corps.email);
      if (!emailValide(email)) return repondre(res, 400, { ok: false, erreur: 'Adresse e-mail invalide.' });
      if (tropDeDemandes(adresseIp(req)) || tropPourCetteAdresse(email)) return repondre(res, 200, { ok: true, message: REPONSE_LIEN });
      // Un lien par espace où l'adresse a un accès ; chaque espace est un compte à part.
      // Écritures et envois après la réponse quand la plateforme le permet : même délai, que l'adresse ait un accès ou non.
      const envoi = (async () => {
        for (const { fiche, acces, base } of await accesParEmail<AccesProprietaire>('proprietaire', email)) {
          const proprietaire = await lireProprietaire(base, acces.proprietaireId);
          if (!proprietaire || !proprietaireAutorise(acces.proprietaireId)) continue;
          const maintenant = Date.now();
          const jeton = await nouveauJeton();
          await ecrireAcces(base, avecNouveauLien(acces, await empreinteJeton(jeton), 'connexion', maintenant));
          await envoyerLien({ fiche, email, nom: proprietaire.nom, lien: lienDAcces(req, 'proprietaire', fiche.id, jeton), motif: 'connexion' });
        }
      })().catch((e) => console.error('[espace-proprietaire] lien', e instanceof Error ? e.message : e));
      if (!continuerApresReponse(envoi)) await envoi;
      return repondre(res, 200, { ok: true, message: REPONSE_LIEN });
    }

    if (action === 'entrer' && req.method === 'POST') {
      if (!provenanceSite(req)) return repondre(res, 403, { ok: false, erreur: 'Demande refusée : ouvrez le lien reçu par e-mail.' });
      if (tropDEssais(adresseIp(req))) return repondre(res, 429, { ok: false, erreur: 'Trop d’essais : patientez quelques minutes.' });
      const r = await entrerAvecLien<AccesProprietaire>('proprietaire', corps.jeton, corps.espace);
      if (!r.ok) return repondre(res, 401, { ok: false, code: r.raison, erreur: MESSAGES_REFUS[r.raison] });
      res.setHeader('Set-Cookie', r.cookie);
      return repondre(res, 200, { ok: true });
    }

    if (action === 'sortir' && req.method === 'POST') {
      res.setHeader('Set-Cookie', cookieSessionEfface('proprietaire'));
      return repondre(res, 200, { ok: true });
    }

    if (action === 'vue' && req.method === 'GET') {
      const s = await sessionAcces<AccesProprietaire>(req, 'proprietaire');
      if (!s) {
        res.setHeader('Set-Cookie', cookieSessionEfface('proprietaire'));
        return repondre(res, 401, { ok: false, code: 'session', erreur: 'Connectez-vous pour ouvrir votre espace.' });
      }
      const fiche = await ficheEspace(s.espace);
      const entrees = await entreesDuProprietaire(s.base, s.acces.proprietaireId);
      const photos = await photosSignees(entrees.logements, s.espace);
      const mois = moisValide(req.query?.mois) ? String(req.query.mois) : undefined;
      const vue = vueProprietaire(entrees, s.acces.proprietaireId, {
        aujourdhui: dateParisISO(),
        mois,
        photo: (l) => photos.get(l.id),
        conciergerie: { nom: fiche?.nom || 'Label Maison', contacts: contactsEspace(fiche) },
      });
      if (!vue) return repondre(res, 404, { ok: false, erreur: 'Espace introuvable. Contactez votre conciergerie.' });
      return repondre(res, 200, { ok: true, vue });
    }

    if (action === 'document' && req.method === 'GET') {
      const s = await sessionAcces<AccesProprietaire>(req, 'proprietaire');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      if (!s) return res.status(401).end('Session expirée : reconnectez-vous à votre espace propriétaire.');
      const doc = await lireDocument(s.base, String(req.query?.id ?? ''));
      // PDF d'une facture : seulement tant qu'elle est partagée avec lui.
      const factureVisible = !doc?.factureId || facturePartagee((await s.base.lire<Facture>('factures', [doc.factureId]))[0], s.acces.proprietaireId);
      const lien = doc && doc.proprietaireId === s.acces.proprietaireId && factureVisible ? await lienDocument(String(doc.fichier ?? ''), s.espace) : null;
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
