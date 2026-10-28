// =============================================================================
// Transport MCP « Streamable HTTP » sans état du connecteur Claude de l'ERP
// (CRM + channel manager), partagé par :
//   /api/crm-mcp         accès OAuth (jeton Bearer) — l'adresse donnée dans l'ERP
//   /api/crm-mcp/<clé>   accès par clé fixée par l'administrateur (MCP_CRM_TOKEN)
// Chaque POST porte un message JSON-RPC et reçoit sa réponse en JSON (pas de SSE).
//
// Chaque appel ne voit QUE l'espace de son accès : celui du jeton OAuth (le
// gérant qui a autorisé Claude, voir api/_oauth.ts), Label Maison pour la clé
// fixée. Les données sont lues (et le CRM écrit) avec le compte serveur dans
// cet espace, ou avec le compte d'équipe pour Label Maison (baseErp).
// Logique des outils : src/erp/data/crm-mcp.ts (CRM), cm-mcp.ts (channel
// manager) et copilote-mcp.ts (réponse proposée, ménage interne, brouillon de
// facture, prix conseillés en lecture). Chaque écriture d'un outil est tracée
// avant d'être faite dans la collection actionsAgent de l'espace (copilote.ts),
// avec l'accès qui l'a faite (jeton OAuth et gérant qui l'a autorisé, ou clé).
// Rien n'est jamais envoyé aux voyageurs ni écrit vers les plateformes.
// =============================================================================

import { traiterMcp, VERSIONS_PROTOCOLE, type ContexteMcp } from '../src/erp/data/crm-mcp.js';
import { COLLECTION_ACTIONS_AGENT, actionsIaProtegees } from '../src/erp/data/copilote.js';
import { ID_REGLAGE_SOCIETE } from '../src/erp/data/identite-conciergerie.js';
import { COLLECTION_PRIX, type ElementPrix } from '../src/erp/data/prix-conseils.js';
import { horodatageParis } from '../src/erp/data/repull.js';
import type { BaseErp } from '../src/erp/data/repull-synchro.js';
import type { ContactCrm, Facture, FilMessages, Logement, Mandat, Mission, Proprietaire, Reglage, Reservation } from '../src/erp/data/types.js';
import type { ClientAction } from '../src/erp/data/types-copilote.js';
import { configuration, lireCorps, type ConfigRepullErp } from './_erp-repull.js';
import type { EspaceDuJeton } from './_erp-espaces.js';

/** Appels venant d'un navigateur : seulement ces origines (protection « DNS rebinding » demandée par la spécification). */
const ORIGINES = /^https:\/\/([a-z0-9-]+\.)*(claude\.ai|claude\.com|anthropic\.com|labelmaisoncg\.fr)$/i;

/** Contrôle d'accès d'une route : l'espace de l'accès (sa base, son nom) et qui appelle (trace), ou null (refusé). */
export type Verification = (req: any, c: ConfigRepullErp) => Promise<(EspaceDuJeton & { client?: ClientAction }) | null>;

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
  let espace: (EspaceDuJeton & { client?: ClientAction }) | null = null;
  try {
    espace = await autorise(req, c);
  } catch (e) {
    console.error('[crm-mcp] contrôle d’accès :', e);
    return json(503, { error: 'Connecteur indisponible.' });
  }
  if (!espace) {
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
    ...depotsMcp(espace.base),
    aujourdhui: () => horodatageParis().slice(0, 10),
    maintenant: () => horodatageParis(),
    espace: { id: espace.id, nom: espace.nom },
    ...(espace.client ? { client: espace.client } : {}),
  };

  const corps = typeof req.body === 'string' ? lireJson(req.body) : req.body ?? lireCorps(req);
  if (corps === undefined) return json(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON illisible.' } });

  const r = await traiterMcp(corps, ctx);
  if (r.statut === 202) return res.status(202).end();
  return json(r.statut, r.corps);
}

/**
 * Les données de l'accès, seul point d'entrée des outils : `base` est celle
 * de l'espace du jeton (ou de la clé), et rien d'autre.
 */
export function depotsMcp(base: BaseErp): Pick<ContexteMcp, 'depot' | 'cm' | 'copilote' | 'actions'> {
  return {
    depot: {
      tous: () => base.lire<ContactCrm>('crm'),
      un: async (id) => (await base.lire<ContactCrm>('crm', [id]))[0],
      enregistrer: (contact) => base.ecrire('crm', [contact], 'Claude'),
    },
    cm: {
      logements: () => base.lire<Logement>('logements'),
      reservations: () => base.lire<Reservation>('reservations'),
      fils: () => base.lire<FilMessages>('filsMessages'),
      fil: async (id) => (await base.lire<FilMessages>('filsMessages', [id]))[0],
      // Seules écritures du channel manager : conversation « terminée », réponse proposée (rien vers les plateformes).
      enregistrerFil: (f) => base.ecrire('filsMessages', [f], 'Claude'),
    },
    copilote: {
      missions: () => base.lire<Mission>('missions'),
      // Ménage interne : écrit dans l'ERP seulement, jamais transmis à un prestataire.
      enregistrerMission: (m) => base.ecrire('missions', [m], 'Claude'),
      facturation: async () => {
        const [proprietaires, mandats, factures, reglages] = await Promise.all([
          base.lire<Proprietaire>('proprietaires'),
          base.lire<Mandat>('mandats'),
          base.lire<Facture>('factures'),
          base.lire<Reglage>('reglages', [ID_REGLAGE_SOCIETE]),
        ]);
        return { proprietaires, mandats, factures, reglages };
      },
      // Brouillon ajouté seulement s'il est absent : une facture déjà là (validée ou non) n'est jamais remplacée.
      ajouterFacture: async (f) => (await base.ajouterSiAbsent('factures', [f], 'Claude')) > 0,
      prix: () => base.lire<ElementPrix>(COLLECTION_PRIX),
    },
    actions: {
      // Sans la règle SQL des actions de l'IA, la trace serait lisible par tous les membres : rien n'est écrit.
      enregistrer: async (a) => {
        if (!(await actionsIaProtegees(base))) throw new Error('Mise en service pas terminée (supabase/erp-espaces.sql à relancer) : rien n’a été modifié.');
        await base.ecrire(COLLECTION_ACTIONS_AGENT, [a], 'Claude');
      },
    },
  };
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
