/**
 * Supprimer un logement pour de bon (fiche du logement, repli
 * « Administratif »). Règles pures, sans réseau : l'écran les montre, le
 * store (supprimerLogement) les applique.
 *
 * Seulement un logement SANS HISTORIQUE : créé par erreur, en double d'un
 * logement importé, ou pour un essai. Dès qu'il a vécu, la suppression est
 * refusée en disant ce qu'il contient (« 12 réservations, 3 factures… »),
 * et l'écran propose « Passer en Sorti » (statut existant : il quitte les
 * listes, rien n'est perdu ; les factures se gardent 10 ans).
 *
 * Ce qui fait un historique (historiqueDuLogement), tout statut compris :
 *   réservations (avis des voyageurs, check-ins en ligne et leurs fiches de
 *   police n'existent qu'avec elles), conversations, factures mensuelles
 *   numérotées qui le nomment, bilans publiés, documents partagés au
 *   propriétaire, mandats envoyés, signés ou résiliés, dossier rempli par le
 *   propriétaire, ménages et autres missions (paiements des prestataires :
 *   par leurs missions), mouvements de linge, incidents, contrôles qualité,
 *   charges, avis à déposer, messages automatiques, améliorations proposées
 *   au propriétaire, textes d'annonce validés ou publiés, prix conseillés
 *   traités, actions de l'IA sur ce logement.
 *
 * Droits : un gérant, jamais en lecture seule. La base refuse aussi la
 * suppression d'un logement à tout autre compte (règle « ecritures reservees
 * aux gerants (suppression) » : supabase/erp-espaces.sql, erp-installation.sql,
 * erp-acces-gerants.sql ; SUPPRESSIONS_GERANT_SEULEMENT, ecritures-gerant.ts).
 *
 * Annonce encore suivie (logement relié à son annonce ou importé, pas
 * décoché dans Connexions) : refusé. Le passage suivant de la
 * synchronisation le recréerait (repull-synchro.ts : une annonce choisie
 * sans logement devient « repull-<annonce> »). Le gérant décoche l'annonce
 * dans Connexions (le logement passe « En pause », repull.horsSelection),
 * puis supprime : plus rien ne le recrée. Rien n'est écrit sur les
 * plateformes ni chez le service de connexion depuis ici.
 *
 * Nettoyage (supprimerLogementDe) : ce qui n'appartient qu'au logement et
 * n'a pas valeur d'historique part avec lui, dans la même action :
 *   - la fiche elle-même (infos pour l'agent, guides, questions, position
 *     sur la carte, photos, prix lus…) ;
 *   - qui le suit (affectations/<id>) et sa place dans la liste de chaque
 *     membre de l'équipe de terrain (equipe[].logementIds) ;
 *   - ses réglages dans ceux de l'espace : suppléments (reglages/supplements),
 *     textes propres des messages automatiques (reglages/messages-programmes),
 *     plancher et plafond des prix conseillés (conseilsPrix/reglages) ;
 *   - ce que l'ERP a préparé et que personne n'a utilisé : améliorations
 *     « à proposer », textes d'annonce proposés ou rejetés, mandat en
 *     préparation (brouillon) ;
 *   - les « ce logement n'est pas à moi » de l'équipe (il n'existe plus).
 * Laissés tels quels, sans gêne : le journal (« Suppression » y est ajouté),
 * le propriétaire, les fichiers déposés (photos, guides) dans l'espace
 * privé, auxquels renvoie la dernière version du logement gardée dans
 * l'historique de la base.
 *
 * Imports relatifs avec « .js » : ce module peut aussi tourner sous Node.
 */
import { ID_REGLAGES_PROGRAMMES } from './messages-programmes.js';
import { ID_REGLAGES_SUPPLEMENTS } from './supplements.js';
import { PREFIXE_REPULL } from './repull.js';
import type { ElementPrix, ReglagesPrix } from './prix-conseils';
import type { ReglagesSupplements } from './supplements';
import type { ReglagesMessagesProgrammes } from './types-programmes';
import type { ErpDonnees, Id, Logement, Reglage } from './types';

