/**
 * Démonstration de la publication automatique des avis (avis-auto.ts) : les
 * deux réglages allumés depuis le 15 septembre ; les avis sur les voyageurs
 * des séjours Airbnb terminés depuis publiés seuls deux jours après le départ
 * avec 5 étoiles (ou par Abdel, depuis « À valider », avec la note qu'il a
 * choisie), deux séjours à valider (incident, contrôle à revoir), le dernier
 * séjour prévu pour demain ; des réponses publiées sous les avis 5 sur 5
 * (Airbnb) ou 10 sur 10 (Booking.com), les autres à valider, une réponse
 * écartée par le gérant. Réponses signées du nom de la société s'il est
 * enregistré (pas dans la démonstration : sans signature). Chaque publication
 * est dans « Actions de l'IA ». Rien n'est jamais envoyé : c'est la
 * démonstration.
 */
import { lireAvis, prenomPublic, reponseModele } from './avis';
import { PAR_PUBLICATION_AUTO, jourPublicationAuto, raisonsReponseAValider, signatureSociete } from './avis-auto';
import { actionPublicationAvis } from './copilote';
import { ID_LABEL_MAISON } from './espaces';
import { DATE_DEMO } from './format';
import { masquerCoordonnees } from './masquage';
import { ID_REGLAGES_PROGRAMMES, ajouterJoursISO, prenomDe } from './messages-programmes';
import type { ErpDonnees, Reservation } from './types';
import type { ActionAgent } from './types-copilote';
import type { AvisADeposer, ReglagesMessagesProgrammes, ReponseAvisAuto } from './types-programmes';

/** Allumés par Abdel le 15 septembre. */
const ALLUME_LE = '2026-09-15T09:05:00+02:00';
const ABDEL = { nom: 'Abdel' };
/** Séjours publiés par Abdel depuis « À valider » (incident pendant le séjour, relu puis publié), avec la note qu'il a choisie. */
const PUBLIES_PAR_ABDEL = new Map([
  ['res-0025', 4],
  ['res-0152', 5],
]);
/** Réponses : publiées seules si l'avis le permet (raisonsReponseAValider vide), sinon à valider ; une écartée par le gérant. */
const REPONSES_PUBLIEES = ['res-0150', 'res-0024', 'res-0256', 'res-0199', 'res-0060'];
const REPONSES_A_VALIDER = ['res-0179', 'res-0258', 'res-0151'];
const REPONSE_ECARTEE = 'res-0123';

const heure = (jour: string, hm: string) => `${jour}T${hm}:00+02:00`;

