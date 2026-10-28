/**
 * Auto-contrôle de la publication automatique des avis (octobre 2026, comme
 * Smoobu), sans réseau : règles pures (avis-auto.ts), puis le passage du
 * jour et « Publier » du gérant (avis-auto-passage.ts) avec une fausse base,
 * une fausse plateforme et un faux Claude, en mémoire.
 *
 * Vérifie : verrou des écritures exact (deux routes d'avis, corps exact,
 * tout le reste refusé), réglages éteints par défaut et réservés au gérant,
 * rien de publié réglages éteints (aucun appel), fenêtre de 2 à 14 jours,
 * Airbnb seulement pour l'avis sur le voyageur, séjours sensibles gardés
 * (incident, contrôle, note basse, échange sensible, conversation confiée,
 * litige, séjour du propriétaire, rédaction en panne, texte avec un contact),
 * réponses publiées seules pour les avis positifs seulement, jamais deux
 * publications (marque « en cours », 409, envoi coupé), délai passé,
 * « Publier » du gérant (avis relu, texte contrôlé, une seule fois), trace
 * dans « Actions de l'IA », langue du voyageur, part des appels du mois,
 * espaces séparés.
 *
 * Lancement :
 *   node_modules/.bin/esbuild src/erp/data/verifier-avis-auto.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/vaa.mjs && node /tmp/vaa.mjs
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { ClientIA } from './agent-messagerie';
import { lireAvis } from './avis';
import {
  COLLECTION_REPONSES_AVIS,
  EXPLICATIONS_AVIS_AUTO,
  ID_ETAT_AVIS_AUTO,
  JOURS_REPONSE_AUTO,
  allume,
  avecAvisAuto,
  avisADeposerEquipe,
  avisAValider,
  avisPositif,
  deciderAvisVoyageur,
  etatPublicationVoyageur,
  fenetreAvisVoyageur,
  indexSejours,
  langueVoyageur,
  passageAvisDu,
  problemesTexteAvis,
  raisonsAvisSensible,
  raisonsReponseAValider,
  reglagesAvisAuto,
  reponseADecider,
  sejourDuProprietaire,
  verdictAvisVoyageur,
} from './avis-auto';
import { passerAvisAuto, publierAvisParGerant, RESERVE_APPELS, type DonneesAvisAuto, type OptionsAvisAuto } from './avis-auto-passage';
import { COLLECTION_ACTIONS_AGENT, etatAffiche } from './copilote';
import { ecritureGerantSeulement } from './ecritures-gerant';
import { COLLECTION_AVIS_A_DEPOSER, COLLECTION_ETAT_PROGRAMMES, ID_REGLAGES_PROGRAMMES, modeleParDefaut, reglagesProgrammes } from './messages-programmes';
import { REGLAGES_AGENT_DEFAUT } from './reglages';
import { BaseErp, COLLECTION_ETAT, ID_ETAT, ecritureRepullPermise, type EtatRepull } from './repull-synchro';
import type { RepullReview } from './repull';
import { lancerProgrammes } from './passage-programmes';
import type { FilMessages, Incident, Logement, Message, Proprietaire, Reglage, Reservation } from './types';
import type { ActionAgent } from './types-copilote';
import type { AvisADeposer, ReglagesMessagesProgrammes, ReponseAvisAuto } from './types-programmes';

/* ------------------------------------------------------------ assertions */

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string, detail?: unknown) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 400)}` : ''}`);
  }
}
function section(titre: string) {
  console.log(`\n${titre}`);
}
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });

/* -------------------------------------------------------------- données */

// Mercredi 28 octobre 2026, 11 h à Paris (heure d'hiver).
const AUJOURDHUI = '2026-10-28';
const MAINTENANT = new Date('2026-10-28T10:00:00Z');
const ALLUME_LE = '2026-10-01T09:00:00+02:00';

const LOGEMENT: Logement = {
  id: 'log-1',
  nom: 'Corbeil Rives de Seine',
  adresse: '12 rue de la Gare',
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
  fiche: { wifiNom: 'LM-Corbeil', wifiCode: 'soleil2026', heureArrivee: '16:00', heureDepart: '11:00', acces: 'Boîte à clés 4821.', parking: '', regles: '', equipements: [] },
  dotationLinge: [],
  annonces: [],
  checklistLancement: [],
};
const PROPRIETAIRE: Proprietaire = { id: 'p1', type: 'particulier', nom: 'Hélène Martin', contact: { email: '', telephone: '' }, adresse: '', notes: '', creeLe: '2025-01-01' } as Proprietaire;

