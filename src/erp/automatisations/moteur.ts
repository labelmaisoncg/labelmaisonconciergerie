/**
 * Moteur d'automatisations de l'ERP : « l'ERP fait le travail répétitif, les
 * humains traitent les exceptions ».
 *
 * ─────────────────────────────────────────────────────────────── INTÉGRATION
 * Dans src/erp/data/store.tsx (ErpProvider) :
 *
 * 1. État séparé, hors ErpDonnees, persisté sous la clé localStorage
 *    'lm-erp-auto-v1' (try/catch comme CLE_STOCKAGE) :
 *      { actives: Record<string, boolean>, evenements: EvenementAuto[] }
 *    `actives` absent pour une règle = r.actifParDefaut. Garder les 500
 *    derniers événements, dédoublonnés par `id` (ids déterministes : un même
 *    constat ne s'empile pas).
 *
 * 2. À l'initialisation : useState(() => automatiser(charger())) où
 *      const automatiser = (d) => executerAutomatisations(d, {
 *        date: AUJOURDHUI, maintenant: MAINTENANT (ou horodatageMaintenant()),
 *        reglesActives: clesActives });
 *    puis stocker `resultat.donnees` et fusionner `resultat.evenements`.
 *
 * 3. Après chaque mutation : dans `appliquer`, juste après
 *    `const avecJournal = ...`, faire
 *      const auto = executerAutomatisations(avecJournal, { ... });
 *      ref.current = auto.donnees; setDonnees(auto.donnees);
 *      ajouterEvenements(auto.evenements);
 *    (idem dans reinitialiserDemo). Le moteur est idempotent : sans
 *    changement métier, il renvoie des données identiques (même contenu).
 *
 * 4. Exposer dans ErpContexte : evenementsAuto, reglesActives,
 *    basculerRegle(cle, actif), lancerAutomatisations(). La page
 *    /erp/automatisations lit aujourd'hui son propre état 'lm-erp-auto-v1'
 *    (même format) : il suffira de la brancher sur ces champs.
 * ──────────────────────────────────────────────────────────────────────────
 */
import type { ErpDonnees, Journal, NomCollection } from '../data/types';
import { hachage } from './outils';
import { REGLES } from './regles';
import type { Changement, ContexteAuto, EvenementAuto, Regle } from './types';

export interface OptionsMoteur extends ContexteAuto {
  /** Clés des règles à exécuter (défaut : règles actives par défaut). */
  reglesActives?: string[];
  /** Ajouter une ligne au journal pour chaque changement effectif (défaut : oui). */
  journaliser?: boolean;
  /** Nombre maximal de passes jusqu'au point fixe (défaut : 3). */
  passesMax?: number;
}

export interface ChangementApplique {
  regle: string;
  collection: NomCollection;
  operation: 'creer' | 'modifier';
  id: string;
  resume: string;
}

export interface ResultatMoteur {
  donnees: ErpDonnees;
  evenements: EvenementAuto[];
  changements: ChangementApplique[];
  passes: number;
}

type Element = { id: string };

/** Applique un changement ; renvoie null s'il est sans effet (doublon ou contenu identique). */
function appliquer(d: ErpDonnees, ch: Changement): ErpDonnees | null {
  const liste = d[ch.collection] as Element[];
  const element = ch.element as Element;
  const index = liste.findIndex((e) => e.id === element.id);
  if (ch.operation === 'creer') {
    if (index !== -1) return null;
    return { ...d, [ch.collection]: [...liste, element] };
  }
  if (index === -1 || JSON.stringify(liste[index]) === JSON.stringify(element)) return null;
  const copie = liste.slice();
  copie[index] = element;
  return { ...d, [ch.collection]: copie };
}

/**
 * Exécute les règles actives jusqu'au point fixe (3 passes au plus).
 * Fonction pure : `donnees` n'est jamais modifié, un nouvel objet est renvoyé.
 */
export function executerAutomatisations(donnees: ErpDonnees, options: OptionsMoteur): ResultatMoteur {
  const { date, maintenant, journaliser = true, passesMax = 3 } = options;
  const ctx: ContexteAuto = { date, maintenant };
  const actives: Regle[] = REGLES.filter((r) => (options.reglesActives ? options.reglesActives.includes(r.cle) : r.actifParDefaut));
  const evenements = new Map<string, EvenementAuto>();
  const changements: ChangementApplique[] = [];
  const traces: Journal[] = [];
  let d = donnees;
  let passes = 0;

  while (passes < passesMax) {
    passes += 1;
    let effectifs = 0;
    for (const regle of actives) {
      const res = regle.executer(d, ctx);
      for (const ch of res.changements) {
        const suivant = appliquer(d, ch);
        if (!suivant) continue;
        d = suivant;
        effectifs += 1;
        const id = (ch.element as Element).id;
        changements.push({ regle: regle.cle, collection: ch.collection, operation: ch.operation, id, resume: ch.resume });
        if (journaliser) {
          traces.push({
            id: `jrn-auto-${hachage(`${maintenant}|${regle.cle}|${id}|${ch.resume}`).toString(36)}-${changements.length}`,
            horodatage: maintenant,
            auteur: 'Automatisation',
            action: regle.nom,
            entite: ch.collection,
            entiteId: id,
            details: ch.resume,
          });
        }
      }
      for (const e of res.evenements) if (!evenements.has(e.id)) evenements.set(e.id, e);
    }
    if (!effectifs) break;
  }

  if (traces.length) d = { ...d, journal: [...traces.reverse(), ...d.journal] };
  return { donnees: d, evenements: [...evenements.values()], changements, passes };
}
