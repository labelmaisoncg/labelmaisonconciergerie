// =============================================================================
// /api/erp-repull-connexion — connecter Airbnb, Booking.com... depuis l'ERP et
// choisir les logements à gérer (page Logements → Connexions).
//
//   GET  ?action=etat[&forcer=1]   comptes connectés, logements trouvés, choix,
//                                  limite de l'offre (gardé 5 min, sauf forcer)
//   GET  ?action=fournisseurs      plateformes et logiciels proposés par Repull
//   POST { action: 'connecter', fournisseur }          → { url } page Repull Connect
//   POST { action: 'selection', ids: string[] }        → choix enregistré + import
//   POST { action: 'deconnecter', fournisseur, compte? }
//
// Authentification : Authorization: Bearer <jeton de session Supabase>, membre
// de l'équipe (gérant ou opérations) ; connecter, choisir et déconnecter sont
// réservés aux gérants. Chaque appel Repull est compté dans la part mensuelle
// de l'ERP (REPULL_BUDGET_ERP). Détail : src/erp/data/repull-connexion.ts.
// =============================================================================

import {
  ErreurConnexion,
  deconnecter,
  demarrerConnexion,
  enregistrerSelection,
  lireEtatConnexions,
  lireFournisseurs,
  messageErreur,
  diagnostiquer,
  type ContexteConnexion,
} from '../src/erp/data/repull-connexion.js';
import { BudgetEpuise, verifierMembre } from '../src/erp/data/repull-synchro.js';
import { baseErp, configuration, repondre, variableManquante } from './_erp-repull.js';

/** Durée maximale de la fonction (vercel.json) moins une marge pour écrire et répondre. */
const BUDGET_TEMPS_MS = 50_000;
const SITE = 'https://www.labelmaisoncg.fr';

/** Adresse de retour après la page Repull Connect (même site que l'appel, s'il est connu). */
function urlRetour(req: any, fournisseur: string): string {
  const hote = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim().toLowerCase();
  const proto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const permis = /^(www\.)?labelmaisoncg\.fr$|^[a-z0-9-]+\.vercel\.app$|^localhost(:\d+)?$/.test(hote);
  const origine = permis ? `${hote.startsWith('localhost') ? proto : 'https'}://${hote}` : SITE;
  return `${origine}/erp/logements/connexions?retour=${encodeURIComponent(fournisseur)}`;
}

function lireCorps(req: any): Record<string, unknown> {
  const b = req.body;
  if (b && typeof b === 'object' && !Array.isArray(b)) return b as Record<string, unknown>;
  if (typeof b === 'string') {
    try {
      const x = JSON.parse(b);
      return x && typeof x === 'object' && !Array.isArray(x) ? x : {};
    } catch {
      return {};
    }
  }
  return {};
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  }
  const debut = Date.now();
  const c = configuration();

  const entete = String(req.headers?.authorization || '');
  const jeton = /^Bearer\s+/i.test(entete) ? entete.replace(/^Bearer\s+/i, '').trim() : '';
  if (!jeton) return repondre(res, 401, { ok: false, erreur: 'Session expirée : reconnectez-vous à l’ERP.' });
  const membre = await verifierMembre(jeton);
  if (!membre.ok) return repondre(res, membre.statut, { ok: false, erreur: membre.erreur });

  const manque = variableManquante(c);
  if (manque) return repondre(res, 503, { ok: false, erreur: manque });

  const limite = Number(String(process.env.REPULL_LIMITE_LOGEMENTS ?? '').trim());
  const ctx: ContexteConnexion = {
    cle: c.cle,
    base: baseErp(c),
    echeance: debut + BUDGET_TEMPS_MS,
    budgetMois: c.budgetMois,
    quotaMois: c.quotaMois,
    ...(Number.isFinite(limite) && limite > 0 ? { limiteVariable: limite } : {}),
  };

  const corps = req.method === 'POST' ? lireCorps(req) : {};
  const action = String((req.method === 'GET' ? req.query?.action : corps.action) ?? 'etat');
  const ecriture = req.method === 'POST';
  if (ecriture && membre.role !== 'gerant') {
    return repondre(res, 403, { ok: false, erreur: 'Seul un gérant peut connecter une plateforme ou choisir les logements.' });
  }

  try {
    if (req.method === 'GET' && action === 'etat') {
      const forcer = ['1', 'true', 'oui'].includes(String(req.query?.forcer ?? ''));
      return repondre(res, 200, await lireEtatConnexions(ctx, { forcer }));
    }
    if (req.method === 'GET' && action === 'diagnostic') {
      return repondre(res, 200, await diagnostiquer(ctx));
    }
    if (req.method === 'GET' && action === 'fournisseurs') {
      return repondre(res, 200, { ok: true, fournisseurs: await lireFournisseurs(ctx) });
    }
    if (ecriture && action === 'connecter') {
      const f = String(corps.fournisseur ?? '').trim().toLowerCase();
      const acces = corps.acces === 'messaging' || corps.acces === 'full_access' ? corps.acces : undefined;
      return repondre(res, 200, await demarrerConnexion(ctx, f, urlRetour(req, f), acces));
    }
    if (ecriture && action === 'selection') {
      return repondre(res, 200, await enregistrerSelection(ctx, corps.ids, membre.email));
    }
    if (ecriture && action === 'deconnecter') {
      return repondre(res, 200, await deconnecter(ctx, String(corps.fournisseur ?? ''), corps.compte ? String(corps.compte) : undefined));
    }
    return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
  } catch (e) {
    if (e instanceof ErreurConnexion) return repondre(res, e.statut, { ok: false, erreur: e.message });
    console.error('[erp-repull-connexion]', action, e);
    return repondre(res, e instanceof BudgetEpuise ? 429 : 502, { ok: false, erreur: messageErreur(e, { budgetMois: c.budgetMois }) });
  }
}
