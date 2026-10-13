// =============================================================================
// /api/crm-mcp — connecteur MCP du CRM pour Claude (claude.ai, Claude Desktop,
// Claude Code), protégé par OAuth 2.1 : Claude découvre le serveur
// d'autorisation (WWW-Authenticate → /.well-known/…), le gérant autorise
// l'accès depuis l'ERP (/erp/autoriser-claude), puis chaque appel porte un
// jeton Bearer (api/_oauth.ts). Transport : api/_crm-mcp-http.ts.
// =============================================================================

import { META_RESSOURCE } from '../../src/erp/data/oauth-regles.js';
import { jetonBearer, servirCrmMcp } from '../_crm-mcp-http.js';
import { accesValide } from '../_oauth.js';

export default function handler(req: any, res: any) {
  return servirCrmMcp(
    req,
    res,
    async (r, base) => {
      const jeton = jetonBearer(r);
      return !!jeton && !!(await accesValide(base, jeton));
    },
    // Jeton présenté mais refusé (expiré, révoqué) : Claude le rafraîchit ou relance la connexion.
    (r) => (jetonBearer(r) ? `Bearer error="invalid_token", resource_metadata="${META_RESSOURCE}"` : `Bearer resource_metadata="${META_RESSOURCE}"`),
  );
}
