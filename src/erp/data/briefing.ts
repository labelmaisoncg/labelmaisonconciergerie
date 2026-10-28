/**
 * Briefing du matin (A12) : la journée en quelques phrases claires,
 * calculées SANS IA sur les vraies données. Le même texte sert :
 * - au bloc « Votre journée » en haut de l'Accueil (tableau-de-bord), qui
 *   en reprend chaque sujet sur une ligne ;
 * - à « Copier le briefing » ;
 * - à la notification « Briefing du matin » (type `rappel`, inchangé pour
 *   garder les préférences des appareils), envoyée par le passage planifié
 *   à partir de 7 h à Paris, une fois par jour et par espace
 *   (briefing-passage.ts).
 *
 * Chaque sujet reprend LA définition déjà utilisée ailleurs : voyageurs qui
 * attendent l'équipe (attendEquipe), avis à déposer (avisADeposerEquipe :
 * ceux qui ne partent pas seuls), avis à valider avant publication (gérant,
 * avisAValider), notes
 * sous 4,5 des 14 derniers jours, contacts du jour (aTraiterLe, triés par
 * l'assistant CRM), incidents (incidentsATraiter), anomalies
 * (detecterAnomalies), contrôle des réponses de l'agent en panne, fiches
 * incomplètes pour l'agent (completudeFiche), prix conseillés
 * (conseillerPrix), factures mensuelles en brouillon, logements signalés
 * « pas à moi ». Prix, factures et « pas à moi » : gérant seulement, comme
 * dans « À faire » (chaque ligne de « À faire » a sa phrase ici).
 *
 * Module pur, sans date système (jour et instant passés en entrée) ;
 * imports en « .js » : il tourne aussi côté serveur.
 */
import { detecterAnomalies, type TypeAnomalie } from './anomalies.js';
import { attendEquipe } from './attente-equipe.js';
import { SEUIL_NOTE_CONTROLE } from './constantes.js';
import { ID_ALERTE_CONTROLE, type AlerteControleAgent } from './controle-reponse.js';
import { fileDuJour } from './crm-assistant.js';
import { estFactureMensuelle, factureFigee } from './factures-mensuelles.js';
import { completudeFiche } from './fiche-agent.js';
import { incidentsATraiter, lienIncident } from './incidents-erp.js';
import { avisADeposerEquipe, avisAValider } from './avis-auto.js';
import type { GroupeNotification, VarianteNotification } from './notifications.js';
import { sansChargeLe } from './operations.js';
import { conseillerPrix, lireElementsPrix } from './prix-conseils.js';
import type { DateISO, ErpDonnees, Facture, Horodatage, Id, Reservation } from './types';

/** Ce que le briefing lit (le store de l'ERP, ou les collections lues par le serveur). */
export type EntreesBriefing = Pick<ErpDonnees, 'logements' | 'reservations' | 'filsMessages' | 'crm' | 'incidents'> &
  Partial<
    Pick<ErpDonnees, 'avisADeposer' | 'reponsesAvis' | 'controles' | 'equipe' | 'affectations' | 'absences' | 'conseilsPrix' | 'factures' | 'proprietaires' | 'reglages' | 'signalementsLogement'>
  > & {
    aujourdhui: DateISO;
    /** Instant du calcul (fraîcheur des prix lus, anomalies). */
    maintenant: Horodatage;
    /** Prix conseillés et factures : le gérant seulement. */
    gerant: boolean;
    /** Dernière mise à jour réussie des plateformes (absente : non vérifiée). */
    derniereSynchro?: Horodatage;
    /** La dernière mise à jour des plateformes a échoué (le navigateur le lit au journal). */
    synchroEnEchec?: boolean;
  };

export type CleSujet =
  | 'journee' | 'urgences' | 'messages' | 'incidents' | 'avis_deposer' | 'avis_valider' | 'notes' | 'crm' | 'alertes'
  | 'controle_agent' | 'fiches_agent' | 'prix' | 'factures' | 'signalements';

export interface SujetBriefing {
  cle: CleSujet;
  /** Nombre d'éléments (journée : arrivées + départs + logements occupés). */
  n: number;
  /** Phrase complète, avec les noms utiles (écran, texte copié). */
  phrase: string;
  /** Forme courte, sans aucun nom (notification sur un écran verrouillé). */
  court: string;
  /** Écran à ouvrir (sous /erp). */
  lien: string;
  /** Réservé au gérant (prix, factures). */
  gerant?: boolean;
}

