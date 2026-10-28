/**
 * Auto-contrôle des messages automatiques (B1) et des avis à déposer (B5),
 * sans réseau : règles pures (messages-programmes.ts), puis un passage
 * serveur complet (passage-programmes.ts) avec une fausse base, une fausse
 * plateforme (envoi avec clé d'idempotence) et un faux Claude, en mémoire.
 *
 * Vérifie : heures de Paris (changement d'heure), éteint par défaut, rien de
 * prévu avant l'allumage, jamais avant 8 h ni après 21 h, jamais deux fois
 * (même après une coupure), réservation annulée et sans conversation
 * écartées, conversation hors plateforme, voyageur qui attend une réponse,
 * codes et wifi seulement dans la fenêtre des 48 h (même règle que l'agent),
 * confirmation seulement pour les nouvelles réservations (pas d'importation),
 * signature par espace, aucune écriture sur la plateforme autre qu'un
 * message, file des avis (incident, note basse, message négatif → à relire),
 * plafond mensuel de l'IA, décision de l'équipe jamais écrasée.
 *
 * Lancement :
 *   node_modules/.bin/esbuild src/erp/data/verifier-messages-programmes.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/vmp.mjs && node /tmp/vmp.mjs
 */
import type Anthropic from '@anthropic-ai/sdk';
import { COLLECTION_AGENT, ID_ETAT_AGENT, MODELE_AGENT_DEFAUT, codesPermis, type ClientIA, type EtatAgent } from './agent-messagerie';
import {
  COLLECTION_AVIS_A_DEPOSER,
  COLLECTION_ENVOIS_PROGRAMMES,
  DECLENCHEURS,
  HEURES_ENVOI,
  PAR_MESSAGE_AUTO,
  RAISONS,
  ALERTE_FORME_AVIS,
  SEUIL_IMPORT,
  TEXTES_DEFAUT,
  VARIABLES,
  ajouterJoursISO,
  alerteTexteAvis,
  avisAPreparer,
  avisATraiter,
  cleEnvoiProgramme,
  codesAutorises,
  consignesAvis,
  contexteAvis,
  contientEloge,
  dansPlageEnvoi,
  deciderEnvoi,
  etatAvis,
  fenetreEnvoi,
  idEnvoi,
  instantParis,
  lireAvisIA,
  majReservationsVues,
  modeleEffectif,
  momentHorsFenetreCodes,
  planifierEnvois,
  prochainEnvoi,
  raisonsARelire,
  reglagesProgrammes,
  rendreMessage,
  secretEcritDansModele,
  sejourJoignable,
  sejoursPourApercu,
  sejourAvecAvis,
  signatureProgrammes,
  soucisDuSejour,
  texteAffiche,
  texteAvisParDefaut,
  texteStocke,
  type ReservationsVues,
} from './messages-programmes';
import { attendEquipe } from './attente-equipe';
import { lancerProgrammes, type OptionsProgrammes } from './passage-programmes';
import { creerSeed } from './seed';
import { REGLAGES_AGENT_DEFAUT } from './reglages';
import { BaseErp, ecritureRepullPermise } from './repull-synchro';
import type { FilMessages, Incident, Logement, Message, Reglage, Reservation } from './types';
import type { AvisADeposer, DeclencheurMessage, EnvoiProgramme, ReglagesMessagesProgrammes } from './types-programmes';

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
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });
const paris = (iso: string) => new Date(iso);

/* -------------------------------------------------------------- données */

const LOGEMENT: Logement = {
  id: 'log-1',
  nom: 'Corbeil Rives de Seine',
  adresse: '',
  ville: 'Corbeil-Essonnes',
  codePostal: '91100',
  type: 'T2',
  surfaceM2: 40,
  capacite: 4,
  chambres: 1,
  lits: [],
  statut: 'actif',
  proprietaireId: 'p1',
  residencePrincipale: false,
  serrure: 'boite_a_cles',
  fiche: {
    wifiNom: 'LM-Corbeil',
    wifiCode: 'soleil2026',
    heureArrivee: '16:00',
    heureDepart: '11:00',
    acces: 'Boîte à clés 4821, à droite de la porte.',
    parking: 'Place 12',
    regles: 'Pas de fête.',
    equipements: ['Lave-linge'],
    guides: [
      { id: 'g-acces', titre: 'Comment entrer', media: { type: 'video', url: 'https://youtu.be/entree' }, acces: true, ajouteLe: '2026-09-01T10:00:00+02:00', ajoutePar: 'Abdel' },
      { id: 'g-quartier', titre: 'Le quartier', media: { type: 'lien', url: 'https://exemple.fr/quartier' }, ajouteLe: '2026-09-01T10:00:00+02:00', ajoutePar: 'Abdel' },
    ],
  },
  dotationLinge: [],
  annonces: [],
  checklistLancement: [],
};

function resa(id: string, p: Partial<Reservation> = {}): Reservation {
  return {
    id,
    logementId: 'log-1',
    canal: 'airbnb',
    voyageur: { nom: 'Marie Dupont', nbPersonnes: 2 },
    arrivee: '2026-10-26',
    depart: '2026-10-29',
    nuits: 3,
    statut: 'confirmee',
    montantBrutCentimes: 30000,
    commissionPlateformeCentimes: 3000,
    fraisMenageCentimes: 4000,
    ...p,
  };
}

function msg(id: string, auteur: Message['auteur'], texte: string, envoyeLe = '2026-10-20T10:00:00+02:00'): Message {
  return { id, auteur, texte, envoyeLe };
}

function fil(id: string, reservationId: string, p: Partial<FilMessages> = {}): FilMessages {
  return {
    id,
    reservationId,
    logementId: 'log-1',
    canal: 'airbnb',
    voyageur: 'Marie',
    statut: 'ouvert',
    messages: [msg(`${id}-m1`, 'voyageur', 'Bonjour, nous arrivons lundi.'), msg(`${id}-m2`, 'agent', 'Avec plaisir, à lundi !', '2026-10-20T10:05:00+02:00')],
    dernierMessageLe: '2026-10-20T10:05:00+02:00',
    traitePar: 'agent',
    repull: { id: id.replace('fil-', '') },
    ...p,
  };
}

const ALLUME_LE = '2026-10-01T10:00:00+02:00';
function reglagesAllumes(moments: DeclencheurMessage[], activeLe = ALLUME_LE, patch: (r: ReglagesMessagesProgrammes) => void = () => undefined): ReglagesMessagesProgrammes {
  const r = reglagesProgrammes({ reglages: [] });
  for (const k of moments) r.modeles[k] = { ...r.modeles[k], actif: true, activeLe };
  patch(r);
  return r;
}

/** Le texte par défaut des infos d'arrivée ne cite plus que le livret : la ligne {lien_guide} qu'une équipe peut ajouter. */
const LIGNE_GUIDE = 'Votre guide d’arrivée : {lien_guide}\n{signature}';
const avecLienGuide = (r: ReglagesMessagesProgrammes) => {
  r.modeles.veille_arrivee = { ...r.modeles.veille_arrivee, texte: r.modeles.veille_arrivee.texte.replace('{signature}', LIGNE_GUIDE) };
};

/* ================================================================ règles */

function heures() {
  section('Heures de Paris et changement d’heure');
  // Passage à l'heure d'hiver le dimanche 25 octobre 2026 à 3 h.
  verifier(instantParis('2026-10-24', '18:00') === Date.parse('2026-10-24T16:00:00Z'), '24 oct. 18:00 à Paris = 16:00 UTC (heure d’été)');
  verifier(instantParis('2026-10-25', '18:00') === Date.parse('2026-10-25T17:00:00Z'), '25 oct. 18:00 à Paris = 17:00 UTC (heure d’hiver, jour du changement)');
  verifier(instantParis('2026-10-25', '08:30') === Date.parse('2026-10-25T07:30:00Z'), '25 oct. 08:30 à Paris = 07:30 UTC');
  // Passage à l'heure d'été le dimanche 28 mars 2027 à 2 h.
  verifier(instantParis('2027-03-27', '08:00') === Date.parse('2027-03-27T07:00:00Z'), '27 mars 2027 08:00 = 07:00 UTC');
  verifier(instantParis('2027-03-28', '08:00') === Date.parse('2027-03-28T06:00:00Z'), '28 mars 2027 08:00 = 06:00 UTC (heure d’été)');

  const veille = fenetreEnvoi('veille_arrivee', resa('r'), { heure: '18:00' });
  verifier(veille?.debut === Date.parse('2026-10-25T17:00:00Z') && veille?.fin === Date.parse('2026-10-25T20:00:00Z'), 'veille de l’arrivée : de 18:00 à 21:00 la veille, heure de Paris');
  const depart = fenetreEnvoi('jour_depart', resa('r'), { heure: '08:30' });
  verifier(depart?.debut === Date.parse('2026-10-29T07:30:00Z') && depart?.fin === Date.parse('2026-10-29T11:00:00Z'), 'matin du départ : de 08:30 à midi');
  const avis = fenetreEnvoi('demande_avis', resa('r'), { heure: '11:00' });
  verifier(avis?.debut === Date.parse('2026-10-30T10:00:00Z'), 'demande d’avis : le lendemain du départ à 11:00');
  verifier(fenetreEnvoi('confirmation', resa('r'), {}, undefined) === null && fenetreEnvoi('confirmation', resa('r'), {}, '') === null, 'confirmation : rien sans « première vue »');

  verifier(!dansPlageEnvoi(paris('2026-10-25T06:59:00Z')), '07:59 à Paris (hiver) : hors des heures d’envoi');
  verifier(dansPlageEnvoi(paris('2026-10-25T07:00:00Z')), '08:00 à Paris (hiver) : dans les heures');
  verifier(dansPlageEnvoi(paris('2026-10-25T19:59:00Z')) && !dansPlageEnvoi(paris('2026-10-25T20:00:00Z')), '20:59 oui, 21:00 non (hiver)');
  verifier(!dansPlageEnvoi(paris('2026-07-01T05:59:00Z')) && dansPlageEnvoi(paris('2026-07-01T06:00:00Z')), '07:59 non, 08:00 oui (été)');
  verifier(HEURES_ENVOI[0] === '08:00' && HEURES_ENVOI[HEURES_ENVOI.length - 1] === '20:30', 'heures proposées de 08:00 à 20:30');
  const r = reglagesProgrammes({ reglages: [{ id: 'messages-programmes', modeles: { veille_arrivee: { actif: false, texte: 'x', heure: '23:00' } } } as unknown as Reglage] });
  verifier(r.modeles.veille_arrivee.heure === '18:00', 'une heure hors de 8 h – 21 h n’est jamais retenue');
}

function eteintParDefaut() {
  section('Éteint par défaut');
  const r = reglagesProgrammes({ reglages: [] });
  verifier(DECLENCHEURS.every((k) => !r.modeles[k].actif), 'les quatre moments sont éteints sans réglage');
  const sansDate = reglagesProgrammes({ reglages: [{ id: 'messages-programmes', modeles: { veille_arrivee: { actif: true, texte: 'Bonjour' } } } as unknown as Reglage] });
  verifier(!sansDate.modeles.veille_arrivee.actif, 'allumé sans date d’allumage : reste éteint');
  const d = deciderEnvoi({ declencheur: 'veille_arrivee', reservation: resa('r1'), reglages: r, fils: [fil('fil-1', 'r1')], maintenant: paris('2026-10-25T17:30:00Z') });
  verifier(d.genre === 'rien', 'éteint : rien ne part, même au bon moment');
}

