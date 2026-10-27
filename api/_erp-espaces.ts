// =============================================================================
// Espaces de l'ERP côté serveur : réglages d'un espace, liste des espaces
// actifs (passages planifiés, webhooks), espace demandé par un appel.
// Modèle et règles : src/erp/data/espaces.ts et supabase/erp-espaces.sql.
//
// Label Maison garde ses ressources de Vercel (REPULL_API_KEY,
// REPULL_WORKSPACE_LM, secret du webhook, Telegram, MCP). Un autre espace
// n'en reprend JAMAIS aucune :
//   - Repull : sa propre clé, que son gérant range dans le coffre de Supabase
//     (Vault) depuis Paramètres → Plateformes (api/erp-espaces.ts), avec le
//     workspace de SA clé s'il en a un (config.repull.workspace) ; ou, cas
//     déclaré par Label Maison seulement (SQL), un workspace sur le compte de
//     Label Maison (colonne repull_workspace, en-tête X-Workspace-Id), permis
//     une fois REPULL_WORKSPACE_LM posé ;
//     part mensuelle d'appels propre (config.repull.budgetMois, 150 par
//     défaut : la part de Label Maison n'est jamais entamée par défaut) ;
//   - webhook : par workspace, ses événements arrivent à l'adresse de Label
//     Maison, « tagués » (espaceDuWorkspace) ; avec sa propre clé, sa propre
//     adresse (?espace=<code>) et son propre secret (coffre) ;
//   - agent IA : la clé Claude commune, avec un plafond mensuel
//     (config.agent.plafondMois, 300 par défaut), sans Telegram.
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import { CODE_LABEL_MAISON, ENTETE_ESPACE, ESPACE_LABEL_MAISON, ID_LABEL_MAISON, MESSAGE_BASE_PAS_PREPAREE, estLabelMaison, idEspaceValide } from '../src/erp/data/espaces.js';
import type { BaseErp } from '../src/erp/data/repull-synchro.js';
import { MESSAGE_COMPTE_SERVEUR, baseErp, configuration, etatBase, repondre, workspaceLabelMaison, type ConfigRepullErp } from './_erp-repull.js';

/** Plafond mensuel des décisions de l'agent IA d'un autre espace que Label Maison. */
export const PLAFOND_IA_DEFAUT = 300;

/** Part mensuelle d'appels Repull d'un autre espace que Label Maison, sauf réglage (0 permis). */
export const BUDGET_ESPACE_DEFAUT = 150;

/** Espace actif tel que le lit le serveur (erp.espaces_actifs). */
export interface FicheEspace {
  id: string;
  code: string;
  nom: string;
  repull_workspace: string | null;
  config: { agent?: { plafondMois?: unknown }; repull?: { budgetMois?: unknown; workspace?: unknown } } | null;
}

const FICHE_LABEL_MAISON: FicheEspace = { ...ESPACE_LABEL_MAISON, repull_workspace: null, config: {} };

/**
 * Fiche de Label Maison avec son workspace Repull : REPULL_WORKSPACE_LM fait
 * foi (c'est lui que portent ses appels) ; sans la variable, celui de sa
 * ligne dans erp.espaces s'il y en a un (reconnaissance du webhook, comme avant).
 */
const avecWorkspaceLabelMaison = (f: FicheEspace): FicheEspace => {
  const ws = workspaceLabelMaison();
  return estLabelMaison(f.id) && ws ? { ...f, repull_workspace: ws } : f;
};

const entierPositif = (v: unknown, defaut: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : defaut;
};

/**
 * Espaces actifs, Label Maison d'abord. Base pas encore préparée, ou compte
 * serveur pas prêt : Label Maison seul (comme avant les espaces).
 */
export async function espacesActifs(c: ConfigRepullErp = configuration()): Promise<FicheEspace[]> {
  const e = await etatBase(c);
  if (e.mode !== 'espaces' || !e.serveur) return [avecWorkspaceLabelMaison(FICHE_LABEL_MAISON)];
  const lignes = await baseErp(c, ID_LABEL_MAISON).rpc<FicheEspace[]>('espaces_actifs');
  const liste = (Array.isArray(lignes) ? lignes : []).filter((x) => idEspaceValide(x?.id)).map((x) => ({ ...x, id: x.id.toLowerCase() }));
  return (liste.some((x) => estLabelMaison(x.id)) ? liste : [FICHE_LABEL_MAISON, ...liste]).map(avecWorkspaceLabelMaison);
}

/**
 * Réglages serveur d'un espace. Label Maison : variables de Vercel, sans
 * changement. Autre espace : sa fiche et ses secrets du coffre ; la clé
 * Repull de Label Maison ne sert QUE dans le workspace de l'espace. Sans
 * workspace ni clé : cle vide (variableManquante l'explique).
 */
