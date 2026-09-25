/**
 * Envoi d'un message au voyageur depuis l'ERP, côté serveur
 * (api/erp-repull-messages.ts, et l'agent IA : agent-messagerie.ts).
 *
 * Le message part vraiment chez le voyageur, sur la plateforme de la
 * conversation (Airbnb, Booking.com...), par Repull :
 *   POST /v1/conversations/{id}/messages   { message }   (OpenAPI Repull)
 * avec un en-tête Idempotency-Key : un nouvel essai (réseau, 5xx) ou un
 * double clic ne peut pas envoyer deux fois le même message (Repull rejoue
 * la réponse gardée 24 h). L'appel est compté dans la part mensuelle
 * d'appels Repull de l'ERP (repull/etat), comme tous les autres.
 *
 * Une fois envoyé, le message est écrit dans le fil de l'ERP (auteur hôte ou
 * agent, identifiant Repull : la synchronisation suivante le reconnaît et ne
 * le double pas), le statut du fil suit, et une ligne de journal est ajoutée.
 *
 * Imports relatifs avec « .js » : ce fichier tourne sous Node (ESM).
 */
import { horodatageParis, idRepull } from './repull.js';
import { BudgetEpuise, ErreurRepull } from './repull-synchro.js';
import { avecClient, messageErreur, type ContexteConnexion } from './repull-connexion.js';
import type { AuteurMessage, FilMessages, Journal, Message } from './types';

/** Longueur maximale d'un message (OpenAPI Repull : 4 000 caractères). */
export const LONGUEUR_MAX_MESSAGE = 4000;

/** Nom des plateformes pour les messages (« Envoyé sur Booking.com »). */
export const NOMS_PLATEFORMES: Record<string, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  vrbo: 'Vrbo',
  sms: 'SMS',
  email: 'e-mail',
  website: 'le site',
  direct: 'le site',
};

export const nomPlateforme = (canal: string | undefined): string => NOMS_PLATEFORMES[(canal ?? '').toLowerCase()] ?? 'la plateforme';

/** Erreur à montrer telle quelle (français), avec le statut HTTP à renvoyer. */
export class ErreurEnvoi extends Error {
  constructor(
    message: string,
    readonly statut = 400,
    /**
     * hors_plateforme : fil sans conversation Repull ; deja_envoye : clé déjà
     * utilisée pour un autre texte (un envoi est parti) ; en_cours : même envoi en cours.
     */
    readonly code?: 'hors_plateforme' | 'deja_envoye' | 'en_cours' | 'introuvable' | 'texte' | 'budget' | 'repull',
  ) {
    super(message);
  }
}

/** Réponse de POST /v1/conversations/{id}/messages (SendMessageResponse). */
interface ReponseEnvoiRepull {
  id?: string | null;
  conversationId?: number;
  externalMessageId?: string | null;
  channel?: string | null;
  status?: string;
  contentRewritten?: boolean;
  submittedContent?: string | null;
  deliveredContent?: string | null;
  statusReason?: string | null;
}

export interface DemandeEnvoi {
  filId: string;
  texte: string;
  auteur: Extract<AuteurMessage, 'hote' | 'agent'>;
  /** Nom de l'auteur pour le journal (membre de l'équipe, ou « Agent IA »). */
  par: string;
  /** Clé d'idempotence imposée (agent : liée au message du voyageur). Sinon : fil + texte + minute. */
  cleIdempotence?: string;
  /** Changements du fil à écrire avec le message (suivi de l'agent...). */
  completer?: (fil: FilMessages) => FilMessages;
}

export interface ResultatEnvoi {
  ok: true;
  message: Message;
  fil: FilMessages;
  /** Plateforme par laquelle le message est parti. */
  canal: string;
  /** La plateforme a modifié le texte (Airbnb retire liens et téléphones). */
  reecrit: boolean;
  /** Texte d'information prêt à afficher (« Envoyé sur Booking.com. »). */
  info: string;
}

