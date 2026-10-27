/**
 * Messagerie et IA : règles pures, sans réseau, partagées par l'agent
 * (agent-messagerie.ts), « Proposer une réponse » et la traduction
 * (agent-assistant.ts, api/erp-agent.ts) et la boîte de réception.
 *
 * - demandes du voyageur (intentions) et leurs libellés courts ;
 * - sujets sensibles : jamais d'envoi automatique ;
 * - niveaux d'autonomie de l'agent (seuils de confiance) et verdict d'envoi :
 *   envoyer, à valider (réponse préparée, l'équipe l'envoie en un clic),
 *   transmettre ;
 * - langue probable d'un message, sans IA (mots courants) ;
 * - urgence d'une conversation et ordre de « À répondre » ;
 * - codes d'accès et wifi dans un texte (garde-fou avant l'heure) ;
 * - plafond mensuel des appels à l'IA d'un espace.
 *
 * Imports relatifs avec « .js » : ce fichier tourne aussi sous Node (ESM).
 */
import { estProbleme } from './notifications.js';
import type {
  AnalyseFil,
  FilMessages,
  IntentionMessage,
  Logement,
  Message,
  NiveauAutonomie,
  RaisonEscalade,
  ReglagesAgent,
  Reservation,
  SentimentMessage,
} from './types';

/* ============================================================ intentions */

export const INTENTIONS: IntentionMessage[] = [
  'arrivee',
  'depart',
  'arrivee_anticipee',
  'depart_tardif',
  'facture',
  'prolongation',
  'probleme_technique',
  'infos',
  'annulation',
  'paiement',
  'avis',
  'autre',
];

/** Libellé court (en-tête d'une conversation) ; rien pour « autre ». */
export const LIBELLE_INTENTION: Record<IntentionMessage, string> = {
  arrivee: 'Arrivée',
  depart: 'Départ',
  arrivee_anticipee: 'Arrivée plus tôt',
  depart_tardif: 'Départ plus tard',
  facture: 'Facture',
  prolongation: 'Prolonger le séjour',
  probleme_technique: 'Problème sur place',
  infos: 'Question pratique',
  annulation: 'Annulation',
  paiement: 'Paiement',
  avis: 'Avis',
  autre: '',
};

export const SENTIMENTS: SentimentMessage[] = ['positif', 'neutre', 'negatif'];

export const estIntention = (v: unknown): v is IntentionMessage => typeof v === 'string' && (INTENTIONS as string[]).includes(v);
export const estSentiment = (v: unknown): v is SentimentMessage => typeof v === 'string' && (SENTIMENTS as string[]).includes(v);

/** Confiance lue dans la réponse de l'IA : nombre de 0 à 1 (« 85 » compris comme 0,85) ; absente si illisible. */
export function confianceLue(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || n < 0) return undefined;
  const x = n > 1 && n <= 100 ? n / 100 : n;
  return x > 1 ? undefined : Math.round(x * 100) / 100;
}

/* ===================================================== sujets sensibles */

/** Demandes jamais envoyées seules : argent, annulation, problème sur place. */
export const INTENTIONS_SENSIBLES: IntentionMessage[] = ['paiement', 'annulation', 'probleme_technique'];

/** Annulation, dans les langues des voyageurs (annuler, cancel, stornieren, cancelar, annullare). */
export const ANNULATION = /annul|cancel|stornier|cancelar/i;

/** Argent : paiement, remboursement, caution, geste commercial, prix. */
const ARGENT =
  /rembours|refund|d[ée]dommag|geste commercial|remise(?! (des|de la|du) cl)|r[ée]duction|discount|compensation|caution|d[ée]p[ôo]t de garantie|(security|damage) deposit|kaution|fianza|paiement|payer|payment|\bpay\b|\bpaid\b|€|\beuros?\b|\bEUR\b/i;

/** Réclamation et litige. */
const RECLAMATION = /r[ée]clamation|litige|plainte|inacceptable|arnaque|avocat|scam|complain|unacceptable|lawyer|police/i;

