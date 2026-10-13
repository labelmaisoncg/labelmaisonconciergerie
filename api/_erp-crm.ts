// =============================================================================
// CRM : chaque formulaire du site devient une ligne « À appeler » dans l'ERP
// (collection `crm`), écrite avec le compte d'équipe (ERP_PASSWORD), comme la
// synchronisation Repull. Même personne déjà suivie (e-mail ou téléphone) :
// pas de doublon, sa ligne repasse « À appeler » avec la nouvelle demande.
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import { contactDepuisDemande, fusionnerDemande, idContactCrm, trouverDoublon, type DemandeSite } from '../src/erp/data/crm.js';
import { horodatageParis } from '../src/erp/data/repull.js';
import type { ContactCrm } from '../src/erp/data/types.js';
import { baseErp, configuration } from './_erp-repull.js';

export type ResultatCrm = { etat: 'cree' | 'mis_a_jour'; id: string } | { etat: 'inactif' };

const AUTEUR = 'Formulaire du site';

export async function enregistrerDemandeCrm(demande: DemandeSite): Promise<ResultatCrm> {
  const c = configuration();
  if (!c.motDePasse) return { etat: 'inactif' };
  const base = baseErp(c);
  const maintenant = horodatageParis();
  const nouveau = contactDepuisDemande(demande, idContactCrm(), maintenant);
  const existants = await base.lire<ContactCrm>('crm');
  const doublon = trouverDoublon(existants, nouveau);
  if (doublon) {
    await base.ecrire('crm', [fusionnerDemande(doublon, nouveau, maintenant)], AUTEUR);
    return { etat: 'mis_a_jour', id: doublon.id };
  }
  await base.ecrire('crm', [nouveau], AUTEUR);
  return { etat: 'cree', id: nouveau.id };
}

/** Promesse coupée au bout de `ms` (la réponse au visiteur n'attend pas indéfiniment). */
export function avecDelai<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error(`délai de ${ms} ms dépassé`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        ok(v);
      },
      (e) => {
        clearTimeout(t);
        ko(e);
      },
    );
  });
}
