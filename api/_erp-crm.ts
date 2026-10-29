// =============================================================================
// CRM : chaque formulaire du site devient une ligne « À appeler » dans l'ERP
// (collection `crm`), écrite avec le compte d'équipe (ERP_PASSWORD), comme la
// synchronisation Repull. Même personne déjà suivie (e-mail ou téléphone) :
// pas de doublon, sa ligne repasse « À appeler » avec la nouvelle demande.
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import { contactDepuisDemande, fusionnerDemande, idContactCrm, trouverDoublon, type DemandeSite } from '../src/erp/data/crm.js';
import { envoyeesDepuis, envoyerNotifications } from '../src/erp/data/notifications-envoi.js';
import { notificationLeadPlafonnee } from '../src/erp/data/notifications.js';
import { horodatageParis } from '../src/erp/data/repull.js';
import type { ContactCrm } from '../src/erp/data/types.js';
import { clesServeur } from './_erp-notifications.js';
import { baseErp, configuration } from './_erp-repull.js';

export type ResultatCrm = { etat: 'cree' | 'mis_a_jour'; id: string; contact: ContactCrm } | { etat: 'inactif' };

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
    const fusionne = fusionnerDemande(doublon, nouveau, maintenant);
    await base.ecrire('crm', [fusionne], AUTEUR);
    return { etat: 'mis_a_jour', id: doublon.id, contact: fusionne };
  }
  await base.ecrire('crm', [nouveau], AUTEUR);
  return { etat: 'cree', id: nouveau.id, contact: nouveau };
}

/**
 * Notification « Nouvelle demande à appeler » sur les appareils du gérant
 * (notifications.ts, type « lead », réservé au gérant). Sans clés VAPID ni
 * compte d'équipe : rien. Plafonnée (formulaire public) : au-delà de 5 dans
 * l'heure, une seule « Plusieurs nouvelles demandes » par heure. Ne lève jamais :
 * un échec n'empêche pas la demande d'être acceptée (elle est déjà dans le CRM
 * et partie par e-mail).
 */
export async function notifierNouveauLead(contact: ContactCrm, nouveau: boolean): Promise<void> {
  try {
    const cles = clesServeur();
    const c = configuration();
    if (!cles || !c.motDePasse) return;
    const base = baseErp(c);
    const maintenant = new Date();
    const recentes = await envoyeesDepuis(base, 'lead-', new Date(maintenant.getTime() - 3_600_000)).catch(() => 0);
    await envoyerNotifications(base, [notificationLeadPlafonnee(contact, { nouveau, recentes, maintenant })], { cles, maintenant });
  } catch (e) {
    console.warn('[crm] notification de la demande impossible', e instanceof Error ? e.message : e);
  }
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
