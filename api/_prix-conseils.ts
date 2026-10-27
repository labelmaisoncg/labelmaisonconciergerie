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
//     réservation inhabituelle) : chacune notifiée une seule fois.
// Règles : src/erp/data/prix-passage.ts (pur, vérifié par
// verifier-prix-conseils.ts).
//
// LECTURE SEULE vis-à-vis des plateformes : on lit la base de l'ERP et on
// n'écrit que l'état du passage (collection « conseilsPrix »). Aucun appel à
// notre service de connexion, aucun prix envoyé à Airbnb ou Booking.
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import { envoyerNotifications } from '../src/erp/data/notifications-envoi.js';
import { COLLECTION_PRIX, type ElementPrix } from '../src/erp/data/prix-conseils.js';
import { HEURE_MATIN_PRIX, heureParisDe, planifierPassage } from '../src/erp/data/prix-passage.js';
import type { Logement, Reservation } from '../src/erp/data/types';
import type { AbsenceMembre, AffectationLogement, MembreEquipe } from '../src/erp/data/types-operations';
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
        const [elements, logements, reservations, equipe, affectations, absences] = await Promise.all([
          base.lire<ElementPrix>(COLLECTION_PRIX),
          base.lire<Logement>('logements'),
          base.lire<Reservation>('reservations'),
          base.lire<MembreEquipe>('equipe'),
          base.lire<AffectationLogement>('affectations'),
          base.lire<AbsenceMembre>('absences'),
        ]);
        const plan = planifierPassage({ elements, logements, reservations, equipe, affectations, absences, maintenant, notifier: !!cles });
        if (plan.raison) {
          bilans[fiche.code] = plan.raison;
          continue;
        }
        // Envoi d'abord : si l'état ne s'écrit pas, le passage suivant recommence, et le journal
        // des notifications (clé « prix-<jour> ») empêche tout doublon.
        if (plan.notifications.length && cles) await envoyerNotifications(base, plan.notifications, { cles, maintenant });
        if (plan.ecritures.length) await base.ecrire(COLLECTION_PRIX, plan.ecritures, 'Prix conseillés');
        if (plan.ecritures.length || plan.notifications.length)
          bilans[fiche.code] = `${plan.conseils.length} conseil(s), ${plan.anomalies.length} anomalie(s) notifiée(s), ${plan.notifications.length} notification(s)`;
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
