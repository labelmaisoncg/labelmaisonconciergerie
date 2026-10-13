/**
 * Connecteur MCP du CRM : outils que Claude (claude.ai, Claude Desktop,
 * Claude Code) peut appeler pour lire et tenir le CRM d'appels.
 *
 * Ce fichier ne contient que la logique (outils + protocole JSON-RPC) ; le
 * stockage est passé en paramètre (`DepotCrm`) : la route api/crm-mcp/[cle].ts
 * lui donne la base de l'ERP, les vérifications un dépôt en mémoire.
 * Pas de suppression possible par ce connecteur : on corrige, on ne détruit pas.
 */
import {
  aTraiterLe,
  contactDepuisDemande,
  idContactCrm,
  LIBELLE_SOURCE_CRM,
  LIBELLE_STATUT_CRM,
  noterAppel,
  STATUTS_CLOS,
  STATUTS_CRM,
  telephoneNormalise,
  trouverDoublon,
} from './crm.js';
import type { ContactCrm, Horodatage, Responsable, ResultatAppel } from './types';

export interface DepotCrm {
  tous(): Promise<ContactCrm[]>;
  un(id: string): Promise<ContactCrm | undefined>;
  enregistrer(c: ContactCrm): Promise<void>;
}

export interface ContexteMcp {
  depot: DepotCrm;
  /** Date du jour à Paris (AAAA-MM-JJ). */
  aujourdhui: () => string;
  maintenant: () => Horodatage;
}

const AUTEUR = 'Claude';
const STATUTS = STATUTS_CRM.map((s) => s.cle);
const RESPONSABLES: Responsable[] = ['abdel', 'kamel'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const VERSIONS_PROTOCOLE = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

export const INSTRUCTIONS_SERVEUR = `CRM d'appels de Label Maison Conciergerie (gestion locative courte durée en Essonne).
Chaque demande envoyée depuis le site labelmaisoncg.fr (formulaires audit, accueil, contact, Cercle) arrive automatiquement dans le CRM à l'étape « À appeler ».
Étapes : ${STATUTS_CRM.map((s) => `${s.cle} (${s.libelle} : ${s.aide})`).join(' ; ')}.
Pour savoir quoi faire aujourd'hui : crm_resume. Pour retrouver quelqu'un : crm_chercher (nom, téléphone, ville…), puis crm_voir pour sa fiche complète et son historique.
Après un appel, utiliser crm_noter_appel (l'étape avance toute seule) ; pour changer l'étape, une relance, le suivi ou les notes : crm_modifier. Un nouveau contact : crm_ajouter (les doublons par e-mail ou téléphone sont détectés).
Les modifications apparaissent en direct dans l'ERP (labelmaisoncg.fr/erp/crm). Répondre en français.`;

/* ----------------------------------------------------------- présentation */

/** Vue compacte d'un contact (listes). */
function resume(c: ContactCrm, aujourdhui: string) {
  return {
    id: c.id,
    nom: c.nom,
    etape: LIBELLE_STATUT_CRM[c.statut],
    statut: c.statut,
    ...(c.telephone ? { telephone: c.telephone } : {}),
    ...(c.ville ? { ville: c.ville } : {}),
    ...(c.typeBien ? { bien: c.typeBien } : {}),
    ...(c.relanceLe ? { relance_le: c.relanceLe, relance_en_retard: c.relanceLe < aujourdhui && !STATUTS_CLOS.includes(c.statut) } : {}),
    ...(c.responsable ? { suivi_par: c.responsable } : {}),
    ...(c.notes ? { notes: c.notes.slice(0, 200) } : {}),
    recu_le: c.creeLe.slice(0, 10),
  };
}

/** Fiche complète (crm_voir). */
function fiche(c: ContactCrm, aujourdhui: string) {
  return {
    ...resume(c, aujourdhui),
    ...(c.email ? { email: c.email } : {}),
    ...(c.adresse ? { adresse: c.adresse } : {}),
    ...(c.motifAttente ? { en_attente_de: c.motifAttente } : {}),
    ...(c.message ? { message_du_formulaire: c.message } : {}),
    ...(c.page ? { page_du_site: c.page } : {}),
    source: LIBELLE_SOURCE_CRM[c.source],
    notes: c.notes,
    appels_sans_reponse: c.tentatives ?? 0,
    historique: (c.historique ?? []).slice(0, 30).map((t) => ({ le: t.le, par: t.par, type: t.resultat, ...(t.texte ? { texte: t.texte } : {}) })),
    lien_erp: `https://www.labelmaisoncg.fr/erp/crm?contact=${encodeURIComponent(c.id)}`,
  };
}

/* -------------------------------------------------------------- outils */

type Args = Record<string, unknown>;

class ErreurOutil extends Error {}

const texte = (v: unknown, nom: string, max: number): string | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') throw new ErreurOutil(`« ${nom} » doit être un texte.`);
  const s = v.trim();
  if (s.length > max) throw new ErreurOutil(`« ${nom} » : ${max} caractères au plus.`);
  return s;
};

