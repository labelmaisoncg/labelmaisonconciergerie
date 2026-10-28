// =============================================================================
// Avis des voyageurs (appelé par api/erp-agent.ts, une ligne) :
//
//   POST { action: 'reponse_avis', reservationId }
//     → { ok, reponse: { texte, source: 'ia' | 'modele', note?, lecture? } }
//     Réponse publique proposée pour l'avis du séjour, à relire et copier.
//     Rien n'est publié sur la plateforme par cette action.
//     Membres gérant ou opérations (verifierMembre dans erp-agent.ts : un
//     compte en lecture est refusé), 20 demandes par quart d'heure au plus par
//     membre (« Trop de demandes d’un coup », 429) ; chaque appel à l'IA compte
//     dans le plafond mensuel de l'espace. Aucun appel à Repull : seule la base
//     de l'ERP est lue (la clé Repull n'est pas exigée).
//
//   POST { action: 'avis_publier', genre: 'voyageur' | 'reponse', reservationId, texte }
//     → { ok, message }
//     « Publier » depuis « À valider » (publication automatique des avis,
//     octobre 2026, exception limitée aux avis) : l'avis sur le voyageur
//     (Airbnb, 5 étoiles) ou la réponse à l'avis du voyageur, avec le texte
//     validé par le gérant. GÉRANT SEULEMENT ; réglage allumé ; avis relu chez
//     la plateforme avant l'envoi ; jamais deux fois ; tracé dans « Actions de
//     l'IA ». Détail : src/erp/data/avis-auto-passage.ts. Chaque appel Repull
//     est compté dans la part mensuelle de l'espace.
//
// Jamais de prix, de calendrier, de disponibilité ni d'annonce. Les messages
// d'erreur restent en français simple, sans nom de variable ni d'hébergeur.
// Détail : src/erp/data/avis-serveur.ts.
// =============================================================================

import { ErreurAssistant, texteErreurAssistant } from '../src/erp/data/agent-assistant.js';
import { freinDemandes, preparerReponseAvis } from '../src/erp/data/avis-serveur.js';
import { publierAvisParGerant } from '../src/erp/data/avis-auto-passage.js';
import { configurationAgent, optionsAssistant } from './_erp-agent.js';
import { baseErp, repondre, variableManquante, type ConfigRepullErp } from './_erp-repull.js';
import { configurationEspace } from './_erp-espaces.js';

export const ACTIONS_AVIS = new Set(['reponse_avis', 'avis_publier']);

/** Demandes par membre : 20 par quart d'heure (par instance du serveur), en plus du plafond mensuel de l'IA. */
const tropDeDemandes = freinDemandes();

/** Montré à l'équipe quand le site ne peut pas encore lire la base pour cet espace. */
export const MESSAGE_AVIS_INDISPONIBLE = 'Votre agent ne peut pas encore lire les avis de cet espace : la mise en service n’est pas terminée. Écrivez votre réponse vous-même.';
export const MESSAGE_PUBLICATION_INDISPONIBLE = 'La publication n’est pas encore possible pour cet espace : la connexion aux plateformes n’est pas terminée. Rien n’a été publié.';
export const MESSAGE_GERANT_SEULEMENT = 'Seul un gérant publie un avis.';

/** Durée maximale de la fonction (vercel.json) moins une marge pour écrire et répondre. */
const BUDGET_PUBLICATION_MS = 40_000;

/**
 * Répond aux actions d'avis pour le membre `par` (son e-mail, pour le
 * journal et la trace) dans `espace`, avec son rôle (« Publier » : gérant).
 */
export async function repondreAvis(res: any, corps: Record<string, unknown>, espace: string | undefined, par: string, role?: string) {
  const action = String(corps.action ?? '');
  if (action === 'avis_publier') return publier(res, corps, espace, par, role);
  let c: ConfigRepullErp;
  try {
    c = await configurationEspace(espace);
  } catch (e) {
    console.error('[erp-agent] avis : espace', e);
    return repondre(res, 503, { ok: false, erreur: MESSAGE_AVIS_INDISPONIBLE, code: 'indisponible' });
  }
  // Seule la base est lue : le mot de passe du compte d'équipe suffit (pas de clé Repull).
  if (!c.motDePasse) return repondre(res, 503, { ok: false, erreur: MESSAGE_AVIS_INDISPONIBLE, code: 'indisponible' });
  try {
    const cle = `${c.espace ?? ''}:${par}`;
    const reponse = await preparerReponseAvis(optionsAssistant(c, par), String(corps.reservationId ?? ''), { tropDeDemandes: () => tropDeDemandes(cle) });
    return repondre(res, 200, { ok: true, reponse });
  } catch (e) {
    if (e instanceof ErreurAssistant) return repondre(res, e.statut, { ok: false, erreur: e.message, code: e.code });
    console.error('[erp-agent] avis', e);
    return repondre(res, 502, { ok: false, erreur: texteErreurAssistant(e) });
  }
}

/** « Publier » du gérant : l'avis gardé « à valider », avec son texte. */
async function publier(res: any, corps: Record<string, unknown>, espace: string | undefined, par: string, role?: string) {
  if (role !== 'gerant') return repondre(res, 403, { ok: false, erreur: MESSAGE_GERANT_SEULEMENT, code: 'gerant' });
  let c: ConfigRepullErp;
  try {
    c = await configurationEspace(espace);
  } catch (e) {
    console.error('[erp-agent] avis : espace', e);
    return repondre(res, 503, { ok: false, erreur: MESSAGE_PUBLICATION_INDISPONIBLE, code: 'indisponible' });
  }
  if (variableManquante(c)) return repondre(res, 503, { ok: false, erreur: MESSAGE_PUBLICATION_INDISPONIBLE, code: 'indisponible' });
  const a = configurationAgent();
  const assistant = optionsAssistant(c, par);
  try {
    const nom = par.split('@')[0] || 'le gérant';
    const r = await publierAvisParGerant(
      {
        cle: c.cle,
        workspace: c.workspace,
        origineCle: c.origineCle,
        base: baseErp(c),
        echeance: Date.now() + BUDGET_PUBLICATION_MS,
        budgetMois: c.budgetMois,
        quotaMois: c.quotaMois,
        ia: assistant.ia,
        modele: a.modele,
        ...(assistant.nomEspace !== undefined ? { nomEspace: assistant.nomEspace } : {}),
      },
      { genre: corps.genre, reservationId: corps.reservationId, texte: corps.texte },
      { email: par, nom: nom.charAt(0).toLocaleUpperCase('fr') + nom.slice(1) },
    );
    return r.ok ? repondre(res, 200, { ok: true, message: r.message }) : repondre(res, r.statut, { ok: false, erreur: r.message });
  } catch (e) {
    console.error('[erp-agent] publication d’un avis', e);
    return repondre(res, 502, { ok: false, erreur: 'La publication n’a pas abouti : réessayez dans un instant. Rien n’a été publié deux fois.' });
  }
}
