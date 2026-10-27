/**
 * « Proposer une réponse » à un avis, côté serveur (api/_erp-avis.ts, action
 * « reponse_avis » de /api/erp-agent) : rien n'est publié sur la plateforme,
 * l'équipe relit, retouche et copie la réponse.
 *
 * - l'IA ne voit que la partie publique de l'avis (sans e-mail, téléphone ni
 *   lien), le prénom, la note, la plateforme et les thèmes repérés : jamais
 *   le message privé, jamais le nom complet ;
 * - sa réponse est contrôlée (problemesReponse, avis.ts) : nom de famille,
 *   téléphone, e-mail, adresse, code, lien, message privé, geste commercial
 *   ou remboursement → écartée, le texte simple (reponseModele) la remplace ;
 * - sans IA (clé absente), plafond du mois atteint ou réponse illisible : le
 *   texte simple, avec une ligne qui dit pourquoi ;
 * - sa lecture de l'avis (sentiment, sens des thèmes déjà repérés) est
 *   gardée sur la réservation (lectureAvis) par écriture conditionnelle.
 *
 * Chaque appel à l'IA compte dans le plafond mensuel de l'espace (agent/etat,
 * iaMois), comme l'assistant de la messagerie. Base et client IA injectés :
 * verifier-avis.ts les simule. Imports relatifs avec « .js » : tourne sous Node.
 */
import { ErreurAssistant, compterAppelIA, type OptionsAssistant } from './agent-assistant.js';
import { MODELE_AGENT_DEFAUT, signer } from './agent-messagerie.js';
import {
  SCHEMA_REPONSE_AVIS,
  consignesReponseAvis,
  contexteReponseAvis,
  lectureDepuisIA,
  lireAvis,
  lireReponseIA,
  prenomPublic,
  problemesReponse,
  reponseModele,
  sansReponse,
  signatureSure,
  type ContexteControle,
} from './avis.js';
import { reglagesAgent } from './reglages.js';
import { horodatageParis } from './repull.js';
import type { Journal, LectureAvis, Logement, ReglagesAgent, Reservation } from './types';

export interface ReponseAvisPreparee {
  /** Réponse publique, signée, prête à copier. */
  texte: string;
  /** ia : rédigée par votre agent ; modele : texte simple, sans IA. */
  source: 'ia' | 'modele';
  /** Pourquoi le texte simple (IA absente, plafond, proposition écartée). */
  note?: string;
  /** Lecture de l'avis par l'IA, gardée sur la réservation. */
  lecture?: LectureAvis;
}

const AUTEUR = 'Agent IA';

/** Écrit la lecture sur la réservation, à partir de la version lue (une synchronisation passée entre-temps n'est jamais écrasée). */
async function garderLecture(o: OptionsAssistant, id: string, lecture: LectureAvis): Promise<boolean> {
  for (let essai = 0; essai < 3; essai++) {
    const [lu] = await o.base.lireVersions<Reservation>('reservations', [id]);
    if (!lu) return false;
    const suivant: Reservation = { ...lu.element, lectureAvis: lecture };
    if (!lu.version) {
      await o.base.ecrire('reservations', [suivant], AUTEUR);
      return true;
    }
    if (await o.base.remplacerSi('reservations', suivant, lu.version, AUTEUR)) return true;
  }
  return false;
}

