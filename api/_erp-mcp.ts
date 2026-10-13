// =============================================================================
// Clé du connecteur MCP du CRM (/api/crm-mcp/<clé>).
//
// - MCP_CRM_TOKEN (variable Vercel, 32 caractères au moins) si elle est
//   définie : adresse « fixée par l'administrateur » ;
// - sinon une clé ALÉATOIRE (32 octets) créée par un gérant depuis l'ERP. La
//   base ne garde que son EMPREINTE (SHA-256), dans la collection technique
//   `connecteurs` : la table étant lisible par toute l'équipe (et diffusée en
//   temps réel), la clé elle-même n'y est jamais écrite. L'adresse complète
//   n'est donc montrée qu'une fois, à la création ; perdue, on en crée une
//   nouvelle (l'ancienne cesse de fonctionner).
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import crypto from 'node:crypto';
import type { BaseErp } from '../src/erp/data/repull-synchro.js';

const COLLECTION = 'connecteurs';
const ID = 'claude-crm';
const DUREE_CACHE_MS = 60_000;

const empreinte = (cle: string) => crypto.createHash('sha256').update(cle).digest('hex');

/** Empreinte en vigueur, ou null, gardée 1 min (une clé refusée relit la base au plus toutes les 5 s). */
let cache: { empreinte: string | null; lu: number } | null = null;

/** Clé imposée par Vercel (null : pas de variable valable). */
export function cleFixee(): string | null {
  const v = (process.env.MCP_CRM_TOKEN || '').trim();
  if (v.length >= 32) return v;
  if (v) console.warn('[crm-mcp] MCP_CRM_TOKEN ignorée : 32 caractères au moins.');
  return null;
}

async function lireEmpreinte(base: BaseErp, forcer = false): Promise<string | null> {
  if (!forcer && cache && Date.now() - cache.lu < DUREE_CACHE_MS) return cache.empreinte;
  const [lu] = await base.lire<{ id: string; empreinte?: string }>(COLLECTION, [ID]);
  const e = lu?.empreinte && /^[a-f0-9]{64}$/.test(lu.empreinte) ? lu.empreinte : null;
  cache = { empreinte: e, lu: Date.now() };
  return e;
}

/** La clé fournie ouvre-t-elle le connecteur ? (comparaison à temps constant) */
export async function cleValide(base: BaseErp, fournie: string): Promise<boolean> {
  if (!fournie) return false;
  const fixee = cleFixee();
  if (fixee) return egales(empreinte(fournie), empreinte(fixee));
  if (egales(empreinte(fournie), await lireEmpreinte(base))) return true;
  // Adresse créée à l'instant depuis une autre instance : relecture, au plus toutes les 5 s.
  if (cache && Date.now() - cache.lu < 5_000) return false;
  return egales(empreinte(fournie), await lireEmpreinte(base, true));
}

function egales(a: string, b: string | null): boolean {
  if (!b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export type EtatConnecteur = { fixee: true; url: string } | { fixee: false; existe: boolean };

/** Ce que voit le gérant en ouvrant « Connecter à Claude » (jamais une clé stockée : il n'y en a pas). */
export async function etatConnecteur(base: BaseErp): Promise<EtatConnecteur> {
  const fixee = cleFixee();
  if (fixee) return { fixee: true, url: URL_CONNECTEUR(fixee) };
  return { fixee: false, existe: !!(await lireEmpreinte(base, true)) };
}

/**
 * Nouvelle clé aléatoire : seule son empreinte est enregistrée, l'adresse est
 * renvoyée une seule fois. L'ancienne cesse de fonctionner (1 min au plus).
 * Relue après écriture : deux demandes simultanées ne rendent pas une adresse morte.
 */
export async function creerCleConnecteur(base: BaseErp): Promise<string> {
  const cle = crypto.randomBytes(32).toString('hex');
  const e = empreinte(cle);
  await base.ecrire(COLLECTION, [{ id: ID, empreinte: e, creeLe: new Date().toISOString() } as { id: string }], 'ERP');
  if ((await lireEmpreinte(base, true)) !== e) throw new Error('Deux créations simultanées : réessayez.');
  return cle;
}

export const URL_CONNECTEUR = (cle: string) => `https://www.labelmaisoncg.fr/api/crm-mcp/${cle}`;
