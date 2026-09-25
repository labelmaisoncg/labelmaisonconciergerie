/**
 * Persistance.
 *
 * Deux pilotes derrière la même API :
 *  - Postgres, dès que DATABASE_URL est renseignée. C'est le mode réel.
 *  - mémoire, sinon. Utile pour le banc d'essai local, INUTILISABLE en
 *    serverless : chaque démarrage à froid repart de zéro, un onboarding
 *    interrompu serait perdu. Le démarrage le signale bruyamment.
 *
 * Schéma : sql/schema.sql, à exécuter une fois sur la base.
 */

import postgres from 'postgres';
import { chatAutorise } from './config.js';

const URL_BASE = process.env.DATABASE_URL || '';
export const persistanceReelle = (): boolean => Boolean(URL_BASE);

const sql = URL_BASE
  ? postgres(URL_BASE, {
      // En serverless, une connexion par invocation : inutile d'en garder un
      // pool ouvert, et les bases gratuites plafonnent vite.
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false, // requis derrière un pooler type PgBouncer
    })
  : null;

if (!sql) {
  console.warn(
    '[store] DATABASE_URL absente — stockage en MÉMOIRE. ' +
      'La configuration sera perdue à chaque redémarrage. Ne pas déployer ainsi.',
  );
}

// --- Types du domaine ---

export type Conciergerie = {
  id: string;
  nom: string;
  styleProfil: string | null;
  styleExemples: string[];
};

export type Logement = {
  id: string;
  conciergerieId: string;
  nom: string;
  ville: string | null;
  /** Annonce Repull (`listings.id`). null tant qu'aucun compte n'est relié. */
  repullListingId: string | null;
  airbnbConnecte: boolean;
  bookingConnecte: boolean;
  cleBoite: string | null;
  wifiNom: string | null;
  wifiCode: string | null;
  heureArrivee: string | null;
  heureDepart: string | null;
  consignes: string | null;
};

export type Connaissance = {
  id: string;
  logementId: string | null;
  question: string;
  reponse: string;
};

export type ActionEnAttente = {
  id: string;
  conciergerieId: string;
  chatId: string;
  outil: string;
  arguments: Record<string, unknown>;
  recap: string;
};

// --- Pilote mémoire ---

const mem = {
  conciergeries: new Map<string, Conciergerie>(),
  membres: new Map<string, string>(), // chatId -> conciergerieId
  roles: new Map<string, Role>(), // chatId -> rôle
  traites: new Set<string>(), // `${threadId}:${messageId}` — messages voyageurs pris en charge
  logements: [] as Logement[],
  connaissances: [] as Array<Connaissance & { conciergerieId: string }>,
  actions: new Map<string, ActionEnAttente>(),
  conversations: new Map<string, Array<{ role: string; contenu: unknown }>>(),
  liens: new Map<string, LienConnexion & { ouvertLe: number | null }>(),
  comptes: new Map<string, string>(), // `${canal}:${compteId}` -> conciergerieId
  reservationsVues: new Map<string, { bookingId: string | null; statut: string; arrivee: string | null; depart: string | null }>(),
  invitations: new Map<string, Invitation>(),
  souvenirs: [] as Array<Souvenir & { conciergerieId: string }>,
  resumes: new Map<string, string>(),
  initiatives: new Set<string>(),
  compteur: 0,
};
const idMem = () => `mem-${++mem.compteur}`;

// --- Conciergeries et membres ---

export async function conciergerieParChat(chatId: string | number): Promise<Conciergerie | null> {
  const chat = String(chatId);
  if (!sql) {
    const id = mem.membres.get(chat);
    return id ? (mem.conciergeries.get(id) ?? null) : null;
  }
  const [r] = await sql<any[]>`
    select c.id, c.nom, c.style_profil, c.style_exemples
    from conciergeries c
    join membres m on m.conciergerie_id = c.id
    where m.chat_id = ${chat} and c.actif
    limit 1`;
  return r
    ? {
        id: r.id,
        nom: r.nom,
        styleProfil: r.style_profil,
        styleExemples: r.style_exemples ?? [],
      }
    : null;
}

export async function creerConciergerie(nom: string, chatId: string | number): Promise<Conciergerie> {
  const chat = String(chatId);
  if (!sql) {
    const c: Conciergerie = {
      id: idMem(),
      nom,
      styleProfil: null,
      styleExemples: [],
    };
    mem.conciergeries.set(c.id, c);
    mem.membres.set(chat, c.id);
    mem.roles.set(chat, 'proprietaire');
    return c;
  }
  const [c] = await sql<any[]>`
    insert into conciergeries (nom)
    values (${nom})
    returning id, nom, style_profil, style_exemples`;
  await sql`
    insert into membres (conciergerie_id, chat_id, role)
    values (${c.id}, ${chat}, 'proprietaire')
    on conflict (chat_id) do update set conciergerie_id = excluded.conciergerie_id`;
  return {
    id: c.id,
    nom: c.nom,
    styleProfil: c.style_profil,
    styleExemples: c.style_exemples ?? [],
  };
}

