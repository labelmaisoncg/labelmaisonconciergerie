// =============================================================================
// Notifications de l'app « Opérations » (Web Push), côté serveur :
//   - actions de la personne connectée (api/espace-operations.ts, session) :
//     état, abonner, désabonner, tester, et qui serait prévenu d'une urgence ;
//   - après une action de l'espace : incident confié, urgence, remplacement ;
//   - « ce logement n'est pas à moi » traité par le gérant (appel de l'ERP) ;
//   - passage du matin (avec le passage planifié de l'agent, api/erp-agent.ts,
//     à partir de 7 h à Paris) : remplacements qui commencent, contrôles
//     qualité du jour, réponses du gérant manquées.
//
// Tout se lit et s'écrit dans la base de l'espace de la personne (ou du
// gérant) : un appareil abonné dans Label Maison ne reçoit jamais rien de
// Sens. Règles, appareils et envoi : src/erp/data/notifications-operations.ts.
// Clés : celles de l'app de l'ERP (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// api/_erp-notifications.ts) ; sans elles, rien n'est lu ni envoyé.
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import type { EntreesOperations } from '../src/erp/data/espace-operations.js';
import { abonnementValide } from '../src/erp/data/notifications-envoi.js';
import {
  abonnerAppareilOps,
  appareilsValables,
  desabonnerAppareilOps,
  destinatairesUrgence,
  envoyerNotificationsOps,
  matinOpsOuvert,
  notificationSignalementTraite,
  notificationTestOps,
  notificationsApresAction,
  notificationsDuJour,
  resumeBilan,
  type Prevenus,
} from '../src/erp/data/notifications-operations.js';
import { notificationUrgence, type GroupeNotification } from '../src/erp/data/notifications.js';
import { court } from '../src/erp/data/operations.js';
import { dateParisISO } from '../src/erp/data/proprietaire.js';
import type { BaseErp } from '../src/erp/data/repull-synchro.js';
import type { AccesOperations } from '../src/erp/data/types-operations';
import { GENRES, baseAcces } from './_acces-externe.js';
import { espacesActifs } from './_erp-espaces.js';
import { clesServeur } from './_erp-notifications.js';
import { repondre } from './_erp-repull.js';
import { freinEnvois, provenanceSite } from './_garde-formulaire.js';
import { entreesOps, gerantDeLEspace, gerantRecevra, groupesGerant } from './_operations.js';

/** Session de l'espace opérations, déjà revérifiée (lireSessionAcces). */
interface SessionOps {
  acces: AccesOperations;
  base: BaseErp;
  espace: string;
}

/** Actions de la personne connectée traitées ici. */
export const ACTIONS_NOTIFICATIONS_OPS: ReadonlySet<string> = new Set(['notifications-etat', 'notifications-abonner', 'notifications-desabonner', 'notifications-tester', 'prevenus']);

const PLUS_ABONNE = 'Ce téléphone n’est plus abonné : réactivez les notifications.';
/** Notifications de test : 10 par quart d'heure et par personne (par instance du serveur). */
const tropDeTests = freinEnvois(10, 15 * 60_000);

/**
 * Qui recevra vraiment : les personnes `ids` dont un téléphone est abonné
 * (« Clara D. »), et le gérant si un appareil de l'app de l'ERP accepte ces
 * notifications. Sans clés : personne.
 */
async function quiRecevra(s: Pick<SessionOps, 'base' | 'espace'>, e: EntreesOperations, ids: readonly string[], groupes: readonly GroupeNotification[]): Promise<Prevenus> {
  if (!clesServeur()) return { noms: [], gerant: false };
  const [avec, gerant] = await Promise.all([appareilsValables(s.base, ids, s.espace), gerantRecevra(s.base, groupes)]);
  const noms = ids
    .filter((id) => avec.has(id))
    .map((id) => court(e.equipe.find((m) => m.id === id)?.nom))
    .filter(Boolean);
  return { noms, gerant };
}

/**
 * Après une urgence signalée (ou passée en urgent) : qui est vraiment
 * prévenu, pour le dire tel quel (messageUrgence). Mêmes destinataires que
 * notifierEquipe et prevenirGerant.
 */
export function prevenusApresAction(s: Pick<SessionOps, 'base' | 'espace'>, avant: EntreesOperations, apres: EntreesOperations, auteurId: string, aNotifier: readonly string[]): Promise<Prevenus> {
  const ids = [...new Set(notificationsApresAction(avant, apres, { aujourdhui: dateParisISO(), auteurId }).map((n) => n.membreId))];
  return quiRecevra(s, apres, ids, groupesGerant(apres, aNotifier));
}