export interface Briefing {
  date: DateISO;
  /** La journée d'abord, puis ce qui attend, puis les alertes. */
  sujets: SujetBriefing[];
  /** Le briefing en un paragraphe. */
  texte: string;
  /** Corps de la notification (240 caractères au plus, sans nom). */
  court: string;
  /** Rien à dire : ni arrivée, ni départ, ni logement occupé, rien en attente. */
  rien: boolean;
}

/** Titre de la notification (et nom du type dans les réglages). */
export const TITRE_BRIEFING = 'Briefing du matin';
/** Corps de notification borné (l'écran verrouillé en montre environ 4 lignes ; la notification ouverte, tout). */
const MAX_COURT = 240;
/** Noms cités au plus dans une phrase. */
const MAX_NOMS = 3;

/* ------------------------------------------------------------- outils */

const JOUR_MS = 86_400_000;
const enMs = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const plusJours = (d: DateISO, n: number): DateISO => new Date(enMs(d) + n * JOUR_MS).toISOString().slice(0, 10);
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « 2 arrivées », « 1 départ » (le nombre en chiffres, accord du nom). */
export const nb = (n: number, singulier: string, pluriel = `${singulier}s`) => `${n} ${n > 1 ? pluriel : singulier}`;

/**
 * « A, B et C », « A, B, C et 2 autres » : chaque élément compte. Un nom
 * qui revient est cité une fois avec son nombre (« Paris 14 Alésia (2) »),
 * et « et N autres » compte les éléments non cités : le total est toujours
 * celui du sujet. Une liste qui peut avoir des doublons vient après « : »
 * dans la phrase, jamais entre parenthèses (pas de « (Daniel (2), …) »).
 */
export function liste(noms: readonly string[], max = MAX_NOMS): string {
  const comptes = new Map<string, number>();
  for (const n of noms) if (n) comptes.set(n, (comptes.get(n) ?? 0) + 1);
  const total = [...comptes.values()].reduce((a, b) => a + b, 0);
  const cites = [...comptes].slice(0, max);
  const reste = total - cites.reduce((a, [, k]) => a + k, 0);
  const morceaux = cites.map(([n, k]) => (k > 1 ? `${n} (${k})` : n));
  if (reste > 0) morceaux.push(`${reste} autre${reste > 1 ? 's' : ''}`);
  if (morceaux.length <= 1) return morceaux[0] ?? '';
  return `${morceaux.slice(0, -1).join(', ')} et ${morceaux[morceaux.length - 1]}`;
}

/** Une liste de morceaux en une phrase : « a, b et c ». */
const enPhrase = (morceaux: readonly string[]) => liste(morceaux, morceaux.length);
const majuscule = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const prenom = (nom: string | undefined) => (nom ?? '').trim().split(/\s+/)[0]?.replace(/[.,;:]+$/, '') ?? '';
const note = (n: number) => String(n).replace('.', ',');

/** Factures mensuelles encore en brouillon (à relire et valider par le gérant), la plus ancienne d'abord. */
export function facturesAValider(d: Partial<Pick<ErpDonnees, 'factures'>>): Facture[] {
  return (d.factures ?? [])
    .filter((f) => estFactureMensuelle(f) && f.statut === 'brouillon' && !factureFigee(f))
    .sort((a, b) => String(a.mensuelle?.mois).localeCompare(String(b.mensuelle?.mois)) || a.id.localeCompare(b.id));
}

/** « août 2026 » d'un mois « 2026-08 ». */
export const moisLong = (mois: string) => `${MOIS_LONGS[Number(mois.slice(5, 7)) - 1] ?? ''} ${mois.slice(0, 4)}`.trim();

/* -------------------------------------------- anomalies, comme « À faire » */

/** Anomalies que seul le gérant voit (comme la ligne de « À faire » : aTraiterAnalyse.ts). */
const ANOMALIES_GERANT: readonly TypeAnomalie[] = ['sans_charge', 'prix_anormal', 'integrite'];

const MOTS_ANOMALIE: Record<TypeAnomalie, (n: number) => string> = {
  chevauchement: (n) => nb(n, 'risque de double réservation', 'risques de double réservation'),
  sans_charge: (n) => nb(n, 'départ sans personne en charge', 'départs sans personne en charge'),
  reservation_suspecte: (n) => nb(n, 'réservation à vérifier', 'réservations à vérifier'),
  prix_anormal: (n) => nb(n, 'logement à un prix inhabituel', 'logements à un prix inhabituel'),
  synchro_ancienne: () => 'Airbnb et Booking pas mis à jour',
  integrite: () => 'l’occupation à vérifier',
};

