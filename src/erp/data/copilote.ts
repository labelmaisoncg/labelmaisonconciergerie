/**
 * Copilote (cahier A15) : ce que l'IA peut faire dans l'ERP, tracé et
 * réversible. Deux sources : Claude par le connecteur (MCP : crm-mcp.ts,
 * cm-mcp.ts, copilote-mcp.ts) et l'agent de la messagerie (agent-messagerie.ts).
 *
 * - Trace : chaque écriture d'un outil du connecteur passe par
 *   contexteTrace, qui pose la trace AVANT d'écrire (rien ne change sans
 *   trace) ; l'agent trace chacune de ses décisions (envoyée seule, à
 *   valider, transmise). Une trace dit qui (Claude et l'accès, ou l'agent),
 *   quand, quel outil, la cible, ce qui a changé (avant → après, masqué) et
 *   comment revenir en arrière.
 * - Réversible : une action interne (fiche du CRM, appel noté, conversation
 *   terminée, ménage prévu, brouillon de facture, réponse proposée) s'annule
 *   depuis « Actions de l'IA » (Paramètres, gérant), tant que sa cible n'a
 *   pas changé depuis (empreinte) ; sinon l'annulation est refusée, avec
 *   une phrase claire.
 * - Confirmation : rien ne part chez un voyageur sans l'équipe. Claude
 *   propose une réponse, l'équipe la relit et l'envoie depuis la Messagerie ;
 *   l'agent n'envoie seul que selon le niveau d'autonomie choisi par le
 *   gérant (messagerie-ia.ts). Aucun prix n'est écrit (les prix conseillés
 *   se lisent), aucun paiement n'existe.
 * - Rien de sensible : textes passés par masquer (codes et wifi du
 *   logement), masquerCoordonnees et masquerCodes. Seule l'annulation d'une
 *   fiche du CRM garde les valeurs exactes des champs changés.
 * - Bornée : 90 jours, et par espace 5 000 actions de Claude et 500 de l'agent au plus (déclencheur
 *   erp.borner_actions_ia, supabase/erp-espaces.sql) ; une trace trop
 *   grosse perd son retour (elle ne s'annule plus d'un clic).
 *
 * Module pur, partagé par le serveur et le navigateur : imports en « .js ».
 */
import { masquer, prenomInitiale } from './cm-mcp.js';
import { LIBELLE_RESULTAT, LIBELLE_STATUT_CRM } from './crm.js';
import { ID_LABEL_MAISON } from './espaces.js';
import { SUIVIS_LABEL_MAISON } from './marque-espace.js';
import { masquerCoordonnees } from './masquage.js';
import { ErreurOutil, type ContexteMcp } from './mcp-commun.js';
import { contientCodeAcces, masquerCodes, messagesSansReponse, nettoyerTexte, secretsAcces, type SourceCodes } from './messagerie-ia.js';
import type { BrouillonAgent, ContactCrm, Facture, FilMessages, Horodatage, Logement, Mission, StatutContactCrm, TraceContactCrm } from './types';
import type { ActionAgent, ChangementAction, ClientAction, CollectionTracee, EffetAction, RetourAction, SourceAction } from './types-copilote';

export type { ActionAgent } from './types-copilote';

/** Collection des traces (erp.enregistrements), réservée aux gérants par la base. */
export const COLLECTION_ACTIONS_AGENT = 'actionsAgent';
/** Conservation (et affichage) : 90 jours. */
export const CONSERVATION_JOURS = 90;
/** Au plus 500 actions de l’agent gardées par espace (Claude : MAX_ACTIONS_CLAUDE). */
export const MAX_ACTIONS = 500;
/** Actions de Claude : gardées 90 jours, 5 000 au plus (une rafale ne pousse pas dehors ses traces récentes). */
export const MAX_ACTIONS_CLAUDE = 5000;
/** Une trace plus grosse perd son retour (texte JSON, en caractères). */
export const TAILLE_MAX_TRACE = 16_000;
const EXTRAIT = 160;
const MAX_CHANGEMENTS = 12;

export const LIBELLE_SOURCE: Record<SourceAction, string> = { claude: 'Claude', agent: 'Votre agent' };

/** Ce que fait chaque outil ou décision, en deux ou trois mots. */
export const LIBELLE_OUTIL: Record<string, string> = {
  crm_ajouter: 'Contact ajouté',
  crm_modifier: 'Fiche modifiée',
  crm_noter_appel: 'Appel noté',
  conversation_pas_besoin_de_repondre: 'Conversation terminée',
  reponse_proposer: 'Réponse proposée',
  menage_creer: 'Ménage prévu',
  facture_preparer: 'Facture préparée',
  agent_envoi: 'Réponse envoyée',
  agent_a_valider: 'Réponse à valider',
  agent_transmission: 'Transmise à l’équipe',
  avis_voyageur_publie: 'Avis publié',
  reponse_avis_publiee: 'Réponse à un avis publiée',
};

/** Publications d'avis (octobre 2026) : jamais annulables, la plateforme ne retire pas un avis publié. */
export const OUTILS_PUBLICATION_AVIS: ReadonlySet<string> = new Set(['avis_voyageur_publie', 'reponse_avis_publiee']);

/**
 * Les actions que l'IA peut faire, formalisées (cahier A15) : l'effet, la
 * confirmation, l'annulation. Montrées dans « Actions de l'IA ».
 */
export interface ActionPossible {
  cle: 'repondre' | 'avis' | 'prix' | 'facture' | 'appel' | 'crm' | 'conversation' | 'menage' | 'paiement';
  libelle: string;
  /** Une phrase : qui fait quoi, ce qui ne se fait jamais. */
  regle: string;
}

