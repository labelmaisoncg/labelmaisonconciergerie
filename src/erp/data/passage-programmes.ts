/**
 * Passage serveur des messages automatiques et des avis à déposer, lancé par
 * le passage planifié de l'agent (api/erp-agent.ts, toutes les 30 minutes),
 * dans chaque espace à son tour.
 *
 * Messages automatiques (règles : messages-programmes.ts) :
 * - rien tant qu'aucun moment n'est allumé par un gérant ;
 * - chaque message passe par envoyerMessage (messagerie-envoi.ts), le seul
 *   chemin d'envoi aux voyageurs, avec une clé d'idempotence par séjour et
 *   par moment ;
 * - « jamais deux fois » : une ligne envoisProgrammes est écrite « en cours »
 *   AVANT l'envoi (si l'écriture échoue, rien ne part) ; un passage coupé en
 *   plein envoi reprend la même ligne, le même texte et la même clé (la
 *   plateforme rejoue sa réponse au lieu d'envoyer de nouveau), au plus 23 h ;
 *   au-delà, la ligne passe « à vérifier » et rien n'est renvoyé ;
 * - chaque envoi et chaque refus est écrit (historique visible dans l'écran).
 *
 * Avis à déposer : pour chaque séjour Airbnb terminé, un texte préparé par
 * l'IA de l'agent (même clé, même modèle, même plafond mensuel pour un autre
 * espace que Label Maison, compté dans agent/etat), ou un texte simple sans
 * IA. Rien n'est publié : l'équipe copie le texte sur Airbnb.
 *
 * Réseau injecté (client IA, fetch) : verifier-messages-programmes.ts
 * simule la plateforme, la base et l'IA en mémoire.
 *
 * Imports relatifs avec « .js » : ce fichier tourne sous Node (ESM).
 */
import { COLLECTION_AGENT, ID_ETAT_AGENT, MODELE_AGENT_DEFAUT, texteErreurIA, type ClientIA, type EtatAgent } from './agent-messagerie.js';
import { ErreurEnvoi, envoyerMessage, messageEchecEnvoi } from './messagerie-envoi.js';
import { BUDGET_ERP_DEFAUT, BudgetEpuise, DelaiEcoule, ErreurRepull, QUOTA_MOIS_DEFAUT, lireEtat } from './repull-synchro.js';
import type { ContexteConnexion } from './repull-connexion.js';
import { horodatageParis } from './repull.js';
import { lienGuide, type SignerFichier } from './guides.js';
import {
  COLLECTION_AVIS_A_DEPOSER,
  COLLECTION_ENVOIS_PROGRAMMES,
  COLLECTION_ETAT_PROGRAMMES,
  ID_ETAT_PROGRAMMES,
  ID_REGLAGES_PROGRAMMES,
  PAR_MESSAGE_AUTO,
  RAISONS,
  SCHEMA_AVIS,
  avisAPreparer,
  cleEnvoiProgramme,
  codesAutorises,
  consignesAvis,
  contexteAvis,
  dateParisDe,
  guidePourMessage,
  idEnvoi,
  lireAvisIA,
  majReservationsVues,
  planifierEnvois,
  prenomDe,
  raisonsARelire,
  reglagesProgrammes,
  rendreMessage,
  sejourAvecAvis,
  signatureProgrammes,
  texteAvisParDefaut,
  unMomentAllume,
  type DecisionPlanifiee,
  type ReservationsVues,
} from './messages-programmes.js';
import type { FilMessages, Incident, Journal, Logement, Reglage, Reservation } from './types';
import type { ControleQualite } from './types-operations';
import type { AvisADeposer, EnvoiProgramme } from './types-programmes';

