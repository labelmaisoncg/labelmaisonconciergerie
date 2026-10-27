// =============================================================================
// Factures mensuelles des propriétaires : brouillons du mois terminé, créés
// à partir du 1er par le passage planifié (api/erp-agent.ts), dans chaque
// espace actif à son tour.
//
// - Une fois par mois et par espace (trace « passagesFacturesMensuelles ») :
//   les passages suivants du mois ne lisent qu'une ligne.
// - N'ajoute que les factures absentes (BaseErp.ajouterSiAbsent) : un
//   brouillon déjà préparé, ou une facture validée entre-temps par le gérant,
//   n'est jamais remplacé. Rien n'est validé, numéroté ni envoyé ici : le
//   gérant relit, valide puis partage depuis l'ERP.
// - Tout se lit et s'écrit dans la base de l'espace (baseAcces) ; l'identité
//   (régime de TVA) est celle de l'espace, jamais celle d'un autre.
// - Borné dans le temps et jamais bloquant : un espace en échec n'arrête ni
//   les autres ni l'agent.
//
// Règles pures : src/erp/data/factures-mensuelles.ts. Un fichier préfixé par
// « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import { passageFacturesMensuelles } from '../src/erp/data/factures-mensuelles.js';
import { dateParisISO } from '../src/erp/data/proprietaire.js';
import { baseAcces } from './_acces-externe.js';
import { espacesActifs, type FicheEspace } from './_erp-espaces.js';

/** Brouillons du mois terminé dans chaque espace actif. Résultat par code d'espace (nombre créé, « déjà fait » ou l'erreur). */
export async function facturesMensuellesDuJour(o: { limite?: number; maintenant?: Date } = {}): Promise<Record<string, string | number>> {
  const bilans: Record<string, string | number> = {};
  const maintenant = o.maintenant ?? new Date();
  const limite = o.limite ?? Date.now() + 6_000;
  const travail = (async () => {
    let espaces: FicheEspace[] = [];
    try {
      espaces = await espacesActifs();
    } catch (e) {
      console.warn('[factures] espaces illisibles', e instanceof Error ? e.message : e);
      return;
    }
    for (const fiche of espaces) {
      if (Date.now() > limite) break;
      try {
        const r = await passageFacturesMensuelles(baseAcces(fiche.id), { id: fiche.id, nom: fiche.nom }, { aujourdhui: dateParisISO(maintenant), maintenant: maintenant.toISOString() });
        if (r.statut === 'fait') bilans[fiche.code] = r.brouillons;
      } catch (e) {
        bilans[fiche.code] = e instanceof Error ? e.message : String(e);
        console.warn('[factures] brouillons du mois', fiche.code, bilans[fiche.code]);
      }
    }
  })();
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([travail, new Promise<void>((r) => (minuteur = setTimeout(r, Math.max(0, limite - Date.now()))))]);
  clearTimeout(minuteur);
  return bilans;
}
