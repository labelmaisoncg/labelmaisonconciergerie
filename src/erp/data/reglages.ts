/**
 * Réglages de l'agent de messagerie : valeurs par défaut et lecture tolérante
 * (un réglage absent ou incomplet est complété, jamais bloquant).
 *
 * Stockage : collection `reglages`, élément d'id 'agent', synchronisé comme
 * les autres collections (une ligne de erp.enregistrements : collection
 * 'reglages', id 'agent', contenu JSON dans `donnees`).
 *
 * TODO(agent-ia) : le service agent-ia/ doit lire ce réglage à chaque message
 * voyageur et l'appliquer (pause, horaires, ton, langues, signature, ce qu'il
 * transmet, délai d'alerte Telegram). Détail : docs/erp/README.md, « Réglages
 * de l'agent de messagerie ».
 */
import type { ErpDonnees, ReglagesAgent, TonAgent } from './types';

export const REGLAGES_AGENT_DEFAUT: ReglagesAgent = {
  id: 'agent',
  // En pause tant que l'équipe ne l'a pas allumé (Repull et crédits requis).
  actif: false,
  ton: 'chaleureux',
  langues: ['fr', 'en'],
  signature: 'L’équipe Label Maison',
  horaires: { mode: 'toujours', debut: '08:00', fin: '22:00' },
  transmettre: { horsFiche: true, derogations: true, sejoursLongs: true, sejoursLongsNuits: 28 },
  delaiAlerteMinutes: 30,
  telegram: true,
};

export const LANGUES_AGENT: { code: string; libelle: string }[] = [
  { code: 'fr', libelle: 'Français' },
  { code: 'en', libelle: 'Anglais' },
  { code: 'es', libelle: 'Espagnol' },
  { code: 'de', libelle: 'Allemand' },
  { code: 'it', libelle: 'Italien' },
  { code: 'pt', libelle: 'Portugais' },
  { code: 'nl', libelle: 'Néerlandais' },
  { code: 'ar', libelle: 'Arabe' },
];

export const TONS_AGENT: { cle: TonAgent; libelle: string; description: string; exemple: (signature: string) => string }[] = [
  {
    cle: 'chaleureux',
    libelle: 'Chaleureux',
    description: 'Accueillant et attentionné, comme un hôte qui reçoit chez lui.',
    exemple: (s) =>
      `Bonjour Claire, quel plaisir de vous accueillir bientôt ! Vous pourrez arriver dès 16 h, la boîte à clés est juste à droite de la porte. N’hésitez pas si vous avez la moindre question. Belle journée, ${s}`,
  },
  {
    cle: 'professionnel',
    libelle: 'Professionnel',
    description: 'Clair, précis et courtois, sans familiarité.',
    exemple: (s) =>
      `Bonjour Madame Martin, votre arrivée est possible à partir de 16 h. La boîte à clés se trouve à droite de la porte d’entrée. Nous restons à votre disposition. Cordialement, ${s}`,
  },
  {
    cle: 'decontracte',
    libelle: 'Décontracté',
    description: 'Simple et détendu, avec le sourire.',
    exemple: (s) =>
      `Salut Claire ! Tu peux arriver dès 16 h, les clés t’attendent dans la boîte à droite de la porte. Un souci ? Écris-nous. À bientôt, ${s}`,
  },
];

/** Réglages de l'agent, complétés par les valeurs par défaut. */
export function reglagesAgent(d: Pick<ErpDonnees, 'reglages'>): ReglagesAgent {
  const stocke = (d.reglages ?? []).find((r) => r.id === 'agent');
  if (!stocke) return REGLAGES_AGENT_DEFAUT;
  return {
    ...REGLAGES_AGENT_DEFAUT,
    ...stocke,
    horaires: { ...REGLAGES_AGENT_DEFAUT.horaires, ...(stocke.horaires ?? {}) },
    transmettre: { ...REGLAGES_AGENT_DEFAUT.transmettre, ...(stocke.transmettre ?? {}) },
    langues: Array.isArray(stocke.langues) && stocke.langues.length ? stocke.langues : REGLAGES_AGENT_DEFAUT.langues,
  };
}
