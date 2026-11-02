/**
 * Supprimer pour de bon une fiche propriétaire ou un membre de l'équipe de
 * terrain (gérant seulement, jamais en lecture seule), sur le modèle de la
 * suppression d'un logement (suppression-logement.ts) : règles pures, sans
 * réseau. L'écran les montre (proprietaires/_composants/SupprimerProprietaire.tsx,
 * parametres/SupprimerMembre.tsx), le store les applique (supprimerProprietaire,
 * supprimerMembre).
 *
 * Seulement une personne SANS HISTORIQUE : fiche créée par erreur, en double
 * ou pour un essai. Dès qu'elle a vécu dans l'ERP, la suppression est refusée
 * en disant ce qu'elle a (« 2 logements, 1 mandat et 3 bilans ») ; un membre
 * encore dans l'équipe peut en être retiré (actif: false : plus de logement à
 * suivre, l'historique reste). Un accès encore ouvert bloque à lui seul ;
 * sans historique, l'écran propose de le retirer puis de supprimer ; avec un
 * historique, il dit seulement où l'accès se gère (on ne coupe pas l'accès
 * d'une vraie personne depuis un refus).
 *
 * Propriétaire (historiqueDuProprietaire) :
 *   ses logements (« Ses logements se rattachent à un autre propriétaire depuis
 *   la fiche du logement ») ; les logements dont il a été le propriétaire
 *   (proprietairesPrecedents) ; ses mandats envoyés, signés ou résiliés ; les
 *   factures à son nom (tout statut : une facture ne se refait pas) ; ses
 *   bilans (brouillons compris : le gérant les prépare à la main) ; les
 *   documents partagés ; les dossiers qu'il a remplis ; les améliorations qui
 *   lui ont été proposées ; les actions de l'IA qui le visent. Un accès à son
 *   espace encore invité ou actif n'est pas un historique mais bloque aussi
 *   (motif « acces ») : « Retirez d'abord son accès ».
 *   Part avec lui (supprimerProprietaireDe) : son mandat en préparation
 *   (brouillon) ; son ancien accès (retiré : la ligne porte son adresse et n'a
 *   plus d'objet ; sa dernière version reste dans l'historique de la base,
 *   lisible par le gérant) ; les améliorations « à proposer » (jamais montrées).
 *
 * Membre de l'équipe (historiqueDuMembre) :
 *   les incidents qu'il a signalés ou qui lui ont été confiés ; les contrôles
 *   qualité qu'il a faits ; les absences (les siennes, celles qu'il a
 *   remplacées, celles qu'il a notées) ; ses « ce logement n'est pas à moi » ;
 *   les actions de l'IA qui le visent. Les ménages, missions et mouvements de
 *   linge sont ceux des prestataires (aucun champ n'y nomme un membre de
 *   l'équipe) : rien à compter. Un accès encore invité ou actif bloque
 *   (motif « acces »).
 *   Part avec lui (supprimerMembreDe) : sa place dans « qui suit quoi »
 *   (affectations : plus responsable ni remplaçant ; une affectation qui ne
 *   dit plus rien est retirée) ; ses logements (equipe[].logementIds : c'est
 *   sa fiche) ; son ancien accès (retiré).
 *
 * Droits : un gérant, hors lecture seule. La base refuse aussi ces
 * suppressions à tout autre compte (règle « ecritures reservees aux gerants
 * (suppression) » : supabase/erp-espaces.sql, erp-installation.sql,
 * erp-acces-gerants.sql ; SUPPRESSIONS_GERANT_SEULEMENT, ecritures-gerant.ts)
 * et, même au gérant, celle d'une personne qui a un historique ou un accès
 * encore ouvert (déclencheurs erp.garder_proprietaire_avec_historique() et
 * erp.garder_membre_avec_historique(), mêmes fichiers).
 *
 * Rien n'est écrit sur les plateformes ni chez le service de connexion.
 * Imports relatifs avec « .js » : ce module peut aussi tourner sous Node.
 */