/** Les vrais noms arrivent après la connexion, pas avant : on renomme ce qui a
 *  été créé sous un intitulé provisoire. */
export async function renommerConciergerie(id: string, nom: string): Promise<void> {
  if (!sql) {
    const c = mem.conciergeries.get(id);
    if (c) c.nom = nom;
    return;
  }
  await sql`update conciergeries set nom = ${nom} where id = ${id}`;
}

export async function renommerLogement(
  id: string,
  nom: string,
  ville: string | null,
): Promise<void> {
  if (!sql) {
    const l = mem.logements.find((x) => x.id === id);
    if (l) {
      l.nom = nom;
      if (ville) l.ville = ville;
    }
    return;
  }
  await sql`
    update logements
    set nom = ${nom}, ville = coalesce(${ville}, ville)
    where id = ${id}`;
}

export async function enregistrerStyle(
  conciergerieId: string,
  profil: string,
  exemples: string[],
): Promise<void> {
  if (!sql) {
    const c = mem.conciergeries.get(conciergerieId);
    if (c) {
      c.styleProfil = profil;
      c.styleExemples = exemples;
    }
    return;
  }
  await sql`
    update conciergeries
    set style_profil = ${profil}, style_exemples = ${sql.json(exemples)}
    where id = ${conciergerieId}`;
}

// --- Logements ---

export async function logements(conciergerieId: string): Promise<Logement[]> {
  if (!sql) return mem.logements.filter((l) => l.conciergerieId === conciergerieId);
  const rs = await sql<any[]>`
    select * from logements where conciergerie_id = ${conciergerieId} and actif order by nom`;
  return rs.map(versLogement);
}

/** Résolution par nom, tolérante : « massy » trouve « Studio de Massy ». */
export async function logementParNom(
  conciergerieId: string,
  nom: string,
): Promise<Logement | null> {
  const n = nom.trim().toLowerCase();
  const tous = await logements(conciergerieId);
  return (
    tous.find((l) => l.nom.toLowerCase() === n) ??
    tous.find((l) => l.nom.toLowerCase().includes(n)) ??
    tous.find((l) => n.includes(l.nom.toLowerCase())) ??
    null
  );
}

export async function creerLogement(
  conciergerieId: string,
  nom: string,
  ville: string | null,
  repullListingId: string | null,
): Promise<Logement> {
  if (!sql) {
    const l: Logement = {
      id: idMem(),
      conciergerieId,
      nom,
      ville,
      repullListingId,
      airbnbConnecte: false,
      bookingConnecte: false,
      cleBoite: null,
      wifiNom: null,
      wifiCode: null,
      heureArrivee: null,
      heureDepart: null,
      consignes: null,
    };
    mem.logements.push(l);
    return l;
  }
  const [r] = await sql<any[]>`
    insert into logements (conciergerie_id, nom, ville, repull_listing_id)
    values (${conciergerieId}, ${nom}, ${ville}, ${repullListingId})
    returning *`;
  return versLogement(r);
}

export async function majLogement(
  logementId: string,
  champs: Partial<Record<string, unknown>>,
): Promise<void> {
  if (!sql) {
    const l = mem.logements.find((x) => x.id === logementId);
    if (l) Object.assign(l, champs);
    return;
  }
  const colonnes: Record<string, string> = {
    airbnbConnecte: 'airbnb_connecte',
    bookingConnecte: 'booking_connecte',
    repullListingId: 'repull_listing_id',
    cleBoite: 'cle_boite',
    wifiNom: 'wifi_nom',
    wifiCode: 'wifi_code',
    heureArrivee: 'heure_arrivee',
    heureDepart: 'heure_depart',
    consignes: 'consignes',
  };
  for (const [cle, valeur] of Object.entries(champs)) {
    const col = colonnes[cle];
    if (!col) continue;
    await sql`update logements set ${sql(col)} = ${valeur as any} where id = ${logementId}`;
  }
}

const versLogement = (r: any): Logement => ({
  id: r.id,
  conciergerieId: r.conciergerie_id,
  nom: r.nom,
  ville: r.ville,
  repullListingId: r.repull_listing_id,
  airbnbConnecte: r.airbnb_connecte,
  bookingConnecte: r.booking_connecte,
  cleBoite: r.cle_boite,
  wifiNom: r.wifi_nom,
  wifiCode: r.wifi_code,
  heureArrivee: r.heure_arrivee,
  heureDepart: r.heure_depart,
  consignes: r.consignes,
});

