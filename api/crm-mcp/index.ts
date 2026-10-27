// =============================================================================
// /api/crm-mcp — connecteur MCP de l'ERP pour Claude (claude.ai, Claude
// Desktop, Claude Code), protégé par OAuth 2.1 : Claude découvre le serveur
// d'autorisation (WWW-Authenticate → /.well-known/…), un gérant autorise
// l'accès depuis l'ERP (/erp/autoriser-claude), puis chaque appel porte un
// jeton Bearer (api/_oauth.ts). Transport : api/_crm-mcp-http.ts.
//
// Le jeton appartient à l'espace du gérant qui a autorisé : il n'est cherché,
// et les outils ne lisent, que dans la base de cet espace. Ancien jeton (sans
// espace) : Label Maison. Espace fermé ou base pas prête : refusé.
// =============================================================================

import { META_RESSOURCE, espaceDuJeton } from '../../src/erp/data/oauth-regles.js';
import { jetonBearer, servirCrmMcp } from '../_crm-mcp-http.js';
import { espaceOuvertAuJeton } from '../_erp-espaces.js';
import { accesValide } from '../_oauth.js';

export default function handler(req: any, res: any) {
  return servirCrmMcp(
    req,
    res,
    async (r, c) => {
      const jeton = jetonBearer(r);
      const espace = espaceDuJeton(jeton);
      if (!espace) return null;
      const ouvert = await espaceOuvertAuJeton(c, espace);
      return ouvert && (await accesValide(ouvert.base, jeton)) ? ouvert : null;
    },
    // Jeton présenté mais refusé (expiré, révoqué) : Claude le rafraîchit ou relance la connexion.
    (r) => (jetonBearer(r) ? `Bearer error="invalid_token", resource_metadata="${META_RESSOURCE}"` : `Bearer resource_metadata="${META_RESSOURCE}"`),
  );
}
