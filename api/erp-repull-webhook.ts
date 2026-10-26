// =============================================================================
// POST /api/erp-repull-webhook — événements Repull pour l'ERP (temps réel).
//
// Abonnement distinct de celui de l'agent IA (agent-ia/api/repull-webhook.ts),
// avec son propre secret : REPULL_WEBHOOK_SECRET_ERP. Les webhooks ne sont pas
// inclus dans l'offre gratuite de Repull : sans eux, l'ERP reste complet grâce
// au cron quotidien et au bouton « Synchroniser maintenant ».
//
// Signature (doc Repull « Verify Webhook Signatures ») : en-tête
// X-Repull-Signature « t=<unix>,v1=<hex> », v1 = HMAC-SHA256(secret,
// `${t}.${corps brut}`), comparaison à temps constant, horodatage refusé
// au-delà de 5 minutes (rejeu). Dédoublonnage sur X-Repull-Event-Id (stable
// d'une nouvelle livraison à l'autre) ; le traitement est de toute façon
// idempotent (relecture chez Repull puis fusion).
//
// Chaque événement relit l'élément concerné chez Repull (un ou deux appels,
// imputés sur la part mensuelle de l'ERP) ; account.created (nouveau compte
// connecté) lance une synchronisation complète.
//
// Espaces (api/_erp-espaces.ts) :
//   - /api/erp-repull-webhook : compte Repull de Label Maison, signé avec
//     REPULL_WEBHOOK_SECRET_ERP. Un événement « tagué » workspaceId va à
//     l'espace qui a déclaré ce workspace. Tant qu'aucun autre espace n'en a
//     déclaré, tout reste à Label Maison, comme avant ; ensuite, un workspace
//     inconnu est ignoré (jamais versé dans Label Maison) ;
//   - /api/erp-repull-webhook?espace=<code> : espace qui a son propre compte
//     Repull, signé avec SON secret (coffre de Supabase), jamais celui de
//     Label Maison. Espace inconnu, fermé ou sans secret : même réponse
//     qu'une signature fausse (l'adresse ne dit pas quels espaces existent).
// =============================================================================

import crypto from 'node:crypto';
import { lancer, texteErreur, type EvenementRepull } from '../src/erp/data/repull-synchro.js';
import { signatureValide, type OutilsSignature } from '../src/erp/data/repull-signature.js';
import { baseErp, configuration, continuerApresReponse, repondre, variableManquante, type ConfigRepullErp } from './_erp-repull.js';
import { agentApresSynchro } from './_erp-agent.js';
import { estLabelMaison } from '../src/erp/data/espaces.js';
import { codeEspaceDuWebhook, configurationEspace, espaceDuWorkspace, espacesActifs, workspaceDeLEvenement } from './_erp-espaces.js';
import { surveiller } from './_erp-notifications.js';

/** La signature porte sur le corps exact reçu : pas d'analyse JSON préalable. */
export const config = { api: { bodyParser: false } };

const BUDGET_TEMPS_MS = 50_000;

/** Événements déjà traités par cette instance (les nouvelles livraisons gardent le même id). */
const dejaVus = new Map<string, number>();
function dejaTraite(id: string): boolean {
  if (!id) return false;
  if (dejaVus.has(id)) return true;
  dejaVus.set(id, Date.now());
  if (dejaVus.size > 1000) dejaVus.delete(dejaVus.keys().next().value as string);
  return false;
}

async function corpsBrut(req: any): Promise<string> {
  const morceaux: Buffer[] = [];
  try {
    for await (const m of req) morceaux.push(typeof m === 'string' ? Buffer.from(m) : m);
  } catch {
    /* flux déjà consommé par la plateforme */
  }
  if (morceaux.length) return Buffer.concat(morceaux).toString('utf8');
  const b = req.body;
  if (Buffer.isBuffer(b)) return b.toString('utf8');
  if (typeof b === 'string') return b;
  // Corps déjà analysé : la signature ne correspondra pas, et c'est voulu.
  return b ? JSON.stringify(b) : '';
}

