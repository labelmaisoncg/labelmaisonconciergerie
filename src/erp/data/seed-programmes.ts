/**
 * Démonstration des messages automatiques et des avis à déposer : deux
 * moments allumés (la veille de l'arrivée, la demande d'avis), quelques
 * envois passés, et les avis des séjours Airbnb terminés (les plus anciens
 * déjà déposés, des séjours avec incident à relire, dont un sans texte), et
 * chaque message parti dans sa conversation.
 */
import {
  ID_REGLAGES_PROGRAMMES,
  PAR_MESSAGE_AUTO,
  ajouterJoursISO,
  filDuSejour,
  idEnvoi,
  modeleParDefaut,
  prenomDe,
  raisonsARelire,
  rendreMessage,
  sejourAvecAvis,
  signatureProgrammes,
} from './messages-programmes';
import { DATE_DEMO } from './format';
import type { ErpDonnees, Message, Reglage, Reservation } from './types';
import type { AvisADeposer, DeclencheurMessage, EnvoiProgramme, ReglagesMessagesProgrammes } from './types-programmes';

const ALLUME_LE = '2026-09-01T09:12:00+02:00';

/** Textes d'avis (comme ceux que prépare l'IA), selon le prénom. */
const AVIS_DEMO = [
  (p: string) => `${p} a été un voyageur discret et très respectueux du logement, rendu impeccable. Communication simple et agréable du début à la fin : nous l’accueillerons de nouveau avec plaisir.`,
  (p: string) => `Un séjour sans fausse note avec ${p} : arrivée et départ à l’heure, logement laissé en très bon état. Un voyageur que nous recommandons sans hésiter.`,
  (p: string) => `${p} a pris grand soin du logement et a suivi toutes les consignes. Échanges courtois et rapides : merci pour ce séjour, au plaisir de vous revoir.`,
];

