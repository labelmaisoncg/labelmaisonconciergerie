// =============================================================================
// /api/espace-proprietaire — l'espace en ligne des propriétaires.
//
// Gérant (Authorization: Bearer <session Supabase>, membre gérant) :
//   GET  ?action=etat                          espace ouvert ? e-mails envoyés ?
//   POST { action: 'inviter', proprietaireId, email }  lien d'invitation (7 jours)
//   POST { action: 'retirer', proprietaireId }         accès retiré, sessions fermées
//
// Propriétaire (sans compte) :
//   POST { action: 'lien', email }    lien de connexion par e-mail (réponse
//                                     toujours identique, qu'il existe ou non)
//   POST { action: 'entrer', jeton }  lien à usage unique → cookie de session
//   GET  ?action=vue&mois=AAAA-MM     son espace (session)
//   GET  ?action=document&id=…        un document, par lien signé de 2 minutes
//   POST { action: 'sortir' }
//
// Lecture seule pour le propriétaire : il ne modifie rien. Calculs :
// src/erp/data/proprietaire.ts ; accès : src/erp/data/proprietaire-acces.ts.
// =============================================================================

import { verifierMembre } from '../src/erp/data/repull-synchro.js';
import { moisValide, proprietaireAutorise, vueProprietaire, dateParisISO } from '../src/erp/data/proprietaire.js';
import {
  DUREE_SESSION_S,
  MESSAGES_REFUS,
  avecNouveauLien,
  cookieEfface,
  emailValide,
  empreinteJeton,
  enteteCookie,
  inviter,
  lireCookie,
  lireSession,
  normaliserEmail,
  nouveauJeton,
  retirer,
  sessionEncoreValide,
  signerSession,
  utiliserLien,
} from '../src/erp/data/proprietaire-acces.js';
import { continuerApresReponse, lireCorps, repondre } from './_erp-repull.js';
import { adresseIp, freinEnvois, provenanceSite } from './_garde-formulaire.js';
import {
  adresseSite,
  base,
  ecrireAcces,
  entreesDuProprietaire,
  envoyerLien,
  etatEspace,
  lienDocument,
  lienEspace,
  lireAcces,
  lireDocument,
  lireProprietaire,
  photosSignees,
  secretProprietaire,
  tousLesAcces,
} from './_proprietaire.js';

const tropDeDemandes = freinEnvois(5, 60 * 60_000);
const tropPourCetteAdresse = freinEnvois(3, 60 * 60_000);
const tropDEssais = freinEnvois(20, 15 * 60_000);

const REPONSE_LIEN = 'Si cette adresse a accès à un espace propriétaire, un lien de connexion vient de lui être envoyé. Pensez à regarder dans les indésirables.';

async function membreGerant(req: any): Promise<{ ok: true; email: string } | { ok: false; statut: number; erreur: string }> {
  const entete = String(req.headers?.authorization || '');
  const jeton = /^Bearer\s+/i.test(entete) ? entete.replace(/^Bearer\s+/i, '').trim() : '';
  if (!jeton) return { ok: false, statut: 401, erreur: 'Authentification requise.' };
  const m = await verifierMembre(jeton);
  if (!m.ok) return m;
  if (m.role !== 'gerant') return { ok: false, statut: 403, erreur: 'Réservé au gérant.' };
  return { ok: true, email: m.email };
}

