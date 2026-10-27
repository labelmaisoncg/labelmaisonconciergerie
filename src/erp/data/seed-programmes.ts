/**
 * Démonstration des messages automatiques et des avis à déposer : deux
 * moments allumés (la veille de l'arrivée, la demande d'avis), quelques
 * envois passés, et les avis des séjours Airbnb terminés (les plus anciens
 * déjà déposés, un séjour avec incident à relire).
 */
import {
  ID_REGLAGES_PROGRAMMES,
  ajouterJoursISO,
  idEnvoi,
  modeleParDefaut,
  prenomDe,
  raisonsARelire,
  sejourAvecAvis,
} from './messages-programmes';
import { DATE_DEMO } from './format';
import type { ErpDonnees, Reglage, Reservation } from './types';
import type { AvisADeposer, DeclencheurMessage, EnvoiProgramme, ReglagesMessagesProgrammes } from './types-programmes';

const ALLUME_LE = '2026-09-01T09:12:00+02:00';

/** Textes d'avis (comme ceux que prépare l'IA), selon le prénom. */
const AVIS_DEMO = [
  (p: string) => `${p} a été un voyageur discret et très respectueux du logement, rendu impeccable. Communication simple et agréable du début à la fin : nous l’accueillerons de nouveau avec plaisir.`,
  (p: string) => `Un séjour sans fausse note avec ${p} : arrivée et départ à l’heure, logement laissé en très bon état. Un voyageur que nous recommandons sans hésiter.`,
  (p: string) => `${p} a pris grand soin du logement et a suivi toutes les consignes. Échanges courtois et rapides : merci pour ce séjour, au plaisir de vous revoir.`,
];

export function creerProgrammesDemo(d: Omit<ErpDonnees, 'envoisProgrammes' | 'avisADeposer'>): Pick<ErpDonnees, 'envoisProgrammes' | 'avisADeposer' | 'reglages'> {
  const reglages: ReglagesMessagesProgrammes = {
    id: ID_REGLAGES_PROGRAMMES,
    modeles: {
      confirmation: modeleParDefaut('confirmation'),
      veille_arrivee: { ...modeleParDefaut('veille_arrivee'), actif: true, activeLe: ALLUME_LE },
      jour_depart: modeleParDefaut('jour_depart'),
      demande_avis: { ...modeleParDefaut('demande_avis'), actif: true, activeLe: ALLUME_LE },
    },
    majLe: ALLUME_LE,
    majPar: 'Abdel',
  };
  const tousReglages: Reglage[] = [...d.reglages, reglages];

  // Envois passés : la veille des dernières arrivées, la demande d'avis des derniers départs.
  const envoi = (r: Reservation, k: DeclencheurMessage, jour: string, heure: string): EnvoiProgramme => {
    const le = `${jour}T${heure}:00+02:00`;
    return { id: idEnvoi(r.id, k), reservationId: r.id, logementId: r.logementId, declencheur: k, voyageur: prenomDe(r.voyageur.nom), statut: 'envoye', le, envoyeLe: le, canal: r.canal };
  };
  const actives = d.reservations.filter((r) => r.statut !== 'annulee' && (r.canal === 'airbnb' || r.canal === 'booking'));
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
      declencheur: 'demande_avis',
      voyageur: prenomDe(annulee.voyageur.nom),
      statut: 'ignore',
      raison: 'Réservation annulée.',
      le: `${ajouterJoursISO(annulee.depart, 1)}T11:01:00+02:00`,
    });
  }

  // Avis à déposer : séjours Airbnb terminés depuis moins de 14 jours ; ceux de plus de 3 jours déjà déposés (sauf à relire).
  const sejours = d.reservations.filter((r) => sejourAvecAvis(r, DATE_DEMO)).sort((a, b) => a.depart.localeCompare(b.depart));
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
      texte: raisons.length
        ? `${prenom} a séjourné dans notre logement. Le séjour a demandé quelques échanges avec l’équipe.`
        : AVIS_DEMO[i % AVIS_DEMO.length](prenom),
      source: 'ia',
      ...(raisons.length ? { raisons } : {}),
      creeLe: `${ajouterJoursISO(r.depart, 1)}T09:30:00+02:00`,
      redigeLe: `${ajouterJoursISO(r.depart, 1)}T09:30:00+02:00`,
    };
    return ancien && !raisons.length ? { ...base, statut: 'fait', traiteLe: `${ajouterJoursISO(r.depart, 2)}T10:05:00+02:00`, traitePar: 'Abdel' } : base;
  });

  return { envoisProgrammes, avisADeposer, reglages: tousReglages };
}
