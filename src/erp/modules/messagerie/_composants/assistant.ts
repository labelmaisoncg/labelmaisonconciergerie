/**
 * Assistant de réponse dans la messagerie (navigateur) : réponse proposée
 * par l'agent et traductions, par /api/erp-agent (rien n'est envoyé au
 * voyageur : l'équipe relit et envoie elle-même). En démonstration, sans
 * serveur, une proposition écrite à partir de la fiche du logement.
 */
import type { FilMessages, IntentionMessage, Logement } from '../../../data/types';
import { dernierVoyageur, intentionFil, langueFil, sujetSensible } from '../../../data/messagerie-ia';
import { appelerServeur } from './serveur';

export interface Proposition {
  /** Dans la langue du voyageur, signée. */
  texte: string;
  /** Version française (absente si la réponse est en français). */
  texteFr?: string;
  langue?: string;
  intention?: IntentionMessage;
  confiance?: number;
  /** Sujet sensible : à relire de près. */
  attention?: string;
}

export async function demanderProposition(filId: string): Promise<Proposition> {
  const r = await appelerServeur<{ proposition: Proposition }>('/api/erp-agent', 'POST', { action: 'brouillon', filId });
  return r.proposition;
}

export async function demanderTraductionMessage(filId: string, messageId: string): Promise<string> {
  const r = await appelerServeur<{ texte: string }>('/api/erp-agent', 'POST', { action: 'traduire', filId, messageId });
  return r.texte;
}

export async function demanderTraductionTexte(texte: string, langue: string): Promise<string> {
  const r = await appelerServeur<{ texte: string }>('/api/erp-agent', 'POST', { action: 'traduire_texte', texte, langue });
  return r.texte;
}

/** Message d'avis quand l'IA n'est pas joignable en démonstration. */
export const AVIS_DEMO_TRADUCTION = 'En démonstration, la traduction n’est pas disponible : elle fonctionne dès que votre espace est relié.';

/**
 * Démonstration : proposition sans IA, à partir de la demande probable et de
 * la fiche du logement (jamais de code d'accès ni de wifi).
 */
export function propositionDemo(fil: FilMessages, logement: Logement | undefined, signature: string): Proposition {
  const prenom = fil.voyageur.split(' ')[0] || '';
  const intention = intentionFil(fil);
  const anglais = langueFil(fil) === 'en';
  const arrivee = logement?.fiche.heureArrivee;
  const depart = logement?.fiche.heureDepart;
  const fr: Partial<Record<IntentionMessage, string>> = {
    arrivee_anticipee: `merci pour votre message. Je vérifie avec l’équipe ménage si le logement peut être prêt plus tôt et je reviens vers vous très vite.`,
    depart_tardif: `merci pour votre message. Je vérifie si un départ plus tard est possible et je reviens vers vous très vite.`,
    arrivee: arrivee ? `l’arrivée est possible à partir de ${arrivee}. Vous recevrez toutes les informations d’accès dans les 48 heures avant votre arrivée.` : '',
    depart: depart ? `le départ se fait avant ${depart}. Merci de laisser les clés comme à votre arrivée.` : '',
    probleme_technique: `merci de nous avoir prévenus, et désolé pour ce désagrément. L’équipe s’en occupe et revient vers vous très vite.`,
    avis: `merci beaucoup pour votre message. Ce fut un plaisir de vous accueillir.`,
  };
  const en: Partial<Record<IntentionMessage, string>> = {
    arrivee_anticipee: `thank you for your message. I am checking with our housekeeping team whether the apartment can be ready earlier, and I will get back to you very soon.`,
    depart_tardif: `thank you for your message. I am checking whether a later check-out is possible, and I will get back to you very soon.`,
    probleme_technique: `thank you for letting us know, and sorry for the inconvenience. Our team is on it and will get back to you very soon.`,
    avis: `thank you so much for your message. It was a pleasure to host you.`,
  };
  const suiteFr = (intention && fr[intention]) || `merci pour votre message. Je regarde cela et je reviens vers vous très vite.`;
  const signe = (t: string) => (signature.trim() ? `${t}\n\n${signature.trim()}` : t);
  const texteFr = `Bonjour ${prenom}, ${suiteFr}`;
  const sensible = sujetSensible(dernierVoyageur(fil)?.texte ?? '', intention);
  const attention = sensible ? `Sujet sensible : ${sensible.motif.charAt(0).toLowerCase()}${sensible.motif.slice(1)}` : undefined;
  if (anglais) {
    const suiteEn = (intention && en[intention]) || `thank you for your message. I am looking into it and will get back to you very soon.`;
    return { texte: signe(`Hello ${prenom}, ${suiteEn}`), texteFr, langue: 'en', ...(intention ? { intention } : {}), ...(attention ? { attention } : {}) };
  }
  return { texte: signe(texteFr), langue: 'fr', ...(intention ? { intention } : {}), ...(attention ? { attention } : {}) };
}
