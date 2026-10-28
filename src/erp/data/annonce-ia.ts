/**
 * Textes d'une annonce rédigés par l'IA (cahier A6), côté serveur
 * (api/erp-agent.ts, action « textes_annonce », api/_erp-annonces.ts).
 *
 * - Lit le logement (et le nom de son propriétaire, pour ne jamais le citer)
 *   dans la base de l'espace ; l'IA ne reçoit que des faits sûrs et publics
 *   (contexteAnnonceIA : ni adresse, ni wifi, ni accès, ni propriétaire).
 * - Un appel compte dans le plafond mensuel de l'espace (compterAppelIA,
 *   comme « Proposer une réponse ») ; chaque membre a au plus 20 demandes
 *   par quart d'heure (freinTextesAnnonce, comme les brouillons du CRM).
 * - Ce que rend l'IA repasse par les garde-fous (finaliserTextes) : un titre
 *   ou une description qui invente un équipement, donne une coordonnée, un
 *   code, l'adresse ou dépasse une limite est remplacé par celui de la fiche.
 * - Rien n'est écrit sur une plateforme, rien n'est envoyé : l'équipe copie
 *   les textes et les colle elle-même sur Airbnb ou Booking.com.
 *
 * Client IA et base injectés (verifier-annonces.ts les simule).
 * Imports relatifs avec « .js » : ce fichier tourne sous Node (ESM).
 */
import { MODELE_AGENT_DEFAUT } from './agent-messagerie.js';
import { ErreurAssistant, compterAppelIA, type OptionsAssistant } from './agent-assistant.js';
import { SCHEMA_TEXTES_ANNONCE, consignesAnnonce, contexteAnnonceIA, finaliserTextes, lireTextesIA, type TextesFinaux } from '../annonces/textes.js';
import type { Logement, Proprietaire } from './types';

export const ACTION_TEXTES_ANNONCE = 'textes_annonce';

/** Demandes de textes permises par membre et par quart d'heure (comme les brouillons du CRM). */
export const TEXTES_PAR_QUART_D_HEURE = 20;
export const FENETRE_TEXTES_MS = 15 * 60_000;
export const MESSAGE_TROP_DE_DEMANDES = 'Trop de demandes d’un coup : réessayez dans quelques minutes.';
/** Montré quand le site ne peut pas faire rédiger l'agent (IA ou base pas encore reliées) : jamais un nom de variable ni d'hébergeur. */
export const MESSAGE_REDACTION_INDISPONIBLE = 'La rédaction par votre agent n’est pas disponible pour l’instant : les textes tirés de la fiche restent proposés.';

/**
 * Frein des demandes (par instance du serveur) : vrai quand la clé (espace et
 * membre) dépasse `max` demandes sur la fenêtre. Chaque essai compte, même
 * refusé. Horloge injectable pour l'auto-contrôle.
 */
export function freinTextesAnnonce(max = TEXTES_PAR_QUART_D_HEURE, fenetreMs = FENETRE_TEXTES_MS, horloge: () => number = Date.now): (cle: string) => boolean {
  const demandes = new Map<string, number[]>();
  return (cle) => {
    const maintenant = horloge();
    const recentes = (demandes.get(cle) ?? []).filter((t) => maintenant - t < fenetreMs);
    recentes.push(maintenant);
    demandes.set(cle, recentes);
    if (demandes.size > 5000) demandes.clear();
    return recentes.length > max;
  };
}

/** Nom de la conciergerie dans les consignes : Label Maison sans nom d'espace (comme l'agent), jamais pour un autre espace. */
const nomConsignes = (o: Pick<OptionsAssistant, 'nomEspace'>) => (o.nomEspace === undefined ? 'Label Maison' : o.nomEspace.trim() || 'la conciergerie');

/**
 * Trois titres et une description pour un logement, rédigés par l'IA puis
 * relus par les garde-fous. Lève ErreurAssistant (message prêt à afficher) :
 * trop de demandes d'un coup (`tropDeDemandes`, frein de la route : rien
 * n'est lu ni appelé), IA pas disponible, logement introuvable.
 */
export async function proposerTextesAnnonceIA(o: OptionsAssistant, logementId: string, frein: { tropDeDemandes?: () => boolean } = {}): Promise<TextesFinaux> {
  if (frein.tropDeDemandes?.()) throw new ErreurAssistant(MESSAGE_TROP_DE_DEMANDES, 429, 'occupe');
  if (!o.ia) throw new ErreurAssistant(MESSAGE_REDACTION_INDISPONIBLE, 503, 'indisponible');
  const id = String(logementId ?? '').trim();
  const [logement] = id ? await o.base.lire<Logement>('logements', [id]) : [];
  if (!logement) throw new ErreurAssistant('Logement introuvable : rechargez la page.', 404, 'introuvable');
  const proprietaires = logement.proprietaireId ? await o.base.lire<Proprietaire>('proprietaires', [logement.proprietaireId]).catch(() => [] as Proprietaire[]) : [];
  const noms = proprietaires.map((p) => p.nom).filter(Boolean);

  await compterAppelIA(o);
  const m = await o.ia.messages.create({
    model: o.modele ?? MODELE_AGENT_DEFAUT,
    max_tokens: 1200,
    system: consignesAnnonce(nomConsignes(o)),
    messages: [{ role: 'user', content: contexteAnnonceIA(logement) }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA_TEXTES_ANNONCE as unknown as Record<string, unknown> } },
  });
  // Réponse illisible : les textes de la fiche, sans rien inventer.
  return finaliserTextes(lireTextesIA(m), logement, { noms });
}