function decisions() {
  section('Décisions d’envoi');
  const reglages = reglagesAllumes(['veille_arrivee']);
  const a1830 = paris('2026-10-25T17:30:00Z'); // 18:30 à Paris, la veille de l'arrivée
  const decide = (r: Reservation, fils: FilMessages[], maintenant = a1830, envoi?: EnvoiProgramme, rg = reglages) =>
    deciderEnvoi({ declencheur: 'veille_arrivee', reservation: r, reglages: rg, fils, envoi, maintenant });

  verifier(decide(resa('r1'), [fil('fil-1', 'r1')]).genre === 'envoyer', 'la veille à 18:30 : le message part');
  verifier(decide(resa('r1'), [fil('fil-1', 'r1')], paris('2026-10-25T16:30:00Z')).genre === 'rien', 'la veille à 17:30 : pas encore');
  const annulee = decide(resa('r2', { statut: 'annulee' }), [fil('fil-2', 'r2')]);
  verifier(annulee.genre === 'ignorer' && annulee.raison === RAISONS.annulee, 'réservation annulée : écartée et notée');
  const sansFil = decide(resa('r3'), []);
  verifier(sansFil.genre === 'attendre' && sansFil.raison === RAISONS.sansConversation, 'sans conversation : on attend (elle peut arriver avec la synchronisation)');
  const apres = decide(resa('r3'), [], paris('2026-10-25T20:30:00Z'));
  verifier(apres.genre === 'ignorer' && apres.raison === RAISONS.sansConversation, 'moment passé sans conversation : noté « pas de conversation »');
  verifier(decide(resa('r3'), [], paris('2026-10-27T10:00:00Z')).genre === 'rien', 'longtemps après : rien (pas d’historique pour un vieux séjour)');
  const hors = decide(resa('r4', { canal: 'booking' }), [fil('fil-4', 'r4', { repull: undefined, canal: 'booking' })]);
  verifier(hors.genre === 'ignorer' && hors.raison === RAISONS.horsPlateforme, 'conversation hors plateforme : envoi impossible, noté');
  const attend = decide(resa('r5'), [fil('fil-5', 'r5', { messages: [msg('m', 'voyageur', 'Il y a un parking ?', '2026-10-25T19:20:00+01:00')], traitePar: 'en_attente' })]);
  verifier(attend.genre === 'attendre' && attend.raison === RAISONS.attend, 'le voyageur attend une réponse : on ne lui coupe pas la parole');
  const close = decide(resa('r5'), [fil('fil-5', 'r5', { statut: 'clos', messages: [msg('m', 'voyageur', 'Merci !')] })]);
  verifier(close.genre === 'envoyer', 'conversation close (« pas besoin de répondre ») : le message part');
  // Cas de la démonstration (Marta N.) : transmise à l'équipe, le dernier message vient de l'agent.
  const transmise = fil('fil-6', 'r6', {
    statut: 'escalade',
    traitePar: 'en_attente',
    messages: [
      msg('m1', 'voyageur', 'Est-il possible d’arriver vers 13 h ? Notre train arrive tôt.', '2026-10-25T07:48:00+01:00'),
      msg('m2', 'agent', 'Je vérifie avec l’équipe ménage si le logement peut être prêt plus tôt et je reviens vers vous.', '2026-10-25T07:49:00+01:00'),
    ],
  });
  const marta = decide(resa('r6'), [transmise]);
  verifier(
    attendEquipe(transmise) && marta.genre === 'attendre' && marta.raison === RAISONS.attend,
    'conversation transmise (dernier message de l’agent) : le voyageur attend l’équipe, rien ne part (même règle que « À répondre »)',
  );
  const enAttente = decide(resa('r6'), [fil('fil-6', 'r6', { statut: 'ouvert', traitePar: 'en_attente', messages: [msg('m2', 'agent', 'Je transmets à l’équipe.')] })]);
  verifier(enAttente.genre === 'attendre' && enAttente.raison === RAISONS.attend, 'conversation sans réponse de l’équipe (« en attente ») : rien ne part');
  const passeTransmise = decide(resa('r6'), [transmise], paris('2026-10-25T20:30:00Z'));
  verifier(passeTransmise.genre === 'ignorer' && passeTransmise.raison === RAISONS.attend, 'moment passé pendant l’attente : noté « le voyageur attendait une réponse », rien n’est parti');
  // Les conversations de la démonstration : celle de Marta (transmise, agent en dernier), reliée à une plateforme comme en production.
  const demo = creerSeed();
  const filMarta = demo.filsMessages.find((f) => f.messages.some((m) => m.texte.startsWith('Je vérifie avec l’équipe ménage')));
  const resaMarta = demo.reservations.find((r) => r.id === filMarta?.reservationId);
  if (filMarta && resaMarta) {
    const veille = paris(`${ajouterJoursISO(resaMarta.arrivee, -1)}T17:30:00Z`);
    const surPlateforme = { ...filMarta, repull: { id: 'conv-demo' } } as FilMessages;
    const dMarta = deciderEnvoi({ declencheur: 'veille_arrivee', reservation: resaMarta, reglages: reglagesAllumes(['veille_arrivee'], '2026-01-01T09:00:00+01:00'), fils: [surPlateforme], maintenant: veille });
    verifier(dMarta.genre === 'attendre' && dMarta.raison === RAISONS.attend, `démonstration : « Infos d’arrivée » de ${filMarta.voyageur} (transmise) ne part pas la veille à 18:30`);
  } else verifier(false, 'démonstration : conversation transmise de Marta introuvable');

  // Jamais deux fois.
  const ligne = (statut: EnvoiProgramme['statut'], depuis = '2026-10-25T18:31:00+01:00'): EnvoiProgramme => ({
    id: idEnvoi('r1', 'veille_arrivee'), reservationId: 'r1', logementId: 'log-1', declencheur: 'veille_arrivee', voyageur: 'Marie', statut, le: depuis, depuis, texte: 'Bonjour', cle: cleEnvoiProgramme('r1', 'veille_arrivee'), filId: 'fil-1',
  });
  for (const s of ['envoye', 'ignore', 'echec', 'a_verifier'] as const) verifier(decide(resa('r1'), [fil('fil-1', 'r1')], a1830, ligne(s)).genre === 'rien', `déjà « ${s} » : rien ne repart`);
  verifier(decide(resa('r1'), [fil('fil-1', 'r1')], a1830, ligne('reporte')).genre === 'envoyer', '« reporté » (rien n’est parti) : réessayé');
  const reprise = decide(resa('r1'), [fil('fil-1', 'r1')], a1830, ligne('en_cours'));
  verifier(reprise.genre === 'reprendre' && reprise.envoi.cle === 'lm-auto-r1-veille_arrivee', 'envoi coupé : repris avec la même clé');
  const vieux = decide(resa('r1'), [fil('fil-1', 'r1')], paris('2026-10-26T18:00:00Z'), ligne('en_cours', '2026-10-25T18:31:00+01:00'));
  verifier(vieux.genre === 'verifier' && vieux.raison === RAISONS.pasConfirme, 'envoi coupé depuis plus de 23 h : « à vérifier », rien n’est renvoyé');
  verifier(cleEnvoiProgramme('r1', 'veille_arrivee') !== cleEnvoiProgramme('r1', 'demande_avis'), 'une clé par séjour et par moment');

  // Rien de ce qui était prévu avant l'allumage.
  const tard = reglagesAllumes(['veille_arrivee'], '2026-10-25T19:00:00+01:00');
  verifier(decide(resa('r1'), [fil('fil-1', 'r1')], paris('2026-10-25T18:30:00Z'), undefined, tard).genre === 'rien', 'allumé à 19:00 pour un envoi prévu à 18:00 : rien ne part');

  // Logement : texte propre, ou coupé.
  const parLogement = reglagesAllumes(['veille_arrivee'], ALLUME_LE, (r) => (r.modeles.veille_arrivee.logements = { 'log-1': { texte: 'Texte du logement {prenom}' }, 'log-2': { actif: false } }));
  verifier(modeleEffectif(parLogement, 'veille_arrivee', 'log-1').texte === 'Texte du logement {prenom}', 'texte propre à un logement');
  verifier(modeleEffectif(parLogement, 'veille_arrivee', 'log-3').texte === parLogement.modeles.veille_arrivee.texte, 'autres logements : texte de l’espace');
  verifier(decide(resa('r9', { logementId: 'log-2' }), [fil('fil-9', 'r9', { logementId: 'log-2' })], a1830, undefined, parLogement).genre === 'rien', 'logement coupé : rien ne part');

  // Plan d'un passage : reprises d'abord.
  const plan = planifierEnvois({ reservations: [resa('r1'), resa('r2', { statut: 'annulee' }), resa('r6')], fils: [fil('fil-1', 'r1'), fil('fil-6', 'r6')], reglages, envois: [ligne('en_cours')], maintenant: a1830 });
  verifier(plan[0]?.decision.genre === 'reprendre' && plan.some((p) => p.decision.genre === 'envoyer' && p.reservation.id === 'r6'), 'plan : la reprise d’abord, puis les nouveaux envois');
  verifier(!plan.some((p) => p.reservation.id === 'r1' && p.decision.genre === 'envoyer'), 'plan : jamais un second envoi pour le même séjour');
}

function heuresCalmes() {
  section('Jamais avant 8 h ni après 21 h');
  const reglages = reglagesAllumes(['confirmation']);
  const vues: ReservationsVues = { activeLe: ALLUME_LE, vues: { r7: '2026-10-25T21:30:00.000Z' } }; // vue à 22:30 à Paris
  const r7 = resa('r7', { arrivee: '2026-11-10', depart: '2026-11-12' });
  const d = (iso: string) => deciderEnvoi({ declencheur: 'confirmation', reservation: r7, reglages, fils: [fil('fil-7', 'r7')], vues, maintenant: paris(iso) });
  const nuit = d('2026-10-25T21:40:00Z');
  verifier(nuit.genre === 'attendre' && nuit.raison === RAISONS.horsHeures, 'nouvelle réservation à 22:30 : attend le matin');
  verifier(d('2026-10-26T06:30:00Z').genre === 'attendre', '07:30 : attend encore');
  verifier(d('2026-10-26T07:05:00Z').genre === 'envoyer', '08:05 : la confirmation part');
  verifier(d('2026-10-28T08:00:00Z').genre === 'ignorer', 'plus de 48 h après : ne part plus (noté une fois)');
  const avant: ReservationsVues = { activeLe: ALLUME_LE, vues: { r7: '' } };
  verifier(deciderEnvoi({ declencheur: 'confirmation', reservation: r7, reglages, fils: [fil('fil-7', 'r7')], vues: avant, maintenant: paris('2026-10-26T09:00:00Z') }).genre === 'rien', 'réservation connue avant l’allumage : jamais de confirmation');
}

function reservationsVues() {
  section('Confirmation : seulement les nouvelles réservations');
  const conf = { actif: true, activeLe: ALLUME_LE };
  const t0 = paris('2026-10-25T10:00:00Z');
  const existantes = [resa('a'), resa('b')];
  const init = majReservationsVues(undefined, existantes, conf, t0);
  verifier(init.vues.vues.a === '' && init.vues.vues.b === '' && !init.nouvelles.length, 'à l’allumage : les réservations présentes sont « connues avant »');
  const suite = majReservationsVues(init.vues, [...existantes, resa('c')], conf, paris('2026-10-25T10:30:00Z'));
  verifier(suite.nouvelles.join() === 'c' && suite.vues.vues.c === '2026-10-25T10:30:00.000Z' && suite.vues.vues.a === '', 'une nouvelle réservation est notée avec l’instant où elle est vue');
  const lot = Array.from({ length: SEUIL_IMPORT + 1 }, (_, i) => resa(`imp-${i}`));
  const imp = majReservationsVues(suite.vues, [...existantes, resa('c'), ...lot], conf, paris('2026-10-25T11:00:00Z'));
  verifier(imp.importation === SEUIL_IMPORT + 1 && !imp.nouvelles.length && imp.vues.vues['imp-0'] === '', 'beaucoup d’un coup (connexion d’une plateforme) : pas de confirmation');
  const rallume = majReservationsVues(suite.vues, [...existantes, resa('c'), resa('d')], { actif: true, activeLe: '2026-10-25T12:00:00+02:00' }, paris('2026-10-25T11:00:00Z'));
  verifier(rallume.vues.vues.d === '' && rallume.vues.vues.c === '', 'éteinte puis rallumée : on repart de zéro, rien pour les réservations déjà là');
  verifier(!Object.keys(majReservationsVues(suite.vues, existantes, { actif: false }, t0).vues.vues).length, 'éteinte : la liste est vidée');
  const parties = majReservationsVues(suite.vues, [resa('a', { depart: '2026-10-20' }), resa('c')], conf, paris('2026-10-25T10:45:00Z'));
  verifier(!('a' in parties.vues.vues) && 'c' in parties.vues.vues, 'séjours terminés retirés de la liste');
}

