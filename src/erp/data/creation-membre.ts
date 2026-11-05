/**
 * Ajouter quelqu'un à l'équipe de l'ERP, pas à pas (Paramètres → Équipe,
 * modules/parametres/AssistantMembre.tsx) : son adresse e-mail, le nom
 * affiché, son rôle, puis le récapitulatif.
 *
 * Mêmes règles et même ligne que l'ancien formulaire « Ajouter quelqu'un » :
 * adresse lisible et pas déjà dans l'équipe, nom affiché obligatoire, rôle
 * « Opérations » d'office (le rôle prestataire n'est plus proposé) ; la ligne
 * est { id, email, nom, role }, l'id étant l'adresse en production et
 * « usr-… » en démonstration. L'invitation se propose ensuite sur la page
 * (« Envoyer l'invitation », api/erp-invitation), comme avant.
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */
import { LIBELLES } from './libelles';
import type { RoleUtilisateur, Utilisateur } from './types';

export const ECRANS_MEMBRE = ['email', 'nom', 'role', 'recapitulatif'] as const;
export type EcranMembre = (typeof ECRANS_MEMBRE)[number];

export interface BrouillonMembre {
  email: string;
  nom: string;
  role: RoleUtilisateur;
}

export const brouillonMembre = (): BrouillonMembre => ({ email: '', nom: '', role: 'operations' });

/** Le rôle est un choix : dit au-dessus de « Continuer ». */
export const SANS_CHAMP_MEMBRE = new Set(['role']);

/** Adresse telle qu'enregistrée : sans espaces autour, en minuscules. */
export const adresseMembre = (email: string): string => email.trim().toLowerCase();

/** Erreurs d'un écran ; le récapitulatif réunit celles de tous les écrans. */
export function erreursMembre(ecran: EcranMembre, b: BrouillonMembre, utilisateurs: readonly Pick<Utilisateur, 'email'>[]): Record<string, string> {
  if (ecran === 'recapitulatif') return Object.assign({}, ...ECRANS_MEMBRE.filter((e) => e !== 'recapitulatif').map((e) => erreursMembre(e, b, utilisateurs)));
  const r: Record<string, string> = {};
  const email = adresseMembre(b.email);
  if (ecran === 'email') {
    if (!email) r.email = 'Indiquez son adresse e-mail.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) r.email = 'Adresse e-mail invalide.';
    else if (utilisateurs.some((u) => u.email.toLowerCase() === email)) r.email = 'Ce membre existe déjà.';
  }
  if (ecran === 'nom' && !b.nom.trim()) r.nom = 'Indiquez le nom affiché.';
  return r;
}

const ECRAN_DE_LA_CLE: Record<string, EcranMembre> = { email: 'email', nom: 'nom', role: 'role' };
export const ecranDeLaCleMembre = (cle: string): EcranMembre => ECRAN_DE_LA_CLE[cle] ?? 'recapitulatif';

export type ResultatMembre = { ok: true; membre: Utilisateur } | { ok: false; ecran: EcranMembre; erreur: string };

/**
 * Ce qu'enregistre « Ajouter » : la même ligne que l'ancien formulaire.
 * `reel` : base de production (l'id est l'adresse) ; sinon démonstration,
 * l'id est « usr- » suivi de l'heure en base 36.
 */
export function membreDepuisBrouillon(b: BrouillonMembre, o: { utilisateurs: readonly Pick<Utilisateur, 'email'>[]; reel: boolean; maintenantMs: number }): ResultatMembre {
  const erreurs = Object.entries(erreursMembre('recapitulatif', b, o.utilisateurs));
  if (erreurs.length) return { ok: false, ecran: ecranDeLaCleMembre(erreurs[0][0]), erreur: erreurs[0][1] };
  const email = adresseMembre(b.email);
  const id = o.reel ? email : `usr-${o.maintenantMs.toString(36)}`;
  return { ok: true, membre: { id, email, nom: b.nom.trim(), role: b.role } };
}

/** Lignes du récapitulatif. */
export function recapMembre(b: BrouillonMembre): { cle: string; ecran: Exclude<EcranMembre, 'recapitulatif'>; libelle: string; valeur: string }[] {
  return [
    { cle: 'email', ecran: 'email', libelle: 'Adresse e-mail', valeur: adresseMembre(b.email) },
    { cle: 'nom', ecran: 'nom', libelle: 'Nom affiché', valeur: b.nom.trim() },
    { cle: 'role', ecran: 'role', libelle: 'Rôle', valeur: LIBELLES.role[b.role] },
  ];
}