/**
 * Actions de la personne connectée :
 *   GET  ?action=notifications-etat&endpoint=…  serveur prêt ? clé publique, cet appareil abonné ?
 *   GET  ?action=prevenus&logement=…            qui recevrait une urgence signalée maintenant
 *   POST { action: 'notifications-abonner', abonnement, nom? }
 *   POST { action: 'notifications-desabonner', endpoint }
 *   POST { action: 'notifications-tester', endpoint }
 */
export async function actionNotificationsOps(req: any, res: any, s: SessionOps, action: string, corps: Record<string, unknown>) {
  const cles = clesServeur();
  const membreId = s.acces.membreId;

  if (req.method === 'GET') {
    if (action === 'notifications-etat') {
      const endpoint = String(req.query?.endpoint ?? '').trim();
      const abonne = !!cles && !!endpoint && !!(await appareilsValables(s.base, [membreId], s.espace)).get(membreId)?.some((a) => a.endpoint === endpoint);
      return repondre(res, 200, { ok: true, actif: !!cles, clePublique: cles?.publique ?? null, abonne });
    }
    if (action === 'prevenus') {
      // { noms, gerant } : « Le gérant est prévenu » seulement si un appareil de l'ERP recevra l'urgence.
      if (!cles) return repondre(res, 200, { ok: true, noms: [], gerant: false });
      const e = await entreesOps(s.base);
      const logementId = String(req.query?.logement ?? '');
      const ids = destinatairesUrgence(e, membreId, logementId, dateParisISO());
      const urgence = notificationUrgence({ id: 'apercu', logementId, gravite: 'haute', statut: 'ouvert', description: '' }, '');
      return repondre(res, 200, { ok: true, ...(await quiRecevra(s, e, ids, urgence ? [urgence] : [])) });
    }
    return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  }

  if (req.method !== 'POST') return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  if (!provenanceSite(req)) return repondre(res, 403, { ok: false, erreur: 'Demande refusée : utilisez la page de l’espace opérations.' });
  if (!cles) return repondre(res, 503, { ok: false, code: 'inactif', erreur: 'Notifications pas encore activées sur le serveur.' });

  if (action === 'notifications-abonner') {
    const abonnement = abonnementValide(corps.abonnement);
    if (!abonnement) return repondre(res, 400, { ok: false, erreur: 'Abonnement du navigateur illisible.' });
    await abonnerAppareilOps(s.base, { membreId, email: s.acces.email, version: s.acces.version, abonnement, nom: typeof corps.nom === 'string' ? corps.nom : undefined });
    return repondre(res, 200, { ok: true });
  }
  const endpoint = typeof corps.endpoint === 'string' ? corps.endpoint.trim() : '';
  if (!endpoint) return repondre(res, 400, { ok: false, erreur: 'Appareil inconnu.' });
  if (action === 'notifications-desabonner') {
    await desabonnerAppareilOps(s.base, membreId, endpoint);
    return repondre(res, 200, { ok: true });
  }
  if (action === 'notifications-tester') {
    if (tropDeTests(`${s.espace}:${membreId}`)) return repondre(res, 429, { ok: false, erreur: 'Trop d’essais : patientez quelques minutes.' });
    if (!(await appareilsValables(s.base, [membreId], s.espace)).get(membreId)?.some((a) => a.endpoint === endpoint)) {
      return repondre(res, 404, { ok: false, code: 'inconnu', erreur: PLUS_ABONNE });
    }
    const bilan = await envoyerNotificationsOps(s.base, [notificationTestOps(membreId, `ops-test-${Date.now()}`)], { cles, espace: s.espace, essai: true, seulement: endpoint });
    if (!bilan.envoyees) {
      return repondre(res, 502, {
        ok: false,
        ...(bilan.expires ? { code: 'inconnu' } : {}),
        erreur: bilan.expires ? PLUS_ABONNE : 'Le service de notifications n’a pas accepté l’envoi. Réessayez dans un instant.',
      });
    }
    return repondre(res, 200, { ok: true });
  }
  return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
}

/**
 * Après une action de l'espace (déjà écrite) : incident confié, urgence,
 * remplacement en cours, aux personnes concernées sauf l'auteur. Ne lève jamais.
 */
