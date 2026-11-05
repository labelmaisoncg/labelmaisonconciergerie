/**
 * Nouveau contact du CRM, saisi pas à pas (modules/crm/index.tsx) : son nom,
 * comment le joindre (téléphone ou e-mail, au moins un), son bien, une note,
 * puis le récapitulatif.
 *
 * Mêmes règles et même ligne que l'ancien formulaire : un nom, un téléphone
 * ou un e-mail ; source « manuel », étape « À appeler », e-mail en
 * minuscules, champs vides absents, une trace « Contact ajouté à la main. »
 * dans l'historique. Un contact déjà en cours avec ce numéro ou cet e-mail
 * est signalé (trouverDoublon), sans bloquer.
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */
import { telephoneNormalise, trouverDoublon } from './crm';
import type { ContactCrm, Horodatage, Id } from './types';

export const ECRANS_CONTACT = ['nom', 'joindre', 'bien', 'notes', 'recapitulatif'] as const;
export type EcranContact = (typeof ECRANS_CONTACT)[number];

export interface BrouillonContact {
  nom: string;
  telephone: string;
  email: string;
  ville: string;
  typeBien: string;
  notes: string;
}

export const brouillonContact = (): BrouillonContact => ({ nom: '', telephone: '', email: '', ville: '', typeBien: '', notes: '' });

/** « Téléphone ou e-mail » n'est le champ de personne : dit au-dessus de « Continuer ». */
export const SANS_CHAMP_CONTACT = new Set(['joindre']);

/** Erreurs d'un écran ; le récapitulatif réunit celles de tous les écrans. */
export function erreursContact(ecran: EcranContact, b: BrouillonContact): Record<string, string> {
  const r: Record<string, string> = {};
  if ((ecran === 'nom' || ecran === 'recapitulatif') && !b.nom.trim()) r.nom = 'Indiquez son nom.';
  if ((ecran === 'joindre' || ecran === 'recapitulatif') && !b.telephone.trim() && !b.email.trim()) r.joindre = 'Indiquez un téléphone ou un e-mail.';
  return r;
}

export const ecranDeLaCleContact = (cle: string): EcranContact => (cle === 'nom' ? 'nom' : cle === 'joindre' ? 'joindre' : 'recapitulatif');

/** Contact déjà en cours avec ce numéro (9 chiffres au moins) ou cet e-mail, comme l'ancien formulaire. */
export function doublonContact(contacts: ContactCrm[], b: Pick<BrouillonContact, 'email' | 'telephone'>): ContactCrm | undefined {
  return b.email.trim() || telephoneNormalise(b.telephone).length >= 9 ? trouverDoublon(contacts, { email: b.email, telephone: b.telephone }) : undefined;
}

export type ResultatContact = { ok: true; contact: ContactCrm } | { ok: false; ecran: EcranContact; erreur: string };

/** Ce que « Ajouter le contact » enregistre : la même ligne que l'ancien formulaire. */
export function contactDepuisBrouillon(b: BrouillonContact, o: { id: Id; par: string; maintenant: Horodatage }): ResultatContact {
  const erreurs = Object.entries(erreursContact('recapitulatif', b));
  if (erreurs.length) return { ok: false, ecran: ecranDeLaCleContact(erreurs[0][0]), erreur: erreurs[0][1] };
  return {
    ok: true,
    contact: {
      id: o.id,
      nom: b.nom.trim(),
      ...(b.telephone.trim() ? { telephone: b.telephone.trim() } : {}),
      ...(b.email.trim() ? { email: b.email.trim().toLowerCase() } : {}),
      ...(b.ville.trim() ? { ville: b.ville.trim() } : {}),
      ...(b.typeBien.trim() ? { typeBien: b.typeBien.trim() } : {}),
      source: 'manuel',
      statut: 'a_appeler',
      notes: b.notes.trim(),
      tentatives: 0,
      historique: [{ le: o.maintenant, par: o.par, resultat: 'note', texte: 'Contact ajouté à la main.' }],
      creeLe: o.maintenant,
      majLe: o.maintenant,
    },
  };
}

const NON_RENSEIGNE = 'Non renseigné';

/** Lignes du récapitulatif ; un champ facultatif vide se dit « Non renseigné ». */
export function recapContact(b: BrouillonContact): { cle: string; ecran: Exclude<EcranContact, 'recapitulatif'>; libelle: string; valeur: string }[] {
  const joindre = !!(b.telephone.trim() || b.email.trim());
  return [
    { cle: 'nom', ecran: 'nom', libelle: 'Nom', valeur: b.nom.trim() },
    { cle: 'telephone', ecran: 'joindre', libelle: 'Téléphone', valeur: b.telephone.trim() || (joindre ? NON_RENSEIGNE : '') },
    { cle: 'email', ecran: 'joindre', libelle: 'E-mail', valeur: b.email.trim() || (joindre ? NON_RENSEIGNE : '') },
    { cle: 'bien', ecran: 'bien', libelle: 'Bien', valeur: [b.typeBien.trim(), b.ville.trim()].filter(Boolean).join(', ') || NON_RENSEIGNE },
    { cle: 'notes', ecran: 'notes', libelle: 'Notes', valeur: b.notes.trim() || 'Aucune' },
  ];
}
