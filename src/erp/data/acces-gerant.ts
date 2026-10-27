/**
 * Règles des écrans du gérant pour les accès externes (Paramètres → Accès,
 * fiche logement) : état d'un accès face à la fiche, logements repris à un
 * autre propriétaire, fiche d'un responsable réinvité, logements qui
 * resteraient sans personne. Pur : testé par verifier-operations.ts.
 */
import { accesToujoursDeLaFiche, type AccesExterne } from './acces-externe';
import { dateCourte } from './format';
import type { Suivi } from './operations';
import type { Id, Logement, Mandat, Proprietaire } from './types';
import type { MembreEquipe, RoleOperations } from './types-operations';

export type TonAcces = 'neutre' | 'succes' | 'alerte';

/**
 * État d'un accès en une ligne. `ficheEmail` : adresse actuelle de la fiche
 * (propriétaire, membre de l'équipe) ; si elle a changé depuis l'invitation,
 * l'ancienne adresse n'a plus accès et il faut réinviter la nouvelle.
 */
export function statutAccesExterne(a: (AccesExterne & { inviteLe: string; retireLe?: string }) | undefined, ficheEmail: string | undefined): { texte: string; ton: TonAcces } {
  if (!a) return { texte: 'Pas encore invité', ton: 'neutre' };
  if (a.statut === 'retire') return { texte: `Accès retiré${a.retireLe ? ` le ${dateCourte(a.retireLe.slice(0, 10))}` : ''}`, ton: 'neutre' };
  if (!accesToujoursDeLaFiche(a, { email: ficheEmail ?? '' })) return { texte: 'Adresse changée : réinvitez', ton: 'alerte' };
  if (a.statut === 'actif') return { texte: `Connecté${a.derniereConnexion ? ` le ${dateCourte(a.derniereConnexion.slice(0, 10))}` : ''}`, ton: 'succes' };
  return { texte: `Invité le ${dateCourte(a.inviteLe.slice(0, 10))}`, ton: 'alerte' };
}

/** Un logement coché qui changerait de propriétaire. */
export interface Transfert {
  logementId: Id;
  logement: string;
  ancienId: Id;
  ancien: string;
}

/**
 * Logements cochés qui appartiennent aujourd'hui à un autre propriétaire
 * (pas « à renseigner ») : à confirmer avant de les attribuer.
 */
export function transfertsProprietaire(
  logements: readonly Pick<Logement, 'id' | 'nom' | 'proprietaireId'>[],
  proprietaires: readonly Pick<Proprietaire, 'id' | 'nom'>[],
  coches: readonly Id[],
  nouveauId: Id,
  aRenseigner: Id,
): Transfert[] {
  return coches
    .map((id) => logements.find((l) => l.id === id))
    .filter((l): l is Pick<Logement, 'id' | 'nom' | 'proprietaireId'> => !!l && !!l.proprietaireId && l.proprietaireId !== nouveauId && l.proprietaireId !== aRenseigner)
    .map((l) => ({ logementId: l.id, logement: l.nom, ancienId: l.proprietaireId, ancien: proprietaires.find((p) => p.id === l.proprietaireId)?.nom ?? 'Un autre propriétaire' }));
}

const liste = (noms: string[]) => (noms.length < 2 ? noms.join('') : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`);

/** Une phrase par ancien propriétaire : « Thomas Nguyen ne verra plus Juvisy Gare. » */
export function phrasesTransferts(transferts: readonly Transfert[]): string[] {
  const parAncien = new Map<Id, Transfert[]>();
  for (const t of transferts) parAncien.set(t.ancienId, [...(parAncien.get(t.ancienId) ?? []), t]);
  return [...parAncien.values()].map((ts) => `${ts[0].ancien} ne verra plus ${liste(ts.map((t) => t.logement))}.`);
}

/**
 * Fiche d'un responsable invité. Une fiche avec la même adresse est reprise :
 * son nom et son rôle restent (sauf rôle choisi explicitement), ses logements
 * s'ajoutent, elle revient dans l'équipe.
 */
export function ficheResponsableInvite(
  equipe: readonly MembreEquipe[],
  saisie: { nom: string; email: string; telephone?: string; role?: RoleOperations; logementIds: readonly Id[] },
  nouvelId: () => Id,
): { membre: MembreEquipe; reprise: boolean } {
  const email = saisie.email.trim().toLowerCase();
  const telephone = saisie.telephone?.trim();
  const existant = equipe.find((m) => (m.email ?? '').trim().toLowerCase() === email);
  if (existant) {
    return {
      reprise: true,
      membre: {
        ...existant,
        actif: true,
        role: saisie.role ?? existant.role,
        logementIds: [...new Set([...existant.logementIds, ...saisie.logementIds])],
        ...(telephone && !existant.telephone ? { telephone } : {}),
      },
    };
  }
  return {
    reprise: false,
    membre: { id: nouvelId(), nom: saisie.nom.trim(), role: saisie.role ?? 'agent', email, ...(telephone ? { telephone } : {}), logementIds: [...saisie.logementIds], actif: true },
  };
}

/**
 * Ce que dit la fiche quand le titulaire est absent : « en absence · Inès Morel
 * prend le relais », ou « en absence · personne ne prend le relais » (neutre,
 * quel que soit le genre). Rien s'il est là.
 */
export function phraseRemplacement(suivi: Suivi, nom: (id?: Id) => string | undefined): string | undefined {
  if (!suivi.remplace) return undefined;
  const qui = suivi.membreId ? nom(suivi.membreId) : undefined;
  return qui ? `en absence · ${qui} prend le relais` : 'en absence · personne ne prend le relais';
}

/** Mandat du logement avec son propriétaire actuel (le plus récent) ; un mandat d'un ancien propriétaire ne compte pas. */
export function mandatDuProprietaire(mandats: readonly Mandat[], logementId: Id, proprietaireId: Id | undefined): Mandat | undefined {
  return mandats
    .filter((m) => m.logementId === logementId && !!proprietaireId && m.proprietaireId === proprietaireId)
    .sort((a, b) => (b.signeLe ?? b.dateDebut).localeCompare(a.signeLe ?? a.dateDebut))[0];
}

/** Logements que plus personne ne suivrait si cette personne les quittait (pour prévenir le gérant). */
export function logementsSansPersonne(equipe: readonly MembreEquipe[], membreId: Id, logementIds: readonly Id[]): Id[] {
  return logementIds.filter((l) => !equipe.some((m) => m.id !== membreId && m.actif && m.logementIds.includes(l)));
}
