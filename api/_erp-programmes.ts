// =============================================================================
// Messages automatiques aux voyageurs et avis à déposer — passage planifié
// (api/erp-agent.ts, après l'agent, dans chaque espace).
//
// Mêmes briques que l'agent : clé Claude et modèle communs (optionsAgent),
// plafond mensuel de l'IA pour un autre espace que Label Maison, liens signés
// des guides, lien du livret de chaque séjour (api/_sejour.ts). Les envois
// passent par envoyerMessage (messagerie-envoi.ts), le seul chemin d'envoi aux
// voyageurs. Ne lève jamais : un échec est noté et le passage de l'agent n'en
// souffre pas.
// =============================================================================

import { lancerProgrammes, type BilanProgrammes } from '../src/erp/data/passage-programmes.js';
import { optionsAgent } from './_erp-agent.js';
import type { ConfigRepullErp } from './_erp-repull.js';
import { lienSejourServeur } from './_sejour.js';

/** Temps minimal pour lancer un passage (lecture des réglages, quelques envois). */
const TEMPS_MIN_MS = 6_000;

export async function programmesPlanifies(c: ConfigRepullErp, echeance: number): Promise<BilanProgrammes | null> {
  if (echeance - Date.now() < TEMPS_MIN_MS) return null;
  try {
    const a = optionsAgent(c, 'planifie', echeance);
    return await lancerProgrammes({
      cle: a.cle,
      workspace: a.workspace,
      origineCle: a.origineCle,
      base: a.base,
      echeance,
      budgetMois: a.budgetMois,
      quotaMois: a.quotaMois,
      ia: a.ia,
      modele: a.modele,
      signerFichier: a.signerFichier,
      // {lien_sejour} : livret et check-in en ligne, lien signé dans l'espace du passage.
      lienSejour: (r) => lienSejourServeur(c.espace, r.id),
      ...(a.nomEspace !== undefined ? { nomEspace: a.nomEspace } : {}),
      ...(a.plafondIAMois !== undefined ? { plafondIAMois: a.plafondIAMois } : {}),
    });
  } catch (e) {
    console.error('[programmes] échec', e);
    return null;
  }
}