function rendu() {
  section('Texte : variables, codes seulement dans la fenêtre des 48 h');
  // Le texte par défaut ne cite plus que le livret (qui montre les guides) : une ligne {lien_guide} ajoutée comme le ferait l'équipe.
  const veille = reglagesProgrammes({ reglages: [] }).modeles.veille_arrivee.texte.replace('{signature}', LIGNE_GUIDE);
  const ctx = (r: Reservation, aujourdhui: string, lienGuide?: string) => ({ reservation: r, logement: LOGEMENT, fil: fil('fil-1', r.id), signature: 'L’équipe Label Maison', lienGuide, aujourdhui });
  const dedans = rendreMessage(veille, ctx(resa('r1'), '2026-10-25', 'https://youtu.be/entree'));
  verifier(dedans.codes && dedans.texte.includes('Boîte à clés 4821') && dedans.texte.includes('soleil2026'), 'la veille : accès et wifi dans le message');
  verifier(dedans.texte.startsWith('Bonjour Marie,') && dedans.texte.includes('16:00') && dedans.texte.endsWith('L’équipe Label Maison'), 'prénom, heure d’arrivée et signature remplacés');
  verifier(dedans.texte.includes('https://youtu.be/entree'), 'lien du guide');
  verifier(!/\{[a-z_]+\}/.test(dedans.texte), 'aucune variable laissée telle quelle');

  const tot = rendreMessage(veille, ctx(resa('r1', { arrivee: '2026-10-31', depart: '2026-11-02' }), '2026-10-25'));
  verifier(!tot.codes && !tot.texte.includes('4821') && !tot.texte.includes('soleil2026') && !tot.texte.includes('LM-Corbeil'), '6 jours avant : ni code ni wifi');
  verifier(!/Wifi/.test(tot.texte) && tot.retirees.includes('acces') && tot.retirees.includes('wifi'), 'la ligne qui contient un code est retirée entière');
  verifier(!tot.texte.includes('guide d’arrivée'), 'pas de guide : la ligne est retirée');
  verifier(tot.texte.includes('Bonjour Marie') && tot.texte.includes('L’équipe Label Maison'), 'le reste du message est gardé');
  const annule = rendreMessage(veille, ctx(resa('r1', { statut: 'annulee' }), '2026-10-25'));
  verifier(!annule.codes && !annule.texte.includes('4821'), 'réservation annulée : jamais de code');
  const parti = rendreMessage('Code : {acces}', ctx(resa('r1'), '2026-10-29'));
  verifier(parti.texte === '', 'jour du départ : plus de code');
  const sansPrenom = rendreMessage('Bonjour {prenom},\nÀ bientôt', { ...ctx(resa('r1', { voyageur: { nom: '', nbPersonnes: 1 } }), '2026-10-25'), fil: { ...fil('fil-1', 'r1'), voyageur: '' } });
  verifier(sansPrenom.texte === 'Bonjour,\nÀ bientôt', 'sans prénom : « Bonjour, »');
  verifier(rendreMessage('Ligne {inconnue}\nReste', ctx(resa('r1'), '2026-10-25')).texte === 'Reste', 'variable inconnue : ligne retirée');
  verifier(rendreMessage('Du {date_arrivee} au {date_depart}', ctx(resa('r1'), '2026-10-25')).texte === 'Du lundi 26 octobre au jeudi 29 octobre', 'dates en toutes lettres');

  // Même règle que l'agent (codesPermis).
  const cas: [Partial<Reservation>, string][] = [
    [{}, '2026-10-25'], [{}, '2026-10-23'], [{}, '2026-10-24'], [{}, '2026-10-26'], [{}, '2026-10-29'], [{ statut: 'annulee' }, '2026-10-25'],
    [{ statut: 'en_cours' }, '2026-10-27'], [{ statut: 'terminee' }, '2026-10-27'], [{ logementId: 'log-2' }, '2026-10-25'], [{ arrivee: '2026-10-27' }, '2026-10-25'],
  ];
  verifier(cas.every(([p, jour]) => codesAutorises(resa('r1', p), 'log-1', jour) === codesPermis(fil('fil-1', 'r1'), resa('r1', p), jour).ok), 'codes : même décision que l’agent dans 10 cas');
}

function signatures() {
  section('Signature par espace');
  const vide = { reglages: [] as Reglage[] };
  verifier(signatureProgrammes(vide) === 'L’équipe Label Maison', 'Label Maison : « L’équipe Label Maison »');
  verifier(signatureProgrammes(vide, 'Sens') === 'L’équipe Sens', 'autre espace : « L’équipe Sens »');
  verifier(signatureProgrammes({ reglages: [{ ...REGLAGES_AGENT_DEFAUT, signature: 'Abdel et Kamel' }] }, 'Sens') === 'Abdel et Kamel', 'signature réglée par l’espace : la sienne');
  const texte = rendreMessage('Merci,\n{signature}', { reservation: resa('r1'), logement: LOGEMENT, signature: signatureProgrammes(vide, 'Sens'), aujourdhui: '2026-10-25' }).texte;
  verifier(texte.endsWith('L’équipe Sens') && !texte.includes('Label Maison'), 'jamais le nom de Label Maison dans un autre espace');
}

