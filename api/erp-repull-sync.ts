// =============================================================================
// GET|POST /api/erp-repull-sync — synchronisation Repull → ERP.
//
// Recopie dans la base de l'ERP tout ce que les propriétaires ont connecté dans
// Repull (Airbnb, Booking.com...) : annonces → logements, réservations, avis,
// conversations et messages. Détail et règles : src/erp/data/repull-synchro.ts.
//
// Qui peut l'appeler :
//   - le cron Vercel (quotidien, vercel.json) : Authorization: Bearer CRON_SECRET ;
//     chaque espace actif passe à son tour (Label Maison d'abord) ;
//   - un membre connecté de l'ERP (bouton « Synchroniser maintenant ») :
//     Authorization: Bearer <jeton de session Supabase>, vérifié auprès de
//     Supabase puis dans erp.membres (gérant ou opérations) de l'espace de
//     l'en-tête x-erp-espace (Label Maison à défaut).
//
// Économie d'appels (offre gratuite Repull : 1 000 appels par mois pour tout
// le compte) : part mensuelle de l'ERP (REPULL_BUDGET_ERP, 400 par défaut),
// et pas plus d'une synchronisation manuelle toutes les 10 minutes (le bilan
// précédent est renvoyé à la place).
//
// Quand le passage apporte des messages, l'agent IA de la messagerie passe
// juste après (api/_erp-agent.ts), si ANTHROPIC_API_KEY est présente.
// Au passage quotidien, avant Repull : relances de paiement. (Les notifications
// du matin de l'app « Opérations » partent avec le passage de l'agent, à une
// heure décente : api/erp-agent.ts.)
// =============================================================================

import { lancer, texteErreur, verifierMembre, type DeclencheurRepull, type ResultatLancement } from '../src/erp/data/repull-synchro.js';
import { dateParis } from '../src/erp/data/repull.js';
import { rappelDuMatin, synchroEnEchec } from '../src/erp/data/notifications.js';
import { estLabelMaison } from '../src/erp/data/espaces.js';
import { baseErp, configuration, egalConstant, repondre, variableManquante, type ConfigRepullErp } from './_erp-repull.js';
import { agentApresSynchro } from './_erp-agent.js';
import { configurationEspace, espaceDemande, espacesActifs } from './_erp-espaces.js';
import { surveiller } from './_erp-notifications.js';
import { relancesDuJour } from './_relances.js';

/** Durée maximale de la fonction (vercel.json) moins une marge pour écrire et répondre. */
const BUDGET_TEMPS_MS = 50_000;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  }
  const debut = Date.now();
  const c = configuration();

  const entete = String(req.headers?.authorization || '');
  const jeton = /^Bearer\s+/i.test(entete) ? entete.replace(/^Bearer\s+/i, '').trim() : '';
  if (!jeton) return repondre(res, 401, { ok: false, erreur: 'Authentification requise.' });

  // Passage quotidien : chaque espace actif à son tour, le temps partagé entre ceux qui restent.
  if (c.secretCron && egalConstant(jeton, c.secretCron)) {
    // Relances de paiement des factures partagées (chaque espace) : sans Repull, sans jamais bloquer la suite.
    const relances = await relancesDuJour();
    if (Object.keys(relances).length) console.log('[erp-repull-sync] relances', JSON.stringify(relances));
    const manque = variableManquante(c);
    if (manque) return repondre(res, 503, { ok: false, erreur: manque });
    let espaces;
    try {
      espaces = await espacesActifs(c);
    } catch (e) {
      console.error('[erp-repull-sync] espaces illisibles', e);
      return repondre(res, 500, { ok: false, erreur: texteErreur(e) });
    }
    // Label Maison seul (avant les espaces) : même passage et même réponse qu'avant.
    if (espaces.length === 1 && estLabelMaison(espaces[0].id)) {
      try {
        const { r } = await passage(c, 'cron', debut + BUDGET_TEMPS_MS, debut);
        return repondre(res, 200, r);
      } catch (e) {
        console.error('[erp-repull-sync] échec', e);
        return repondre(res, 500, { ok: false, erreur: texteErreur(e) });
      }
    }
    const bilans: Record<string, string> = {};
    let echec = false;
    for (const [i, fiche] of espaces.entries()) {
      const reste = debut + BUDGET_TEMPS_MS - Date.now();
      if (reste < 8_000) break;
      const echeance = Date.now() + Math.floor(reste / (espaces.length - i));
      try {
        const ce = estLabelMaison(fiche.id) ? c : await configurationEspace(fiche.id, fiche);
        if (variableManquante(ce)) continue;
        const { r } = await passage(ce, 'cron', echeance, debut);
        bilans[fiche.code] = r.statut;
      } catch (e) {
        console.error('[erp-repull-sync] espace', fiche.code, texteErreur(e));
        bilans[fiche.code] = texteErreur(e);
        echec = true;
      }
    }
    return repondre(res, 200, { ok: !echec, espaces: bilans });
  }

  const membre = await verifierMembre(jeton, { espace: espaceDemande(req) });
  if (!membre.ok) return repondre(res, membre.statut, { ok: false, erreur: membre.erreur });
  try {
    const ce = await configurationEspace(membre.espace);
    const manque = variableManquante(ce);
    if (manque) return repondre(res, 503, { ok: false, erreur: manque });
    const { r, agent } = await passage(ce, 'manuel', debut + BUDGET_TEMPS_MS, debut);
    return repondre(res, 200, agent ? { ...r, agent } : r);
  } catch (e) {
    console.error('[erp-repull-sync] échec', e);
    return repondre(res, 500, { ok: false, erreur: texteErreur(e) });
  }
}

/** Un passage dans l'espace de `c`, avec les notifications de ce qu'il apporte. */
async function passage(c: ConfigRepullErp, declencheur: DeclencheurRepull, echeance: number, debut: number) {
  const base = baseErp(c);
  const aujourdhui = dateParis(new Date());
  // Notifications de ce que le passage apporte (réservations, messages, réponses de l'agent),
  // rappel du matin au passage quotidien, échec signalé une fois par jour.
  return surveiller(
    base,
    async () => {
      const r: ResultatLancement = await lancer({
        cle: c.cle,
        workspace: c.workspace,
        origineCle: c.origineCle,
        base,
        declencheur,
        echeance,
        budgetMois: c.budgetMois,
        quotaMois: c.quotaMois,
        lireQuota: declencheur === 'manuel',
      });
      if (declencheur === 'cron') console.log('[erp-repull-sync]', c.espace, r.statut, JSON.stringify(r.bilan ?? {}).slice(0, 2000));
      // De nouveaux messages sont arrivés : l'agent IA passe tout de suite (dans le temps qui reste).
      const agent = r.statut === 'fait' ? await agentApresSynchro(c, r.bilan?.messages ?? 0, Math.min(echeance + 5_000, debut + 55_000)) : null;
      return { r, agent };
    },
    {
      limite: Math.min(echeance + 8_000, debut + 58_000),
      apres: ({ r }, photo) => {
        const plus = [];
        if (r.bilan?.erreurs?.length) plus.push(synchroEnEchec(aujourdhui, r.bilan.erreurs[0]));
        const rappel = declencheur === 'cron' && photo ? rappelDuMatin(photo.reservations, photo.logements, aujourdhui) : null;
        if (rappel) plus.push(rappel);
        return plus;
      },
      enEchec: (e) => [synchroEnEchec(aujourdhui, texteErreur(e))],
    },
  );
}