export const ACTIONS_POSSIBLES: readonly ActionPossible[] = [
  {
    cle: 'repondre',
    libelle: 'Répondre à un voyageur',
    regle: 'Claude propose une réponse : l’équipe la relit et l’envoie depuis la Messagerie. Votre agent n’envoie seul que selon le niveau choisi dans Messagerie → Votre agent.',
  },
  {
    cle: 'avis',
    libelle: 'Publier un avis',
    regle:
      'Seulement si le gérant l’a allumé dans Logements → Avis : l’avis 5 étoiles sur un voyageur Airbnb sans souci, la réponse à un avis positif. Le reste attend votre accord ; un avis publié ne se retire pas.',
  },
  { cle: 'prix', libelle: 'Ajuster un prix', regle: 'Jamais : Claude lit le prix conseillé, l’équipe change le prix elle-même sur Airbnb ou Booking.' },
  { cle: 'facture', libelle: 'Préparer une facture', regle: 'Un brouillon seulement : le gérant la relit, la valide (numéro) et la partage.' },
  { cle: 'appel', libelle: 'Noter un appel', regle: 'Dans le CRM, annulable.' },
  { cle: 'crm', libelle: 'Ajouter ou modifier un contact', regle: 'Dans le CRM, annulable.' },
  { cle: 'conversation', libelle: 'Terminer une conversation', regle: 'Dans l’ERP seulement, rien n’est envoyé ; annulable.' },
  { cle: 'menage', libelle: 'Prévoir un ménage', regle: 'Interne à l’ERP : rien n’est envoyé à un prestataire ; annulable.' },
  { cle: 'paiement', libelle: 'Paiement', regle: 'Aucun : ni Claude ni votre agent ne touchent à l’argent.' },
];

/* ------------------------------------------------------------ empreinte */