function fileAvis() {
  section('Avis à déposer : file et relecture');
  const aujourdhui = '2026-10-25';
  verifier(sejourAvecAvis(resa('a', { depart: '2026-10-24' }), aujourdhui), 'Airbnb parti hier : avis attendu');
  verifier(!sejourAvecAvis(resa('a', { depart: '2026-10-25' }), aujourdhui), 'part aujourd’hui : pas encore');
  verifier(!sejourAvecAvis(resa('a', { depart: '2026-10-10' }), aujourdhui), 'parti il y a 15 jours : délai d’Airbnb passé');
  verifier(!sejourAvecAvis(resa('a', { depart: '2026-10-24', canal: 'booking' }), aujourdhui), 'Booking.com : pas d’avis sur le voyageur ici');
  verifier(!sejourAvecAvis(resa('a', { depart: '2026-10-24', statut: 'annulee' }), aujourdhui), 'annulé : pas d’avis');

  const propre = resa('p', { arrivee: '2026-10-20', depart: '2026-10-24', statut: 'terminee', voyageur: { nom: 'Lucas Martin', nbPersonnes: 2 } });
  const incident: Incident = { id: 'i1', logementId: 'log-1', reservationId: 'q', date: '2026-10-22', categorie: 'casse', gravite: 'moyenne', description: 'Vase cassé', statut: 'ouvert', refacturable: 'voyageur', preuves: [] };
  const avecIncident = resa('q', { arrivee: '2026-10-20', depart: '2026-10-23', statut: 'terminee' });
  const noteBasse = resa('n', { arrivee: '2026-10-19', depart: '2026-10-22', statut: 'terminee', noteVoyageur: 3.5 });
  const negatif = resa('g', { arrivee: '2026-10-19', depart: '2026-10-21', statut: 'terminee' });
  const fils = [fil('fil-g', 'g', { messages: [msg('x', 'voyageur', 'Les voisins se plaignent du bruit, désolé pour la fête.')] }), fil('fil-p', 'p')];
  const d = { reservations: [propre, avecIncident, noteBasse, negatif], avisADeposer: [] as AvisADeposer[], incidents: [incident], controles: [], filsMessages: fils };

  verifier(raisonsARelire(propre, d).length === 0, 'séjour sans souci : rien à relire');
  verifier(raisonsARelire(avecIncident, d)[0] === 'Un incident pendant le séjour', 'incident du séjour → à relire');
  verifier(raisonsARelire(noteBasse, d).some((x) => x.includes('3,5/5')), 'note sous 4 → à relire');
  verifier(raisonsARelire(negatif, d).includes('Un message signale un souci'), 'message négatif → à relire');
  // Voyageur : tous ses messages, avant l'arrivée compris. Équipe : de la veille de l'arrivée à la fin du délai d'Airbnb.
  // (séjour « g » : arrivée le 19, départ le 21 octobre.)
  const avecFils = (messages: Message[]) => ({ ...d, filsMessages: [fil('fil-g', 'g', { messages })] });
  const souci = (messages: Message[]) => raisonsARelire(negatif, avecFils(messages)).includes('Un message signale un souci');
  verifier(souci([msg('h', 'hote', 'Les voisins se plaignent du bruit depuis hier soir.', '2026-10-20T09:00:00+02:00')]), 'plainte des voisins écrite par l’équipe pendant le séjour : à relire');
  verifier(souci([msg('h', 'hote', 'Verre cassé et odeur de cigarette dans le salon après le départ.', '2026-10-22T11:00:00+02:00')]), 'verre cassé écrit par l’équipe après le départ : à relire');
  verifier(souci([msg('v', 'voyageur', 'Hi! Birthday party on Saturday, about 15 friends.', '2026-10-05T10:00:00+02:00')]), 'fête annoncée par le voyageur avant l’arrivée : à relire');
  verifier(!souci([msg('h', 'hote', 'Rappel : pas de fête après 22 h, merci.', '2026-10-15T10:00:00+02:00')]), 'rappel « pas de fête après 22 h » envoyé par l’équipe avant l’arrivée : ne bloque pas');
  verifier(!souci([msg('v', 'voyageur', 'Hello, we are a party of 4 non-smokers.', '2026-10-05T10:00:00+02:00')]), '« a party of 4 », « non-smokers » : rien à relire');
  verifier(souci([msg('v', 'voyageur', 'There is a lot of noise tonight.', '2026-10-18T21:00:00+02:00')]), 'bruit signalé par le voyageur : à relire');
  verifier(!souci([msg('a', 'agent', 'Pas de fête ni de bruit après 22 h, merci.', '2026-10-20T09:00:00+02:00')]), 'réponse de l’agent (règlement rappelé) : ne bloque pas');
  // Correctif d'audit 03 : l'équipe, un souci CONSTATÉ seulement ; « party of » suivi d'un nombre jusqu'à neuf.
  verifier(!souci([msg('h', 'hote', 'Rappel : pas de fête ni de bruit après 22 h, merci.', '2026-10-20T09:00:00+02:00')]), 'rappel du règlement par l’équipe pendant le séjour : ne bloque pas (pas un souci constaté)');
  verifier(!souci([msg('h', 'hote', 'Merci, la fiche de police est bien remplie.', '2026-10-19T09:00:00+02:00')]), '« fiche de police » du check-in en ligne : ne bloque pas');
  verifier(souci([msg('h', 'hote', 'La police est venue pour tapage cette nuit.', '2026-10-20T08:00:00+02:00')]), 'police venue pendant le séjour, écrit par l’équipe : à relire');
  verifier(souci([msg('h', 'hote', 'Forte odeur de cigarette dans la chambre.', '2026-10-21T12:00:00+02:00')]), 'odeur de cigarette constatée par l’équipe : à relire');
  verifier(souci([msg('v', 'voyageur', 'We will be a party of twenty people.', '2026-10-05T10:00:00+02:00')]), '« a party of twenty people » : à relire');
  verifier(!souci([msg('v', 'voyageur', 'We are a party of four, very quiet.', '2026-10-05T10:00:00+02:00')]), '« a party of four » : rien à relire');
  // Faux positifs relevés en relecture : la fiche de police, les consignes de prévention de l'équipe.
  verifier(!souci([msg('v', 'voyageur', 'J’ai rempli la fiche individuelle de police.', '2026-10-18T10:00:00+02:00')]), '« j’ai rempli la fiche de police », écrit par le voyageur : ne bloque pas');
  verifier(!souci([msg('h', 'hote', 'Bienvenue ! N’hésitez pas à nous signaler tout dégât ou souci.', '2026-10-19T15:00:00+02:00')]), '« n’hésitez pas à nous signaler tout dégât », message d’accueil : ne bloque pas');
  verifier(!souci([msg('h', 'hote', 'En cas de casse, merci de nous prévenir.', '2026-10-19T15:00:00+02:00')]), '« en cas de casse, merci de nous prévenir » : ne bloque pas');
  verifier(souci([msg('h', 'hote', 'En cas de doute, appelez-nous : nous avons trouvé un verre cassé.', '2026-10-21T12:00:00+02:00')]), 'tournure « en cas de » suivie d’un vrai constat (verre cassé) : à relire');
  verifier(souci([msg('v', 'voyageur', 'La police est venue cette nuit, j’ai aussi rempli la fiche de police.', '2026-10-20T08:00:00+02:00')]), 'police venue, en plus de la fiche de police, écrit par le voyageur : à relire');
  // Une consigne de prévention n'efface jamais le constat qui la suit dans la même phrase.
  for (const t of [
    'Merci de nous indiquer ce qui s’est passé : nous avons trouvé un verre cassé.',
    'Merci de nous prévenir quand vous partez, les voisins se plaignent du bruit.',
    'N’hésitez pas à nous signaler tout souci, nous avons déjà eu une plainte des voisins hier.',
    'En cas de nouveau tapage cette nuit nous appellerons la police',
    'Merci de nous signaler les dégâts que vous avez causés.',
  ])
    verifier(souci([msg('h', 'hote', t, '2026-10-20T09:00:00+02:00')]), `consigne suivie d’un constat, écrit par l’équipe : à relire (« ${t} »)`);
  verifier(!souci([msg('h', 'hote', 'En cas de souci ou de dégât, prévenez-nous.', '2026-10-19T15:00:00+02:00')]), '« en cas de souci ou de dégât, prévenez-nous » : ne bloque pas');
  // Constats que l'équipe peut écrire autrement.
  for (const t of ['Les voisins se sont plaints du bruit hier soir.', 'Vous avez fumé dans le logement, c’est interdit.', 'La vitre est brisée.', 'Le canapé est taché.'])
    verifier(souci([msg('h', 'hote', t, '2026-10-21T12:00:00+02:00')]), `constat de l’équipe : à relire (« ${t} »)`);
  const sansReservation: Incident = { ...incident, id: 'i2', reservationId: undefined, date: '2026-10-21' };
  verifier(raisonsARelire(propre, { ...d, incidents: [sansReservation] }).length === 1, 'incident du logement pendant le séjour → à relire');
  verifier(raisonsARelire(propre, { ...d, incidents: [{ ...sansReservation, date: '2026-10-10' }] }).length === 0, 'incident d’avant le séjour : sans effet');
  verifier(raisonsARelire(propre, { ...d, filsMessages: [fil('fil-p', 'p', { raisonEscalade: 'litige' })] }).length === 1, 'conversation transmise pour un litige → à relire');

  const file = avisATraiter(d, aujourdhui);
  verifier(file.length === 4, '4 séjours à traiter');
  verifier(file.find((x) => x.reservation.id === 'q')?.statut === 'a_relire', 'incident : « à relire », jamais « prêt »');
  verifier(file.find((x) => x.reservation.id === 'p')?.statut === 'a_rediger' && file.find((x) => x.reservation.id === 'p')?.texte === texteAvisParDefaut('Lucas'), 'pas encore préparé : texte simple proposé');
  const pretMaisIncident: AvisADeposer = { id: 'q', reservationId: 'q', logementId: 'log-1', voyageur: 'Marie', depart: '2026-10-23', canal: 'airbnb', statut: 'pret', texte: 'Parfait', creeLe: '2026-10-24T09:00:00+02:00' };
  verifier(etatAvis({ ...d, avisADeposer: [pretMaisIncident] }, avecIncident, aujourdhui)?.statut === 'a_relire', 'enregistré « prêt » mais incident depuis : présenté « à relire »');
  const fait: AvisADeposer = { ...pretMaisIncident, id: 'p', reservationId: 'p', statut: 'fait' };
  verifier(avisATraiter({ ...d, avisADeposer: [fait] }, aujourdhui).length === 3, 'un avis fait sort de la file');
  verifier(etatAvis({ ...d, avisADeposer: [fait] }, propre, '2026-11-20')?.statut === 'fait', 'après le délai, un avis fait reste visible sur le séjour');
  verifier(avisAPreparer({ ...d, avisADeposer: [fait] }, aujourdhui).length === 3, 'le serveur ne prépare que les séjours sans avis');
  verifier(file[0].reservation.depart <= file[file.length - 1].reservation.depart, 'le délai le plus court d’abord');

  // À relire : jamais d'éloge prérempli (texte simple, ou éloge écrit avant que le souci soit connu).
  const relireSansTexte = file.find((x) => x.reservation.id === 'q');
  verifier(
    relireSansTexte?.texte === '' && relireSansTexte.aide === 'Écrivez l’avis vous-même : il y a eu un incident pendant ce séjour.',
    'incident, pas encore préparé : aucun texte proposé, une ligne dit d’écrire l’avis soi-même',
  );
  verifier(contientEloge(texteAvisParDefaut('Lucas')) && !contientEloge('Lucas a séjourné du 20 au 23 octobre.'), 'le texte simple est un éloge ; un texte factuel n’en est pas un');
  const elogeModele: AvisADeposer = { ...pretMaisIncident, statut: 'a_relire', texte: texteAvisParDefaut('Marie'), source: 'modele', raisons: ['Un incident pendant le séjour'] };
  verifier(etatAvis({ ...d, avisADeposer: [elogeModele] }, avecIncident, aujourdhui)?.texte === '', 'à relire avec le texte simple enregistré (IA indisponible) : texte retiré, jamais d’éloge');
  const elogeAvant: AvisADeposer = { ...pretMaisIncident, texte: 'Marie a été une voyageuse respectueuse, logement rendu en bon état.', source: 'ia' };
  verifier(etatAvis({ ...d, avisADeposer: [elogeAvant] }, avecIncident, aujourdhui)?.texte === '', 'avis de l’IA écrit avant l’incident : retiré');
  const neutreIA: AvisADeposer = { ...pretMaisIncident, statut: 'a_relire', texte: 'Marie a séjourné trois nuits dans le logement.', source: 'ia', raisons: ['Un incident pendant le séjour'] };
  verifier(etatAvis({ ...d, avisADeposer: [neutreIA] }, avecIncident, aujourdhui)?.texte === neutreIA.texte, 'avis neutre de l’IA rédigé en connaissant l’incident : gardé');
  const equipe: AvisADeposer = { ...elogeModele, texte: 'Texte écrit par l’équipe.', source: 'equipe' };
  verifier(etatAvis({ ...d, avisADeposer: [equipe] }, avecIncident, aujourdhui)?.texte === equipe.texte, 'texte écrit par l’équipe : toujours gardé');
  verifier(etatAvis(d, noteBasse, aujourdhui)?.aide === 'Écrivez l’avis vous-même : le voyageur a laissé une note basse.', 'note basse : la ligne le dit');
  // Séjour sans souci, avis de l'IA avec un chiffre : alerte de forme seulement, le texte (même élogieux) reste montré, à relire.
  const forme: AvisADeposer = { id: 'p', reservationId: 'p', logementId: 'log-1', voyageur: 'Lucas', depart: '2026-10-24', canal: 'airbnb', statut: 'a_relire', texte: 'Lucas a été parfait pendant ses 4 nuits.', source: 'ia', raisons: [ALERTE_FORME_AVIS], creeLe: '2026-10-25T09:00:00+02:00' };
  const etatForme = etatAvis({ ...d, avisADeposer: [forme] }, propre, aujourdhui);
  verifier(
    etatForme?.statut === 'a_relire' && etatForme.texte === forme.texte && !etatForme.aide && etatForme.raisons.join() === ALERTE_FORME_AVIS,
    'séjour sans souci, chiffre dans l’avis : texte gardé avec l’alerte de forme, jamais « écrivez l’avis vous-même »',
  );
  verifier(soucisDuSejour([ALERTE_FORME_AVIS, 'Un incident pendant le séjour']).join() === 'Un incident pendant le séjour', 'l’alerte de forme n’est pas un souci du séjour');
  verifier(/AUCUN éloge/.test(consignesAvis('Label Maison')), 'consignes de l’IA : aucun éloge quand un souci est signalé');
  const ctx = contexteAvis(avecIncident, undefined, [], ['Un incident pendant le séjour']);
  verifier(/Points signalés par l'équipe : Un incident pendant le séjour/.test(ctx) && /sans aucun éloge/.test(ctx), 'contexte donné à l’IA : l’incident, et « sans aucun éloge »');
  verifier(!/sans aucun éloge/.test(contexteAvis(propre, undefined, [], [])), 'séjour sans souci : pas de consigne de neutralité');

  const lu = lireAvisIA({ content: [{ type: 'text', text: '{"texte":"Lucas a été parfait.","a_relire":false,"raison":""}' }], stop_reason: 'end_turn' });
  verifier(lu?.texte === 'Lucas a été parfait.' && lu.aRelire === false, 'réponse de l’IA lue');
  verifier(lireAvisIA({ content: [{ type: 'text', text: 'pas du JSON' }], stop_reason: 'end_turn' }) === null && lireAvisIA({ content: [], stop_reason: 'refusal' }) === null, 'réponse illisible ou refus : ignorée');
}

function apercu() {
  section('Écran : prochain envoi');
  const reglages = reglagesAllumes(['veille_arrivee']);
  const d = { reservations: [resa('r1'), resa('r2', { arrivee: '2026-10-27', depart: '2026-10-30' })], filsMessages: [fil('fil-1', 'r1'), fil('fil-2', 'r2')], envoisProgrammes: [] as EnvoiProgramme[] };
  const p = prochainEnvoi(d, reglages, 'veille_arrivee', paris('2026-10-25T10:00:00Z'));
  verifier(p?.reservation.id === 'r1' && p.quand === Date.parse('2026-10-25T17:00:00Z'), 'prochain envoi : la veille de la prochaine arrivée, 18:00');
  const deja = prochainEnvoi({ ...d, envoisProgrammes: [{ id: idEnvoi('r1', 'veille_arrivee'), reservationId: 'r1', logementId: 'log-1', declencheur: 'veille_arrivee', voyageur: 'Marie', statut: 'envoye', le: '' }] }, reglages, 'veille_arrivee', paris('2026-10-25T10:00:00Z'));
  verifier(deja?.reservation.id === 'r2', 'déjà envoyé : le suivant');
  verifier(prochainEnvoi(d, reglagesProgrammes({ reglages: [] }), 'veille_arrivee', paris('2026-10-25T10:00:00Z')) === null, 'éteint : pas de prochain envoi');
}

function repriseReverifiee() {
  section('Reprise d’un envoi « en cours » : tout est revérifié');
  const reglages = reglagesAllumes(['veille_arrivee']);
  const texte = 'Bonjour Marie, Boîte à clés 4821, wifi soleil2026';
  const ligne = (p: Partial<EnvoiProgramme> = {}): EnvoiProgramme => ({
    id: idEnvoi('r1', 'veille_arrivee'), reservationId: 'r1', logementId: 'log-1', declencheur: 'veille_arrivee', voyageur: 'Marie', statut: 'en_cours',
    le: '2026-10-25T18:31:00+01:00', depuis: '2026-10-25T18:31:00+01:00', texte, cle: cleEnvoiProgramme('r1', 'veille_arrivee'), filId: 'fil-1', ...p,
  });
  // logement null : inconnu (undefined prendrait la valeur par défaut).
  const d = (r: Reservation, iso: string, p: Partial<EnvoiProgramme> = {}, fils = [fil('fil-1', 'r1')], logement: Logement | null = LOGEMENT) =>
    deciderEnvoi({ declencheur: 'veille_arrivee', reservation: r, reglages, fils, envoi: ligne(p), maintenant: paris(iso), logement: logement ?? undefined });
  const annulee = d(resa('r1', { statut: 'annulee' }), '2026-10-25T18:00:00Z');
  verifier(annulee.genre === 'verifier' && annulee.raison === RAISONS.repriseAnnulee, 'séjour annulé entre-temps : « à vérifier », rien ne repart (codes compris)');
  const deplacee = d(resa('r1', { arrivee: '2026-11-05', depart: '2026-11-08' }), '2026-10-25T18:00:00Z');
  verifier(deplacee.genre === 'verifier' && deplacee.raison === RAISONS.repriseCodes, 'arrivée repoussée de 10 jours, texte avec codes : « à vérifier »');
  const sansCode = d(resa('r1', { arrivee: '2026-11-05', depart: '2026-11-08' }), '2026-10-25T18:00:00Z', { texte: 'Bonjour Marie, à bientôt.' });
  verifier(sansCode.genre === 'reprendre', 'arrivée repoussée, texte sans code : repris');
  verifier(d(resa('r1', { arrivee: '2026-11-05', depart: '2026-11-08' }), '2026-10-25T18:00:00Z', { texte: 'Bonjour' }, [fil('fil-1', 'r1')], null).genre === 'verifier', 'logement inconnu et codes plus permis : on ne peut pas savoir, « à vérifier »');
  const nuit = d(resa('r1'), '2026-10-25T22:30:00Z');
  verifier(nuit.genre === 'attendre' && nuit.raison === RAISONS.horsHeures, 'reprise à 23:30 : attend 8 h');
  verifier(d(resa('r1'), '2026-10-26T07:05:00Z').genre === 'reprendre', '08:05 le lendemain : reprise (codes encore permis)');
  const autreFil = d(resa('r1'), '2026-10-25T18:00:00Z', { filId: 'fil-9' }, [fil('fil-1', 'r1'), fil('fil-9', 'r9')]);
  verifier(autreFil.genre === 'verifier' && autreFil.raison === RAISONS.repriseConversation, 'ligne qui vise la conversation d’un autre séjour : « à vérifier »');
  verifier(d(resa('r1'), '2026-10-25T18:00:00Z', { texte: '' }).genre === 'verifier', 'ligne « en cours » sans texte : « à vérifier »');
  // Le voyageur attend l'équipe depuis le premier essai : rien ne repart.
  const transmise = d(resa('r1'), '2026-10-25T18:00:00Z', {}, [fil('fil-1', 'r1', { statut: 'escalade', traitePar: 'en_attente', messages: [msg('m1', 'voyageur', 'Le chauffage ne marche pas.'), msg('m2', 'agent', 'Je transmets à l’équipe.')] })]);
  verifier(transmise.genre === 'attendre' && transmise.raison === RAISONS.attend, 'reprise : conversation transmise à l’équipe, rien ne repart');
  const aEcrit = d(resa('r1'), '2026-10-25T18:00:00Z', {}, [fil('fil-1', 'r1', { messages: [msg('m1', 'voyageur', 'On arrive vers 20 h, c’est possible ?')] })]);
  verifier(aEcrit.genre === 'attendre' && aEcrit.raison === RAISONS.attend, 'reprise : le voyageur a écrit en dernier, rien ne repart');
}

function codesEnDur() {
  section('Codes écrits en dur dans un modèle');
  const ctx = (r: Reservation, aujourdhui: string) => ({ reservation: r, logement: LOGEMENT, fil: fil('fil-1', r.id), signature: 'L’équipe Label Maison', aujourdhui });
  const tot = rendreMessage('Bonjour {prenom}, le code est 4821.', ctx(resa('r1', { arrivee: '2026-11-10', depart: '2026-11-12' }), '2026-10-25'));
  verifier(tot.codesEnClair && !tot.codes, '15 jours avant, code en dur : refusé (codesEnClair)');
  verifier(!rendreMessage('Bonjour {prenom}, le code est 4821.', ctx(resa('r1'), '2026-10-25')).codesEnClair, 'la veille : permis');
  verifier(!rendreMessage('Bonjour {prenom}, à bientôt.', ctx(resa('r1', { arrivee: '2026-11-10', depart: '2026-11-12' }), '2026-10-25')).codesEnClair, 'sans code : rien à signaler');

  // Éditeur : l'avertissement ne dépend pas du séjour choisi pour l'aperçu.
  verifier(
    momentHorsFenetreCodes('confirmation') && momentHorsFenetreCodes('jour_depart') && momentHorsFenetreCodes('demande_avis') && !momentHorsFenetreCodes('veille_arrivee'),
    'moments qui partent hors de la fenêtre des codes : confirmation, départ, avis ; pas les infos d’arrivée',
  );
  verifier(secretEcritDansModele('Le code est 4821.', undefined, [LOGEMENT]) && secretEcritDansModele('Wifi : soleil2026', undefined, [LOGEMENT]), 'code ou wifi d’un logement écrit dans le modèle : repéré');
  verifier(!secretEcritDansModele('Bonjour {prenom}, {acces}', undefined, [LOGEMENT]), 'variables « Accès et clés » et « Wifi » : rien à signaler');
  {
    // Serrure connectée, « code par séjour » : les textes par défaut ne portent aucun secret (« départ », « à partir de »).
    const parSejour = { ...LOGEMENT, fiche: { ...LOGEMENT.fiche, acces: 'Serrure connectée, code par séjour.' } };
    verifier(
      !secretEcritDansModele(TEXTES_DEFAUT.confirmation, undefined, [parSejour]) && !secretEcritDansModele(TEXTES_DEFAUT.jour_depart, undefined, [parSejour]),
      '« code par séjour » : « Merci pour la réservation » et « Rappel du départ » sans alerte',
    );
    verifier(secretEcritDansModele('Le code est 4821.', undefined, [{ ...LOGEMENT, fiche: { ...LOGEMENT.fiche, acces: 'Boîte à clés, code 4821.' } }]), 'un vrai code reste repéré');
  }
  verifier(
    secretEcritDansModele('Bonjour.', { 'log-1': { texte: 'Code 4821' } }, [LOGEMENT]) &&
      !secretEcritDansModele('Code 4821', { 'log-1': { actif: false } }, [LOGEMENT]) &&
      !secretEcritDansModele('Code 4821', undefined, [{ ...LOGEMENT, statut: 'sorti' }]),
    'texte propre au logement pris en compte ; logement sans message ou sorti : ignoré',
  );
  verifier(!/la veille/.test(TEXTES_DEFAUT.confirmation) && /informations d’arrivée avant votre séjour/.test(TEXTES_DEFAUT.confirmation), 'merci pour la réservation : ne promet pas un envoi la veille (infos d’arrivée peut-être éteint)');

  // Aperçu : seulement les séjours qui recevront le message.
  const direct = resa('d1', { canal: 'direct', arrivee: '2026-10-27', depart: '2026-10-29' });
  const directAvecConversation = resa('d2', { canal: 'direct', arrivee: '2026-10-28', depart: '2026-10-30' });
  const airbnb = resa('a1', { arrivee: '2026-10-29', depart: '2026-10-31' });
  const proposes = sejoursPourApercu([direct, directAvecConversation, airbnb], 'confirmation', '2026-10-25', [fil('fil-d2', 'd2')]).map((r) => r.id);
  verifier(proposes.join() === 'd2,a1', `aperçu : pas de réservation directe sans conversation de plateforme (${proposes.join()})`);
  verifier(!sejourJoignable(direct, []) && sejourJoignable(resa('b', { canal: 'booking' })), 'Airbnb et Booking.com joignables, réservation directe saisie dans l’ERP non');
}

function libelles() {
  section('Variables : libellés à l’écran, clés en base');
  const affiches = DECLENCHEURS.map((k) => texteAffiche(TEXTES_DEFAUT[k]));
  verifier(affiches.every((t) => !/\{[a-z_]+\}/.test(t)), 'textes par défaut : aucun nom technique à l’écran');
  const veille = affiches[DECLENCHEURS.indexOf('veille_arrivee')];
  verifier(veille.includes('{Heure d’arrivée}') && veille.includes('{Prénom}') && veille.includes('{Lien du livret}') && !veille.includes('{Lien du guide}'), 'libellés des pastilles (« {Prénom} », « {Heure d’arrivée} », « {Lien du livret} »)');
  verifier(texteStocke('Guide : {Lien du guide}') === 'Guide : {lien_guide}', '« {Lien du guide} » reste une variable, à ajouter à la main');
  verifier(DECLENCHEURS.every((k) => texteStocke(texteAffiche(TEXTES_DEFAUT[k])) === TEXTES_DEFAUT[k]), 'aller-retour écran → base sans perte');
  verifier(VARIABLES.every((v) => texteStocke(texteAffiche(`{${v.cle}}`)) === `{${v.cle}}`), 'aller-retour pour chaque variable');
  verifier(texteStocke('{Date d\'arrivée} et {DATE D’ARRIVEE} et {prenom}') === '{date_arrivee} et {date_arrivee} et {prenom}', 'apostrophe droite, majuscules, ancienne clé : acceptés');
  verifier(texteStocke('{Prénomm}') === '{Prénomm}' && texteAffiche('{inconnue}') === '{inconnue}', 'variable inconnue : laissée telle quelle');
  const ctx = { reservation: resa('r1', { voyageur: { nom: '{Logement}', nbPersonnes: 1 } }), logement: LOGEMENT, signature: 'L’équipe', aujourdhui: '2026-10-25' };
  verifier(rendreMessage('Bonjour {prenom},', ctx).texte === 'Bonjour {Logement},', 'voyageur nommé comme une variable : son nom tel quel, jamais remplacé');
  verifier(rendreMessage(texteStocke('Bonjour {Prénom}, {Logement}'), { ...ctx, reservation: resa('r1') }).texte === 'Bonjour Marie, Corbeil Rives de Seine', 'texte de l’écran : envoyé avec les vraies valeurs');
  verifier(rendreMessage('Bonjour {Prénom}', { ...ctx, reservation: resa('r1') }).texte === 'Bonjour Marie', 'un libellé arrivé tel quel en base est compris');
  verifier(rendreMessage('Ligne {Prénomm}\nReste', { ...ctx, reservation: resa('r1') }).texte === 'Reste', 'libellé mal tapé : la ligne est retirée (jamais d’accolades chez le voyageur)');
}

function alertesAvis() {
  section('Avis préparés par l’IA : à relire s’ils contiennent un lien, une adresse, un chiffre, un e-mail');
  verifier(alerteTexteAvis('Lucas a été un voyageur parfait.') === null, 'texte simple : rien à signaler');
  verifier(
    ['Voir https://exemple.fr', 'Écrivez à lucas@exemple.fr', 'Le code 482 marchait', 'Au 12 rue de la Paix', 'Voir www.site.com', 'Voir monsite.fr', 'Payé 120 euros', 'Il a laissé 3 serviettes'].every((t) => alerteTexteAvis(t) !== null),
    'lien, e-mail, chiffre (code, prix, nombre sans unité), adresse avec numéro : à relire',
  );
  // Faux positifs d'avant (octobre 2026) : « place », « sur place », « au cours de », « 3 nuits ».
  const sansSouci = ['Lucas left the place spotless.', 'He took great care of our place.', 'Tout était parfait sur place.', 'Au cours de son séjour, tout s’est bien passé.', 'Merci pour ces 3 nuits.', 'A party of 4 guests, 5 stars.', 'Un séjour de 2 semaines, 12 voyageurs.'];
  verifier(sansSouci.every((t) => alerteTexteAvis(t) === null), `« place », « sur place », « au cours de », « 3 nuits », « 4 guests » : rien à signaler ${JSON.stringify(sansSouci.filter((t) => alerteTexteAvis(t) !== null))}`);
  verifier(
    ['Digicode 12 personnes', 'Le code 99 nuits', 'Boîte à clés : 3 nuits', 'Wifi 12 personnes'].every((t) => alerteTexteAvis(t) !== null) && alerteTexteAvis('Merci pour ces 3 nuits.') === null,
    'mot de code ou d’accès dans le texte : aucun chiffre permis, même suivi d’une unité (« digicode 12 personnes », « code 99 nuits »)',
  );
  verifier(alerteTexteAvis('Logement rue de la Gare, très calme.', { adresse: '12 rue de la Gare, 91100 Corbeil-Essonnes' }) !== null && alerteTexteAvis('Logement rue de la Paix, très calme.', { adresse: '12 rue de la Gare, 91100 Corbeil-Essonnes' }) === null, 'la rue du logement (sans numéro) : à relire ; une autre rue sans numéro : non');
}

/* ==================================================== passage simulé */

class FausseBase {
  lignes = new Map<string, { collection: string; id: string; donnees: unknown; maj: number }>();
  private n = 0;
  cle = (c: string, id: string) => `${c}\u0000${id}`;
  echoue?: (collection: string) => boolean;
  /** Juste avant de répondre à une lecture (pour changer une ligne entre deux lectures). */
  avantLecture?: (collection: string, ids: Set<string> | null) => void;
  /** Lecture en panne (500). */
  lectureEchoue?: (collection: string, ids: Set<string> | null) => boolean;

  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    const methode = (init?.method ?? 'GET').toUpperCase();
    const eq = (k: string) => (url.searchParams.get(k) ?? '').replace(/^eq\./, '');
    if (methode === 'GET') {
      const collection = eq('collection');
      const filtre = url.searchParams.get('id');
      const ids = filtre ? new Set(filtre.replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''))) : null;
      if (this.lectureEchoue?.(collection, ids)) return new Response('panne', { status: 500 });
      this.avantLecture?.(collection, ids);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return json(
        [...this.lignes.values()]
          .filter((l) => l.collection === collection && (!ids || ids.has(l.id)))
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(offset, offset + 1000)
          .map((l) => ({ id: l.id, donnees: JSON.parse(JSON.stringify(l.donnees)), maj_le: String(l.maj) })),
      );
    }
    if (methode === 'PATCH') {
      const l = this.lignes.get(this.cle(eq('collection'), eq('id')));
      if (!l || String(l.maj) !== eq('maj_le')) return json([]);
      l.donnees = JSON.parse(JSON.stringify((JSON.parse(String(init?.body)) as { donnees: unknown }).donnees));
      l.maj = ++this.n;
      return json([{ id: l.id }]);
    }
    const lot = JSON.parse(String(init?.body)) as { collection: string; id: string; donnees: unknown }[];
    if (lot.some((l) => this.echoue?.(l.collection))) return new Response('panne', { status: 500 });
    // ajouterSiAbsent : les lignes déjà là ne bougent pas, seules les ajoutées reviennent.
    if (/ignore-duplicates/.test(new Headers(init?.headers).get('prefer') ?? '')) {
      const ajoutees = lot.filter((l) => !this.lignes.has(this.cle(l.collection, l.id)));
      for (const l of ajoutees) this.lignes.set(this.cle(l.collection, l.id), { collection: l.collection, id: l.id, donnees: JSON.parse(JSON.stringify(l.donnees)), maj: ++this.n });
      return json(ajoutees.map((l) => ({ id: l.id })));
    }
    for (const l of lot) this.lignes.set(this.cle(l.collection, l.id), { collection: l.collection, id: l.id, donnees: JSON.parse(JSON.stringify(l.donnees)), maj: ++this.n });
    return new Response(null, { status: 201 });
  };

  get<T>(c: string, id: string): T | undefined {
    return this.lignes.get(this.cle(c, id))?.donnees as T | undefined;
  }
  collection<T>(c: string): T[] {
    return [...this.lignes.values()].filter((l) => l.collection === c).map((l) => l.donnees as T);
  }
  poser<T extends { id: string }>(c: string, e: T) {
    this.lignes.set(this.cle(c, e.id), { collection: c, id: e.id, donnees: JSON.parse(JSON.stringify(e)), maj: ++this.n });
  }
}

