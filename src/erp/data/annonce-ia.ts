/**
 * Textes d'une annonce rédigés par l'IA (cahier A6), côté serveur
 * (api/erp-agent.ts, action « textes_annonce », api/_erp-annonces.ts).
 *
 * - Lit le logement (et le nom de son propriétaire, pour ne jamais le citer)
 *   dans la base de l'espace ; l'IA ne reçoit que des faits sûrs et publics
 *   (contexteAnnonceIA : ni adresse, ni wifi, ni accès, ni propriétaire).
 * - Un appel compte dans le plafond mensuel de l'espace (compterAppelIA,
 *   comme « Proposer une réponse »).
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

/** Nom de la conciergerie dans les consignes : Label Maison sans nom d'espace (comme l'agent), jamais pour un autre espace. */
const nomConsignes = (o: Pick<OptionsAssistant, 'nomEspace'>) => (o.nomEspace === undefined ? 'Label Maison' : o.nomEspace.trim() || 'la conciergerie');

/**
 * Trois titres et une description pour un logement, rédigés par l'IA puis
 * relus par les garde-fous. Lève ErreurAssistant (message prêt à afficher).
 */
export async function proposerTextesAnnonceIA(o: OptionsAssistant, logementId: string): Promise<TextesFinaux> {
  if (!o.ia) throw new ErreurAssistant('La rédaction par votre agent n’est pas encore activée sur ce site : les textes tirés de la fiche restent proposés.', 503, 'indisponible');
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
