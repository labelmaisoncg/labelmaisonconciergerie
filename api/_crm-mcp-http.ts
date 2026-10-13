// =============================================================================
// Transport MCP « Streamable HTTP » sans état du connecteur CRM, partagé par :
//   /api/crm-mcp         accès OAuth (jeton Bearer) — l'adresse donnée dans l'ERP
//   /api/crm-mcp/<clé>   accès par clé fixée par l'administrateur (MCP_CRM_TOKEN)
// Chaque POST porte un message JSON-RPC et reçoit sa réponse en JSON (pas de SSE).
// Le CRM est lu et écrit avec le compte d'équipe (ERP_PASSWORD).
// Logique des outils : src/erp/data/crm-mcp.ts.
// =============================================================================

import { traiterMcp, VERSIONS_PROTOCOLE, type ContexteMcp } from '../src/erp/data/crm-mcp.js';
import { horodatageParis } from '../src/erp/data/repull.js';
import type { BaseErp } from '../src/erp/data/repull-synchro.js';
import type { ContactCrm } from '../src/erp/data/types.js';
import { baseErp, configuration, lireCorps } from './_erp-repull.js';

/** Appels venant d'un navigateur : seulement ces origines (protection « DNS rebinding » demandée par la spécification). */
const ORIGINES = /^https:\/\/([a-z0-9-]+\.)*(claude\.ai|claude\.com|anthropic\.com|labelmaisoncg\.fr)$/i;

export type Verification = (req: any, base: BaseErp) => Promise<boolean>;

export async function servirCrmMcp(req: any, res: any, autorise: Verification, enteteRefus?: (req: any) => string) {
  res.setHeader('Cache-Control', 'no-store');
  const json = (statut: number, corps: unknown) => res.status(statut).json(corps);

  const origine = String(req.headers?.origin || '');
  if (origine && !ORIGINES.test(origine)) return json(403, { error: 'Origine refusée.' });

  const c = configuration();
  if (!c.motDePasse) {
    console.error('[crm-mcp] ERP_PASSWORD absent : CRM inaccessible.');
    return json(503, { error: 'Connecteur indisponible.' });
  }
  const base = baseErp(c);
  let ok = false;
  try {
    ok = await autorise(req, base);
  } catch (e) {
    console.error('[crm-mcp] contrôle d’accès :', e);
    return json(503, { error: 'Connecteur indisponible.' });
  }
  if (!ok) {
    if (enteteRefus) res.setHeader('WWW-Authenticate', enteteRefus(req));
    return json(401, { error: 'Accès refusé : connectez Claude depuis l’ERP (CRM → Plus → Connecter à Claude).' });
  }

  // Pas de flux serveur → client, pas de session à fermer (spécification : 405).
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  // Version négociée à l'initialisation : une autre version est refusée (spécification).
  const version = String(req.headers?.['mcp-protocol-version'] || '');
  if (version && !VERSIONS_PROTOCOLE.includes(version)) return json(400, { error: `Version de protocole non prise en charge : ${version.slice(0, 20)}` });

  const ctx: ContexteMcp = {
    depot: {
      tous: () => base.lire<ContactCrm>('crm'),
      un: async (id) => (await base.lire<ContactCrm>('crm', [id]))[0],
      enregistrer: (contact) => base.ecrire('crm', [contact], 'Claude'),
    },
    aujourdhui: () => horodatageParis().slice(0, 10),
    maintenant: () => horodatageParis(),
  };

  const corps = typeof req.body === 'string' ? lireJson(req.body) : req.body ?? lireCorps(req);
  if (corps === undefined) return json(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON illisible.' } });

  const r = await traiterMcp(corps, ctx);
  if (r.statut === 202) return res.status(202).end();
  return json(r.statut, r.corps);
}

function lireJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/** Jeton « Authorization: Bearer … » (chaîne vide sinon). */
export function jetonBearer(req: any): string {
  const entete = String(req.headers?.authorization || '');
  return /^Bearer\s+/i.test(entete) ? entete.replace(/^Bearer\s+/i, '').trim() : '';
}