class FauxRepull {
  appels: { chemin: string; methode: string; cle: string | null; corps?: unknown }[] = [];
  envois: { conversation: string; message: string; cle: string }[] = [];
  idempotence = new Map<string, { charge: string; reponse: Record<string, unknown> }>();
  coupure = false;
  refus = false;

  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    const h = new Headers(init?.headers);
    if (h.get('authorization') !== 'Bearer sk_test_auto') return json({ error: { code: 'unauthorized' } }, 401);
    const methode = (init?.method ?? 'GET').toUpperCase();
    const cle = h.get('idempotency-key');
    const corps = init?.body ? JSON.parse(String(init.body)) : undefined;
    this.appels.push({ chemin: url.pathname, methode, cle, corps });
    const m = /^\/v1\/conversations\/([^/]+)\/messages$/.exec(url.pathname);
    if (m && methode === 'POST') {
      if (this.refus) return json({ error: { code: 'message_not_sent', message: 'blocked' } }, 422);
      const charge = JSON.stringify(corps);
      const deja = cle ? this.idempotence.get(cle) : undefined;
      if (deja && this.coupure) throw new TypeError('fetch failed');
      if (deja) return deja.charge === charge ? json(deja.reponse) : json({ error: { code: 'idempotency_key_reused', message: 'reused' } }, 422);
      const id = String(700000 + this.envois.length);
      const reponse = { id, conversationId: Number(m[1]), channel: 'airbnb', status: 'sent', contentRewritten: false, deliveredContent: (corps as { message: string }).message };
      this.envois.push({ conversation: m[1], message: (corps as { message: string }).message, cle: cle ?? '' });
      if (cle) this.idempotence.set(cle, { charge, reponse });
      if (this.coupure) throw new TypeError('fetch failed');
      return json(reponse);
    }
    return json({ error: { code: 'not_found', message: url.pathname } }, 404);
  };
}

