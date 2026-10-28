/**
 * Auto-contrôle de l'agent IA de la messagerie (agent-messagerie.ts) sans
 * réseau : faux Claude (réponses JSON écrites à l'avance), fausse API Repull
 * (envoi de messages avec clé d'idempotence, liste des conversations), fausse
 * base PostgREST et faux Telegram, en mémoire.
 *
 * Vérifie : réponse envoyée (signature, clé, fil, Telegram), transmission
 * (argent forcée par les garde-fous, hors fiche avec message d'attente),
 * pause, horaires, clé absente, dédoublonnage (second passage sans rien),
 * codes cachés avant 48 h, part d'appels épuisée, reprise sans double envoi
 * après une coupure, verrou, relevé des messages, relance Telegram.
 *
 * Lancement (Node 18+) :
 *   npx esbuild src/erp/data/verifier-agent.ts --bundle --platform=node --format=esm \
 *     --outfile=/tmp/verifier-agent.mjs --define:import.meta.env={} && node /tmp/verifier-agent.mjs
 */
import type Anthropic from '@anthropic-ai/sdk';
import {
  COLLECTION_AGENT,
  ID_ETAT_AGENT,
  MODELE_AGENT_DEFAUT,
  appliquerGardeFous,
  cleAgent,
  construireContexte,
  dansLesHoraires,
  intervalleReleve,
  lancerAgent,
  lireDecision,
  type ClientIA,
  type DecisionAgent,
  type EtatAgent,
  type OptionsAgent,
} from './agent-messagerie';
import { REGLAGES_AGENT_DEFAUT } from './reglages';
import { CONSIGNES_CONTROLE } from './controle-reponse';
import { DUREE_LIEN_GUIDE_S, guidesAJoindre, signerFichierStockage, texteAvecGuides } from './guides';
import { BaseErp, COLLECTION_ETAT, ID_ETAT, ID_SELECTION, type EtatRepull } from './repull-synchro';
import type { FilMessages, GuideLogement, Journal, Logement, Message, ReglagesAgent, Reservation } from './types';
import { COLLECTION_ACTIONS_AGENT } from './copilote';
import type { ActionAgent } from './types-copilote';

