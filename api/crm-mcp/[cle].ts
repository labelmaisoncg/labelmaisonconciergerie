// =============================================================================
// /api/crm-mcp/<clé> — connecteur MCP du CRM pour Claude (claude.ai, Claude
// Desktop, Claude Code). Transport « Streamable HTTP » sans état : chaque POST
// porte un message JSON-RPC et reçoit sa réponse en JSON (pas de flux SSE).
//
// Accès : la clé secrète MCP_CRM_TOKEN (variable Vercel, 32 caractères au
// moins) dans l'adresse, ou en en-tête « Authorization: Bearer <clé> ». Sans
// variable, le connecteur est désactivé. Le CRM est lu et écrit avec le compte
// d'équipe (ERP_PASSWORD), comme les formulaires du site.
//
// Logique des outils : src/erp/data/crm-mcp.ts.
// =============================================================================

import { traiterMcp, VERSIONS_PROTOCOLE, type ContexteMcp } from '../../src/erp/data/crm-mcp.js';
import { horodatageParis } from '../../src/erp/data/repull.js';
import type { ContactCrm } from '../../src/erp/data/types.js';
import { baseErp, configuration, egalConstant, lireCorps } from '../_erp-repull.js';

/** Appels venant d'un navigateur : seulement ces origines (protection « DNS rebinding » demandée par la spécification). */
const ORIGINES = /^https:\/\/([a-z0-9-]+\.)*(claude\.ai|anthropic\.com|labelmaisoncg\.fr)$/i;

function cleFournie(req: any): string {
  const entete = String(req.headers?.authorization || '');
  if (/^Bearer\s+/i.test(entete)) return entete.replace(/^Bearer\s+/i, '').trim();
  const q = req.query?.cle;
  return String(Array.isArray(q) ? q[0] : (q ?? '')).trim();
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  const json = (statut: number, corps: unknown) => res.status(statut).json(corps);

  const origine = String(req.headers?.origin || '');
  if (origine && !ORIGINES.test(origine)) return json(403, { error: 'Origine refusée.' });

  const attendue = (process.env.MCP_CRM_TOKEN || '').trim();
  if (attendue.length < 32) return json(503, { error: 'Connecteur CRM désactivé : MCP_CRM_TOKEN absente ou trop courte (32 caractères au moins).' });
  if (!egalConstant(cleFournie(req), attendue)) return json(401, { error: 'Clé du connecteur invalide.' });

  // Pas de flux serveur → client, pas de session à fermer (spécification : 405).
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const version = String(req.headers?.['mcp-protocol-version'] || '');
  if (version && !/^\d{4}-\d{2}-\d{2}$/.test(version)) return json(400, { error: `Version de protocole invalide : ${version}` });
  if (version && !VERSIONS_PROTOCOLE.includes(version)) console.warn('[crm-mcp] version non répertoriée, traitée comme compatible :', version);

  const c = configuration();
  if (!c.motDePasse) return json(503, { error: 'ERP_PASSWORD manquant dans Vercel : le connecteur ne peut pas lire le CRM.' });
  const base = baseErp(c);

  const ctx: ContexteMcp = {
    depot: {
      tous: () => base.lire<ContactCrm>('crm'),
      un: async (id) => (await base.lire<ContactCrm>('crm', [id]))[0],
      enregistrer: (contact) => base.ecrire('crm', [contact], 'Claude'),
    },
    aujourdhui: () => horodatageParis().slice(0, 10),
    maintenant: () => horodatageParis(),
  };

  const corps = typeof req.body === 'string' ? safeParse(req.body) : req.body ?? lireCorps(req);
  if (corps === undefined) return json(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON illisible.' } });

  const r = await traiterMcp(corps, ctx);
  if (r.statut === 202) return res.status(202).end();
  return json(r.statut, r.corps);
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
