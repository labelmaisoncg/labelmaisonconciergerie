// =============================================================================
// Briefing du matin (A12) : la notification « Briefing du matin », côté
// serveur, lancée par le passage planifié de l'agent (api/erp-agent.ts, avec
// les autres travaux du matin, quelques secondes au plus, jamais bloquante).
//
//   - de 7 h à midi à Paris, une fois par jour et par espace actif ;
//   - aux seuls appareils qui ont activé « Briefing du matin » (type
//     « rappel », éteint par défaut) ; version du gérant avec prix conseillés
//     et factures, version de l'équipe sans ;
//   - sans clés de notification : rien n'est lu.
//
// Le texte est calculé sans IA (src/erp/data/briefing.ts) ; le passage
// (état, une seule fois, factures du 1er) : src/erp/data/briefing-passage.ts.
// LECTURE SEULE vis-à-vis des plateformes : la base de l'ERP est lue, seul
// l'état du briefing y est écrit. Un fichier préfixé par « _ » n'est pas
// exposé comme route par Vercel.
// =============================================================================

import { fenetreBriefing, passerBriefingDansEspace } from '../src/erp/data/briefing-passage.js';
import { envoyerNotifications } from '../src/erp/data/notifications-envoi.js';
import { baseAcces } from './_acces-externe.js';
import { espacesActifs } from './_erp-espaces.js';
import { clesServeur } from './_erp-notifications.js';

/** Un passage dans chaque espace actif ; renvoie un bilan court par espace (journal du serveur). */
export async function briefingDuJour(o: { limite?: number; maintenant?: Date } = {}): Promise<Record<string, string>> {
  const bilans: Record<string, string> = {};
  const maintenant = o.maintenant ?? new Date();
  if (!fenetreBriefing(maintenant)) return bilans;
  const cles = clesServeur();
  if (!cles) return bilans;
  const limite = o.limite ?? Date.now() + 6_000;
  const travail = (async () => {
    let espaces: Awaited<ReturnType<typeof espacesActifs>> = [];
    try {
      espaces = await espacesActifs();
    } catch (e) {
      console.warn('[briefing] espaces illisibles', e instanceof Error ? e.message : e);
      return;
    }
    for (const fiche of espaces) {
      if (Date.now() > limite) break;
      try {
        const base = baseAcces(fiche.id);
        const r = await passerBriefingDansEspace(base, { maintenant, envoyer: (groupes) => envoyerNotifications(base, groupes, { cles, maintenant }) });
        if (r.statut !== 'deja-fait' && r.statut !== 'personne') bilans[fiche.code] = r.statut;
      } catch (e) {
        bilans[fiche.code] = e instanceof Error ? e.message : String(e);
        console.warn('[briefing] passage du matin', fiche.code, bilans[fiche.code]);
      }
    }
  })();
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([travail, new Promise<void>((r) => (minuteur = setTimeout(r, Math.max(0, limite - Date.now()))))]);
  clearTimeout(minuteur);
  return bilans;
}
