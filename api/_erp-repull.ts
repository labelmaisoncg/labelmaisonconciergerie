// =============================================================================
// ERP × Repull — briques communes aux fonctions /api/erp-repull-*.
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
//
// Variables d'environnement (projet Vercel du site) :
//   REPULL_API_KEY             clé API Repull (sk_live_...) — obligatoire
//   REPULL_WORKSPACE_LM        facultatif : workspace Repull de Label Maison.
//                              Présent : chaque appel de Label Maison l'envoie
//                              (X-Workspace-Id ; lecture et réponses aux
//                              voyageurs seulement, rien de plus n'est permis)
//                              et le webhook reconnaît ses événements. À mettre
//                              AVANT de déclarer le workspace d'un autre espace
//                              (docs/erp/espaces-mise-en-service.md)
//   ERP_PASSWORD            mot de passe de l'ERP = mot de passe du compte
//                              Supabase d'équipe, qui écrit dans la base
//   ERP_SERVEUR_MOT_DE_PASSE   mot de passe du compte technique
//                              serveur@labelmaisoncg.fr (supabase/erp-espaces.sql) :
//                              il écrit dans l'espace qu'on lui nomme. Absent :
//                              le compte d'équipe, pour Label Maison seulement
//   CRON_SECRET                secret envoyé par le cron Vercel (Bearer)
//   REPULL_WEBHOOK_SECRET_ERP  secret de signature de l'abonnement webhook de
//                              l'ERP (whsec_..., distinct de celui de l'agent IA)
//   REPULL_BUDGET_ERP          part mensuelle d'appels Repull de l'ERP (400)
//   REPULL_QUOTA_MOIS          quota mensuel du compte Repull (1000, affichage)
// =============================================================================

import crypto from 'node:crypto';
import { BaseErp, BUDGET_ERP_DEFAUT, QUOTA_MOIS_DEFAUT, fabriqueJetonEquipe, lireIdentite } from '../src/erp/data/repull-synchro.js';
import { signerFichierStockage, type SignerFichier } from '../src/erp/data/guides.js';
import { deposerFichierStockage } from '../src/erp/data/operations-fichiers.js';
import { BUCKET_FICHIERS_ERP, EMAIL_SERVEUR, ENTETE_ESPACE, ID_LABEL_MAISON, MESSAGE_BASE_PAS_PREPAREE, estLabelMaison, fichierDeLEspace } from '../src/erp/data/espaces.js';

/**
 * Réglages d'un espace côté serveur. configuration() : Label Maison, depuis
 * les variables de Vercel ; un autre espace : api/_erp-espaces.ts
 * (configurationEspace), qui ne reprend JAMAIS les clés de Label Maison
 * (Repull sans workspace, webhook, Telegram).
 */
export interface ConfigRepullErp {
  /** Espace des données (Label Maison par défaut). */
  espace: string;
  /** Nom de l'espace (consignes de l'agent). */
  nomEspace?: string;
  cle: string;
  /** Workspace Repull de l'espace (X-Workspace-Id) ; absent : celui du compte. */
  workspace?: string;
  motDePasse: string;
  motDePasseServeur: string;
  email: string;
  secretCron: string;
  secretWebhook: string;
  budgetMois: number;
  quotaMois: number;
  /** Décisions de l'agent IA permises par mois ; absent : sans plafond (Label Maison). */
  plafondIAMois?: number;
}

/** Variable absente ou vide → valeur par défaut (Number('') vaut 0 : budget nul par erreur). */
const entier = (v: string | undefined, defaut: number): number => {
  const brut = String(v ?? '').trim();
  if (!brut) return defaut;
  const n = Number(brut);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : defaut;
};

/**
 * Workspace Repull de Label Maison (REPULL_WORKSPACE_LM) ; absent : aucun
 * en-tête, exactement comme avant.
 */
export function workspaceLabelMaison(): string | undefined {
  return (process.env.REPULL_WORKSPACE_LM || '').trim() || undefined;
}

/** Forme d'un numéro de workspace (la même que erp.espaces.repull_workspace). */
const FORME_WORKSPACE = /^[A-Za-z0-9_-]{1,64}$/;

