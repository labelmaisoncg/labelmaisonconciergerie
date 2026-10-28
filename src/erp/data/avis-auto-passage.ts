/**
 * Publication automatique des avis, côté serveur (octobre 2026, comme
 * Smoobu) : passage du jour (lancé par lancerProgrammes, passage planifié de
 * l'agent, api/erp-agent.ts) et « Publier » du gérant (api/_erp-avis.ts).
 * Règles : avis-auto.ts.
 *
 * Exception décidée par le gérant de Label Maison, LIMITÉE AUX AVIS. Deux
 * écritures seulement, permises par le verrou (ecritureRepullPermise,
 * repull-synchro.ts) :
 *   POST /v1/reviews/{id}/guest-review  { publicReview, rating: 5, isRevieweeRecommended: true }
 *   POST /v1/reviews/{id}/reply         { message }
 * Lectures : GET /v1/reviews?reviewerRole=host&platform=airbnb (avis à
 * déposer sur les voyageurs), GET /v1/reviews?reviewerRole=guest&status=
 * unanswered (avis sans réponse), GET /v1/reviews/{id} (vérification avant
 * un « Publier » du gérant).
 *
 * Garanties :
 * - réglages éteints : aucun appel, aucune écriture ;
 * - une fois par jour (à partir de 10 h, Paris), repris une heure après un
 *   passage incomplet ; une part des appels du mois reste aux messages et à
 *   la synchronisation (RESERVE_APPELS) ; chaque appel est compté ;
 * - jamais deux publications : marque « en cours » écrite AVANT l'envoi
 *   (rien ne part si elle ne s'écrit pas), clé d'idempotence, et la
 *   plateforme refuse un second avis (409, noté « déjà publié ») ;
 * - le passage ne publie que le texte qu'il vient de rédiger, jamais un texte
 *   lu dans la base ; « Publier » du gérant publie le texte qu'il a sous les
 *   yeux, contrôlé (problemesTexteAvis, problemesReponse), après avoir relu
 *   l'avis chez la plateforme (bon séjour, bonne plateforme, pas déjà publié) ;
 * - chaque publication est tracée dans « Actions de l'IA » (copilote.ts),
 *   action externe non annulable, avec le texte publié (masqué).
 *
 * Réseau injecté (fetch, client IA) : verifier-avis-auto.ts simule la base,
 * la plateforme et Claude en mémoire. Imports relatifs avec « .js » : ce
 * fichier tourne sous Node (ESM).
 */
import type { ClientIA } from './agent-messagerie.js';
import { lireAvis, problemesReponse, sansReponse } from './avis.js';
import { garderLecture, redigerReponseAvis } from './avis-serveur.js';
import {
  COLLECTION_REPONSES_AVIS,
  ID_ETAT_AVIS_AUTO,
  JOURS_AVANT_AVIS_AUTO,
  NOTE_AVIS_AUTO,
  PAR_PUBLICATION_AUTO,
  PLATEFORMES_REPONSE,
  allume,
  avisDepose,
  avisRepondu,
  deciderAvisVoyageur,
  fenetreAvisVoyageur,
  indexSejours,
  langueVoyageur,
  passageAvisDu,
  plateformeAvis,
  problemesTexteAvis,
  raisonsAvisSensible,
  raisonsReponseAValider,
  reglagesAvisAuto,
  reponseADecider,
  verdictAvisVoyageur,
  type EtatAvisAuto,
} from './avis-auto.js';
import { COLLECTION_ACTIONS_AGENT, actionPublicationAvis, actionsIaProtegees } from './copilote.js';
import { masquerCoordonnees } from './masquage.js';
import { COLLECTION_AVIS_A_DEPOSER, COLLECTION_ETAT_PROGRAMMES, dateParisDe, prenomDe, soucisDuSejour, texteAvisParDefaut } from './messages-programmes.js';
import { redigerAvisVoyageur, type AvisRedige } from './redaction-avis.js';
import { avecClient, messageErreur, type ContexteConnexion } from './repull-connexion.js';
import { BUDGET_ERP_DEFAUT, BudgetEpuise, DelaiEcoule, ErreurRepull, LONGUEUR_MAX_AVIS, QUOTA_MOIS_DEFAUT, lireEtat, type ClientRepull } from './repull-synchro.js';
import { appliquerAvis, horodatageParis, noteSur5, type RepullReview } from './repull.js';
import type { FilMessages, Incident, Journal, Logement, Proprietaire, Reglage, Reservation } from './types';
import type { ControleQualite } from './types-operations';
import type { AvisADeposer, PublicationAvis, ReponseAvisAuto, StatutPublication } from './types-programmes';

/** Appels du mois laissés aux messages et à la synchronisation : en dessous, le passage des avis attend. */
export const RESERVE_APPELS = 20;
/** Publications (avis et réponses) au plus par passage. */
export const MAX_PUBLICATIONS_PAR_PASSAGE = 4;
/** Rédactions par l'IA au plus par passage. */
export const MAX_REDACTIONS_PAR_PASSAGE = 4;
/** Pages d'avis lues au plus (100 par page). */
const PAGES_AVIS_HOTE = 3;
const PAGES_AVIS_SANS_REPONSE = 2;
/** Temps à garder pour une rédaction par l'IA, puis pour un envoi. */
const TEMPS_REDACTION_MS = 15_000;
const TEMPS_ENVOI_MS = 5_000;

/** Auteur des écritures et du journal. */
const AUTEUR = PAR_PUBLICATION_AUTO;
const ACTION_JOURNAL = 'Avis publiés';

export const AVIS_INTROUVABLE = 'Airbnb ne propose pas cet avis à notre service de connexion : déposez-le vous-même sur Airbnb.';