/* ------------------------------------------------------------ assertions */

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}`);
  }
}
function section(titre: string) {
  console.log(`\n${titre}`);
}

function json(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });
}

/* ---------------------------------------------------------- fausse base */

class FausseBase {
  lignes = new Map<string, { collection: string; id: string; donnees: unknown }>();
  cle = (c: string, id: string) => `${c}\u0000${id}`;

  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    if (url.pathname === '/auth/v1/token') return json({ access_token: 'jeton-equipe', expires_in: 3600 });
    const methode = (init?.method ?? 'GET').toUpperCase();
    if (methode === 'GET') {
      const collection = (url.searchParams.get('collection') ?? '').replace(/^eq\./, '');
      const filtre = url.searchParams.get('id');
      const ids = filtre ? new Set(filtre.replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''))) : null;
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return json(
        [...this.lignes.values()]
          .filter((l) => l.collection === collection && (!ids || ids.has(l.id)))
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(offset, offset + 1000)
          .map((l) => ({ id: l.id, donnees: JSON.parse(JSON.stringify(l.donnees)) })),
      );
    }
    for (const l of JSON.parse(String(init?.body)) as { collection: string; id: string; donnees: unknown }[]) {
      this.lignes.set(this.cle(l.collection, l.id), { collection: l.collection, id: l.id, donnees: JSON.parse(JSON.stringify(l.donnees)) });
    }
    return new Response(null, { status: 201 });
  };

  get<T>(c: string, id: string): T | undefined {
    return this.lignes.get(this.cle(c, id))?.donnees as T | undefined;
  }
  collection<T>(c: string): T[] {
    return [...this.lignes.values()].filter((l) => l.collection === c).map((l) => l.donnees as T);
  }
  poser<T extends { id: string }>(c: string, e: T) {
    this.lignes.set(this.cle(c, e.id), { collection: c, id: e.id, donnees: JSON.parse(JSON.stringify(e)) });
  }
}

/* ------------------------------------------------------- fausse API Repull */

class FauxRepull {
  appels: { chemin: string; methode: string; cle: string | null }[] = [];
  envois: { conversation: string; message: string; cle: string }[] = [];
  idempotence = new Map<string, { charge: string; reponse: Record<string, unknown> }>();
  /** Coupure simulée : le message part, mais les réponses se perdent (réseau, nouvel essai compris). */
  coupure = false;
  conversations: Record<string, unknown>[] = [];
  messages: Record<string, Record<string, unknown>[]> = {};

  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    const h = new Headers(init?.headers);
    if (h.get('authorization') !== 'Bearer sk_test_agent') return json({ error: { code: 'unauthorized' } }, 401);
    const methode = (init?.method ?? 'GET').toUpperCase();
    const cle = h.get('idempotency-key');
    this.appels.push({ chemin: url.pathname, methode, cle });
    let m: RegExpExecArray | null;
    if ((m = /^\/v1\/conversations\/([^/]+)\/messages$/.exec(url.pathname)) && methode === 'POST') {
      const corps = JSON.parse(String(init?.body)) as { message: string };
      const charge = JSON.stringify(corps);
      const deja = cle ? this.idempotence.get(cle) : undefined;
      if (deja && this.coupure) throw new TypeError('fetch failed');
      if (deja) return deja.charge === charge ? json(deja.reponse) : json({ error: { code: 'idempotency_key_reused', message: 'reused' } }, 422);
      const id = String(800000 + this.envois.length);
      const reponse = { id, conversationId: Number(m[1]), channel: 'booking', status: 'sent', direction: 'outbound', contentRewritten: false, submittedContent: corps.message, deliveredContent: corps.message };
      this.envois.push({ conversation: m[1], message: corps.message, cle: cle ?? '' });
      if (cle) this.idempotence.set(cle, { charge, reponse });
      if (this.coupure) throw new TypeError('fetch failed');
      return json(reponse);
    }
    if (url.pathname === '/v1/conversations') return json({ data: this.conversations, pagination: { hasMore: false, nextCursor: null } });
    if ((m = /^\/v1\/conversations\/([^/]+)\/messages$/.exec(url.pathname))) {
      const liste = [...(this.messages[m[1]] ?? [])].sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
      return json({ data: liste, pagination: { hasMore: false, nextCursor: null } });
    }
    return json({ error: { code: 'not_found', message: url.pathname } }, 404);
  };
}

/* ---------------------------------------------------------- faux Claude */

class FausseIA implements ClientIA {
  appels: Anthropic.MessageCreateParamsNonStreaming[] = [];
  reponses: (Partial<DecisionAgent> | 'illisible' | Error)[] = [];
  /** Second contrôle avant un envoi seul (controle-reponse.ts) : rien à signaler, compté à part. */
  controles: Anthropic.MessageCreateParamsNonStreaming[] = [];
  messages = {
    create: async (p: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> => {
      if (p.system === CONSIGNES_CONTROLE) {
        this.controles.push(p);
        const texte = JSON.stringify({ engage: false, argent: false, exception: false, donneesPerso: false });
        return { id: 'msg_controle', type: 'message', role: 'assistant', model: p.model, content: [{ type: 'text', text: texte, citations: null }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 80, output_tokens: 20 } } as unknown as Anthropic.Message;
      }
      this.appels.push(p);
      const r = this.reponses.shift() ?? { action: 'transmettre', raison: 'autre', langue: 'fr', texte: '', resume: 'Rien de prévu.' };
      if (r instanceof Error) throw r;
      // Réponse sûre par défaut : Label Maison sans choix est « Autonome » (seuil 0,7).
      const texte = r === 'illisible' ? 'Je ne sais pas.' : JSON.stringify({ action: 'repondre', raison: 'aucune', langue: 'fr', texte: '', resume: '', confiance: 0.95, intention: 'infos', ...r });
      return {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: p.model,
        content: [{ type: 'text', text: texte, citations: null }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1200, output_tokens: 120 },
      } as unknown as Anthropic.Message;
    },
  };
  /** Texte envoyé à Claude au dernier appel (contexte de la conversation). */
  get dernierContexte(): string {
    const m = this.appels[this.appels.length - 1]?.messages[0];
    return typeof m?.content === 'string' ? m.content : '';
  }
  /** Partie « fiche du logement » du dernier contexte. */
  get derniereFiche(): string {
    const t = this.dernierContexte;
    return t.slice(t.indexOf('FICHE DU LOGEMENT'), t.indexOf('RÉSERVATION'));
  }
}

/* ------------------------------------------------------------------ scénario */

const SIGNATURE = 'L’équipe Label Maison';

async function principal() {
  const base = new FausseBase();
  const repull = new FauxRepull();
  const ia = new FausseIA();
  const telegram: string[] = [];
  const fauxTelegram = (async (_u: RequestInfo | URL, init?: RequestInit) => {
    telegram.push(String((JSON.parse(String(init?.body)) as { text: string }).text));
    return json({ ok: true });
  }) as typeof fetch;
  let horloge = new Date('2026-09-25T10:00:00.000Z'); // 12:00 à Paris
  const avancer = (min: number) => (horloge = new Date(horloge.getTime() + min * 60_000));
  const iso = (decalageMin: number) => new Date(horloge.getTime() + decalageMin * 60_000).toISOString().replace('Z', '+00:00');

  const baseErp = () =>
    new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: base.fetch as typeof fetch, jeton: async () => 'jeton-equipe' });
  const options = (extra: Partial<OptionsAgent> = {}): OptionsAgent => ({
    cle: 'sk_test_agent',
    base: baseErp(),
    echeance: Date.now() + 50_000,
    budgetMois: 400,
    fetch: repull.fetch as typeof fetch,
    attendre: async () => undefined,
    maintenant: () => horloge,
    declencheur: 'planifie',
    releve: 'non',
    ia,
    telegram: { jeton: 'bot-test', chat: '-100', fetch: fauxTelegram },
    ...extra,
  });
  const reglages = (patch: Partial<ReglagesAgent> = {}) =>
    base.poser<ReglagesAgent>('reglages', { ...REGLAGES_AGENT_DEFAUT, actif: true, signature: SIGNATURE, horaires: { mode: 'toujours', debut: '08:00', fin: '22:00' }, ...patch });
  const fil = () => base.get<FilMessages>('filsMessages', 'repull-7001')!;
  const ecrireVoyageur = (id: string, texte: string) => {
    const f = fil();
    const m: Message = { id, auteur: 'voyageur', texte, envoyeLe: iso(-5) };
    base.poser<FilMessages>('filsMessages', { ...f, messages: [...f.messages, m], dernierMessageLe: m.envoyeLe, traitePar: f.traitePar === 'agent' ? 'agent' : 'en_attente', statut: f.statut === 'clos' ? 'ouvert' : f.statut });
  };

  const logement: Logement = {
    id: 'repull-101',
    nom: 'Studio Cœur de Ville',
    adresse: '12 rue Pasteur',
    ville: 'Évry-Courcouronnes',
    codePostal: '91000',
    type: 'studio',
    surfaceM2: 24,
    capacite: 2,
    chambres: 0,
    lits: [],
    statut: 'actif',
    proprietaireId: 'p1',
    residencePrincipale: false,
    serrure: 'boite_a_cles',
    fiche: {
      wifiNom: 'Box-101',
      wifiCode: 'motdepasse101',
      heureArrivee: '16:00',
      heureDepart: '11:00',
      acces: 'Boîte à clés à gauche de la porte, code 4821.',
      parking: 'Place 12 au sous-sol.',
      regles: 'Pas de fête. Non-fumeur.',
      equipements: ['wifi', 'lave-linge'],
    },
    dotationLinge: [],
    annonces: [],
    checklistLancement: [],
    repull: { id: '101' },
  };
  base.poser('logements', logement);
  const reservation: Reservation = {
    id: 'repull-5001',
    logementId: 'repull-101',
    canal: 'booking',
    voyageur: { nom: 'Alex Morgan', nbPersonnes: 2 },
    arrivee: '2026-09-26',
    depart: '2026-09-29',
    nuits: 3,
    statut: 'confirmee',
    montantBrutCentimes: 30000,
    commissionPlateformeCentimes: 4500,
    fraisMenageCentimes: 4000,
    repull: { id: '5001' },
  };
  base.poser('reservations', reservation);
  base.poser<FilMessages>('filsMessages', {
    id: 'repull-7001',
    reservationId: 'repull-5001',
    logementId: 'repull-101',
    canal: 'booking',
    voyageur: 'Alex Morgan',
    statut: 'ouvert',
    messages: [{ id: 'repull-m1', auteur: 'voyageur', texte: 'Bonjour, quel est le code du wifi ?', envoyeLe: iso(-10) }],
    dernierMessageLe: iso(-10),
    traitePar: 'en_attente',
    repull: { id: '7001', majLe: iso(-10) },
  });
  // Fil local (sans Repull) : jamais touché par l'agent.
  base.poser<FilMessages>('filsMessages', { ...fil(), id: 'fil-local', repull: undefined });

  /* ---------------------------------------------------------- outils purs */
  section('Outils');
  verifier(dansLesHoraires({ horaires: { mode: 'plage', debut: '08:00', fin: '22:00' } }, new Date('2026-09-25T10:00:00Z')), 'plage 08:00–22:00 : midi dedans');
  verifier(!dansLesHoraires({ horaires: { mode: 'plage', debut: '08:00', fin: '22:00' } }, new Date('2026-09-25T21:30:00Z')), 'plage 08:00–22:00 : 23 h 30 à Paris dehors');
  verifier(dansLesHoraires({ horaires: { mode: 'plage', debut: '22:00', fin: '07:00' } }, new Date('2026-09-25T22:30:00Z')), 'plage qui passe minuit : 0 h 30 dedans');
  verifier(lireDecision({ content: [{ type: 'text', text: 'pas du JSON', citations: null }], stop_reason: 'end_turn' }) === null, 'réponse illisible : null');
  const g = appliquerGardeFous({ action: 'repondre', raison: 'aucune', langue: 'fr', texte: 'Nous vous offrons 20 € de remise.', resume: '' }, fil());
  verifier(g.action === 'transmettre' && g.raison === 'argent' && !g.texte, 'garde-fou : réponse qui promet de l’argent → transmise, rien d’envoyé');
  verifier(intervalleReleve(400, new Date('2026-09-01T10:00:00Z'), 15) !== null && intervalleReleve(60, new Date('2026-09-10T10:00:00Z'), 15) === null, 'relevés : rythme tiré de la part d’appels restante, aucun si trop peu');
  const ctx = construireContexte(fil(), { ...logement, fiche: { ...logement.fiche, aSavoir: 'Poubelles le mardi soir.' } }, undefined, { ...REGLAGES_AGENT_DEFAUT, actif: true }, new Date('2026-09-25T10:00:00Z'));
  verifier(/- Le logement : 2 voyageurs au plus, studio sans chambre séparée, 24 m²/.test(ctx) && /- À savoir : Poubelles le mardi soir\./.test(ctx), 'contexte : taille du logement et « À savoir » transmis à l’agent');
  {
    const descriptif = {
      couchage: [{ piece: 'Chambre 1', lits: '1 lit double' }],
      conditions: { animaux: false, fetes: false, enfants: true, calme: { debut: '22:00', fin: '07:00' }, annulation: 'Modérée' },
      sejour: { nuitsMin: 2 },
      prix: { devise: 'EUR', nuit: 12000 },
      textes: { resume: 'Studio lumineux.', quartier: 'x'.repeat(2000) },
    };
    const c = construireContexte(fil(), { ...logement, descriptif }, undefined, { ...REGLAGES_AGENT_DEFAUT, actif: true }, new Date('2026-09-25T10:00:00Z'));
    verifier(
      /- Couchage : Chambre 1 : 1 lit double/.test(c) && /- Animaux : non acceptés/.test(c) && /- Fêtes et événements : interdits/.test(c) && /- Heures de calme : de 22:00 à 07:00/.test(c) && /- Durée de séjour : 2 nuits minimum/.test(c) && /- Description de l’annonce : Studio lumineux\./.test(c),
      'contexte : couchage, conditions, durée de séjour et description de l’annonce transmis',
    );
    verifier(!/120/.test(c), 'contexte : prix de base jamais donnés à l’agent (ils varient)');
    const q = /- Le quartier : (x+…)/.exec(c);
    verifier(!!q && q[1].length <= 600, 'contexte : textes longs de l’annonce raccourcis');
  }
  verifier(!/motdepasse101|code 4821/.test(ctx), 'contexte sans réservation : ni wifi ni code d’accès');

  /* --------------------------------------------------- pause, horaires, clé */
  section('Pause, horaires, clé absente');
  reglages({ actif: false });
  let p = await lancerAgent(options());
  verifier(p.statut === 'pause' && ia.appels.length === 0 && repull.appels.length === 0, 'en pause : rien (ni IA ni Repull)');
  verifier(base.get<EtatAgent>(COLLECTION_AGENT, ID_ETAT_AGENT)?.dernier?.statut === 'pause', 'passage noté dans agent/etat');
  reglages({ horaires: { mode: 'plage', debut: '08:00', fin: '11:00' } });
  p = await lancerAgent(options());
  verifier(p.statut === 'hors_horaires' && ia.appels.length === 0 && /heures de réponse/.test(p.message), 'hors des heures : rien, message clair');
  reglages();
  p = await lancerAgent(options({ ia: null }));
  verifier(p.statut === 'cle_manquante' && /ANTHROPIC_API_KEY/.test(p.message), 'clé IA absente : message clair');
  verifier(!base.get<EtatAgent>(COLLECTION_AGENT, ID_ETAT_AGENT)?.verrou, 'verrou rendu après chaque passage');

  /* ------------------------------------------------------------ réponse */
  section('Réponse envoyée');
  ia.reponses.push({ action: 'repondre', raison: 'aucune', langue: 'fr', texte: 'Bonjour Alex, le wifi est « Box-101 », mot de passe motdepasse101.', resume: 'Code wifi donné.' });
  p = await lancerAgent(options());
  verifier(p.statut === 'fait' && p.repondus === 1 && p.transmis === 0 && p.examines === 1, `un fil examiné, une réponse (${p.message})`);
  verifier(ia.controles.length === 1 && !JSON.stringify(ia.controles[0]).includes('quel est le code du wifi'), 'second contrôle de la réponse avant l’envoi (Label Maison sans choix aussi), sans le message du voyageur');
  const appelIA = ia.appels[0];
  verifier(appelIA?.model === MODELE_AGENT_DEFAUT && appelIA.output_config?.format?.type === 'json_schema', 'Claude Haiku 4.5, sortie JSON imposée');
  verifier(/motdepasse101/.test(ia.derniereFiche) && /Booking\.com/.test(ia.dernierContexte), 'contexte : fiche avec codes (arrivée demain), plateforme');
  const posts = repull.appels.filter((a) => a.methode === 'POST');
  verifier(posts.length === 1 && posts[0].chemin === '/v1/conversations/7001/messages' && posts[0].cle === cleAgent('repull-7001', 'repull-m1'), 'un seul envoi Repull, clé liée au message du voyageur');
  verifier(repull.envois[0]?.message.endsWith(`\n\n${SIGNATURE}`), 'signature ajoutée par le code');
  let f = fil();
  const rep = f.messages[f.messages.length - 1];
  verifier(rep.auteur === 'agent' && rep.id === 'repull-800000' && rep.envoi?.canal === 'booking', 'réponse écrite dans le fil (auteur agent, id Repull)');
  verifier(f.agent?.dernierMessageTraite === 'repull-m1' && !f.agent?.enCours && f.traitePar === 'agent' && f.statut === 'ouvert', 'suivi : message traité, marqueur retiré, fil suivi par l’agent');
  verifier(telegram.length === 1 && /Réponse de votre agent/.test(telegram[0]), 'copie de la réponse sur Telegram');
  verifier(base.get<EtatRepull>(COLLECTION_ETAT, ID_ETAT)?.appelsMois === 1 && p.appelsRepull === 1, 'appel Repull compté dans la part du mois');
  verifier(base.get<FilMessages>('filsMessages', 'fil-local')?.agent === undefined, 'fil sans Repull : ignoré');

  section('Dédoublonnage');
  p = await lancerAgent(options());
  verifier(p.examines === 0 && ia.appels.length === 1 && repull.envois.length === 1, 'second passage : rien à faire, aucun appel');

  /* -------------------------------------------------------- transmissions */
  section('Transmission : argent (garde-fou)');
  ecrireVoyageur('repull-m2', 'Le ménage n’était pas fait, pouvez-vous me rembourser une nuit ?');
  ia.reponses.push({ action: 'repondre', raison: 'aucune', langue: 'fr', texte: 'Bien sûr, nous vous remboursons.', resume: 'Demande de remboursement.' });
  telegram.length = 0;
  p = await lancerAgent(options());
  f = fil();
  verifier(p.transmis === 1 && p.repondus === 0 && repull.envois.length === 1, 'argent : transmis, rien envoyé au voyageur');
  verifier(f.statut === 'escalade' && f.raisonEscalade === 'argent' && f.traitePar === 'en_attente' && f.agent?.decision === 'transmettre' && !!f.agent.resume, 'fil escaladé (argent) avec résumé : visible dans « À répondre »');
  verifier(base.collection<Journal>('journal').some((j) => j.auteur === 'Agent IA' && /transmise/.test(j.details)), 'journal : transmission notée');
  verifier(telegram.length === 1 && /à vous de jouer/.test(telegram[0]), 'alerte Telegram');
  p = await lancerAgent(options());
  verifier(p.examines === 0 && ia.appels.length === 2, 'fil transmis : plus touché par l’agent');

  section('Relance Telegram');
  avancer(45);
  telegram.length = 0;
  p = await lancerAgent(options());
  verifier(p.relances === 1 && telegram.length === 1 && /Toujours sans réponse/.test(telegram[0]), 'personne n’a répondu après 30 min : relance');
  p = await lancerAgent(options());
  verifier(p.relances === 0 && telegram.length === 1, 'une seule relance');

  section('Transmission : hors fiche, avec message d’attente');
  // Un sujet sensible compte pour tout le séjour (messagesSujets) : la suite du scénario repart sans la demande de remboursement.
  base.poser<FilMessages>('filsMessages', { ...fil(), messages: fil().messages.filter((m) => m.id !== 'repull-m2'), statut: 'ouvert', traitePar: 'humain', raisonEscalade: undefined });
  base.poser<Reservation>('reservations', { ...reservation, arrivee: '2026-10-10', depart: '2026-10-13' });
  ecrireVoyageur('repull-m3', 'Y a-t-il une piscine près du logement ?');
  ia.reponses.push({ action: 'transmettre', raison: 'hors_fiche', langue: 'fr', texte: 'Bonjour Alex, je vérifie avec l’équipe et je reviens vers vous.', resume: 'Demande une piscine à proximité : pas dans la fiche.' });
  p = await lancerAgent(options());
  f = fil();
  verifier(!/motdepasse101|4821|Box-101/.test(ia.derniereFiche) && /pas encore communicables/.test(ia.derniereFiche) && /16:00/.test(ia.derniereFiche), 'arrivée dans 15 jours : codes et wifi absents de la fiche donnée à Claude');
  verifier(p.transmis === 1 && repull.envois.length === 2 && repull.envois[1].message.endsWith(SIGNATURE), 'message d’attente envoyé (signé)');
  verifier(f.statut === 'escalade' && f.raisonEscalade === 'hors_fiche' && f.messages[f.messages.length - 1].auteur === 'agent' && !f.agent?.enCours, 'fil escaladé (hors fiche) après le message d’attente');

  section('Réponse illisible');
  base.poser<FilMessages>('filsMessages', { ...fil(), statut: 'ouvert', traitePar: 'agent' });
  ecrireVoyageur('repull-m4', 'Merci !');
  ia.reponses.push('illisible');
  p = await lancerAgent(options());
  verifier(p.transmis === 1 && fil().raisonEscalade === 'autre' && repull.envois.length === 2, 'réponse de Claude illisible : transmis (autre), rien envoyé');

  /* ------------------------------------------------------ part épuisée */
  section('Part d’appels Repull épuisée');
  base.poser<FilMessages>('filsMessages', { ...fil(), statut: 'ouvert', traitePar: 'agent' });
  ecrireVoyageur('repull-m5', 'À quelle heure est le départ ?');
  const etat = base.get<EtatRepull>(COLLECTION_ETAT, ID_ETAT)!;
  const iaAvant = ia.appels.length;
  p = await lancerAgent(options({ budgetMois: etat.appelsMois }));
  verifier(p.statut === 'budget' && ia.appels.length === iaAvant && /épuisés/.test(p.message), 'part épuisée : aucun appel à Claude ni à Repull, message clair');
  verifier(!fil().agent?.enCours && fil().agent?.dernierMessageTraite !== 'repull-m5', 'le message attend toujours (rien de marqué)');

  /* ---------------------------------------------- coupure pendant l'envoi */
  section('Coupure pendant l’envoi : reprise sans double envoi');
  ia.reponses.push({ action: 'repondre', raison: 'aucune', langue: 'fr', texte: 'Bonjour Alex, le départ se fait avant 11 h.', resume: 'Heure de départ donnée.' });
  repull.coupure = true;
  const envoisAvant = repull.envois.length;
  p = await lancerAgent(options());
  repull.coupure = false;
  f = fil();
  verifier(repull.envois.length === envoisAvant + 1, 'le message est parti (réponse perdue)');
  verifier(f.agent?.enCours?.messageId === 'repull-m5' && f.agent.enCours.cle === cleAgent('repull-7001', 'repull-m5'), 'marqueur « envoi en cours » gardé');
  const iaAvantReprise = ia.appels.length;
  p = await lancerAgent(options());
  f = fil();
  verifier(repull.envois.length === envoisAvant + 1, 'reprise : même texte, même clé, Repull rejoue, rien ne repart');
  verifier(ia.appels.length === iaAvantReprise, 'reprise : Claude pas rappelé');
  verifier(p.repondus === 1 && f.agent?.dernierMessageTraite === 'repull-m5' && !f.agent?.enCours && f.messages.filter((m) => m.auteur === 'agent' && /11 h/.test(m.texte)).length === 1, 'reprise : réponse écrite une fois, marqueur retiré');

  section('Deux passages en même temps');
  base.poser<EtatAgent>(COLLECTION_AGENT, { ...base.get<EtatAgent>(COLLECTION_AGENT, ID_ETAT_AGENT)!, verrou: { jusqua: horloge.getTime() + 60_000, id: 'autre' } });
  ecrireVoyageur('repull-m6', 'Et le parking ?');
  p = await lancerAgent(options());
  verifier(p.statut === 'occupe' && ia.appels.length === iaAvantReprise, 'verrou tenu par un autre passage : rien');
  verifier(base.get<EtatAgent>(COLLECTION_AGENT, ID_ETAT_AGENT)?.verrou?.id === 'autre', 'le verrou de l’autre passage est respecté');
  base.poser<EtatAgent>(COLLECTION_AGENT, { id: ID_ETAT_AGENT });
  // Un autre passage a déjà répondu à ce message avec un autre texte (même clé) : rien ne repart.
  repull.idempotence.set(cleAgent('repull-7001', 'repull-m6'), { charge: JSON.stringify({ message: 'autre texte' }), reponse: { id: '1' } });
  ia.reponses.push({ action: 'repondre', raison: 'aucune', langue: 'fr', texte: 'Place 12 au sous-sol.', resume: 'Parking.' });
  const envoisAvantDouble = repull.envois.length;
  p = await lancerAgent(options());
  verifier(repull.envois.length === envoisAvantDouble && fil().agent?.dernierMessageTraite === 'repull-m6' && !fil().agent?.enCours, 'clé déjà utilisée : aucun second message, fil marqué traité');

  /* --------------------------------------------------- relevé des messages */
  section('Relevé des nouveaux messages chez Repull');
  base.poser(COLLECTION_ETAT, { id: ID_SELECTION, annonces: ['101'], limite: 3, majLe: iso(0), majPar: 'test' });
  avancer(10);
  repull.conversations = [{ id: '7001', platform: 'booking', listingId: '101', reservationId: '5001', lastMessageAt: iso(-1), updatedAt: iso(-1) }];
  repull.messages['7001'] = [{ id: 'm7', direction: 'inbound', senderName: 'Alex', body: 'On peut laisser les bagages ?', sentAt: iso(-1) }];
  base.poser<FilMessages>('filsMessages', { ...fil(), statut: 'ouvert', traitePar: 'agent' });
  ia.reponses.push({ action: 'transmettre', raison: 'exception', langue: 'fr', texte: '', resume: 'Demande de dépôt de bagages.' });
  p = await lancerAgent(options({ releve: 'force', declencheur: 'manuel' }));
  verifier(!!p.releve && p.releve.messages === 1 && repull.appels.some((a) => a.chemin === '/v1/conversations'), `bouton : relevé des messages fait (${p.releve?.appels} appels)`);
  verifier(p.transmis === 1 && fil().raisonEscalade === 'exception' && fil().agent?.dernierMessageTraite === 'repull-m7', 'le message relevé est traité dans le même passage');
  verifier(!!base.get<EtatAgent>(COLLECTION_AGENT, ID_ETAT_AGENT)?.dernierReleve, 'date du relevé gardée (rythme du mode planifié)');
  const avantAuto = repull.appels.length;
  await lancerAgent(options({ releve: 'auto' }));
  verifier(repull.appels.length === avantAuto, 'planifié juste après : pas de nouveau relevé (économie d’appels)');

  /* ------------------------------------------- guides et questions fréquentes */
  section('Guides et questions fréquentes');
  {
    const guides: GuideLogement[] = [
      { id: 'g-cle', titre: 'Récupérer la clé', quand: 'le voyageur demande comment entrer', media: { type: 'video', fichier: 'stockage://erp-fichiers/guides/cle.mp4' }, acces: true, ajouteLe: iso(0), ajoutePar: 'Abdel' },
      { id: 'g-four', titre: 'Utiliser le four', media: { type: 'lien', url: 'https://youtu.be/exemple-four' }, ajouteLe: iso(0), ajoutePar: 'Abdel' },
      { id: 'g-casse', titre: 'Sans lien valable', media: { type: 'lien', url: 'http://pas-sur/x' }, ajouteLe: iso(0), ajoutePar: 'Abdel' },
    ];
    const questions = [
      { id: 'q1', question: 'Où jeter les poubelles ?', reponse: 'Local au rez-de-chaussée, à droite de l’entrée.' },
      { id: 'q2', question: '  ', reponse: 'Incomplète : ignorée.' },
    ];
    const avecGuides: Logement = { ...logement, fiche: { ...logement.fiche, guides, questions } };

    // Outils purs.
    const a = guidesAJoindre(['g-four', 'inconnu', 'g-four', 'g-cle', 'g-casse'], guides, false);
    verifier(a.joints.map((g) => g.id).join() === 'g-four' && a.retires.map((g) => g.id).join() === 'g-cle', 'guides : id inconnu, doublon et guide sans lien valable ignorés ; guide d’accès retenu avant l’heure');
    const b = guidesAJoindre(['g-cle', 'g-four', 'g-four'], guides, true);
    verifier(b.joints.map((g) => g.id).join() === 'g-cle,g-four' && !b.retires.length, 'guides : accès permis, deux guides joints au plus');
    verifier(texteAvecGuides('Bonjour.', [{ titre: 'Four', lien: 'https://x.fr/f' }]) === 'Bonjour.\n\nFour : https://x.fr/f', 'texte : « Titre : lien » après la réponse');
    const signe = await signerFichierStockage(
      {
        url: 'https://base.test',
        cleAnon: 'anon',
        jeton: async () => 'jeton-equipe',
        fetch: (async (u: RequestInfo | URL, init?: RequestInit) => {
          const ok =
            String(u) === 'https://base.test/storage/v1/object/sign/erp-fichiers/guides/cle.mp4' &&
            new Headers(init?.headers).get('authorization') === 'Bearer jeton-equipe' &&
            JSON.parse(String(init?.body)).expiresIn === DUREE_LIEN_GUIDE_S;
          return ok ? json({ signedURL: '/object/sign/erp-fichiers/guides/cle.mp4?token=t7' }) : json({ error: 'refus' }, 400);
        }) as typeof fetch,
      },
      'stockage://erp-fichiers/guides/cle.mp4',
      DUREE_LIEN_GUIDE_S,
    );
    verifier(signe === 'https://base.test/storage/v1/object/sign/erp-fichiers/guides/cle.mp4?token=t7', `lien signé de 7 jours pour un fichier déposé (${signe})`);
    verifier(
      (await signerFichierStockage({ jeton: async () => 'j', fetch: (async () => json({ signedURL: '/x' })) as typeof fetch }, 'stockage://erp-fichiers/../secret', 60)) === null,
      'lien signé : chemin avec « .. » refusé',
    );

    // Contexte : questions fréquentes dans la fiche, guides sans adresse.
    const sansResa = construireContexte(fil(), avecGuides, undefined, { ...REGLAGES_AGENT_DEFAUT, actif: true }, horloge);
    verifier(
      /- Question fréquente : Où jeter les poubelles \? → Réponse : Local au rez-de-chaussée/.test(sansResa) && !/Incomplète/.test(sansResa),
      'contexte : questions fréquentes complètes transmises comme réponses sûres',
    );
    verifier(
      /\[g-four\] Utiliser le four \(lien\)/.test(sansResa) && !/g-cle|g-casse/.test(sansResa) && /Guides d’accès \(clé, code\) : envoyés dans les 48 heures/.test(sansResa) && !/youtu\.be|stockage:\/\//.test(sansResa),
      'contexte : guides par id sans adresse ; guide d’accès caché avant l’heure ; guide sans lien valable écarté',
    );
    const avecResa = construireContexte(fil(), avecGuides, reservation, { ...REGLAGES_AGENT_DEFAUT, actif: true }, horloge);
    verifier(/\[g-cle\] Récupérer la clé \(vidéo\) — à envoyer : le voyageur demande comment entrer/.test(avecResa), 'contexte : guide d’accès proposé quand les codes sont communicables');

    // Réponse avec deux guides (dont un fichier signé) et un id inventé ; arrivée demain : codes communicables.
    base.poser('reservations', reservation);
    base.poser('logements', avecGuides);
    base.poser<FilMessages>('filsMessages', { ...fil(), statut: 'ouvert', traitePar: 'agent' });
    avancer(5);
    ecrireVoyageur('repull-m8', 'Comment je récupère la clé ? Et le four ?');
    ia.reponses.push({ action: 'repondre', raison: 'aucune', langue: 'fr', texte: 'Bonjour Alex, je vous joins deux courtes vidéos.', resume: 'Clé et four expliqués.', guides: ['g-cle', 'g-four', 'g-invente'] });
    const signatures: string[] = [];
    const avantGuides = repull.envois.length;
    p = await lancerAgent(
      options({
        signerFichier: async (f, secondes) => {
          signatures.push(`${f}|${secondes}`);
          return 'https://base.test/storage/v1/object/sign/erp-fichiers/guides/cle.mp4?token=t7';
        },
      }),
    );
    const envoye = repull.envois[avantGuides]?.message ?? '';
    verifier(p.repondus === 1 && envoye.startsWith('Bonjour Alex, je vous joins deux courtes vidéos.\n\n'), `réponse envoyée avec ses guides (${p.message})`);
    verifier(
      envoye.includes('Récupérer la clé : https://base.test/storage/v1/object/sign/erp-fichiers/guides/cle.mp4?token=t7') &&
        envoye.includes('Utiliser le four : https://youtu.be/exemple-four') &&
        envoye.endsWith(`\n\n${SIGNATURE}`),
      `liens ajoutés par le serveur avant la signature (${JSON.stringify(envoye)})`,
    );
    verifier(signatures.join() === `stockage://erp-fichiers/guides/cle.mp4|${DUREE_LIEN_GUIDE_S}` && !/invente/.test(envoye), 'fichier signé pour 7 jours, id inventé ignoré');
    verifier(/Guides joints : « Récupérer la clé », « Utiliser le four »/.test(fil().agent?.resume ?? ''), `suivi : guides notés pour l’équipe (${fil().agent?.resume})`);

    // Guide d'accès demandé trop tôt : retenu, la réponse part sans lui.
    base.poser('reservations', { ...reservation, arrivee: '2026-10-20', depart: '2026-10-23' });
    avancer(5);
    ecrireVoyageur('repull-m9', 'Vous pouvez m’envoyer la vidéo pour la clé ?');
    ia.reponses.push({ action: 'repondre', raison: 'aucune', langue: 'fr', texte: 'Bonjour Alex, vous la recevrez 48 heures avant votre arrivée.', resume: 'Vidéo de la clé demandée.', guides: ['g-cle'] });
    const avantTot = repull.envois.length;
    p = await lancerAgent(options({ signerFichier: async () => 'https://base.test/signe' }));
    const tot = repull.envois[avantTot]?.message ?? '';
    verifier(
      p.repondus === 1 && !/signe|Récupérer la clé :/.test(tot) && /retenu : accès pas encore communicable/.test(fil().agent?.resume ?? ''),
      'guide d’accès avant 48 h : retiré du message, noté pour l’équipe',
    );
    base.poser('reservations', reservation);
    base.poser('logements', logement);
  }

  /* ------------------------------------------- actions de l'IA (copilote) */
  section('Actions de l’IA : chaque décision tracée, sans code ni wifi');
  {
    const actions = base.collection<ActionAgent>(COLLECTION_ACTIONS_AGENT);
    const envois = actions.filter((a) => a.outil === 'agent_envoi');
    verifier(envois.length > 0 && envois.every((a) => a.etat === 'faite' && a.effet === 'externe' && !a.annulable && !!a.pasAnnulable), `réponses envoyées seules : tracées, externes, jamais annulables (${envois.length})`);
    const transmis = actions.filter((a) => a.outil === 'agent_transmission');
    verifier(transmis.length > 0 && transmis.every((a) => a.etat === 'faite' && !a.annulable), `transmissions tracées, non annulables (${transmis.length})`);
    verifier(transmis.some((a) => a.effet === 'externe' && a.changements.some((c) => c.champ === 'Message d’attente envoyé')), 'transmission avec message d’attente : effet externe, message noté');
    verifier(actions.every((a) => a.source === 'agent' && a.client?.genre === 'agent' && a.collection === 'filsMessages' && /^\/erp\/messagerie\//.test(a.lien ?? '')), 'traces de l’agent : source, conversation, lien');
    const texte = JSON.stringify(actions);
    verifier(!/motdepasse101|Box-101|4821/.test(texte), 'aucune trace ne contient le wifi ou le code d’accès (réponse qui les donnait comprise)');
    verifier(envois.length + transmis.length >= 3, 'une trace par décision prise pendant les passages');
  }

  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
}

principal().catch((e) => {
  console.error(e);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
});
