/**
 * Comptabilité des tokens.
 *
 * Deux niveaux de protection, à ne pas confondre :
 *
 * 1. Le plafond DUR est dans la Console Anthropic (Settings → Limits), sur un
 *    workspace dédié à cet agent. Aucun bug de ce dépôt ne peut le contourner.
 *    C'est la vraie protection.
 * 2. Ce fichier est le plafond SOUPLE : il mesure, journalise et refuse de
 *    continuer au-delà d'un budget quotidien. Il sert surtout à voir ce que
 *    l'agent coûte réellement, et à attraper une boucle avant la Console.
 *
 * Le compteur vit en mémoire du processus : en serverless il se remet à zéro à
 * chaque démarrage à froid. Suffisant pour attraper un emballement dans une même
 * conversation, insuffisant comme comptabilité — Supabase prendra le relais à
 * l'étape 3.
 */

import type Anthropic from '@anthropic-ai/sdk';

/** Tarifs en dollars par million de tokens. */
const TARIFS: Record<string, { entree: number; sortie: number }> = {
  'claude-opus-5': { entree: 5, sortie: 25 },
  'claude-haiku-4-5': { entree: 1, sortie: 5 },
};

const USD_VERS_EUR = 0.92;

/** Budget quotidien en euros. Au-delà, l'agent refuse de répondre. */
const BUDGET_JOUR_EUR = Number(process.env.BUDGET_JOUR_EUR ?? '2');

let jourCourant = '';
let depenseJourEur = 0;

const aujourdhui = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

/**
 * Coût d'un appel en euros.
 * L'écriture en cache est facturée ~1,25× l'entrée, la lecture ~0,1×.
 */
export function coutEur(modele: string, usage: Anthropic.Usage): number {
  const tarif = TARIFS[modele];
  if (!tarif) return 0;

  const entree =
    usage.input_tokens +
    (usage.cache_creation_input_tokens ?? 0) * 1.25 +
    (usage.cache_read_input_tokens ?? 0) * 0.1;

  const usd = (entree * tarif.entree + usage.output_tokens * tarif.sortie) / 1_000_000;
  return usd * USD_VERS_EUR;
}

/** Enregistre un appel et renvoie son coût. */
export function comptabiliser(modele: string, usage: Anthropic.Usage): number {
  const jour = aujourdhui();
  if (jour !== jourCourant) {
    jourCourant = jour;
    depenseJourEur = 0;
  }

  const cout = coutEur(modele, usage);
  depenseJourEur += cout;

  const cache = usage.cache_read_input_tokens ?? 0;
  console.log(
    `[cout] ${modele} — ${usage.input_tokens} entrée` +
      (cache ? ` (+${cache} en cache)` : '') +
      ` / ${usage.output_tokens} sortie — ${cout.toFixed(4)} €` +
      ` — cumul du jour ${depenseJourEur.toFixed(2)} € / ${BUDGET_JOUR_EUR} €`,
  );

  return cout;
}

export const budgetDepasse = (): boolean => {
  if (aujourdhui() !== jourCourant) return false;
  return depenseJourEur >= BUDGET_JOUR_EUR;
};

export const depenseDuJour = (): number => depenseJourEur;