const NOMS: Record<string, string> = { airbnb: 'Airbnb', booking: 'Booking.com' };
const nomPlateforme = (c: string | undefined) => NOMS[plateformeAvis(c)] ?? 'la plateforme';

export interface OptionsAvisAuto extends ContexteConnexion {
  /** Client Claude de l'agent ; absent : textes simples. */
  ia?: ClientIA | null;
  modele?: string;
  /** Nom de l'espace (signature, consignes) ; absent : Label Maison. */
  nomEspace?: string;
  /** Décisions de l'IA permises par mois pour cet espace (partagées avec l'agent) ; absent : sans plafond. */
  plafondIAMois?: number;
  maxPublications?: number;
  maxRedactions?: number;
}

export interface DonneesAvisAuto {
  reglagesLus: Reglage[];
  reservations: Reservation[];
  logements: Map<string, Logement>;
  avis: AvisADeposer[];
  reponses: ReponseAvisAuto[];
  incidents: Incident[];
  controles: ControleQualite[];
  fils: () => Promise<FilMessages[]>;
  proprietaires: () => Promise<Proprietaire[]>;
}

export interface BilanAvisAuto {
  /** Le passage a tourné (réglage allumé, et dû). */
  lance: boolean;
  /** Tout ce qui était dû a été traité. */
  complet: boolean;
  avisPublies: number;
  reponsesPubliees: number;
  aValider: number;
  echecs: number;
  expires: number;
  appelsIA: number;
  erreurs: string[];
  /** Part des appels du mois trop basse : rien n'a été lu. */
  budget?: true;
}

/** Résultat d'un envoi à la plateforme. */
type Envoi = { ok: true; deja?: true } | { ok: false; statut: 'echec' | 'expire' | 'reprendre'; message: string };

/** Ce que la plateforme a répondu, en clair. */
function lireEchec(e: unknown, genre: 'voyageur' | 'reponse'): Envoi {
  if (e instanceof BudgetEpuise || e instanceof DelaiEcoule) throw e;
  if (e instanceof ErreurRepull) {
    if (e.statut === 409 && (e.code === 'review_already_submitted' || e.code === 'already_replied' || (genre === 'reponse' && e.code !== 'reply_not_allowed'))) return { ok: true, deja: true };
    if (e.statut === 409 && e.code === 'review_window_closed') return { ok: false, statut: 'expire', message: 'Le délai d’Airbnb pour cet avis est passé.' };
    if (e.statut === 409 && e.code === 'reply_not_allowed') return { ok: false, statut: 'echec', message: 'La plateforme ne prend plus de réponse à cet avis.' };
    if (e.statut === 403 && e.code === 'listing_inactive') return { ok: false, statut: 'echec', message: 'Ce logement est désactivé chez notre service de connexion : rien n’a été publié. Réactivez-le dans Logements → Connexions.' };
    if (e.statut === 403 && e.code === 'connection_reauth_required') return { ok: false, statut: 'echec', message: 'La connexion à la plateforme est à refaire (Logements → Connexions) : rien n’a été publié.' };
    if (e.statut === 422 && e.code === 'unsupported_channel') return { ok: false, statut: 'echec', message: 'Cette plateforme ne prend pas cet avis par notre service de connexion : rien n’a été publié.' };
    if (e.statut >= 400 && e.statut < 500 && e.statut !== 408 && e.statut !== 429) return { ok: false, statut: 'echec', message: `La plateforme a refusé : rien n’a été publié. ${messageErreur(e)}`.trim() };
  }
  // Réseau, 5xx, 429 : peut-être parti ; la marque « en cours » reste, la plateforme le dira au passage suivant.
  return { ok: false, statut: 'reprendre', message: `Pas de réponse de la plateforme : ${e instanceof Error ? e.message : String(e)}` };
}

/** Écriture d'une publication sur une ligne d'avis à déposer, sans jamais écraser une décision prise entre-temps. */
async function ecrireLigneAvis(
  o: Pick<ContexteConnexion, 'base'>,
  r: Reservation,
  pub: PublicationAvis,
  extra: Partial<AvisADeposer>,
  attendus: (StatutPublication | 'aucune')[],
  le: string,
): Promise<AvisADeposer | null> {
  for (let essai = 0; essai < 3; essai++) {
    const [lu] = await o.base.lireVersions<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, [r.id]);
    const avant = lu?.element;
    const actuel = avant?.publication?.statut ?? 'aucune';
    // « C’est fait » ou « Passer » de l'équipe, ou une autre décision : on n'y touche pas.
    if (avant && (avant.statut === 'fait' || avant.statut === 'passe') && pub.statut !== 'publie') return null;
    if (!attendus.includes(actuel)) return null;
    const neuf: AvisADeposer = {
      id: r.id,
      reservationId: r.id,
      logementId: r.logementId,
      voyageur: prenomDe(r.voyageur?.nom) || 'Voyageur',
      depart: r.depart,
      canal: r.canal,
      statut: 'a_rediger',
      creeLe: le,
    };
    const suivant: AvisADeposer = { ...(avant ?? neuf), ...extra, publication: pub };
    if (!lu) {
      if ((await o.base.ajouterSiAbsent(COLLECTION_AVIS_A_DEPOSER, [suivant], AUTEUR)) > 0) return suivant;
      continue;
    }
    if (!lu.version) {
      await o.base.ecrire(COLLECTION_AVIS_A_DEPOSER, [suivant], AUTEUR);
      return suivant;
    }
    if (await o.base.remplacerSi(COLLECTION_AVIS_A_DEPOSER, suivant, lu.version, AUTEUR)) return suivant;
  }
  return null;
}