// --- Base de connaissances ---

export async function ajouterConnaissances(
  conciergerieId: string,
  logementId: string | null,
  entrees: Array<{ question: string; reponse: string }>,
  source = 'manuel',
): Promise<number> {
  if (entrees.length === 0) return 0;
  if (!sql) {
    for (const e of entrees) {
      mem.connaissances.push({ id: idMem(), conciergerieId, logementId, ...e });
    }
    return entrees.length;
  }
  await sql`
    insert into connaissances ${sql(
      entrees.map((e) => ({
        conciergerie_id: conciergerieId,
        logement_id: logementId,
        question: e.question,
        reponse: e.reponse,
        source,
      })),
    )}`;
  return entrees.length;
}

export async function connaissances(
  conciergerieId: string,
  logementId?: string | null,
): Promise<Connaissance[]> {
  if (!sql) {
    return mem.connaissances
      .filter((c) => c.conciergerieId === conciergerieId)
      .filter((c) => !logementId || c.logementId === logementId || c.logementId === null);
  }
  const rs = logementId
    ? await sql<any[]>`
        select id, logement_id, question, reponse from connaissances
        where conciergerie_id = ${conciergerieId}
          and (logement_id = ${logementId} or logement_id is null)`
    : await sql<any[]>`
        select id, logement_id, question, reponse from connaissances
        where conciergerie_id = ${conciergerieId}`;
  return rs.map((r) => ({
    id: r.id,
    logementId: r.logement_id,
    question: r.question,
    reponse: r.reponse,
  }));
}

// --- Mémoire de conversation ---

export async function historique(
  chatId: string | number,
  limite = 20,
): Promise<Array<{ role: 'user' | 'assistant'; contenu: any }>> {
  const chat = String(chatId);
  if (!sql) return (mem.conversations.get(chat) ?? []).slice(-limite) as any;
  const rs = await sql<any[]>`
    select role, contenu from conversations
    where chat_id = ${chat}
    order by cree_le desc limit ${limite}`;
  return rs.reverse().map((r) => ({ role: r.role, contenu: r.contenu }));
}

export async function ajouterAuFil(
  chatId: string | number,
  conciergerieId: string | null,
  role: 'user' | 'assistant',
  contenu: unknown,
): Promise<void> {
  const chat = String(chatId);
  if (!sql) {
    const fil = mem.conversations.get(chat) ?? [];
    fil.push({ role, contenu });
    mem.conversations.set(chat, fil);
    return;
  }
  await sql`
    insert into conversations (chat_id, conciergerie_id, role, contenu)
    values (${chat}, ${conciergerieId}, ${role}, ${sql.json(contenu as any)})`;
}

// --- Actions en attente de confirmation ---

export async function deposerAction(a: Omit<ActionEnAttente, 'id'>): Promise<string> {
  if (!sql) {
    const id = idMem();
    mem.actions.set(id, { id, ...a });
    return id;
  }
  const [r] = await sql<any[]>`
    insert into actions_en_attente (conciergerie_id, chat_id, outil, arguments, recap)
    values (${a.conciergerieId}, ${a.chatId}, ${a.outil}, ${sql.json(a.arguments as any)}, ${a.recap})
    returning id`;
  return r.id;
}

/** Lit une action encore en attente SANS la consommer — pour vérifier qui a
 *  le droit de la confirmer avant d'y toucher. */
export async function lireAction(id: string): Promise<ActionEnAttente | null> {
  if (!sql) return mem.actions.get(id) ?? null;
  const [r] = await sql<any[]>`
    select id, conciergerie_id, chat_id, outil, arguments, recap
    from actions_en_attente
    where id = ${id} and statut = 'attente' and expire_le > now()`;
  return r
    ? {
        id: r.id,
        conciergerieId: r.conciergerie_id,
        chatId: r.chat_id,
        outil: r.outil,
        arguments: r.arguments,
        recap: r.recap,
      }
    : null;
}

export async function retirerAction(id: string, statut: 'confirmee' | 'refusee'): Promise<ActionEnAttente | null> {
  if (!sql) {
    const a = mem.actions.get(id) ?? null;
    mem.actions.delete(id);
    return a;
  }
  const [r] = await sql<any[]>`
    update actions_en_attente set statut = ${statut}
    where id = ${id} and statut = 'attente' and expire_le > now()
    returning id, conciergerie_id, chat_id, outil, arguments, recap`;
  return r
    ? {
        id: r.id,
        conciergerieId: r.conciergerie_id,
        chatId: r.chat_id,
        outil: r.outil,
        arguments: r.arguments,
        recap: r.recap,
      }
    : null;
}