/** Calcul HMAC et comparaison à temps constant (node:crypto). */
const OUTILS: OutilsSignature = {
  hmacHex: (secret, message) => crypto.createHmac('sha256', secret).update(message).digest('hex'),
  egal: (a, b) => {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return repondre(res, 405, { ok: false });
  }
  const debut = Date.now();
  let c: ConfigRepullErp = configuration();
  const code = codeEspaceDuWebhook(req);
  if (code) {
    // Espace avec son propre compte Repull : son secret, jamais celui de Label Maison.
    let secret = '';
    try {
      const fiche = (await espacesActifs(c)).find((e) => e.code === code && !estLabelMaison(e.id));
      if (fiche) {
        c = await configurationEspace(fiche.id, fiche);
        secret = c.secretWebhook;
      }
    } catch (e) {
      console.error('[erp-repull-webhook] espace', code, texteErreur(e));
    }
    if (!secret) {
      // Inconnu, fermé ou sans secret : réponse d'une signature fausse.
      console.warn('[erp-repull-webhook] espace inconnu, fermé ou sans secret : rejeté.', code);
      return repondre(res, 401, { ok: false });
    }
  } else if (!c.secretWebhook) {
    console.error('[erp-repull-webhook] REPULL_WEBHOOK_SECRET_ERP manquant : livraison refusée.');
    return repondre(res, 503, { ok: false, erreur: 'REPULL_WEBHOOK_SECRET_ERP manquant.' });
  }

  const brut = await corpsBrut(req);
  if (!signatureValide(brut, req.headers?.['x-repull-signature'], c.secretWebhook, OUTILS)) {
    console.warn('[erp-repull-webhook] signature invalide : rejeté.');
    return repondre(res, 401, { ok: false });
  }

  let ev: EvenementRepull;
  try {
    ev = JSON.parse(brut) as EvenementRepull;
  } catch {
    return repondre(res, 400, { ok: false, erreur: 'Corps illisible.' });
  }
  const idEvenement = String(req.headers?.['x-repull-event-id'] ?? ev?.eventId ?? '');
  if (ev?.event === 'repull.ping') return repondre(res, 200, { ok: true, ping: true });

  const workspace = workspaceDeLEvenement(ev);
  if (code) {
    // Compte propre : si l'espace a déclaré un workspace, l'événement doit en venir.
    if (workspace && c.workspace && workspace !== c.workspace) return repondre(res, 200, { ok: true, ignore: 'workspace' });
  } else if (workspace) {
    // Événement d'un workspace : l'espace qui l'a déclaré (voir espaceDuWorkspace).
    try {
      const fiche = espaceDuWorkspace(await espacesActifs(c), workspace);
      if (!fiche) {
        console.warn('[erp-repull-webhook] workspace sans espace : ignoré', workspace);
        return repondre(res, 200, { ok: true, ignore: 'workspace' });
      }
      if (!estLabelMaison(fiche.id)) c = await configurationEspace(fiche.id, fiche);
    } catch (e) {
      console.error('[erp-repull-webhook] espace du workspace', workspace, texteErreur(e));
      return repondre(res, 503, { ok: false });
    }
  }
  if (dejaTraite(idEvenement)) return repondre(res, 200, { ok: true, doublon: true });

  const manque = variableManquante(c);
  if (manque) {
    console.error('[erp-repull-webhook]', manque);
    return repondre(res, 503, { ok: false, erreur: manque });
  }

  const base = baseErp(c);
  // Notifications de ce que l'événement apporte (réservation, message, réponse de l'agent).
  const traitement = surveiller(
    base,
    () =>
      lancer({
        cle: c.cle,
        workspace: c.workspace,
        base,
        declencheur: 'webhook',
        echeance: debut + BUDGET_TEMPS_MS,
        budgetMois: c.budgetMois,
        quotaMois: c.quotaMois,
        evenement: ev,
      }).then(async (r) => {
        if (!r.ok) console.warn('[erp-repull-webhook]', ev.event, r.statut, r.message);
        // Nouveau message d'un voyageur : l'agent IA répond tout de suite.
        if (r.statut === 'fait') await agentApresSynchro(c, r.bilan?.messages ?? 0, debut + 55_000);
        return r;
      }),
    { limite: debut + 58_000 },
  )
    .catch((e) => {
      // Échec : l'événement peut revenir (nouvelle livraison) — on l'oublie ici.
      dejaVus.delete(idEvenement);
      console.error('[erp-repull-webhook] traitement échoué', ev.event, texteErreur(e));
      throw e;
    });

  // Repull attend un 2xx en moins de 10 s : on répond tout de suite et on
  // termine en arrière-plan quand la plateforme le permet.
  if (continuerApresReponse(traitement.catch(() => undefined))) return repondre(res, 200, { ok: true });
  try {
    await traitement;
    return repondre(res, 200, { ok: true });
  } catch (e) {
    return repondre(res, 500, { ok: false, erreur: texteErreur(e) });
  }
}