const jourMoins = (n: number) => new Date(Date.parse(`${AUJOURDHUI}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

function resa(id: string, depuis: number, p: Partial<Reservation> = {}): Reservation {
  const depart = jourMoins(depuis);
  return {
    id,
    logementId: 'log-1',
    canal: 'airbnb',
    voyageur: { nom: 'Marie Dupont', nbPersonnes: 2 },
    arrivee: jourMoins(depuis + 3),
    depart,
    nuits: 3,
    statut: 'terminee',
    montantBrutCentimes: 30000,
    commissionPlateformeCentimes: 0,
    fraisMenageCentimes: 0,
    repull: { id: id.replace(/^res-/, ''), code: `HM${id}` },
    ...p,
  };
}

const msg = (id: string, auteur: Message['auteur'], texte: string, envoyeLe: string): Message => ({ id, auteur, texte, envoyeLe });
function fil(id: string, r: Reservation, messages: Message[], p: Partial<FilMessages> = {}): FilMessages {
  return {
    id,
    reservationId: r.id,
    logementId: r.logementId,
    canal: r.canal,
    voyageur: r.voyageur.nom,
    statut: 'clos',
    messages,
    dernierMessageLe: messages[messages.length - 1]?.envoyeLe ?? `${r.depart}T10:00:00+01:00`,
    traitePar: 'agent',
    repull: { id: `c-${id}` },
    ...p,
  };
}

function reglagesAllumes(voyageurs: boolean, reponses: boolean): ReglagesMessagesProgrammes {
  const base = reglagesProgrammes({ reglages: [] });
  let r = base;
  if (voyageurs) r = avecAvisAuto(r, 'voyageurs', true, { par: 'Abdel', le: ALLUME_LE });
  if (reponses) r = avecAvisAuto(r, 'reponses', true, { par: 'Abdel', le: ALLUME_LE });
  return r;
}

/* ============================================================ règles pures */

section('1. Verrou des écritures : deux routes d’avis, le corps exact, rien d’autre');
{
  const ok = { publicReview: 'Marie a été une voyageuse respectueuse.', rating: 5, isRevieweeRecommended: true };
  verifier(ecritureRepullPermise('POST', '/v1/reviews/42/guest-review', ok) && ecritureRepullPermise('POST', '/v1/reviews/42/reply', { message: 'Merci !' }), 'avis sur le voyageur et réponse publique permis');
  const refuses: [string, string, unknown][] = [
    ['PUT', '/v1/channels/airbnb/reviews/42', ok],
    ['POST', '/v1/channels/airbnb/reviews', ok],
    ['POST', '/v1/channels/airbnb/reviews/42/respond', { message: 'x' }],
    ['POST', '/v1/channels/booking/reviews', { response: 'x' }],
    ['POST', '/v1/reviews/abc/reply', { message: 'x' }],
    ['POST', '/v1/reviews/42/reply?x=1', { message: 'x' }],
    ['POST', '/v1/reviews/42/../../listings/1', { message: 'x' }],
    ['POST', '/v1/reviews/42/guest-review', { ...ok, privateFeedback: 'note' }],
    ['POST', '/v1/reviews/42/guest-review', { ...ok, rating: 7 }],
    ['POST', '/v1/reviews/42/reply', { response: 'x' }],
    ['PUT', '/v1/availability/1', { price: 90 }],
    ['PATCH', '/v1/listings/1', { title: 'x' }],
    ['POST', '/v1/listings/1/pricing', {}],
    ['PUT', '/v1/channels/airbnb/listings/1/availability', {}],
  ];
  const passes = refuses.filter(([m, c, corps]) => ecritureRepullPermise(m, c, corps));
  verifier(!passes.length, 'prix, calendrier, disponibilités, annonces et toute autre route d’avis : refusés', passes);
}

section('2. Réglages : éteints par défaut, gardés avec les messages automatiques, réservés au gérant');
{
  const vide = reglagesAvisAuto({ reglages: [] });
  verifier(!allume(vide.voyageurs) && !allume(vide.reponses), 'sans réglage : tout éteint');
  const sansDate = reglagesAvisAuto({ reglages: [{ id: ID_REGLAGES_PROGRAMMES, modeles: {}, avisAuto: { voyageurs: { actif: true }, reponses: { actif: true } } } as unknown as Reglage] });
  verifier(!allume(sansDate.voyageurs) && !allume(sansDate.reponses), 'allumé sans heure d’allumage : éteint');
  const r = reglagesAllumes(true, false);
  const lus = reglagesAvisAuto({ reglages: [r as Reglage] });
  verifier(allume(lus.voyageurs) && !allume(lus.reponses) && lus.voyageurs.activeLe === ALLUME_LE, 'un réglage allumé n’allume pas l’autre');
  // Un modèle de message enregistré (écran Messages automatiques) garde les réglages des avis.
  const apresMessage: ReglagesMessagesProgrammes = { ...reglagesProgrammes({ reglages: [r as Reglage] }), modeles: { ...r.modeles, demande_avis: { ...modeleParDefaut('demande_avis'), texte: 'Merci !' } } };
  verifier(allume(reglagesAvisAuto({ reglages: [apresMessage as Reglage] }).voyageurs), 'enregistrer un message automatique ne les éteint pas');
  const eteint = avecAvisAuto(r, 'voyageurs', false, { par: 'Abdel', le: '2026-10-20T10:00:00+02:00' });
  verifier(!allume(reglagesAvisAuto({ reglages: [eteint as Reglage] }).voyageurs) && !reglagesAvisAuto({ reglages: [eteint as Reglage] }).voyageurs.activeLe, 'éteint : l’heure d’allumage est retirée');
  verifier(ecritureGerantSeulement('reglages', ID_REGLAGES_PROGRAMMES) && ecritureGerantSeulement(COLLECTION_REPONSES_AVIS, 'res-1'), 'réglages des avis (messages-programmes) et réponses aux avis : écritures réservées au gérant');
  verifier(!ecritureGerantSeulement(COLLECTION_AVIS_A_DEPOSER, 'res-1'), 'avis à déposer : l’équipe garde « C’est fait » et « Passer »');
  verifier(/deux jours après le départ/.test(EXPLICATIONS_AVIS_AUTO.voyageurs.phrase) && /avis positifs/.test(EXPLICATIONS_AVIS_AUTO.reponses.phrase), 'une phrase d’explication par réglage');
}

section('3. Avis sur le voyageur : Airbnb, de 2 à 14 jours après le départ');
{
  verifier(fenetreAvisVoyageur(resa('a', 1), AUJOURDHUI) === 'trop_tot' && fenetreAvisVoyageur(resa('a', 0), AUJOURDHUI) === 'trop_tot', 'avant deux jours : trop tôt');
  verifier(fenetreAvisVoyageur(resa('a', 2), AUJOURDHUI) === 'ouverte' && fenetreAvisVoyageur(resa('a', 14), AUJOURDHUI) === 'ouverte', 'de 2 à 14 jours : à publier');
  verifier(fenetreAvisVoyageur(resa('a', 15), AUJOURDHUI) === 'passee', 'après 14 jours : délai passé');
  verifier(fenetreAvisVoyageur(resa('a', 3, { canal: 'booking' }), AUJOURDHUI) === 'hors' && fenetreAvisVoyageur(resa('a', 3, { statut: 'annulee' }), AUJOURDHUI) === 'hors', 'Booking.com ou annulée : jamais');
  const on = reglagesAvisAuto({ reglages: [reglagesAllumes(true, false) as Reglage] }).voyageurs;
  const off = reglagesAvisAuto({ reglages: [] }).voyageurs;
  const r = resa('a', 3);
  verifier(deciderAvisVoyageur(r, undefined, AUJOURDHUI, off).genre === 'rien', 'réglage éteint : rien');
  verifier(deciderAvisVoyageur(r, undefined, AUJOURDHUI, on).genre === 'preparer', 'réglage allumé, séjour dans la fenêtre : à préparer');
  const ligne = (p: Partial<AvisADeposer>): AvisADeposer => ({ id: 'a', reservationId: 'a', logementId: 'log-1', voyageur: 'Marie', depart: r.depart, canal: 'airbnb', statut: 'pret', creeLe: '', ...p });
  verifier(['fait', 'passe'].every((s) => deciderAvisVoyageur(r, ligne({ statut: s as AvisADeposer['statut'] }), AUJOURDHUI, on).genre === 'rien'), '« C’est fait » ou « Passer » de l’équipe : jamais repris');
  verifier(
    (['publie', 'a_valider', 'refuse', 'echec', 'expire'] as const).every((s) => deciderAvisVoyageur(r, ligne({ publication: { statut: s, le: '' } }), AUJOURDHUI, on).genre === 'rien'),
    'publié, à valider, refusé, en échec, expiré : jamais repris (jamais deux fois)',
  );
  verifier(deciderAvisVoyageur(r, ligne({ publication: { statut: 'en_cours', le: '' } }), AUJOURDHUI, on).genre === 'preparer', 'envoi resté en cours : repris (la plateforme dira s’il est parti)');
  verifier(deciderAvisVoyageur(resa('a', 15), ligne({ publication: { statut: 'a_valider', le: '' } }), AUJOURDHUI, on).genre === 'expirer', 'à valider après le délai : expiré');
  verifier(deciderAvisVoyageur(resa('a', 1), undefined, AUJOURDHUI, on).genre === 'attendre', 'avant deux jours : attendre');
}

section('4. Séjour sensible : gardé « à valider »');
{
  const r = resa('res-1', 3);
  const signaux = { incidents: [] as Incident[], controles: [], filsMessages: [] as FilMessages[], logements: [LOGEMENT], proprietaires: [PROPRIETAIRE] };
  verifier(raisonsAvisSensible(r, signaux).length === 0, 'séjour sans souci : rien ne s’y oppose');
  const incident: Incident = { id: 'i1', logementId: 'log-1', reservationId: 'res-1', date: r.arrivee, categorie: 'casse', gravite: 'faible', description: 'Verre cassé', statut: 'ouvert', refacturable: 'aucun', preuves: [] } as Incident;
  verifier(raisonsAvisSensible(r, { ...signaux, incidents: [incident] }).some((x) => /incident/i.test(x)), 'incident pendant le séjour');
  verifier(raisonsAvisSensible({ ...r, noteVoyageur: 3 }, signaux).some((x) => /Note du voyageur/.test(x)), 'note du voyageur sous 4');
  verifier(
    raisonsAvisSensible(r, { ...signaux, controles: [{ id: 'c', reservationId: 'res-1', points: [{ etat: 'a_revoir' }] } as never] }).some((x) => /Contrôle/.test(x)),
    'contrôle après départ : points à revoir',
  );
  const pendant = (texte: string) => fil('f1', r, [msg('m1', 'voyageur', texte, `${r.arrivee}T18:00:00+01:00`)]);
  verifier(raisonsAvisSensible(r, { ...signaux, filsMessages: [pendant('Je voudrais être remboursé de la dernière nuit.')] }).some((x) => /Échange sensible|souci/.test(x)), 'demande de remboursement pendant le séjour');
  verifier(raisonsAvisSensible(r, { ...signaux, filsMessages: [pendant('Le chauffage est en panne, c’est inacceptable.')] }).length > 0, 'réclamation ou problème sur place');
  const avant = fil('f2', r, [msg('m1', 'voyageur', 'Quel est le prix du parking ?', `${jourMoins(30)}T18:00:00+01:00`)]);
  verifier(raisonsAvisSensible(r, { ...signaux, filsMessages: [avant] }).length === 0, 'question de prix un mois avant l’arrivée : pas un souci du séjour');
  verifier(raisonsAvisSensible(r, { ...signaux, filsMessages: [fil('f3', r, [msg('m1', 'voyageur', 'Merci !', `${r.arrivee}T18:00:00+01:00`)], { statut: 'escalade', raisonEscalade: 'autre' })] }).some((x) => /confiée/.test(x)), 'conversation confiée à l’équipe');
  verifier(raisonsAvisSensible({ ...r, repull: { id: '1', statutDetail: 'dispute_opened' } }, signaux).some((x) => /Litige/.test(x)), 'litige signalé par la plateforme');
  verifier(sejourDuProprietaire({ ...r, voyageur: { nom: 'Hélène Martin', nbPersonnes: 1 } }, signaux) && raisonsAvisSensible({ ...r, voyageur: { nom: 'Hélène Martin', nbPersonnes: 1 } }, signaux).includes('Séjour du propriétaire'), 'séjour du propriétaire (son nom)');
  verifier(sejourDuProprietaire({ ...r, montantBrutCentimes: 0 }, signaux), 'séjour du propriétaire (montant nul)');
  verifier(!sejourDuProprietaire({ ...r, voyageur: { nom: 'Paul Martin', nbPersonnes: 1 } }, signaux), 'même nom de famille, autre prénom : pas le propriétaire');
}

section('5. Texte d’un avis public : rien de privé');
{
  verifier(problemesTexteAvis('Marie a été une voyageuse respectueuse. Nous l’accueillerons avec plaisir.', { nomVoyageur: 'Marie Dupont', logement: LOGEMENT }).length === 0, 'texte simple : rien à signaler');
  const cas: [string, RegExp][] = [
    ['Marie Dupont a été parfaite.', /nom de famille/],
    ['Écrivez à marie@exemple.fr', /e-mail|coordonn/],
    ['Appelez le 06 12 34 56 78', /téléphone|chiffre/],
    ['Voir https://exemple.fr', /lien/],
    ['Le code est 4821', /code|chiffre/],
    ['Le wifi soleil2026 marchait bien', /wifi|chiffre/],
    ['Au 12 rue de la Gare', /adresse/],
    ['', /aucun texte/],
  ];
  const rates = cas.filter(([t, re]) => !problemesTexteAvis(t, { nomVoyageur: 'Marie Dupont', logement: LOGEMENT }).some((x) => re.test(x)));
  verifier(!rates.length, 'nom de famille, e-mail, téléphone, lien, code, wifi, adresse, texte vide : signalés', rates.map((x) => x[0]));
  verifier(verdictAvisVoyageur({ raisons: [], texte: 'Voyageuse agréable.', problemes: [] }).publier, 'sans souci ni problème : publié');
  const garde = verdictAvisVoyageur({ raisons: ['Un incident pendant le séjour'], texte: 'Voyageuse parfaite et agréable.', problemes: [] });
  verifier(!garde.publier && garde.texte === '' && garde.raisons.includes('Un incident pendant le séjour'), 'séjour sensible : gardé, jamais proposé avec un éloge');
  const panne = verdictAvisVoyageur({ raisons: [], texte: 'Voyageuse agréable.', problemes: [], panne: 'Votre agent n’a pas pu rédiger l’avis' });
  verifier(!panne.publier && panne.texte === 'Voyageuse agréable.', 'rédaction en panne : gardé, texte simple proposé');
  verifier(!verdictAvisVoyageur({ raisons: [], texte: 'Voir marie@exemple.fr', problemes: ['une adresse e-mail'] }).publier, 'texte avec un contact : gardé');
}

section('6. Réponses : publiées seules pour un avis positif seulement');
{
  const avis = (note: number | undefined, commentaire: string, canal: Reservation['canal'] = 'airbnb') => lireAvis(resa('r', 5, { canal, ...(note !== undefined ? { noteVoyageur: note } : {}), commentaireVoyageur: commentaire }))!;
  verifier(avisPositif(avis(5, 'Logement très propre, calme et bien situé. Merci !')), '5 sur 5, avis enthousiaste : positif');
  verifier(avisPositif(avis(5, 'Parfait, rien à redire.', 'booking')), 'Booking.com (10 sur 10) : positif');
  const mitige = raisonsReponseAValider(avis(4, 'Très bien, logement propre.'));
  verifier(mitige.includes('Avis mitigé'), '4 sur 5 sans reproche : « Mitigé » (l’analyse des avis), à valider', mitige);
  verifier(raisonsReponseAValider(avis(3, 'Bien.')).some((x) => /Note de 3/.test(x)), 'note sous 4 : à valider');
  verifier(raisonsReponseAValider(avis(5, 'Super séjour mais le logement était sale.')).some((x) => /Point à revoir/.test(x)), 'point négatif dans un avis 5 étoiles : à valider');
  verifier(raisonsReponseAValider(avis(5, 'Super séjour.\n\nMessage privé : les draps étaient tachés.')).some((x) => /message privé/.test(x)), 'message privé négatif : à valider');
  verifier(raisonsReponseAValider(avis(5, 'Super séjour, je demande quand même un remboursement.')).some((x) => /réclamation|remboursement/.test(x)), 'réclamation ou remboursement : à valider');
  verifier(raisonsReponseAValider(avis(undefined, 'Très bien.')).includes('Avis sans note'), 'avis sans note : à valider');
  const r = resa('r', 5);
  const a = (p: Partial<RepullReview>): RepullReview => ({ id: '1', platform: 'airbnb', reviewerRole: 'guest', submittedAt: '2026-10-25T10:00:00Z', ...p });
  verifier(reponseADecider(a({}), r, undefined, MAINTENANT) && reponseADecider(a({ platform: 'booking.com' }), r, undefined, MAINTENANT), 'Airbnb et Booking.com : à traiter');
  verifier(!reponseADecider(a({ platform: 'vrbo' }), r, undefined, MAINTENANT), 'VRBO : jamais');
  verifier(!reponseADecider(a({ response: { body: 'Merci' } }), r, undefined, MAINTENANT), 'avis qui a déjà une réponse : jamais');
  verifier(!reponseADecider(a({ submittedAt: new Date(MAINTENANT.getTime() - (JOURS_REPONSE_AUTO + 1) * 86_400_000).toISOString() }), r, undefined, MAINTENANT), `avis de plus de ${JOURS_REPONSE_AUTO} jours : laissé à l’équipe`);
  const ligne = (statut: ReponseAvisAuto['publication']['statut']) => ({ publication: { statut, le: '' } });
  verifier(['publie', 'a_valider', 'refuse', 'echec', 'sans_objet'].every((s) => !reponseADecider(a({}), r, ligne(s as never), MAINTENANT)), 'déjà décidé (publié, à valider, refusé…) : jamais deux fois');
  verifier(reponseADecider(a({}), r, ligne('en_cours'), MAINTENANT), 'envoi resté en cours : repris');
  verifier(!reponseADecider(a({ reviewerRole: 'host' }), r, undefined, MAINTENANT), 'avis de l’hôte : ce n’est pas une réponse');
}

section('7. Passage du jour : une fois, à partir de 10 h, repris s’il est incomplet');
{
  verifier(!passageAvisDu(undefined, new Date('2026-10-28T07:30:00Z')), 'avant 10 h (Paris) : pas encore');
  verifier(passageAvisDu(undefined, MAINTENANT), '11 h, premier passage du jour : oui');
  verifier(!passageAvisDu({ id: ID_ETAT_AVIS_AUTO, jour: AUJOURDHUI, complet: true, essais: 1 }, MAINTENANT), 'déjà fait aujourd’hui : non');
  verifier(!passageAvisDu({ id: ID_ETAT_AVIS_AUTO, jour: AUJOURDHUI, complet: false, essais: 1, dernierEssai: new Date(MAINTENANT.getTime() - 20 * 60_000).toISOString() }, MAINTENANT), 'incomplet il y a 20 min : attendre');
  verifier(passageAvisDu({ id: ID_ETAT_AVIS_AUTO, jour: AUJOURDHUI, complet: false, essais: 1, dernierEssai: new Date(MAINTENANT.getTime() - 70 * 60_000).toISOString() }, MAINTENANT), 'incomplet il y a plus d’une heure : repris');
  verifier(!passageAvisDu({ id: ID_ETAT_AVIS_AUTO, jour: AUJOURDHUI, complet: false, essais: 4, dernierEssai: '2026-10-28T05:00:00Z' }, MAINTENANT), 'quatre essais dans la journée : on s’arrête');
  verifier(!passageAvisDu(undefined, new Date('2026-10-28T20:30:00Z')), 'après 21 h : non');
}

section('8. Écrans : à valider, à déposer à la main, fiche du séjour');
{
  const reglages = [reglagesAllumes(true, true) as Reglage];
  const r1 = resa('res-1', 3);
  const r2 = resa('res-2', 1);
  const r3 = resa('res-3', 13);
  const r4 = resa('res-4', 5);
  const avis: AvisADeposer[] = [
    { id: 'res-1', reservationId: 'res-1', logementId: 'log-1', voyageur: 'Marie', depart: r1.depart, canal: 'airbnb', statut: 'a_relire', creeLe: '', publication: { statut: 'a_valider', le: '2026-10-28T10:01:00+01:00', texte: 'Séjour sans histoire.', raisons: ['Un incident pendant le séjour'] } },
    { id: 'res-4', reservationId: 'res-4', logementId: 'log-1', voyageur: 'Marie', depart: r4.depart, canal: 'airbnb', statut: 'a_rediger', creeLe: '', publication: { statut: 'echec', le: '', erreur: 'Refusé' } },
  ];
  const reponses: ReponseAvisAuto[] = [{ id: 'res-9', reservationId: 'res-9', logementId: 'log-1', voyageur: 'Paul', canal: 'booking', note: 3.5, avis: 'Bruyant.', publication: { statut: 'a_valider', le: '2026-10-27T10:00:00+01:00', texte: 'Bonjour Paul…', raisons: ['Note de 3,5 sur 5'] }, creeLe: '' }];
  const d = { reservations: [r1, r2, r3, r4], avisADeposer: avis, reponsesAvis: reponses, incidents: [], controles: [], filsMessages: [], reglages };
  const liste = avisAValider(d, AUJOURDHUI);
  verifier(liste.length === 2 && liste[0].genre === 'voyageur' && liste[1].genre === 'reponse' && liste[0].joursRestants === 11, 'à valider : l’avis sur le voyageur (11 jours restants), puis la réponse', liste);
  const manuel = avisADeposerEquipe(d, AUJOURDHUI).map((x) => x.reservation.id).sort();
  verifier(JSON.stringify(manuel) === JSON.stringify(['res-3', 'res-4']), 'à déposer à la main : refusé par la plateforme, ou pas publié dans les deux derniers jours (pas ceux qui partent seuls)', manuel);
  const sansAuto = avisADeposerEquipe({ ...d, reglages: [] }, AUJOURDHUI).map((x) => x.reservation.id).sort();
  verifier(sansAuto.length === 4, 'réglage éteint : tous à déposer à la main, comme avant', sansAuto);
  const s = { incidents: [], controles: [], filsMessages: [], logements: [LOGEMENT], proprietaires: [PROPRIETAIRE] };
  const prevue = etatPublicationVoyageur(r2, undefined, AUJOURDHUI, reglagesAvisAuto({ reglages }), s);
  verifier(prevue?.genre === 'prevue' && prevue.le === jourMoins(-1), 'fiche du séjour : publication prévue deux jours après le départ', prevue);
  verifier(etatPublicationVoyageur(r1, avis[0], AUJOURDHUI, reglagesAvisAuto({ reglages }), s)?.genre === 'a_valider', 'fiche du séjour : à valider');
  verifier(etatPublicationVoyageur(r2, undefined, AUJOURDHUI, reglagesAvisAuto({ reglages: [] }), s) === null, 'réglage éteint : la carte habituelle');
  verifier(langueVoyageur(r1, [fil('f', r1, [msg('m', 'voyageur', 'Hello, thank you so much for the lovely stay, we really enjoyed it!', `${r1.depart}T10:00:00+01:00`)])]) === 'en', 'langue du voyageur : celle de sa conversation');
  verifier(langueVoyageur(r1, []) === 'fr', 'sans conversation : le français');
  const parSejour = indexSejours([r1]);
  verifier(parSejour({ reservationId: '1' })?.id === 'res-1' && parSejour({ reservationConfirmationCode: 'HMres-1' })?.id === 'res-1' && !parSejour({ reservationId: '999' }), 'avis relié au séjour par sa réservation ou son code');
}

/* ===================================================== passage simulé */

class FausseBase {
  lignes = new Map<string, { collection: string; id: string; donnees: unknown; maj: number }>();
  private n = 0;
  appels = 0;
  cle = (c: string, id: string) => `${c}\u0000${id}`;
  /** Espaces vus dans les en-têtes (x-erp-espace). */
  espaces = new Set<string>();

  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    this.appels++;
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    const e = new Headers(init?.headers).get('x-erp-espace');
    if (e) this.espaces.add(e);
    const methode = (init?.method ?? 'GET').toUpperCase();
    const eq = (k: string) => (url.searchParams.get(k) ?? '').replace(/^eq\./, '');
    if (url.pathname.includes('/rpc/')) return json(true);
    if (methode === 'GET') {
      const collection = eq('collection');
      const filtre = url.searchParams.get('id');
      const ids = filtre ? new Set(filtre.replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''))) : null;
      return json(
        [...this.lignes.values()]
          .filter((l) => l.collection === collection && (!ids || ids.has(l.id)))
          .sort((a, b) => a.id.localeCompare(b.id))
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

/** Fausse plateforme : avis de l'hôte à déposer, avis des voyageurs, publications. */
class FauxRepull {
  appels: { chemin: string; methode: string; corps?: unknown; workspace: string | null; query: string }[] = [];
  avisHote = new Map<string, RepullReview>();
  avisVoyageurs = new Map<string, RepullReview>();
  /** Réponse forcée à la prochaine publication (code d'erreur). */
  prochaine?: { statut: number; code: string };
  /** Coupures réseau à venir : la publication est faite chez la plateforme, la réponse se perd (le client réessaie une fois). */
  coupures = 0;

  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    const h = new Headers(init?.headers);
    if (h.get('authorization') !== 'Bearer sk_test_avis') return json({ error: { code: 'unauthorized' } }, 401);
    const methode = (init?.method ?? 'GET').toUpperCase();
    const corps = init?.body ? JSON.parse(String(init.body)) : undefined;
    this.appels.push({ chemin: url.pathname, methode, corps, workspace: h.get('x-workspace-id'), query: url.search });
    if (methode === 'GET' && url.pathname === '/v1/reviews') {
      const role = url.searchParams.get('reviewerRole');
      const liste =
        role === 'host'
          ? [...this.avisHote.values()]
          : [...this.avisVoyageurs.values()].filter((a) => url.searchParams.get('status') !== 'unanswered' || !a.response);
      return json({ data: liste, pagination: { hasMore: false, nextCursor: null } });
    }
    const unAvis = /^\/v1\/reviews\/(\d+)$/.exec(url.pathname);
    if (methode === 'GET' && unAvis) {
      const a = this.avisHote.get(unAvis[1]) ?? this.avisVoyageurs.get(unAvis[1]);
      return a ? json(a) : json({ error: { code: 'not_found' } }, 404);
    }
    const pub = /^\/v1\/reviews\/(\d+)\/(guest-review|reply)$/.exec(url.pathname);
    if (methode === 'POST' && pub) {
      const force = this.prochaine;
      this.prochaine = undefined;
      if (force) return json({ error: { code: force.code, message: force.code } }, force.statut);
      if (this.coupures > 0) {
        this.coupures--;
        // Déposé chez la plateforme (une seule fois), puis la réponse se perd.
        const a = (pub[2] === 'guest-review' ? this.avisHote : this.avisVoyageurs).get(pub[1]);
        if (a && pub[2] === 'guest-review' && !a.submittedAt) {
          a.submittedAt = '2026-10-28T10:00:05Z';
          a.publicReview = (corps as { publicReview: string }).publicReview;
        }
        throw new TypeError('fetch failed');
      }
      if (pub[2] === 'guest-review') {
        const a = this.avisHote.get(pub[1]);
        if (!a) return json({ error: { code: 'not_found' } }, 404);
        if (a.submittedAt) return json({ error: { code: 'review_already_submitted', message: 'already' } }, 409);
        a.submittedAt = '2026-10-28T10:00:05Z';
        a.publicReview = (corps as { publicReview: string }).publicReview;
      } else {
        const a = this.avisVoyageurs.get(pub[1]);
        if (!a) return json({ error: { code: 'not_found' } }, 404);
        if (a.response) return json({ error: { code: 'already_replied', message: 'already' } }, 409);
        a.response = { body: (corps as { message: string }).message, submittedAt: '2026-10-28T10:00:05Z' };
      }
      return json({ id: pub[1], submitted: true }, pub[2] === 'reply' ? 201 : 200);
    }
    return json({ error: { code: 'not_found', message: url.pathname } }, 404);
  };

  publications = () => this.appels.filter((a) => a.methode !== 'GET');
}

/** Faux Claude : un avis sur le voyageur, ou une réponse à un avis, selon les consignes. */
class FausseIA implements ClientIA {
  appels: Anthropic.MessageCreateParamsNonStreaming[] = [];
  avis: ({ texte: string; a_relire: boolean; raison: string } | Error)[] = [];
  reponses: ({ texte: string; sentiment: string; themes: unknown[] } | Error)[] = [];
  messages = {
    create: async (p: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> => {
      this.appels.push(p);
      const pourAvis = /au sujet d'un voyageur/.test(String(p.system));
      const r = pourAvis
        ? (this.avis.shift() ?? { texte: 'Marie a été une voyageuse respectueuse et agréable. Logement rendu en très bon état.', a_relire: false, raison: '' })
        : (this.reponses.shift() ?? { texte: 'Bonjour Marie, merci beaucoup pour votre avis et pour votre séjour. Au plaisir de vous accueillir à nouveau.', sentiment: 'positif', themes: [] });
      if (r instanceof Error) throw r;
      return {
        id: 'msg_test', type: 'message', role: 'assistant', model: p.model,
        content: [{ type: 'text', text: JSON.stringify(r), citations: null }],
        stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 500, output_tokens: 80 },
      } as unknown as Anthropic.Message;
    },
  };
}

interface Monde {
  base: FausseBase;
  repull: FauxRepull;
  ia: FausseIA;
  horloge: Date;
  options: (extra?: Partial<OptionsAvisAuto>) => OptionsAvisAuto;
}

function monde(workspace?: string, espace?: string): Monde {
  const base = new FausseBase();
  const repull = new FauxRepull();
  const ia = new FausseIA();
  const m: Monde = {
    base,
    repull,
    ia,
    horloge: MAINTENANT,
    options: (extra = {}) => ({
      cle: 'sk_test_avis',
      ...(workspace ? { workspace } : {}),
      base: new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: base.fetch as typeof fetch, jeton: async () => 'jeton', ...(espace ? { espace } : {}) }),
      echeance: Date.now() + 50_000,
      budgetMois: 400,
      fetch: repull.fetch as typeof fetch,
      attendre: async () => undefined,
      maintenant: () => m.horloge,
      ia,
      ...extra,
    }),
  };
  base.poser('logements', LOGEMENT);
  base.poser('proprietaires', PROPRIETAIRE);
  base.poser('reglages', { ...REGLAGES_AGENT_DEFAUT, actif: true });
  return m;
}

/** Données du passage, lues dans la fausse base (comme lancerProgrammes). */
function donnees(m: Monde): DonneesAvisAuto {
  return {
    reglagesLus: m.base.collection<Reglage>('reglages'),
    reservations: m.base.collection<Reservation>('reservations'),
    logements: new Map(m.base.collection<Logement>('logements').map((l) => [l.id, l])),
    avis: m.base.collection<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER),
    reponses: m.base.collection<ReponseAvisAuto>(COLLECTION_REPONSES_AVIS),
    incidents: m.base.collection<Incident>('incidents'),
    controles: m.base.collection('controles'),
    fils: async () => m.base.collection<FilMessages>('filsMessages'),
    proprietaires: async () => m.base.collection<Proprietaire>('proprietaires'),
  };
}

const avisHote = (id: string, reservationId: string, p: Partial<RepullReview> = {}): RepullReview => ({ id, platform: 'airbnb', reviewerRole: 'host', reservationId, expiresAt: '2026-11-08T00:00:00Z', ...p });
const avisVoyageur = (id: string, reservationId: string, rating: number, publicReview: string, p: Partial<RepullReview> = {}): RepullReview => ({
  id,
  platform: 'airbnb',
  reviewerRole: 'guest',
  reservationId,
  rating,
  publicReview,
  submittedAt: '2026-10-26T09:00:00Z',
  ...p,
});

async function passages() {
  section('9. Réglages éteints : rien de publié, aucun appel');
  {
    const m = monde();
    m.base.poser('reservations', resa('res-1', 3));
    m.repull.avisHote.set('11', avisHote('11', '1'));
    const b = await passerAvisAuto(m.options(), donnees(m));
    verifier(!b.lance && m.repull.appels.length === 0 && !m.ia.appels.length, 'réglages éteints : aucun appel à la plateforme ni à l’IA', b);
    verifier(!m.base.collection(COLLECTION_AVIS_A_DEPOSER).length && !m.base.collection(COLLECTION_ACTIONS_AGENT).length, 'réglages éteints : aucune écriture');
    // Même chose par le passage planifié complet (lancerProgrammes) : les avis à déposer restent à la main.
    await lancerProgrammes({ ...m.options(), ia: null });
    verifier(m.repull.publications().length === 0, 'passage planifié, réglages éteints : rien n’est publié');
  }

  section('10. Avis sur les voyageurs : publiés seuls deux jours après le départ, les séjours sensibles gardés');
  const m = monde('ws-label-maison');
  m.base.poser('reglages', reglagesAllumes(true, false));
  const propre = resa('res-1', 3);
  const incident = resa('res-2', 4, { voyageur: { nom: 'Lucas Petit', nbPersonnes: 2 } });
  const tropTot = resa('res-3', 1);
  const booking = resa('res-4', 3, { canal: 'booking' });
  const proprio = resa('res-5', 3, { voyageur: { nom: 'Hélène Martin', nbPersonnes: 1 } });
  const deja = resa('res-6', 5);
  const passe = resa('res-7', 6);
  const anglais = resa('res-8', 2, { voyageur: { nom: 'John Smith', nbPersonnes: 2 } });
  for (const r of [propre, incident, tropTot, booking, proprio, deja, passe, anglais]) m.base.poser('reservations', r);
  m.base.poser('incidents', { id: 'i1', logementId: 'log-1', reservationId: 'res-2', date: incident.arrivee, categorie: 'casse', gravite: 'faible', description: 'Verre cassé', statut: 'ouvert', refacturable: 'aucun', preuves: [] });
  m.base.poser(COLLECTION_AVIS_A_DEPOSER, { id: 'res-7', reservationId: 'res-7', logementId: 'log-1', voyageur: 'Marie', depart: passe.depart, canal: 'airbnb', statut: 'passe', creeLe: '' });
  m.base.poser('filsMessages', fil('f8', anglais, [msg('m1', 'voyageur', 'Hello! Thank you so much, we really enjoyed the stay and the apartment was lovely.', `${anglais.arrivee}T18:00:00+01:00`)]));
  for (const [id, r] of [['11', propre], ['12', incident], ['13', tropTot], ['15', proprio], ['16', deja], ['17', passe], ['18', anglais]] as const) m.repull.avisHote.set(id, avisHote(id, r.repull!.id));
  m.repull.avisHote.get('16')!.submittedAt = '2026-10-25T09:00:00Z';
  m.repull.avisHote.get('16')!.publicReview = 'Déposé à la main.';
  m.ia.avis.push({ texte: 'Lucas a séjourné dans notre logement.', a_relire: true, raison: 'Incident signalé' });
  const b = await passerAvisAuto(m.options(), donnees(m));
  const pubs = m.repull.publications();
  verifier(b.lance && b.avisPublies === 2, `deux avis publiés (séjour sans souci, voyageur anglais) : ${b.avisPublies}`, b);
  const p1 = pubs.find((x) => x.chemin === '/v1/reviews/11/guest-review');
  verifier(
    !!p1 && JSON.stringify(Object.keys(p1.corps as object).sort()) === JSON.stringify(['isRevieweeRecommended', 'publicReview', 'rating']) && (p1.corps as { rating: number }).rating === 5 && (p1.corps as { isRevieweeRecommended: boolean }).isRevieweeRecommended === true,
    'corps exact : texte, 5 étoiles, « je recommande »',
    p1?.corps,
  );
  verifier(pubs.every((x) => x.workspace === 'ws-label-maison'), 'chaque appel porte le workspace de l’espace');
  verifier(!pubs.some((x) => /\/(12|13|15|16|17)\//.test(x.chemin)) && !pubs.some((x) => x.chemin.includes('/14/')), 'rien pour le séjour avec incident, trop récent, Booking.com, du propriétaire, déjà déposé ou passé par l’équipe');
  const l1 = m.base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'res-1')!;
  verifier(l1.statut === 'fait' && l1.publication?.statut === 'publie' && l1.publication.avisId === '11' && !!l1.publication.publieLe && l1.traitePar === 'Publication automatique', 'séjour sans souci : « Publié », noté fait', l1);
  const l2 = m.base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'res-2')!;
  verifier(l2.publication?.statut === 'a_valider' && l2.publication.avisId === '12' && l2.publication.raisons!.some((x) => /incident/i.test(x)) && l2.statut === 'a_relire', 'incident : « à valider », avec la raison', l2);
  verifier(!/agréable|parfait|respectueu/i.test(l2.publication?.texte ?? ''), 'séjour sensible : jamais d’éloge proposé', l2.publication?.texte);
  const l5 = m.base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'res-5')!;
  verifier(l5.publication?.statut === 'a_valider' && l5.publication.raisons!.includes('Séjour du propriétaire'), 'séjour du propriétaire : « à valider »', l5);
  const l6 = m.base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'res-6')!;
  verifier(l6.publication?.statut === 'publie' && l6.publication.deja && l6.statut === 'fait', 'déjà déposé sur Airbnb : noté, rien de renvoyé', l6);
  verifier(m.base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'res-7')?.statut === 'passe' && !m.base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'res-7')?.publication, '« Passer » de l’équipe : jamais touché');
  verifier(!m.base.get(COLLECTION_AVIS_A_DEPOSER, 'res-3') && !m.base.get(COLLECTION_AVIS_A_DEPOSER, 'res-4'), 'trop récent, Booking.com : aucune ligne');
  const ctxAnglais = m.ia.appels.map((a) => JSON.stringify(a.messages)).find((x) => x.includes('John'));
  verifier(!!ctxAnglais && /Langue de l’avis : anglais/.test(ctxAnglais), 'voyageur anglais : avis demandé en anglais', ctxAnglais?.slice(0, 200));
  const traces = m.base.collection<ActionAgent>(COLLECTION_ACTIONS_AGENT);
  verifier(
    traces.length === 2 && traces.every((t) => t.outil === 'avis_voyageur_publie' && t.effet === 'externe' && !t.annulable && t.collection === 'avisADeposer' && t.changements.some((c) => c.champ === 'Avis publié')),
    'chaque publication tracée dans « Actions de l’IA » : action externe, non annulable, texte publié',
    traces.map((t) => [t.outil, t.resume]),
  );
  verifier(traces.every((t) => etatAffiche(t, []).libelle === 'Publié seul'), '« Publié seul » dans Actions de l’IA');
  const etat = m.base.get<EtatRepull>(COLLECTION_ETAT, ID_ETAT);
  verifier(etat?.appelsMois === m.repull.appels.length, `chaque appel compté dans la part du mois (${etat?.appelsMois} / ${m.repull.appels.length})`);

  section('11. Jamais deux fois');
  const avant = m.repull.appels.length;
  const b2 = await passerAvisAuto(m.options(), donnees(m));
  verifier(!b2.lance && m.repull.appels.length === avant, 'même jour, passage complet : rien de relancé');
  m.horloge = new Date('2026-10-29T10:00:00Z');
  const b3 = await passerAvisAuto(m.options(), donnees(m));
  const nouvelles = m.repull.publications().slice(pubs.length);
  verifier(b3.lance && !nouvelles.some((x) => /\/(11|16|18)\//.test(x.chemin)) && nouvelles.every((x) => x.chemin === '/v1/reviews/13/guest-review'), 'lendemain : rien n’est republié (seul le séjour entré dans la fenêtre part)', nouvelles.map((x) => x.chemin));
  // Envoi coupé (réseau) après le dépôt chez Airbnb : la marque « en cours » reste, rien n’est renvoyé ensuite.
  const coupe = resa('res-20', 3);
  m.base.poser('reservations', coupe);
  m.repull.avisHote.set('20', avisHote('20', '20'));
  m.horloge = new Date('2026-10-30T10:00:00Z');
  // Deux coupures : l'envoi et le seul nouvel essai du client perdent leur réponse.
  m.repull.coupures = 2;
  const nPub = m.repull.publications().length;
  await passerAvisAuto(m.options(), donnees(m));
  const lc = m.base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'res-20')!;
  verifier(lc.publication?.statut === 'en_cours', 'envoi coupé : la ligne reste « en cours »', lc.publication);
  m.horloge = new Date('2026-10-31T10:00:00Z');
  await passerAvisAuto(m.options(), donnees(m));
  const lc2 = m.base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'res-20')!;
  verifier(lc2.publication?.statut === 'publie' && lc2.publication.deja && m.repull.publications().length === nPub + 2, 'passage suivant : Airbnb dit qu’il est parti, rien n’est renvoyé', [lc2.publication, m.repull.publications().length - nPub]);
  // 409 review_already_submitted : noté publié, sans erreur.
  const dejaParti = resa('res-21', 3);
  m.base.poser('reservations', dejaParti);
  m.repull.avisHote.set('21', avisHote('21', '21'));
  m.horloge = new Date('2026-11-01T10:00:00Z');
  m.repull.prochaine = { statut: 409, code: 'review_already_submitted' };
  await passerAvisAuto(m.options(), donnees(m));
  verifier(m.base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'res-21')?.publication?.statut === 'publie', '409 « déjà déposé » : noté publié');
  // 409 review_window_closed : délai passé.
  const ferme = resa('res-22', 3);
  m.base.poser('reservations', ferme);
  m.repull.avisHote.set('22', avisHote('22', '22'));
  m.horloge = new Date('2026-11-02T10:00:00Z');
  m.repull.prochaine = { statut: 409, code: 'review_window_closed' };
  await passerAvisAuto(m.options(), donnees(m));
  const lf = m.base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'res-22')!;
  verifier(lf.publication?.statut === 'expire' && lf.statut === 'passe', '409 « délai passé » : expiré', lf.publication);
  // Une seule coupure : le nouvel essai du client reçoit « déjà déposé » (409) et le note publié.
  const coupe2 = resa('res-23', 3);
  m.base.poser('reservations', coupe2);
  m.repull.avisHote.set('23', avisHote('23', '23'));
  m.horloge = new Date('2026-11-03T10:00:00Z');
  m.repull.coupures = 1;
  await passerAvisAuto(m.options(), donnees(m));
  verifier(m.base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'res-23')?.publication?.statut === 'publie', 'coupure puis nouvel essai : « déjà déposé », noté publié (un seul dépôt)');
  // Avis à valider dont le délai d’Airbnb passe : expiré, sans appel.
  m.horloge = new Date('2026-11-10T10:00:00Z');
  await passerAvisAuto(m.options(), donnees(m));
  verifier(m.base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'res-2')?.publication?.statut === 'expire', 'à valider après le délai d’Airbnb : expiré');

  section('12. « Publier » du gérant');
  {
    const g = monde();
    g.base.poser('reglages', reglagesAllumes(true, true));
    const r = resa('res-30', 4, { voyageur: { nom: 'Lucas Petit', nbPersonnes: 2 } });
    g.base.poser('reservations', r);
    g.base.poser(COLLECTION_AVIS_A_DEPOSER, {
      id: 'res-30', reservationId: 'res-30', logementId: 'log-1', voyageur: 'Lucas', depart: r.depart, canal: 'airbnb', statut: 'a_relire', creeLe: '',
      publication: { statut: 'a_valider', avisId: '30', le: '', texte: 'Lucas a séjourné chez nous.', raisons: ['Un incident pendant le séjour'] },
    });
    g.repull.avisHote.set('30', avisHote('30', '30'));
    const qui = { email: 'gerant@exemple.invalid', nom: 'Gérant' };
    const sale = await publierAvisParGerant(g.options(), { genre: 'voyageur', reservationId: 'res-30', texte: 'Écrivez à lucas@exemple.fr' }, qui);
    verifier(!sale.ok && sale.statut === 400 && /e-mail|coordonn/.test(sale.message) && !g.repull.publications().length, 'texte avec un contact : refusé, rien n’est envoyé', sale);
    const ok = await publierAvisParGerant(g.options(), { genre: 'voyageur', reservationId: 'res-30', texte: 'Lucas a séjourné chez nous, merci.' }, qui);
    const pub = g.repull.publications();
    verifier(ok.ok && pub.length === 1 && pub[0].chemin === '/v1/reviews/30/guest-review' && g.repull.appels.some((a) => a.methode === 'GET' && a.chemin === '/v1/reviews/30'), 'publié une fois, après avoir relu l’avis chez Airbnb', ok);
    const l = g.base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'res-30')!;
    verifier(l.publication?.statut === 'publie' && l.publication.par === 'Gérant' && l.publication.modifie && l.statut === 'fait', 'ligne publiée par le gérant, texte retouché noté', l.publication);
    const t = g.base.collection<ActionAgent>(COLLECTION_ACTIONS_AGENT)[0];
    verifier(t?.envoyee?.par === 'gerant@exemple.invalid' && etatAffiche(t, [], () => 'Gérant').libelle.startsWith('Publié par Gérant'), 'trace : « Publié par » le gérant', t);
    const encore = await publierAvisParGerant(g.options(), { genre: 'voyageur', reservationId: 'res-30', texte: 'Encore.' }, qui);
    verifier(!encore.ok && g.repull.publications().length === 1, 'second clic : refusé, rien de renvoyé', encore);
    // Avis relu qui ne correspond pas au séjour : rien n'est publié.
    const r2 = resa('res-31', 4);
    g.base.poser('reservations', r2);
    g.base.poser(COLLECTION_AVIS_A_DEPOSER, { id: 'res-31', reservationId: 'res-31', logementId: 'log-1', voyageur: 'Marie', depart: r2.depart, canal: 'airbnb', statut: 'a_relire', creeLe: '', publication: { statut: 'a_valider', avisId: '30', le: '', texte: 'Texte.' } });
    const autre = await publierAvisParGerant(g.options(), { genre: 'voyageur', reservationId: 'res-31', texte: 'Marie a séjourné chez nous.' }, qui);
    verifier(!autre.ok && /ne correspond pas/.test(autre.message) && g.repull.publications().length === 1, 'avis d’un autre séjour (identifiant glissé dans la base) : refusé', autre);
    // Réglage éteint depuis : rien n'est publié.
    g.base.poser('reglages', reglagesAllumes(false, false));
    const eteint = await publierAvisParGerant(g.options(), { genre: 'voyageur', reservationId: 'res-31', texte: 'Marie a séjourné chez nous.' }, qui);
    verifier(!eteint.ok && /éteinte/.test(eteint.message), 'réglage éteint : « Publier » refusé', eteint);
  }

  section('13. Réponses aux avis : publiées seules si l’avis est positif, le reste à valider');
  {
    const n = monde();
    n.base.poser('reglages', reglagesAllumes(false, true));
    const sejours = [
      resa('res-40', 5),
      resa('res-41', 6, { voyageur: { nom: 'Paul Bernard', nbPersonnes: 2 } }),
      resa('res-42', 6, { canal: 'booking', voyageur: { nom: 'Ana Lopez', nbPersonnes: 2 } }),
      resa('res-43', 7, { voyageur: { nom: 'Nina Roy', nbPersonnes: 2 } }),
      resa('res-44', 7, { canal: 'booking', voyageur: { nom: 'Léa Fabre', nbPersonnes: 2 } }),
      resa('res-45', 8, { voyageur: { nom: 'Tom Hardy', nbPersonnes: 2 } }),
    ];
    for (const r of sejours) n.base.poser('reservations', r);
    n.repull.avisVoyageurs.set('40', avisVoyageur('40', '40', 5, 'Logement très propre, calme et parfaitement situé. Merci !'));
    n.repull.avisVoyageurs.set('41', avisVoyageur('41', '41', 4, 'Très bien, logement propre.'));
    n.repull.avisVoyageurs.set('42', avisVoyageur('42', '42', 10, 'Parfait, propre et calme, rien à redire.', { platform: 'booking.com' }));
    n.repull.avisVoyageurs.set('43', avisVoyageur('43', '43', 2, 'Logement sale et bruyant, très déçus.'));
    n.repull.avisVoyageurs.set('44', avisVoyageur('44', '44', 9.5, 'Superbe séjour, merci !', { platform: 'vrbo' }));
    n.repull.avisVoyageurs.set('45', avisVoyageur('45', '45', 5, 'Parfait !', { response: { body: 'Merci Tom' } }));
    n.ia.reponses.push(
      { texte: 'Bonjour Marie, merci pour votre avis et pour votre séjour. Ravis que le logement vous ait plu. Au plaisir !', sentiment: 'positif', themes: [] },
      { texte: 'Bonjour Paul, merci pour votre avis. Au plaisir.', sentiment: 'neutre', themes: [] },
      { texte: 'Bonjour Ana, merci pour votre avis, appelez-nous au 06 12 34 56 78.', sentiment: 'positif', themes: [] },
      { texte: 'Bonjour Nina, merci pour votre retour.', sentiment: 'negatif', themes: [] },
    );
    const b = await passerAvisAuto(n.options(), donnees(n));
    const pubs = n.repull.publications();
    verifier(b.reponsesPubliees === 1 && pubs.length === 1 && pubs[0].chemin === '/v1/reviews/40/reply' && JSON.stringify(Object.keys(pubs[0].corps as object)) === '["message"]', 'seul l’avis positif reçoit une réponse publiée, corps { message }', [b, pubs.map((x) => x.chemin)]);
    const rep = (id: string) => n.base.get<ReponseAvisAuto>(COLLECTION_REPONSES_AVIS, id);
    verifier(rep('res-40')?.publication.statut === 'publie' && !!rep('res-40')?.publication.texte, 'réponse publiée : ligne « publiée » avec son texte');
    verifier(rep('res-41')?.publication.statut === 'a_valider' && rep('res-41')!.publication.raisons!.includes('Avis mitigé'), '4 sur 5 : à valider (mitigé)', rep('res-41')?.publication);
    verifier(rep('res-42')?.publication.statut === 'a_valider' && rep('res-42')!.publication.raisons!.some((x) => /écartée/.test(x)) && !/06 12/.test(rep('res-42')!.publication.texte ?? ''), 'proposition de l’IA avec un téléphone : écartée, texte simple à valider', rep('res-42')?.publication);
    verifier(rep('res-43')?.publication.statut === 'a_valider' && rep('res-43')!.publication.raisons!.some((x) => /Note de 2/.test(x)), 'avis négatif : à valider', rep('res-43')?.publication);
    verifier(!rep('res-44') && !rep('res-45'), 'VRBO et avis déjà répondu : rien');
    const t = n.base.collection<ActionAgent>(COLLECTION_ACTIONS_AGENT);
    verifier(t.length === 1 && t[0].outil === 'reponse_avis_publiee' && t[0].collection === 'reponsesAvis' && !t[0].annulable, 'réponse publiée tracée (non annulable)', t.map((x) => x.resume));
    // Publier une réponse à valider (gérant), retouchée.
    const qui = { email: 'gerant@exemple.invalid', nom: 'Gérant' };
    const ok = await publierAvisParGerant(n.options(), { genre: 'reponse', reservationId: 'res-41', texte: 'Bonjour Paul, merci pour votre avis et votre séjour. Au plaisir de vous accueillir.' }, qui);
    verifier(ok.ok && n.repull.publications().length === 2 && rep('res-41')?.publication.statut === 'publie' && rep('res-41')?.publication.modifie, 'réponse à valider : publiée par le gérant, retouche notée', ok);
    const prive = await publierAvisParGerant(n.options(), { genre: 'reponse', reservationId: 'res-43', texte: 'Bonjour Nina, écrivez-nous à contact@exemple.fr.' }, qui);
    verifier(!prive.ok && n.repull.publications().length === 2, 'réponse avec un contact : refusée', prive);
    // Lendemain : rien n'est republié.
    n.horloge = new Date('2026-10-29T10:00:00Z');
    await passerAvisAuto(n.options(), donnees(n));
    verifier(n.repull.publications().length === 2, 'lendemain : aucune réponse republiée');
  }

  section('14. IA en panne : rien ne part seul, la suite attend');
  {
    const p = monde();
    p.base.poser('reglages', reglagesAllumes(true, false));
    for (const id of ['50', '51']) {
      p.base.poser('reservations', resa(`res-${id}`, 3));
      p.repull.avisHote.set(id, avisHote(id, id));
    }
    p.ia.avis.push(new Error('overloaded'));
    const b = await passerAvisAuto(p.options(), donnees(p));
    verifier(p.repull.publications().length === 0 && p.base.get<AvisADeposer>(COLLECTION_AVIS_A_DEPOSER, 'res-50')?.publication?.statut === 'a_valider' && !p.base.get(COLLECTION_AVIS_A_DEPOSER, 'res-51') && !b.complet, 'premier séjour gardé (rédaction en panne), le second attend le passage suivant', b);
    // Sans IA du tout : le texte simple, publié pour un séjour sans souci.
    const q = monde();
    q.base.poser('reglages', reglagesAllumes(true, false));
    q.base.poser('reservations', resa('res-60', 3));
    q.repull.avisHote.set('60', avisHote('60', '60'));
    await passerAvisAuto(q.options({ ia: null }), donnees(q));
    const pub = q.repull.publications()[0];
    verifier(!!pub && /voyageur respectueux et agréable/.test((pub.corps as { publicReview: string }).publicReview), 'sans IA : le texte simple de « Votre avis sur le voyageur »', pub?.corps);
  }

  section('15. Part des appels du mois, espaces séparés');
  {
    const p = monde();
    p.base.poser('reglages', reglagesAllumes(true, true));
    p.base.poser('reservations', resa('res-70', 3));
    p.repull.avisHote.set('70', avisHote('70', '70'));
    p.base.poser(COLLECTION_ETAT, { id: ID_ETAT, mois: '2026-10', appelsMois: 400 - RESERVE_APPELS + 1, budgetMois: 400 });
    const b = await passerAvisAuto(p.options(), donnees(p));
    verifier(b.budget && p.repull.appels.length === 0, 'part du mois presque épuisée : la publication attend, aucun appel', b);
    // Deux espaces : chacun sa base, son workspace, ses publications.
    const a = monde('ws-a', 'espace-a');
    const s = monde('ws-b', 'espace-b');
    for (const x of [a, s]) {
      x.base.poser('reglages', reglagesAllumes(true, false));
      x.base.poser('reservations', resa('res-80', 3));
      x.repull.avisHote.set('80', avisHote('80', '80'));
    }
    s.base.poser('reglages', reglagesAllumes(false, false));
    await passerAvisAuto(a.options(), donnees(a));
    await passerAvisAuto(s.options(), donnees(s));
    verifier(a.repull.publications().length === 1 && a.repull.appels.every((x) => x.workspace === 'ws-a') && [...a.base.espaces].every((e) => e === 'espace-a'), 'espace A : publié dans son espace, avec son workspace');
    verifier(s.repull.appels.length === 0 && !s.base.collection(COLLECTION_AVIS_A_DEPOSER).length, 'espace B, réglage éteint : rien, même si l’espace A publie');
  }

  section('16. Passage planifié : la publication remplace la préparation à la main (une seule rédaction)');
  {
    const p = monde();
    p.base.poser('reglages', reglagesAllumes(true, false));
    p.base.poser('reservations', resa('res-90', 3));
    p.repull.avisHote.set('90', avisHote('90', '90'));
    const bilan = await lancerProgrammes(p.options());
    verifier(bilan.avisAuto?.avisPublies === 1 && bilan.avisPrepares === 0 && p.ia.appels.length === 1, 'un seul appel à l’IA : la publication rédige l’avis, la préparation à la main ne passe pas', [bilan.avisAuto, bilan.avisPrepares, p.ia.appels.length]);
    const etat = p.base.get<{ jour?: string; complet?: boolean }>(COLLECTION_ETAT_PROGRAMMES, ID_ETAT_AVIS_AUTO);
    verifier(etat?.jour === AUJOURDHUI && etat.complet === true, 'état du passage gardé (jour, complet)', etat);
  }
}

await passages();

console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
(globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