import { resumeHistorique } from './suppression-logement.js';
import type { AccesExterne } from './acces-externe';
import type { ErpDonnees, Id } from './types';
import type { AccesOperations, AffectationLogement } from './types-operations';
import type { AccesProprietaire } from './types-proprietaire';

/** Données lues (toutes les collections de l'espace ouvert ; une absente compte pour vide). */
export type DonneesSuppression = Partial<ErpDonnees>;

export interface TracePersonne {
  cle: string;
  nombre: number;
  /** « 2 logements ». */
  libelle: string;
}

/** Supprimer une fiche propriétaire ou un membre : un gérant, hors lecture seule. */
export const peutSupprimerPersonne = (role: string | undefined, lectureSeule = false): boolean => role === 'gerant' && !lectureSeule;

/** Accès encore ouvert : invité ou actif (un accès retiré ne compte pas). */
export const accesOuvert = (a: Pick<AccesExterne, 'statut'> | undefined): boolean => a?.statut === 'invite' || a?.statut === 'actif';

/** « La fiche disparaît de l’ERP, avec X et Y. C’est définitif. » (jamais de pronom pour une personne). */
export const phraseConfirmation = (avecLui: readonly string[]): string => `La fiche disparaît de l’ERP${avecLui.length ? `, avec ${avecLui.join(' et ')}` : ''}. C’est définitif.`;

function traces<K extends string>(mots: Record<K, [string, string]>, nombres: Record<K, number>): TracePersonne[] {
  return (Object.keys(mots) as K[])
    .filter((cle) => nombres[cle] > 0)
    .map((cle) => ({ cle, nombre: nombres[cle], libelle: `${nombres[cle]} ${nombres[cle] >= 2 ? mots[cle][1] : mots[cle][0]}` }));
}

/** Action de l'IA qui vise une page : sa cible, ou son lien vers cette page (avec ou sans « ?… » / « #… »). */
const viseLaPage = (a: { cibleId?: unknown; lien?: unknown } | undefined, id: Id, page: string): boolean =>
  a?.cibleId === id || a?.lien === page || String(a?.lien ?? '').startsWith(`${page}?`) || String(a?.lien ?? '').startsWith(`${page}#`);

/* ============================================================ propriétaire */

export type CleHistoriqueProprietaire = 'logements' | 'anciensLogements' | 'mandats' | 'factures' | 'bilans' | 'documents' | 'dossiers' | 'ameliorations' | 'actionsIA';

const MOTS_PROPRIETAIRE: Record<CleHistoriqueProprietaire, [string, string]> = {
  logements: ['logement', 'logements'],
  anciensLogements: ['ancien logement', 'anciens logements'],
  mandats: ['mandat', 'mandats'],
  factures: ['facture', 'factures'],
  bilans: ['bilan', 'bilans'],
  documents: ['document partagé', 'documents partagés'],
  dossiers: ['dossier propriétaire', 'dossiers propriétaire'],
  ameliorations: ['amélioration proposée', 'améliorations proposées'],
  actionsIA: ['action de l’IA', 'actions de l’IA'],
};

/** Phrase ajoutée au refus tant qu'il a un logement (sans laisser croire que la suppression passera ensuite). */
export const PHRASE_LOGEMENTS_PROPRIETAIRE = 'Ses logements se rattachent à un autre propriétaire depuis la fiche du logement.';
/** Phrase ajoutée au refus quand son espace est encore ouvert : l'accès se gère dans la section Accès du panneau. */
export const PHRASE_ACCES_OUVERT_PROPRIETAIRE = 'Son espace propriétaire est encore ouvert : il se gère dans la section Accès.';

/** L'accès du propriétaire à son espace (une ligne par propriétaire, id = proprietaireId). */
export const accesDuProprietaire = (id: Id, d: DonneesSuppression): AccesProprietaire | undefined =>
  (d.accesProprietaires ?? []).find((a) => a?.id === id || a?.proprietaireId === id);