const choix = <T extends string>(v: unknown, nom: string, valeurs: readonly T[]): T | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || !valeurs.includes(v as T)) throw new ErreurOutil(`« ${nom} » doit valoir : ${valeurs.join(', ')}.`);
  return v as T;
};

const date = (v: unknown, nom: string): string | undefined | '' => {
  if (v === undefined || v === null) return undefined;
  if (v === '') return '';
  if (typeof v !== 'string' || !DATE.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`))) {
    throw new ErreurOutil(`« ${nom} » doit être une date AAAA-MM-JJ (ou "" pour l’effacer).`);
  }
  return v;
};

async function contactExistant(ctx: ContexteMcp, id: unknown): Promise<ContactCrm> {
  const cle = texte(id, 'id', 100);
  if (!cle) throw new ErreurOutil('« id » est obligatoire (voir crm_chercher).');
  if (!/^[a-z0-9-]{1,100}$/i.test(cle)) throw new ErreurOutil(`Identifiant invalide « ${cle.slice(0, 40)} ». Utilisez crm_chercher pour retrouver le bon.`);
  const c = await ctx.depot.un(cle);
  if (!c) throw new ErreurOutil(`Aucun contact avec l’id « ${cle} ». Utilisez crm_chercher pour retrouver le bon.`);
  return c;
}

interface Outil {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
  executer: (args: Args, ctx: ContexteMcp) => Promise<Record<string, unknown>>;
}

const LECTURE = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const ECRITURE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

const proprietes = {
  statut: { type: 'string', enum: STATUTS, description: `Étape : ${STATUTS_CRM.map((s) => `${s.cle} = ${s.libelle}`).join(', ')}.` },
  suivi_par: { type: 'string', enum: [...RESPONSABLES, ''], description: 'Qui suit le contact (abdel, kamel ; "" pour personne).' },
  relance_le: { type: 'string', description: 'Date de relance prévue, AAAA-MM-JJ ("" pour l’effacer).' },
};

export const OUTILS: Outil[] = [
  {
    name: 'crm_resume',
    title: 'Résumé du CRM',
    description:
      "Point du jour : nombre de contacts par étape, personnes à appeler aujourd'hui (nouvelles demandes et relances échues) et relances en retard. À appeler en premier pour savoir où on en est.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: LECTURE,
    executer: async (_a, ctx) => {
      const tous = await ctx.depot.tous();
      const j = ctx.aujourdhui();
      const aFaire = tous.filter((c) => aTraiterLe(c, j)).sort((a, b) => (a.relanceLe ?? '0').localeCompare(b.relanceLe ?? '0'));
      return {
        date: j,
        total: tous.length,
        par_etape: Object.fromEntries(STATUTS_CRM.map((s) => [s.libelle, tous.filter((c) => c.statut === s.cle).length])),
        a_appeler_aujourdhui: aFaire.length,
        liste_du_jour: aFaire.slice(0, 15).map((c) => resume(c, j)),
        relances_en_retard: tous.filter((c) => c.relanceLe && c.relanceLe < j && !STATUTS_CLOS.includes(c.statut)).length,
      };
    },
  },
  {
    name: 'crm_chercher',
    title: 'Chercher des contacts',
    description:
      "Liste ou recherche des contacts du CRM. Filtres combinables : texte (nom, téléphone, e-mail, ville, bien, notes), étapes, suivi_par, a_traiter_aujourdhui. Résultats triés par relance la plus proche puis demande la plus récente. Renvoie des fiches courtes : utiliser crm_voir pour le détail.",
    inputSchema: {
      type: 'object',
      properties: {
        recherche: { type: 'string', description: 'Texte libre : nom, téléphone (ex. 0612345678), e-mail, ville…' },
        statuts: { type: 'array', items: proprietes.statut, description: 'Ne garder que ces étapes.' },
        suivi_par: { type: 'string', enum: RESPONSABLES, description: 'Ne garder que les contacts suivis par cette personne.' },
        a_traiter_aujourdhui: { type: 'boolean', description: "Seulement les nouvelles demandes et les relances échues aujourd'hui." },
        limite: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
        decalage: { type: 'integer', minimum: 0, default: 0, description: 'Pour la page suivante.' },
      },
      additionalProperties: false,
    },
    annotations: LECTURE,
    executer: async (a, ctx) => {
      const j = ctx.aujourdhui();
      const q = (texte(a.recherche, 'recherche', 200) ?? '').toLowerCase();
      const chiffres = telephoneNormalise(q);
      const statuts = Array.isArray(a.statuts) ? a.statuts.map((s) => choix(s, 'statuts', STATUTS)!).filter(Boolean) : [];
      const suivi = choix(a.suivi_par, 'suivi_par', RESPONSABLES);
      const limite = Math.min(100, Math.max(1, Number.isInteger(a.limite) ? (a.limite as number) : 25));
      const decalage = Math.max(0, Number.isInteger(a.decalage) ? (a.decalage as number) : 0);
      const trouves = (await ctx.depot.tous())
        .filter((c) => !statuts.length || statuts.includes(c.statut))
        .filter((c) => !suivi || c.responsable === suivi)
        .filter((c) => !a.a_traiter_aujourdhui || aTraiterLe(c, j))
        .filter(
          (c) =>
            !q ||
            [c.nom, c.email, c.ville, c.typeBien, c.notes, c.motifAttente].some((v) => (v ?? '').toLowerCase().includes(q)) ||
            (chiffres.length >= 3 && telephoneNormalise(c.telephone).includes(chiffres)),
        )
        .sort((x, y) => (x.relanceLe ?? '9999').localeCompare(y.relanceLe ?? '9999') || y.creeLe.localeCompare(x.creeLe));
      const page = trouves.slice(decalage, decalage + limite);
      return {
        total: trouves.length,
        renvoyes: page.length,
        decalage,
        ...(decalage + page.length < trouves.length ? { suite: decalage + page.length } : {}),
        contacts: page.map((c) => resume(c, j)),
      };
    },
  },
  {
    name: 'crm_voir',
    title: 'Fiche d’un contact',
    description: 'Fiche complète d’un contact : coordonnées, message laissé sur le site, notes, relance, historique des appels, lien vers l’ERP.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Identifiant du contact (donné par crm_chercher ou crm_resume).' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: LECTURE,
    executer: async (a, ctx) => fiche(await contactExistant(ctx, a.id), ctx.aujourdhui()),
  },
  {
    name: 'crm_ajouter',
    title: 'Ajouter un contact',
    description:
      "Ajoute une personne au CRM (étape « À appeler » par défaut). Si quelqu'un avec le même e-mail ou téléphone est déjà suivi, rien n'est créé et la fiche existante est renvoyée (forcer=true pour créer quand même).",
    inputSchema: {
      type: 'object',
      properties: {
        nom: { type: 'string', description: 'Nom et prénom.' },
        telephone: { type: 'string' },
        email: { type: 'string' },
        ville: { type: 'string' },
        type_bien: { type: 'string', description: 'Ex. T2 meublé, maison 4 pièces.' },
        notes: { type: 'string' },
        statut: proprietes.statut,
        relance_le: proprietes.relance_le,
        suivi_par: proprietes.suivi_par,
        forcer: { type: 'boolean', description: 'Créer même si un doublon est détecté.' },
      },
      required: ['nom'],
      additionalProperties: false,
    },
    annotations: ECRITURE,
    executer: async (a, ctx) => {
      const nom = texte(a.nom, 'nom', 120);
      if (!nom) throw new ErreurOutil('« nom » est obligatoire.');
      const telephone = texte(a.telephone, 'telephone', 40);
      const email = texte(a.email, 'email', 160);
      if (!telephone && !email) throw new ErreurOutil('Indiquez au moins un téléphone ou un e-mail.');
      const statut = choix(a.statut, 'statut', STATUTS) ?? 'a_appeler';
      const relance = date(a.relance_le, 'relance_le');
      const suivi = choix(a.suivi_par, 'suivi_par', RESPONSABLES);
      const tous = await ctx.depot.tous();
      const doublon = trouverDoublon(tous, { email, telephone });
      if (doublon && a.forcer !== true) {
        return { cree: false, raison: 'Déjà dans le CRM (même e-mail ou téléphone). Rien n’a été créé.', contact: fiche(doublon, ctx.aujourdhui()) };
      }
      const maintenant = ctx.maintenant();
      const base = contactDepuisDemande({ nom, email, tel: telephone, ville: texte(a.ville, 'ville', 120), typeBien: texte(a.type_bien, 'type_bien', 120) }, idContactCrm(), maintenant);
      const c: ContactCrm = {
        ...base,
        source: 'manuel',
        statut,
        notes: texte(a.notes, 'notes', 4000) ?? '',
        ...(relance ? { relanceLe: relance } : {}),
        ...(suivi ? { responsable: suivi } : {}),
        historique: [{ le: maintenant, par: AUTEUR, resultat: 'note', texte: 'Contact ajouté depuis Claude.' }],
      };
      await ctx.depot.enregistrer(c);
      return { cree: true, contact: fiche(c, ctx.aujourdhui()) };
    },
  },
  {
    name: 'crm_modifier',
    title: 'Modifier un contact',
    description:
      "Met à jour un contact : étape, date de relance, suivi, motif d'attente, notes (remplacées) ou ajout d'une note à l'historique, coordonnées. Seuls les champs fournis changent.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        statut: proprietes.statut,
        relance_le: proprietes.relance_le,
        suivi_par: proprietes.suivi_par,
        en_attente_de: { type: 'string', description: 'Pour l’étape en_attente : travaux, achat en cours, décision à deux…' },
        notes: { type: 'string', description: 'Remplace les notes de la fiche (l’ancienne version est gardée dans l’historique).' },
        ajouter_note: { type: 'string', description: 'Ajoute une note datée à l’historique (sans toucher aux notes).' },
        nom: { type: 'string' },
        telephone: { type: 'string' },
        email: { type: 'string' },
        ville: { type: 'string' },
        type_bien: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: ECRITURE,
    executer: async (a, ctx) => {
      const avant = await contactExistant(ctx, a.id);
      const maintenant = ctx.maintenant();
      let c: ContactCrm = { ...avant };
      const statut = choix(a.statut, 'statut', STATUTS);
      if (statut) c.statut = statut;
      const relance = date(a.relance_le, 'relance_le');
      if (relance === '') delete c.relanceLe;
      else if (relance) c.relanceLe = relance;
      if (a.suivi_par === '') delete c.responsable;
      else {
        const suivi = choix(a.suivi_par, 'suivi_par', RESPONSABLES);
        if (suivi) c.responsable = suivi;
      }
      const champs: [string, keyof ContactCrm, number][] = [
        ['en_attente_de', 'motifAttente', 300],
        ['nom', 'nom', 120],
        ['telephone', 'telephone', 40],
        ['email', 'email', 160],
        ['ville', 'ville', 120],
        ['type_bien', 'typeBien', 120],
      ];
      for (const [arg, cle, max] of champs) {
        const v = texte(a[arg], arg, max);
        if (v !== undefined) (c as unknown as Record<string, unknown>)[cle] = v || undefined;
      }
      if (!c.nom) throw new ErreurOutil('Le nom ne peut pas être vide.');
      const notes = texte(a.notes, 'notes', 4000);
      if (notes !== undefined && notes !== (avant.notes ?? '')) {
        // Rien ne se perd : l'ancienne version des notes reste dans l'historique.
        // Trace posée directement : noterAppel couperait le texte à 1 000 caractères (les notes vont jusqu'à 4 000).
        if (avant.notes) c.historique = [{ le: maintenant, par: AUTEUR, resultat: 'note' as ResultatAppel, texte: `Notes remplacées. Ancienne version : ${avant.notes}` }, ...(c.historique ?? [])].slice(0, 100);
        c.notes = notes;
      }
      const note = texte(a.ajouter_note, 'ajouter_note', 1000);
      if (note) c = noterAppel(c, 'note', AUTEUR, maintenant, note);
      if (statut && statut !== avant.statut) {
        c.historique = [{ le: maintenant, par: AUTEUR, resultat: 'note' as ResultatAppel, texte: `Étape : ${LIBELLE_STATUT_CRM[avant.statut]} → ${LIBELLE_STATUT_CRM[statut]}` }, ...(c.historique ?? [])].slice(0, 100);
      }
      c.majLe = maintenant;
      await ctx.depot.enregistrer(c);
      return { modifie: true, contact: fiche(c, ctx.aujourdhui()) };
    },
  },
  {
    name: 'crm_noter_appel',
    title: 'Noter un appel',
    description:
      "Enregistre le résultat d'un appel. joint : l'étape passe à « Contacté » (si elle était « À appeler » ou « À rappeler ») ; pas_de_reponse ou messagerie : compté comme tentative, « À appeler » passe à « À rappeler ». Ajouter relance_le pour prévoir le prochain appel.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        resultat: { type: 'string', enum: ['joint', 'pas_de_reponse', 'messagerie'], description: 'joint, pas_de_reponse ou messagerie (message laissé).' },
        texte: { type: 'string', description: 'Ce qui s’est dit (facultatif).' },
        relance_le: proprietes.relance_le,
      },
      required: ['id', 'resultat'],
      additionalProperties: false,
    },
    annotations: ECRITURE,
    executer: async (a, ctx) => {
      const avant = await contactExistant(ctx, a.id);
      const resultat = choix(a.resultat, 'resultat', ['joint', 'pas_de_reponse', 'messagerie'] as const);
      if (!resultat) throw new ErreurOutil('« resultat » est obligatoire : joint, pas_de_reponse ou messagerie.');
      const relance = date(a.relance_le, 'relance_le');
      let c = noterAppel(avant, resultat, AUTEUR, ctx.maintenant(), texte(a.texte, 'texte', 1000));
      if (relance === '') {
        c = { ...c };
        delete c.relanceLe;
      } else if (relance) c = { ...c, relanceLe: relance };
      await ctx.depot.enregistrer(c);
      return { note: true, etape_avant: LIBELLE_STATUT_CRM[avant.statut], etape: LIBELLE_STATUT_CRM[c.statut], contact: fiche(c, ctx.aujourdhui()) };
    },
  },
];

/* ------------------------------------------------------------ JSON-RPC */

type Id = string | number | null;
interface Requete {
  jsonrpc?: unknown;
  id?: Id;
  method?: unknown;
  params?: Record<string, unknown>;
}

export type ReponseMcp = { statut: 200; corps: unknown } | { statut: 202 } | { statut: 400; corps: unknown };

const erreur = (id: Id, code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });
const resultat = (id: Id, r: unknown) => ({ jsonrpc: '2.0', id, result: r });

async function repondre(m: Requete, ctx: ContexteMcp): Promise<unknown> {
  const id = m.id ?? null;
  switch (m.method) {
    case 'initialize': {
      const demandee = typeof m.params?.protocolVersion === 'string' ? m.params.protocolVersion : '';
      return resultat(id, {
        protocolVersion: VERSIONS_PROTOCOLE.includes(demandee) ? demandee : '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'label-maison-crm', title: 'CRM Label Maison', version: '1.0.0' },
        instructions: INSTRUCTIONS_SERVEUR,
      });
    }
    case 'ping':
      return resultat(id, {});
    case 'tools/list':
      return resultat(id, {
        tools: OUTILS.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations: { title, ...annotations } })),
      });
    case 'tools/call': {
      const nom = m.params?.name;
      const outil = OUTILS.find((o) => o.name === nom);
      if (!outil) return erreur(id, -32602, `Outil inconnu : ${String(nom)}`);
      const args = (m.params?.arguments && typeof m.params.arguments === 'object' ? m.params.arguments : {}) as Args;
      try {
        const r = await outil.executer(args, ctx);
        return resultat(id, { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }], structuredContent: r });
      } catch (e) {
        // Erreur d'utilisation ou de base : renvoyée à Claude pour qu'il corrige ou explique.
        const message = e instanceof ErreurOutil ? e.message : `Le CRM est momentanément inaccessible (${e instanceof Error ? e.message.slice(0, 200) : 'erreur'}). Réessayez dans un instant.`;
        return resultat(id, { content: [{ type: 'text', text: message }], isError: true });
      }
    }
    case 'resources/list':
      return resultat(id, { resources: [] });
    case 'prompts/list':
      return resultat(id, { prompts: [] });
    default:
      return erreur(id, -32601, `Méthode non prise en charge : ${String(m.method)}`);
  }
}

/** Traite le corps d'un POST (message JSON-RPC seul ou lot). */
export async function traiterMcp(corps: unknown, ctx: ContexteMcp): Promise<ReponseMcp> {
  const lot = Array.isArray(corps);
  const messages = (lot ? corps : [corps]) as Requete[];
  if (!messages.length || messages.some((m) => !m || typeof m !== 'object' || m.jsonrpc !== '2.0')) {
    return { statut: 400, corps: erreur(null, -32600, 'Requête JSON-RPC invalide.') };
  }
  // Notifications et réponses (sans « method » ou sans « id ») : rien à renvoyer.
  const requetes = messages.filter((m) => typeof m.method === 'string' && m.id !== undefined && m.id !== null);
  if (!requetes.length) return { statut: 202 };
  const reponses = await Promise.all(requetes.map((m) => repondre(m, ctx)));
  return { statut: 200, corps: lot ? reponses : reponses[0] };
}

