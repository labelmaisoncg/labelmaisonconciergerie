/**
 * Inviter un propriétaire, pas à pas (Paramètres → Accès,
 * modules/parametres/AssistantInvitationProprietaire.tsx) : son adresse
 * e-mail (une fiche de l'espace avec la même adresse est reprise), son nom et
 * son téléphone, ses logements, puis le récapitulatif.
 *
 * Mêmes règles et mêmes écritures que l'ancienne fenêtre « Inviter un
 * propriétaire » : nom obligatoire (2 lettres) sauf fiche reprise, adresse
 * valide ; un logement d'un autre propriétaire lui est retiré, et c'est dit
 * avant (« Confirmer et inviter ») ; la fiche reprise garde son nom et son
 * téléphone et perd l'ancien IBAN masqué ; une nouvelle fiche est un
 * particulier, sans adresse ni notes. L'invitation part ensuite
 * (Acces.tsx, envoyerInvitationProprietaire).
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */
import { transfertsProprietaire, type Transfert } from './acces-gerant';
import { EMAIL_RESPONSABLE } from './creation-responsable';
import type { DateISO, Id, Logement, Proprietaire } from './types';

export const ECRANS_INVITATION_PROPRIETAIRE = ['email', 'identite', 'logements', 'recapitulatif'] as const;
export type EcranInvitationProprietaire = (typeof ECRANS_INVITATION_PROPRIETAIRE)[number];

export interface BrouillonInvitationProprietaire {
  email: string;
  nom: string;
  telephone: string;
  /** Logements cochés (ceux de la fiche reprise restent à elle, cochés d'office). */
  logementIds: Id[];
}

export const brouillonInvitationProprietaire = (): BrouillonInvitationProprietaire => ({ email: '', nom: '', telephone: '', logementIds: [] });

/** Adresse telle qu'enregistrée : sans espaces autour, en minuscules. */
export const adresseInvitation = (email: string): string => email.trim().toLowerCase();

/** Fiche de l'espace qui a déjà cette adresse (elle sera reprise, sans doublon). */
export function proprietaireAvecEmail(proprietaires: readonly Proprietaire[], email: string): Proprietaire | undefined {
  const adresse = adresseInvitation(email);
  return adresse ? proprietaires.find((p) => p.contact.email.trim().toLowerCase() === adresse) : undefined;
}

export interface ContexteInvitationProprietaire {
  proprietaires: readonly Proprietaire[];
  logements: readonly Pick<Logement, 'id' | 'nom' | 'proprietaireId'>[];
  /** Propriétaire « à renseigner » (logements importés) : le lui retirer n'est pas un transfert. */
  aRenseigner: Id;
}

/** Les cases sont dites au-dessus de « Continuer ». */
export const SANS_CHAMP_INVITATION_PROPRIETAIRE = new Set(['logementIds']);

/** Erreurs d'un écran ; le récapitulatif réunit celles de tous les écrans. */
export function erreursInvitationProprietaire(ecran: EcranInvitationProprietaire, b: BrouillonInvitationProprietaire, ctx: Pick<ContexteInvitationProprietaire, 'proprietaires'>): Record<string, string> {
  if (ecran === 'recapitulatif') {
    return Object.assign({}, ...ECRANS_INVITATION_PROPRIETAIRE.filter((e) => e !== 'recapitulatif').map((e) => erreursInvitationProprietaire(e, b, ctx)));
  }
  const r: Record<string, string> = {};
  if (ecran === 'email') {
    if (!b.email.trim()) r.email = 'Indiquez son adresse e‑mail.';
    else if (!EMAIL_RESPONSABLE.test(adresseInvitation(b.email))) r.email = 'Adresse e‑mail invalide.';
  }
  if (ecran === 'identite' && b.nom.trim().length < 2 && !proprietaireAvecEmail(ctx.proprietaires, b.email)) r.nom = 'Indiquez le nom du propriétaire.';
  return r;
}

const ECRAN_DE_LA_CLE: Record<string, EcranInvitationProprietaire> = { email: 'email', nom: 'identite', logementIds: 'logements' };
export const ecranDeLaCleInvitationProprietaire = (cle: string): EcranInvitationProprietaire => ECRAN_DE_LA_CLE[cle] ?? 'recapitulatif';

