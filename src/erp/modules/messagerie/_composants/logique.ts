/**
 * Règles de la messagerie voyageurs, alignées sur l'agent IA réel
 * (agent-ia/README.md §9 bis et §16) : codes d'accès, fiche, escalade, stats.
 */
import { AUJOURDHUI, ajouterJours, ecartJours, pluriel } from '../../../data/format';
import type { FilMessages, Logement, RaisonEscalade, Reservation } from '../../../data/types';

/* ----------------------------------------------------------- codes d'accès */

export type Eligibilite = { autorise: true; raison: string } | { autorise: false; raison: string };

/**
 * Codes (boîte à clés, serrure, wifi) : seulement si le fil est rattaché à une
 * réservation confirmée sur ce logement, avec arrivée sous 48 h ou séjour en cours.
 */
export function eligibiliteCodes(fil: FilMessages, r: Reservation | undefined): Eligibilite {
  if (!r) return { autorise: false, raison: 'pas encore de réservation' };
  if (r.logementId !== fil.logementId) return { autorise: false, raison: 'réservation d’un autre logement' };
  if (r.statut === 'annulee') return { autorise: false, raison: 'réservation annulée' };
  if (r.statut === 'terminee' || r.depart <= AUJOURDHUI) return { autorise: false, raison: 'séjour terminé' };
  if (r.statut === 'en_cours' || r.arrivee <= AUJOURDHUI) return { autorise: true, raison: 'le voyageur est sur place' };
  const jours = ecartJours(AUJOURDHUI, r.arrivee);
  if (jours <= 2) return { autorise: true, raison: jours === 0 ? 'arrivée aujourd’hui' : `arrivée dans ${pluriel(jours, 'jour')} (48 h)` };
  return { autorise: false, raison: `arrivée dans ${pluriel(jours, 'jour')}, c’est encore trop tôt` };
}

/* ------------------------------------------------------------------ fiche */

const CHAMPS_FICHE: { cle: keyof Logement['fiche']; libelle: string }[] = [
  { cle: 'wifiNom', libelle: 'Réseau wifi' },
  { cle: 'wifiCode', libelle: 'Code wifi' },
  { cle: 'heureArrivee', libelle: 'Heure d’arrivée' },
  { cle: 'heureDepart', libelle: 'Heure de départ' },
  { cle: 'acces', libelle: 'Accès' },
  { cle: 'parking', libelle: 'Parking' },
  { cle: 'regles', libelle: 'Règles' },
  { cle: 'equipements', libelle: 'Équipements' },
];

export function completudeFiche(l: Logement | undefined) {
  if (!l) return { ratio: 0, manquants: CHAMPS_FICHE.map((c) => c.libelle), complete: false };
  const manquants = CHAMPS_FICHE.filter((c) => {
    const v = l.fiche[c.cle];
    return Array.isArray(v) ? v.length === 0 : !String(v ?? '').trim();
  }).map((c) => c.libelle);
  return { ratio: (CHAMPS_FICHE.length - manquants.length) / CHAMPS_FICHE.length, manquants, complete: manquants.length === 0 };
}

/* --------------------------------------------------------------- escalade */

export type MotifEscalade = RaisonEscalade;

export const LIBELLE_MOTIF: Record<MotifEscalade, { titre: string; explication: string }> = {
  argent: {
    titre: 'Une question d’argent',
    explication: 'Le voyageur parle de remboursement, de supplément ou de geste commercial. Votre agent ne s’engage jamais sur l’argent : c’est à vous de décider.',
  },
  litige: {
    titre: 'Un souci à régler',
    explication: 'Le voyageur se plaint (propreté, bruit, casse…). Une réponse humaine s’impose, avec une trace écrite.',
  },
  hors_fiche: {
    titre: 'Une information qu’il n’a pas',
    explication: 'La réponse n’est pas dans la fiche du logement. Votre agent n’invente rien : il a dit qu’il vérifiait.',
  },
  exception: {
    titre: 'Une demande d’exception',
    explication: 'Le voyageur demande quelque chose hors des règles (arrivée plus tôt, départ plus tard, long séjour…). C’est à vous de décider.',
  },
  autre: {
    titre: 'Une question à vérifier',
    explication: 'Votre agent a préféré ne pas répondre seul. Jetez un œil à la conversation.',
  },
};

