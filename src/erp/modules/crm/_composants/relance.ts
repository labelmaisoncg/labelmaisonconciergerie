/**
 * Brouillon de relance du CRM (navigateur) : demandé au serveur
 * (POST /api/erp-agent { action: 'crm_relance' }), qui le fait rédiger par
 * l'IA. Rien n'est envoyé : l'équipe relit, copie et envoie elle-même. En
 * démonstration, ou si l'IA n'est pas disponible, un modèle sans IA
 * (relanceModele) prend le relais, avec une phrase qui le dit.
 */
import { relanceModele, type CanalRelance, type Relance } from '../../../data/crm-assistant';
import { AUJOURDHUI } from '../../../data/format';
import type { ContactCrm } from '../../../data/types';
import { appelerServeur, ErreurServeur } from '../../messagerie/_composants/serveur';

export interface ResultatRelance {
  relance: Relance;
  /** Phrase à montrer sous le brouillon (modèle sans IA, raison d'un repli). */
  avis?: string;
}

/** Codes du serveur pour lesquels un modèle sans IA est proposé à la place. */
const REPLI = new Set(['indisponible', 'plafond', 'vide']);

export async function demanderRelance(c: ContactCrm, canal: CanalRelance, o: { demo: boolean; signature: string }): Promise<ResultatRelance> {
  const modele = () => relanceModele(c, canal, { signature: o.signature, aujourdhui: AUJOURDHUI });
  if (o.demo) {
    await new Promise((r) => setTimeout(r, 500));
    return { relance: modele(), avis: 'En démonstration, c’est un modèle : avec votre espace relié, votre agent l’écrit pour ce contact.' };
  }
  try {
    const r = await appelerServeur<{ relance: Relance }>('/api/erp-agent', 'POST', { action: 'crm_relance', contactId: c.id, canal });
    return { relance: r.relance };
  } catch (e) {
    if (e instanceof ErreurServeur && e.code && REPLI.has(e.code)) return { relance: modele(), avis: e.message };
    throw e;
  }
}