export async function notifierEquipe(s: Pick<SessionOps, 'base' | 'espace'>, avant: EntreesOperations, apres: EntreesOperations, auteurId: string): Promise<void> {
  const cles = clesServeur();
  if (!cles) return;
  try {
    const notifications = notificationsApresAction(avant, apres, { aujourdhui: dateParisISO(), auteurId });
    if (notifications.length) await envoyerNotificationsOps(s.base, notifications, { cles, espace: s.espace });
  } catch (e) {
    console.warn('[espace-operations] notifications de l’équipe', e instanceof Error ? e.message : e);
  }
}

/**
 * Gérant (Paramètres → Accès, « Le garder » / « Lui retirer ») :
 *   POST { action: 'signalement-traite', id }
 * La personne qui a signalé reçoit la réponse. Pas encore dans la base (la
 * synchronisation de l'ERP écrit juste après) : 409 « pas_encore », l'ERP
 * réessaie ; le passage du matin rattrape ce qui aurait été manqué.
 */
export async function signalementTraite(req: any, res: any, corps: Record<string, unknown>) {
  const g = await gerantDeLEspace(req);
  if (!g.ok) return repondre(res, g.statut, { ok: false, erreur: g.erreur });
  if (req.method !== 'POST') return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  const id = String(corps.id ?? '');
  if (!/^[\w-]{1,80}$/.test(id)) return repondre(res, 400, { ok: false, erreur: 'Signalement inconnu.' });
  const cles = clesServeur();
  if (!cles) return repondre(res, 200, { ok: true, envoye: false });
  const base = baseAcces(g.espace);
  const e = await entreesOps(base);
  const s = e.signalementsLogement.find((x) => x?.id === id);
  if (!s || s.statut !== 'traite') return repondre(res, 409, { ok: false, code: 'pas_encore', erreur: 'Réponse pas encore enregistrée : réessayez dans un instant.' });
  const n = notificationSignalementTraite(e, s);
  const bilan = n ? await envoyerNotificationsOps(base, [n], { cles, espace: g.espace }) : null;
  return repondre(res, 200, { ok: true, envoye: !!bilan?.envoyees });
}

/**
 * Passage du matin, chaque espace actif : remplacements qui commencent,
 * contrôles qualité du jour (une fois par jour et par personne), réponses
 * du gérant manquées. Rien avant 7 h à Paris (le réveil de 22 h UTC tombe à
 * minuit l'été) : le premier passage planifié de l'agent après 7 h l'envoie.
 * Borné dans le temps, ne lève jamais : l'agent qui suit n'attend pas plus
 * de `limite`.
 */
export async function notificationsOpsDuJour(o: { aujourdhui?: string; limite?: number; maintenant?: Date } = {}): Promise<Record<string, string>> {
  const bilans: Record<string, string> = {};
  const maintenant = o.maintenant ?? new Date();
  if (!matinOpsOuvert(maintenant)) return bilans;
  const cles = clesServeur();
  if (!cles) return bilans;
  const limite = o.limite ?? Date.now() + 8_000;
  const aujourdhui = o.aujourdhui ?? dateParisISO(maintenant);
  const travail = (async () => {
    let espaces: Awaited<ReturnType<typeof espacesActifs>> = [];
    try {
      espaces = await espacesActifs();
    } catch (e) {
      console.warn('[operations] espaces illisibles', e instanceof Error ? e.message : e);
      return;
    }
    for (const fiche of espaces) {
      if (Date.now() > limite) break;
      try {
        const base = baseAcces(fiche.id);
        // D'abord qui a un téléphone abonné : sans personne, rien d'autre n'est lu.
        const acces = await base.lire<AccesOperations>(GENRES.operations.collection);
        const avec = await appareilsValables(
          base,
          acces.filter((a) => a?.statut === 'actif').map((a) => a.membreId),
          fiche.id,
        );
        if (!avec.size) continue;
        const notifications = notificationsDuJour(await entreesOps(base), aujourdhui).filter((n) => avec.has(n.membreId));
        if (notifications.length) bilans[fiche.code] = resumeBilan(await envoyerNotificationsOps(base, notifications, { cles, espace: fiche.id }));
      } catch (e) {
        bilans[fiche.code] = e instanceof Error ? e.message : String(e);
        console.warn('[operations] passage du matin', fiche.code, bilans[fiche.code]);
      }
    }
  })();
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([travail, new Promise<void>((r) => (minuteur = setTimeout(r, Math.max(0, limite - Date.now()))))]);
  clearTimeout(minuteur);
  return bilans;
}
