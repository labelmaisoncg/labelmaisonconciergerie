/**
 * Ajouter un responsable à un logement, pas à pas (fiche logement, carte
 * « Responsables opérationnels », modules/logements/_composants/ResponsablesLogement.tsx) :
 *
 * - une personne déjà dans l'équipe : on la choisit, puis on la rattache ;
 * - une nouvelle personne : son e-mail (une fiche avec la même adresse est
 *   reprise), son nom et son rôle, ses logements (celui de la fiche coché
 *   d'office), puis on l'invite.
 *
 * Mêmes règles que l'ancienne fenêtre « Ajouter un responsable » et que
 * « Inviter un responsable » (Paramètres → Accès), mêmes écritures :
 * rattacher (affectationsAFiger, logementIds), inviter (inviterResponsable).
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */
import { ROLES_OPERATIONS } from './operations';
import type { Id, Logement } from './types';
import type { MembreEquipe, RoleOperations } from './types-operations';

/** Adresse e-mail d'un responsable invité (même règle que Paramètres → Accès). */
export const EMAIL_RESPONSABLE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Choix « une nouvelle personne » dans la liste de l'équipe. */
export const NOUVELLE_PERSONNE = '__nouvelle__';

export type EcranResponsable = 'qui' | 'email' | 'identite' | 'logements' | 'recapitulatif';

/** Écrans du parcours : la suite dépend de la personne choisie. */
export function ecransResponsable(choix: string): EcranResponsable[] {
  return choix === NOUVELLE_PERSONNE ? ['qui', 'email', 'identite', 'logements', 'recapitulatif'] : ['qui', 'recapitulatif'];
}

export interface BrouillonResponsable {
  /** Identifiant d'une personne de l'équipe, NOUVELLE_PERSONNE, ou vide tant que rien n'est choisi. */
  choix: string;
  email: string;
  nom: string;
  telephone: string;
  /** Rôle choisi ; absent : celui de la fiche reprise, sinon agent de terrain. */
  role?: RoleOperations;
  logementIds: Id[];
}

/** Départ : personne n'est choisie, ou « une nouvelle personne » quand toute l'équipe suit déjà ce logement. */
export function brouillonResponsable(logementId: Id, libres: readonly Pick<MembreEquipe, 'id'>[]): BrouillonResponsable {
  return { choix: libres.length ? '' : NOUVELLE_PERSONNE, email: '', nom: '', telephone: '', logementIds: [logementId] };
}

/** Personnes actives de l'équipe qui ne suivent pas encore le logement, par nom. */
export function personnesLibres(equipe: readonly MembreEquipe[], logementId: Id): MembreEquipe[] {
  return equipe.filter((m) => m.actif && !m.logementIds.includes(logementId)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/** Fiche de l'équipe qui a déjà cette adresse (elle sera reprise). */
export function ficheAvecEmail(equipe: readonly MembreEquipe[], email: string): MembreEquipe | undefined {
  const adresse = email.trim().toLowerCase();
  return adresse ? equipe.find((m) => (m.email ?? '').trim().toLowerCase() === adresse) : undefined;
}

/** Rôle retenu : celui choisi, sinon celui de la fiche reprise, sinon agent de terrain. */
export const roleRetenu = (b: Pick<BrouillonResponsable, 'role' | 'email'>, equipe: readonly MembreEquipe[]): RoleOperations =>
  b.role ?? ficheAvecEmail(equipe, b.email)?.role ?? 'agent';

export interface ContexteResponsable {
  equipe: readonly MembreEquipe[];
  libres: readonly Pick<MembreEquipe, 'id'>[];
}

/** Choix et cases : dits au-dessus de « Continuer ». */
export const SANS_CHAMP_RESPONSABLE = new Set(['choix', 'logementIds']);

/** Erreurs d'un écran ; le récapitulatif réunit celles des écrans du parcours. */
export function erreursResponsable(ecran: EcranResponsable, b: BrouillonResponsable, ctx: ContexteResponsable): Record<string, string> {
  if (ecran === 'recapitulatif') {
    return Object.assign({}, ...ecransResponsable(b.choix).filter((e) => e !== 'recapitulatif').map((e) => erreursResponsable(e, b, ctx)));
  }
  const r: Record<string, string> = {};
  const existant = ficheAvecEmail(ctx.equipe, b.email);
  if (ecran === 'qui' && b.choix !== NOUVELLE_PERSONNE && !ctx.libres.some((m) => m.id === b.choix)) r.choix = 'Choisissez une personne.';
  if (ecran === 'email') {
    if (!b.email.trim()) r.email = 'Indiquez son adresse e-mail.';
    else if (!EMAIL_RESPONSABLE.test(b.email.trim().toLowerCase())) r.email = 'Adresse e-mail invalide.';
  }
  if (ecran === 'identite' && !existant && b.nom.trim().length < 2) r.nom = 'Indiquez le nom.';
  if (ecran === 'logements' && !b.logementIds.length && !existant?.logementIds.length) r.logementIds = 'Cochez au moins un logement.';
  return r;
}

const ECRAN_DE_LA_CLE: Record<string, EcranResponsable> = { choix: 'qui', email: 'email', nom: 'identite', logementIds: 'logements' };
export const ecranDeLaCleResponsable = (cle: string): EcranResponsable => ECRAN_DE_LA_CLE[cle] ?? 'recapitulatif';

/** Lignes du récapitulatif. */
export function recapResponsable(
  b: BrouillonResponsable,
  o: { equipe: readonly MembreEquipe[]; logements: readonly Pick<Logement, 'id' | 'nom'>[] },
): { cle: string; ecran: Exclude<EcranResponsable, 'recapitulatif'>; libelle: string; valeur: string }[] {
  if (b.choix !== NOUVELLE_PERSONNE) {
    const m = o.equipe.find((x) => x.id === b.choix);
    return [{ cle: 'qui', ecran: 'qui', libelle: 'Personne', valeur: m ? `${m.nom} · ${ROLES_OPERATIONS[m.role]}` : '' }];
  }
  const existant = ficheAvecEmail(o.equipe, b.email);
  const telephone = existant?.telephone ?? b.telephone.trim();
  const suivis = [...new Set([...(existant?.logementIds ?? []), ...b.logementIds])];
  const noms = suivis.map((id) => o.logements.find((l) => l.id === id)?.nom).filter(Boolean);
  return [
    { cle: 'qui', ecran: 'qui', libelle: 'Personne', valeur: 'Nouvelle personne, à inviter' },
    { cle: 'email', ecran: 'email', libelle: 'Adresse e-mail', valeur: b.email.trim().toLowerCase() },
    { cle: 'nom', ecran: 'identite', libelle: 'Nom', valeur: existant ? `${existant.nom} (fiche reprise)` : b.nom.trim() },
    { cle: 'role', ecran: 'identite', libelle: 'Rôle', valeur: ROLES_OPERATIONS[roleRetenu(b, o.equipe)] },
    { cle: 'telephone', ecran: 'identite', libelle: 'Téléphone', valeur: telephone || 'Non renseigné' },
    { cle: 'logements', ecran: 'logements', libelle: 'Ses logements', valeur: noms.join(', ') },
  ];
}