/** Messages envoyés au plus par passage. */
export const MAX_ENVOIS_PAR_PASSAGE = 10;
/** Avis rédigés par l'IA au plus par passage (les suivants au passage d'après). */
export const MAX_AVIS_IA_PAR_PASSAGE = 3;
/** Temps à garder pour un envoi (lecture, plateforme, écritures). */
const TEMPS_PAR_ENVOI_MS = 5_000;
/** Temps à garder pour une rédaction par l'IA. */
const TEMPS_PAR_AVIS_IA_MS = 15_000;
const VERROU_MS = 70_000;

export interface OptionsProgrammes extends ContexteConnexion {
  /** Client Claude de l'agent ; absent : avis en texte simple. */
  ia?: ClientIA | null;
  modele?: string;
  /** Nom de l'espace (signature, consignes) ; absent : Label Maison. */
  nomEspace?: string;
  /** Décisions de l'IA permises par mois pour cet espace (partagées avec l'agent) ; absent : sans plafond. */
  plafondIAMois?: number;
  signerFichier?: SignerFichier;
  maxEnvois?: number;
  maxAvisIA?: number;
}

export type StatutProgrammes = 'fait' | 'occupe' | 'budget' | 'erreur';

export interface BilanProgrammes {
  debut: string;
  fin?: string;
  statut: StatutProgrammes;
  envoyes: number;
  /** Notés « pas envoyé » (annulée, hors plateforme, moment passé…). */
  ignores: number;
  /** Pas encore (heure, voyageur qui attend une réponse, conversation à venir) ou laissés pour le passage suivant. */
  reportes: number;
  aVerifier: number;
  echecs: number;
  /** Réservations arrivées d'un coup (importation) : pas de confirmation. */
  importation?: number;
  avisPrepares: number;
  avisARelire: number;
  appelsIA: number;
  erreurs: string[];
}

export interface EtatProgrammes {
  id: typeof ID_ETAT_PROGRAMMES;
  verrou?: { jusqua: number; id: string };
  vues?: ReservationsVues;
  dernier?: BilanProgrammes;
}

class Passage {
  readonly bilan: BilanProgrammes;
  private readonly maintenant: () => Date;
  private readonly compteur = { appels: 0 };
  private repullEpuise = false;
  private arretEnvois = false;

  constructor(private readonly o: OptionsProgrammes) {
    this.maintenant = o.maintenant ?? (() => new Date());
    this.bilan = { debut: horodatageParis(this.maintenant()), statut: 'fait', envoyes: 0, ignores: 0, reportes: 0, aVerifier: 0, echecs: 0, avisPrepares: 0, avisARelire: 0, appelsIA: 0, erreurs: [] };
  }

  private get ctx(): ContexteConnexion {
    return { ...this.o, compteur: this.compteur };
  }

  private le = () => horodatageParis(this.maintenant());

  private async ecrireEnvoi(e: EnvoiProgramme): Promise<void> {
    await this.o.base.ecrire(COLLECTION_ENVOIS_PROGRAMMES, [e], PAR_MESSAGE_AUTO);
  }

  /* ------------------------------------------------- messages automatiques */