// --- Journal et déduplication ---

export async function journaliser(
  conciergerieId: string | null,
  chatId: string | null,
  outil: string,
  args: unknown,
  resultat: unknown,
): Promise<void> {
  if (!sql) return;
  await sql`
    insert into actions_log (conciergerie_id, chat_id, outil, arguments, resultat)
    values (${conciergerieId}, ${chatId}, ${outil}, ${sql.json(args as any)}, ${sql.json(resultat as any)})`;
}

/** true si ce message voyageur a déjà été traité — évite de répondre deux fois.
 *  Conservé pour compatibilité : la messagerie passe désormais par
 *  `reserverMessage`, seule garantie contre deux passages de cron simultanés. */
export async function dejaTraite(threadId: string, messageId: string): Promise<boolean> {
  if (!sql) return mem.traites.has(`${threadId}:${messageId}`);
  const [r] = await sql<any[]>`
    select 1 from messages_traites where thread_id = ${threadId} and message_id = ${messageId}`;
  return Boolean(r);
}

export async function marquerTraite(
  threadId: string,
  messageId: string,
  conciergerieId: string | null,
  reponse: string,
): Promise<void> {
  if (!sql) {
    mem.traites.add(`${threadId}:${messageId}`);
    return;
  }
  await sql`
    insert into messages_traites (thread_id, message_id, conciergerie_id, reponse_envoyee)
    values (${threadId}, ${messageId}, ${conciergerieId}, ${reponse})
    on conflict do nothing`;
}

/** Marqueur d'un message pris en charge mais pas encore répondu. */
export const EN_COURS = '(en cours)';

/**
 * Prise en charge ATOMIQUE d'un message voyageur.
 *
 * Deux passages de cron qui se chevauchent (pg_cron toutes les 1 à 2 minutes,
 * une génération qui traîne) lisaient tous deux « pas encore traité » puis
 * répondaient tous deux. Ici l'insertion fait office de verrou : une seule
 * invocation obtient la ligne, les autres passent leur chemin.
 *
 * Une prise en charge restée « en cours » plus de 10 minutes est considérée
 * comme abandonnée (fonction tuée en plein vol) et peut être reprise.
 *
 * Renvoie true si CET appel a obtenu le message.
 */
export async function reserverMessage(
  threadId: string,
  messageId: string,
  conciergerieId: string | null,
): Promise<boolean> {
  if (!sql) {
    const cle = `${threadId}:${messageId}`;
    if (mem.traites.has(cle)) return false;
    mem.traites.add(cle);
    return true;
  }
  const rs = await sql<any[]>`
    insert into messages_traites (thread_id, message_id, conciergerie_id, reponse_envoyee)
    values (${threadId}, ${messageId}, ${conciergerieId}, ${EN_COURS})
    on conflict (thread_id, message_id) do update
      set traite_le = now()
      where messages_traites.reponse_envoyee = ${EN_COURS}
        and messages_traites.traite_le < now() - interval '10 minutes'
    returning thread_id`;
  return rs.length > 0;
}

/** Inscrit l'issue définitive : la réponse envoyée, ou « (escaladé) ». */
export async function finaliserMessage(
  threadId: string,
  messageId: string,
  reponse: string,
): Promise<void> {
  if (!sql) {
    mem.traites.add(`${threadId}:${messageId}`);
    return;
  }
  await sql`
    update messages_traites
    set reponse_envoyee = ${reponse}, traite_le = now()
    where thread_id = ${threadId} and message_id = ${messageId}`;
}

/** Rend un message au prochain passage — uniquement quand RIEN n'est parti
 *  vers le voyageur (échec de génération). */
export async function libererMessage(threadId: string, messageId: string): Promise<void> {
  if (!sql) {
    mem.traites.delete(`${threadId}:${messageId}`);
    return;
  }
  await sql`
    delete from messages_traites
    where thread_id = ${threadId} and message_id = ${messageId}
      and reponse_envoyee = ${EN_COURS}`;
}

// --- Authentification par invitation ---

