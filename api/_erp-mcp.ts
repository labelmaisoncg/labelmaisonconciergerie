// =============================================================================
// Clé fixée par l'administrateur pour /api/crm-mcp/<clé> (variable Vercel
// MCP_CRM_TOKEN, 32 caractères au moins) : utile pour un outil qui ne gère pas
// OAuth. La voie normale est OAuth (api/_oauth.ts).
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import crypto from 'node:crypto';

/** Clé imposée par Vercel (null : pas de variable valable). */
export function cleFixee(): string | null {
  const v = (process.env.MCP_CRM_TOKEN || '').trim();
  if (v.length >= 32) return v;
  if (v) console.warn('[crm-mcp] MCP_CRM_TOKEN ignorée : 32 caractères au moins.');
  return null;
}

/** La clé fournie est-elle la clé fixée ? (empreintes comparées à temps constant) */
export function cleValide(fournie: string): boolean {
  const fixee = cleFixee();
  if (!fixee || !fournie) return false;
  const a = crypto.createHash('sha256').update(fournie).digest();
  const b = crypto.createHash('sha256').update(fixee).digest();
  return crypto.timingSafeEqual(a, b);
}