const MOTS_ARGENT = /rembours|supplément|payer|paiement|€|euros?\b|remise|geste commercial|prix|tarif|refund|discount/i;
const MOTS_LITIGE = /sale|plainte|plaindre|voisin|bruit|litige|cass[ée]|abîm|problème|inacceptable|déçu|dirty|complain/i;

/**
 * Pourquoi l'agent a passé la main : le champ `raisonEscalade` s'il est
 * renseigné, sinon déduit des messages du voyageur (argent > litige > hors fiche).
 */
export function motifEscalade(fil: FilMessages): MotifEscalade {
  if (fil.raisonEscalade) return fil.raisonEscalade;
  const texte = fil.messages.filter((m) => m.auteur === 'voyageur').map((m) => m.texte).join(' ');
  if (MOTS_ARGENT.test(texte)) return 'argent';
  if (MOTS_LITIGE.test(texte)) return 'litige';
  return 'hors_fiche';
}

/* ------------------------------------------------------------ filtres */

export type FiltreFil = 'tous' | 'a_traiter' | 'escalades' | 'agent' | 'clos';

export const FILTRES: { cle: FiltreFil; libelle: string }[] = [
  { cle: 'a_traiter', libelle: 'Pour vous' },
  { cle: 'agent', libelle: 'Gérées par l’agent' },
  { cle: 'tous', libelle: 'Toutes' },
  { cle: 'clos', libelle: 'Terminées' },
];

export function correspond(fil: FilMessages, filtre: FiltreFil): boolean {
  switch (filtre) {
    case 'a_traiter':
      // Pour vous : transmise par l'agent, ou sans réponse de personne.
      return fil.statut !== 'clos' && (fil.statut === 'escalade' || fil.traitePar === 'en_attente');
    case 'escalades':
      return fil.statut === 'escalade';
    case 'agent':
      return fil.traitePar === 'agent';
    case 'clos':
      return fil.statut === 'clos';
    default:
      return true;
  }
}

/** Le dernier message vient du voyageur : une réponse est attendue. */
export function attendReponse(fil: FilMessages): boolean {
  return fil.statut !== 'clos' && fil.messages[fil.messages.length - 1]?.auteur === 'voyageur';
}

/* ------------------------------------------------------------------ stats */

export function statsAgent(fils: FilMessages[]) {
  const depuis = ajouterJours(AUJOURDHUI, -7);
  let reponsesAuto = 0;
  const delais: number[] = [];
  for (const f of fils) {
    f.messages.forEach((m, i) => {
      if (m.auteur === 'agent' && m.envoyeLe.slice(0, 10) >= depuis) reponsesAuto += 1;
      if (m.auteur !== 'voyageur') return;
      const reponse = f.messages.slice(i + 1).find((x) => x.auteur !== 'voyageur');
      if (reponse) delais.push((Date.parse(reponse.envoyeLe) - Date.parse(m.envoyeLe)) / 60000);
    });
  }
  delais.sort((a, b) => a - b);
  const mediane = delais.length
    ? delais.length % 2
      ? delais[(delais.length - 1) / 2]
      : (delais[delais.length / 2 - 1] + delais[delais.length / 2]) / 2
    : undefined;
  return {
    reponsesAuto,
    escalades: fils.filter((f) => f.statut === 'escalade').length,
    aTraiter: fils.filter((f) => correspond(f, 'a_traiter')).length,
    delaiMedianMinutes: mediane,
  };
}