/**
 * Code d'invitation. Alphabet sans I, O, 0 ni 1 : ces caractères se confondent
 * quand quelqu'un recopie un code à la main.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const nouveauCode = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((n) => ALPHABET[n % ALPHABET.length])
    .join('');

export type Invitation = {
  id: string;
  code: string;
  nomConciergerie: string;
  conciergerieId: string | null;
};

export async function creerInvitation(
  nomConciergerie: string,
  email: string | null,
  emisePar: string,
): Promise<string> {
  const code = nouveauCode();
  if (!sql) {
    mem.invitations.set(code, { id: idMem(), code, nomConciergerie, conciergerieId: null });
    return code;
  }
  await sql`
    insert into invitations (code, nom_conciergerie, email, emise_par)
    values (${code}, ${nomConciergerie}, ${email}, ${emisePar})`;
  return code;
}

/** Consomme une invitation et rattache le chat_id. À usage unique. */
export async function consommerInvitation(
  code: string,
  chatId: string | number,
): Promise<{ nomConciergerie: string; conciergerieId: string | null } | null> {
  const c = code.trim().toUpperCase();
  if (!sql) {
    const i = mem.invitations.get(c);
    if (!i) return null;
    mem.invitations.delete(c);
    return { nomConciergerie: i.nomConciergerie, conciergerieId: i.conciergerieId };
  }
  const [r] = await sql<any[]>`
    update invitations
    set utilise_le = now(), chat_id_utilise = ${String(chatId)}
    where code = ${c} and utilise_le is null and expire_le > now()
    returning nom_conciergerie, conciergerie_id`;
  return r ? { nomConciergerie: r.nom_conciergerie, conciergerieId: r.conciergerie_id } : null;
}

/** Rattache un chat_id à une conciergerie existante. */
export async function rattacherMembre(
  conciergerieId: string,
  chatId: string | number,
  role = 'proprietaire',
): Promise<void> {
  const chat = String(chatId);
  if (!sql) {
    mem.membres.set(chat, conciergerieId);
    mem.roles.set(chat, role as Role);
    return;
  }
  await sql`
    insert into membres (conciergerie_id, chat_id, role)
    values (${conciergerieId}, ${chat}, ${role})
    on conflict (chat_id) do update
      set conciergerie_id = excluded.conciergerie_id, role = excluded.role`;
}

export async function lierInvitation(code: string, conciergerieId: string): Promise<void> {
  if (!sql) return;
  await sql`update invitations set conciergerie_id = ${conciergerieId} where code = ${code}`;
}

// --- Rôles ---

export type Role = 'editeur' | 'proprietaire' | 'equipe' | 'prestataire';

/** Rôles autorisés à modifier la configuration ou les calendriers. */
export const peutEcrire = (role: Role | null): boolean =>
  role === 'proprietaire' || role === 'editeur';

/**
 * Rôle d'un chat_id. La liste d'amorçage (TELEGRAM_ALLOWED_CHAT_IDS) vaut
 * « editeur » : c'est elle qui ouvre le produit avant qu'aucune conciergerie
 * n'existe. null = inconnu, donc aucun droit.
 */
export async function roleDe(chatId: string | number): Promise<Role | null> {
  const chat = String(chatId);
  if (chatAutorise(chat)) return 'editeur';
  if (!sql) {
    if (!mem.membres.has(chat)) return null;
    return mem.roles.get(chat) ?? 'proprietaire';
  }
  const [r] = await sql<any[]>`select role from membres where chat_id = ${chat} limit 1`;
  return (r?.role as Role | undefined) ?? null;
}

export async function estEditeur(chatId: string | number): Promise<boolean> {
  if (!sql) return true;
  const [r] = await sql<any[]>`
    select 1 from membres where chat_id = ${String(chatId)} and role = 'editeur'`;
  return Boolean(r);
}

// --- Liens de connexion servis sous notre domaine ---

export type LienConnexion = {
  id: string;
  conciergerieId: string;
  canal: 'airbnb' | 'booking';
  /** Comptes déjà connectés chez Repull à l'ouverture du lien. null = pas encore ouvert. */
  comptesAvant: string[] | null;
  finalise: boolean;
};

export async function creerLien(conciergerieId: string, canal: 'airbnb' | 'booking'): Promise<string> {
  if (!sql) {
    const id = idMem();
    mem.liens.set(id, { id, conciergerieId, canal, comptesAvant: null, finalise: false, ouvertLe: null });
    return id;
  }
  const [r] = await sql<any[]>`
    insert into liens_connexion (conciergerie_id, canal)
    values (${conciergerieId}, ${canal})
    returning id`;
  return r.id;
}

/** Lit un lien encore valable et note sa première ouverture. */
export async function lienConnexion(id: string): Promise<LienConnexion | null> {
  if (!sql) {
    const l = mem.liens.get(id);
    if (l && l.ouvertLe == null) l.ouvertLe = Date.now();
    return l ?? null;
  }
  const [r] = await sql<any[]>`
    update liens_connexion set ouvert_le = coalesce(ouvert_le, now())
    where id = ${id} and expire_le > now()
    returning id, conciergerie_id, canal, comptes_avant, finalise_le`;
  return r
    ? {
        id: r.id,
        conciergerieId: r.conciergerie_id,
        canal: r.canal,
        comptesAvant: r.comptes_avant ?? null,
        finalise: r.finalise_le != null,
      }
    : null;
}