export function creerProgrammesDemo(d: Omit<ErpDonnees, 'envoisProgrammes' | 'avisADeposer' | 'reponsesAvis'>): Pick<ErpDonnees, 'envoisProgrammes' | 'avisADeposer' | 'reglages' | 'filsMessages'> {
  const reglages: ReglagesMessagesProgrammes = {
    id: ID_REGLAGES_PROGRAMMES,
    modeles: {
      confirmation: modeleParDefaut('confirmation'),
      // Facultatif et éteint, comme dans un nouvel espace.
      proposer_supplements: modeleParDefaut('proposer_supplements'),
      veille_arrivee: { ...modeleParDefaut('veille_arrivee'), actif: true, activeLe: ALLUME_LE },
      jour_depart: modeleParDefaut('jour_depart'),
      demande_avis: { ...modeleParDefaut('demande_avis'), actif: true, activeLe: ALLUME_LE },
    },
    majLe: ALLUME_LE,
    majPar: 'Abdel',
  };
  const tousReglages: Reglage[] = [...d.reglages, reglages];

  // Envois passés : la veille des dernières arrivées, la demande d'avis des derniers départs.
  // Comme en production, chaque envoi garde sa conversation quand le séjour en a une (lien de l'historique).
  const conversation = (r: Reservation) => {
    const fil = filDuSejour(d.filsMessages, r.id);
    return fil ? { filId: fil.id } : {};
  };
  const envoi = (r: Reservation, k: DeclencheurMessage, jour: string, heure: string): EnvoiProgramme => {
    const le = `${jour}T${heure}:00+02:00`;
    return { id: idEnvoi(r.id, k), reservationId: r.id, logementId: r.logementId, ...conversation(r), declencheur: k, voyageur: prenomDe(r.voyageur.nom), statut: 'envoye', le, envoyeLe: le, canal: r.canal };
  };
  // Les séjours qui ont une conversation d'abord : leur ligne d'historique mène à la conversation.
  const actives = d.reservations
    .filter((r) => r.statut !== 'annulee' && (r.canal === 'airbnb' || r.canal === 'booking'))
    .sort((a, b) => Number(!!filDuSejour(d.filsMessages, b.id)) - Number(!!filDuSejour(d.filsMessages, a.id)));
  const veilles = actives.filter((r) => r.arrivee <= DATE_DEMO && r.arrivee >= ajouterJoursISO(DATE_DEMO, -3)).slice(0, 4);
  const lendemains = actives.filter((r) => r.depart < DATE_DEMO && r.depart >= ajouterJoursISO(DATE_DEMO, -3)).slice(0, 3);
  const envoisProgrammes: EnvoiProgramme[] = [
    ...veilles.map((r) => envoi(r, 'veille_arrivee', ajouterJoursISO(r.arrivee, -1), '18:02')),
    ...lendemains.map((r) => envoi(r, 'demande_avis', ajouterJoursISO(r.depart, 1), '11:01')),
  ];
  const annulee = d.reservations.find((r) => r.statut === 'annulee' && r.depart >= ajouterJoursISO(DATE_DEMO, -10) && r.depart < DATE_DEMO);
  if (annulee) {
    envoisProgrammes.push({
      id: idEnvoi(annulee.id, 'demande_avis'),
      reservationId: annulee.id,
      logementId: annulee.logementId,
      ...conversation(annulee),
      declencheur: 'demande_avis',
      voyageur: prenomDe(annulee.voyageur.nom),
      statut: 'ignore',
      raison: 'Réservation annulée.',
      le: `${ajouterJoursISO(annulee.depart, 1)}T11:01:00+02:00`,
    });
  }

  // Chaque message parti figure dans sa conversation, comme en production (envoyerMessage) :
  // « Message automatique » sous la bulle (envoi.par = PAR_MESSAGE_AUTO), à son heure d'envoi.
  const signature = signatureProgrammes({ reglages: tousReglages });
  const ajouts = new Map<string, Message[]>();
  for (const e of envoisProgrammes) {
    const r = d.reservations.find((x) => x.id === e.reservationId);
    const fil = d.filsMessages.find((f) => f.id === e.filId);
    if (e.statut !== 'envoye' || !e.envoyeLe || !r || !fil) continue;
    const logement = d.logements.find((l) => l.id === r.logementId);
    const rendu = rendreMessage(reglages.modeles[e.declencheur].texte, { reservation: r, logement, fil, signature, aujourdhui: e.envoyeLe.slice(0, 10) });
    if (!rendu.texte || rendu.codesEnClair) continue;
    const message: Message = { id: `msg-auto-${e.id}`, auteur: 'hote', texte: rendu.texte, envoyeLe: e.envoyeLe, envoi: { canal: e.canal ?? r.canal, par: PAR_MESSAGE_AUTO, moment: e.declencheur } };
    ajouts.set(fil.id, [...(ajouts.get(fil.id) ?? []), message]);
  }
  const filsMessages = d.filsMessages.map((f) => {
    const ajout = ajouts.get(f.id);
    if (!ajout) return f;
    const messages = [...f.messages, ...ajout].sort((a, b) => a.envoyeLe.localeCompare(b.envoyeLe));
    return { ...f, messages, dernierMessageLe: messages[messages.length - 1].envoyeLe };
  });

  // Avis à déposer : séjours Airbnb terminés depuis moins de 14 jours ; ceux de plus de 3 jours déjà déposés (sauf à relire).
  const sejours = d.reservations.filter((r) => sejourAvecAvis(r, DATE_DEMO)).sort((a, b) => a.depart.localeCompare(b.depart));
  // Le premier avis à relire n'a pas de texte (IA indisponible au passage) : l'équipe l'écrit elle-même, jamais d'éloge.
  const sansTexte = sejours.find((r) => raisonsARelire(r, d).length)?.id;
  const avisADeposer: AvisADeposer[] = sejours.map((r, i) => {
    const prenom = prenomDe(r.voyageur.nom);
    const raisons = raisonsARelire(r, d);
    const ancien = r.depart < ajouterJoursISO(DATE_DEMO, -3);
    const base: AvisADeposer = {
      id: r.id,
      reservationId: r.id,
      logementId: r.logementId,
      voyageur: prenom,
      depart: r.depart,
      canal: r.canal,
      statut: raisons.length ? 'a_relire' : 'pret',
      texte:
        r.id === sansTexte
          ? ''
          : raisons.length
            ? `${prenom} a séjourné dans notre logement. Le séjour a demandé quelques échanges avec l’équipe.`
            : AVIS_DEMO[i % AVIS_DEMO.length](prenom),
      source: r.id === sansTexte ? 'modele' : 'ia',
      ...(raisons.length ? { raisons } : {}),
      creeLe: `${ajouterJoursISO(r.depart, 1)}T09:30:00+02:00`,
      redigeLe: `${ajouterJoursISO(r.depart, 1)}T09:30:00+02:00`,
    };
    return ancien && !raisons.length ? { ...base, statut: 'fait', traiteLe: `${ajouterJoursISO(r.depart, 2)}T10:05:00+02:00`, traitePar: 'Abdel' } : base;
  });

  return { envoisProgrammes, avisADeposer, reglages: tousReglages, filsMessages };
}
