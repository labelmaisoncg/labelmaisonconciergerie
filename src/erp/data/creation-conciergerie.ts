/**
 * Inviter une conciergerie, pas à pas (Paramètres → Espaces, gérants de
 * Label Maison, modules/parametres/AssistantConciergerie.tsx) : le nom de la
 * conciergerie, l'adresse de la personne qui ouvrira son espace, puis le
 * récapitulatif.
 *
 * Mêmes règles et même appel que l'ancien formulaire : nom obligatoire
 * (80 caractères au plus, il ne se change plus), adresse valide ; l'envoi
 * reste { action: 'inviter', nom, email } vers api/erp-espaces.ts, qui
 * revérifie les droits et appelle erp.inviter_espace (code à usage unique,
 * gardé par son empreinte, 14 jours).
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */

export const ECRANS_CONCIERGERIE = ['nom', 'email', 'recapitulatif'] as const;
export type EcranConciergerie = (typeof ECRANS_CONCIERGERIE)[number];

/** Longueur du nom saisi (le champ ne va pas au-delà). */
export const NOM_CONCIERGERIE_MAX = 80;

export interface BrouillonConciergerie {
  nom: string;
  email: string;
}

export const brouillonConciergerie = (): BrouillonConciergerie => ({ nom: '', email: '' });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Erreurs d'un écran ; le récapitulatif réunit celles de tous les écrans. */
export function erreursConciergerie(ecran: EcranConciergerie, b: BrouillonConciergerie): Record<string, string> {
  if (ecran === 'recapitulatif') return { ...erreursConciergerie('nom', b), ...erreursConciergerie('email', b) };
  const r: Record<string, string> = {};
  if (ecran === 'nom' && !b.nom.trim()) r.nom = 'Donnez le nom de la conciergerie.';
  if (ecran === 'email') {
    if (!b.email.trim()) r.email = 'Indiquez l’adresse de la personne.';
    else if (!EMAIL.test(b.email.trim())) r.email = 'Adresse e‑mail invalide.';
  }
  return r;
}

export const ecranDeLaCleConciergerie = (cle: string): EcranConciergerie => (cle === 'nom' || cle === 'email' ? cle : 'recapitulatif');

export type ResultatConciergerie = { ok: true; corps: { action: 'inviter'; nom: string; email: string } } | { ok: false; ecran: EcranConciergerie; erreur: string };

/** Ce qu'envoie « Inviter » : le même corps que l'ancien formulaire (et que « Renvoyer »). */
export function invitationConciergerie(b: BrouillonConciergerie): ResultatConciergerie {
  const erreurs = Object.entries(erreursConciergerie('recapitulatif', b));
  if (erreurs.length) return { ok: false, ecran: ecranDeLaCleConciergerie(erreurs[0][0]), erreur: erreurs[0][1] };
  return { ok: true, corps: { action: 'inviter', nom: b.nom.trim(), email: b.email.trim() } };
}

/** Lignes du récapitulatif. */
export function recapConciergerie(b: BrouillonConciergerie): { cle: string; ecran: Exclude<EcranConciergerie, 'recapitulatif'>; libelle: string; valeur: string }[] {
  return [
    { cle: 'nom', ecran: 'nom', libelle: 'Conciergerie', valeur: b.nom.trim() },
    { cle: 'email', ecran: 'email', libelle: 'Personne qui ouvrira l’espace', valeur: b.email.trim() },
  ];
}
