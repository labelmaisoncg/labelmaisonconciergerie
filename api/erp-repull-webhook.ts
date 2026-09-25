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
// =============================================================================

import crypto from 'node:crypto';
import { lancer, texteErreur, type EvenementRepull } from '../src/erp/data/repull-synchro.js';
import { baseErp, configuration, continuerApresReponse, repondre, variableManquante } from './_erp-repull.js';

/** La signature porte sur le corps exact reçu : pas d'analyse JSON préalable. */
export const config = { api: { bodyParser: false } };

const TOLERANCE_S = 5 * 60;
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

/** Vérifie X-Repull-Signature (plusieurs v1 acceptés : rotation du secret). */
export function signatureValide(brut: string, entete: unknown, secret: string, maintenantS = Math.floor(Date.now() / 1000)): boolean {
  if (!secret) return false;
  let t = '';
  const v1: string[] = [];
  for (const morceau of String(entete ?? '').split(',')) {
    const i = morceau.indexOf('=');
    if (i <= 0) continue;
    const k = morceau.slice(0, i).trim();
    const v = morceau.slice(i + 1).trim();
    if (k === 't') t = v;
    else if (k === 'v1') v1.push(v);
  }
  if (!/^\d+$/.test(t) || !v1.length) return false;
  if (Math.abs(maintenantS - Number(t)) > TOLERANCE_S) return false;
  const attendue = Buffer.from(crypto.createHmac('sha256', secret).update(`${t}.${brut}`).digest('hex'));
  return v1.some((s) => {
    const recue = Buffer.from(s);
    return recue.length === attendue.length && crypto.timingSafeEqual(recue, attendue);
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return repondre(res, 405, { ok: false });
  }
  const debut = Date.now();
  const c = configuration();
  if (!c.secretWebhook) {
    console.error('[erp-repull-webhook] REPULL_WEBHOOK_SECRET_ERP manquant : livraison refusée.');
    return repondre(res, 503, { ok: false, erreur: 'REPULL_WEBHOOK_SECRET_ERP manquant.' });
  }

  const brut = await corpsBrut(req);
  if (!signatureValide(brut, req.headers?.['x-repull-signature'], c.secretWebhook)) {
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
  if (dejaTraite(idEvenement)) return repondre(res, 200, { ok: true, doublon: true });

  const manque = variableManquante(c);
  if (manque) {
    console.error('[erp-repull-webhook]', manque);
    return repondre(res, 503, { ok: false, erreur: manque });
  }

  const traitement = lancer({
    cle: c.cle,
    base: baseErp(c),
    declencheur: 'webhook',
    echeance: debut + BUDGET_TEMPS_MS,
    budgetMois: c.budgetMois,
    quotaMois: c.quotaMois,
    evenement: ev,
  })
    .then((r) => {
      if (!r.ok) console.warn('[erp-repull-webhook]', ev.event, r.statut, r.message);
      return r;
    })
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
