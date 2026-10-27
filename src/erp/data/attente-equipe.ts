/**
 * Une conversation attend-elle l'équipe ? Une seule définition pour tout
 * l'ERP : « À répondre » de la Messagerie et son compteur, « À faire » de
 * l'Accueil, le connecteur Claude (cm-mcp.ts) et les messages automatiques
 * (messages-programmes.ts : rien ne part à un voyageur qui attend l'équipe).
 */
import type { FilMessages } from './types';

/**
 * Transmise par l'agent (escalade), ou sans réponse de personne
 * (traitePar « en_attente »), et pas terminée. « Pas besoin de répondre » la
 * termine ; elle revient d'elle-même quand le voyageur réécrit
 * (synchronisation). Le dernier message peut venir de l'agent (« Je vérifie
 * avec l'équipe… ») : le voyageur attend quand même.
 */
export function attendEquipe(fil: Pick<FilMessages, 'statut' | 'traitePar'>): boolean {
  return fil.statut !== 'clos' && (fil.statut === 'escalade' || fil.traitePar === 'en_attente');
}