/** Même chose pour une réponse à un avis (collection reponsesAvis). */
async function ecrireLigneReponse(
  o: Pick<ContexteConnexion, 'base'>,
  ligne: Omit<ReponseAvisAuto, 'publication' | 'creeLe'> & { creeLe?: string },
  pub: PublicationAvis,
  attendus: (StatutPublication | 'aucune')[],
  le: string,
): Promise<ReponseAvisAuto | null> {
  for (let essai = 0; essai < 3; essai++) {
    const [lu] = await o.base.lireVersions<ReponseAvisAuto>(COLLECTION_REPONSES_AVIS, [ligne.id]);
    const actuel = lu?.element?.publication?.statut ?? 'aucune';
    if (!attendus.includes(actuel)) return null;
    const suivant: ReponseAvisAuto = { ...(lu?.element ?? {}), ...ligne, creeLe: lu?.element?.creeLe ?? ligne.creeLe ?? le, publication: pub };
    if (!lu) {
      if ((await o.base.ajouterSiAbsent(COLLECTION_REPONSES_AVIS, [suivant], AUTEUR)) > 0) return suivant;
      continue;
    }
    if (!lu.version) {
      await o.base.ecrire(COLLECTION_REPONSES_AVIS, [suivant], AUTEUR);
      return suivant;
    }
    if (await o.base.remplacerSi(COLLECTION_REPONSES_AVIS, suivant, lu.version, AUTEUR)) return suivant;
  }
  return null;
}

/** Trace dans « Actions de l'IA » : jamais bloquante (le journal garde aussi la publication). */
async function tracer(o: Pick<ContexteConnexion, 'base'>, e: Parameters<typeof actionPublicationAvis>[0]): Promise<void> {
  try {
    if (!(await actionsIaProtegees(o.base))) return;
    const espace = await o.base.espace();
    await o.base.ecrire(COLLECTION_ACTIONS_AGENT, [actionPublicationAvis({ ...e, espace })], AUTEUR);
  } catch (err) {
    console.warn('[avis] trace des actions de l’IA non écrite', err instanceof Error ? err.message : err);
  }
}