class FausseIA implements ClientIA {
  appels: Anthropic.MessageCreateParamsNonStreaming[] = [];
  reponses: ({ texte: string; a_relire: boolean; raison: string } | Error)[] = [];
  messages = {
    create: async (p: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> => {
      this.appels.push(p);
      const r = this.reponses.shift() ?? { texte: 'Voyageur agréable et respectueux.', a_relire: false, raison: '' };
      if (r instanceof Error) throw r;
      return {
        id: 'msg_test', type: 'message', role: 'assistant', model: p.model,
        content: [{ type: 'text', text: JSON.stringify(r), citations: null }],
        stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 800, output_tokens: 80 },
      } as unknown as Anthropic.Message;
    },
  };
}

async function passageSimule() {
  section('Passage serveur simulé (fausse base, fausse plateforme, faux Claude)');
  const base = new FausseBase();
  const repull = new FauxRepull();
  const ia = new FausseIA();
  let horloge = paris('2026-10-25T17:30:00Z'); // 18:30 à Paris, la veille de l'arrivée
  const options = (extra: Partial<OptionsProgrammes> = {}): OptionsProgrammes => ({
    cle: 'sk_test_auto',
    base: new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: base.fetch as typeof fetch, jeton: async () => 'jeton' }),
    echeance: Date.now() + 50_000,
    budgetMois: 400,
    fetch: repull.fetch as typeof fetch,
    attendre: async () => undefined,
    maintenant: () => horloge,
    ia,
    ...extra,
  });
  const reglages = (r: ReglagesMessagesProgrammes) => base.poser('reglages', r);
  const envoi = (rid: string, k: DeclencheurMessage) => base.get<EnvoiProgramme>(COLLECTION_ENVOIS_PROGRAMMES, idEnvoi(rid, k));
  const postsMessages = () => repull.appels.filter((a) => a.methode === 'POST').length;

  base.poser('logements', LOGEMENT);
  base.poser('reglages', { ...REGLAGES_AGENT_DEFAUT, actif: true });
  for (const r of [resa('r1'), resa('r2', { statut: 'annulee' }), resa('r3'), resa('r4', { canal: 'booking' }), resa('r5')]) base.poser('reservations', r);
  base.poser('filsMessages', fil('fil-1', 'r1'));
  base.poser('filsMessages', fil('fil-4', 'r4', { repull: undefined, canal: 'booking' }));
  base.poser('filsMessages', fil('fil-5', 'r5', { messages: [msg('q', 'voyageur', 'Il y a un parking ?', '2026-10-25T18:20:00+01:00')], traitePar: 'en_attente', dernierMessageLe: '2026-10-25T18:20:00+01:00' }));

  // Éteint : rien du tout.
  let b = await lancerProgrammes(options());
  verifier(b.statut === 'fait' && b.envoyes === 0 && postsMessages() === 0, 'tout éteint : aucun envoi');
  verifier(!base.collection(COLLECTION_ENVOIS_PROGRAMMES).length, 'tout éteint : aucune ligne écrite');

  reglages(reglagesAllumes(['veille_arrivee'], ALLUME_LE, avecLienGuide));
  b = await lancerProgrammes(options());
  verifier(b.envoyes === 1 && repull.envois.length === 1, 'la veille à 18:30 : un message part');
  verifier(repull.envois[0]?.conversation === '1' && repull.envois[0]?.cle === 'lm-auto-r1-veille_arrivee', 'par la conversation du séjour, avec la clé du séjour et du moment');
  const parti = repull.envois[0]?.message ?? '';
  verifier(parti.startsWith('Bonjour Marie,') && parti.includes('4821') && parti.includes('soleil2026') && parti.includes('https://youtu.be/entree') && parti.endsWith('L’équipe Label Maison'), 'texte complet : prénom, accès, wifi, guide d’accès, signature');
  verifier(envoi('r1', 'veille_arrivee')?.statut === 'envoye' && !!envoi('r1', 'veille_arrivee')?.envoyeLe, 'ligne « envoyé » dans l’historique');
  verifier(!envoi('r1', 'veille_arrivee')?.texte, 'une fois envoyé, le texte (codes compris) n’est gardé que dans la conversation');
  const f1 = base.get<FilMessages>('filsMessages', 'fil-1')!;
  const dernier = f1.messages[f1.messages.length - 1];
  verifier(dernier?.auteur === 'hote' && dernier.envoi?.par === PAR_MESSAGE_AUTO, 'le message est dans la conversation, « par Message automatique »');
  verifier(f1.traitePar === 'agent' && f1.statut === 'ouvert', 'la conversation reste à l’agent (rien ne change de main)');
  verifier(envoi('r2', 'veille_arrivee')?.statut === 'ignore' && envoi('r2', 'veille_arrivee')?.raison === RAISONS.annulee, 'annulée : notée « pas envoyé »');
  verifier(!envoi('r3', 'veille_arrivee') && !envoi('r5', 'veille_arrivee'), 'sans conversation ou voyageur qui attend : rien d’écrit, nouvel essai plus tard');
  verifier(envoi('r4', 'veille_arrivee')?.statut === 'ignore' && envoi('r4', 'veille_arrivee')?.raison === RAISONS.horsPlateforme, 'hors plateforme : noté');
  verifier(envoi('r4', 'veille_arrivee')?.filId === 'fil-4' && envoi('r2', 'veille_arrivee')?.filId === undefined, 'ligne « pas envoyé » : mène à la conversation du séjour quand il en a une');
  verifier(base.collection<{ action: string; auteur: string }>('journal').some((j) => j.auteur === PAR_MESSAGE_AUTO && j.action === 'Message envoyé au voyageur'), 'journal : l’envoi est tracé');

  // Jamais deux fois.
  horloge = paris('2026-10-25T18:00:00Z');
  b = await lancerProgrammes(options());
  verifier(repull.envois.length === 1 && b.envoyes === 0, 'second passage : rien ne repart');

  // Course : la conversation change entre le plan et l'envoi (relue juste avant) ; illisible : rien ne part non plus.
  base.poser('reservations', resa('r20', { voyageur: { nom: 'Rose Martin', nbPersonnes: 2 } }));
  base.poser('filsMessages', fil('fil-20', 'r20'));
  base.avantLecture = (collection, ids) => {
    if (collection === 'filsMessages' && ids?.has('fil-20')) {
      base.poser('filsMessages', fil('fil-20', 'r20', { statut: 'escalade', traitePar: 'en_attente', messages: [msg('c1', 'voyageur', 'La porte ne s’ouvre pas !'), msg('c2', 'agent', 'Je préviens l’équipe tout de suite.')] }));
    }
  };
  b = await lancerProgrammes(options());
  base.avantLecture = undefined;
  verifier(repull.envois.length === 1 && !envoi('r20', 'veille_arrivee') && b.reportes >= 1, 'transmise à l’équipe entre le plan et l’envoi : rien ne part, nouvel essai plus tard');
  base.poser('reservations', resa('r21', { voyageur: { nom: 'Yann Le Gall', nbPersonnes: 1 } }));
  base.poser('filsMessages', fil('fil-21', 'r21'));
  base.lectureEchoue = (collection, ids) => collection === 'filsMessages' && !!ids?.has('fil-21');
  b = await lancerProgrammes(options());
  base.lectureEchoue = undefined;
  verifier(repull.envois.length === 1 && !envoi('r21', 'veille_arrivee'), 'conversation illisible juste avant l’envoi : rien ne part');
  b = await lancerProgrammes(options());
  verifier(repull.envois.length === 2 && envoi('r21', 'veille_arrivee')?.statut === 'envoye' && !envoi('r20', 'veille_arrivee'), 'relisible ensuite : le message part ; la conversation transmise attend toujours');

  // Coupure : le message part mais la réponse se perd ; repris avec la même clé, jamais doublé.
  base.poser('reservations', resa('r6', { voyageur: { nom: 'Paul Leroy', nbPersonnes: 1 } }));
  base.poser('filsMessages', fil('fil-6', 'r6'));
  repull.coupure = true;
  b = await lancerProgrammes(options());
  verifier(envoi('r6', 'veille_arrivee')?.statut === 'en_cours', 'coupure : ligne laissée « en cours »');
  repull.coupure = false;
  horloge = paris('2026-10-25T18:30:00Z');
  b = await lancerProgrammes(options());
  verifier(repull.envois.filter((e) => e.conversation === '6').length === 1, 'reprise : la plateforme rejoue, un seul message pour le voyageur');
  verifier(envoi('r6', 'veille_arrivee')?.statut === 'envoye', 'reprise : ligne « envoyé »');

  // La marque ne s'écrit pas : rien ne part.
  base.poser('reservations', resa('r8', { voyageur: { nom: 'Zoé', nbPersonnes: 1 } }));
  base.poser('filsMessages', fil('fil-8', 'r8'));
  base.echoue = (c) => c === COLLECTION_ENVOIS_PROGRAMMES;
  const avant = repull.envois.length;
  b = await lancerProgrammes(options());
  verifier(repull.envois.length === avant && b.erreurs.length > 0, 'base en panne avant l’envoi : rien ne part');
  base.echoue = undefined;

  // Refus net de la plateforme : échec noté, pas de nouvel essai.
  repull.refus = true;
  b = await lancerProgrammes(options());
  verifier(envoi('r8', 'veille_arrivee')?.statut === 'echec' && b.echecs === 1, 'refus de la plateforme : « échec » noté');
  repull.refus = false;
  const appelsAvant = repull.appels.length;
  await lancerProgrammes(options());
  verifier(repull.appels.length === appelsAvant, 'après un échec : pas de nouvel essai');

  // Après 21 h : plus rien (et noté « moment passé » pour le voyageur qui attendait).
  horloge = paris('2026-10-25T20:30:00Z');
  b = await lancerProgrammes(options());
  verifier(envoi('r5', 'veille_arrivee')?.statut === 'ignore' && envoi('r5', 'veille_arrivee')?.raison === RAISONS.attend, 'moment passé : le voyageur qui attendait est noté, rien n’est parti');
  verifier(envoi('r3', 'veille_arrivee')?.raison === RAISONS.sansConversation, 'moment passé : sans conversation, noté');

  // Confirmation : allumée maintenant ; seules les nouvelles réservations la reçoivent, de 8 h à 21 h.
  horloge = paris('2026-10-25T21:30:00Z'); // 22:30
  const conf = reglagesAllumes(['veille_arrivee', 'confirmation'], ALLUME_LE, (r) => (r.modeles.confirmation.activeLe = '2026-10-25T22:00:00+01:00'));
  reglages(conf);
  b = await lancerProgrammes(options());
  verifier(!base.collection<EnvoiProgramme>(COLLECTION_ENVOIS_PROGRAMMES).some((x) => x.declencheur === 'confirmation'), 'à l’allumage : aucune confirmation pour les réservations déjà là');
  base.poser('reservations', resa('r7', { arrivee: '2026-11-10', depart: '2026-11-12', voyageur: { nom: 'Inès Garcia', nbPersonnes: 2 } }));
  base.poser('filsMessages', fil('fil-7', 'r7'));
  horloge = paris('2026-10-25T21:45:00Z');
  b = await lancerProgrammes(options());
  verifier(!envoi('r7', 'confirmation') && b.reportes >= 1, 'nouvelle réservation à 22:45 : attend le matin');
  horloge = paris('2026-10-26T06:45:00Z');
  await lancerProgrammes(options());
  verifier(!envoi('r7', 'confirmation'), '07:45 : toujours rien');
  horloge = paris('2026-10-26T07:10:00Z');
  await lancerProgrammes(options());
  const c7 = repull.envois.find((e) => e.conversation === '7');
  verifier(envoi('r7', 'confirmation')?.statut === 'envoye' && !!c7, '08:10 : la confirmation part');
  verifier(!!c7 && c7.message.includes('Inès') && !c7.message.includes('4821') && !c7.message.includes('soleil2026') && !/Wifi/.test(c7.message), 'confirmation 15 jours avant : ni code ni wifi');
  const lot = Array.from({ length: SEUIL_IMPORT + 1 }, (_, i) => resa(`imp-${i}`, { arrivee: '2026-12-01', depart: '2026-12-03' }));
  for (const r of lot) {
    base.poser('reservations', r);
    base.poser('filsMessages', fil(`fil-imp${i(r.id)}`, r.id));
  }
  horloge = paris('2026-10-26T08:00:00Z');
  b = await lancerProgrammes(options());
  verifier(b.importation === SEUIL_IMPORT + 1 && !lot.some((r) => envoi(r.id, 'confirmation')), 'importation d’un coup : pas de confirmation');

  // Écritures sur la plateforme : uniquement des messages aux voyageurs.
  const ecritures = repull.appels.filter((a) => a.methode !== 'GET');
  verifier(ecritures.length > 0 && ecritures.every((a) => a.methode === 'POST' && /^\/v1\/conversations\/[^/]+\/messages$/.test(a.chemin) && ecritureRepullPermise(a.methode, a.chemin, a.corps)), 'plateforme : rien d’autre que des messages (ni prix, ni calendrier, ni annonce, ni avis)');
  verifier(ecritures.every((a) => a.cle?.startsWith('lm-auto-')), 'chaque envoi porte une clé d’idempotence');

  // Envoi coupé depuis plus de 23 h : à vérifier, rien ne repart.
  base.poser(COLLECTION_ENVOIS_PROGRAMMES, { id: idEnvoi('r1', 'jour_depart'), reservationId: 'r1', logementId: 'log-1', declencheur: 'jour_depart', voyageur: 'Marie', statut: 'en_cours', texte: 'Bonjour', cle: cleEnvoiProgramme('r1', 'jour_depart'), filId: 'fil-1', depuis: '2026-10-24T09:00:00+02:00', le: '2026-10-24T09:00:00+02:00' } as EnvoiProgramme);
  const nb = repull.envois.length;
  await lancerProgrammes(options());
  verifier(envoi('r1', 'jour_depart')?.statut === 'a_verifier' && repull.envois.length === nb, 'envoi coupé trop ancien : « à vérifier », rien ne repart');

  verifier(!envoi('r1', 'jour_depart')?.texte, '« à vérifier » : le texte (codes compris) n’est plus gardé dans la ligne');

  // Reprise après une première tentative qui n'a pas atteint la plateforme : séjour annulé, arrivée déplacée, nuit.
  const enCours = (rid: string, filId: string, texte: string): EnvoiProgramme => ({
    id: idEnvoi(rid, 'veille_arrivee'), reservationId: rid, logementId: 'log-1', declencheur: 'veille_arrivee', voyageur: 'Paul', statut: 'en_cours',
    texte, cle: 'cle-de-la-ligne', filId, depuis: '2026-10-26T20:30:00+01:00', le: '2026-10-26T20:30:00+01:00',
  });
  const avecCodes = 'Bonjour Paul, boîte à clés 4821, wifi soleil2026';
  base.poser('reservations', resa('rx1', { statut: 'annulee', arrivee: '2026-10-27', depart: '2026-10-29' }));
  base.poser('reservations', resa('rx2', { arrivee: '2026-11-06', depart: '2026-11-08' }));
  base.poser('reservations', resa('rx3', { arrivee: '2026-10-27', depart: '2026-10-29' }));
  for (const [rid, filId] of [['rx1', 'fil-901'], ['rx2', 'fil-902'], ['rx3', 'fil-903']]) {
    base.poser('filsMessages', fil(filId, rid));
    base.poser(COLLECTION_ENVOIS_PROGRAMMES, enCours(rid, filId, avecCodes));
  }
  const avantReprise = repull.envois.length;
  horloge = paris('2026-10-26T22:30:00Z'); // 23:30 à Paris
  await lancerProgrammes(options());
  verifier(envoi('rx1', 'veille_arrivee')?.statut === 'a_verifier' && envoi('rx1', 'veille_arrivee')?.raison === RAISONS.repriseAnnulee, 'reprise : séjour annulé → « à vérifier »');
  verifier(envoi('rx2', 'veille_arrivee')?.statut === 'a_verifier' && envoi('rx2', 'veille_arrivee')?.raison === RAISONS.repriseCodes, 'reprise : arrivée déplacée, codes plus permis → « à vérifier »');
  verifier(!envoi('rx1', 'veille_arrivee')?.texte && !envoi('rx2', 'veille_arrivee')?.texte, '« à vérifier » : le texte avec les codes est retiré de la ligne');
  verifier(envoi('rx3', 'veille_arrivee')?.statut === 'en_cours', 'reprise à 23:30 : attend le matin');
  verifier(repull.envois.length === avantReprise, 'aucun message avec les codes n’est parti');
  horloge = paris('2026-10-27T07:05:00Z'); // 08:05, jour de l'arrivée : codes permis
  await lancerProgrammes(options());
  // (La confirmation de rx3, allumée elle aussi, part avec sa propre clé.)
  const repris = repull.envois.filter((e) => e.conversation === '903' && e.message === avecCodes);
  verifier(repris.length === 1 && repris[0].cle === cleEnvoiProgramme('rx3', 'veille_arrivee'), 'reprise à 08:05 : partie une fois, avec la clé du séjour');
  verifier(!repull.envois.some((e) => e.cle === 'cle-de-la-ligne'), 'la clé lue dans la ligne n’est jamais utilisée');

  // Code écrit en dur dans un modèle : refusé avant la fenêtre des codes.
  reglages(reglagesAllumes(['confirmation'], ALLUME_LE, (r) => {
    r.modeles.confirmation.activeLe = '2026-10-25T22:00:00+01:00';
    r.modeles.confirmation.texte = 'Bonjour {prenom}, la boîte à clés : 4821.';
  }));
  base.poser('reservations', resa('rx4', { arrivee: '2026-11-20', depart: '2026-11-22', voyageur: { nom: 'Léa', nbPersonnes: 1 } }));
  base.poser('filsMessages', fil('fil-904', 'rx4'));
  horloge = paris('2026-10-27T08:00:00Z');
  await lancerProgrammes(options());
  verifier(envoi('rx4', 'confirmation')?.statut === 'ignore' && envoi('rx4', 'confirmation')?.raison === RAISONS.codesEnClair, 'code en dur 3 semaines avant : pas envoyé, noté');
  verifier(!repull.envois.some((e) => e.conversation === '904'), 'rien n’est parti chez le voyageur');

  // Verrou : un seul passage à la fois.
  base.poser('programmes', { id: 'etat', verrou: { jusqua: Date.now() + 3_600_000 * 24 * 365, id: 'autre' } });
  verifier((await lancerProgrammes(options())).statut === 'occupe', 'un autre passage en cours : rien');
  base.poser('programmes', { id: 'etat' });
  // Deux passages en même temps : un seul prend le verrou (écriture atomique).
  const deux = await Promise.all([lancerProgrammes(options()), lancerProgrammes(options())]);
  verifier(deux.filter((x) => x.statut === 'occupe').length === 1, 'deux passages simultanés : un seul tourne');
  base.lignes.delete(base.cle('programmes', 'etat'));
  const premiers = await Promise.all([lancerProgrammes(options()), lancerProgrammes(options())]);
  verifier(premiers.filter((x) => x.statut === 'occupe').length === 1, 'tout premier passage, deux à la fois : un seul tourne');
  verifier(!base.get<{ verrou?: unknown }>('programmes', 'etat')?.verrou, 'verrou rendu à la fin du passage');

  /* ------------------------------------------------ avis à déposer */
  section('Passage simulé : avis à déposer');
  horloge = paris('2026-10-25T17:30:00Z');
  base.poser('reservations', resa('fin-1', { arrivee: '2026-10-20', depart: '2026-10-24', statut: 'terminee', voyageur: { nom: 'Lucas Martin', nbPersonnes: 2 } }));
  base.poser('reservations', resa('fin-2', { arrivee: '2026-10-18', depart: '2026-10-23', statut: 'terminee', voyageur: { nom: 'Emma Petit', nbPersonnes: 3 } }));
  base.poser('reservations', resa('fin-3', { canal: 'booking', arrivee: '2026-10-18', depart: '2026-10-23', statut: 'terminee' }));
  base.poser('incidents', { id: 'inc-1', logementId: 'log-1', reservationId: 'fin-2', date: '2026-10-21', categorie: 'casse', gravite: 'moyenne', description: 'Table abîmée', statut: 'ouvert', refacturable: 'voyageur', preuves: [] } as Incident);
  // Le délai le plus court d'abord : Emma (partie le 23), puis Lucas (le 24).
  ia.reponses = [{ texte: 'Emma a séjourné chez nous.', a_relire: true, raison: 'Incident signalé' }, { texte: 'Lucas a été un voyageur parfait.', a_relire: false, raison: '' }];
  b = await lancerProgrammes(options());
  const a1 = base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'fin-1');
  const a2 = base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'fin-2');
  verifier(a1?.statut === 'pret' && a1.source === 'ia' && a1.texte === 'Lucas a été un voyageur parfait.', 'séjour sans souci : avis préparé par l’IA, « prêt »');
  verifier(a2?.statut === 'a_relire' && !!a2.raisons?.includes('Un incident pendant le séjour'), 'séjour avec incident : « à relire »');
  verifier(!base.get(COLLECTION_AVIS_A_DEPOSER, 'fin-3'), 'Booking.com : pas d’avis à déposer');
  const appel = ia.appels.find((x) => String(x.messages[0]?.content ?? '').includes('Lucas'));
  verifier(appel?.model === MODELE_AGENT_DEFAUT && JSON.stringify(appel?.output_config ?? {}).includes('json_schema'), 'même modèle que l’agent, sortie JSON imposée');
  verifier(String(appel?.system ?? '').includes('Label Maison') && String(appel?.messages[0]?.content ?? '').includes('Lucas') && !String(appel?.messages[0]?.content ?? '').includes('Martin'), 'consignes au nom de l’espace ; prénom seul, jamais le nom de famille');
  verifier(base.get<EtatAgent>(COLLECTION_AGENT, ID_ETAT_AGENT)?.iaMois?.appels === 2, 'appels de l’IA comptés avec ceux de l’agent');
  const appelsIA = ia.appels.length;
  await lancerProgrammes(options());
  verifier(ia.appels.length === appelsIA, 'avis déjà préparés : pas de nouvel appel');

  // L'équipe a dit « C'est fait » : jamais écrasé, même si un souci apparaît ensuite.
  base.poser(COLLECTION_AVIS_A_DEPOSER, { ...a1!, statut: 'fait', traitePar: 'Abdel' });
  base.poser('incidents', { id: 'inc-2', logementId: 'log-1', reservationId: 'fin-1', date: '2026-10-23', categorie: 'casse', gravite: 'faible', description: 'Verre cassé', statut: 'ouvert', refacturable: 'aucun', preuves: [] } as Incident);
  await lancerProgrammes(options());
  verifier(base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'fin-1')?.statut === 'fait', 'avis marqué fait par l’équipe : jamais écrasé');

  // Un avis prêt dont le séjour a depuis un incident repasse « à relire ».
  base.poser('reservations', resa('fin-4', { arrivee: '2026-10-19', depart: '2026-10-22', statut: 'terminee', voyageur: { nom: 'Hugo', nbPersonnes: 1 } }));
  await lancerProgrammes(options());
  verifier(base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'fin-4')?.statut === 'pret', 'nouveau séjour sans souci : prêt');
  base.poser('incidents', { id: 'inc-3', logementId: 'log-1', reservationId: 'fin-4', date: '2026-10-21', categorie: 'voyageur', gravite: 'faible', description: 'Bruit', statut: 'ouvert', refacturable: 'aucun', preuves: [] } as Incident);
  await lancerProgrammes(options());
  verifier(base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'fin-4')?.statut === 'a_relire', 'incident après coup : « prêt » repasse « à relire »');
  verifier(base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'fin-4')?.texte === '', 'incident après coup : le texte écrit avant (un éloge) est retiré');
  const contexteEmma = String(ia.appels.find((x) => String(x.messages[0]?.content ?? '').includes('Emma'))?.messages[0]?.content ?? '');
  verifier(/Un incident pendant le séjour/.test(contexteEmma) && /sans aucun éloge/.test(contexteEmma), 'séjour avec incident : l’IA en est informée et ne doit écrire aucun éloge');

  // Autre espace au plafond du mois : pas d'IA, texte simple.
  const base2 = new FausseBase();
  base2.poser('logements', LOGEMENT);
  base2.poser('reservations', resa('s-1', { arrivee: '2026-10-20', depart: '2026-10-24', statut: 'terminee', voyageur: { nom: 'Nina Roux', nbPersonnes: 2 } }));
  base2.poser(COLLECTION_AGENT, { id: ID_ETAT_AGENT, iaMois: { mois: '2026-10', appels: 2 } });
  const ia2 = new FausseIA();
  await lancerProgrammes(options({ base: new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: base2.fetch as typeof fetch, jeton: async () => 'jeton' }), ia: ia2, nomEspace: 'Sens', plafondIAMois: 2 }));
  const s1 = base2.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 's-1');
  verifier(ia2.appels.length === 0 && s1?.source === 'modele' && s1.texte === texteAvisParDefaut('Nina'), 'plafond du mois atteint : aucun appel à l’IA, texte simple');
  base2.poser('reservations', resa('s-2', { arrivee: '2026-10-21', depart: '2026-10-24', statut: 'terminee', voyageur: { nom: 'Omar', nbPersonnes: 2 } }));
  await lancerProgrammes(options({ base: new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: base2.fetch as typeof fetch, jeton: async () => 'jeton' }), ia: ia2, nomEspace: 'Sens', plafondIAMois: 5 }));
  verifier(ia2.appels.length === 1 && String(ia2.appels[0]?.system).includes('Sens') && !String(ia2.appels[0]?.system).includes('Label Maison'), 'sous le plafond : l’IA rédige au nom de l’espace, jamais de Label Maison');
  verifier(base2.get<EtatAgent>(COLLECTION_AGENT, ID_ETAT_AGENT)?.iaMois?.appels === 3, 'l’appel compte dans le plafond de l’espace');

  // Appel compté AVANT : un appel qui échoue compte quand même ; un texte avec un chiffre est à relire.
  const base4 = new FausseBase();
  base4.poser('reservations', resa('u-1', { arrivee: '2026-10-20', depart: '2026-10-23', statut: 'terminee', voyageur: { nom: 'Ana', nbPersonnes: 1 } }));
  base4.poser('reservations', resa('u-2', { arrivee: '2026-10-21', depart: '2026-10-24', statut: 'terminee', voyageur: { nom: 'Tom', nbPersonnes: 1 } }));
  const ia4 = new FausseIA();
  ia4.reponses = [{ texte: 'Ana, 4 étoiles, à revoir au 12 rue des Lilas.', a_relire: false, raison: '' }, new Error('panne')];
  await lancerProgrammes(options({ base: new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: base4.fetch as typeof fetch, jeton: async () => 'jeton' }), ia: ia4, nomEspace: 'Sens', plafondIAMois: 10 }));
  const u1 = base4.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'u-1');
  verifier(u1?.statut === 'a_relire' && !!u1.raisons?.some((x) => x.includes('chiffre')), 'avis de l’IA avec chiffre ou adresse : « à relire », jamais « prêt »');
  verifier(u1?.texte === 'Ana, 4 étoiles, à revoir au 12 rue des Lilas.' && soucisDuSejour(u1.raisons ?? []).length === 0, 'séjour sans souci : le texte de l’IA est gardé (l’alerte de forme n’est pas un souci du séjour)');
  verifier(base4.get<EtatAgent>(COLLECTION_AGENT, ID_ETAT_AGENT)?.iaMois?.appels === 2, 'appels comptés avant l’appel : l’appel en panne compte aussi');
  verifier(base4.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'u-2')?.source === 'modele', 'appel en panne : texte simple');

  // Sans clé IA : texte simple, jamais bloqué.
  const base3 = new FausseBase();
  base3.poser('reservations', resa('t-1', { arrivee: '2026-10-20', depart: '2026-10-24', statut: 'terminee', voyageur: { nom: 'Léo', nbPersonnes: 1 } }));
  await lancerProgrammes(options({ base: new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: base3.fetch as typeof fetch, jeton: async () => 'jeton' }), ia: null }));
  verifier(base3.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 't-1')?.statut === 'pret', 'sans IA : avis prêt avec un texte simple');

  // IA indisponible et séjour à relire : jamais le texte simple (un éloge), rien de prérempli.
  const base5 = new FausseBase();
  base5.poser('reservations', resa('v-1', { arrivee: '2026-10-20', depart: '2026-10-24', statut: 'terminee', voyageur: { nom: 'Inès', nbPersonnes: 1 } }));
  base5.poser('reservations', resa('v-2', { arrivee: '2026-10-19', depart: '2026-10-23', statut: 'terminee', voyageur: { nom: 'Paul', nbPersonnes: 1 }, noteVoyageur: 3 }));
  base5.poser('incidents', { id: 'inc-v', logementId: 'log-1', reservationId: 'v-1', date: '2026-10-22', categorie: 'casse', gravite: 'moyenne', description: 'Porte abîmée', statut: 'ouvert', refacturable: 'voyageur', preuves: [] } as Incident);
  await lancerProgrammes(options({ base: new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: base5.fetch as typeof fetch, jeton: async () => 'jeton' }), ia: null }));
  const v1 = base5.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'v-1');
  const v2 = base5.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'v-2');
  verifier(v1?.statut === 'a_relire' && v1.texte === '' && v2?.statut === 'a_relire' && v2.texte === '', 'sans IA, incident ou note basse : « à relire » sans texte, jamais d’éloge');

  // L'IA fait l'éloge malgré l'incident : texte écarté.
  const base6 = new FausseBase();
  base6.poser('reservations', resa('w-1', { arrivee: '2026-10-20', depart: '2026-10-24', statut: 'terminee', voyageur: { nom: 'Jade', nbPersonnes: 1 } }));
  base6.poser('incidents', { id: 'inc-w', logementId: 'log-1', reservationId: 'w-1', date: '2026-10-22', categorie: 'casse', gravite: 'moyenne', description: 'Lampe cassée', statut: 'ouvert', refacturable: 'voyageur', preuves: [] } as Incident);
  const ia6 = new FausseIA();
  ia6.reponses = [{ texte: 'Jade a été une voyageuse respectueuse et agréable, nous la recommandons.', a_relire: false, raison: '' }];
  await lancerProgrammes(options({ base: new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: base6.fetch as typeof fetch, jeton: async () => 'jeton' }), ia: ia6 }));
  const w1 = base6.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'w-1');
  verifier(w1?.statut === 'a_relire' && w1.texte === '', 'éloge de l’IA pour un séjour avec incident : écarté, l’équipe écrit l’avis');
}

const i = (id: string) => id.replace(/\D/g, '');

async function principal() {
  heures();
  eteintParDefaut();
  decisions();
  heuresCalmes();
  reservationsVues();
  rendu();
  signatures();
  fileAvis();
  apercu();
  repriseReverifiee();
  codesEnDur();
  libelles();
  alertesAvis();
  await passageSimule();
  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
}

principal().catch((e) => {
  console.error(e);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
});