/** Ce qui fait l'historique d'un logement, dans l'ordre où on le dit. */
export type CleHistorique =
  | 'reservations'
  | 'conversations'
  | 'factures'
  | 'bilans'
  | 'documents'
  | 'mandats'
  | 'dossiers'
  | 'menages'
  | 'missions'
  | 'linge'
  | 'incidents'
  | 'controles'
  | 'charges'
  | 'avis'
  | 'messagesAuto'
  | 'ameliorations'
  | 'textesAnnonce'
  | 'prix'
  | 'actionsIA';

const MOTS: Record<CleHistorique, [string, string]> = {
  reservations: ['réservation', 'réservations'],
  conversations: ['conversation', 'conversations'],
  factures: ['facture', 'factures'],
  bilans: ['bilan publié', 'bilans publiés'],
  documents: ['document partagé', 'documents partagés'],
  mandats: ['mandat', 'mandats'],
  dossiers: ['dossier propriétaire', 'dossiers propriétaire'],
  menages: ['ménage', 'ménages'],
  missions: ['mission', 'missions'],
  linge: ['mouvement de linge', 'mouvements de linge'],
  incidents: ['incident', 'incidents'],
  controles: ['contrôle qualité', 'contrôles qualité'],
  charges: ['charge', 'charges'],
  avis: ['avis à déposer', 'avis à déposer'],
  messagesAuto: ['message automatique', 'messages automatiques'],
  ameliorations: ['amélioration proposée', 'améliorations proposées'],
  textesAnnonce: ['texte d’annonce validé', 'textes d’annonce validés'],
  prix: ['prix conseillé traité', 'prix conseillés traités'],
  actionsIA: ['action de l’IA', 'actions de l’IA'],
};

export interface TraceHistorique {
  cle: CleHistorique;
  nombre: number;
  /** « 12 réservations ». */
  libelle: string;
}

/** Données lues (toutes les collections de l'espace ouvert ; une absente compte pour vide). */
export type DonneesSuppression = Partial<ErpDonnees>;

/** Nom comparable : sans casse, accents ni blancs en trop. */
const nomComparable = (v: unknown): string =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Supprimer un logement : un gérant, hors lecture seule. */
export const peutSupprimerLogement = (role: string | undefined, lectureSeule = false): boolean => role === 'gerant' && !lectureSeule;

/**
 * Son annonce est-elle encore suivie ? Relié à une annonce (ou importé,
 * « repull-… ») et pas décoché dans Connexions : le prochain import le
 * recréerait s'il disparaissait.
 */
export const annonceSuivie = (l: Pick<Logement, 'id' | 'repull'>): boolean => (!!l.repull?.id || l.id.startsWith(PREFIXE_REPULL)) && !l.repull?.horsSelection;

