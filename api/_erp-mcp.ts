// =============================================================================
// Clé du connecteur MCP du CRM (/api/crm-mcp/<clé>).
//
// - MCP_CRM_TOKEN (Vercel, 32 caractères au moins) si elle est définie ;
// - sinon une clé dérivée d'ERP_PASSWORD (HMAC-SHA256) : rien à configurer,
//   l'ERP affiche l'adresse aux gérants. Changer ERP_PASSWORD (ou définir
//   MCP_CRM_TOKEN) change la clé et coupe les anciens connecteurs.
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import crypto from 'node:crypto';

export function cleConnecteurCrm(): string {
  const explicite = (process.env.MCP_CRM_TOKEN || '').trim();
  if (explicite.length >= 32) return explicite;
  const motDePasse = (process.env.ERP_PASSWORD || '').trim();
  if (!motDePasse) return '';
  return crypto.createHmac('sha256', motDePasse).update('label-maison/crm-mcp/v1').digest('hex');
}

export const URL_CONNECTEUR = (cle: string) => `https://www.labelmaisoncg.fr/api/crm-mcp/${cle}`;
