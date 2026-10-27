/**
 * Assistant CRM, côté serveur (api/erp-agent.ts, action « crm_relance ») :
 * brouillon de relance (SMS ou e-mail) rédigé par l'IA pour un contact du
 * CRM. RIEN N'EST ENVOYÉ : l'équipe relit le texte, le copie et l'envoie
 * elle-même ; l'ERP n'envoie ni e-mail ni SMS.
 *
 * - Lit le contact dans la base de l'espace (jamais le texte du navigateur),
 *   les réglages de l'agent (signature) ; ni téléphone ni e-mail du contact
 *   ne partent à l'IA.
 * - Chaque appel compte dans le plafond mensuel de l'espace (compterAppelIA,
 *   comme l'assistant de réponse) ; plafond atteint : refus clair.
 * - Garde-fous sur le brouillon (refusRelance, crm-assistant.ts) : pas de
 *   lien, d'adresse, de numéro, de montant, de tutoiement, ni de chiffre
 *   absent de la fiche. Écarté : l'écran propose le modèle sans IA.
 *
 * Client IA et base injectés (verifier-crm-assistant.ts les simule).
 * Imports en « .js » : tourne sous Node (ESM).
 */
import { compterAppelIA, ErreurAssistant, type OptionsAssistant } from './agent-assistant.js';
import { MODELE_AGENT_DEFAUT } from './agent-messagerie.js';
import { consignesRelance, contexteRelance, lireRelance, nettoyerRelance, profilContact, refusRelance, SCHEMA_RELANCE, signerRelance, type CanalRelance, type Relance } from './crm-assistant.js';
import { reglagesAgent } from './reglages.js';
import { dateParis, horodatageParis } from './repull.js';
import type { ContactCrm, Journal, ReglagesAgent } from './types';

const AUTEUR = 'Assistant CRM';
const ID = /^[\w-]{1,100}$/;

/** Canal demandé par l'écran (rien d'autre n'est accepté). */
export function canalValide(v: unknown): CanalRelance | null {
  return v === 'sms' || v === 'email' ? v : null;
}

/**
 * Brouillon de relance pour le contact `contactId`. Lève ErreurAssistant
 * (message prêt à afficher, statut HTTP, code) : `indisponible` (pas de clé
 * IA), `plafond`, `introuvable`, `texte` (canal impossible), `vide`
 * (réponse illisible ou écartée par les garde-fous).
 */
export async function preparerRelance(o: OptionsAssistant, contactId: unknown, canalDemande: unknown): Promise<Relance> {
  const canal = canalValide(canalDemande);
  if (!canal) throw new ErreurAssistant('Choisissez un SMS ou un e-mail.', 400, 'texte');
  const id = String(contactId ?? '').trim();
  const [contact] = ID.test(id) ? await o.base.lire<ContactCrm>('crm', [id]) : [];
  if (!contact) throw new ErreurAssistant('Contact introuvable : rechargez la page.', 404, 'introuvable');
  if (canal === 'sms' && !contact.telephone?.trim()) throw new ErreurAssistant('Pas de téléphone dans la fiche : préparez plutôt un e-mail.', 400, 'texte');
  if (canal === 'email' && !contact.email?.trim()) throw new ErreurAssistant('Pas d’e-mail dans la fiche : préparez plutôt un SMS.', 400, 'texte');
  if (!o.ia) throw new ErreurAssistant('La rédaction des relances par votre agent n’est pas encore activée sur ce site.', 503, 'indisponible');

  const maintenant = (o.maintenant ?? (() => new Date()))();
  const reglages = reglagesAgent({ reglages: await o.base.lire<ReglagesAgent>('reglages', ['agent']) }, o.nomEspace);
  const faits = contexteRelance(contact, dateParis(maintenant));

  await compterAppelIA(o);
  const m = await o.ia.messages.create({
    model: o.modele ?? MODELE_AGENT_DEFAUT,
    max_tokens: 1024,
    system: consignesRelance({ nom: o.nomEspace ?? 'Label Maison', canal, profil: profilContact(contact) }),
    messages: [{ role: 'user', content: faits }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA_RELANCE as unknown as Record<string, unknown> } },
  });
  const lu = lireRelance(m);
  if (!lu) throw new ErreurAssistant('Votre agent n’a pas pu écrire cette relance : voici un modèle à compléter.', 502, 'vide');
  const brouillon = { objet: nettoyerRelance(lu.objet).slice(0, 80), texte: nettoyerRelance(lu.texte) };
  const refus = refusRelance(brouillon, canal, faits);
  if (refus) throw new ErreurAssistant(`Brouillon écarté (${refus}) : voici un modèle à compléter.`, 422, 'vide');

  const journal: Journal = {
    id: `crm-relance-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    horodatage: horodatageParis(maintenant),
    auteur: AUTEUR,
    action: 'Relance préparée',
    entite: 'crm',
    entiteId: contact.id,
    details: `${canal === 'sms' ? 'SMS' : 'E-mail'} de relance préparé pour ${contact.nom}, demandé par ${o.par}. Rien n’est envoyé par l’ERP.`,
  };
  await o.base.ecrire('journal', [journal], AUTEUR).catch(() => undefined);

  return {
    canal,
    ...(canal === 'email' ? { objet: brouillon.objet || 'Votre projet de location' } : {}),
    texte: signerRelance(canal === 'email' && !/cordialement|bien à vous|belle journée/i.test(brouillon.texte) ? `${brouillon.texte}\n\nBien cordialement,` : brouillon.texte, reglages.signature, canal),
  };
}