/** Ce que contient l'historique du logement (seulement ce qui existe), dans l'ordre où on le dit. */
export function historiqueDuLogement(l: Pick<Logement, 'id' | 'nom' | 'proprietaireId' | 'proprietairesPrecedents'>, d: DonneesSuppression): TraceHistorique[] {
  const id = l.id;
  const de = <T extends { logementId?: unknown }>(liste: readonly T[] | undefined) => (liste ?? []).filter((x) => x?.logementId === id);
  const missions = de(d.missions);

  // Factures : aucune ne porte l'identifiant du logement. Une facture mensuelle numérotée garde le nom
  // des logements facturés (figé à la validation) : comptée si elle est à l'un de ses propriétaires et
  // nomme ce logement, sauf quand un autre logement de l'espace porte le même nom (doublon d'un logement
  // importé) : on ne sait pas lequel, et ce sont de toute façon ses réservations qui l'ont fait facturer.
  const nom = nomComparable(l.nom);
  const proprietaires = new Set([l.proprietaireId, ...(l.proprietairesPrecedents ?? []).map((p) => p?.proprietaireId)].filter(Boolean));
  const homonyme = (d.logements ?? []).some((x) => x?.id !== id && nomComparable(x?.nom) === nom);
  const factures =
    !nom || homonyme
      ? 0
      : (d.factures ?? []).filter(
          (f) =>
            !!f?.mensuelle &&
            !!String(f.numero ?? '').trim() &&
            proprietaires.has(f.proprietaireId ?? '') &&
            (f.mensuelle.logements ?? []).some((n) => nomComparable(n) === nom),
        ).length;

  const bilans = (d.bilansProprietaire ?? []).filter(
    (b) =>
      b?.statut === 'publie' &&
      ((b.chiffres?.logements ?? []).some((x) => x?.logementId === id) || (b.chiffres?.sejours ?? []).some((x) => x?.logementId === id)),
  ).length;

  const prix = (d.conseilsPrix ?? []).filter((e: ElementPrix) => e?.genre === 'decision' && e.logementId === id).length;
  const lien = `/erp/logements/${encodeURIComponent(id)}`;
  const actionsIA = (d.actionsAgent ?? []).filter((a) => a?.cibleId === id || a?.lien === lien || (a?.lien ?? '').startsWith(`${lien}?`) || (a?.lien ?? '').startsWith(`${lien}#`)).length;

  const nombres: Record<CleHistorique, number> = {
    reservations: de(d.reservations).length,
    conversations: de(d.filsMessages).length,
    factures,
    bilans,
    documents: de(d.documentsProprietaire).length,
    mandats: de(d.mandats).filter((m) => m.statut !== 'brouillon').length,
    dossiers: de(d.dossiers).length,
    menages: missions.filter((m) => m.type === 'menage').length,
    missions: missions.filter((m) => m.type !== 'menage').length,
    linge: de(d.mouvementsLinge).length,
    incidents: de(d.incidents).length,
    controles: de(d.controles).length,
    charges: de(d.charges).length,
    avis: de(d.avisADeposer).length,
    messagesAuto: de(d.envoisProgrammes).length,
    ameliorations: de(d.recommandations).filter((r) => r.statut !== 'a_proposer').length,
    textesAnnonce: de(d.versionsAnnonce).filter((v) => v.statut === 'validee' || v.statut === 'publiee').length,
    prix,
    actionsIA,
  };
  return (Object.keys(MOTS) as CleHistorique[])
    .filter((cle) => nombres[cle] > 0)
    .map((cle) => ({ cle, nombre: nombres[cle], libelle: `${nombres[cle]} ${nombres[cle] >= 2 ? MOTS[cle][1] : MOTS[cle][0]}` }));
}

/**
 * « 12 réservations, 3 factures et 1 incident » ; au-delà de quatre sortes
 * de traces, les trois premières (les plus parlantes) et « d’autres
 * éléments » : la phrase reste courte.
 */
export function resumeHistorique(traces: readonly Pick<TraceHistorique, 'libelle'>[]): string {
  const l = traces.map((t) => t.libelle);
  if (l.length > 4) return `${l.slice(0, 3).join(', ')} et d’autres éléments`;
  return l.length < 2 ? (l[0] ?? '') : `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}`;
}

export type VerdictSuppression =
  | {
      ok: true;
      /** Ce qui part avec lui et que l'équipe voit ailleurs (dit dans la confirmation). */
      avecLui: string[];
    }
  | { ok: false; motif: 'droits' | 'introuvable' | 'annonce'; message: string }
  | { ok: false; motif: 'historique'; message: string; historique: TraceHistorique[] };

/**
 * Peut-on supprimer ce logement ? Dans l'ordre : droits, logement présent,
 * historique (on le dit même si l'annonce est suivie : « Sorti » est alors
 * la seule voie), annonce encore suivie.
 */
export function verdictSuppression(o: { role: string | undefined; lectureSeule?: boolean; logementId: Id; donnees: DonneesSuppression }): VerdictSuppression {
  if (!peutSupprimerLogement(o.role, o.lectureSeule)) return { ok: false, motif: 'droits', message: 'Seul un gérant peut supprimer un logement.' };
  const l = (o.donnees.logements ?? []).find((x) => x?.id === o.logementId);
  if (!l) return { ok: false, motif: 'introuvable', message: 'Logement introuvable (supprimé entre-temps ?).' };
  const historique = historiqueDuLogement(l, o.donnees);
  if (historique.length) {
    return {
      ok: false,
      motif: 'historique',
      historique,
      message: `« ${l.nom} » a ${resumeHistorique(historique)} : il ne peut pas être supprimé. Passez-le en « Sorti » : il quitte les listes, rien n’est perdu.`,
    };
  }
  if (annonceSuivie(l)) {
    return {
      ok: false,
      motif: 'annonce',
      message: `L’annonce de « ${l.nom} » est encore suivie : il reviendrait au prochain import. Décochez-la dans Connexions, puis supprimez-le.`,
    };
  }
  const brouillons = (o.donnees.mandats ?? []).filter((m) => m?.logementId === l.id && m.statut === 'brouillon').length;
  return { ok: true, avecLui: brouillons ? [brouillons > 1 ? 'ses mandats en préparation' : 'son mandat en préparation'] : [] };
}