  async messages(d: { reservations: Reservation[]; fils: FilMessages[]; logements: Map<string, Logement>; envois: EnvoiProgramme[]; reglagesLus: Reglage[] }, vuesAvant: ReservationsVues | undefined): Promise<ReservationsVues> {
    const reglages = reglagesProgrammes({ reglages: d.reglagesLus });
    const maintenant = this.maintenant();
    const vues = majReservationsVues(vuesAvant, d.reservations, reglages.modeles.confirmation, maintenant);
    if (vues.importation) {
      this.bilan.importation = vues.importation;
      await this.journal(`${vues.importation} réservations arrivées d’un coup (connexion d’une plateforme) : pas de message de confirmation pour elles.`);
    }
    if (!unMomentAllume(reglages) && !d.envois.some((x) => x.statut === 'en_cours')) return vues.vues;

    const plan = planifierEnvois({ reservations: d.reservations, fils: d.fils, reglages, envois: d.envois, vues: vues.vues, maintenant });
    if (plan.some((p) => p.decision.genre === 'envoyer' || p.decision.genre === 'reprendre')) {
      const etat = await lireEtat(this.o.base, maintenant, this.o.budgetMois ?? BUDGET_ERP_DEFAUT, this.o.quotaMois ?? QUOTA_MOIS_DEFAUT);
      if (etat.budgetMois - etat.appelsMois <= 0) this.repullEpuise = true;
    }
    const signature = signatureProgrammes({ reglages: d.reglagesLus }, this.o.nomEspace);
    const max = this.o.maxEnvois ?? MAX_ENVOIS_PAR_PASSAGE;
    for (const p of plan) {
      const x = p.decision;
      const base = this.ligne(p);
      try {
        if (x.genre === 'attendre') this.bilan.reportes++;
        else if (x.genre === 'ignorer') {
          await this.ecrireEnvoi({ ...base, statut: 'ignore', raison: x.raison });
          this.bilan.ignores++;
        } else if (x.genre === 'verifier') {
          await this.ecrireEnvoi({ ...x.envoi, statut: 'a_verifier', raison: x.raison, le: this.le() });
          this.bilan.aVerifier++;
        } else if (x.genre === 'envoyer' || x.genre === 'reprendre') {
          if (this.repullEpuise || this.arretEnvois || this.bilan.envoyes >= max || this.o.echeance - Date.now() < TEMPS_PAR_ENVOI_MS) {
            this.bilan.reportes++;
            continue;
          }
          if (x.genre === 'envoyer') await this.envoyer(p, x.fil, x.modele, signature, d.logements.get(p.reservation.logementId));
          else {
            const fil = x.fil ?? d.fils.find((f) => f.id === x.envoi.filId);
            if (!fil || !x.envoi.texte || !x.envoi.cle) {
              await this.ecrireEnvoi({ ...x.envoi, statut: 'a_verifier', raison: RAISONS.pasConfirme, le: this.le() });
              this.bilan.aVerifier++;
            } else await this.partir(x.envoi, fil);
          }
        }
      } catch (e) {
        // Écriture refusée par la base : rien n'est parti pour cette ligne (marque posée avant l'envoi).
        this.bilan.erreurs.push(`${prenomDe(p.reservation.voyageur?.nom) || 'Voyageur'} : ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (this.repullEpuise) this.bilan.statut = 'budget';
    return vues.vues;
  }

  private ligne(p: DecisionPlanifiee): EnvoiProgramme {
    const r = p.reservation;
    return {
      id: idEnvoi(r.id, p.declencheur),
      reservationId: r.id,
      logementId: r.logementId,
      declencheur: p.declencheur,
      voyageur: prenomDe(r.voyageur?.nom) || 'Voyageur',
      statut: 'reporte',
      le: this.le(),
    };
  }

  /** Premier envoi : texte rendu, ligne « en cours » écrite, puis envoi. */
  private async envoyer(p: DecisionPlanifiee, fil: FilMessages, modele: string, signature: string, logement: Logement | undefined) {
    const r = p.reservation;
    const aujourdhui = dateParisDe(this.maintenant());
    let lien: string | undefined;
    if (modele.includes('{lien_guide}')) {
      const g = guidePourMessage(logement?.fiche?.guides, codesAutorises(r, fil.logementId, aujourdhui));
      if (g) lien = (await lienGuide(g, this.o.signerFichier)) ?? undefined;
    }
    const rendu = rendreMessage(modele, { reservation: r, logement, fil, signature, lienGuide: lien, aujourdhui });
    const base = { ...this.ligne(p), filId: fil.id };
    if (!rendu.texte) {
      await this.ecrireEnvoi({ ...base, statut: 'ignore', raison: RAISONS.vide });
      this.bilan.ignores++;
      return;
    }
    const enCours: EnvoiProgramme = { ...base, statut: 'en_cours', texte: rendu.texte, cle: cleEnvoiProgramme(r.id, p.declencheur), depuis: this.le() };
    // Marque AVANT l'envoi : si elle ne s'écrit pas, rien ne part (l'erreur remonte).
    await this.ecrireEnvoi(enCours);
    await this.partir(enCours, fil);
  }

  /** Envoi (ou reprise) par le seul chemin d'envoi aux voyageurs, puis la ligne suit. */
  private async partir(e: EnvoiProgramme, fil: FilMessages) {
    const avant = { statut: fil.statut, traitePar: fil.traitePar };
    // Une fois l'envoi tranché, le texte (qui peut contenir un code d'accès) ne sert plus : il reste dans la conversation seulement.
    const noter = (patch: Partial<EnvoiProgramme>) =>
      this.ecrireEnvoi({ ...e, ...patch, ...(patch.statut && patch.statut !== 'en_cours' ? { texte: undefined } : {}), le: this.le() }).catch(() => undefined);
    try {
      const res = await envoyerMessage(this.ctx, {
        filId: e.filId ?? fil.id,
        texte: e.texte!,
        auteur: 'hote',
        par: PAR_MESSAGE_AUTO,
        cleIdempotence: e.cle,
        // Un message automatique ne change pas qui s'occupe de la conversation (l'agent garde la main).
        completer: (f) => ({ ...f, statut: avant.statut, traitePar: avant.traitePar }),
      });
      await noter({ statut: 'envoye', envoyeLe: res.message.envoyeLe, canal: res.canal, raison: undefined });
      this.bilan.envoyes++;
    } catch (err) {
      if (err instanceof ErreurEnvoi) {
        if (err.code === 'deja_envoye') {
          await noter({ statut: 'envoye', envoyeLe: e.depuis, raison: 'Déjà parti : rien n’a été renvoyé.' });
          this.bilan.envoyes++;
        } else if (err.code === 'en_cours') this.bilan.reportes++;
        else if (err.code === 'hors_plateforme') {
          await noter({ statut: 'ignore', raison: RAISONS.horsPlateforme });
          this.bilan.ignores++;
        } else if (err.code === 'introuvable') {
          await noter({ statut: 'ignore', raison: 'Conversation introuvable.' });
          this.bilan.ignores++;
        } else {
          await noter({ statut: 'echec', raison: err.message });
          this.bilan.echecs++;
        }
        return;
      }
      if (err instanceof BudgetEpuise) {
        // Rien n'est parti : à réessayer quand la part du mois le permettra.
        await noter({ statut: 'reporte', raison: 'Part d’appels du mois épuisée.' });
        this.repullEpuise = true;
        this.bilan.reportes++;
        return;
      }
      if (err instanceof DelaiEcoule) {
        // Ligne laissée « en cours » : reprise au passage suivant avec la même clé.
        this.arretEnvois = true;
        this.bilan.reportes++;
        return;
      }
      if (err instanceof ErreurRepull && err.statut >= 400 && err.statut < 500 && err.statut !== 408 && err.statut !== 409 && err.statut !== 429) {
        // Refus net de la plateforme : rien n'est parti, on ne réessaie pas.
        await noter({ statut: 'echec', raison: messageEchecEnvoi(err) });
        this.bilan.echecs++;
        return;
      }
      // Réseau, 5xx, 429 : peut-être parti ; ligne laissée « en cours », reprise avec la même clé.
      this.bilan.erreurs.push(messageEchecEnvoi(err));
      this.bilan.reportes++;
    }
  }

  /* ----------------------------------------------------- avis à déposer */

  async avis(d: {
    reservations: Reservation[];
    fils: () => Promise<FilMessages[]>;
    logements: Map<string, Logement>;
    avis: AvisADeposer[];
    incidents: Incident[];
    controles: ControleQualite[];
  }): Promise<void> {
    const maintenant = this.maintenant();
    const aujourdhui = dateParisDe(maintenant);
    const aPreparer = avisAPreparer({ reservations: d.reservations, avisADeposer: d.avis }, aujourdhui);
    const prets = d.avis.filter((a) => a.statut === 'pret');
    if (!aPreparer.length && !prets.length) return;
    const fils = await d.fils();
    const signaux = { incidents: d.incidents, controles: d.controles, filsMessages: fils };
    const parId = new Map(d.reservations.map((r) => [r.id, r]));

    // Un avis prêt dont le séjour a depuis un souci (incident, note basse…) repasse « à relire ».
    for (const a of prets) {
      const r = parId.get(a.reservationId);
      if (!r || !sejourAvecAvis(r, aujourdhui)) continue;
      const raisons = raisonsARelire(r, signaux);
      if (raisons.length) {
        if (await this.ecrireAvis({ ...a, statut: 'a_relire', raisons: [...new Set([...(a.raisons ?? []), ...raisons])] }, ['pret'])) this.bilan.avisARelire++;
      }
    }
    if (!aPreparer.length) return;

    const iaPermise = await this.iaPermise();
    const maxIA = this.o.maxAvisIA ?? MAX_AVIS_IA_PAR_PASSAGE;
    let iaEnPanne = false;
    for (const r of aPreparer) {
      const raisons = raisonsARelire(r, signaux);
      const prenom = prenomDe(r.voyageur?.nom);
      let texte = '';
      let source: AvisADeposer['source'] = 'modele';
      const ia = this.o.ia && !iaEnPanne && iaPermise.ok(this.bilan.appelsIA);
      if (ia) {
        // Pas le temps, ou assez d'appels pour ce passage : l'IA s'en chargera au suivant.
        if (this.bilan.appelsIA >= maxIA || this.o.echeance - Date.now() < TEMPS_PAR_AVIS_IA_MS) break;
        try {
          this.bilan.appelsIA++;
          // Borné au temps qui reste (le client commun attend jusqu'à 25 s, deux fois) : jamais au-delà du passage.
          const creer = this.o.ia!.messages.create as (p: Parameters<ClientIA['messages']['create']>[0], o?: { timeout?: number; maxRetries?: number }) => ReturnType<ClientIA['messages']['create']>;
          const m = await creer.call(
            this.o.ia!.messages,
            {
              model: this.o.modele ?? MODELE_AGENT_DEFAUT,
              max_tokens: 600,
              // Label Maison sans nom d'espace ; un autre espace, jamais sous le nom de Label Maison.
              system: consignesAvis(this.o.nomEspace === undefined ? 'Label Maison' : this.o.nomEspace.trim() || 'la conciergerie'),
              messages: [{ role: 'user', content: contexteAvis(r, d.logements.get(r.logementId), fils, raisons) }],
              output_config: { format: { type: 'json_schema', schema: SCHEMA_AVIS as unknown as Record<string, unknown> } },
            },
            { timeout: Math.max(5_000, Math.min(20_000, this.o.echeance - Date.now() - 3_000)), maxRetries: 0 },
          );
          const lu = lireAvisIA(m);
          if (lu) {
            texte = lu.texte;
            source = 'ia';
            if (lu.aRelire) raisons.push(lu.raison || 'L’IA signale un point à vérifier');
          }
        } catch (e) {
          // Clé refusée, service indisponible : texte simple pour ce séjour, plus d'IA pour ce passage.
          iaEnPanne = true;
          this.bilan.erreurs.push(`Avis de ${prenom || 'voyageur'} : ${texteErreurIA(e)}`);
        }
      }
      const finales = [...new Set(raisons)];
      const ligne: AvisADeposer = {
        id: r.id,
        reservationId: r.id,
        logementId: r.logementId,
        voyageur: prenom || 'Voyageur',
        depart: r.depart,
        canal: r.canal,
        statut: finales.length ? 'a_relire' : 'pret',
        texte: texte || texteAvisParDefaut(prenom),
        source,
        ...(finales.length ? { raisons: finales } : {}),
        creeLe: this.le(),
        redigeLe: this.le(),
      };
      if (await this.ecrireAvis(ligne, ['a_rediger'])) {
        this.bilan.avisPrepares++;
        if (finales.length) this.bilan.avisARelire++;
      }
    }
    if (this.bilan.appelsIA) await this.compterIA(this.bilan.appelsIA);
  }

  /**
   * Écrit un avis sans jamais écraser une décision de l'équipe : ligne
   * absente, ou encore dans un des statuts attendus (écriture conditionnelle).
   */
  private async ecrireAvis(a: AvisADeposer, attendus: AvisADeposer['statut'][]): Promise<boolean> {
    const [lu] = await this.o.base.lireVersions<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, [a.id]);
    if (!lu) {
      await this.o.base.ecrire(COLLECTION_AVIS_A_DEPOSER, [a], PAR_MESSAGE_AUTO);
      return true;
    }
    if (!attendus.includes(lu.element.statut)) return false;
    const suivant: AvisADeposer = { ...lu.element, ...a, creeLe: lu.element.creeLe ?? a.creeLe };
    return this.o.base.remplacerSi(COLLECTION_AVIS_A_DEPOSER, suivant, lu.version, PAR_MESSAGE_AUTO);
  }

  /** Plafond mensuel de l'IA de l'espace (le même que l'agent, compté dans agent/etat). */
  private async iaPermise(): Promise<{ ok: (faitsCePassage: number) => boolean }> {
    const plafond = this.o.plafondIAMois;
    if (plafond === undefined) return { ok: () => true };
    const mois = horodatageParis(this.maintenant()).slice(0, 7);
    const [etat] = await this.o.base.lire<EtatAgent>(COLLECTION_AGENT, [ID_ETAT_AGENT]).catch(() => [] as EtatAgent[]);
    const deja = etat?.iaMois?.mois === mois ? etat.iaMois.appels : 0;
    return { ok: (n) => deja + n < plafond };
  }

  /** Ajoute les appels de l'IA au compteur du mois de l'agent (écriture conditionnelle, un nouvel essai). */
  private async compterIA(n: number): Promise<void> {
    const mois = horodatageParis(this.maintenant()).slice(0, 7);
    for (let essai = 0; essai < 2; essai++) {
      const [lu] = await this.o.base.lireVersions<EtatAgent>(COLLECTION_AGENT, [ID_ETAT_AGENT]).catch(() => []);
      const etat: EtatAgent = { ...(lu?.element ?? {}), id: ID_ETAT_AGENT };
      const suivant: EtatAgent = { ...etat, iaMois: { mois, appels: (etat.iaMois?.mois === mois ? etat.iaMois.appels : 0) + n } };
      if (!lu) {
        await this.o.base.ecrire(COLLECTION_AGENT, [suivant]).catch(() => undefined);
        return;
      }
      if (await this.o.base.remplacerSi(COLLECTION_AGENT, suivant, lu.version).catch(() => false)) return;
    }
  }

  private async journal(details: string) {
    const l: Journal = {
      id: `auto-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      horodatage: this.le(),
      auteur: PAR_MESSAGE_AUTO,
      action: 'Messages automatiques',
      entite: COLLECTION_ENVOIS_PROGRAMMES,
      entiteId: 'importation',
      details,
    };
    await this.o.base.ecrire('journal', [l]).catch(() => undefined);
  }

  finir(statut?: StatutProgrammes): BilanProgrammes {
    if (statut) this.bilan.statut = statut;
    else if (this.bilan.erreurs.length && !this.bilan.envoyes && !this.bilan.avisPrepares && this.bilan.statut === 'fait') this.bilan.statut = 'erreur';
    this.bilan.fin = horodatageParis(this.maintenant());
    return this.bilan;
  }
}

/**
 * Un passage dans l'espace de `o.base` : messages automatiques dus, puis
 * avis à préparer. Un seul passage à la fois (verrou dans programmes/etat).
 */
export async function lancerProgrammes(o: OptionsProgrammes): Promise<BilanProgrammes> {
  const maintenant = o.maintenant ?? (() => new Date());
  const p = new Passage(o);
  const idPassage = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const [lu] = await o.base.lire<EtatProgrammes>(COLLECTION_ETAT_PROGRAMMES, [ID_ETAT_PROGRAMMES]);
  const etat: EtatProgrammes = { ...(lu ?? {}), id: ID_ETAT_PROGRAMMES };
  if (etat.verrou && etat.verrou.jusqua > maintenant().getTime()) return p.finir('occupe');
  const verrouille: EtatProgrammes = { ...etat, verrou: { jusqua: maintenant().getTime() + VERROU_MS, id: idPassage } };
  await o.base.ecrire(COLLECTION_ETAT_PROGRAMMES, [verrouille]);

  let vues = etat.vues;
  try {
    const reglagesLus = await o.base.lire<Reglage>('reglages', ['agent', ID_REGLAGES_PROGRAMMES]);
    const [reservations, envois, avis] = await Promise.all([
      o.base.lire<Reservation>('reservations'),
      o.base.lire<EnvoiProgramme>(COLLECTION_ENVOIS_PROGRAMMES),
      o.base.lire<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER),
    ]);
    const reglages = reglagesProgrammes({ reglages: reglagesLus });
    // Rien d'allumé, aucun envoi en cours, aucune liste à vider : pas même une lecture des conversations.
    const messagesUtiles = unMomentAllume(reglages) || envois.some((x) => x.statut === 'en_cours') || Object.keys(etat.vues?.vues ?? {}).length > 0;
    let fils: FilMessages[] | null = null;
    const lireFils = async () => (fils ??= await o.base.lire<FilMessages>('filsMessages'));
    const logements = new Map((await o.base.lire<Logement>('logements')).map((l) => [l.id, l]));

    if (messagesUtiles) {
      vues = await p.messages({ reservations, fils: await lireFils(), logements, envois, reglagesLus }, etat.vues);
    }
    const aujourdhui = dateParisDe(maintenant());
    if (reservations.some((r) => sejourAvecAvis(r, aujourdhui))) {
      const [incidents, controles] = await Promise.all([o.base.lire<Incident>('incidents'), o.base.lire<ControleQualite>('controles')]);
      await p.avis({ reservations, fils: lireFils, logements, avis, incidents, controles });
    }
  } catch (e) {
    p.bilan.erreurs.push(e instanceof Error ? e.message : String(e));
    p.finir('erreur');
  }

  const bilan = p.bilan.fin ? p.bilan : p.finir();
  const frais = await o.base.lire<EtatProgrammes>(COLLECTION_ETAT_PROGRAMMES, [ID_ETAT_PROGRAMMES]).catch(() => [] as EtatProgrammes[]);
  const suivant: EtatProgrammes = { ...(frais[0] ?? etat), id: ID_ETAT_PROGRAMMES, dernier: bilan, ...(vues ? { vues } : {}) };
  if (!suivant.verrou || suivant.verrou.id === idPassage) delete suivant.verrou;
  await o.base.ecrire(COLLECTION_ETAT_PROGRAMMES, [suivant]).catch(() => undefined);
  if (bilan.envoyes || bilan.echecs || bilan.avisPrepares || bilan.erreurs.length) {
    console.log('[programmes]', bilan.statut, JSON.stringify({ envoyes: bilan.envoyes, ignores: bilan.ignores, echecs: bilan.echecs, avis: bilan.avisPrepares, erreurs: bilan.erreurs.length }));
  }
  return bilan;
}
