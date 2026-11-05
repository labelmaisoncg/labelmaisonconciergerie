/**
 * Espace opérations : « Signaler un incident », pas à pas
 * (espace-operations/Signaler.tsx) : le logement, urgent ou non, ce qui se
 * passe, des photos (facultatif), le séjour concerné (s'il y en a un dans la
 * fenêtre de l'espace), puis le récapitulatif.
 *
 * Mêmes règles et même action qu'avant : un logement de la personne, au
 * moins 10 caractères ; l'action envoyée reste { type: 'signaler',
 * logementId, urgent, description, photos, reservationId? } (le serveur la
 * revérifie, espace-operations.ts, appliquerAction). Changer de logement
 * oublie le séjour choisi.
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */
import type { ActionOperations } from './espace-operations';
import type { Id } from './types';
import type { SejourOps } from './types-operations';

export type EcranSignalement = 'logement' | 'priorite' | 'description' | 'photos' | 'sejour' | 'recapitulatif';

/** Écrans du parcours : « Quel séjour » seulement quand le logement en a un dans la fenêtre de l'espace. */
export const ecransSignalement = (avecSejours: boolean): EcranSignalement[] =>
  avecSejours ? ['logement', 'priorite', 'description', 'photos', 'sejour', 'recapitulatif'] : ['logement', 'priorite', 'description', 'photos', 'recapitulatif'];

export interface BrouillonSignalement<P extends { url: string } = { url: string }> {
  logementId: Id;
  urgent: boolean;
  description: string;
  photos: P[];
  /** Séjour concerné ; vide : aucun. */
  sejour: Id;
}

/** Départ : le logement d'où l'on vient (fiche du logement), sinon à choisir ; normal, sans photo ni séjour. */
export const brouillonSignalement = <P extends { url: string }>(logementId?: Id): BrouillonSignalement<P> => ({ logementId: logementId ?? '', urgent: false, description: '', photos: [], sejour: '' });

/** Les choix (logement, priorité, séjour) sont dits au-dessus de « Continuer ». */
export const SANS_CHAMP_SIGNALEMENT = new Set(['logementId', 'urgent', 'sejour']);

/** Séjours du logement dans la fenêtre de l'espace (en cours, tout juste partis, à venir). */
export const sejoursDuLogement = <S extends Pick<SejourOps, 'logementId'>>(sejours: readonly S[], logementId: Id): S[] => sejours.filter((s) => s.logementId === logementId);

/** Erreurs d'un écran ; le récapitulatif réunit celles de tous les écrans. */
export function erreursSignalement(ecran: EcranSignalement, b: BrouillonSignalement): Record<string, string> {
  const r: Record<string, string> = {};
  const tous = ecran === 'recapitulatif';
  if ((tous || ecran === 'logement') && !b.logementId) r.logementId = 'Choisissez le logement.';
  if (tous || ecran === 'description') {
    if (!b.description.trim()) r.description = 'Décrivez ce qui se passe.';
    else if (b.description.trim().length < 10) r.description = 'Décrivez ce qui se passe (10\u00a0caractères au moins).';
  }
  return r;
}

const ECRAN_DE_LA_CLE: Record<string, EcranSignalement> = { logementId: 'logement', description: 'description' };
export const ecranDeLaCleSignalement = (cle: string): EcranSignalement => ECRAN_DE_LA_CLE[cle] ?? 'recapitulatif';

export type ResultatSignalement = { ok: true; action: Extract<ActionOperations, { type: 'signaler' }> } | { ok: false; ecran: EcranSignalement; erreur: string };

/** Ce qu'envoie « Signaler » : la même action que l'ancienne fenêtre. */
export function signalementDepuisBrouillon(b: BrouillonSignalement): ResultatSignalement {
  const erreurs = Object.entries(erreursSignalement('recapitulatif', b));
  if (erreurs.length) return { ok: false, ecran: ecranDeLaCleSignalement(erreurs[0][0]), erreur: erreurs[0][1] };
  return {
    ok: true,
    action: { type: 'signaler', logementId: b.logementId, urgent: b.urgent, description: b.description.trim(), photos: b.photos.map((p) => p.url), ...(b.sejour ? { reservationId: b.sejour } : {}) },
  };
}

/** Lignes du récapitulatif ; `libelleSejour` : « Clara D., du 3 au 6 nov. ». */
export function recapSignalement(
  b: BrouillonSignalement,
  o: { logements: readonly { id: Id; nom: string }[]; libelleSejour: (id: Id) => string | undefined; avecSejours: boolean },
): { cle: string; ecran: Exclude<EcranSignalement, 'recapitulatif'>; libelle: string; valeur: string }[] {
  const n = b.photos.length;
  return [
    { cle: 'logement', ecran: 'logement', libelle: 'Logement', valeur: o.logements.find((l) => l.id === b.logementId)?.nom ?? '' },
    { cle: 'priorite', ecran: 'priorite', libelle: 'Priorité', valeur: b.urgent ? 'Urgent' : 'Normal' },
    { cle: 'description', ecran: 'description', libelle: 'Ce qui se passe', valeur: b.description.trim().length >= 10 ? b.description.trim() : '' },
    { cle: 'photos', ecran: 'photos', libelle: 'Photos', valeur: n ? (n > 1 ? `${n}\u00a0photos` : '1\u00a0photo') : 'Aucune' },
    ...(o.avecSejours ? [{ cle: 'sejour', ecran: 'sejour' as const, libelle: 'Séjour concerné', valeur: (b.sejour && o.libelleSejour(b.sejour)) || 'Aucun' }] : []),
  ];
}