/** Photographie des comptes déjà connus, prise au départ vers Repull. */
export async function noterComptesAvant(id: string, comptes: string[]): Promise<void> {
  if (!sql) {
    const l = mem.liens.get(id);
    if (l) l.comptesAvant = comptes;
    return;
  }
  await sql`update liens_connexion set comptes_avant = ${sql.json(comptes)} where id = ${id}`;
}

export async function finaliserLien(id: string): Promise<void> {
  if (!sql) {
    const l = mem.liens.get(id);
    if (l) l.finalise = true;
    return;
  }
  await sql`update liens_connexion set finalise_le = now() where id = ${id}`;
}

/**
 * Autres liens du même canal, partis vers Repull et pas encore finalisés, dans
 * les dernières 24 heures. S'il y en a, un nouveau compte apparu chez Repull peut
 * appartenir à une autre conciergerie : on ne l'attribue pas à l'aveugle.
 */
export async function autresLiensEnCours(id: string, canal: 'airbnb' | 'booking'): Promise<number> {
  if (!sql) {
    const limite = Date.now() - 24 * 3600_000;
    return [...mem.liens.values()].filter(
      (l) =>
        l.id !== id && l.canal === canal && !l.finalise && l.comptesAvant != null && (l.ouvertLe ?? 0) > limite,
    ).length;
  }
  const [r] = await sql<any[]>`
    select count(*)::int as n from liens_connexion
    where id <> ${id} and canal = ${canal} and finalise_le is null
      and comptes_avant is not null and ouvert_le > now() - interval '24 hours'`;
  return r?.n ?? 0;
}

/** Liens de la conciergerie partis vers Repull et dont le retour n'a pas abouti. */
export async function liensEnCoursDe(conciergerieId: string): Promise<LienConnexion[]> {
  if (!sql) {
    return [...mem.liens.values()].filter(
      (l) => l.conciergerieId === conciergerieId && !l.finalise && l.comptesAvant != null,
    );
  }
  const rs = await sql<any[]>`
    select id, conciergerie_id, canal, comptes_avant, finalise_le from liens_connexion
    where conciergerie_id = ${conciergerieId} and finalise_le is null
      and comptes_avant is not null and expire_le > now()
    order by ouvert_le`;
  return rs.map((r) => ({
    id: r.id,
    conciergerieId: r.conciergerie_id,
    canal: r.canal,
    comptesAvant: r.comptes_avant,
    finalise: false,
  }));
}

// --- Comptes de plateformes : le cloisonnement entre conciergeries ---

/**
 * Rattache un compte Airbnb (hôte) ou Booking (établissement) à une
 * conciergerie. Un compte déjà rattaché ne change JAMAIS de mains : on rend
 * alors son propriétaire actuel, que l'appelant compare au sien.
 */
export async function attribuerCompte(
  canal: 'airbnb' | 'booking',
  compteId: string,
  conciergerieId: string,
): Promise<string> {
  const cle = `${canal}:${compteId}`;
  if (!sql) {
    if (!mem.comptes.has(cle)) mem.comptes.set(cle, conciergerieId);
    return mem.comptes.get(cle)!;
  }
  await sql`
    insert into comptes_plateformes (canal, compte_id, conciergerie_id)
    values (${canal}, ${compteId}, ${conciergerieId})
    on conflict (canal, compte_id) do nothing`;
  const [r] = await sql<any[]>`
    select conciergerie_id from comptes_plateformes where canal = ${canal} and compte_id = ${compteId}`;
  return r.conciergerie_id;
}

export async function comptesDe(
  conciergerieId: string,
): Promise<Array<{ canal: 'airbnb' | 'booking'; compteId: string }>> {
  if (!sql) {
    return [...mem.comptes.entries()]
      .filter(([, id]) => id === conciergerieId)
      .map(([cle]) => {
        const [canal, ...reste] = cle.split(':');
        return { canal: canal as 'airbnb' | 'booking', compteId: reste.join(':') };
      });
  }
  const rs = await sql<any[]>`
    select canal, compte_id from comptes_plateformes where conciergerie_id = ${conciergerieId}`;
  return rs.map((r) => ({ canal: r.canal, compteId: r.compte_id }));
}

/** Tous les comptes déjà rattachés, toutes conciergeries confondues. */
export async function comptesAttribues(canal: 'airbnb' | 'booking'): Promise<Map<string, string>> {
  if (!sql) {
    const m = new Map<string, string>();
    for (const [cle, id] of mem.comptes) if (cle.startsWith(`${canal}:`)) m.set(cle.slice(canal.length + 1), id);
    return m;
  }
  const rs = await sql<any[]>`select compte_id, conciergerie_id from comptes_plateformes where canal = ${canal}`;
  return new Map(rs.map((r) => [r.compte_id as string, r.conciergerie_id as string]));
}