/** Ce que contient l'historique du propriétaire (seulement ce qui existe), dans l'ordre où on le dit. */
export function historiqueDuProprietaire(id: Id, d: DonneesSuppression): TracePersonne[] {
  const de = <T extends { proprietaireId?: unknown }>(liste: readonly T[] | undefined) => (liste ?? []).filter((x) => x?.proprietaireId === id);
  const nombres: Record<CleHistoriqueProprietaire, number> = {
    logements: de(d.logements).length,
    anciensLogements: (d.logements ?? []).filter((l) => l?.proprietaireId !== id && (l?.proprietairesPrecedents ?? []).some((p) => p?.proprietaireId === id)).length,
    mandats: de(d.mandats).filter((m) => m.statut !== 'brouillon').length,
    factures: de(d.factures).length,
    bilans: de(d.bilansProprietaire).length,
    documents: de(d.documentsProprietaire).length,
    dossiers: de(d.dossiers).length,
    ameliorations: de(d.recommandations).filter((r) => r.statut !== 'a_proposer').length,
    actionsIA: (d.actionsAgent ?? []).filter((a) => viseLaPage(a, id, `/erp/proprietaires/${encodeURIComponent(id)}`)).length,
  };
  return traces(MOTS_PROPRIETAIRE, nombres);
}

export type VerdictSuppressionProprietaire =
  | {
      ok: true;
      /** Ce qui part avec lui et que l'équipe voit ailleurs (dit dans la confirmation). */
      avecLui: string[];
    }
  | { ok: false; motif: 'droits' | 'introuvable' | 'acces'; message: string }
  | {
      ok: false;
      motif: 'historique';
      message: string;
      historique: TracePersonne[];
      /** Son espace est encore ouvert (invité ou actif) : dit dans le refus (il se gère dans la section Accès). */
      accesOuvert: boolean;
    };

/**
 * Peut-on supprimer ce propriétaire ? Dans l'ordre : droits, fiche présente,
 * historique (dit même si son accès est ouvert), accès encore ouvert.
 */
export function verdictSuppressionProprietaire(o: { role: string | undefined; lectureSeule?: boolean; proprietaireId: Id; donnees: DonneesSuppression }): VerdictSuppressionProprietaire {
  if (!peutSupprimerPersonne(o.role, o.lectureSeule)) return { ok: false, motif: 'droits', message: 'Seul un gérant peut supprimer un propriétaire.' };
  const p = (o.donnees.proprietaires ?? []).find((x) => x?.id === o.proprietaireId);
  if (!p) return { ok: false, motif: 'introuvable', message: 'Propriétaire introuvable (supprimé entre-temps ?).' };
  const acces = accesDuProprietaire(p.id, o.donnees);
  const historique = historiqueDuProprietaire(p.id, o.donnees);
  if (historique.length) {
    const logements = historique.some((t) => t.cle === 'logements');
    const ouvert = accesOuvert(acces);
    return {
      ok: false,
      motif: 'historique',
      historique,
      accesOuvert: ouvert,
      message: `La fiche de « ${p.nom} » a ${resumeHistorique(historique)} : elle ne peut pas être supprimée.${logements ? ` ${PHRASE_LOGEMENTS_PROPRIETAIRE}` : ''}${ouvert ? ` ${PHRASE_ACCES_OUVERT_PROPRIETAIRE}` : ''}`,
    };
  }
  if (accesOuvert(acces)) {
    return { ok: false, motif: 'acces', message: `« ${p.nom} » a encore un accès à son espace : retirez-le d’abord, puis supprimez la fiche.` };
  }
  const brouillons = (o.donnees.mandats ?? []).filter((m) => m?.proprietaireId === p.id && m.statut === 'brouillon').length;
  const avecLui: string[] = [];
  if (brouillons) avecLui.push(brouillons > 1 ? 'ses mandats en préparation' : 'son mandat en préparation');
  if (acces) avecLui.push('son ancien accès');
  return { ok: true, avecLui };
}

