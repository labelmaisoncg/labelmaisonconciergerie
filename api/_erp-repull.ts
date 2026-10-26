// =============================================================================
// ERP × Repull — briques communes aux fonctions /api/erp-repull-*.
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
//
// Variables d'environnement (projet Vercel du site) :
//   REPULL_API_KEY             clé API Repull (sk_live_...) — obligatoire
//   ERP_PASSWORD               mot de passe de l'ERP = mot de passe du compte
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
import { EMAIL_SERVEUR, ID_LABEL_MAISON, MESSAGE_BASE_PAS_PREPAREE, estLabelMaison } from '../src/erp/data/espaces.js';

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

/** Lecture des variables (trim : un copier-coller Vercel embarque souvent un retour à la ligne). */
export function configuration(): ConfigRepullErp {
  return {
    espace: ID_LABEL_MAISON,
    cle: (process.env.REPULL_API_KEY || '').trim(),
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
    return 'Repull n’est pas encore relié à cet espace : voir docs/erp/espaces-mise-en-service.md.';
  }
  if (!c.cle) {
    return 'REPULL_API_KEY manquante : ajoutez la clé API Repull dans Vercel (Settings → Environment Variables, Production et Preview), puis redéployez.';
  }
  if (!c.motDePasse) {
    return 'ERP_PASSWORD manquant dans Vercel : la synchronisation écrit dans la base avec le compte d’équipe, dont c’est le mot de passe.';
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
    espace: async () => {
      if ((await etatBase(c)).mode === 'espaces') return espace;
      if (estLabelMaison(espace)) return null;
      throw new Error(MESSAGE_BASE_PAS_PREPAREE);
    },
  });
}

/**
 * Liens signés des fichiers de l'espace privé (guides envoyés aux voyageurs),
 * avec la session du compte d'équipe : Label Maison seulement pour l'instant
 * (un autre espace n'envoie que les guides en lien https).
 */
export function signeurFichiersErp(c: ConfigRepullErp): SignerFichier | undefined {
  if (!estLabelMaison(c.espace) || !c.motDePasse) return undefined;
  const obtenir = sessionEquipe(c);
  return (fichier, secondes) => signerFichierStockage({ jeton: () => obtenir() }, fichier, secondes);
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