/** JSON aux clés triées, sans les valeurs undefined. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** cyrb53 : empreinte de 53 bits, assez pour voir qu'un élément a changé. */
function hacher(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Ce qui compte pour savoir si une conversation a changé : son état, ses
 * messages (un voyageur qui réécrit) et la réponse proposée. Une
 * synchronisation qui la réécrit telle quelle ne la change pas.
 */
function projection(collection: CollectionTracee, e: unknown): unknown {
  if (!e || typeof e !== 'object') return null;
  if (collection !== 'filsMessages') return e;
  const f = e as FilMessages;
  const b = f.agent?.brouillon;
  return {
    statut: f.statut,
    traitePar: f.traitePar,
    raisonEscalade: f.raisonEscalade,
    messages: (f.messages ?? []).map((m) => m?.id),
    agent: {
      dernierMessageTraite: f.agent?.dernierMessageTraite,
      decision: f.agent?.decision,
      brouillon: b ? { messageId: b.messageId, texte: b.texte, le: b.le, valideePar: b.valideePar, proposePar: b.proposePar } : undefined,
    },
  };
}

/** Empreinte d'un élément (absent : celle du vide). */
export function empreinte(collection: CollectionTracee, e: unknown): string {
  return hacher(stable(projection(collection, e)));
}

/* -------------------------------------------------------------- textes */

/**
 * Texte sûr pour une trace : codes, wifi et numéros d'accès du logement
 * (fiche et annonce), e-mails, téléphones, liens et codes retirés, sur une
 * ligne, coupé à `max` caractères.
 */
export function texteMasque(t: unknown, max = EXTRAIT, logement?: Pick<Logement, 'fiche'> & Partial<Pick<Logement, 'descriptif'>>): string {
  let s = String(t ?? '');
  if (logement) {
    s = masquer(s, logement as Logement);
    for (const secret of secretsAcces(logement as SourceCodes).sort((a, b) => b.length - a.length)) s = s.split(secret).join('••••');
  }
  s = masquerCodes(masquerCoordonnees(s))
    .replace(/\[code communiqué[^\]]*\]/g, '[code masqué]')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

const JOUR = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
/** « jeu. 26 sept. » */
export const jourTexte = (d: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? JOUR.format(new Date(`${d}T12:00:00Z`)) : d);
/** « septembre 2026 » */
export const moisTexte = (m: string): string => (/^\d{4}-\d{2}$/.test(m) ? MOIS.format(new Date(`${m}-15T12:00:00Z`)) : m);
export const eurosTexte = (c: number): string =>
  `${(c / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }).replace(/[  ]/g, ' ')} €`;

/* ---------------------------------------------------- ce qui a changé */

interface Champ {
  libelle: string;
  /** Valeur lisible ; absent : jamais montrée (« modifié »). */
  valeur?: (v: unknown) => string;
}

const texteCourt = (v: unknown) => texteMasque(v, 80);
/** « Suivi par » : Abdel ou Kamel à Label Maison ; ailleurs, l'écran nomme le membre avec l'équipe de l'espace (`suivi`). */
const nomSuivi = (v: unknown) => SUIVIS_LABEL_MAISON.find((s) => s.valeur === v)?.libelle ?? 'un membre';

const CHAMPS_CRM: Record<string, Champ> = {
  statut: { libelle: 'Étape', valeur: (v) => LIBELLE_STATUT_CRM[v as StatutContactCrm] ?? String(v) },
  relanceLe: { libelle: 'Relance', valeur: (v) => jourTexte(String(v)) },
  responsable: { libelle: 'Suivi par', valeur: nomSuivi },
  motifAttente: { libelle: 'Motif d’attente', valeur: texteCourt },
  notes: { libelle: 'Notes', valeur: texteCourt },
  nom: { libelle: 'Nom', valeur: (v) => prenomInitiale(String(v)) },
  telephone: { libelle: 'Téléphone' },
  email: { libelle: 'E-mail' },
  adresse: { libelle: 'Adresse' },
  ville: { libelle: 'Ville', valeur: texteCourt },
  typeBien: { libelle: 'Bien', valeur: texteCourt },
  profil: { libelle: 'Profil', valeur: (v) => (v === 'apporteur' ? 'Apporteur' : 'Propriétaire') },
  tentatives: { libelle: 'Appels sans réponse', valeur: (v) => String(v ?? 0) },
};

const STATUT_FIL: Record<string, string> = { ouvert: 'Ouverte', clos: 'Terminée', escalade: 'Confiée à l’équipe' };
const TRAITE_PAR: Record<string, string> = { agent: 'Votre agent', humain: 'L’équipe', en_attente: 'En attente de l’équipe' };
const CHAMPS_FIL: Record<string, Champ> = {
  statut: { libelle: 'Conversation', valeur: (v) => STATUT_FIL[String(v)] ?? String(v) },
  traitePar: { libelle: 'Suivie par', valeur: (v) => TRAITE_PAR[String(v)] ?? String(v) },
};

const vide = (v: unknown) => v === undefined || v === null || v === '';

function changementsChamps(champs: Record<string, Champ>, avant: Record<string, unknown> | undefined, apres: Record<string, unknown>): ChangementAction[] {
  const res: ChangementAction[] = [];
  for (const [cle, c] of Object.entries(champs)) {
    const a = avant?.[cle];
    const b = apres[cle];
    if (stable(a) === stable(b) || (!avant && vide(b))) continue;
    if (!c.valeur) {
      res.push({ champ: c.libelle, apres: vide(b) ? 'effacé' : avant && !vide(a) ? 'modifié' : 'ajouté' });
      continue;
    }
    res.push({
      champ: c.libelle,
      ...(vide(a) ? {} : { avant: c.valeur(a) }),
      ...(vide(b) ? { apres: 'effacé' } : { apres: c.valeur(b) }),
      ...(cle === 'responsable' ? { suivi: { ...(vide(a) ? {} : { avant: String(a) }), ...(vide(b) ? {} : { apres: String(b) }) } } : {}),
    });
  }
  return res;
}

/** Lignes ajoutées en tête d'un historique (noterAppel, crm_modifier). */
function lignesAjoutees(avant: TraceContactCrm[] | undefined, apres: TraceContactCrm[] | undefined): TraceContactCrm[] {
  if (stable(avant ?? []) === stable(apres ?? [])) return [];
  const t = tete(avant ?? [], apres ?? []);
  return t ? (apres ?? []).slice(0, t.ajoutes) : [];
}

function decrireChangements(collection: CollectionTracee, avant: unknown, apres: unknown, logement?: Pick<Logement, 'fiche'>): ChangementAction[] {
  const a = avant as Record<string, unknown> | undefined;
  const b = apres as Record<string, unknown>;
  if (collection === 'crm') {
    const res = changementsChamps(CHAMPS_CRM, a, b);
    if (!a) return res.filter((c) => ['Étape', 'Ville', 'Bien', 'Relance', 'Suivi par'].includes(c.champ));
    for (const l of lignesAjoutees(a.historique as TraceContactCrm[], b.historique as TraceContactCrm[]).slice(0, 3)) {
      res.push({ champ: 'Historique', apres: `${LIBELLE_RESULTAT[l.resultat] ?? 'Note'}${l.texte ? ` : ${texteMasque(l.texte, 100)}` : ''}` });
    }
    return res;
  }
  if (collection === 'filsMessages') {
    const res = changementsChamps(CHAMPS_FIL, a, b);
    const ba = (a as FilMessages | undefined)?.agent?.brouillon;
    const bb = (b as unknown as FilMessages).agent?.brouillon;
    if (bb && stable(ba) !== stable(bb)) res.push({ champ: 'Réponse proposée', apres: texteMasque(bb.texteFr || bb.texte, EXTRAIT, logement) });
    return res;
  }
  if (collection === 'missions') {
    const m = b as unknown as Mission;
    return [
      { champ: 'Jour', apres: jourTexte(m.date) },
      { champ: 'Horaires', apres: `${m.heureDebut} – ${m.heureFinMax}` },
      ...(m.commentaire ? [{ champ: 'Note', apres: texteMasque(m.commentaire, 100) }] : []),
    ];
  }
  const f = b as unknown as Facture;
  return [
    { champ: 'Mois', apres: moisTexte(f.mensuelle?.mois ?? '') },
    { champ: 'Montant HT', apres: eurosTexte(f.montantHtCentimes ?? 0) },
    { champ: 'Statut', apres: 'Brouillon, sans numéro' },
  ];
}

/* ------------------------------------------------------------- retour */

/**
 * `apres` est-il `avant` complété en tête (et coupé en bout) ? Renvoie le
 * nombre de lignes ajoutées et celles sorties en bout ; null sinon.
 */
function tete(avant: unknown[], apres: unknown[]): { ajoutes: number; perdus: unknown[] } | null {
  for (let k = 1; k <= apres.length; k++) {
    const garde = apres.length - k;
    if (garde > avant.length) continue;
    if (stable(apres.slice(k)) === stable(avant.slice(0, garde))) return { ajoutes: k, perdus: avant.slice(garde) };
  }
  return null;
}

/** Champs qu'une annulation peut remettre sur une conversation (jamais ses messages). */
const CHAMPS_FIL_REMIS = ['statut', 'traitePar', 'raisonEscalade'];

/** Valeurs d'avant des champs changés ; null : rien de sûr à garder (l'action ne s'annulera pas). */
function retourChamps(collection: CollectionTracee, avant: Record<string, unknown>, apres: Record<string, unknown>): RetourAction | null {
  const r: Extract<RetourAction, { genre: 'champs' }> = { genre: 'champs', avant: {}, absents: [] };
  for (const cle of new Set([...Object.keys(avant), ...Object.keys(apres)])) {
    if (cle === 'id' || stable(avant[cle]) === stable(apres[cle])) continue;
    if (collection === 'filsMessages' && !CHAMPS_FIL_REMIS.includes(cle)) return null;
    const a = avant[cle];
    const b = apres[cle];
    const t = Array.isArray(a) && Array.isArray(b) ? tete(a, b) : null;
    if (t) r.tetes = { ...(r.tetes ?? {}), [cle]: t };
    else if (a === undefined) r.absents.push(cle);
    else r.avant[cle] = a;
  }
  return r;
}

/** L'élément remis comme avant l'action (il doit être celui d'après l'action : empreinte vérifiée avant). */
function appliquerRetour(actuel: Record<string, unknown>, r: Extract<RetourAction, { genre: 'champs' }>): Record<string, unknown> {
  const e: Record<string, unknown> = { ...actuel, ...r.avant };
  for (const cle of r.absents) delete e[cle];
  for (const [cle, t] of Object.entries(r.tetes ?? {})) e[cle] = [...((actuel[cle] as unknown[]) ?? []).slice(t.ajoutes), ...t.perdus];
  return e;
}

/**
 * Réponse remplacée par une proposition de Claude, gardée dans la trace pour
 * « Retirer » : jamais si elle contient un code, le wifi, une adresse, un
 * numéro ou un lien (elle est alors seulement retirée, comme avant).
 */
function brouillonGardable(b: BrouillonAgent | undefined, logement?: Pick<Logement, 'fiche'>): b is BrouillonAgent {
  if (!b || typeof b.texte !== 'string') return false;
  const textes = `${b.texte}\n${b.texteFr ?? ''}`;
  if (logement && contientCodeAcces(textes, logement as SourceCodes)) return false;
  // Rien à masquer (coordonnées, liens, codes) : le texte reste le même une fois passé par les masques.
  return masquerCodes(masquerCoordonnees(textes)) === nettoyerTexte(textes);
}

/** Conversation sans la réponse proposée (et avec le suivi d'avant, pour une proposition de Claude). */
function sansProposition(f: FilMessages, r: Extract<RetourAction, { genre: 'proposition' }>): FilMessages {
  const agent: Record<string, unknown> = { ...(f.agent ?? {}) };
  delete agent.brouillon;
  const suivant: FilMessages = { ...f };
  if (r.avant) {
    for (const cle of ['dernierMessageTraite', 'decision', 'brouillon'] as const) {
      if (r.avant[cle] === undefined) delete agent[cle];
      else agent[cle] = r.avant[cle];
    }
    if (r.avant.traitePar) suivant.traitePar = r.avant.traitePar as FilMessages['traitePar'];
    if (r.avant.statut) suivant.statut = r.avant.statut as FilMessages['statut'];
  }
  if (Object.values(agent).some((v) => v !== undefined)) suivant.agent = agent as FilMessages['agent'];
  else delete suivant.agent;
  return suivant;
}

/* ------------------------------------------------------------- traces */

const idAction = () => `act-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
/** Une phrase finie par un seul point (« … à Paul N.. » → « … à Paul N. »). */
const phrase = (s: string) => s.replace(/\.{2}$/, '.');
const espaceDe = (e: string | undefined) => (e || ID_LABEL_MAISON).toLowerCase();

/** Page de l'ERP de la cible. */
function lienDe(collection: CollectionTracee, id: string, logementId?: string): string | undefined {
  if (collection === 'crm') return `/erp/crm?contact=${encodeURIComponent(id)}`;
  if (collection === 'filsMessages') return `/erp/messagerie/${encodeURIComponent(id)}`;
  return logementId ? `/erp/logements/${encodeURIComponent(logementId)}` : undefined;
}

/** Trace trop grosse : sans retour (elle ne s'annule plus d'un clic), changements limités. */
function borner(a: ActionAgent): ActionAgent {
  const b = a.changements.length > MAX_CHANGEMENTS ? { ...a, changements: a.changements.slice(0, MAX_CHANGEMENTS) } : a;
  if (JSON.stringify(b).length <= TAILLE_MAX_TRACE) return b;
  const { retour: _r, ...reste } = b;
  return { ...reste, annulable: false, pasAnnulable: 'Trop de changements pour être annulés d’un clic : corrigez à la main si besoin.' };
}

function resumeClaude(outil: string, avant: unknown, apres: unknown, cible: string, changements: ChangementAction[]): string {
  switch (outil) {
    case 'crm_ajouter':
      return `Contact ajouté au CRM : ${cible}.`;
    case 'crm_noter_appel': {
      const l = lignesAjoutees((avant as ContactCrm | undefined)?.historique, (apres as ContactCrm).historique)[0];
      const quoi = l ? LIBELLE_RESULTAT[l.resultat]?.replace(/^Appel : /, '') : '';
      return `Appel noté avec ${cible}${quoi ? ` : ${quoi}` : ''}.`;
    }
    case 'crm_modifier': {
      const champs = [...new Set(changements.map((c) => c.champ.toLowerCase()))].slice(0, 4);
      return `Fiche de ${cible} modifiée${champs.length ? ` : ${champs.join(', ')}` : ''}.`;
    }
    case 'conversation_pas_besoin_de_repondre':
      return `Conversation avec ${cible} classée «\u00a0terminée\u00a0» (pas besoin de répondre).`;
    case 'reponse_proposer':
      return `Réponse proposée à ${cible}.`;
    case 'menage_creer': {
      const m = apres as Mission;
      return `Ménage prévu : ${cible}, ${jourTexte(m.date)} de ${m.heureDebut} à ${m.heureFinMax}.`;
    }
    case 'facture_preparer': {
      const f = apres as Facture;
      return `Brouillon de facture préparé pour ${cible} : ${moisTexte(f.mensuelle?.mois ?? '')}, ${eurosTexte(f.montantHtCentimes ?? 0)} HT, à valider par le gérant.`;
    }
    default:
      return `${LIBELLE_OUTIL[outil] ?? outil} : ${cible}.`;
  }
}

export interface EntreeActionClaude {
  outil: string;
  collection: CollectionTracee;
  avant?: { id: string };
  apres: { id: string };
  /** Nom court de la cible (« Paul N. », nom du logement). */
  cible: string;
  le: Horodatage;
  espace?: string;
  client?: ClientAction;
  /** Logement de la cible (lien, codes à masquer). */
  logement?: Pick<Logement, 'id' | 'fiche'>;
  /** Logement où voir la cible (facture : un logement du propriétaire). */
  logementId?: string;
  id?: string;
}

/** Trace d'une écriture de Claude (outil du connecteur). */
export function actionClaude(o: EntreeActionClaude): ActionAgent {
  const avant = o.avant as Record<string, unknown> | undefined;
  const apres = o.apres as Record<string, unknown>;
  // Personnes (contact, voyageur) : « Prénom N. », comme partout dans le connecteur.
  const cible = texteMasque(o.collection === 'crm' || o.collection === 'filsMessages' ? prenomInitiale(o.cible) : o.cible, 60) || 'élément';
  const changements = decrireChangements(o.collection, avant, apres, o.logement);
  const proposition = o.outil === 'reponse_proposer';
  const brouillon = proposition ? (apres as unknown as FilMessages).agent?.brouillon : undefined;
  const f = avant as unknown as FilMessages | undefined;
  const retour: RetourAction | null = proposition
    ? {
        genre: 'proposition',
        avant: {
          dernierMessageTraite: f?.agent?.dernierMessageTraite,
          decision: f?.agent?.decision,
          traitePar: f?.traitePar,
          statut: f?.statut,
          // Réponse que la proposition remplace (une proposition de Claude, ou une réponse déjà envoyée) : remise par « Retirer ».
          ...(brouillonGardable(f?.agent?.brouillon, o.logement) ? { brouillon: f?.agent?.brouillon } : {}),
        },
      }
    : avant
      ? retourChamps(o.collection, avant, apres)
      : { genre: 'supprimer' };
  const logementId = o.logementId ?? o.logement?.id ?? (typeof apres.logementId === 'string' ? apres.logementId : undefined);
  return borner({
    id: o.id ?? idAction(),
    le: o.le,
    espace: espaceDe(o.espace),
    source: 'claude',
    ...(o.client ? { client: o.client } : {}),
    outil: o.outil,
    collection: o.collection,
    cibleId: o.apres.id,
    cible,
    ...(lienDe(o.collection, o.apres.id, logementId) ? { lien: lienDe(o.collection, o.apres.id, logementId) } : {}),
    resume: phrase(resumeClaude(o.outil, avant, apres, cible, changements)),
    changements,
    effet: proposition ? 'externe' : 'interne',
    etat: proposition ? 'a_confirmer' : 'faite',
    annulable: !!retour,
    ...(retour ? { retour } : { pasAnnulable: 'Ce changement ne s’annule pas d’un clic : corrigez à la main si besoin.' }),
    empreinte: empreinte(o.collection, apres),
    ...(brouillon ? { proposition: { messageId: brouillon.messageId, le: brouillon.le } } : {}),
  });
}

export type SortAgent = 'envoyee' | 'a_valider' | 'transmise';

export interface EntreeActionAgent {
  sort: SortAgent;
  avant: FilMessages;
  apres: FilMessages;
  le: Horodatage;
  espace?: string | null;
  /** Texte envoyé (réponse, ou message d'attente d'une transmission). */
  texte?: string;
  /** Pourquoi : motif de la transmission ou de la validation demandée. */
  motif?: string;
  logement?: Pick<Logement, 'fiche'>;
  id?: string;
}

const OUTIL_AGENT: Record<SortAgent, string> = { envoyee: 'agent_envoi', a_valider: 'agent_a_valider', transmise: 'agent_transmission' };

/** Trace d'une décision de l'agent de la messagerie. */
export function actionAgentMessagerie(o: EntreeActionAgent): ActionAgent {
  const cible = prenomInitiale(o.avant.voyageur);
  const motif = o.motif ? texteMasque(o.motif, EXTRAIT, o.logement) : '';
  const texte = o.texte ? texteMasque(o.texte, EXTRAIT, o.logement) : '';
  const b = o.apres.agent?.brouillon;
  const changements: ChangementAction[] =
    o.sort === 'envoyee'
      ? [{ champ: 'Réponse', apres: texte || 'envoyée' }]
      : o.sort === 'a_valider'
        ? [...(b ? [{ champ: 'Réponse proposée', apres: texteMasque(b.texteFr || b.texte, EXTRAIT, o.logement) }] : []), ...(motif ? [{ champ: 'Pourquoi', apres: motif }] : [])]
        : [
            ...changementsChamps(CHAMPS_FIL, o.avant as unknown as Record<string, unknown>, o.apres as unknown as Record<string, unknown>),
            ...(motif ? [{ champ: 'Pourquoi', apres: motif }] : []),
            ...(texte ? [{ champ: 'Message d’attente envoyé', apres: texte }] : []),
            // Réponse de l'agent gardée pour l'équipe (elle la retrouve écrite dans la Messagerie).
            ...(b && !b.valideePar && b.le === o.le ? [{ champ: 'Réponse proposée gardée', apres: texteMasque(b.texteFr || b.texte, EXTRAIT, o.logement) }] : []),
          ];
  const resume = {
    envoyee: `Réponse envoyée seule à ${cible}.`,
    a_valider: `Réponse préparée pour ${cible}.`,
    transmise: `Conversation avec ${cible} transmise à l’équipe${texte ? ', avec un message d’attente' : ''}.`,
  }[o.sort];
  const effet: EffetAction = o.sort === 'transmise' && !texte ? 'interne' : 'externe';
  return borner({
    id: o.id ?? idAction(),
    le: o.le,
    espace: espaceDe(o.espace ?? undefined),
    source: 'agent',
    client: { genre: 'agent' },
    outil: OUTIL_AGENT[o.sort],
    collection: 'filsMessages',
    cibleId: o.avant.id,
    cible,
    lien: lienDe('filsMessages', o.avant.id),
    resume: phrase(resume),
    changements,
    effet,
    etat: o.sort === 'a_valider' ? 'a_confirmer' : 'faite',
    annulable: o.sort === 'a_valider' && !!b,
    ...(o.sort === 'a_valider' && b
      ? { retour: { genre: 'proposition' } as RetourAction, empreinte: empreinte('filsMessages', o.apres), proposition: { messageId: b.messageId, le: b.le } }
      : {
          pasAnnulable:
            o.sort === 'envoyee'
              ? 'Déjà parti chez le voyageur : un message envoyé ne se reprend pas.'
              : 'Une conversation confiée à l’équipe le reste : répondez au voyageur depuis la Messagerie.',
        }),
  });
}

/* ------------------------------------------------ avis publiés */

export interface EntreePublicationAvis {
  /** voyageur : avis de l'hôte sur le voyageur (Airbnb) ; reponse : réponse publique à l'avis du voyageur. */
  genre: 'voyageur' | 'reponse';
  reservation: { id: string; voyageur?: { nom?: string } };
  /** Plateforme en clair (« Airbnb », « Booking.com »). */
  plateforme: string;
  /** Texte publié (masqué dans la trace). */
  texte: string;
  le: Horodatage;
  espace?: string | null;
  /** Gérant qui a publié depuis « À valider » (son adresse) ; absent : publication automatique. */
  par?: string;
  /** Texte retouché par le gérant avant de publier. */
  modifie?: boolean;
  logement?: Pick<Logement, 'fiche'>;
  /** Note donnée au voyageur (avis sur le voyageur). */
  note?: number;
  id?: string;
}

/**
 * Trace d'un avis publié sur la plateforme (« Actions de l'IA ») : action
 * externe, jamais annulable (un avis publié ne se retire pas), avec le texte
 * publié (masqué). Rédigé par votre agent ; publié seul, ou par le gérant
 * depuis « À valider » (`envoyee`).
 */
export function actionPublicationAvis(o: EntreePublicationAvis): ActionAgent {
  const cible = prenomInitiale(o.reservation.voyageur?.nom);
  const texte = texteMasque(o.texte, EXTRAIT, o.logement);
  const voyageur = o.genre === 'voyageur';
  const quand = o.par ? 'après votre accord' : 'seul';
  const resume = voyageur ? `Avis sur ${cible} publié ${quand} sur ${o.plateforme}${o.note ? ` (${o.note} étoiles)` : ''}.` : `Réponse à l’avis de ${cible} publiée ${quand} sur ${o.plateforme}.`;
  return borner({
    id: o.id ?? idAction(),
    le: o.le,
    espace: espaceDe(o.espace ?? undefined),
    source: 'agent',
    client: { genre: 'agent' },
    outil: voyageur ? 'avis_voyageur_publie' : 'reponse_avis_publiee',
    collection: voyageur ? 'avisADeposer' : 'reponsesAvis',
    cibleId: o.reservation.id,
    cible,
    lien: `/erp/reservations/${encodeURIComponent(o.reservation.id)}`,
    resume: phrase(resume),
    changements: [
      { champ: voyageur ? 'Avis publié' : 'Réponse publiée', apres: texte || 'publié' },
      ...(voyageur && o.note ? [{ champ: 'Note', apres: `${o.note} étoiles, recommandé` }] : []),
    ],
    effet: 'externe',
    etat: 'faite',
    annulable: false,
    pasAnnulable: voyageur
      ? `Publié sur ${o.plateforme} : un avis publié ne se modifie ni ne se retire.`
      : `Publiée sur ${o.plateforme} : une réponse publiée ne se reprend pas depuis l’ERP.`,
    ...(o.par ? { envoyee: { par: o.par, le: o.le, ...(o.modifie ? { modifiee: true } : {}) } } : {}),
  });
}

/* ------------------------------------------- mise en service (SQL) */

const protections = new WeakMap<object, Promise<boolean>>();
/**
 * La règle « actions de l'IA réservées aux gérants » est-elle en place dans la
 * base (erp.actions_ia_protegees, supabase/erp-espaces.sql) ? Sans elle, la
 * collection serait lisible et modifiable par tous les membres : rien n'est
 * tracé ni annulé. Une base sans `rpc` (doublure de test) est tenue pour prête.
 */
export function actionsIaProtegees(base: object & { rpc?: (nom: string) => PromiseLike<unknown> }): Promise<boolean> {
  if (typeof base.rpc !== 'function') return Promise.resolve(true);
  let p = protections.get(base);
  if (!p) {
    p = Promise.resolve(base.rpc('actions_ia_protegees')).then((v) => v === true, () => false);
    protections.set(base, p);
    // Un refus n'est pas gardé : le passage suivant relit (le SQL a pu être relancé entre-temps).
    p.then((ok) => (ok ? undefined : protections.delete(base)));
  }
  return p;
}

/* --------------------------------------------------------- annulation */

/** Ce que chaque outil (ou décision de l'agent) peut défaire, et où. */
const RETOURS_PERMIS: Record<string, { collection: CollectionTracee; genres: RetourAction['genre'][] }> = {
  crm_ajouter: { collection: 'crm', genres: ['supprimer', 'champs'] },
  crm_modifier: { collection: 'crm', genres: ['champs'] },
  crm_noter_appel: { collection: 'crm', genres: ['champs'] },
  conversation_pas_besoin_de_repondre: { collection: 'filsMessages', genres: ['champs'] },
  reponse_proposer: { collection: 'filsMessages', genres: ['proposition'] },
  agent_a_valider: { collection: 'filsMessages', genres: ['proposition'] },
  menage_creer: { collection: 'missions', genres: ['supprimer'] },
  facture_preparer: { collection: 'factures', genres: ['supprimer'] },
};

/**
 * La trace a-t-elle la forme de celles que le serveur écrit ? Collection et
 * genre de retour cohérents avec l'outil, champs d'une conversation limités à
 * son état. Une trace qui ne colle pas n'est jamais rejouée.
 */
function retourPermis(a: ActionAgent): boolean {
  const p = RETOURS_PERMIS[a.outil];
  const r = a.retour;
  if (!p || !r || p.collection !== a.collection || !p.genres.includes(r.genre)) return false;
  if (r.genre === 'champs') {
    const cles = [...Object.keys(r.avant ?? {}), ...(r.absents ?? []), ...Object.keys(r.tetes ?? {})];
    if (cles.some((k) => k === 'id' || k === 'espace')) return false;
    if (a.collection === 'filsMessages' && cles.some((k) => !CHAMPS_FIL_REMIS.includes(k))) return false;
  }
  return true;
}

/**
 * La cible est-elle encore de celles que l'IA peut retirer ? Une suppression
 * ne vaut que pour ce que l'IA crée : ménage interne, brouillon de facture
 * sans numéro. Renvoie ce qui l'empêche (rien : la suppression est permise).
 */
function suppressionBloquee(a: ActionAgent, actuel: { id: string } | undefined): 'facture_validee' | 'menage_confie' | null {
  if (a.retour?.genre !== 'supprimer' || !actuel) return null;
  if (a.collection === 'factures' && ((actuel as Facture).statut !== 'brouillon' || !!(actuel as Facture).numero)) return 'facture_validee';
  if (a.collection === 'missions' && (actuel as Mission).interne !== true) return 'menage_confie';
  return null;
}

const TRACE_INCONNUE = 'Cette trace ne correspond à aucune action de l’IA : rien n’a été annulé.';

export type EcritureAnnulation =
  | { genre: 'ecrire'; collection: CollectionTracee; element: { id: string } }
  | { genre: 'supprimer'; collection: CollectionTracee; id: string };

export type ResultatAnnulation = { ok: true; ecriture: EcritureAnnulation; action: ActionAgent; message: string } | { ok: false; raison: string };

const heureTexte = (h: string) => (/T\d{2}:\d{2}/.test(h) ? h.slice(11, 16).replace(':', ' h ') : h);

/**
 * Annule une action, si elle s'annule et si sa cible n'a pas changé depuis
 * (`actuel` : la cible lue à l'instant dans la base ; undefined : absente).
 * Renvoie l'écriture à faire et la trace marquée « annulée ».
 */
export function annulerAction(a: ActionAgent, actuel: { id: string } | undefined, o: { espace: string | null | undefined; le: Horodatage; par: string }): ResultatAnnulation {
  if (espaceDe(a.espace) !== espaceDe(o.espace ?? undefined)) return { ok: false, raison: 'Cette action appartient à un autre espace : rien n’a été annulé.' };
  if (a.etat === 'annulee') return { ok: false, raison: `Déjà annulée${a.annulation ? ` par ${a.annulation.par}` : ''}.` };
  if (!a.annulable || !a.retour || (a.etat !== 'faite' && a.etat !== 'a_confirmer')) return { ok: false, raison: a.pasAnnulable ?? 'Cette action ne s’annule pas.' };
  if (!retourPermis(a)) return { ok: false, raison: TRACE_INCONNUE };
  const bloquee = suppressionBloquee(a, actuel);
  if (bloquee === 'facture_validee') return { ok: false, raison: 'La facture a été validée depuis : elle ne s’annule plus.' };
  const r = a.retour;
  if (r.genre === 'proposition') {
    const b = (actuel as FilMessages | undefined)?.agent?.brouillon;
    if (b?.valideePar && a.proposition && b.messageId === a.proposition.messageId) {
      return { ok: false, raison: 'La réponse est déjà partie chez le voyageur : un message envoyé ne se reprend pas.' };
    }
  }
  if (!actuel) return { ok: false, raison: `${a.cible} n’existe plus : rien n’a été annulé.` };
  if (empreinte(a.collection, actuel) !== a.empreinte) {
    return {
      ok: false,
      raison: `${a.cible} a changé depuis l’action de ${LIBELLE_SOURCE[a.source]} (${heureTexte(a.le)}) : rien n’a été annulé, pour ne rien écraser. Corrigez à la main si besoin.`,
    };
  }
  // Ménage qui n'est pas interne, inchangé depuis la trace : elle n'a pas été écrite par le serveur.
  if (bloquee) return { ok: false, raison: TRACE_INCONNUE };
  const ecriture: EcritureAnnulation =
    r.genre === 'supprimer'
      ? { genre: 'supprimer', collection: a.collection, id: actuel.id }
      : r.genre === 'proposition'
        ? { genre: 'ecrire', collection: a.collection, element: sansProposition(actuel as FilMessages, r) }
        : { genre: 'ecrire', collection: a.collection, element: appliquerRetour(actuel as Record<string, unknown>, r) as { id: string } };
  const message = {
    supprimer: `${LIBELLE_OUTIL[a.outil] ?? 'Action'} annulé : ${a.collection === 'missions' ? 'le ménage est retiré du planning' : a.collection === 'factures' ? 'le brouillon de facture est retiré' : `${a.cible} est retiré`}.`,
    proposition: `Réponse proposée retirée : rien n’avait été envoyé à ${a.cible}.`,
    champs: `Annulé : ${a.cible} est revenu${a.collection === 'filsMessages' ? 'e' : ''} comme avant l’action de ${LIBELLE_SOURCE[a.source]}.`,
  }[r.genre];
  return { ok: true, ecriture, action: { ...a, etat: 'annulee', annulation: { le: o.le, par: o.par } }, message: phrase(message) };
}

/* ------------------------------------------------------------- vue */

export interface EtatAffiche {
  libelle: string;
  ton: 'neutre' | 'or' | 'succes' | 'alerte' | 'danger' | 'info';
  /** « Annuler » (ou « Retirer » pour une réponse proposée) proposé maintenant. */
  annulable: boolean;
  /** Réponse proposée qui attend l'envoi de l'équipe. */
  aEnvoyer?: boolean;
}

/** Où en est l'action, lue sur la conversation pour une réponse proposée. `nom` : nom d'un membre d'après son adresse. */
export function etatAffiche(a: ActionAgent, fils: readonly FilMessages[], nom: (email: string) => string = (e) => e): EtatAffiche {
  // Avis publié : seul, ou par le gérant depuis « À valider » ; jamais annulable.
  if (OUTILS_PUBLICATION_AVIS.has(a.outil)) {
    // « Publié » (un avis), « Publiée » (une réponse).
    const e = a.outil === 'reponse_avis_publiee' ? 'e' : '';
    return a.envoyee
      ? { libelle: `Publié${e} par ${nom(a.envoyee.par)}${a.envoyee.modifiee ? ', après retouche' : ''}`, ton: 'succes', annulable: false }
      : { libelle: `Publié${e} seul${e}`, ton: 'info', annulable: false };
  }
  // Envoyée par l'équipe : noté sur la trace à l'envoi (la conversation a pu changer depuis).
  if (a.envoyee) return { libelle: `Envoyée par ${nom(a.envoyee.par)}${a.envoyee.modifiee ? ', après retouche' : ''}`, ton: 'succes', annulable: false };
  if (a.etat === 'annulee') {
    // Réponse proposée retirée (« Retirer ») ; toute autre action, annulée.
    const verbe = a.retour?.genre === 'proposition' ? 'Retirée' : 'Annulée';
    return { libelle: a.annulation ? `${verbe} par ${a.annulation.par}` : verbe, ton: 'neutre', annulable: false };
  }
  if (a.etat === 'echec') return { libelle: 'Pas faite', ton: 'danger', annulable: false };
  if (a.etat === 'sans_effet') return { libelle: 'Rien à faire', ton: 'neutre', annulable: false };
  if (a.etat === 'a_confirmer') {
    const f = fils.find((x) => x.id === a.cibleId);
    const b = f?.agent?.brouillon;
    const meme = !!b && !!a.proposition && b.messageId === a.proposition.messageId && b.le === a.proposition.le;
    if (meme && b?.valideePar) return { libelle: `Envoyée par ${nom(b.valideePar)}`, ton: 'succes', annulable: false };
    if (meme && f && messagesSansReponse(f).some((m) => m.id === b!.messageId)) return { libelle: 'À envoyer', ton: 'or', annulable: a.annulable, aEnvoyer: true };
    return { libelle: f ? 'Remplacée' : 'Conversation introuvable', ton: 'neutre', annulable: false };
  }
  if (a.outil === 'agent_envoi') return { libelle: 'Envoyée seule', ton: 'info', annulable: false };
  if (a.outil === 'agent_transmission') return { libelle: 'Transmise', ton: 'alerte', annulable: false };
  return { libelle: 'Fait', ton: 'neutre', annulable: a.annulable };
}

/**
 * Actions à montrer : les 90 derniers jours, sans celles qui n'ont rien
 * fait, de la plus récente à la plus ancienne ; 5 000 de Claude et 500 de l'agent au plus (les
 * décisions de l'agent ne poussent jamais dehors celles de Claude), comme
 * dans la base (erp.borner_actions_ia).
 */
export function actionsVisibles(actions: readonly ActionAgent[], aujourdhui: string): ActionAgent[] {
  const t = Date.parse(`${aujourdhui}T12:00:00Z`) - CONSERVATION_JOURS * 86_400_000;
  const depuis = Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : '';
  const parSource = new Map<string, number>();
  return actions
    .filter((a) => a && typeof a.le === 'string' && a.etat !== 'sans_effet' && a.le.slice(0, 10) >= depuis)
    .sort((x, y) => y.le.localeCompare(x.le) || y.id.localeCompare(x.id))
    .filter((a) => {
      const n = (parSource.get(String(a.source)) ?? 0) + 1;
      parSource.set(String(a.source), n);
      return n <= (a.source === 'claude' ? MAX_ACTIONS_CLAUDE : MAX_ACTIONS);
    });
}

/**
 * Réponse proposée (par Claude ou l'agent) envoyée par l'équipe : la ou les
 * traces « à confirmer » de cette réponse passent « faite », envoyée par qui
 * et quand. `fil` : la conversation AVANT l'envoi (avec la réponse proposée).
 * Renvoie les traces à écrire (aucune si rien ne correspond).
 */
export function tracesEnvoyees(
  actions: readonly ActionAgent[],
  fil: Pick<FilMessages, 'id' | 'agent'>,
  o: { par: string; le: Horodatage; modifiee?: boolean; espace?: string | null },
): ActionAgent[] {
  const b = fil.agent?.brouillon;
  if (!b || b.valideePar) return [];
  return actions
    .filter((a) => a?.etat === 'a_confirmer' && a.collection === 'filsMessages' && a.cibleId === fil.id && a.proposition?.messageId === b.messageId && a.proposition?.le === b.le)
    // Jamais la trace d'un autre espace (la liste vient déjà de la base de l'espace : défense en plus).
    .filter((a) => o.espace === undefined || espaceDe(a.espace) === espaceDe(o.espace ?? undefined))
    .map((a) => ({
      ...a,
      etat: 'faite' as const,
      annulable: false,
      pasAnnulable: 'Envoyée au voyageur : un message parti ne se reprend pas.',
      // Retouchée : ce n'est pas la réponse proposée qui est partie, la trace le dit.
      envoyee: { par: o.par, le: o.le, ...(o.modifiee ? { modifiee: true } : {}) },
    }));
}

/* ------------------------------------------------ connecteur : contexte */

const LECTURE_SEULE = 'Outil en lecture seule : rien n’est écrit.';

/** Contexte d'un outil de lecture : toute écriture est refusée. */
export function contexteLecture(ctx: ContexteMcp): ContexteMcp {
  const refus = async (): Promise<never> => {
    throw new ErreurOutil(LECTURE_SEULE);
  };
  return {
    ...ctx,
    depot: { ...ctx.depot, enregistrer: refus },
    cm: { ...ctx.cm, enregistrerFil: refus },
    ...(ctx.copilote ? { copilote: { ...ctx.copilote, enregistrerMission: refus, ajouterFacture: refus } } : {}),
    actions: { enregistrer: refus },
  };
}

/** Outils arrivés avec le copilote : sans la règle SQL des actions de l'IA, ils refusent. */
export const OUTILS_APRES_REGLE: ReadonlySet<string> = new Set(['reponse_proposer', 'menage_creer', 'facture_preparer']);
export const REGLE_A_RELANCER = 'Le gérant doit d’abord relancer la mise à jour de la base : rien n’a été modifié.';

/** Règle SQL en place ? Absente du contexte (doublure de test) : oui ; témoin injoignable : non. */
const reglePrete = (ctx: ContexteMcp): Promise<boolean> => (ctx.actions.pret ? Promise.resolve(ctx.actions.pret()).catch(() => false) : Promise.resolve(true));

/** Un nouvel outil du copilote, appelé avant la mise à jour de la base : refusé d'emblée, rien n'est lu ni écrit. */
export async function verifierRegle(ctx: ContexteMcp, outil: string): Promise<void> {
  if (OUTILS_APRES_REGLE.has(outil) && !(await reglePrete(ctx))) throw new ErreurOutil(REGLE_A_RELANCER);
}

/**
 * Contexte d'un outil d'écriture : chaque écriture est tracée AVANT d'être
 * faite (la trace d'abord ; sans trace, rien). Si l'écriture échoue, la
 * trace passe « pas faite » ; si elle n'a rien fait (facture déjà là),
 * « rien à faire ».
 *
 * Tant que la règle SQL manque (supabase/erp-espaces.sql pas relancé), une
 * trace serait lisible par tous les membres : on n'en écrit pas. Les outils
 * d'avant le copilote (CRM, conversation terminée) écrivent alors comme
 * avant, sans trace ; les nouveaux (OUTILS_APRES_REGLE) refusent.
 */
export function contexteTrace(ctx: ContexteMcp, outil: string): ContexteMcp {
  const espace = ctx.espace?.id;
  let regle: Promise<boolean> | undefined;
  const tracer = async (entree: Omit<EntreeActionClaude, 'outil' | 'le' | 'espace' | 'client'>, ecrire: () => Promise<boolean | void>): Promise<boolean> => {
    if (!(await (regle ??= reglePrete(ctx)))) {
      if (OUTILS_APRES_REGLE.has(outil)) throw new ErreurOutil(REGLE_A_RELANCER);
      return (await ecrire()) !== false;
    }
    const a = actionClaude({ ...entree, outil, le: ctx.maintenant(), espace, client: ctx.client });
    await ctx.actions.enregistrer(a);
    let fait: boolean | void;
    try {
      fait = await ecrire();
    } catch (e) {
      await ctx.actions.enregistrer({ ...a, etat: 'echec', annulable: false, pasAnnulable: 'L’écriture n’a pas abouti : rien n’a changé.' }).catch(() => undefined);
      throw e;
    }
    if (fait === false) await ctx.actions.enregistrer({ ...a, etat: 'sans_effet', annulable: false, pasAnnulable: 'Rien n’a été fait.' }).catch(() => undefined);
    return fait !== false;
  };
  const cp = ctx.copilote;
  return {
    ...ctx,
    depot: {
      ...ctx.depot,
      enregistrer: async (c) => {
        await tracer({ collection: 'crm', avant: await ctx.depot.un(c.id), apres: c, cible: prenomInitiale(c.nom) }, () => ctx.depot.enregistrer(c));
      },
    },
    cm: {
      ...ctx.cm,
      enregistrerFil: async (f) => {
        const logement = (await ctx.cm.logements()).find((l) => l.id === f.logementId);
        await tracer({ collection: 'filsMessages', avant: await ctx.cm.fil(f.id), apres: f, cible: prenomInitiale(f.voyageur), ...(logement ? { logement } : {}) }, () => ctx.cm.enregistrerFil(f));
      },
    },
    ...(cp
      ? {
          copilote: {
            ...cp,
            enregistrerMission: async (m, cible) => {
              await tracer({ collection: 'missions', avant: (await cp.missions()).find((x) => x.id === m.id), apres: m, cible }, () => cp.enregistrerMission(m, cible));
            },
            ajouterFacture: (f, cible, logementId) => tracer({ collection: 'factures', apres: f, cible, ...(logementId ? { logementId } : {}) }, () => cp.ajouterFacture(f, cible, logementId)),
          },
        }
      : {}),
  };
}