/* ================================================================= membre */

export type CleHistoriqueMembre = 'incidents' | 'controles' | 'absences' | 'signalements' | 'actionsIA';

const MOTS_MEMBRE: Record<CleHistoriqueMembre, [string, string]> = {
  incidents: ['incident', 'incidents'],
  controles: ['contrôle qualité', 'contrôles qualité'],
  absences: ['absence', 'absences'],
  signalements: ['signalement « pas à moi »', 'signalements « pas à moi »'],
  actionsIA: ['action de l’IA', 'actions de l’IA'],
};

/** L'accès du membre à l'espace opérations (une ligne par membre, id = membreId). */
export const accesDuMembre = (id: Id, d: DonneesSuppression): AccesOperations | undefined => (d.accesOperations ?? []).find((a) => a?.id === id || a?.membreId === id);

/** Ce que contient l'historique du membre (seulement ce qui existe), dans l'ordre où on le dit. */
export function historiqueDuMembre(id: Id, d: DonneesSuppression): TracePersonne[] {
  const nombres: Record<CleHistoriqueMembre, number> = {
    incidents: (d.incidents ?? []).filter((i) => i?.assigneA === id || i?.signalePar === id).length,
    controles: (d.controles ?? []).filter((c) => c?.parId === id).length,
    absences: (d.absences ?? []).filter((a) => a?.membreId === id || a?.remplacantId === id || a?.parMembreId === id).length,
    signalements: (d.signalementsLogement ?? []).filter((s) => s?.membreId === id).length,
    actionsIA: (d.actionsAgent ?? []).filter((a) => viseLaPage(a, id, `/erp/parametres/acces?personne=${encodeURIComponent(id)}`)).length,
  };
  return traces(MOTS_MEMBRE, nombres);
}

export type VerdictSuppressionMembre =
  | { ok: true; avecLui: string[] }
  | { ok: false; motif: 'droits' | 'introuvable' | 'acces'; message: string }
  | {
      ok: false;
      motif: 'historique';
      message: string;
      historique: TracePersonne[];
      /** Encore dans l'équipe (actif) : l'écran propose « Retirer de l'équipe » (sauf accès encore ouvert). */
      dansLEquipe: boolean;
      /** Son accès est encore ouvert (invité ou actif) : dit dans le refus (il se gère dans le tiroir). */
      accesOuvert: boolean;
    };

/** Suite proposée quand un membre a un historique (jamais de pronom « il » pour une personne). */
export const PHRASE_RETIRER_DE_LEQUIPE = 'Retirez cette personne de l’équipe : elle n’a plus de logement à suivre, son historique reste.';
export const PHRASE_DEJA_HORS_EQUIPE = 'Cette personne est déjà hors de l’équipe : son historique reste.';
export const PHRASE_ACCES_OUVERT_MEMBRE = 'Son accès est encore ouvert : il se gère dans ce panneau.';

/**
 * Peut-on supprimer ce membre ? Dans l'ordre : droits, fiche présente,
 * historique (dit même si son accès est ouvert), accès encore ouvert.
 */