/** Lecture des variables (trim : un copier-coller Vercel embarque souvent un retour à la ligne). */
export function configuration(): ConfigRepullErp {
  return {
    espace: ID_LABEL_MAISON,
    cle: (process.env.REPULL_API_KEY || '').trim(),
    workspace: workspaceLabelMaison(),
    motDePasse: (process.env.ERP_PASSWORD || '').trim(),
    motDePasseServeur: (process.env.ERP_SERVEUR_MOT_DE_PASSE || '').trim(),
    email: (process.env.VITE_ERP_EMAIL_EQUIPE || '').trim() || 'equipe@labelmaisoncg.fr',
    secretCron: (process.env.CRON_SECRET || '').trim(),
    secretWebhook: (process.env.REPULL_WEBHOOK_SECRET_ERP || '').trim(),
    budgetMois: entier(process.env.REPULL_BUDGET_ERP, BUDGET_ERP_DEFAUT),
    quotaMois: entier(process.env.REPULL_QUOTA_MOIS, QUOTA_MOIS_DEFAUT),
  };
}

/** Message clair quand une variable manque (null : tout est là). */
export function variableManquante(c: ConfigRepullErp): string | null {
  if (!c.cle && !estLabelMaison(c.espace)) {
    return 'Repull n’est pas encore relié à cet espace : un gérant ajoute votre clé Repull dans Paramètres → Plateformes.';
  }
  if (!c.cle) {
    return 'REPULL_API_KEY manquante : ajoutez la clé API Repull dans Vercel (Settings → Environment Variables, Production et Preview), puis redéployez.';
  }
  if (!c.motDePasse) {
    return 'ERP_PASSWORD manquant dans Vercel : la synchronisation écrit dans la base avec le compte d’équipe, dont c’est le mot de passe.';
  }
  if (c.workspace && !FORME_WORKSPACE.test(c.workspace)) {
    return estLabelMaison(c.espace)
      ? 'REPULL_WORKSPACE_LM illisible dans Vercel : collez seulement le numéro du workspace donné par Repull (lettres, chiffres, « - » ou « _ »), puis redéployez.'
      : 'Numéro de workspace Repull de cet espace illisible : voir docs/erp/espaces-mise-en-service.md.';
  }
  return null;
}

/* ------------------------------------------------- comptes et état de la base */

type Session = ReturnType<typeof fabriqueJetonEquipe>;

// Sessions gardées tant que l'instance vit (une par compte et mot de passe).
const sessions = new Map<string, Session>();
function session(email: string, motDePasse: string, variable: string): Session {
  const cle = `${email}\u0000${motDePasse}`;
  let s = sessions.get(cle);
  if (!s) {
    s = fabriqueJetonEquipe(email, motDePasse, { variable });
    sessions.set(cle, s);
  }
  return s;
}
const sessionEquipe = (c: ConfigRepullErp) => session(c.email, c.motDePasse, 'ERP_PASSWORD');
const sessionServeur = (c: ConfigRepullErp) => session(EMAIL_SERVEUR, c.motDePasseServeur, 'ERP_SERVEUR_MOT_DE_PASSE');

/**
 * historique : supabase/erp-espaces.sql pas encore passé (Label Maison seul,
 * comme avant). serveur : le compte serveur est prêt (sinon, compte d'équipe
 * et Label Maison seulement).
 */
export interface EtatBase {
  mode: 'espaces' | 'historique';
  serveur: boolean;
}

export const MESSAGE_COMPTE_SERVEUR =
  'Compte serveur pas prêt : créez serveur@labelmaisoncg.fr, ajoutez ERP_SERVEUR_MOT_DE_PASSE dans Vercel et relancez supabase/erp-espaces.sql (docs/erp/espaces-mise-en-service.md).';

/** Une base pas encore préparée est relue toutes les 5 minutes (le SQL a pu passer entre-temps). */
const RELECTURE_HISTORIQUE_MS = 5 * 60_000;
let etat: { cle: string; valeur: Promise<EtatBase>; jusqua: number } | null = null;