/* ------------------------------------------------------------ nettoyage */

/** Retire une clé d'un objet ; le même objet s'il ne l'a pas (rien à réécrire). */
function sansCle<T extends Record<string, unknown>>(o: T | undefined, cle: string): T | undefined {
  if (!o || typeof o !== 'object' || !Object.prototype.hasOwnProperty.call(o, cle)) return o;
  const { [cle]: _retire, ...reste } = o;
  return reste as T;
}

/** Réglages de l'espace sans ceux du logement (suppléments, textes des messages automatiques). */
function reglageSans(r: Reglage, id: Id): Reglage {
  if (r?.id === ID_REGLAGES_SUPPLEMENTS) {
    const s = r as ReglagesSupplements;
    const logements = sansCle(s.logements, id);
    return logements === s.logements ? r : { ...s, logements: logements ?? {} };
  }
  if (r?.id === ID_REGLAGES_PROGRAMMES) {
    const p = r as ReglagesMessagesProgrammes;
    if (!p.modeles || typeof p.modeles !== 'object') return r;
    let change = false;
    const modeles = Object.fromEntries(
      Object.entries(p.modeles).map(([k, m]) => {
        const logements = sansCle(m?.logements, id);
        if (logements === m?.logements) return [k, m];
        change = true;
        return [k, { ...m, logements: logements ?? {} }];
      }),
    ) as ReglagesMessagesProgrammes['modeles'];
    return change ? { ...p, modeles } : r;
  }
  return r;
}

/**
 * Le jeu de données sans le logement, et sans ce qui n'appartient qu'à lui
 * (voir l'en-tête). Ne touche à rien qui fait un historique ; les éléments
 * sans rapport gardent leur identité (rien d'autre n'est réécrit).
 */
export function supprimerLogementDe<D extends DonneesSuppression>(d: D, id: Id): D {
  const suivant: DonneesSuppression = { ...d };
  const filtrer = <K extends keyof ErpDonnees>(cle: K, garder: (e: ErpDonnees[K][number]) => boolean) => {
    const liste = d[cle] as ErpDonnees[K] | undefined;
    if (!Array.isArray(liste)) return;
    const reste = (liste as ErpDonnees[K][number][]).filter(garder);
    if (reste.length !== liste.length) (suivant as Record<string, unknown>)[cle] = reste;
  };
  filtrer('logements', (l) => l?.id !== id);
  filtrer('affectations', (a) => a?.id !== id);
  filtrer('signalementsLogement', (s) => s?.logementId !== id);
  filtrer('recommandations', (r) => !(r?.logementId === id && r.statut === 'a_proposer'));
  filtrer('versionsAnnonce', (v) => !(v?.logementId === id && (v.statut === 'proposee' || v.statut === 'rejetee')));
  filtrer('mandats', (m) => !(m?.logementId === id && m.statut === 'brouillon'));

  if (Array.isArray(d.equipe) && d.equipe.some((m) => Array.isArray(m?.logementIds) && m.logementIds.includes(id))) {
    suivant.equipe = d.equipe.map((m) => (Array.isArray(m?.logementIds) && m.logementIds.includes(id) ? { ...m, logementIds: m.logementIds.filter((x) => x !== id) } : m));
  }
  if (Array.isArray(d.reglages)) {
    const reglages = d.reglages.map((r) => reglageSans(r, id));
    if (reglages.some((r, i) => r !== d.reglages![i])) suivant.reglages = reglages;
  }
  if (Array.isArray(d.conseilsPrix)) {
    const conseils = d.conseilsPrix.map((e) => {
      if (e?.genre !== 'reglages') return e;
      const parLogement = sansCle((e as ReglagesPrix).parLogement, id);
      return parLogement === (e as ReglagesPrix).parLogement ? e : { ...(e as ReglagesPrix), parLogement: parLogement ?? {} };
    });
    if (conseils.some((e, i) => e !== d.conseilsPrix![i])) suivant.conseilsPrix = conseils;
  }
  return suivant as D;
}
