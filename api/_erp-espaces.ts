// =============================================================================
// Espaces de l'ERP côté serveur : réglages d'un espace, liste des espaces
// actifs (passages planifiés, webhooks), espace demandé par un appel.
// Modèle et règles : src/erp/data/espaces.ts et supabase/erp-espaces.sql.
//
// Label Maison garde ses ressources de Vercel (REPULL_API_KEY, secret du
// webhook, Telegram, MCP). Un autre espace n'en reprend JAMAIS aucune :
//   - Repull : son workspace (en-tête X-Workspace-Id) sur le compte de Label
//     Maison, ou sa propre clé rangée dans le coffre de Supabase (Vault) ;
//   - webhook : son propre secret (coffre), seulement avec sa propre clé ;
//   - agent IA : la clé Claude commune, avec un plafond mensuel
//     (config.agent.plafondMois, 300 par défaut), sans Telegram.
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import { CODE_LABEL_MAISON, ENTETE_ESPACE, ESPACE_LABEL_MAISON, ID_LABEL_MAISON, MESSAGE_BASE_PAS_PREPAREE, estLabelMaison, idEspaceValide } from '../src/erp/data/espaces.js';
import { MESSAGE_COMPTE_SERVEUR, baseErp, configuration, etatBase, repondre, type ConfigRepullErp } from './_erp-repull.js';

/** Plafond mensuel des décisions de l'agent IA d'un autre espace que Label Maison. */
export const PLAFOND_IA_DEFAUT = 300;

/** Espace actif tel que le lit le serveur (erp.espaces_actifs). */
export interface FicheEspace {
  id: string;
  code: string;
  nom: string;
  repull_workspace: string | null;
  config: { agent?: { plafondMois?: unknown }; repull?: { budgetMois?: unknown } } | null;
}

const FICHE_LABEL_MAISON: FicheEspace = { ...ESPACE_LABEL_MAISON, repull_workspace: null, config: {} };

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
  if (e.mode !== 'espaces' || !e.serveur) return [FICHE_LABEL_MAISON];
  const lignes = await baseErp(c, ID_LABEL_MAISON).rpc<FicheEspace[]>('espaces_actifs');
  const liste = (Array.isArray(lignes) ? lignes : []).filter((x) => idEspaceValide(x?.id)).map((x) => ({ ...x, id: x.id.toLowerCase() }));
  return liste.some((x) => estLabelMaison(x.id)) ? liste : [FICHE_LABEL_MAISON, ...liste];
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
  const workspace = (f.repull_workspace ?? '').trim();
  const propre = typeof clePropre === 'string' ? clePropre.trim() : '';
  return {
    ...c,
    espace: id,
    nomEspace: f.nom,
    cle: propre || (workspace ? c.cle : ''),
    workspace: workspace || undefined,
    // Le secret du webhook de Label Maison ne vaut jamais pour un autre espace.
    secretWebhook: typeof secretWebhook === 'string' ? secretWebhook.trim() : '',
    budgetMois: entierPositif(f.config?.repull?.budgetMois, c.budgetMois) || c.budgetMois,
    plafondIAMois: entierPositif(f.config?.agent?.plafondMois, PLAFOND_IA_DEFAUT),
  };
}

/** Espace nommé par l'appel (en-tête x-erp-espace) ; undefined : aucun (Label Maison). */
export function espaceDemande(req: any): string | undefined {
  const brut = req?.headers?.[ENTETE_ESPACE];
  const v = String(Array.isArray(brut) ? brut[0] : (brut ?? '')).trim().toLowerCase();
  return idEspaceValide(v) ? v : undefined;
}

/**
 * Fonctions encore propres à Label Maison (connecteur Claude, agenda du CRM,
 * clés des notifications) : refus clair ailleurs. true : la réponse est partie.
 */
export function refuserHorsLabelMaison(res: any, espace: string, quoi: string): boolean {
  if (estLabelMaison(espace)) return false;
  repondre(res, 403, { ok: false, code: 'espace', erreur: `${quoi} : disponible pour l’instant dans l’espace Label Maison seulement.` });
  return true;
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