async function sonderBase(c: ConfigRepullErp): Promise<EtatBase> {
  if (c.motDePasseServeur) {
    try {
      const identite = await lireIdentite(await sessionServeur(c)());
      if (!identite) return { mode: 'historique', serveur: false };
      if (identite.serveur) return { mode: 'espaces', serveur: true };
      console.warn('[erp] serveur@labelmaisoncg.fr sans son rôle : relancez supabase/erp-espaces.sql. Compte d’équipe utilisé (Label Maison seulement).');
    } catch (e) {
      console.warn('[erp] compte serveur indisponible, compte d’équipe utilisé (Label Maison seulement) :', e instanceof Error ? e.message : e);
    }
  }
  if (!c.motDePasse) throw new Error('ERP_PASSWORD manquant dans Vercel : la base de l’ERP est inaccessible.');
  const identite = await lireIdentite(await sessionEquipe(c)());
  return { mode: identite ? 'espaces' : 'historique', serveur: false };
}

/** État de la base (gardé : définitif une fois le compte serveur prêt). */
export function etatBase(c: ConfigRepullErp): Promise<EtatBase> {
  const cle = `${c.motDePasse}\u0000${c.motDePasseServeur}`;
  if (etat && etat.cle === cle && etat.jusqua > Date.now()) return etat.valeur;
  const courant: { cle: string; valeur: Promise<EtatBase>; jusqua: number } = { cle, valeur: sonderBase(c), jusqua: Infinity };
  etat = courant;
  courant.valeur.then(
    (e) => {
      if (!(e.mode === 'espaces' && e.serveur)) courant.jusqua = Date.now() + RELECTURE_HISTORIQUE_MS;
    },
    () => {
      if (etat === courant) etat = null;
    },
  );
  return courant.valeur;
}

/** Tests : oublie les sessions et l'état gardés. */
export function oublierEtatBase() {
  etat = null;
  sessions.clear();
}

/**
 * Jeton qui écrit dans `espace` : le compte serveur quand il est prêt, sinon
 * le compte d'équipe — pour Label Maison seulement, jamais pour un autre espace.
 */
async function jetonPour(c: ConfigRepullErp, espace: string, renouveler = false): Promise<string> {
  const e = await etatBase(c);
  if (e.mode === 'espaces' && e.serveur) {
    try {
      return await sessionServeur(c)(renouveler);
    } catch (err) {
      if (!estLabelMaison(espace) || !c.motDePasse) throw err;
      console.warn('[erp] compte serveur refusé, compte d’équipe utilisé pour Label Maison :', err instanceof Error ? err.message : err);
    }
  }
  if (!estLabelMaison(espace)) throw new Error(e.mode === 'historique' ? MESSAGE_BASE_PAS_PREPAREE : MESSAGE_COMPTE_SERVEUR);
  return sessionEquipe(c)(renouveler);
}

/** Accès à la base de l'ERP, dans un espace (celui de la configuration par défaut). */
export function baseErp(c: ConfigRepullErp, espace: string = c.espace): BaseErp {
  return new BaseErp({
    jeton: (renouveler) => jetonPour(c, espace, renouveler),
    // Colonne espace refusée (retour en arrière du SQL) : la base sera relue au prochain appel.
    surBaseHistorique: () => {
      etat = null;
    },
    espace: async () => {
      if ((await etatBase(c)).mode === 'espaces') return espace;
      if (estLabelMaison(espace)) return null;
      throw new Error(MESSAGE_BASE_PAS_PREPAREE);
    },
  });
}

/* ------------------------------------------------------ fichiers (stockage) */

/** Un compte peut-il servir aux fichiers de cet espace (variables présentes) ? */
const stockagePossible = (c: ConfigRepullErp): boolean => (estLabelMaison(c.espace) ? !!c.motDePasse || !!c.motDePasseServeur : !!c.motDePasseServeur);

/**
 * Compte qui signe et dépose les fichiers d'un espace :
 *   - Label Maison : le compte d'équipe, comme avant (avec l'en-tête de Label
 *     Maison une fois la base passée aux espaces, comme pour la base) ; sans
 *     ERP_PASSWORD, le compte serveur prêt ;
 *   - un autre espace : le compte serveur prêt, avec l'en-tête de l'espace
 *     (les règles du stockage, supabase/erp-espaces.sql, ne lui ouvrent que
 *     le dossier de cet espace) ; jamais le compte d'équipe. Base d'avant les
 *     espaces ou compte serveur pas prêt : erreur au message clair.
 */