export async function conciergerieParId(id: string): Promise<Conciergerie | null> {
  if (!sql) return mem.conciergeries.get(id) ?? null;
  const [r] = await sql<any[]>`
    select id, nom, style_profil, style_exemples
    from conciergeries where id = ${id}`;
  return r
    ? {
        id: r.id,
        nom: r.nom,
        styleProfil: r.style_profil,
        styleExemples: r.style_exemples ?? [],
      }
    : null;
}

export async function logementParId(id: string): Promise<Logement | null> {
  if (!sql) return mem.logements.find((l) => l.id === id) ?? null;
  const [r] = await sql<any[]>`select * from logements where id = ${id}`;
  return r ? versLogement(r) : null;
}

/** Retrouve le logement (et sa conciergerie) à partir d'une annonce Repull.
 *  Repull ne sait pas à quelle conciergerie appartient une annonce : c'est
 *  notre base qui le sait. */
export async function logementParRepullId(
  annonceId: string,
): Promise<{ logement: Logement; conciergerie: Conciergerie } | null> {
  if (!sql) {
    const l = mem.logements.find((x) => x.repullListingId === annonceId);
    const c = l ? mem.conciergeries.get(l.conciergerieId) : null;
    return l && c ? { logement: l, conciergerie: c } : null;
  }
  const [r] = await sql<any[]>`
    select l.*, c.nom as c_nom,
           c.style_profil as c_style, c.style_exemples as c_exemples
    from logements l join conciergeries c on c.id = l.conciergerie_id
    where l.repull_listing_id = ${annonceId} and l.actif and c.actif limit 1`;
  if (!r) return null;
  return {
    logement: versLogement(r),
    conciergerie: {
      id: r.conciergerie_id,
      nom: r.c_nom,
      styleProfil: r.c_style,
      styleExemples: r.c_exemples ?? [],
    },
  };
}

// --- Réservations déjà vues ---
//
// Clé : `<id Repull>@<updatedAt>` — une version précise de la réservation.
// Le webhook et le rattrapage calculent la même clé : une modification vue
// par l'un n'est pas renotifiée par l'autre.

export type ReservationVue = {
  statut: string;
  arrivee: string | null;
  depart: string | null;
};

export async function reservationDejaVue(cle: string): Promise<boolean> {
  if (!sql) return mem.reservationsVues.has(cle);
  const [r] = await sql<any[]>`select 1 from reservations_acquittees where revision_id = ${cle}`;
  return Boolean(r);
}

/** Dernier état notifié d'une réservation, pour ne signaler que ce qui a bougé. */
export async function derniereVueReservation(bookingId: string): Promise<ReservationVue | null> {
  if (!sql) {
    let derniere: ReservationVue | null = null;
    for (const v of mem.reservationsVues.values()) if (v.bookingId === bookingId) derniere = v;
    return derniere;
  }
  const [r] = await sql<any[]>`
    select statut, arrivee::text as arrivee, depart::text as depart
    from reservations_acquittees
    where booking_id = ${bookingId}
    order by acquittee_le desc limit 1`;
  return r ? { statut: r.statut ?? '', arrivee: r.arrivee, depart: r.depart } : null;
}

export async function marquerReservationVue(r: {
  cle: string;
  bookingId: string | null;
  conciergerieId: string | null;
  logementId: string | null;
  statut: string;
  arrivee: string | null;
  depart: string | null;
}): Promise<void> {
  if (!sql) {
    mem.reservationsVues.set(r.cle, { bookingId: r.bookingId, statut: r.statut, arrivee: r.arrivee, depart: r.depart });
    return;
  }
  await sql`
    insert into reservations_acquittees
      (revision_id, booking_id, conciergerie_id, logement_id, statut, arrivee, depart)
    values (${r.cle}, ${r.bookingId}, ${r.conciergerieId}, ${r.logementId},
            ${r.statut}, ${r.arrivee}, ${r.depart})
    on conflict (revision_id) do nothing`;
}

/** Le chat_id du propriétaire d'une conciergerie. */
export async function proprietaireDe(conciergerieId: string): Promise<string | null> {
  if (!sql) {
    for (const [chat, id] of mem.membres) if (id === conciergerieId) return chat;
    return null;
  }
  const [r] = await sql<any[]>`
    select chat_id from membres
    where conciergerie_id = ${conciergerieId} and role in ('proprietaire','editeur')
    order by cree_le limit 1`;
  return r?.chat_id ?? null;
}