/** Données personnelles : pièce d'identité, suppression de données... */
export const DONNEES_PERSONNELLES =
  /passeport|passport|pi[eè]ce d.identit|carte d.identit|identity card|\bid card\b|donn[ée]es personnelles|personal data|\brgpd\b|\bgdpr\b|supprimer mes donn|delete my (data|account|information)|reisepass|personalausweis|pasaporte/i;

export interface SujetSensible {
  raison: RaisonEscalade;
  /** Une phrase pour l'équipe. */
  motif: string;
}

/**
 * Sujet sensible dans les derniers messages du voyageur ou dans la demande
 * lue par l'IA : jamais d'envoi automatique, quel que soit le niveau
 * d'autonomie. null : rien de sensible.
 */
export function sujetSensible(texteVoyageur: string, intention?: IntentionMessage): SujetSensible | null {
  const t = String(texteVoyageur ?? '');
  if (intention === 'annulation' || ANNULATION.test(t)) return { raison: 'argent', motif: 'Le voyageur parle d’annulation : à vous de décider.' };
  if (intention === 'paiement' || ARGENT.test(t)) return { raison: 'argent', motif: 'Question d’argent (paiement, remboursement, caution) : à vous de décider.' };
  if (RECLAMATION.test(t)) return { raison: 'litige', motif: 'Réclamation : une réponse de l’équipe s’impose.' };
  if (intention === 'probleme_technique' || estProbleme(t)) return { raison: 'litige', motif: 'Problème sur place : une réponse de l’équipe s’impose.' };
  if (DONNEES_PERSONNELLES.test(t)) return { raison: 'autre', motif: 'Données personnelles : à vous de répondre.' };
  return null;
}

/* =================================================== niveaux d'autonomie */

export const NIVEAUX_AUTONOMIE: { cle: NiveauAutonomie; libelle: string; description: string }[] = [
  {
    cle: 'valider',
    libelle: 'Je valide tout',
    description: 'Votre agent prépare chaque réponse. Vous la relisez et l’envoyez en un clic.',
  },
  {
    cle: 'simples',
    libelle: 'Questions simples',
    description: 'Il répond seul aux questions pratiques (arrivée, départ, wifi, équipements) quand il est sûr de lui. Vous validez le reste.',
  },
  {
    cle: 'autonome',
    libelle: 'Autonome hors sujets sensibles',
    description: 'Il répond seul quand il est sûr de lui. Argent, annulation et problème sur place restent pour vous.',
  },
];

/** Confiance minimale pour un envoi seul. */
export const SEUIL_SIMPLES = 0.85;
export const SEUIL_AUTONOME = 0.7;
/** Demandes auxquelles l'agent répond seul au niveau « Questions simples ». */
export const INTENTIONS_SIMPLES: IntentionMessage[] = ['arrivee', 'depart', 'infos', 'avis'];

export interface PolitiqueEnvoi {
  /** historique : Label Maison sans choix enregistré, fonctionnement d'avant (aucun seuil). */
  niveau: NiveauAutonomie | 'historique';
  /** Faux : rien ne part seul, ni réponse ni message d'attente. */
  envoiAuto: boolean;
  /** Confiance minimale pour envoyer seul (0 à 1). */
  seuil: number;
  /** Demandes auxquelles il répond seul ; absent : toutes, sauf les sujets sensibles. */
  intentions?: IntentionMessage[];
}

const estNiveau = (v: unknown): v is NiveauAutonomie => v === 'valider' || v === 'simples' || v === 'autonome';

/**
 * Politique d'envoi d'un espace. Choix du gérant d'abord. Sans choix : un
 * nouvel espace valide tout ; Label Maison garde son agent d'avant (il
 * répond seul hors sujets sensibles, sans seuil de confiance).
 */