/* ------------------------------------------------------------- calcul */

/** Les arrivées, départs et logements occupés ce soir (annulées exclues ; mêmes règles que l'Accueil). */
export function journeeDe(reservations: readonly Reservation[], aujourdhui: DateISO) {
  const actives = reservations.filter((r) => r && r.statut !== 'annulee');
  return {
    arrivees: actives.filter((r) => r.arrivee === aujourdhui),
    departs: actives.filter((r) => r.depart === aujourdhui),
    // Occupés ce soir : au moins la nuit d'aujourd'hui (arrivées du jour comprises).
    occupes: actives.filter((r) => r.arrivee <= aujourdhui && r.depart > aujourdhui),
  };
}

/**
 * Le briefing du jour pour un rôle. Déterministe : mêmes données, même
 * texte. Aucun chiffre qui ne vienne d'un compte des données.
 */
export function construireBriefing(e: EntreesBriefing): Briefing {
  const j = e.aujourdhui;
  const nomLogement = (id?: Id) => e.logements.find((l) => l.id === id)?.nom ?? 'un logement';
  const sujets: SujetBriefing[] = [];

  /* la journée */
  const { arrivees, departs, occupes } = journeeDe(e.reservations, j);
  const mouvements = [arrivees.length ? nb(arrivees.length, 'arrivée') : '', departs.length ? nb(departs.length, 'départ') : ''].filter(Boolean);
  const occupesTexte = occupes.length ? `${nb(occupes.length, 'logement occupé', 'logements occupés')} ce soir` : 'aucun logement occupé ce soir';
  const court = mouvements.length ? `${enPhrase([...mouvements, occupesTexte])}` : `ni arrivée ni départ, ${occupesTexte}`;
  const detailArrivees = arrivees.length ? `${nb(arrivees.length, 'arrivée')} (${liste(arrivees.map((r) => `${prenom(r.voyageur?.nom) || 'un voyageur'} à ${nomLogement(r.logementId)}`))})` : '';
  const detailDeparts = departs.length ? `${nb(departs.length, 'départ')} (${liste(departs.map((r) => nomLogement(r.logementId)))})` : '';
  const longue = mouvements.length ? enPhrase([detailArrivees, detailDeparts, occupesTexte].filter(Boolean)) : court;
  sujets.push({
    cle: 'journee',
    n: arrivees.length + departs.length + occupes.length,
    phrase: `Aujourd’hui : ${longue}.`,
    court: `${majuscule(court)}.`,
    lien: '/erp/reservations',
  });

  /* urgences et incidents */
  const { urgences, autres } = incidentsATraiter({ incidents: e.incidents ?? [] });
  if (urgences.length)
    sujets.push({
      cle: 'urgences',
      n: urgences.length,
      phrase: `${urgences.length > 1 ? `${urgences.length} urgences signalées` : 'Une urgence signalée'} : ${liste(urgences.map((i) => nomLogement(i.logementId)))}.`,
      court: nb(urgences.length, 'urgence'),
      lien: lienIncident(urgences[0]),
    });

  /* voyageurs qui attendent l'équipe */
  const attente = (e.filsMessages ?? []).filter((f) => f && attendEquipe(f));
  if (attente.length) {
    const confies = attente.filter((f) => f.statut === 'escalade').length;
    const base = attente.length > 1 ? `${attente.length} voyageurs attendent votre réponse` : 'Un voyageur attend votre réponse';
    sujets.push({
      cle: 'messages',
      n: attente.length,
      phrase: `${base}${confies ? (attente.length > 1 ? `, dont ${confies} confié${confies > 1 ? 's' : ''} par votre agent` : ', confié par votre agent') : ''}.`,
      court: attente.length > 1 ? `${attente.length} voyageurs attendent votre réponse` : '1 voyageur attend votre réponse',
      lien: '/erp/messagerie',
    });
  }

  if (autres.length)
    sujets.push({
      cle: 'incidents',
      n: autres.length,
      phrase: `${autres.length > 1 ? `${autres.length} incidents ouverts` : 'Un incident ouvert'} : ${liste(autres.map((i) => nomLogement(i.logementId)))}.`,
      court: nb(autres.length, 'incident ouvert', 'incidents ouverts'),
      lien: lienIncident(autres[0]),
    });

  /* avis à déposer (ceux qui ne partent pas seuls), avis à valider (gérant), notes à lire */
  const aDeposer = avisADeposerEquipe(
    { reservations: e.reservations, avisADeposer: e.avisADeposer ?? [], incidents: e.incidents ?? [], controles: e.controles ?? [], filsMessages: e.filsMessages ?? [], reglages: e.reglages ?? [] },
    j,
  );
  if (aDeposer.length)
    sujets.push({
      cle: 'avis_deposer',
      n: aDeposer.length,
      phrase: `${aDeposer.length > 1 ? `${aDeposer.length} avis à déposer` : 'Un avis à déposer'} sur Airbnb : ${liste(aDeposer.map((a) => prenom(a.reservation.voyageur?.nom) || 'un voyageur'))}.`,
      court: nb(aDeposer.length, 'avis à déposer', 'avis à déposer'),
      lien: `/erp/reservations/${encodeURIComponent(aDeposer[0].reservation.id)}`,
    });
  // Publication automatique des avis : ce qui attend l'accord du gérant avant de partir (Logements → Avis).
  const aValider = e.gerant ? avisAValider({ reservations: e.reservations, avisADeposer: e.avisADeposer ?? [], reponsesAvis: e.reponsesAvis ?? [] }, j) : [];
  if (aValider.length)
    sujets.push({
      cle: 'avis_valider',
      n: aValider.length,
      phrase: `${aValider.length > 1 ? `${aValider.length} avis à valider` : 'Un avis à valider'} avant publication : ${liste(aValider.map((x) => x.voyageur || 'un voyageur'))}.`,
      court: nb(aValider.length, 'avis à valider', 'avis à valider'),
      lien: '/erp/logements/avis',
      gerant: true,
    });
  const depuis = plusJours(j, -14);
  const notes = e.reservations
    .filter((r) => r && r.noteVoyageur !== undefined && r.noteVoyageur < SEUIL_NOTE_CONTROLE && r.depart >= depuis && r.depart <= j)
    .sort((a, b) => b.depart.localeCompare(a.depart));
  if (notes.length)
    sujets.push({
      cle: 'notes',
      n: notes.length,
      phrase: `${notes.length > 1 ? `${notes.length} notes de voyageurs` : 'Une note de voyageur'} sous ${note(SEUIL_NOTE_CONTROLE)} à lire : ${liste(notes.map((r) => `${note(r.noteVoyageur!)} à ${nomLogement(r.logementId)}`))}.`,
      court: nb(notes.length, 'note à lire', 'notes à lire'),
      lien: `/erp/reservations/${encodeURIComponent(notes[0].id)}`,
    });

  /* CRM : la file de l'assistant (même règle que « À faire ») */
  const file = fileDuJour(e.crm ?? [], j);
  if (file.length)
    sujets.push({
      cle: 'crm',
      n: file.length,
      phrase: `${file.length > 1 ? `${file.length} personnes à appeler aujourd’hui, en premier ${file[0].contact.nom}` : `Une personne à appeler aujourd’hui : ${file[0].contact.nom}`}.`,
      court: nb(file.length, 'appel à passer', 'appels à passer'),
      lien: '/erp/crm',
    });

  /* alertes : anomalies (selon le rôle), logements sans personne aujourd'hui, mise à jour en échec */
  const sansChargeAujourdhui =
    e.gerant && e.equipe && e.affectations ? sansChargeLe({ logements: e.logements, equipe: e.equipe, affectations: e.affectations, absences: e.absences ?? [] }, j) : [];
  const dejaSansCharge = new Set(sansChargeAujourdhui.map((x) => x.logementId));
  const anomalies = detecterAnomalies({
    logements: e.logements,
    reservations: e.reservations,
    equipe: e.equipe,
    affectations: e.affectations,
    absences: e.absences ?? [],
    aujourdhui: j,
    maintenant: e.maintenant,
    derniereSynchro: e.derniereSynchro,
  }).filter((a) => (e.gerant || !ANOMALIES_GERANT.includes(a.type)) && !(a.type === 'sans_charge' && a.logementId && dejaSansCharge.has(a.logementId)));
  const parType = new Map<TypeAnomalie, number>();
  for (const a of anomalies) parType.set(a.type, (parType.get(a.type) ?? 0) + 1);
  const alertes = [...parType].map(([t, n]) => MOTS_ANOMALIE[t](n));
  if (sansChargeAujourdhui.length) alertes.push(nb(sansChargeAujourdhui.length, 'logement sans personne en charge aujourd’hui', 'logements sans personne en charge aujourd’hui'));
  if (e.synchroEnEchec) alertes.unshift('la dernière mise à jour Airbnb et Booking a échoué');
  if (alertes.length)
    sujets.push({
      cle: 'alertes',
      n: anomalies.length + sansChargeAujourdhui.length + (e.synchroEnEchec ? 1 : 0),
      phrase: `À vérifier : ${enPhrase(alertes)}.`,
      court: nb(anomalies.length + sansChargeAujourdhui.length + (e.synchroEnEchec ? 1 : 0), 'point à vérifier', 'points à vérifier'),
      lien: anomalies.find((a) => a.type === 'chevauchement')?.lien ?? anomalies[0]?.lien ?? '/erp',
    });

  /* votre agent : contrôle des réponses en panne, fiches incomplètes (comme « À faire ») */
  const alerteControle = (e.reglages ?? []).find((r): r is AlerteControleAgent => r?.id === ID_ALERTE_CONTROLE);
  if (alerteControle?.active)
    sujets.push({
      cle: 'controle_agent',
      n: 1,
      phrase: 'Votre agent ne vérifie plus ses réponses : rien ne part seul, elles restent à valider.',
      court: 'votre agent ne vérifie plus ses réponses',
      lien: '/erp/messagerie/agent',
    });
  const incompletes = e.logements.filter((l) => l?.statut === 'actif' && completudeFiche(l.fiche).manquants.length);
  if (incompletes.length)
    sujets.push({
      cle: 'fiches_agent',
      n: incompletes.length,
      phrase: `Votre agent manque d’informations sur ${incompletes.length > 1 ? `${incompletes.length} logements (${liste(incompletes.map((l) => l.nom))})` : incompletes[0].nom}.`,
      court: nb(incompletes.length, 'fiche à compléter pour l’agent', 'fiches à compléter pour l’agent'),
      lien: `/erp/logements/${encodeURIComponent(incompletes[0].id)}?onglet=fiche`,
    });

  /* gérant : prix conseillés et factures à valider */
  if (e.gerant) {
    const { reglages, decisions } = lireElementsPrix(e.conseilsPrix);
    const conseils = conseillerPrix({ logements: e.logements, reservations: e.reservations, reglages, decisions, aujourdhui: j, maintenant: e.maintenant });
    const logementsPrix = [...new Set(conseils.map((c) => c.logementId))];
    if (logementsPrix.length)
      sujets.push({
        cle: 'prix',
        n: logementsPrix.length,
        phrase: `Prix à revoir sur ${liste(logementsPrix.map((id) => conseils.find((c) => c.logementId === id)!.nom))}.`,
        court: `prix à revoir sur ${nb(logementsPrix.length, 'logement')}`,
        lien: `/erp/logements/${encodeURIComponent(logementsPrix[0])}#prix`,
        gerant: true,
      });
    const factures = facturesAValider(e);
    if (factures.length) {
      const nomProprietaire = (id?: Id) => e.proprietaires?.find((p) => p.id === id)?.nom;
      const qui = factures.map((f) => nomProprietaire(f.proprietaireId)).filter((x): x is string => !!x);
      const mois = [...new Set(factures.map((f) => moisLong(f.mensuelle!.mois)))];
      sujets.push({
        cle: 'factures',
        n: factures.length,
        phrase: `${factures.length > 1 ? `${factures.length} factures mensuelles à valider` : 'Une facture mensuelle à valider'} : ${qui.length ? `${liste(qui)}, ` : ''}${liste(mois)}.`,
        court: nb(factures.length, 'facture à valider', 'factures à valider'),
        lien: lienFacture(e, factures[0]),
        gerant: true,
      });
    }
    // « Ce logement n'est pas à moi » (espace opérations) : le gérant tranche dans Paramètres → Accès.
    const signalements = (e.signalementsLogement ?? []).filter((x) => x?.statut === 'ouvert');
    if (signalements.length)
      sujets.push({
        cle: 'signalements',
        n: signalements.length,
        phrase: `${signalements.length > 1 ? `${signalements.length} logements signalés « pas à moi »` : 'Un logement signalé « pas à moi »'} : ${liste(signalements.map((x) => nomLogement(x.logementId)))}.`,
        court: nb(signalements.length, 'logement signalé « pas à moi »', 'logements signalés « pas à moi »'),
        lien: '/erp/parametres/acces',
        gerant: true,
      });
  }

  const aFaire = sujets.filter((s) => s.cle !== 'journee');
  return {
    date: j,
    sujets,
    texte: texteDuBriefing(sujets),
    court: corpsCourt(sujets),
    rien: occupes.length + arrivees.length + departs.length === 0 && !aFaire.length,
  };
}