async function journal(o: OptionsAssistant, r: Reservation, details: string, maintenant: Date): Promise<void> {
  const l: Journal = {
    id: `agent-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    horodatage: horodatageParis(maintenant),
    auteur: AUTEUR,
    action: 'Agent IA',
    entite: 'reservations',
    entiteId: r.id,
    details,
  };
  await o.base.ecrire('journal', [l], AUTEUR).catch(() => undefined);
}

/* ------------------------------------------------- frein par membre */

/** Demandes permises par membre et par quart d'heure (comme les brouillons du CRM). */
export const DEMANDES_PAR_QUART_D_HEURE = 20;
export const FENETRE_FREIN_MS = 15 * 60_000;
export const MESSAGE_TROP_DE_DEMANDES = 'Trop de demandes d’un coup : réessayez dans quelques minutes.';

/**
 * Frein des demandes (par instance du serveur) : vrai quand la clé
 * (espace et membre) dépasse `max` demandes sur la fenêtre. Chaque essai
 * compte, même refusé. Horloge injectable pour l'auto-contrôle.
 */
export function freinDemandes(max = DEMANDES_PAR_QUART_D_HEURE, fenetreMs = FENETRE_FREIN_MS, horloge: () => number = Date.now): (cle: string) => boolean {
  const demandes = new Map<string, number[]>();
  return (cle) => {
    const maintenant = horloge();
    const recentes = (demandes.get(cle) ?? []).filter((t) => maintenant - t < fenetreMs);
    recentes.push(maintenant);
    demandes.set(cle, recentes);
    if (demandes.size > 5000) demandes.clear();
    return recentes.length > max;
  };
}

/**
 * Réponse proposée pour l'avis du séjour `reservationId`. Lève
 * ErreurAssistant (message prêt à afficher) si le membre a fait trop de
 * demandes d'un coup (`tropDeDemandes`, frein de la route : rien n'est lu
 * ni appelé), si l'avis n'existe pas, n'a pas de commentaire public ou vient
 * d'un séjour direct ; sinon rend toujours un texte (IA ou simple).
 */
export async function preparerReponseAvis(o: OptionsAssistant, reservationId: string, frein: { tropDeDemandes?: () => boolean } = {}): Promise<ReponseAvisPreparee> {
  if (frein.tropDeDemandes?.()) throw new ErreurAssistant(MESSAGE_TROP_DE_DEMANDES, 429, 'occupe');
  const id = String(reservationId ?? '').trim();
  const [r] = id ? await o.base.lire<Reservation>('reservations', [id]) : [];
  const avis = r ? lireAvis(r) : null;
  if (!r || !avis) throw new ErreurAssistant('Avis introuvable : rechargez la page.', 404, 'introuvable');
  const refus = sansReponse(avis);
  if (refus) throw new ErreurAssistant(refus, 400, 'vide');
  const [logements, reglagesLus] = await Promise.all([
    r.logementId ? o.base.lire<Logement>('logements', [r.logementId]) : Promise.resolve([] as Logement[]),
    o.base.lire<ReglagesAgent>('reglages', ['agent']),
  ]);
  const maintenant = (o.maintenant ?? (() => new Date()))();
  const signature = signatureSure(reglagesAgent({ reglages: reglagesLus }, o.nomEspace).signature);
  const prenom = prenomPublic(r.voyageur?.nom);
  const simple = reponseModele(avis, { prenom, signature });
  const ctx: ContexteControle = { nomVoyageur: r.voyageur?.nom, textePrive: avis.textePrive, ...(logements[0] ? { logement: logements[0] } : {}) };
  const repli = (note: string): ReponseAvisPreparee => ({ texte: simple, source: 'modele', note });

  if (!o.ia) return repli('Votre agent n’est pas encore activé sur ce site : voici un texte simple.');
  try {
    await compterAppelIA(o);
  } catch (e) {
    if (e instanceof ErreurAssistant && e.code === 'plafond') return repli(`${e.message.replace(/ : écrivez votre réponse vous-même\.?$/, '')} : voici un texte simple.`);
    throw e;
  }
  const m = await o.ia.messages.create({
    model: o.modele ?? MODELE_AGENT_DEFAUT,
    max_tokens: 700,
    system: consignesReponseAvis(o.nomEspace === undefined ? 'Label Maison' : o.nomEspace.trim() || 'la conciergerie'),
    messages: [{ role: 'user', content: contexteReponseAvis(avis, prenom) }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA_REPONSE_AVIS as unknown as Record<string, unknown> } },
  });
  const lu = lireReponseIA(m);
  if (!lu) return repli('Votre agent n’a pas de réponse sûre : voici un texte simple.');

  const lecture = lectureDepuisIA(lu, avis, horodatageParis(maintenant));
  if (lecture) await garderLecture(o, r.id, lecture).catch(() => false);

  const texte = signer(lu.texte, signature);
  const problemes = problemesReponse(texte, ctx);
  const resultat: ReponseAvisPreparee = problemes.length
    ? { ...repli(`La proposition de votre agent contenait ${problemes[0]} : elle a été écartée, voici un texte simple.`) }
    : { texte, source: 'ia' };
  await journal(
    o,
    r,
    `Réponse à l’avis de ${avis.auteur} préparée pour ${o.par}${problemes.length ? ` (proposition de l’IA écartée : ${problemes.join(', ')})` : ''}. Rien n’est publié par l’ERP.`,
    maintenant,
  );
  return { ...resultat, ...(lecture ? { lecture } : {}) };
}