export function formatDelai(minutes: number | undefined): string {
  if (minutes === undefined) return '–';
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/* ------------------------------------------------------ réponses rapides */

export interface Gabarit {
  cle: string;
  libelle: string;
  /** Contient un code d'accès ou wifi : soumis à l'éligibilité. */
  sensible: boolean;
  texte: (l: Logement, prenom: string) => string;
}

export const GABARITS: Gabarit[] = [
  {
    cle: 'arrivee',
    libelle: 'Arrivée',
    sensible: true,
    texte: (l, p) => `Bonjour ${p}, l’arrivée est possible à partir de ${l.fiche.heureArrivee}. ${l.fiche.acces} Parking : ${l.fiche.parking}.`,
  },
  {
    cle: 'wifi',
    libelle: 'Wifi',
    sensible: true,
    texte: (l, p) => `Bonjour ${p}, le réseau wifi est « ${l.fiche.wifiNom} », mot de passe : ${l.fiche.wifiCode}.`,
  },
  {
    cle: 'depart',
    libelle: 'Départ',
    sensible: false,
    texte: (l, p) => `Bonjour ${p}, le départ se fait avant ${l.fiche.heureDepart}. Merci de laisser les clés comme à votre arrivée. ${l.fiche.regles}`,
  },
  {
    cle: 'merci',
    libelle: 'Merci',
    sensible: false,
    texte: (_l, p) => `Merci ${p} pour votre message. Nous restons à votre disposition pendant tout votre séjour. L’équipe Label Maison`,
  },
];

/* ------------------------------------------------------ activité de l'agent */

export type GenreActivite = 'reponse' | 'transmis';

export interface ActiviteAgent {
  id: string;
  genre: GenreActivite;
  quand: string;
  fil: FilMessages;
  /** Extrait de la réponse (reponse) ou raison du passage de main (transmis). */
  texte: string;
  motif?: MotifEscalade;
}

/**
 * Ce que l'agent a fait depuis `depuis` (date ISO incluse) : chaque réponse
 * envoyée et chaque conversation passée à l'équipe, du plus récent au plus ancien.
 */
export function activiteAgent(fils: FilMessages[], depuis: string): ActiviteAgent[] {
  const liste: ActiviteAgent[] = [];
  for (const f of fils) {
    for (const m of f.messages) {
      if (m.auteur === 'agent' && m.envoyeLe.slice(0, 10) >= depuis) {
        liste.push({ id: `r-${m.id}`, genre: 'reponse', quand: m.envoyeLe, fil: f, texte: m.texte });
      }
    }
    if (f.statut === 'escalade') {
      // Moment du passage de main : noté par l'agent, sinon son dernier message, sinon le dernier message du fil.
      const agent = [...f.messages].reverse().find((m) => m.auteur === 'agent');
      const quand = (f.agent?.decision === 'transmettre' ? f.agent.le : undefined) ?? agent?.envoyeLe ?? f.dernierMessageLe;
      if (quand.slice(0, 10) >= depuis) {
        const motif = motifEscalade(f);
        // Le résumé de l'agent (ce que veut le voyageur) vaut mieux qu'une explication générale.
        const texte = f.agent?.decision === 'transmettre' && f.agent.resume ? f.agent.resume : LIBELLE_MOTIF[motif].explication;
        liste.push({ id: `t-${f.id}`, genre: 'transmis', quand, fil: f, texte, motif });
      }
    }
  }
  return liste.sort((a, b) => b.quand.localeCompare(a.quand));
}

/** Conversations qui attendent un humain maintenant (transmises ou sans réponse). */
export function enAttenteHumain(fils: FilMessages[]): FilMessages[] {
  return fils
    .filter((f) => f.statut !== 'clos' && (f.statut === 'escalade' || f.traitePar === 'en_attente'))
    .sort((a, b) => a.dernierMessageLe.localeCompare(b.dernierMessageLe));
}
