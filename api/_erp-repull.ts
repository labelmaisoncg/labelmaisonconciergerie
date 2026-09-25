// =============================================================================
// ERP × Repull — briques communes aux fonctions /api/erp-repull-*.
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
//
// Variables d'environnement (projet Vercel du site) :
//   REPULL_API_KEY             clé API Repull (sk_live_...) — obligatoire
//   ERP_PASSWORD               mot de passe de l'ERP = mot de passe du compte
//                              Supabase d'équipe, qui écrit dans la base
//   CRON_SECRET                secret envoyé par le cron Vercel (Bearer)
//   REPULL_WEBHOOK_SECRET_ERP  secret de signature de l'abonnement webhook de
//                              l'ERP (whsec_..., distinct de celui de l'agent IA)
//   REPULL_BUDGET_ERP          part mensuelle d'appels Repull de l'ERP (400)
//   REPULL_QUOTA_MOIS          quota mensuel du compte Repull (1000, affichage)
// =============================================================================

import crypto from 'node:crypto';
import { BaseErp, BUDGET_ERP_DEFAUT, QUOTA_MOIS_DEFAUT, fabriqueJetonEquipe } from '../src/erp/data/repull-synchro.js';

export interface ConfigRepullErp {
  cle: string;
  motDePasse: string;
  email: string;
  secretCron: string;
  secretWebhook: string;
  budgetMois: number;
  quotaMois: number;
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
    cle: (process.env.REPULL_API_KEY || '').trim(),
    motDePasse: (process.env.ERP_PASSWORD || '').trim(),
    email: (process.env.VITE_ERP_EMAIL_EQUIPE || '').trim() || 'equipe@labelmaisoncg.fr',
    secretCron: (process.env.CRON_SECRET || '').trim(),
    secretWebhook: (process.env.REPULL_WEBHOOK_SECRET_ERP || '').trim(),
    budgetMois: entier(process.env.REPULL_BUDGET_ERP, BUDGET_ERP_DEFAUT),
    quotaMois: entier(process.env.REPULL_QUOTA_MOIS, QUOTA_MOIS_DEFAUT),
  };
}

/** Message clair quand une variable manque (null : tout est là). */
export function variableManquante(c: ConfigRepullErp): string | null {
  if (!c.cle) {
    return 'REPULL_API_KEY manquante : ajoutez la clé API Repull dans Vercel (Settings → Environment Variables, Production et Preview), puis redéployez.';
  }
  if (!c.motDePasse) {
    return 'ERP_PASSWORD manquant dans Vercel : la synchronisation écrit dans la base avec le compte d’équipe, dont c’est le mot de passe.';
  }
  return null;
}

// Session du compte d'équipe gardée tant que l'instance vit (une par mot de passe).
let jetons: { cle: string; obtenir: ReturnType<typeof fabriqueJetonEquipe> } | null = null;

/** Accès à la base de l'ERP avec la session du compte d'équipe. */
export function baseErp(c: ConfigRepullErp): BaseErp {
  const cle = `${c.email}\u0000${c.motDePasse}`;
  if (!jetons || jetons.cle !== cle) jetons = { cle, obtenir: fabriqueJetonEquipe(c.email, c.motDePasse) };
  return new BaseErp({ jeton: jetons.obtenir });
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
