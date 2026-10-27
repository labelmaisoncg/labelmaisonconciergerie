// =============================================================================
// Prix conseillés et anomalies : passage du matin, côté serveur.
//
// Lancé par le réveil planifié de l'agent (api/erp-agent.ts, toutes les
// 30 minutes), dans chaque espace actif à son tour, borné à quelques
// secondes et jamais bloquant :
//   - rien avant 8 h à Paris ;
//   - prix : un calcul par jour et au plus une notification groupée
//     (« 3 logements : prix à revoir ») ;
//   - anomalies graves (double réservation, départ sans personne en charge,
//     réservation inhabituelle) : cherchées au plus une fois par heure,
//     chacune notifiée une seule fois ;
//   - rien de dû : une seule lecture (l'état) par espace ;
//   - l'état (« déjà notifié ») est écrit sous condition avant l'envoi :
//     deux passages simultanés n'envoient qu'une notification.
// Règles : src/erp/data/prix-passage.ts (pur, vérifié par
// verifier-prix-conseils.ts).
//
// LECTURE SEULE vis-à-vis des plateformes : on lit la base de l'ERP et on
// n'écrit que l'état du passage (collection « conseilsPrix », id « etat »). Aucun appel à
// notre service de connexion, aucun prix envoyé à Airbnb ou Booking.
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import { envoyerNotifications } from '../src/erp/data/notifications-envoi.js';
import { HEURE_MATIN_PRIX, heureParisDe, passerDansEspace } from '../src/erp/data/prix-passage.js';
import { baseAcces } from './_acces-externe.js';
import { espacesActifs } from './_erp-espaces.js';
import { clesServeur } from './_erp-notifications.js';

/** Un passage dans chaque espace actif ; renvoie un bilan court par espace (journal du serveur). */
export async function passagePrixDuJour(o: { limite?: number; maintenant?: Date } = {}): Promise<Record<string, string>> {
  const bilans: Record<string, string> = {};
  const maintenant = o.maintenant ?? new Date();
  // Avant 8 h à Paris (le réveil passe aussi la nuit) : rien n'est lu.
  if (heureParisDe(maintenant) < HEURE_MATIN_PRIX) return bilans;
  const limite = o.limite ?? Date.now() + 8_000;
  const cles = clesServeur();
  const travail = (async () => {
    let espaces: Awaited<ReturnType<typeof espacesActifs>> = [];
    try {
      espaces = await espacesActifs();
    } catch (e) {
      console.warn('[prix] espaces illisibles', e instanceof Error ? e.message : e);
      return;
    }
    for (const fiche of espaces) {
      if (Date.now() > limite) break;
      try {
        const base = baseAcces(fiche.id);
        // Lit d'abord l'état seul ; le reste seulement si quelque chose est dû (prix du jour,
        // anomalies au plus une fois par heure). L'état est écrit sous condition AVANT l'envoi :
        // deux passages simultanés n'envoient qu'une notification.
        const r = await passerDansEspace(base, {
          maintenant,
          notifier: !!cles,
          envoyer: (groupes) => (cles ? envoyerNotifications(base, groupes, { cles, maintenant }) : Promise.resolve()),
        });
        if (r.statut === 'deja-pris') bilans[fiche.code] = 'déjà fait par un autre passage';
        else if (r.statut === 'fait' && r.plan)
          bilans[fiche.code] = `${r.plan.conseils.length} conseil(s), ${r.plan.anomalies.length} anomalie(s) notifiée(s), ${r.plan.notifications.length} notification(s)`;
      } catch (e) {
        bilans[fiche.code] = e instanceof Error ? e.message : String(e);
        console.warn('[prix] passage du matin', fiche.code, bilans[fiche.code]);
      }
    }
  })();
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([travail, new Promise<void>((r) => (minuteur = setTimeout(r, Math.max(0, limite - Date.now()))))]);
  clearTimeout(minuteur);
  return bilans;
}
