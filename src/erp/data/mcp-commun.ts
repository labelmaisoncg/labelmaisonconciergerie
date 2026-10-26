/**
 * Socle partagé des outils du connecteur Claude (MCP) : contexte (dépôts de
 * données de l'utilisateur connecté), forme d'un outil, erreurs et contrôles
 * de saisie. Utilisé par crm-mcp.ts (CRM) et cm-mcp.ts (channel manager).
 */
import type { ContactCrm, FilMessages, Horodatage, Logement, Reservation } from './types';

/** CRM d'appels. */
export interface DepotCrm {
  tous(): Promise<ContactCrm[]>;
  un(id: string): Promise<ContactCrm | undefined>;
  enregistrer(c: ContactCrm): Promise<void>;
}

/**
 * Channel manager : logements, réservations, conversations. Lecture, plus le
 * seul changement permis : une conversation passée en « terminée » côté ERP.
 * Rien n'est jamais écrit vers les plateformes par ce connecteur.
 */
export interface DepotChannelManager {
  logements(): Promise<Logement[]>;
  reservations(): Promise<Reservation[]>;
  fils(): Promise<FilMessages[]>;
  fil(id: string): Promise<FilMessages | undefined>;
  enregistrerFil(f: FilMessages): Promise<void>;
}

export interface ContexteMcp {
  depot: DepotCrm;
  /** Données du channel manager de l'utilisateur connecté (un seul point d'entrée, cloisonnable par espace). */
  cm: DepotChannelManager;
  /** Date du jour à Paris (AAAA-MM-JJ). */
  aujourdhui: () => string;
  maintenant: () => Horodatage;
}

export type Args = Record<string, unknown>;

/** Erreur d'utilisation : renvoyée telle quelle à Claude pour qu'il corrige. */
export class ErreurOutil extends Error {}

export interface Outil {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
  executer: (args: Args, ctx: ContexteMcp) => Promise<Record<string, unknown>>;
}

export const LECTURE = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
export const ECRITURE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const texte = (v: unknown, nom: string, max: number): string | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') throw new ErreurOutil(`« ${nom} » doit être un texte.`);
  const s = v.trim();
  if (s.length > max) throw new ErreurOutil(`« ${nom} » : ${max} caractères au plus.`);
  return s;
};

export const choix = <T extends string>(v: unknown, nom: string, valeurs: readonly T[]): T | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || !valeurs.includes(v as T)) throw new ErreurOutil(`« ${nom} » doit valoir : ${valeurs.join(', ')}.`);
  return v as T;
};

export const date = (v: unknown, nom: string): string | undefined | '' => {
  if (v === undefined || v === null) return undefined;
  if (v === '') return '';
  if (typeof v !== 'string' || !DATE.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`))) {
    throw new ErreurOutil(`« ${nom} » doit être une date AAAA-MM-JJ (ou "" pour l’effacer).`);
  }
  return v;
};