export function politiqueEnvoi(r: Pick<ReglagesAgent, 'autonomie'>, labelMaison: boolean): PolitiqueEnvoi {
  const niveau = estNiveau(r.autonomie) ? r.autonomie : labelMaison ? 'historique' : 'valider';
  switch (niveau) {
    case 'valider':
      return { niveau, envoiAuto: false, seuil: Number.POSITIVE_INFINITY };
    case 'simples':
      return { niveau, envoiAuto: true, seuil: SEUIL_SIMPLES, intentions: INTENTIONS_SIMPLES };
    case 'autonome':
      return { niveau, envoiAuto: true, seuil: SEUIL_AUTONOME };
    default:
      return { niveau: 'historique', envoiAuto: true, seuil: 0 };
  }
}

/** Niveau coché dans les réglages (Label Maison sans choix : « autonome », son fonctionnement d'avant). */
export function niveauAutonomie(r: Pick<ReglagesAgent, 'autonomie'>, labelMaison: boolean): NiveauAutonomie {
  return estNiveau(r.autonomie) ? r.autonomie : labelMaison ? 'autonome' : 'valider';
}

export type Verdict =
  | { verdict: 'envoyer' }
  | { verdict: 'valider'; motif: string }
  | { verdict: 'transmettre'; raison: RaisonEscalade; motif: string };

/** Ce que le verdict lit d'une décision de l'agent. */
export interface DecisionNotee {
  action: 'repondre' | 'transmettre';
  raison: RaisonEscalade | 'aucune';
  confiance?: number;
  intention?: IntentionMessage;
}

/**
 * Sort d'une décision (déjà passée par les garde-fous) : l'agent n'envoie
 * seul que s'il veut répondre, hors sujet sensible, si le niveau le permet
 * et si sa confiance atteint le seuil. Sinon : à valider (réponse gardée),
 * ou transmise (sujet sensible, choix de l'agent).
 */
export function verdictEnvoi(d: DecisionNotee, p: PolitiqueEnvoi, texteVoyageur: string): Verdict {
  if (d.action === 'transmettre') return { verdict: 'transmettre', raison: d.raison === 'aucune' ? 'autre' : d.raison, motif: '' };
  const sensible = sujetSensible(texteVoyageur, d.intention);
  if (sensible) return { verdict: 'transmettre', ...sensible };
  if (!p.envoiAuto) return { verdict: 'valider', motif: 'Vous validez chaque réponse.' };
  if (p.intentions && !p.intentions.includes(d.intention ?? 'autre')) {
    return { verdict: 'valider', motif: 'Ce n’est pas une question simple : à vous de valider.' };
  }
  // Ancien format sans confiance : seul l'agent d'avant (Label Maison) l'accepte.
  const confiance = d.confiance ?? (p.niveau === 'historique' ? 1 : 0);
  if (confiance < p.seuil) return { verdict: 'valider', motif: 'Votre agent n’est pas assez sûr de sa réponse : à vous de valider.' };
  return { verdict: 'envoyer' };
}

/* =============================================================== langues */

const NOMS_LANGUES: Record<string, string> = {
  fr: 'français',
  en: 'anglais',
  es: 'espagnol',
  de: 'allemand',
  it: 'italien',
  pt: 'portugais',
  nl: 'néerlandais',
  ar: 'arabe',
  ru: 'russe',
  zh: 'chinois',
  ja: 'japonais',
  ko: 'coréen',
  pl: 'polonais',
  sv: 'suédois',
  da: 'danois',
  no: 'norvégien',
  fi: 'finnois',
  cs: 'tchèque',
  ro: 'roumain',
  el: 'grec',
  tr: 'turc',
  he: 'hébreu',
  hu: 'hongrois',
  uk: 'ukrainien',
};

/** « en-GB », « EN » → « en » ; undefined si illisible. */
export function codeLangue(v: unknown): string | undefined {
  const m = /^([a-z]{2})(?:[-_][a-z0-9]+)?$/i.exec(String(v ?? '').trim());
  return m ? m[1].toLowerCase() : undefined;
}

/** « anglais » ; undefined pour une langue inconnue. */
export const nomLangue = (code: string | undefined): string | undefined => (code ? NOMS_LANGUES[codeLangue(code) ?? ''] : undefined);