/** Session du propriétaire, revérifiée en base (accès toujours actif, même version). */
async function sessionOuverte(req: any) {
  const s = await lireSession(secretProprietaire(), lireCookie(req.headers?.cookie), Math.floor(Date.now() / 1000));
  if (!s) return null;
  const b = base();
  const acces = await lireAcces(b, s.p);
  return sessionEncoreValide(s, acces) ? { b, acces } : null;
}

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
    /* ------------------------------------------------------------ gérant */
    if (action === 'etat' || action === 'inviter' || action === 'retirer') {
      const g = await membreGerant(req);
      if (!g.ok) return repondre(res, g.statut, { ok: false, erreur: g.erreur });
      if (action === 'etat') return repondre(res, 200, { ok: true, actif: etat.actif, email: etat.email, ...(etat.raison ? { raison: etat.raison } : {}) });
      if (req.method !== 'POST') return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
      if (!etat.actif) return repondre(res, 503, { ok: false, code: 'inactif', erreur: etat.raison });
      const proprietaireId = String(corps.proprietaireId ?? '');
      if (!proprietaireAutorise(proprietaireId)) return repondre(res, 400, { ok: false, erreur: 'Choisissez d’abord le propriétaire de ce logement.' });
      const b = base();
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
      const acces = avecNouveauLien(inviter(precedent, { proprietaireId, email, par: g.email, maintenantMs: maintenant }), await empreinteJeton(jeton), 'invitation', maintenant);
      await ecrireAcces(b, acces);
      const lien = lienEspace(adresseSite(req), jeton);
      const envoye = await envoyerLien({ email, nom: proprietaire.nom, lien, motif: 'invitation' });
      return repondre(res, 200, { ok: true, lien, envoye, expireLe: acces.liens[acces.liens.length - 1].expireLe });
    }

    /* ------------------------------------------------------ propriétaire */
    if (!etat.actif) return repondre(res, 503, { ok: false, code: 'inactif', erreur: 'L’espace propriétaire n’est pas encore ouvert. Contactez Label Maison.' });

    if (action === 'lien' && req.method === 'POST') {
      if (!provenanceSite(req)) return repondre(res, 403, { ok: false, erreur: 'Demande refusée : utilisez la page de l’espace propriétaire.' });
      const email = normaliserEmail(corps.email);
      if (!emailValide(email)) return repondre(res, 400, { ok: false, erreur: 'Adresse e-mail invalide.' });
      if (tropDeDemandes(adresseIp(req)) || tropPourCetteAdresse(email)) return repondre(res, 200, { ok: true, message: REPONSE_LIEN });
      const b = base();
      const acces = (await tousLesAcces(b)).find((a) => a.email === email && a.statut !== 'retire' && proprietaireAutorise(a.proprietaireId));
      const proprietaire = acces ? await lireProprietaire(b, acces.proprietaireId) : undefined;
      if (acces && proprietaire) {
        // Écriture et envoi après la réponse quand la plateforme le permet : même délai de réponse, que l'adresse ait un accès ou non.
        const envoi = (async () => {
          const maintenant = Date.now();
          const jeton = await nouveauJeton();
          await ecrireAcces(b, avecNouveauLien(acces, await empreinteJeton(jeton), 'connexion', maintenant));
          await envoyerLien({ email, nom: proprietaire.nom, lien: lienEspace(adresseSite(req), jeton), motif: 'connexion' });
        })().catch((e) => console.error('[espace-proprietaire] lien', e instanceof Error ? e.message : e));
        if (!continuerApresReponse(envoi)) await envoi;
      }
      return repondre(res, 200, { ok: true, message: REPONSE_LIEN });
    }

    if (action === 'entrer' && req.method === 'POST') {
      if (!provenanceSite(req)) return repondre(res, 403, { ok: false, erreur: 'Demande refusée : ouvrez le lien reçu par e-mail.' });
      if (tropDEssais(adresseIp(req))) return repondre(res, 429, { ok: false, erreur: 'Trop d’essais : patientez quelques minutes.' });
      const b = base();
      const maintenant = Date.now();
      const r = await utiliserLien(await tousLesAcces(b), corps.jeton, maintenant);
      if (!r.ok) return repondre(res, 401, { ok: false, code: r.raison, erreur: MESSAGES_REFUS[r.raison] });
      await ecrireAcces(b, r.acces);
      const valeur = await signerSession(secretProprietaire(), { p: r.acces.proprietaireId, v: r.acces.version, exp: Math.floor(maintenant / 1000) + DUREE_SESSION_S });
      res.setHeader('Set-Cookie', enteteCookie(valeur, DUREE_SESSION_S));
      return repondre(res, 200, { ok: true });
    }

    if (action === 'sortir' && req.method === 'POST') {
      res.setHeader('Set-Cookie', cookieEfface());
      return repondre(res, 200, { ok: true });
    }

    if (action === 'vue' && req.method === 'GET') {
      const s = await sessionOuverte(req);
      if (!s) {
        res.setHeader('Set-Cookie', cookieEfface());
        return repondre(res, 401, { ok: false, code: 'session', erreur: 'Connectez-vous pour ouvrir votre espace.' });
      }
      const entrees = await entreesDuProprietaire(s.b, s.acces.proprietaireId);
      const photos = await photosSignees(entrees.logements);
      const mois = moisValide(req.query?.mois) ? String(req.query.mois) : undefined;
      const aujourdhui = dateParisISO();
      const vue = vueProprietaire(entrees, s.acces.proprietaireId, { aujourdhui, mois, photo: (l) => photos.get(l.id) });
      if (!vue) return repondre(res, 404, { ok: false, erreur: 'Espace introuvable. Contactez Label Maison.' });
      return repondre(res, 200, { ok: true, vue });
    }

    if (action === 'document' && req.method === 'GET') {
      const s = await sessionOuverte(req);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      if (!s) return res.status(401).end('Session expirée : reconnectez-vous à votre espace propriétaire.');
      const doc = await lireDocument(s.b, String(req.query?.id ?? ''));
      const lien = doc && doc.proprietaireId === s.acces.proprietaireId ? await lienDocument(String(doc.fichier ?? '')) : null;
      if (!lien) return res.status(404).end('Document introuvable.');
      res.setHeader('Location', lien);
      return res.status(302).end();
    }

    return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
  } catch (e) {
    console.error('[espace-proprietaire] échec', action, e instanceof Error ? e.message : e);
    return repondre(res, 500, { ok: false, erreur: 'Une erreur est survenue. Réessayez dans un instant.' });
  }
}
