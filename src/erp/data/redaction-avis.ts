/**
 * Rédaction de l'avis de l'hôte sur un voyageur (B5, « Votre avis sur le
 * voyageur ») par l'IA de l'agent : même clé, même modèle, même plafond
 * mensuel de l'espace (compté dans agent/etat avant l'appel). Une seule
 * rédaction pour l'avis à déposer à la main (passage-programmes.ts) et pour
 * la publication automatique (avis-auto-passage.ts).
 *
 * Garde-fous (consignesAvis, messages-programmes.ts) : 2 à 3 phrases, dans la
 * langue du voyageur, jamais de nom de famille, d'adresse, de code, de prix ni
 * de lien ; un séjour à relire n'a jamais d'éloge (retiré même si l'IA en
 * écrit un) ; un texte avec un lien, une adresse, un chiffre ou un e-mail est
 * à relire (alerte de forme).
 *
 * Imports relatifs avec « .js » : ce fichier tourne sous Node (ESM).
 */
import { ErreurAssistant, compterAppelIA, type OptionsAssistant } from './agent-assistant.js';
import { MODELE_AGENT_DEFAUT, texteErreurIA, type ClientIA } from './agent-messagerie.js';
import { SCHEMA_AVIS, alerteTexteAvis, consignesAvis, contexteAvis, contientEloge, lireAvisIA, soucisDuSejour } from './messages-programmes.js';
import type { FilMessages, Logement, Reservation } from './types';

export interface OptionsRedactionAvis extends Pick<OptionsAssistant, 'base' | 'plafondIAMois' | 'maintenant'> {
  /** Client Claude ; absent : pas de rédaction (texte simple chez l'appelant). */
  ia?: ClientIA | null;
  modele?: string;
  /** Nom de l'espace (consignes) ; absent : Label Maison. */
  nomEspace?: string;
  /** Instant (ms) à ne pas dépasser : la rédaction est bornée au temps qui reste. */
  echeance: number;
}

export interface AvisRedige {
  /** Texte de l'IA ('' : rien d'utilisable, l'appelant prend le texte simple ou laisse vide). */
  texte: string;
  source: 'ia' | 'modele';
  /** Raisons de relire, complétées par l'IA (point signalé, alerte de forme). */
  raisons: string[];
  /** Un appel à l'IA a été compté (et fait). */
  appelIA: boolean;
  /** L'IA a répondu, mais rien de lisible. */
  illisible?: true;
  /** L'IA n'a pas pu rédiger : plafond du mois, clé refusée, service indisponible (message en clair). */
  echec?: { plafond: boolean; message: string };
}

/**
 * Avis de l'hôte sur le voyageur de `r`, rédigé par l'IA. `raisons` : ce que
 * l'équipe doit savoir du séjour (raisonsARelire) ; `langue` : celle du
 * voyageur (le français par défaut). Ne lève jamais : un échec est rendu.
 */
export async function redigerAvisVoyageur(
  o: OptionsRedactionAvis,
  r: Reservation,
  logement: (Pick<Logement, 'nom' | 'ville'> & Partial<Pick<Logement, 'adresse'>>) | undefined,
  fils: readonly FilMessages[],
  raisons: readonly string[],
  langue?: string,
): Promise<AvisRedige> {
  const res: AvisRedige = { texte: '', source: 'modele', raisons: [...raisons], appelIA: false };
  if (!o.ia) return res;
  try {
    // Compté AVANT l'appel, dans le compteur du mois de l'espace (agent/etat) : refusé au plafond.
    await compterAppelIA({ base: o.base, plafondIAMois: o.plafondIAMois, maintenant: o.maintenant });
    res.appelIA = true;
    // Borné au temps qui reste (le client commun attend jusqu'à 25 s, deux fois) : jamais au-delà du passage.
    const creer = o.ia.messages.create as (p: Parameters<ClientIA['messages']['create']>[0], x?: { timeout?: number; maxRetries?: number }) => ReturnType<ClientIA['messages']['create']>;
    const m = await creer.call(
      o.ia.messages,
      {
        model: o.modele ?? MODELE_AGENT_DEFAUT,
        max_tokens: 600,
        // Label Maison sans nom d'espace ; un autre espace, jamais sous le nom de Label Maison.
        system: consignesAvis(o.nomEspace === undefined ? 'Label Maison' : o.nomEspace.trim() || 'la conciergerie'),
        messages: [{ role: 'user', content: contexteAvis(r, logement, fils, res.raisons, langue) }],
        output_config: { format: { type: 'json_schema', schema: SCHEMA_AVIS as unknown as Record<string, unknown> } },
      },
      { timeout: Math.max(5_000, Math.min(20_000, o.echeance - Date.now() - 3_000)), maxRetries: 0 },
    );
    const lu = lireAvisIA(m);
    if (!lu) {
      res.illisible = true;
      return res;
    }
    res.texte = lu.texte;
    res.source = 'ia';
    if (lu.aRelire) res.raisons.push(lu.raison || 'Votre agent signale un point à vérifier');
    // Séjour à relire : jamais d'éloge, même si l'IA en écrit un malgré les consignes. L'équipe l'écrira.
    if (soucisDuSejour(res.raisons).length && contientEloge(res.texte)) {
      res.texte = '';
      res.source = 'modele';
    }
    // Un avis public : jamais de lien, d'adresse, de chiffre ni d'e-mail sans relecture (alerte de forme,
    // pas un souci du séjour : le texte, même élogieux, reste proposé, à relire).
    const alerte = alerteTexteAvis(res.texte, logement);
    if (alerte) res.raisons.push(alerte);
  } catch (e) {
    res.echec = { plafond: e instanceof ErreurAssistant && e.code === 'plafond', message: texteErreurIA(e) };
  }
  return res;
}
