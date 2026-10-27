// =============================================================================
// /api/crm-mcp/<clé> — même connecteur que /api/crm-mcp, ouvert par une clé
// fixée par l'administrateur (variable Vercel MCP_CRM_TOKEN, 32 caractères au
// moins) dans l'adresse ou en « Authorization: Bearer <clé> ». Sans cette
// variable, cette adresse est fermée : la voie normale est OAuth (/api/crm-mcp).
// Variable de Vercel : espace de Label Maison seulement (un autre espace se
// connecte par OAuth, avec l'autorisation de l'un de ses gérants).
// =============================================================================

import { jetonBearer, servirCrmMcp } from '../_crm-mcp-http.js';
import { espaceOuvertAuJeton } from '../_erp-espaces.js';
import { cleValide } from '../_erp-mcp.js';
import { ID_LABEL_MAISON } from '../../src/erp/data/espaces.js';

function cleFournie(req: any): string {
  const bearer = jetonBearer(req);
  if (bearer) return bearer;
  const q = req.query?.cle;
  return String(Array.isArray(q) ? q[0] : (q ?? '')).trim();
}

export default function handler(req: any, res: any) {
  return servirCrmMcp(req, res, async (r, c) => (cleValide(cleFournie(r)) ? espaceOuvertAuJeton(c, ID_LABEL_MAISON) : null));
}
