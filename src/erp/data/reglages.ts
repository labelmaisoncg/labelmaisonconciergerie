/**
 * Réglages de l'agent de messagerie : valeurs par défaut et lecture tolérante
 * (un réglage absent ou incomplet est complété, jamais bloquant).
 *
 * Stockage : collection `reglages`, élément d'id 'agent', synchronisé comme
 * les autres collections (une ligne de erp.enregistrements : collection
 * 'reglages', id 'agent', contenu JSON dans `donnees`).
 *
 * L'agent du site (src/erp/data/agent-messagerie.ts, lancé par
 * api/erp-agent.ts) relit ce réglage à chaque passage et l'applique : pause,
 * horaires, ton, langues, signature, ce qu'il transmet, Telegram. Détail :
 * docs/erp/README.md, « Messagerie et agent IA ».
 */
import { estLabelMaison, type Espace } from './espaces.js';
import type { ErpDonnees, ReglagesAgent, TonAgent } from './types';

/** Signature de l'agent de Label Maison (celle d'avant les espaces, inchangée). */
export const SIGNATURE_LABEL_MAISON = 'L’équipe Label Maison';

/**
 * Signature par défaut de l'agent : « L’équipe <nom de l'espace> » (Sens :
 * « L’équipe Sens »). Sans nom d'espace (Label Maison, base d'avant les
 * espaces) : celle de Label Maison. Jamais le nom de Label Maison pour un
 * autre espace, même sans nom lisible.
 */
export function signatureParDefaut(nomEspace?: string): string {
  if (nomEspace === undefined) return SIGNATURE_LABEL_MAISON;
  const nom = nomEspace.trim();
  return nom ? `L’équipe ${nom}` : 'L’équipe';
}

/** Nom à passer à signatureParDefaut pour l'espace ouvert : rien pour Label Maison. */
export const nomPourSignature = (e: Pick<Espace, 'id' | 'nom'>): string | undefined => (estLabelMaison(e) ? undefined : e.nom);

export const REGLAGES_AGENT_DEFAUT: ReglagesAgent = {
  id: 'agent',
  // En pause tant que l'équipe ne l'a pas allumé (Repull et crédits requis).
  actif: false,
  ton: 'chaleureux',
  langues: ['fr', 'en'],
  signature: SIGNATURE_LABEL_MAISON,
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

/**
 * Réglages de l'agent, complétés par les valeurs par défaut. `nomEspace` :
 * nom de l'espace pour la signature par défaut (absent : Label Maison).
 */
export function reglagesAgent(d: Pick<ErpDonnees, 'reglages'>, nomEspace?: string): ReglagesAgent {
  const defaut = nomEspace === undefined ? REGLAGES_AGENT_DEFAUT : { ...REGLAGES_AGENT_DEFAUT, signature: signatureParDefaut(nomEspace) };
  const stocke = (d.reglages ?? []).find((r): r is ReglagesAgent => r?.id === 'agent');
  if (!stocke) return defaut;
  return {
    ...defaut,
    ...stocke,
    // Signature absente ou illisible : celle de l'espace (jamais celle d'un autre).
    signature: typeof stocke.signature === 'string' ? stocke.signature : defaut.signature,
    horaires: { ...defaut.horaires, ...(stocke.horaires ?? {}) },
    transmettre: { ...defaut.transmettre, ...(stocke.transmettre ?? {}) },
    langues: Array.isArray(stocke.langues) && stocke.langues.length ? stocke.langues : defaut.langues,
  };
}
