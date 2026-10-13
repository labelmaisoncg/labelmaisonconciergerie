// =============================================================================
// Clé du connecteur MCP du CRM (/api/crm-mcp/<clé>).
//
// - MCP_CRM_TOKEN (variable Vercel, 32 caractères au moins) si elle est
//   définie ;
// - sinon une clé ALÉATOIRE (32 octets), créée à la première demande d'un
//   gérant et gardée dans la base de l'ERP (collection technique
//   `connecteurs`, hors des données affichées). Elle ne dérive d'aucun mot de
//   passe : connaître l'adresse du connecteur n'apprend rien d'autre.
//   « Changer l'adresse » dans l'ERP la remplace et coupe les anciens accès.
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import crypto from 'node:crypto';
import type { BaseErp } from '../src/erp/data/repull-synchro.js';

const COLLECTION = 'connecteurs';
const ID = 'claude-crm';
const DUREE_CACHE_MS = 60_000;

let cache: { cle: string; lu: number } | null = null;

/** Clé imposée par Vercel (null : pas de variable valable). */
function cleVariable(): string | null {
  const v = (process.env.MCP_CRM_TOKEN || '').trim();
  if (v.length >= 32) return v;
  if (v) console.warn('[crm-mcp] MCP_CRM_TOKEN ignorée : 32 caractères au moins.');
  return null;
}

/**
 * Clé en vigueur (gardée 1 min par instance). `creer` : en fabriquer une si
 * aucune n'existe encore (demande d'un gérant) ; sinon '' = connecteur inactif.
 */
export async function cleConnecteurCrm(base: BaseErp, options: { creer?: boolean } = {}): Promise<string> {
  const variable = cleVariable();
  if (variable) return variable;
  if (cache && Date.now() - cache.lu < DUREE_CACHE_MS) return cache.cle;
  const [lu] = await base.lire<{ id: string; cle?: string }>(COLLECTION, [ID]);
  if (lu?.cle && /^[a-f0-9]{64}$/.test(lu.cle)) {
    cache = { cle: lu.cle, lu: Date.now() };
    return lu.cle;
  }
  return options.creer ? renouvelerCleConnecteur(base) : '';
}

/** Nouvelle clé aléatoire : l'ancienne adresse cesse de fonctionner (après 1 min au plus sur les autres instances). */
export async function renouvelerCleConnecteur(base: BaseErp): Promise<string> {
  const variable = cleVariable();
  if (variable) return variable;
  const cle = crypto.randomBytes(32).toString('hex');
  await base.ecrire(COLLECTION, [{ id: ID, cle, creeLe: new Date().toISOString() } as { id: string }], 'ERP');
  cache = { cle, lu: Date.now() };
  return cle;
}

export const URL_CONNECTEUR = (cle: string) => `https://www.labelmaisoncg.fr/api/crm-mcp/${cle}`;