// Mots très courants par langue (minuscules, sans ponctuation). Les mots
// partagés par plusieurs langues comptent pour chacune : le contexte tranche.
const MOTS: Record<string, string[]> = {
  fr: ['le', 'les', 'des', 'du', 'est', 'et', 'je', 'vous', 'nous', 'pour', 'pas', 'une', 'merci', 'bonjour', 'bonsoir', 'avec', 'dans', 'sur', 'très', 'bien', 'oui', 'ça', 'c', 'j', 'qu', 'quel', 'quelle', 'avons', 'sommes', 'pouvez', 'peut', 'heure', 'arrivée', 'logement', 'clé', 'clés', 'votre', 'notre', 'mais', 'où', 'comment', 'ai', 'au', 'aux', 'cette', 'à', 'été', 'était', 'serait', 'svp', 'parfait', 'reparti'],
  en: ['the', 'and', 'is', 'are', 'you', 'we', 'i', 'to', 'for', 'of', 'it', 'hi', 'hello', 'thanks', 'thank', 'please', 'can', 'could', 'would', 'what', 'when', 'where', 'there', 'our', 'my', 'with', 'have', 'do', 'does', 'check', 'will', 'be', 'get', 'at', 'this', 'that', 'just', 'any', 'how', 'was', 'your', 'us', 'an', 'arrive', 'flight', 'key', 'great', 'stay'],
  es: ['el', 'los', 'las', 'que', 'y', 'es', 'por', 'para', 'gracias', 'hola', 'con', 'nosotros', 'podemos', 'puedo', 'llegar', 'buenos', 'buenas', 'días', 'está', 'muy', 'pero', 'tenemos', 'hay', 'dónde', 'cómo', 'llave', 'mañana', 'usted', 'queremos', 'qué', 'hora'],
  de: ['der', 'die', 'das', 'und', 'ist', 'ich', 'wir', 'sie', 'nicht', 'ein', 'eine', 'danke', 'hallo', 'mit', 'für', 'auf', 'können', 'bitte', 'guten', 'tag', 'wann', 'wo', 'zu', 'uns', 'haben', 'sind', 'gibt', 'schlüssel', 'ankunft', 'morgen', 'wie', 'vielen', 'noch', 'auch', 'möchten', 'kann', 'den', 'dem'],
  it: ['il', 'di', 'che', 'è', 'per', 'grazie', 'ciao', 'buongiorno', 'buonasera', 'con', 'siamo', 'possiamo', 'arrivare', 'sono', 'non', 'alle', 'della', 'chiave', 'abbiamo', 'vorremmo', 'posso', 'anche', 'molto', 'gli', 'ci', 'dove', 'quando'],
  pt: ['o', 'os', 'não', 'nós', 'obrigado', 'obrigada', 'olá', 'com', 'podemos', 'chegar', 'muito', 'bom', 'dia', 'você', 'vocês', 'temos', 'chave', 'quarto', 'estamos', 'gostaríamos', 'gostaria', 'onde', 'também', 'um', 'é'],
  nl: ['het', 'een', 'ik', 'wij', 'we', 'niet', 'dank', 'bedankt', 'hallo', 'met', 'voor', 'op', 'kunnen', 'graag', 'wanneer', 'hoe', 'waar', 'sleutel', 'zijn', 'hebben', 'van', 'jullie', 'goedemorgen', 'alvast'],
};
const INDEX_MOTS = new Map<string, Set<string>>(Object.entries(MOTS).map(([l, mots]) => [l, new Set(mots)]));

// Lettres propres à une langue (bonus).
const LETTRES: [string, RegExp][] = [
  ['fr', /[çœ]|[êè]/g],
  ['es', /[ñ¿¡]/g],
  ['de', /[ßäöü]/g],
  ['pt', /[ãõ]/g],
  ['it', /[ìò]/g],
];

/**
 * Langue probable d'un texte, sans IA : mots courants et lettres propres à
 * chaque langue (français, anglais, espagnol, allemand, italien, portugais,
 * néerlandais). undefined quand le texte ne permet pas de trancher.
 */