async function journal(o: Pick<ContexteConnexion, 'base'>, le: string, entite: string, entiteId: string, details: string): Promise<void> {
  const l: Journal = { id: `avis-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, horodatage: le, auteur: AUTEUR, action: ACTION_JOURNAL, entite, entiteId, details };
  await o.base.ecrire('journal', [l], AUTEUR).catch(() => undefined);
}

/** POST de l'avis sur le voyageur (5 étoiles, recommandé). */
async function envoyerAvisVoyageur(client: ClientRepull, avisId: string, r: Reservation, texte: string): Promise<Envoi> {
  try {
    await client.post(`/v1/reviews/${avisId}/guest-review`, { publicReview: texte, rating: NOTE_AVIS_AUTO, isRevieweeRecommended: true }, {}, { 'Idempotency-Key': `lm-avis-voyageur-${r.id}`.slice(0, 255) });
    return { ok: true };
  } catch (e) {
    return lireEchec(e, 'voyageur');
  }
}

/** POST de la réponse publique à l'avis du voyageur. */
async function envoyerReponse(client: ClientRepull, avisId: string, r: Reservation, texte: string): Promise<Envoi> {
  try {
    await client.post(`/v1/reviews/${avisId}/reply`, { message: texte }, {}, { 'Idempotency-Key': `lm-reponse-avis-${r.id}`.slice(0, 255) });
    return { ok: true };
  } catch (e) {
    return lireEchec(e, 'reponse');
  }
}

const ligneReponse = (r: Reservation, a: Pick<RepullReview, 'rating' | 'publicReview'>): Omit<ReponseAvisAuto, 'publication' | 'creeLe'> => {
  const note = noteSur5(a.rating);
  const avis = masquerCoordonnees(String(a.publicReview ?? '')).trim().slice(0, 600);
  return {
    id: r.id,
    reservationId: r.id,
    logementId: r.logementId,
    voyageur: prenomDe(r.voyageur?.nom) || 'Voyageur',
    canal: r.canal,
    ...(note !== undefined ? { note } : {}),
    ...(avis ? { avis } : {}),
  };
};

/* ===================================================== passage du jour */

class PassageAvis {
  readonly bilan: BilanAvisAuto = { lance: false, complet: true, avisPublies: 0, reponsesPubliees: 0, aValider: 0, echecs: 0, expires: 0, appelsIA: 0, erreurs: [] };
  private readonly maintenant: () => Date;
  private publications = 0;
  /** L'IA de ce passage : plafond du mois atteint (texte simple), ou en panne (le reste attend le passage suivant). */
  private etatIA: 'ok' | 'plafond' | 'panne' = 'ok';

  constructor(private readonly o: OptionsAvisAuto) {
    this.maintenant = o.maintenant ?? (() => new Date());
  }

  private le = () => horodatageParis(this.maintenant());
  private reste = () => this.o.echeance - Date.now();
  private get maxPublications() {
    return this.o.maxPublications ?? MAX_PUBLICATIONS_PAR_PASSAGE;
  }

  /**
   * Une rédaction est-elle encore possible dans ce passage ? Sans IA (ou au
   * plafond du mois) : le texte simple, toujours. IA en panne, assez de
   * rédactions ou plus le temps : au passage suivant.
   */
  private redactionPossible(): boolean {
    if (!this.o.ia || this.etatIA === 'plafond') return true;
    if (this.etatIA === 'panne') return false;
    return this.bilan.appelsIA < (this.o.maxRedactions ?? MAX_REDACTIONS_PAR_PASSAGE) && this.reste() >= TEMPS_REDACTION_MS;
  }

  private envoiPossible(): boolean {
    return this.publications < this.maxPublications && this.reste() >= TEMPS_ENVOI_MS;
  }

  async lancer(d: DonneesAvisAuto): Promise<BilanAvisAuto> {
    const reglages = reglagesAvisAuto({ reglages: d.reglagesLus });
    const voyageursOn = allume(reglages.voyageurs);
    const reponsesOn = allume(reglages.reponses);
    if (!voyageursOn && !reponsesOn) return this.bilan;
    const maintenant = this.maintenant();
    const aujourdhui = dateParisDe(maintenant);
    const [etatLu] = await this.o.base.lireVersions<EtatAvisAuto>(COLLECTION_ETAT_PROGRAMMES, [ID_ETAT_AVIS_AUTO]);
    if (!passageAvisDu(etatLu?.element, maintenant)) return this.bilan;
    this.bilan.lance = true;

    const avisParId = new Map(d.avis.map((a) => [a.id, a]));
    const decisions = voyageursOn ? d.reservations.map((r) => ({ r, x: deciderAvisVoyageur(r, avisParId.get(r.id), aujourdhui, reglages.voyageurs) })) : [];
    // Délai d'Airbnb passé pour un avis à valider (ou un envoi resté en cours) : noté, sans appel.
    for (const { r } of decisions.filter((x) => x.x.genre === 'expirer')) {
      const p = avisParId.get(r.id)?.publication;
      if (await ecrireLigneAvis(this.o, r, { ...(p ?? {}), statut: 'expire', le: this.le(), erreur: 'Le délai d’Airbnb pour cet avis est passé.' }, { statut: 'passe' }, ['a_valider', 'en_cours'], this.le())) this.bilan.expires++;
    }
    const voyageurs = decisions.filter((x) => x.x.genre === 'preparer').map((x) => x.r).sort((a, b) => a.depart.localeCompare(b.depart));
    const reponsesParId = new Map(d.reponses.map((x) => [x.id, x]));
    // Un avis de voyageur ne peut exister qu'après un séjour terminé, Airbnb ou Booking.com, depuis moins de 45 jours.
    const limite = new Date(maintenant.getTime() - 45 * 86_400_000).toISOString().slice(0, 10);
    const reponsesPossibles =
      reponsesOn &&
      d.reservations.some(
        (r) => (PLATEFORMES_REPONSE as readonly string[]).includes(r.canal) && r.statut !== 'annulee' && r.depart <= aujourdhui && r.depart >= limite && reponsesParId.get(r.id)?.publication.statut !== 'publie',
      );

    if (voyageurs.length || reponsesPossibles) {
      const etatRepull = await lireEtat(this.o.base, maintenant, this.o.budgetMois ?? BUDGET_ERP_DEFAUT, this.o.quotaMois ?? QUOTA_MOIS_DEFAUT);
      if (etatRepull.budgetMois - etatRepull.appelsMois < RESERVE_APPELS) {
        this.bilan.budget = true;
        this.bilan.complet = false;
      } else {
        try {
          await avecClient(this.o, async (client) => {
            const sejour = indexSejours(d.reservations);
            if (voyageurs.length) {
              const trouves = await this.avisHotes(client, voyageurs, sejour);
              for (const r of voyageurs) {
                if (this.reste() < TEMPS_ENVOI_MS) {
                  this.bilan.complet = false;
                  break;
                }
                await this.avisVoyageur(client, r, trouves.get(r.id), d, aujourdhui);
              }
            }
            if (reponsesPossibles && this.reste() >= TEMPS_ENVOI_MS) {
              const nouveaux = await this.avisSansReponse(client, sejour, reponsesParId);
              for (const { r, a } of nouveaux) {
                if (this.reste() < TEMPS_ENVOI_MS) {
                  this.bilan.complet = false;
                  break;
                }
                await this.reponse(client, r, a, d);
              }
            } else if (reponsesPossibles) this.bilan.complet = false;
          });
        } catch (e) {
          this.bilan.complet = false;
          if (e instanceof BudgetEpuise) this.bilan.budget = true;
          else if (!(e instanceof DelaiEcoule)) this.bilan.erreurs.push(messageErreur(e, { budgetMois: this.o.budgetMois, origineCle: this.o.origineCle }));
        }
      }
    }
    await this.noterPassage(etatLu, aujourdhui);
    if (this.bilan.avisPublies || this.bilan.reponsesPubliees || this.bilan.aValider || this.bilan.echecs || this.bilan.erreurs.length) {
      console.log('[avis]', JSON.stringify({ avis: this.bilan.avisPublies, reponses: this.bilan.reponsesPubliees, aValider: this.bilan.aValider, echecs: this.bilan.echecs, complet: this.bilan.complet }));
    }
    return this.bilan;
  }

  /** État du passage (jour, essais) : un passage incomplet est repris une heure après, quatre fois au plus. */
  private async noterPassage(etatLu: { element: EtatAvisAuto; version: string } | undefined, jour: string) {
    const avant = etatLu?.element;
    const suivant: EtatAvisAuto = {
      id: ID_ETAT_AVIS_AUTO,
      jour,
      complet: this.bilan.complet,
      essais: avant?.jour === jour ? (avant.essais ?? 0) + 1 : 1,
      dernierEssai: this.maintenant().toISOString(),
    };
    try {
      if (etatLu?.version) await this.o.base.remplacerSi(COLLECTION_ETAT_PROGRAMMES, suivant, etatLu.version, AUTEUR);
      else await this.o.base.ecrire(COLLECTION_ETAT_PROGRAMMES, [suivant], AUTEUR);
    } catch {
      /* repris au passage suivant */
    }
  }

  /** Avis à déposer sur les voyageurs, chez Airbnb : les pages récentes, jusqu'à trouver ceux des séjours attendus. */
  private async avisHotes(client: ClientRepull, voyageurs: Reservation[], sejour: ReturnType<typeof indexSejours>): Promise<Map<string, RepullReview>> {
    const voulus = new Set(voyageurs.map((r) => r.id));
    const trouves = new Map<string, RepullReview>();
    let pages = 0;
    for await (const page of client.pages<RepullReview>('/v1/reviews', { reviewerRole: 'host', platform: 'airbnb', status: 'all' })) {
      pages++;
      for (const a of page) {
        if (!a?.id || (a.reviewerRole && a.reviewerRole !== 'host') || (a.platform && plateformeAvis(a.platform) !== 'airbnb')) continue;
        const r = sejour(a);
        if (r && voulus.has(r.id) && !trouves.has(r.id)) trouves.set(r.id, a);
      }
      if (trouves.size === voulus.size || pages >= PAGES_AVIS_HOTE) break;
    }
    return trouves;
  }

  /** Avis des voyageurs sans réponse (Airbnb, Booking.com), récents, reliés à un séjour de l'ERP. */
  private async avisSansReponse(
    client: ClientRepull,
    sejour: ReturnType<typeof indexSejours>,
    reponsesParId: Map<string, ReponseAvisAuto>,
  ): Promise<{ r: Reservation; a: RepullReview }[]> {
    const res: { r: Reservation; a: RepullReview }[] = [];
    const vus = new Set<string>();
    let pages = 0;
    for await (const page of client.pages<RepullReview>('/v1/reviews', { reviewerRole: 'guest', status: 'unanswered' })) {
      pages++;
      for (const a of page) {
        if (!a?.id) continue;
        const r = sejour(a);
        if (!r || vus.has(r.id) || !reponseADecider(a, r, reponsesParId.get(r.id), this.maintenant())) continue;
        vus.add(r.id);
        res.push({ r, a });
      }
      if (pages >= PAGES_AVIS_SANS_REPONSE) break;
    }
    return res;
  }

  /* -------------------------------------------- avis sur un voyageur */

  private async avisVoyageur(client: ClientRepull, r: Reservation, a: RepullReview | undefined, d: DonneesAvisAuto, aujourdhui: string) {
    const prenom = prenomDe(r.voyageur?.nom);
    const attendus: (StatutPublication | 'aucune')[] = ['aucune', 'en_cours'];
    if (!a) {
      // Pas encore proposé par Airbnb : un jour de grâce, puis l'équipe le dépose elle-même (carte « Votre avis sur le voyageur »).
      const jours = Math.round((Date.parse(`${aujourdhui}T00:00:00Z`) - Date.parse(`${r.depart}T00:00:00Z`)) / 86_400_000);
      if (jours > JOURS_AVANT_AVIS_AUTO && (await ecrireLigneAvis(this.o, r, { statut: 'echec', le: this.le(), erreur: AVIS_INTROUVABLE }, {}, attendus, this.le()))) this.bilan.echecs++;
      return;
    }
    if (avisDepose(a)) {
      // Déjà déposé sur Airbnb (à la main, ou un envoi coupé qui est passé) : noté, rien n'est renvoyé.
      const texte = String(a.publicReview ?? '').trim();
      await ecrireLigneAvis(
        this.o,
        r,
        { statut: 'publie', avisId: String(a.id), le: this.le(), publieLe: a.submittedAt || this.le(), deja: true, ...(texte ? { texte } : {}) },
        { statut: 'fait', traiteLe: this.le() },
        attendus,
        this.le(),
      );
      return;
    }
    if (a.expiresAt && Date.parse(a.expiresAt) <= this.maintenant().getTime()) {
      if (await ecrireLigneAvis(this.o, r, { statut: 'expire', avisId: String(a.id), le: this.le(), erreur: 'Le délai d’Airbnb pour cet avis est passé.' }, { statut: 'passe' }, attendus, this.le())) this.bilan.expires++;
      return;
    }
    if (!this.redactionPossible()) {
      this.bilan.complet = false;
      return;
    }
    const [fils, proprietaires] = await Promise.all([d.fils(), d.proprietaires()]);
    const logement = d.logements.get(r.logementId);
    const raisons = raisonsAvisSensible(r, { incidents: d.incidents, controles: d.controles, filsMessages: fils, logements: [...d.logements.values()], proprietaires });
    const langue = langueVoyageur(r, fils);
    let redige: AvisRedige = { texte: '', source: 'modele', raisons: [...raisons], appelIA: false };
    if (this.o.ia && this.etatIA === 'ok') {
      redige = await redigerAvisVoyageur(
        { base: this.o.base, ia: this.o.ia, modele: this.o.modele, nomEspace: this.o.nomEspace, plafondIAMois: this.o.plafondIAMois, maintenant: this.o.maintenant, echeance: this.o.echeance },
        r,
        logement,
        fils,
        raisons,
        langue,
      );
      if (redige.appelIA) this.bilan.appelsIA++;
      if (redige.echec) {
        this.etatIA = redige.echec.plafond ? 'plafond' : 'panne';
        if (!redige.echec.plafond) this.bilan.erreurs.push(`Avis de ${prenom || 'voyageur'} : ${redige.echec.message}`);
      }
    }
    const soucis = soucisDuSejour(redige.raisons);
    // Texte simple (un éloge) seulement pour un séjour sans souci.
    const texte = redige.texte || (soucis.length ? '' : texteAvisParDefaut(prenom, langue));
    const panne =
      redige.echec && !redige.echec.plafond
        ? 'Votre agent n’a pas pu rédiger l’avis : relisez le texte simple'
        : redige.illisible
          ? 'Votre agent n’a pas rédigé d’avis sûr : relisez le texte simple'
          : undefined;
    const problemes = texte ? problemesTexteAvis(texte, { nomVoyageur: r.voyageur?.nom, ...(logement ? { logement } : {}) }) : [];
    const v = verdictAvisVoyageur({ raisons: soucis, texte, problemes, ...(panne ? { panne } : {}) });
    if (!v.publier) {
      const ecrit = await ecrireLigneAvis(
        this.o,
        r,
        { statut: 'a_valider', avisId: String(a.id), le: this.le(), texte: v.texte, raisons: v.raisons },
        { statut: 'a_relire', texte: v.texte, source: redige.source, raisons: v.raisons, redigeLe: this.le() },
        attendus,
        this.le(),
      );
      if (ecrit) this.bilan.aValider++;
      return;
    }
    if (!this.envoiPossible()) {
      this.bilan.complet = false;
      return;
    }
    // Marque AVANT l'envoi : si elle ne s'écrit pas (l'équipe a décidé entre-temps), rien ne part.
    const marque = await ecrireLigneAvis(this.o, r, { statut: 'en_cours', avisId: String(a.id), le: this.le(), depuis: this.le(), texte }, { texte, source: redige.source, redigeLe: this.le() }, attendus, this.le());
    if (!marque) return;
    const envoi = await envoyerAvisVoyageur(client, String(a.id), r, texte);
    await this.apresEnvoiVoyageur(r, String(a.id), texte, envoi, { par: AUTEUR }, logement);
  }

  private async apresEnvoiVoyageur(r: Reservation, avisId: string, texte: string, envoi: Envoi, qui: { par: string; email?: string; modifie?: boolean }, logement?: Logement) {
    if (envoi.ok) {
      this.publications++;
      const le = this.le();
      await ecrireLigneAvis(
        this.o,
        r,
        { statut: 'publie', avisId, le, publieLe: le, par: qui.par, texte, ...(envoi.deja ? { deja: true as const } : {}), ...(qui.modifie ? { modifie: true as const } : {}) },
        { statut: 'fait', texte, traiteLe: le, traitePar: qui.par },
        ['en_cours'],
        le,
      );
      if (envoi.deja) return;
      this.bilan.avisPublies++;
      await tracer(this.o, { genre: 'voyageur', reservation: r, plateforme: 'Airbnb', texte, le, ...(qui.email ? { par: qui.email } : {}), ...(qui.modifie ? { modifie: true } : {}), ...(logement ? { logement } : {}), note: NOTE_AVIS_AUTO });
      await journal(this.o, le, COLLECTION_AVIS_A_DEPOSER, r.id, `Avis sur ${prenomDe(r.voyageur?.nom) || 'le voyageur'} publié sur Airbnb (${NOTE_AVIS_AUTO} étoiles)${qui.email ? ` par ${qui.par}` : ', automatiquement'}.`);
      return;
    }
    if (envoi.statut === 'reprendre') {
      this.bilan.erreurs.push(envoi.message);
      return;
    }
    if (envoi.statut === 'expire') this.bilan.expires++;
    else this.bilan.echecs++;
    await ecrireLigneAvis(this.o, r, { statut: envoi.statut, avisId, le: this.le(), erreur: envoi.message, texte }, envoi.statut === 'expire' ? { statut: 'passe' } : {}, ['en_cours'], this.le());
  }

  /* ------------------------------------------- réponse à un avis */

  private async reponse(client: ClientRepull, r: Reservation, a: RepullReview, d: DonneesAvisAuto) {
    const ligne = ligneReponse(r, a);
    const attendus: (StatutPublication | 'aucune')[] = ['aucune', 'en_cours'];
    // L'avis tel que la plateforme le donne (la synchronisation des avis passe une fois par semaine).
    const r2 = appliquerAvis(r, a);
    const lu = lireAvis(r2);
    if (!lu || sansReponse(lu)) {
      await ecrireLigneReponse(this.o, ligne, { statut: 'sans_objet', avisId: String(a.id), le: this.le(), raisons: [lu ? (sansReponse(lu) ?? '') : 'Avis vide'] }, attendus, this.le());
      return;
    }
    if (!this.redactionPossible()) {
      this.bilan.complet = false;
      return;
    }
    const logement = d.logements.get(r.logementId);
    const red = await redigerReponseAvis(
      { base: this.o.base, ia: this.o.ia, modele: this.o.modele, nomEspace: this.o.nomEspace, plafondIAMois: this.o.plafondIAMois, maintenant: this.o.maintenant, par: AUTEUR },
      r2,
      lu,
      { ...(logement ? { logement } : {}), reglagesLus: d.reglagesLus, delaiMs: Math.min(20_000, this.reste() - 4_000), repliSurPanne: true },
    );
    if (red.appelIA) this.bilan.appelsIA++;
    if (red.panne && this.o.ia) this.etatIA = 'panne';
    if (red.lecture) await garderLecture(this.o, r.id, red.lecture).catch(() => false);
    // La lecture de l'IA ne peut que rendre l'avis plus sévère (avis.ts, lireAvis).
    const lecture = red.lecture ? (lireAvis({ ...r2, lectureAvis: red.lecture }) ?? lu) : lu;
    const raisons = raisonsReponseAValider(lecture);
    if (red.ecartee) raisons.push('La proposition de votre agent a été écartée : relisez le texte simple');
    if (red.panne) raisons.push('Votre agent n’a pas pu rédiger la réponse : relisez le texte simple');
    const texte = red.texte.trim();
    const problemes = problemesReponse(texte, { nomVoyageur: r.voyageur?.nom, textePrive: lu.textePrive, ...(logement ? { logement } : {}) });
    if (problemes.length) raisons.push(`Le texte contient ${problemes.join(', ')} : à vérifier`);
    if (texte.length > LONGUEUR_MAX_AVIS) raisons.push('Réponse de plus de 1 000 caractères : à raccourcir');
    if (raisons.length) {
      if (await ecrireLigneReponse(this.o, ligne, { statut: 'a_valider', avisId: String(a.id), le: this.le(), texte, raisons: [...new Set(raisons)] }, attendus, this.le())) this.bilan.aValider++;
      return;
    }
    if (!this.envoiPossible()) {
      this.bilan.complet = false;
      return;
    }
    const marque = await ecrireLigneReponse(this.o, ligne, { statut: 'en_cours', avisId: String(a.id), le: this.le(), depuis: this.le(), texte }, attendus, this.le());
    if (!marque) return;
    const envoi = await envoyerReponse(client, String(a.id), r, texte);
    await this.apresEnvoiReponse(marque, r, String(a.id), texte, envoi, { par: AUTEUR }, logement, nomPlateforme(a.platform ?? r.canal));
  }

  private async apresEnvoiReponse(
    ligne: ReponseAvisAuto,
    r: Reservation,
    avisId: string,
    texte: string,
    envoi: Envoi,
    qui: { par: string; email?: string; modifie?: boolean },
    logement: Logement | undefined,
    plateforme: string,
  ) {
    const { publication: _p, creeLe: _c, ...base } = ligne;
    if (envoi.ok) {
      this.publications++;
      const le = this.le();
      await ecrireLigneReponse(
        this.o,
        base,
        { statut: 'publie', avisId, le, publieLe: le, par: qui.par, texte, ...(envoi.deja ? { deja: true as const } : {}), ...(qui.modifie ? { modifie: true as const } : {}) },
        ['en_cours'],
        le,
      );
      if (envoi.deja) return;
      this.bilan.reponsesPubliees++;
      await tracer(this.o, { genre: 'reponse', reservation: r, plateforme, texte, le, ...(qui.email ? { par: qui.email } : {}), ...(qui.modifie ? { modifie: true } : {}), ...(logement ? { logement } : {}) });
      await journal(this.o, le, COLLECTION_REPONSES_AVIS, r.id, `Réponse à l’avis de ${base.voyageur} publiée sur ${plateforme}${qui.email ? ` par ${qui.par}` : ', automatiquement'}.`);
      return;
    }
    if (envoi.statut === 'reprendre') {
      this.bilan.erreurs.push(envoi.message);
      return;
    }
    this.bilan.echecs++;
    await ecrireLigneReponse(this.o, base, { statut: envoi.statut, avisId, le: this.le(), erreur: envoi.message, texte }, ['en_cours'], this.le());
  }

  /* --------------------------------------------- « Publier » du gérant */

  /**
   * Publie le texte validé (et peut-être retouché) par le gérant, pour un
   * avis gardé « à valider » : relu chez la plateforme d'abord.
   */
  async publierGerant(genre: 'voyageur' | 'reponse', reservationId: string, texteBrut: string, qui: { email: string; nom: string }): Promise<ResultatPublication> {
    const texte = String(texteBrut ?? '').replace(/\r\n/g, '\n').trim();
    const id = String(reservationId ?? '').trim();
    const [r] = id ? await this.o.base.lire<Reservation>('reservations', [id]) : [];
    if (!r) return refus('Séjour introuvable : rechargez la page.', 404);
    const [logement] = r.logementId ? await this.o.base.lire<Logement>('logements', [r.logementId]) : [];
    const aujourdhui = dateParisDe(this.maintenant());

    if (genre === 'voyageur') {
      const [ligne] = await this.o.base.lire<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, [r.id]);
      const p = ligne?.publication;
      if (!ligne || p?.statut !== 'a_valider' || !p.avisId) return refus('Cet avis n’attend plus votre accord : rechargez la page.', 409);
      if (fenetreAvisVoyageur(r, aujourdhui) !== 'ouverte') return refus('Le délai d’Airbnb pour cet avis est passé : il ne peut plus être publié.', 409);
      const problemes = problemesTexteAvis(texte, { nomVoyageur: r.voyageur?.nom, ...(logement ? { logement } : {}) });
      if (problemes.length) return refus(`Le texte contient ${problemes.join(', ')} : retirez-le avant de publier.`, 400);
      return avecClient(this.o, async (client) => {
        const a = await client.get<RepullReview>(`/v1/reviews/${encodeURIComponent(p.avisId!)}`);
        const meme = indexSejours([r])(a)?.id === r.id;
        if (!meme || (a.reviewerRole && a.reviewerRole !== 'host') || (a.platform && plateformeAvis(a.platform) !== 'airbnb')) return refus('Cet avis ne correspond pas à ce séjour : rien n’a été publié.', 409);
        if (avisDepose(a)) {
          await ecrireLigneAvis(this.o, r, { statut: 'publie', avisId: p.avisId, le: this.le(), publieLe: a.submittedAt || this.le(), deja: true }, { statut: 'fait', traiteLe: this.le() }, ['a_valider'], this.le());
          return { ok: true as const, message: 'Cet avis était déjà déposé sur Airbnb : rien n’a été renvoyé.' };
        }
        const marque = await ecrireLigneAvis(this.o, r, { ...p, statut: 'en_cours', le: this.le(), depuis: this.le() }, {}, ['a_valider'], this.le());
        if (!marque) return refus('Cet avis vient de changer : rechargez la page.', 409);
        const envoi = await envoyerAvisVoyageur(client, p.avisId!, r, texte);
        await this.apresEnvoiVoyageur(r, p.avisId!, texte, envoi, { par: qui.nom, email: qui.email, ...(texte !== (p.texte ?? '').trim() ? { modifie: true } : {}) }, logement);
        if (envoi.ok) return { ok: true as const, message: envoi.deja ? 'Cet avis était déjà déposé sur Airbnb : rien n’a été renvoyé.' : 'Avis publié sur Airbnb.' };
        if (envoi.statut === 'reprendre') {
          // Peut-être parti : on le saura au prochain passage (jamais renvoyé sans vérifier).
          return refus('Pas de réponse d’Airbnb : la publication sera vérifiée au prochain passage, rien ne sera envoyé deux fois.', 502);
        }
        return refus(envoi.message, 409);
      });
    }

    const [ligne] = await this.o.base.lire<ReponseAvisAuto>(COLLECTION_REPONSES_AVIS, [r.id]);
    const p = ligne?.publication;
    if (!ligne || p?.statut !== 'a_valider' || !p.avisId) return refus('Cette réponse n’attend plus votre accord : rechargez la page.', 409);
    if (!texte) return refus('La réponse est vide.', 400);
    if (texte.length > LONGUEUR_MAX_AVIS) return refus('La réponse fait plus de 1 000 caractères : raccourcissez-la.', 400);
    return avecClient(this.o, async (client) => {
      const a = await client.get<RepullReview>(`/v1/reviews/${encodeURIComponent(p.avisId!)}`);
      const meme = indexSejours([r])(a)?.id === r.id;
      if (!meme || (a.reviewerRole && a.reviewerRole !== 'guest') || !(PLATEFORMES_REPONSE as readonly string[]).includes(plateformeAvis(a.platform))) return refus('Cet avis ne correspond pas à ce séjour : rien n’a été publié.', 409);
      const prive = String(a.privateFeedback ?? '').trim();
      const problemes = problemesReponse(texte, { nomVoyageur: r.voyageur?.nom, textePrive: prive, ...(logement ? { logement } : {}) });
      if (problemes.length) return refus(`Le texte contient ${problemes.join(', ')} : retirez-le avant de publier.`, 400);
      if (avisRepondu(a)) {
        const { publication: _x, creeLe: _y, ...base } = ligne;
        await ecrireLigneReponse(this.o, base, { ...p, statut: 'publie', le: this.le(), publieLe: this.le(), deja: true }, ['a_valider'], this.le());
        return { ok: true as const, message: 'Cet avis a déjà une réponse sur la plateforme : rien n’a été renvoyé.' };
      }
      const { publication: _x, creeLe: _y, ...base } = ligne;
      const marque = await ecrireLigneReponse(this.o, base, { ...p, statut: 'en_cours', le: this.le(), depuis: this.le() }, ['a_valider'], this.le());
      if (!marque) return refus('Cette réponse vient de changer : rechargez la page.', 409);
      const envoi = await envoyerReponse(client, p.avisId!, r, texte);
      const plateforme = nomPlateforme(a.platform ?? r.canal);
      await this.apresEnvoiReponse(marque, r, p.avisId!, texte, envoi, { par: qui.nom, email: qui.email, ...(texte !== (p.texte ?? '').trim() ? { modifie: true } : {}) }, logement, plateforme);
      if (envoi.ok) return { ok: true as const, message: envoi.deja ? 'Cet avis a déjà une réponse sur la plateforme : rien n’a été renvoyé.' : `Réponse publiée sur ${plateforme}.` };
      if (envoi.statut === 'reprendre') return refus(`Pas de réponse de ${plateforme} : la publication sera vérifiée au prochain passage, rien ne sera envoyé deux fois.`, 502);
      return refus(envoi.message, 409);
    });
  }
}

export type ResultatPublication = { ok: true; message: string } | { ok: false; message: string; statut: number };
const refus = (message: string, statut: number): ResultatPublication => ({ ok: false, message, statut });

/**
 * Passage du jour des avis dans l'espace de `o.base` (après les messages
 * automatiques, sous le même verrou : lancerProgrammes). Réglages éteints ou
 * passage pas dû : rien, aucun appel. Ne lève pas : un échec est noté.
 */
export async function passerAvisAuto(o: OptionsAvisAuto, d: DonneesAvisAuto): Promise<BilanAvisAuto> {
  const p = new PassageAvis(o);
  try {
    return await p.lancer(d);
  } catch (e) {
    p.bilan.complet = false;
    p.bilan.erreurs.push(e instanceof Error ? e.message : String(e));
    return p.bilan;
  }
}

/**
 * « Publier » du gérant depuis « À valider » (api/_erp-avis.ts) : l'avis sur
 * le voyageur ou la réponse à l'avis, avec le texte qu'il a validé. Réglage
 * éteint depuis : rien n'est publié.
 */
export async function publierAvisParGerant(
  o: OptionsAvisAuto,
  demande: { genre: unknown; reservationId: unknown; texte: unknown },
  qui: { email: string; nom: string },
): Promise<ResultatPublication> {
  const genre = demande.genre === 'voyageur' || demande.genre === 'reponse' ? demande.genre : null;
  if (!genre) return refus('Demande inconnue.', 400);
  const reglagesLus = await o.base.lire<Reglage>('reglages', ['messages-programmes']);
  const reglages = reglagesAvisAuto({ reglages: reglagesLus });
  if (!allume(genre === 'voyageur' ? reglages.voyageurs : reglages.reponses)) {
    return refus('La publication automatique de ces avis est éteinte (Logements → Avis) : rien n’a été publié.', 409);
  }
  try {
    return await new PassageAvis(o).publierGerant(genre, String(demande.reservationId ?? ''), String(demande.texte ?? ''), qui);
  } catch (e) {
    if (e instanceof BudgetEpuise) return refus(messageErreur(e, { budgetMois: o.budgetMois, origineCle: o.origineCle }), 429);
    if (e instanceof DelaiEcoule) return refus('La plateforme met trop de temps à répondre : réessayez dans un instant.', 504);
    return refus(messageErreur(e, { budgetMois: o.budgetMois, origineCle: o.origineCle }), 502);
  }
}