/** Logements cochés qui sont aujourd'hui à un autre propriétaire : dits avant d'inviter. */
export function transfertsInvitation(b: BrouillonInvitationProprietaire, ctx: ContexteInvitationProprietaire): Transfert[] {
  return transfertsProprietaire(ctx.logements, ctx.proprietaires, b.logementIds, proprietaireAvecEmail(ctx.proprietaires, b.email)?.id ?? '', ctx.aRenseigner);
}

/** La fiche sans l'ancien IBAN masqué (l'ERP ne le demande ni ne le garde plus). */
const sansIban = ({ ibanMasque: _ancien, ...p }: Proprietaire): Proprietaire => p;

/** Ce qu'enregistre « Inviter » : la fiche (reprise ou nouvelle), les logements qu'elle reçoit, puis l'invitation. */
export interface PlanInvitationProprietaire {
  proprietaire: Proprietaire;
  /** Logements cochés : ils passent à ce propriétaire (changerProprietaire, à la date du jour). */
  logementIds: Id[];
  /** Adresse invitée (et enregistrée sur la fiche). */
  email: string;
}

export type ResultatInvitationProprietaire = { ok: true; plan: PlanInvitationProprietaire } | { ok: false; ecran: EcranInvitationProprietaire; erreur: string };

export function invitationProprietaireDepuisBrouillon(
  b: BrouillonInvitationProprietaire,
  ctx: Pick<ContexteInvitationProprietaire, 'proprietaires'> & { nouvelId: () => Id; aujourdhui: DateISO },
): ResultatInvitationProprietaire {
  const erreurs = Object.entries(erreursInvitationProprietaire('recapitulatif', b, ctx));
  if (erreurs.length) return { ok: false, ecran: ecranDeLaCleInvitationProprietaire(erreurs[0][0]), erreur: erreurs[0][1] };
  const adresse = adresseInvitation(b.email);
  const existant = proprietaireAvecEmail(ctx.proprietaires, b.email);
  // Fiche existante reprise telle quelle, sans l'ancien IBAN (plus conservé).
  const proprietaire: Proprietaire = existant
    ? { ...sansIban(existant), nom: existant.nom || b.nom.trim(), contact: { email: adresse, telephone: existant.contact.telephone || b.telephone.trim() } }
    : { id: ctx.nouvelId(), type: 'particulier', nom: b.nom.trim(), contact: { email: adresse, telephone: b.telephone.trim() }, adresse: '', notes: '', creeLe: ctx.aujourdhui };
  return { ok: true, plan: { proprietaire, logementIds: [...b.logementIds], email: adresse } };
}

/** Lignes du récapitulatif. */
export function recapInvitationProprietaire(
  b: BrouillonInvitationProprietaire,
  ctx: Pick<ContexteInvitationProprietaire, 'proprietaires' | 'logements'>,
): { cle: string; ecran: Exclude<EcranInvitationProprietaire, 'recapitulatif'>; libelle: string; valeur: string }[] {
  const existant = proprietaireAvecEmail(ctx.proprietaires, b.email);
  const telephone = existant?.contact.telephone || b.telephone.trim();
  const ids = [...new Set([...(existant ? ctx.logements.filter((l) => l.proprietaireId === existant.id).map((l) => l.id) : []), ...b.logementIds])];
  const noms = ids.map((id) => ctx.logements.find((l) => l.id === id)?.nom).filter(Boolean);
  return [
    { cle: 'email', ecran: 'email', libelle: 'Adresse e‑mail', valeur: adresseInvitation(b.email) },
    { cle: 'nom', ecran: 'identite', libelle: 'Nom', valeur: existant ? `${existant.nom} (fiche reprise)` : b.nom.trim() },
    { cle: 'telephone', ecran: 'identite', libelle: 'Téléphone', valeur: telephone || 'Non renseigné' },
    { cle: 'logements', ecran: 'logements', libelle: 'Ses logements', valeur: noms.join(', ') || 'Aucun pour l’instant' },
  ];
}