export async function configurationEspace(espace: string = ID_LABEL_MAISON, fiche?: FicheEspace): Promise<ConfigRepullErp> {
  const c = configuration();
  if (estLabelMaison(espace)) return c;
  const id = espace.toLowerCase();
  const e = await etatBase(c);
  if (e.mode !== 'espaces') throw new Error(MESSAGE_BASE_PAS_PREPAREE);
  if (!e.serveur) throw new Error(MESSAGE_COMPTE_SERVEUR);
  const f = fiche ?? (await espacesActifs(c)).find((x) => x.id === id);
  if (!f || estLabelMaison(f.id)) throw new Error('Espace inconnu ou fermé.');
  const base = baseErp(c, id);
  const [clePropre, secretWebhook] = await Promise.all([
    base.rpc<string | null>('secret_espace', { p_espace: id, p_nom: 'repull_cle' }),
    base.rpc<string | null>('secret_espace', { p_espace: id, p_nom: 'repull_webhook' }),
  ]);
  const propre = typeof clePropre === 'string' ? clePropre.trim() : '';
  // Sa propre clé (rangée par son gérant, Paramètres → Plateformes), avec le workspace de SA clé s'il en a donné un.
  const wsPropre = typeof f.config?.repull?.workspace === 'string' ? f.config.repull.workspace.trim() : '';
  // Sinon, un workspace sur le compte de Label Maison, que seul Label Maison déclare (SQL Editor).
  const wsCompteLM = (f.repull_workspace ?? '').trim();
  if (!propre && wsCompteLM) {
    // Label Maison doit d'abord limiter ses propres appels à son workspace : sans cela, sa clé lirait aussi celui-ci.
    const lm = workspaceLabelMaison();
    if (!lm) throw new Error('Workspace sur le compte Repull de Label Maison : ajoutez d’abord REPULL_WORKSPACE_LM dans Vercel (docs/erp/espaces-mise-en-service.md).');
    if (wsCompteLM === lm) throw new Error('Cet espace a le même workspace Repull que Label Maison : corrigez repull_workspace (docs/erp/espaces-mise-en-service.md).');
  }
  return {
    ...c,
    espace: id,
    nomEspace: f.nom,
    cle: propre || (wsCompteLM ? c.cle : ''),
    workspace: (propre ? wsPropre : wsCompteLM) || undefined,
    origineCle: propre ? 'espace' : 'partagee',
    // Le secret du webhook de Label Maison ne vaut jamais pour un autre espace.
    secretWebhook: typeof secretWebhook === 'string' ? secretWebhook.trim() : '',
    budgetMois: entierPositif(f.config?.repull?.budgetMois, BUDGET_ESPACE_DEFAUT),
    plafondIAMois: entierPositif(f.config?.agent?.plafondMois, PLAFOND_IA_DEFAUT),
  };
}

/** Espace nommé par l'appel (en-tête x-erp-espace) ; undefined : aucun (Label Maison). */
export function espaceDemande(req: any): string | undefined {
  const brut = req?.headers?.[ENTETE_ESPACE];
  const v = String(Array.isArray(brut) ? brut[0] : (brut ?? '')).trim().toLowerCase();
  return idEspaceValide(v) ? v : undefined;
}

/** Espace ouvert à un accès par jeton : sa base et son nom. */
export interface EspaceDuJeton {
  id: string;
  nom: string;
  base: BaseErp;
}

/**
 * Espace d'un accès par jeton (connecteur Claude, agenda du CRM), l'espace
 * venant du jeton lui-même (espaceDuJeton) : Label Maison exactement comme
 * avant (baseErp(c), compte d'équipe sur la base d'avant les espaces) ; un
 * autre espace seulement si la base est passée aux espaces, le compte
 * serveur prêt et l'espace actif. null : espace fermé, inconnu, ou base pas
 * prête (jamais Label Maison à sa place).
 */
export async function espaceOuvertAuJeton(c: ConfigRepullErp, espace: string): Promise<EspaceDuJeton | null> {
  if (estLabelMaison(espace)) return { id: ID_LABEL_MAISON, nom: ESPACE_LABEL_MAISON.nom, base: baseErp(c) };
  const e = await etatBase(c);
  if (e.mode !== 'espaces' || !e.serveur) return null;
  const id = espace.toLowerCase();
  const fiche = (await espacesActifs(c)).find((x) => x.id === id && !estLabelMaison(x.id));
  return fiche ? { id: fiche.id, nom: fiche.nom, base: baseErp(c, fiche.id) } : null;
}

/**
 * Fonctions encore propres à Label Maison (clés des notifications) : refus
 * clair ailleurs. true : la réponse est partie.
 */
export function refuserHorsLabelMaison(res: any, espace: string, quoi: string): boolean {
  if (estLabelMaison(espace)) return false;
  repondre(res, 403, { ok: false, code: 'espace', erreur: `${quoi} : disponible pour l’instant dans l’espace Label Maison seulement.` });
  return true;
}

/**
 * Espace d'un événement « tagué » workspaceId reçu à l'adresse de Label Maison :
 * l'espace qui a déclaré ce workspace (Label Maison compris : REPULL_WORKSPACE_LM) ;
 * à défaut, Label Maison tant qu'aucun espace n'a déclaré de workspace (comme
 * avant les espaces) ; sinon null : workspace inconnu, l'événement est ignoré
 * (par exemple celui d'un espace dont le workspace n'est pas encore déclaré).
 */
export function espaceDuWorkspace(espaces: FicheEspace[], workspace: string): FicheEspace | null {
  const trouve = espaces.find((e) => (e.repull_workspace ?? '') === workspace);
  if (trouve) return trouve;
  if (espaces.some((e) => e.repull_workspace)) return null;
  return espaces.find((e) => estLabelMaison(e.id)) ?? FICHE_LABEL_MAISON;
}

/** Workspace Repull d'un événement de webhook (les sous-workspaces sont « tagués »). */
export function workspaceDeLEvenement(ev: unknown): string | undefined {
  const x = (ev ?? {}) as { workspaceId?: unknown; data?: { workspaceId?: unknown } };
  const v = x.workspaceId ?? x.data?.workspaceId;
  const s = typeof v === 'number' || typeof v === 'string' ? String(v).trim() : '';
  return s || undefined;
}

/** Code d'espace de l'adresse du webhook (?espace=…) ; undefined : Label Maison. */
export function codeEspaceDuWebhook(req: any): string | undefined {
  const q = req?.query?.espace;
  const v = String(Array.isArray(q) ? q[0] : (q ?? '')).trim().toLowerCase();
  return v && v !== CODE_LABEL_MAISON ? v : undefined;
}