export function creerAvisAutoDemo(
  d: Pick<ErpDonnees, 'reglages' | 'avisADeposer' | 'reservations' | 'logements'>,
): Pick<ErpDonnees, 'reglages' | 'avisADeposer' | 'reponsesAvis'> & { actions: ActionAgent[] } {
  const activeLe = ALLUME_LE.slice(0, 10);
  const reglages = d.reglages.map((r) => {
    if (r.id !== ID_REGLAGES_PROGRAMMES) return r;
    const m = r as ReglagesMessagesProgrammes;
    return { ...m, avisAuto: { voyageurs: { actif: true, activeLe: ALLUME_LE, majPar: 'Abdel' }, reponses: { actif: true, activeLe: ALLUME_LE, majPar: 'Abdel' } } };
  });
  const parId = new Map(d.reservations.map((r) => [r.id, r]));
  const logement = (r: Reservation) => d.logements.find((l) => l.id === r.logementId);
  const actions: ActionAgent[] = [];

  // Avis sur les voyageurs : séjours terminés depuis l'allumage, au moins deux jours avant aujourd'hui.
  const avisADeposer = d.avisADeposer.map((a): AvisADeposer => {
    const r = parId.get(a.reservationId);
    if (!r || r.canal !== 'airbnb' || r.depart < activeLe || jourPublicationAuto(r.depart) > DATE_DEMO) return a;
    const jour = jourPublicationAuto(r.depart);
    if (a.statut === 'a_relire' && !PUBLIES_PAR_ABDEL.has(r.id)) {
      // Séjour sensible : gardé pour le gérant, avec le texte neutre préparé (ou rien : il l'écrit).
      return { ...a, publication: { statut: 'a_valider', avisId: `demo-${r.id}`, le: heure(jour, '10:01'), texte: a.texte ?? '', raisons: a.raisons ?? [] } };
    }
    const parAbdel = PUBLIES_PAR_ABDEL.has(r.id);
    const note = PUBLIES_PAR_ABDEL.get(r.id) ?? 5;
    const texte =
      a.texte?.trim() ||
      `${prenomDe(r.voyageur.nom)} a séjourné dans notre logement et a suivi les consignes. Merci pour ce séjour.`;
    const le = parAbdel ? heure(ajouterJoursISO(jour, 1), '09:12') : heure(jour, '10:02');
    actions.push(
      actionPublicationAvis({
        id: `act-demo-avis-${r.id}`,
        genre: 'voyageur',
        reservation: r,
        plateforme: 'Airbnb',
        texte,
        le,
        espace: ID_LABEL_MAISON,
        // Le nom du membre (l'écran nomme les membres d'après leur adresse ; la démonstration n'en montre aucune).
        ...(parAbdel ? { par: ABDEL.nom } : {}),
        note,
        recommande: true,
        logement: logement(r),
      }),
    );
    return {
      ...a,
      statut: 'fait',
      texte,
      traiteLe: le,
      traitePar: parAbdel ? ABDEL.nom : PAR_PUBLICATION_AUTO,
      publication: { statut: 'publie', avisId: `demo-${r.id}`, le, publieLe: le, par: parAbdel ? ABDEL.nom : PAR_PUBLICATION_AUTO, texte, note, recommande: true },
    };
  });

  // Réponses aux avis : texte simple au ton de la maison (comme sans IA), signé du nom de la société s'il est enregistré.
  const signature = signatureSociete(reglages);
  const reponsesAvis: ReponseAvisAuto[] = [];
  // Avis écrit le lendemain du départ, réponse le surlendemain (jamais après aujourd'hui).
  const jourReponse = (r: Reservation) => (ajouterJoursISO(r.depart, 3) > DATE_DEMO ? DATE_DEMO : ajouterJoursISO(r.depart, 3));
  const ligne = (r: Reservation, publication: ReponseAvisAuto['publication']): ReponseAvisAuto | null => {
    const a = lireAvis(r);
    if (!a) return null;
    return {
      id: r.id,
      reservationId: r.id,
      logementId: r.logementId,
      voyageur: prenomDe(r.voyageur.nom) || 'Voyageur',
      canal: r.canal,
      ...(a.note !== undefined ? { note: a.note } : {}),
      ...(a.textePublic ? { avis: masquerCoordonnees(a.textePublic).slice(0, 600) } : {}),
      publication,
      creeLe: publication.le,
    };
  };
  for (const id of REPONSES_PUBLIEES) {
    const r = parId.get(id);
    const a = r ? lireAvis(r) : null;
    // Seulement un avis qui partirait seul pour de vrai (5 sur 5 sur Airbnb, 9 sur 10 et plus sur Booking.com, sans reproche).
    if (!r || !a || raisonsReponseAValider(a).length) continue;
    const le = heure(jourReponse(r), '10:04');
    const texte = reponseModele(a, { prenom: prenomPublic(r.voyageur.nom), signature });
    const x = ligne(r, { statut: 'publie', avisId: `demo-rep-${id}`, le, publieLe: le, par: PAR_PUBLICATION_AUTO, texte });
    if (!x) continue;
    reponsesAvis.push(x);
    actions.push(
      actionPublicationAvis({
        id: `act-demo-reponse-${id}`,
        genre: 'reponse',
        reservation: r,
        plateforme: r.canal === 'booking' ? 'Booking.com' : 'Airbnb',
        texte,
        le,
        espace: ID_LABEL_MAISON,
        logement: logement(r),
      }),
    );
  }
  for (const id of REPONSES_A_VALIDER) {
    const r = parId.get(id);
    const a = r ? lireAvis(r) : null;
    if (!r || !a) continue;
    const le = heure(jourReponse(r), '10:05');
    const x = ligne(r, { statut: 'a_valider', avisId: `demo-rep-${id}`, le, texte: reponseModele(a, { prenom: prenomPublic(r.voyageur.nom), signature }), raisons: raisonsReponseAValider(a) });
    if (x) reponsesAvis.push(x);
  }
  const ecartee = parId.get(REPONSE_ECARTEE);
  if (ecartee) {
    const a = lireAvis(ecartee);
    const le = heure(ajouterJoursISO(ecartee.depart, 4), '18:40');
    const x = a ? ligne(ecartee, { statut: 'refuse', avisId: `demo-rep-${REPONSE_ECARTEE}`, le, par: ABDEL.nom, raisons: raisonsReponseAValider(a) }) : null;
    if (x) reponsesAvis.push(x);
  }
  return { reglages, avisADeposer, reponsesAvis, actions };
}