export function langueProbable(texte: string): string | undefined {
  const t = String(texte ?? '').toLowerCase().replace(/[’`´]/g, "'");
  const mots = t.split(/[^a-zà-öø-ÿœß]+/).filter(Boolean);
  if (!mots.length) return undefined;
  const scores = new Map<string, number>();
  for (const [langue, index] of INDEX_MOTS) scores.set(langue, mots.filter((m) => index.has(m)).length);
  for (const [langue, r] of LETTRES) scores.set(langue, (scores.get(langue) ?? 0) + Math.min(3, (t.match(r) ?? []).length));
  const tries = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [premier, second] = tries;
  if (!premier || premier[1] === 0 || premier[1] === second?.[1]) return undefined;
  // Texte court (« Merci ! », « Thanks ») : un mot suffit s'il est seul de son camp.
  if (premier[1] < 2 && (mots.length > 3 || (second?.[1] ?? 0) > 0)) return undefined;
  return premier[0];
}

/** Dernier message du voyageur. */
export function dernierVoyageur(fil: Pick<FilMessages, 'messages'>): Message | undefined {
  for (let i = fil.messages.length - 1; i >= 0; i--) if (fil.messages[i].auteur === 'voyageur') return fil.messages[i];
  return undefined;
}

/** Langue du voyageur : celle lue par l'IA, sinon celle de ses derniers messages. */
export function langueFil(fil: Pick<FilMessages, 'messages' | 'analyse'>): string | undefined {
  const lue = codeLangue(fil.analyse?.langue);
  if (lue) return lue;
  const derniers = fil.messages.filter((m) => m.auteur === 'voyageur').slice(-3);
  return derniers.length ? langueProbable(derniers.map((m) => m.texte).join('\n')) : undefined;
}

/** Langue d'un message du voyageur (celle lue par l'IA pour ce message, sinon devinée). */
export function langueMessage(m: Message, fil: Pick<FilMessages, 'analyse'>): string | undefined {
  if (fil.analyse?.messageId === m.id) {
    const lue = codeLangue(fil.analyse.langue);
    if (lue) return lue;
  }
  return langueProbable(m.texte);
}

/* ============================================ demande probable, sans IA */

// Formulations nettes seulement (le libellé n'est qu'une aide à la lecture).
const DEMANDES: [IntentionMessage, RegExp][] = [
  ['arrivee_anticipee', /(arriv\w*|check.?in|entrer|venir).{0,40}(\bt[ôo]t\b|en avance|earlier|early)|early check.?in|(plus t[ôo]t|earlier).{0,30}(arriv|check.?in)/i],
  ['depart_tardif', /(part\w*|d[ée]part|check.?out|leave|quitter).{0,40}(plus tard|later|late)|late check.?out/i],
  ['prolongation', /prolong|nuits? (de plus|suppl[ée]mentaires?)|extend (our|my|the) stay|extra night|one more night|rester (une|deux|\d+) nuits? de plus/i],
  ['facture', /factur|invoice|receipt|re[çc]u de paiement/i],
  ['avis', /\bavis\b|\breview\b|merci pour (ce|le|votre) (s[ée]jour|accueil)|thank you for (the|a|your|this) .{0,15}(stay|hospitality)|tout [ée]tait parfait/i],
  ['arrivee', /\b(arriv\w*|check.?in|code|cl[ée]s?|key|bo[iî]te [àa] cl[ée]s|acc[èe]s)\b/i],
  ['depart', /\b(d[ée]part|check.?out|partir|leave|leaving)\b/i],
  ['infos', /\b(wifi|wi-fi|parking|stationnement|serviettes?|towels?|lave-linge|machine|four|oven|cuisine|kitchen|poubelles?|transports?|bus|gare|station)\b|\by a-t-il\b|\bis there\b/i],
];

/**
 * Demande probable d'un message, sans IA, pour le libellé de l'en-tête quand
 * l'IA n'a pas encore lu la conversation. Jamais utilisée pour décider d'un
 * envoi. undefined : rien de net.
 */
export function intentionProbable(texte: string): IntentionMessage | undefined {
  const t = String(texte ?? '');
  if (!t.trim()) return undefined;
  if (ANNULATION.test(t)) return 'annulation';
  if (estProbleme(t)) return 'probleme_technique';
  if (/rembours|refund|paiement|payer|payment|caution|deposit/i.test(t)) return 'paiement';
  return DEMANDES.find(([, r]) => r.test(t))?.[0];
}

/** Demande du dernier message du voyageur : celle lue par l'IA, sinon devinée. */
export function intentionFil(fil: Pick<FilMessages, 'messages' | 'analyse'>): IntentionMessage | undefined {
  const dernier = dernierVoyageur(fil);
  if (!dernier) return undefined;
  if (fil.analyse?.messageId === dernier.id && fil.analyse.intention) return fil.analyse.intention;
  return intentionProbable(dernier.texte);
}

/* =============================================================== urgence */

export interface Urgence {
  /**
   * 3 : problème pendant le séjour (arrivée sous 24 h ou sur place) ;
   * 2 : arrivée sous 24 h ou sur place ; 1 : problème ou voyageur mécontent
   * hors séjour ; 0 : rien de pressé.
   */
  niveau: 0 | 1 | 2 | 3;
  /** Phrase courte (infobulle du badge). */
  raison?: string;
}

/** Messages du voyageur depuis la dernière réponse de l'équipe (un message d'attente de l'agent n'en est pas une). */
export function messagesSansReponse(fil: Pick<FilMessages, 'messages'>): Message[] {
  const res: Message[] = [];
  for (let i = fil.messages.length - 1; i >= 0 && fil.messages[i].auteur !== 'hote'; i--) {
    if (fil.messages[i].auteur === 'voyageur') res.unshift(fil.messages[i]);
  }
  return res;
}

const jourSuivant = (jour: string) => {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Urgence d'une conversation qui attend l'équipe : mots d'un problème
 * (estProbleme, comme les notifications), litige, voyageur mécontent selon
 * l'IA, et dates du séjour (arrivée sous 24 h ou voyageur sur place).
 */
export function urgenceFil(fil: Pick<FilMessages, 'messages' | 'analyse' | 'statut' | 'raisonEscalade'>, r: Reservation | undefined, aujourdhui: string): Urgence {
  const recents = messagesSansReponse(fil);
  if (!recents.length) return { niveau: 0 };
  const a: AnalyseFil | undefined = fil.analyse && recents.some((m) => m.id === fil.analyse!.messageId) ? fil.analyse : undefined;
  const probleme =
    recents.some((m) => estProbleme(m.texte)) ||
    (fil.statut === 'escalade' && fil.raisonEscalade === 'litige') ||
    a?.urgence === true ||
    a?.sentiment === 'negatif' ||
    a?.intention === 'probleme_technique';
  const proche = !!r && r.statut !== 'annulee' && r.statut !== 'terminee' && r.arrivee <= jourSuivant(aujourdhui) && r.depart >= aujourdhui;
  const surPlace = proche && r!.arrivee <= aujourdhui;
  if (probleme && proche) return { niveau: 3, raison: surPlace ? 'Problème signalé pendant le séjour' : 'Problème signalé, arrivée sous 24 h' };
  if (proche) return { niveau: 2, raison: surPlace ? 'Voyageur sur place' : 'Arrivée sous 24 h' };
  if (probleme) return { niveau: 1, raison: 'Problème ou voyageur mécontent' };
  return { niveau: 0 };
}

/**
 * Ordre de « À répondre » : les plus urgentes d'abord, puis les plus
 * récentes. `urgence` : niveau de chaque conversation (urgenceFil).
 */
export function trierParUrgence<F extends Pick<FilMessages, 'id' | 'dernierMessageLe'>>(fils: F[], urgence: (f: F) => number): F[] {
  const niveaux = new Map(fils.map((f) => [f.id, urgence(f)]));
  return [...fils].sort((a, b) => (niveaux.get(b.id) ?? 0) - (niveaux.get(a.id) ?? 0) || b.dernierMessageLe.localeCompare(a.dernierMessageLe));
}

/* ======================================================== codes d'accès */

/** Codes, wifi et numéros d'accès de la fiche : jamais dans un texte avant que le voyageur y ait droit. */
export function secretsAcces(fiche: Partial<Logement['fiche']> | undefined): string[] {
  if (!fiche) return [];
  const acces = String(fiche.acces ?? '');
  const codes = [...(acces.match(/\d{4,}/g) ?? []), ...[...acces.matchAll(/code\s*:?\s*([A-Za-z0-9#*]{3,})/gi)].map((m) => m[1])];
  return [...new Set([fiche.wifiCode, fiche.wifiNom, ...codes].map((x) => String(x ?? '').trim()).filter((x) => x.length >= 3))];
}

/** Le texte contient-il un code d'accès ou le wifi du logement ? */
export function contientCodeAcces(texte: string, fiche: Partial<Logement['fiche']> | undefined): boolean {
  const t = String(texte ?? '').toLowerCase();
  return !!t && secretsAcces(fiche).some((s) => t.includes(s.toLowerCase()));
}

/* ======================================================== plafond de l'IA */

/**
 * Réserve `n` appels à l'IA dans le compte du mois (agent/etat, iaMois) :
 * refusé si le plafond de l'espace serait dépassé. Un autre mois repart de zéro.
 */
export function reserverAppelsIA(
  iaMois: { mois: string; appels: number } | undefined,
  mois: string,
  plafond: number | undefined,
  n = 1,
): { permis: boolean; iaMois: { mois: string; appels: number } } {
  const deja = iaMois?.mois === mois ? iaMois.appels : 0;
  if (plafond !== undefined && deja + n > plafond) return { permis: false, iaMois: { mois, appels: deja } };
  return { permis: true, iaMois: { mois, appels: deja + n } };
}

/* ============================================ réponse préparée validée */

/** Réponse de l'agent envoyée par l'équipe : d'où elle vient et si elle a été retouchée (lu dans l'appel d'envoi). */
export interface ValidationBrouillon {
  /** agent : préparée par l'agent (à valider) ; proposition : demandée avec « Proposer une réponse ». */
  source: 'agent' | 'proposition';
  modifiee: boolean;
}

/** Lecture tolérante du champ `brouillon` d'un envoi ; undefined si absent ou illisible. */
export function lireValidation(v: unknown): ValidationBrouillon | undefined {
  const x = (v ?? {}) as { source?: unknown; modifiee?: unknown };
  if (x.source !== 'agent' && x.source !== 'proposition') return undefined;
  return { source: x.source, modifiee: x.modifiee === true };
}

/** Fil après l'envoi d'une réponse préparée par l'agent : qui l'a validée, quand, retouchée ou non. */
export function marquerBrouillonValide(f: FilMessages, par: string, modifiee: boolean, le: string): FilMessages {
  const b = f.agent?.brouillon;
  if (!b || b.valideePar) return f;
  return { ...f, agent: { ...f.agent, brouillon: { ...b, valideePar: par, valideeLe: le, modifiee } } };
}

/** Phrase du journal pour une réponse de l'agent envoyée par l'équipe. */
export function detailValidation(v: ValidationBrouillon, par: string, voyageur: string): string {
  const origine = v.source === 'agent' ? 'préparée par l’agent' : 'proposée par l’agent';
  return `Réponse ${origine} envoyée à ${voyageur} par ${par}${v.modifiee ? ', après retouche' : ', telle quelle'}.`;
}

/* ============================================================ analyse */

/** Analyse à garder sur la conversation après une décision de l'IA. */
export function analyseDepuisDecision(
  d: { langue?: string; intention?: IntentionMessage; sentiment?: SentimentMessage },
  messageId: string,
  le: string,
): AnalyseFil {
  const langue = codeLangue(d.langue);
  return {
    messageId,
    ...(langue ? { langue } : {}),
    ...(d.intention ? { intention: d.intention } : {}),
    ...(d.sentiment ? { sentiment: d.sentiment } : {}),
    urgence: d.sentiment === 'negatif' || d.intention === 'probleme_technique',
    le,
  };
}
