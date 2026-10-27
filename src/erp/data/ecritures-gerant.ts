/**
 * Écritures réservées aux gérants de l'espace : copie de la fonction SQL
 * erp.ecriture_gerant_seulement(collection, id) (supabase/erp-espaces.sql,
 * erp-acces-gerants.sql, erp-installation.sql), avec les mêmes listes.
 *
 * La base refuse ces écritures à tout autre compte (règles RLS, et
 * déclencheur des réglages de l'agent réservés au gérant :
 * REGLAGES_AGENT_GERANT). Le store ne les met donc
 * pas en file pour un compte qui n'est pas gérant : elles sont signalées
 * comme un refus de la base et la version enregistrée revient
 * (synchro.ts, ecritureInterdite). verifier-synchro.ts lit les fichiers SQL
 * et vérifie que ces listes restent identiques.
 */
import { REGLAGES_AGENT_GERANT } from './messagerie-ia';
import { CODES_REFUS_BASE, type Operation, type RefusBase } from './synchro';
import type { ErpDonnees, Journal } from './types';

/** Collections entières : ce que seul le serveur écrit, les factures et les annonces à l'équipe. */
export const COLLECTIONS_GERANT_SEULEMENT: readonly string[] = ['envoisProgrammes', 'programmes', 'agent', 'repull', 'factures', 'passagesFacturesMensuelles', 'annoncesEquipe'];

/** Éléments précis d'une collection partagée avec l'équipe. */
export const ELEMENTS_GERANT_SEULEMENT: Readonly<Record<string, readonly string[]>> = {
  conseilsPrix: ['reglages', 'etat'],
  // alerte-controle-agent : écrite par le serveur (agent de messagerie), l'équipe la lit seulement.
  reglages: ['messages-programmes', 'societe', 'numerotation-factures', 'alerte-controle-agent'],
};

/**
 * Réglages de l'agent : l'équipe change le ton, la signature, les langues et
 * Telegram ; la marche, le niveau d'autonomie, les horaires, ce qu'il confie
 * et le délai restent au gérant (REGLAGES_AGENT_GERANT) ; seul un gérant les
 * supprime.
 */
export const ID_REGLAGES_AGENT = 'agent';

/** JSON aux clés triées : deux valeurs égales en base (jsonb) donnent le même texte. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** Même réponse que erp.ecriture_gerant_seulement(collection, id). */
export function ecritureGerantSeulement(collection: string, id: string): boolean {
  return COLLECTIONS_GERANT_SEULEMENT.includes(collection) || (ELEMENTS_GERANT_SEULEMENT[collection]?.includes(id) ?? false);
}

/**
 * Opération qu'un compte qui n'est pas gérant ne peut pas faire (la base la
 * refuserait) : écriture réservée, suppression des réglages de l'agent,
 * changement d'un de ses réglages réservés (REGLAGES_AGENT_GERANT, comparés
 * à `avant` comme le déclencheur erp.garder_autonomie_agent les compare à la
 * ligne enregistrée ; sans ligne : aucune de ces clés).
 */
export function operationReserveeAuGerant(op: Operation, avant: ErpDonnees): boolean {
  if (ecritureGerantSeulement(op.collection, op.id)) return true;
  if (op.collection !== 'reglages' || op.id !== ID_REGLAGES_AGENT) return false;
  if (op.type === 'supprimer') return true;
  const ancien = ((avant.reglages ?? []) as unknown as ({ id: string } & Record<string, unknown>)[]).find((r) => r?.id === ID_REGLAGES_AGENT);
  const nouveau = op.donnees as Record<string, unknown>;
  return REGLAGES_AGENT_GERANT.some((k) => stable(ancien?.[k]) !== stable(nouveau[k]));
}

/* ------------------------------------------------- refus de la base (store) */

export const MESSAGE_REFUS_GERANT = 'Modification non enregistrée : elle est réservée au gérant. L’écran affiche de nouveau la version enregistrée.';
export const MESSAGE_REFUS_FACTURE = 'Cette facture a été validée entre-temps : elle ne change plus. Sa version enregistrée vient d’être rechargée.';
export const MESSAGE_REFUS_DONNEES = 'Modification non enregistrée : la base l’a refusée (données invalides). L’écran affiche de nouveau la version enregistrée.';

/**
 * Refus pour les données elles-mêmes (synchro.ts, erreurDeLigne) : code
 * Postgres des classes 22 ou 23 (caractère interdit, doublon…), ou sans code
 * (contenu trop gros, 413). Ni les droits, ni une facture validée.
 */
export function refusDeDonnees(r: Pick<RefusBase, 'code' | 'message'>): boolean {
  return r.code ? /^2[23][0-9A-Z]{3}$/.test(r.code) : !/row-level security/i.test(r.message ?? '');
}

/** Message affiché une fois par envoi refusé (synchro.ts, surRefus). */
export function messageRefus(refus: readonly RefusBase[]): string {
  if (refus.length > 0 && refus.every(refusDeDonnees)) return MESSAGE_REFUS_DONNEES;
  // Tout refus portant sur des factures (code LMF, ou 42501 des anciennes installations) : le message de la facture.
  const facturesFigees =
    refus.length > 0 && refus.every((r) => (CODES_REFUS_BASE as readonly string[]).includes(r.code ?? '') || (r.collection === 'factures' && !refusDeDonnees(r)));
  return facturesFigees ? MESSAGE_REFUS_FACTURE : MESSAGE_REFUS_GERANT;
}

/** Ligne de journal d'un envoi refusé : collections et identifiants seulement, jamais le contenu. */
export function traceRefus(refus: readonly RefusBase[], o: { auteur: string; id: string; horodatage: string }): Journal {
  const premier = refus[0];
  return {
    id: o.id,
    horodatage: o.horodatage,
    auteur: o.auteur,
    action: 'Modification non enregistrée',
    entite: premier?.collection ?? 'enregistrement',
    entiteId: premier?.id ?? '',
    // Lisible dans l'Historique : pas d'identifiants techniques (ils restent dans entite / entiteId).
    details: `${refus.length > 1 ? `${refus.length} modifications refusées` : '1 modification refusée'} (${
      refus.length > 0 && refus.every(refusDeDonnees) ? 'données refusées par la base' : 'réservée au gérant ou facture déjà validée'
    }). La version enregistrée a été rechargée.`,
  };
}
