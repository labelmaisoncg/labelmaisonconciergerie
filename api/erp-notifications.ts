// =============================================================================
// /api/erp-notifications — notifications de l'app installable (Web Push).
//
//   GET  ?action=etat&endpoint=…   serveur prêt ? clé publique, réglages de
//                                  cet appareil s'il est abonné
//   POST { action: 'abonner', abonnement, preferences?, nom? }
//   POST { action: 'regler', endpoint, preferences }
//   POST { action: 'desabonner', endpoint }
//   POST { action: 'tester', endpoint }   notification d'essai sur cet appareil
//   POST { action: 'cles' }               gérant : nouvelle paire de clés serveur,
//                                         affichée une seule fois, à coller dans
//                                         Vercel (jamais enregistrée ni journalisée)
//
// Authentification : Authorization: Bearer <jeton de session Supabase>,
// membre gérant ou opérations. Les appareils sont rangés dans l'espace de
// l'en-tête x-erp-espace (chaque espace notifie les siens) ; les clés serveur
// sont communes (même app). Envoi et règles : src/erp/data/notifications-envoi.ts.
// =============================================================================

import { verifierMembre } from '../src/erp/data/repull-synchro.js';
import { TYPES_NOTIFICATION, notificationTest } from '../src/erp/data/notifications.js';
import { baseErp, configuration, lireCorps, repondre, variableManquante } from './_erp-repull.js';
import { abonnementValide, enregistrerAppareil, envoyerNotifications, lireAppareil, oublierAppareil, reglerAppareil } from '../src/erp/data/notifications-envoi.js';
import { genererClesVapid } from '../src/erp/data/web-push.js';
import { clesServeur } from './_erp-notifications.js';
import { espaceDemande, refuserHorsLabelMaison } from './_erp-espaces.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  }
  const entete = String(req.headers?.authorization || '');
  const jeton = /^Bearer\s+/i.test(entete) ? entete.replace(/^Bearer\s+/i, '').trim() : '';
  if (!jeton) return repondre(res, 401, { ok: false, erreur: 'Authentification requise.' });
  const membre = await verifierMembre(jeton, { espace: espaceDemande(req) });
  if (!membre.ok) return repondre(res, membre.statut, { ok: false, erreur: membre.erreur });

  const corps = req.method === 'POST' ? lireCorps(req) : {};
  const action = String((req.method === 'GET' ? req.query?.action : corps.action) ?? 'etat');
  const endpoint = String((req.method === 'GET' ? req.query?.endpoint : corps.endpoint) ?? '').trim();

  // Clés serveur : générées à la demande du gérant, montrées une fois, jamais gardées.
  if (action === 'cles' && req.method === 'POST') {
    if (membre.role !== 'gerant') return repondre(res, 403, { ok: false, erreur: 'Réservé au gérant.' });
    if (refuserHorsLabelMaison(res, membre.espace, 'Clés des notifications')) return;
    const k = await genererClesVapid();
    return repondre(res, 200, { ok: true, publique: k.publique, privee: k.privee, dejaActives: !!clesServeur() });
  }

  const cles = clesServeur();
  if (action === 'etat' && req.method === 'GET') {
    let appareil: { preferences: unknown; nom?: string } | null = null;
    if (cles && endpoint && !variableManquante(configuration())) {
      const a = await lireAppareil(baseErp(configuration(), membre.espace), endpoint).catch(() => undefined);
      if (a && !a.expire) appareil = { preferences: a.preferences ?? {}, ...(a.nom ? { nom: a.nom } : {}) };
    }
    return repondre(res, 200, { ok: true, actif: !!cles, clePublique: cles?.publique ?? null, appareil, types: TYPES_NOTIFICATION });
  }

  if (req.method !== 'POST') return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
  if (!cles) return repondre(res, 503, { ok: false, code: 'inactif', erreur: 'Notifications pas encore activées sur le serveur.' });
  const c = configuration();
  const manque = variableManquante(c);
  if (manque) return repondre(res, 503, { ok: false, erreur: manque });
  const base = baseErp(c, membre.espace);

  try {
    if (action === 'abonner') {
      const abonnement = abonnementValide(corps.abonnement);
      if (!abonnement) return repondre(res, 400, { ok: false, erreur: 'Abonnement du navigateur illisible.' });
      const a = await enregistrerAppareil(base, { abonnement, preferences: corps.preferences, nom: typeof corps.nom === 'string' ? corps.nom : undefined, par: membre.email });
      return repondre(res, 200, { ok: true, preferences: a.preferences });
    }
    if (!endpoint) return repondre(res, 400, { ok: false, erreur: 'Appareil inconnu.' });
    if (action === 'regler') {
      const a = await reglerAppareil(base, endpoint, corps.preferences);
      if (!a) return repondre(res, 404, { ok: false, code: 'inconnu', erreur: 'Cet appareil n’est plus abonné : réactivez les notifications.' });
      return repondre(res, 200, { ok: true, preferences: a.preferences });
    }
    if (action === 'desabonner') {
      await oublierAppareil(base, endpoint);
      return repondre(res, 200, { ok: true });
    }
    if (action === 'tester') {
      const a = await lireAppareil(base, endpoint);
      if (!a || a.expire) return repondre(res, 404, { ok: false, code: 'inconnu', erreur: 'Cet appareil n’est plus abonné : réactivez les notifications.' });
      const bilan = await envoyerNotifications(base, [notificationTest(`test-${Date.now()}`)], { cles, essai: true, seulement: endpoint });
      if (!bilan.envoyees) {
        return repondre(res, 502, {
          ok: false,
          erreur: bilan.expires ? 'Cet appareil n’accepte plus les notifications : réactivez-les.' : 'Le service de notifications n’a pas accepté l’envoi. Réessayez dans un instant.',
        });
      }
      return repondre(res, 200, { ok: true });
    }
    return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
  } catch (e) {
    console.error('[erp-notifications] échec', action, e instanceof Error ? e.message : e);
    return repondre(res, 500, { ok: false, erreur: 'Une erreur est survenue. Réessayez dans un instant.' });
  }
}
