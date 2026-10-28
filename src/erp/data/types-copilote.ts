/**
 * Copilote (cahier A15) : chaque action de l'IA dans l'ERP, tracée dans la
 * collection `actionsAgent` (une ligne par action) : celles de Claude par le
 * connecteur (MCP), celles de l'agent de la messagerie. Règles : copilote.ts.
 *
 * Une trace ne contient ni secret, ni code d'accès, ni e-mail ou téléphone
 * de voyageur : les textes y sont masqués. Seule l'annulation d'une fiche du
 * CRM garde les anciennes valeurs exactes de ses champs (`retour`), pour la
 * remettre telle qu'elle était ; la collection est réservée aux gérants.
 */
import type { BrouillonAgent, Horodatage, Id } from './types';

/** Qui a agi : Claude (connecteur) ou l'agent de la messagerie. */
export type SourceAction = 'claude' | 'agent';

/** interne : reste dans l'ERP ; externe : touche un voyageur (message). */
export type EffetAction = 'interne' | 'externe';

/**
 * faite : appliquée dans l'ERP ; a_confirmer : réponse proposée, que
 * l'équipe relit et envoie (ou non) depuis la Messagerie ; annulee : défaite
 * depuis « Actions de l'IA » ; echec : l'écriture n'a pas abouti, rien n'a
 * changé ; sans_effet : rien n'était à faire (déjà là).
 */
export type EtatAction = 'faite' | 'a_confirmer' | 'annulee' | 'echec' | 'sans_effet';

/**
 * Collections que l'IA peut changer (jamais un prix, un calendrier, une
 * annonce, un paiement). avisADeposer et reponsesAvis : avis publiés sur la
 * plateforme (octobre 2026, exception limitée aux avis), jamais annulables.
 */
export type CollectionTracee = 'crm' | 'filsMessages' | 'missions' | 'factures' | 'avisADeposer' | 'reponsesAvis';

/** Un changement, en clair et masqué (« Étape : À appeler → Contacté »). */
export interface ChangementAction {
  champ: string;
  avant?: string;
  apres?: string;
  /** « Suivi par » : valeurs brutes (membre de l'espace), que l'écran nomme avec l'équipe de l'espace. */
  suivi?: { avant?: string; apres?: string };
}

/**
 * De quoi revenir en arrière :
 * - supprimer : l'action a créé l'élément ;
 * - champs : valeurs d'avant des champs changés (`absents` : champs ajoutés
 *   par l'action), et pour une liste complétée en tête (historique d'un
 *   contact) le nombre de lignes ajoutées et celles sorties en bout ;
 * - proposition : retirer la réponse proposée sur la conversation, et
 *   remettre le suivi d'avant (`avant`, absent pour l'agent : il ne doit pas
 *   repréparer la même réponse).
 */
export type RetourAction =
  | { genre: 'supprimer' }
  | { genre: 'champs'; avant: Record<string, unknown>; absents: string[]; tetes?: Record<string, { ajoutes: number; perdus: unknown[] }> }
  | { genre: 'proposition'; avant?: { dernierMessageTraite?: Id; decision?: string; traitePar?: string; statut?: string; brouillon?: BrouillonAgent } };

/** Accès qui a agi : jeton OAuth (gérant qui a connecté Claude), clé fixée par l'administrateur, ou l'agent. */
export interface ClientAction {
  genre: 'oauth' | 'cle' | 'agent';
  /** Identifiant du client OAuth (« claude-… »). */
  client?: string;
  /** Membre qui a autorisé Claude (adresse de son compte). */
  autorisePar?: string;
}

export interface ActionAgent {
  id: Id;
  le: Horodatage;
  /** Espace des données : une action ne s'annule que dans son espace. */
  espace: string;
  source: SourceAction;
  client?: ClientAction;
  /**
   * Outil du connecteur (crm_noter_appel…), décision de l'agent (agent_envoi,
   * agent_a_valider, agent_transmission) ou publication d'un avis
   * (avis_voyageur_publie, reponse_avis_publiee).
   */
  outil: string;
  collection: CollectionTracee;
  cibleId: Id;
  /** Nom court de la cible (« Paul N. », nom du logement). */
  cible: string;
  /** Page de l'ERP où la voir (« /erp/crm?contact=… »). */
  lien?: string;
  /** Une phrase en français simple. */
  resume: string;
  changements: ChangementAction[];
  effet: EffetAction;
  etat: EtatAction;
  annulable: boolean;
  /** Pourquoi elle ne s'annule pas (déjà envoyée, transmise…). */
  pasAnnulable?: string;
  retour?: RetourAction;
  /** Empreinte de la cible juste après l'action : une annulation sur une cible changée depuis est refusée. */
  empreinte?: string;
  /** Réponse proposée : le message du voyageur et l'heure de la proposition (son sort se lit sur la conversation). */
  proposition?: { messageId: Id; le: Horodatage };
  /** Réponse proposée envoyée par l'équipe (api/erp-repull-messages.ts, Messagerie) : qui, quand. */
  envoyee?: { par: string; le: Horodatage; modifiee?: boolean };
  annulation?: { le: Horodatage; par: string };
}
