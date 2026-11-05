/**
 * Nouvelle annonce à l'équipe, pas à pas (Paramètres → Annonces à l'équipe,
 * modules/parametres/AssistantAnnonce.tsx) : le titre, le texte, prévenir
 * aussi par notification (seulement quand les notifications marchent sur le
 * serveur), puis le récapitulatif.
 *
 * Mêmes règles et même annonce qu'avant : tout passe par preparerAnnonce
 * (annonces-equipe.ts : titre de 60 caractères, texte de 500, espaces et
 * lignes vides en trop retirés) ; le premier message est prêt à publier tant
 * que l'espace n'a aucune annonce ; « Prévenir aussi » est coché d'office.
 * L'annonce est enregistrée d'abord, puis l'action « annoncer » part
 * (AnnoncesEquipe.tsx), comme avant.
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */
import { brouillonInitial, preparerAnnonce, type AnnonceEquipe, type SaisieAnnonce } from './annonces-equipe';
import type { Horodatage, Id } from './types';

export type EcranAnnonce = 'titre' | 'texte' | 'notification' | 'recapitulatif';

/** Écrans du parcours : « Prévenir aussi » seulement quand les notifications marchent. */
export const ecransAnnonce = (notificationsPossibles: boolean): EcranAnnonce[] =>
  notificationsPossibles ? ['titre', 'texte', 'notification', 'recapitulatif'] : ['titre', 'texte', 'recapitulatif'];

export interface BrouillonAnnonce extends SaisieAnnonce {
  /** Prévenir aussi par notification (coché d'office, comme la case d'avant). */
  notifier: boolean;
}

/** Départ : le premier message tant que l'espace n'a aucune annonce, sinon vide. */
export const brouillonAnnonce = (liste: readonly unknown[] | undefined, nomConciergerie: string): BrouillonAnnonce => ({ ...brouillonInitial(liste, nomConciergerie), notifier: true });

/** Le choix « Prévenir aussi » est dit au-dessus de « Continuer ». */
export const SANS_CHAMP_ANNONCE = new Set(['notifier']);

/** Erreurs d'un écran (celles de preparerAnnonce) ; le récapitulatif réunit les deux champs. */
export function erreursAnnonce(ecran: EcranAnnonce, b: BrouillonAnnonce): Record<string, string> {
  const r = preparerAnnonce(b, { id: 'aeq-brouillon', maintenant: '2026-01-01T00:00:00.000Z', par: '' });
  const e = r.ok ? {} : r.erreurs;
  const out: Record<string, string> = {};
  if ((ecran === 'titre' || ecran === 'recapitulatif') && e.titre) out.titre = e.titre;
  if ((ecran === 'texte' || ecran === 'recapitulatif') && e.texte) out.texte = e.texte;
  return out;
}

export const ecranDeLaCleAnnonce = (cle: string): EcranAnnonce => (cle === 'titre' || cle === 'texte' ? cle : 'recapitulatif');

export type ResultatAnnonce = { ok: true; annonce: AnnonceEquipe; notifier: boolean } | { ok: false; ecran: EcranAnnonce; erreur: string };

/**
 * Ce qu'enregistre « Publier » : l'annonce de preparerAnnonce, comme avant ;
 * `notifier` : l'action « annoncer » part ensuite (case cochée et
 * notifications possibles).
 */
export function annonceDepuisBrouillon(b: BrouillonAnnonce, o: { id: Id; maintenant: Horodatage; par: string; notificationsPossibles: boolean }): ResultatAnnonce {
  const r = preparerAnnonce({ titre: b.titre, texte: b.texte }, { id: o.id, maintenant: o.maintenant, par: o.par });
  if (!r.ok) {
    const [cle, erreur] = Object.entries(r.erreurs)[0] ?? ['recapitulatif', 'Annonce impossible à enregistrer.'];
    return { ok: false, ecran: ecranDeLaCleAnnonce(cle), erreur: erreur ?? '' };
  }
  return { ok: true, annonce: r.annonce, notifier: b.notifier && o.notificationsPossibles };
}

/** Lignes du récapitulatif. */
export function recapAnnonce(b: BrouillonAnnonce, notificationsPossibles: boolean): { cle: string; ecran: Exclude<EcranAnnonce, 'recapitulatif'>; libelle: string; valeur: string }[] {
  const r = preparerAnnonce(b, { id: 'aeq-brouillon', maintenant: '2026-01-01T00:00:00.000Z', par: '' });
  return [
    { cle: 'titre', ecran: 'titre', libelle: 'Titre', valeur: r.ok ? r.annonce.titre : b.titre.trim() },
    { cle: 'texte', ecran: 'texte', libelle: 'Texte', valeur: r.ok ? r.annonce.texte : b.texte.trim() },
    ...(notificationsPossibles
      ? [{ cle: 'notifier', ecran: 'notification' as const, libelle: 'Notification', valeur: b.notifier ? 'Oui, sur les appareils qui l’acceptent' : 'Non, l’Accueil seulement' }]
      : []),
  ];
}