// --- Mémoire longue ---

export type Souvenir = { id: string; contenu: string; categorie: string };

export async function retenir(
  conciergerieId: string,
  contenu: string,
  categorie: string,
): Promise<void> {
  if (!sql) {
    mem.souvenirs.push({ id: idMem(), conciergerieId, contenu, categorie });
    return;
  }
  await sql`
    insert into souvenirs (conciergerie_id, contenu, categorie)
    values (${conciergerieId}, ${contenu}, ${categorie})`;
}

export async function souvenirs(conciergerieId: string): Promise<Souvenir[]> {
  if (!sql) return mem.souvenirs.filter((s) => s.conciergerieId === conciergerieId);
  const rs = await sql<any[]>`
    select id, contenu, categorie from souvenirs
    where conciergerie_id = ${conciergerieId}
    order by cree_le desc limit 60`;
  return rs.map((r) => ({ id: r.id, contenu: r.contenu, categorie: r.categorie }));
}

/** Supprime un souvenir devenu faux. Une mémoire qu'on ne peut pas corriger
 *  est pire que pas de mémoire du tout. */
export async function oublier(conciergerieId: string, recherche: string): Promise<number> {
  if (!sql) {
    const avant = mem.souvenirs.length;
    mem.souvenirs = mem.souvenirs.filter(
      (s) => s.conciergerieId !== conciergerieId || !s.contenu.toLowerCase().includes(recherche.toLowerCase()),
    );
    return avant - mem.souvenirs.length;
  }
  const rs = await sql<any[]>`
    delete from souvenirs
    where conciergerie_id = ${conciergerieId} and contenu ilike ${'%' + recherche + '%'}
    returning id`;
  return rs.length;
}

export async function resume(conciergerieId: string): Promise<string | null> {
  if (!sql) return mem.resumes.get(conciergerieId) ?? null;
  const [r] = await sql<any[]>`
    select resume_conversation from conciergeries where id = ${conciergerieId}`;
  return r?.resume_conversation ?? null;
}

export async function enregistrerResume(conciergerieId: string, texte: string): Promise<void> {
  if (!sql) {
    mem.resumes.set(conciergerieId, texte);
    return;
  }
  await sql`
    update conciergeries
    set resume_conversation = ${texte}, resume_jusqua = now()
    where id = ${conciergerieId}`;
}

export async function nombreDeMessages(chatId: string | number): Promise<number> {
  if (!sql) return (mem.conversations.get(String(chatId)) ?? []).length;
  const [r] = await sql<any[]>`
    select count(*)::int as n from conversations where chat_id = ${String(chatId)}`;
  return r?.n ?? 0;
}

// --- Veille autonome ---

/** true si ce sujet a déjà été signalé récemment — évite de répéter la même
 *  alerte à chaque passage, ce qui rendrait l'agent insupportable. */
export async function dejaSignale(conciergerieId: string, sujet: string, joursDeSilence = 7): Promise<boolean> {
  if (!sql) return mem.initiatives.has(`${conciergerieId}:${sujet}`);
  const [r] = await sql<any[]>`
    select 1 from initiatives
    where conciergerie_id = ${conciergerieId} and sujet = ${sujet}
      and cree_le > now() - (${joursDeSilence} || ' days')::interval`;
  return Boolean(r);
}

export async function noterInitiative(
  conciergerieId: string,
  sujet: string,
  message: string,
): Promise<void> {
  if (!sql) {
    mem.initiatives.add(`${conciergerieId}:${sujet}`);
    return;
  }
  await sql`
    insert into initiatives (conciergerie_id, sujet, message)
    values (${conciergerieId}, ${sujet}, ${message})
    on conflict (conciergerie_id, sujet)
    do update set message = excluded.message, cree_le = now()`;
}

/** Toutes les conciergeries actives — pour les crons. */
export async function toutesConciergeries(): Promise<Array<Conciergerie & { chatIds: string[] }>> {
  if (!sql) {
    return [...mem.conciergeries.values()].map((c) => ({
      ...c,
      chatIds: [...mem.membres.entries()].filter(([, id]) => id === c.id).map(([chat]) => chat),
    }));
  }
  const rs = await sql<any[]>`
    select c.id, c.nom, c.style_profil, c.style_exemples,
           coalesce(array_agg(m.chat_id) filter (where m.role = 'proprietaire'), '{}') as chat_ids
    from conciergeries c
    left join membres m on m.conciergerie_id = c.id
    where c.actif
    group by c.id`;
  return rs.map((r) => ({
    id: r.id,
    nom: r.nom,
    styleProfil: r.style_profil,
    styleExemples: r.style_exemples ?? [],
    chatIds: r.chat_ids ?? [],
  }));
}