/** Empreinte courte et stable d'un texte (FNV-1a 32 bits, hexadécimal). */
export function empreinte(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Clé d'idempotence d'un envoi de l'équipe : fil + empreinte du texte +
 * minute. Un double clic ne part qu'une fois ; le même texte renvoyé plus
 * tard (autre minute) part de nouveau, c'est voulu.
 */
export function cleEnvoi(filId: string, texte: string, maintenant: Date): string {
  const minute = Math.floor(maintenant.getTime() / 60_000);
  return `lm-${filId}-${empreinte(texte.trim())}-${minute}`.slice(0, 255);
}

/** Canal de la conversation, en clair (le fil garde airbnb | booking | direct | autre). */
function canalDuFil(fil: FilMessages, reponse?: string | null): string {
  return (reponse || '').toLowerCase() || (fil.canal === 'direct' ? 'website' : fil.canal);
}

/** Lit un fil de l'ERP, ou lève une erreur claire. */
async function lireFil(ctx: ContexteConnexion, filId: string): Promise<FilMessages> {
  const [fil] = await ctx.base.lire<FilMessages>('filsMessages', [filId]);
  if (!fil) throw new ErreurEnvoi('Conversation introuvable : elle a peut-être été supprimée. Rechargez la page.', 404, 'introuvable');
  return fil;
}

/** Message d'erreur Repull adapté à un envoi (le voyageur n'a rien reçu). */
export function messageEchecEnvoi(e: unknown, ctx: Pick<ContexteConnexion, 'budgetMois'> = {}): string {
  if (e instanceof ErreurEnvoi) return e.message;
  if (e instanceof BudgetEpuise) return `${messageErreur(e, { budgetMois: ctx.budgetMois })} Le message n’est pas parti : gardez-le et envoyez-le depuis la plateforme.`;
  if (e instanceof ErreurRepull) {
    const raison = typeof e.infos.statusReason === 'string' && e.infos.statusReason ? ` (« ${e.infos.statusReason} »)` : '';
    if (e.statut === 422 && e.code === 'message_not_sent') return `La plateforme a refusé le message${raison} : il n’est pas parti. Retirez les liens, e-mails ou numéros de téléphone, puis réessayez.`;
    if (e.statut === 403 && e.code === 'listing_inactive') return 'Ce logement est désactivé chez Repull : le message n’est pas parti. Réactivez-le dans Logements → Connexions.';
    if (e.statut === 404) return 'Cette conversation n’existe plus chez Repull : le message n’est pas parti.';
    return `Le message n’est pas parti. ${messageErreur(e)}`;
  }
  return `Le message n’est pas parti : ${e instanceof Error ? e.message : String(e)}`;
}

/**
 * Envoie un message au voyageur d'un fil relié à Repull, puis l'écrit dans
 * l'ERP. Lève ErreurEnvoi (message prêt à afficher) ou les erreurs Repull.
 */
export async function envoyerMessage(ctx: ContexteConnexion, d: DemandeEnvoi): Promise<ResultatEnvoi> {
  const maintenant = ctx.maintenant ?? (() => new Date());
  const texte = String(d.texte ?? '').replace(/\r\n/g, '\n').trim();
  if (!texte) throw new ErreurEnvoi('Le message est vide.', 400, 'texte');
  if (texte.length > LONGUEUR_MAX_MESSAGE) {
    throw new ErreurEnvoi(`Message trop long (${texte.length} caractères) : ${LONGUEUR_MAX_MESSAGE} au plus. Coupez-le en deux.`, 400, 'texte');
  }
  const fil = await lireFil(ctx, d.filId);
  const conversation = fil.repull?.id;
  if (!conversation) {
    throw new ErreurEnvoi('Ce voyageur n’est pas relié à une plateforme : message gardé dans l’ERP.', 409, 'hors_plateforme');
  }

  const cle = d.cleIdempotence ?? cleEnvoi(fil.id, texte, maintenant());
  let reponse: ReponseEnvoiRepull;
  try {
    reponse = await avecClient(ctx, (client) =>
      client.post<ReponseEnvoiRepull>(`/v1/conversations/${encodeURIComponent(conversation)}/messages`, { message: texte }, {}, { 'Idempotency-Key': cle }),
    );
  } catch (e) {
    // Même clé déjà utilisée pour un autre texte, ou envoi identique en cours : rien n'est reparti.
    if (e instanceof ErreurRepull && e.code === 'idempotency_key_in_use') {
      throw new ErreurEnvoi('Ce message est déjà en cours d’envoi : rien n’a été renvoyé.', 409, 'en_cours');
    }
    if (e instanceof ErreurRepull && e.code === 'idempotency_key_reused') {
      throw new ErreurEnvoi('Un message vient déjà de partir pour cette conversation : rien n’a été renvoyé.', 409, 'deja_envoye');
    }
    throw e;
  }

  const canal = canalDuFil(fil, reponse.channel);
  const reecrit = reponse.contentRewritten === true;
  const envoyeLe = horodatageParis(maintenant());
  const message: Message = {
    // Identifiant Repull : la synchronisation reconnaît le message et ne le double pas.
    id: reponse.id ? idRepull(reponse.id) : `envoi-${empreinte(cle)}`,
    auteur: d.auteur,
    texte: (reecrit && reponse.deliveredContent ? reponse.deliveredContent : texte).trim() || texte,
    envoyeLe,
    envoi: { canal, ...(reecrit ? { reecrit: true } : {}), par: d.par },
  };

  // Relu juste avant d'écrire : une synchronisation a pu passer pendant l'envoi.
  const frais = await lireFil(ctx, d.filId).catch(() => fil);
  const messages = frais.messages.some((m) => m.id === message.id)
    ? frais.messages.map((m) => (m.id === message.id ? { ...m, ...message } : m))
    : [...frais.messages, message];
  let suivant: FilMessages = {
    ...frais,
    messages,
    dernierMessageLe: envoyeLe,
    // Répondu : la conversation sort de « Pour vous » (elle reste ouverte).
    statut: 'ouvert',
    traitePar: d.auteur === 'agent' ? 'agent' : 'humain',
  };
  if (d.completer) suivant = d.completer(suivant);
  await ctx.base.ecrire('filsMessages', [suivant]);

  const plateforme = nomPlateforme(canal);
  const ligne: Journal = {
    id: `envoi-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    horodatage: envoyeLe,
    auteur: d.par,
    action: d.auteur === 'agent' ? 'Réponse de l’agent IA' : 'Message envoyé au voyageur',
    entite: 'filsMessages',
    entiteId: fil.id,
    details: `Message envoyé à ${fil.voyageur} sur ${plateforme}${reecrit ? ' (texte modifié par la plateforme : lien ou numéro retiré)' : ''}.`,
  };
  await ctx.base.ecrire('journal', [ligne]).catch(() => undefined);

  return {
    ok: true,
    message,
    fil: suivant,
    canal,
    reecrit,
    info: reecrit
      ? `Envoyé sur ${plateforme}, mais la plateforme a retiré un lien ou un numéro : le voyageur a reçu le texte affiché.`
      : `Envoyé sur ${plateforme}.`,
  };
}