/** Où valider une facture mensuelle : la fiche d'un logement du propriétaire (carte « Propriétaire » → Gérer → Factures). */
export function lienFacture(e: Pick<EntreesBriefing, 'logements'>, f: Pick<Facture, 'proprietaireId'>): string {
  const l = e.logements.find((x) => x.proprietaireId === f.proprietaireId);
  // « #factures » : la fiche défile jusqu'à la carte Propriétaire et ouvre ses factures.
  return l ? `/erp/logements/${encodeURIComponent(l.id)}#factures` : '/erp/parametres/acces';
}

/**
 * Le briefing en un paragraphe : la journée d'abord, puis les sujets dans
 * l'ordre donné (celui de la carte « Votre journée » à l'écran ; par défaut,
 * celui du calcul). Rien en attente : « Rien ne vous attend : bonne journée. »
 */
export function texteDuBriefing(sujets: readonly SujetBriefing[], ordre?: readonly CleSujet[]): string {
  const journee = sujets.filter((s) => s.cle === 'journee');
  const autres = sujets.filter((s) => s.cle !== 'journee');
  const rang = (c: CleSujet) => {
    const i = ordre ? ordre.indexOf(c) : -1;
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const tries = ordre ? autres.map((s, i) => ({ s, i })).sort((a, b) => rang(a.s.cle) - rang(b.s.cle) || a.i - b.i).map((x) => x.s) : autres;
  return [...journee, ...tries].map((s) => s.phrase).concat(autres.length ? [] : ['Rien ne vous attend : bonne journée.']).join(' ');
}

/** Ce qui attend, dans la notification : le plus pressant d'abord (on coupe par la fin s'il le faut). */
const ORDRE_COURT: readonly CleSujet[] = ['urgences', 'messages', 'alertes', 'controle_agent', 'crm', 'factures', 'prix', 'avis_valider', 'avis_deposer', 'notes', 'incidents', 'signalements', 'fiches_agent'];

/**
 * Corps de notification : la journée, puis ce qui attend, du plus pressant
 * au moins pressant ; aucun nom. Trop long : les derniers sujets deviennent
 * « et 2 autres sujets » (jamais une phrase coupée).
 */
function corpsCourt(sujets: readonly SujetBriefing[]): string {
  const journee = sujets.find((s) => s.cle === 'journee')?.court ?? '';
  const items = ORDRE_COURT.map((cle) => sujets.find((s) => s.cle === cle)?.court).filter((x): x is string => !!x);
  for (let k = items.length; k >= 0; k--) {
    const reste = items.length - k;
    const morceaux = [...items.slice(0, k), ...(reste ? [`${nb(reste, 'autre sujet', 'autres sujets')}`] : [])];
    const t = morceaux.length ? `${journee} ${majuscule(enPhrase(morceaux))}.` : journee;
    if (t.length <= MAX_COURT || k === 0) return t.length > MAX_COURT ? `${t.slice(0, MAX_COURT - 1).trimEnd()}…` : t;
  }
  return journee;
}

/* -------------------------------------------------------- notification */

/** Clé de la notification du jour : une seule par jour et par espace. */
export const cleBriefing = (aujourdhui: DateISO) => `briefing-${aujourdhui}`;

/**
 * Notification « Briefing du matin » : la version du gérant (avec prix et
 * factures) pour ses appareils, celle de l'équipe pour les autres. Rien si
 * les deux n'ont rien à dire.
 */
export function notificationBriefing(gerant: Briefing, equipe: Briefing): GroupeNotification | null {
  if (gerant.rien && equipe.rien) return null;
  const v = (b: Briefing): VarianteNotification => ({ type: 'rappel', titre: TITRE_BRIEFING, corps: b.court, url: '/erp' });
  const variantes: VarianteNotification[] = [];
  if (!gerant.rien && gerant.court !== equipe.court) variantes.push({ ...v(gerant), gerant: true });
  if (!equipe.rien) variantes.push(v(equipe));
  else if (!variantes.length) variantes.push({ ...v(gerant), gerant: true });
  return { cle: cleBriefing(gerant.date), variantes };
}
