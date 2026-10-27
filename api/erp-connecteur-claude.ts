// =============================================================================
// /api/erp-connecteur-claude — connexion de Claude à l'ERP, pour les gérants
// connectés à l'ERP :
//
//   GET                                   → { ok, espace, connexions, derniere? }
//   POST { action: 'autoriser', …demande } → { ok, espace, redirection }  code OAuth renvoyé à Claude
//   POST { action: 'deconnecter' }         → { ok, espace }               jetons de l'espace révoqués
//
// La demande (client_id, redirect_uri, code_challenge, state…) vient de la
// page /erp/autoriser-claude, ouverte par Claude ; elle est revérifiée ici
// (src/erp/data/oauth-regles.ts). Codes et jetons : api/_oauth.ts.
// Authentification : Authorization: Bearer <jeton de session Supabase>, rôle
// gérant DANS l'espace de l'en-tête x-erp-espace (verifierMembre). Le code,
// les jetons qui en sortent et la révocation ne valent que pour cet espace.
// =============================================================================

import { adresseRetour, lireDemande } from '../src/erp/data/oauth-regles.js';
import { verifierMembre } from '../src/erp/data/repull-synchro.js';
import { configuration, lireCorps, repondre } from './_erp-repull.js';
import { creerCode, deconnecterTout, etatConnexions } from './_oauth.js';
import { espaceDemande, espaceOuvertAuJeton } from './_erp-espaces.js';

const INDISPONIBLE = 'Connecteur indisponible pour le moment. Réessayez dans un instant.';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  }
  const entete = String(req.headers?.authorization || '');
  const jeton = /^Bearer\s+/i.test(entete) ? entete.replace(/^Bearer\s+/i, '').trim() : '';
  if (!jeton) return repondre(res, 401, { ok: false, erreur: 'Session expirée : reconnectez-vous à l’ERP.' });
  const membre = await verifierMembre(jeton, { espace: espaceDemande(req) });
  if (!membre.ok || membre.role !== 'gerant') {
    if (!membre.ok) console.warn('[erp-connecteur-claude]', membre.statut, membre.erreur);
    return repondre(res, 403, { ok: false, erreur: 'Seul un gérant de cet espace peut connecter Claude.' });
  }
  const c = configuration();
  if (!c.motDePasse) {
    console.error('[erp-connecteur-claude] ERP_PASSWORD absent : base inaccessible.');
    return repondre(res, 503, { ok: false, erreur: INDISPONIBLE });
  }
  try {
    // Base de l'espace du gérant : Label Maison comme avant ; un autre espace avec le compte serveur.
    const espace = await espaceOuvertAuJeton(c, membre.espace);
    if (!espace) return repondre(res, 503, { ok: false, erreur: INDISPONIBLE });
    const { base } = espace;
    if (req.method === 'GET') return repondre(res, 200, { ok: true, espace: espace.nom, ...(await etatConnexions(base)) });
    const corps = lireCorps(req);
    if (corps.action === 'autoriser') {
      const lu = lireDemande(corps);
      if (!lu.ok) return repondre(res, 400, { ok: false, erreur: `Demande de connexion invalide (${lu.raison}). Relancez la connexion depuis Claude.` });
      const code = await creerCode(base, lu.demande, membre.email, espace.id);
      return repondre(res, 200, { ok: true, espace: espace.nom, redirection: adresseRetour(lu.demande.redirect_uri, { code, state: lu.demande.state }) });
    }
    if (corps.action === 'deconnecter') {
      await deconnecterTout(base);
      return repondre(res, 200, { ok: true, espace: espace.nom });
    }
    return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
  } catch (e) {
    console.error('[erp-connecteur-claude]', e);
    return repondre(res, 502, { ok: false, erreur: INDISPONIBLE });
  }
}