export function verdictSuppressionMembre(o: { role: string | undefined; lectureSeule?: boolean; membreId: Id; donnees: DonneesSuppression }): VerdictSuppressionMembre {
  if (!peutSupprimerPersonne(o.role, o.lectureSeule)) return { ok: false, motif: 'droits', message: 'Seul un gérant peut supprimer un membre de l’équipe.' };
  const m = (o.donnees.equipe ?? []).find((x) => x?.id === o.membreId);
  if (!m) return { ok: false, motif: 'introuvable', message: 'Membre introuvable (supprimé entre-temps ?).' };
  const acces = accesDuMembre(m.id, o.donnees);
  const historique = historiqueDuMembre(m.id, o.donnees);
  if (historique.length) {
    const ouvert = accesOuvert(acces);
    return {
      ok: false,
      motif: 'historique',
      historique,
      dansLEquipe: !!m.actif,
      accesOuvert: ouvert,
      message: `La fiche de « ${m.nom} » a ${resumeHistorique(historique)} : elle ne peut pas être supprimée. ${ouvert ? PHRASE_ACCES_OUVERT_MEMBRE : m.actif ? PHRASE_RETIRER_DE_LEQUIPE : PHRASE_DEJA_HORS_EQUIPE}`,
    };
  }
  if (accesOuvert(acces)) {
    return { ok: false, motif: 'acces', message: `« ${m.nom} » a encore un accès à l’espace opérations : retirez-le d’abord, puis supprimez la fiche.` };
  }
  return { ok: true, avecLui: acces ? ['son ancien accès'] : [] };
}

/* ------------------------------------------------------------ nettoyage */

/** Filtre une collection ; la liste d'origine (même objet) si rien ne change. */
function filtrer<D extends DonneesSuppression>(d: D, suivant: DonneesSuppression, cle: keyof ErpDonnees, garder: (e: never) => boolean): void {
  const liste = d[cle] as unknown[] | undefined;
  if (!Array.isArray(liste)) return;
  const reste = liste.filter((e) => garder(e as never));
  if (reste.length !== liste.length) (suivant as Record<string, unknown>)[cle] = reste;
}

/**
 * Le jeu de données sans le propriétaire, et sans ce qui n'appartient qu'à
 * lui (voir l'en-tête). Ne touche à rien qui fait un historique.
 */
export function supprimerProprietaireDe<D extends DonneesSuppression>(d: D, id: Id): D {
  const suivant: DonneesSuppression = { ...d };
  filtrer(d, suivant, 'proprietaires', (p: { id?: Id }) => p?.id !== id);
  filtrer(d, suivant, 'mandats', (m: { proprietaireId?: Id; statut?: string }) => !(m?.proprietaireId === id && m.statut === 'brouillon'));
  filtrer(d, suivant, 'recommandations', (r: { proprietaireId?: Id; statut?: string }) => !(r?.proprietaireId === id && r.statut === 'a_proposer'));
  // Seul un accès retiré part (ouvert, le verdict l'aurait refusé ; la base aussi).
  filtrer(d, suivant, 'accesProprietaires', (a: AccesProprietaire) => !((a?.id === id || a?.proprietaireId === id) && a.statut === 'retire'));
  return suivant as D;
}

/**
 * Le jeu de données sans le membre, et sans ce qui n'appartient qu'à lui :
 * sa fiche (et ses logements avec), sa place dans « qui suit quoi », son
 * ancien accès. Ne touche à rien qui fait un historique.
 */
export function supprimerMembreDe<D extends DonneesSuppression>(d: D, id: Id): D {
  const suivant: DonneesSuppression = { ...d };
  filtrer(d, suivant, 'equipe', (m: { id?: Id }) => m?.id !== id);
  filtrer(d, suivant, 'accesOperations', (a: AccesOperations) => !((a?.id === id || a?.membreId === id) && a.statut === 'retire'));
  if (Array.isArray(d.affectations)) {
    let change = false;
    const affectations = d.affectations.flatMap((a): AffectationLogement[] => {
      if (a?.responsableId !== id && a?.remplacantId !== id) return [a];
      change = true;
      const { responsableId, remplacantId, ...reste } = a;
      const sans: AffectationLogement = {
        ...reste,
        ...(responsableId && responsableId !== id ? { responsableId } : {}),
        ...(remplacantId && remplacantId !== id ? { remplacantId } : {}),
      };
      // Plus personne et aucun point de contrôle propre au logement : l'affectation ne dit plus rien.
      return sans.responsableId || sans.remplacantId || sans.pointsControle?.length ? [sans] : [];
    });
    if (change) suivant.affectations = affectations;
  }
  return suivant as D;
}