async function accesStockage(c: ConfigRepullErp, espace: string): Promise<{ jeton: () => Promise<string>; entetes: Record<string, string> }> {
  const labelMaison = estLabelMaison(espace);
  const id = labelMaison ? ID_LABEL_MAISON : espace.toLowerCase();
  const e = await etatBase(c);
  const entetes: Record<string, string> = e.mode === 'espaces' ? { [ENTETE_ESPACE]: id } : {};
  if (labelMaison && c.motDePasse) {
    const equipe = sessionEquipe(c);
    return { jeton: () => equipe(), entetes };
  }
  const jeton = await jetonPour(c, id);
  return { jeton: async () => jeton, entetes };
}

/**
 * Pourquoi les fichiers de l'espace ne peuvent être ni signés ni déposés
 * (message clair pour le gérant), null s'ils le peuvent.
 */
export async function stockageFerme(c: ConfigRepullErp, espace: string = c.espace): Promise<string | null> {
  const labelMaison = estLabelMaison(espace);
  if (labelMaison && c.motDePasse) return null;
  const sansCompte = labelMaison ? 'ERP_PASSWORD manquant dans Vercel : les fichiers de l’équipe ne peuvent pas être ouverts.' : MESSAGE_COMPTE_SERVEUR;
  if (!c.motDePasseServeur) return sansCompte;
  try {
    const e = await etatBase(c);
    if (e.mode !== 'espaces') return labelMaison ? sansCompte : MESSAGE_BASE_PAS_PREPAREE;
    return e.serveur ? null : sansCompte;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Liens signés des fichiers de l'espace de `c` : guides envoyés aux
 * voyageurs, documents et photos des espaces propriétaire et opérations.
 * Seulement les fichiers de CET espace (fichierDeLEspace) : jamais un chemin
 * d'un autre espace, même connu (null, sans rien demander au stockage).
 * undefined : aucun compte possible pour cet espace (variables absentes).
 */
export function signeurFichiersErp(c: ConfigRepullErp): SignerFichier | undefined {
  if (!stockagePossible(c)) return undefined;
  const espace = c.espace;
  return async (fichier, secondes) => {
    if (!fichierDeLEspace(fichier, espace)) return null;
    return signerFichierStockage(await accesStockage(c, espace), fichier, secondes);
  };
}

/**
 * Dépôt d'un fichier dans l'espace de `c` (photos de l'espace opérations),
 * dans le dossier de cet espace seulement (prefixeFichiers) : rend
 * « stockage://… », ou null (chemin d'un autre espace, dépôt refusé).
 */
export function deposeurFichiersErp(c: ConfigRepullErp): ((chemin: string, octets: Uint8Array, type: string) => Promise<string | null>) | undefined {
  if (!stockagePossible(c)) return undefined;
  const espace = c.espace;
  return async (chemin, octets, type) => {
    if (!fichierDeLEspace(`stockage://${BUCKET_FICHIERS_ERP}/${chemin}`, espace)) return null;
    const acces = await accesStockage(c, espace).catch(() => null);
    return acces ? deposerFichierStockage(acces, chemin, octets, type) : null;
  };
}

/** Comparaison à temps constant (secrets). */
export function egalConstant(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Corps JSON d'une requête (objet vide si absent ou illisible). */
export function lireCorps(req: any): Record<string, unknown> {
  const b = req.body;
  if (b && typeof b === 'object' && !Array.isArray(b)) return b as Record<string, unknown>;
  if (typeof b === 'string') {
    try {
      const x = JSON.parse(b);
      return x && typeof x === 'object' && !Array.isArray(x) ? x : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function repondre(res: any, statut: number, corps: unknown) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(statut).json(corps);
}

/**
 * Travail à finir après la réponse (mécanisme de @vercel/functions `waitUntil`,
 * sans la dépendance) : faux si la plateforme ne l'offre pas.
 */
export function continuerApresReponse(travail: Promise<unknown>): boolean {
  const contexte = (globalThis as any)[Symbol.for('@vercel/request-context')]?.get?.();
  if (typeof contexte?.waitUntil !== 'function') return false;
  contexte.waitUntil(travail);
  return true;
}
