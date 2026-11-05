/**
 * Auto-contrôle des assistants pas à pas de l'ERP (ui/Assistant.tsx), sans
 * réseau : le parcours (Continuer, Retour, Modifier, raison du blocage) et
 * les règles de chaque écran des créations converties (réservation directe,
 * propriétaire, contact du CRM, incident, prestataire, responsable).
 *
 * Surtout : chaque assistant enregistre exactement ce qu'enregistrait
 * l'ancien formulaire. Les anciennes constructions sont recopiées ici telles
 * qu'elles étaient (« ancien… ») et comparées, champ pour champ, à celles des
 * assistants, sur plusieurs saisies.
 *
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-assistants.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-assistants.mjs \
 *     && node /tmp/verifier-assistants.mjs
 */
import { blocage, brouillonModifie, ecranPrecedent, ecranSuivant, libelleSuite, progression, retourPossible } from './parcours-assistant';
import {
  ECRANS_RESERVATION,
  brouillonReservation,
  chevauchements,
  ecranDeLaCle,
  erreursReservation,
  logementsReservables,
  menageDuMandat,
  nuitsReservation,
  recapReservation,
  reservationDepuisBrouillon,
  type BrouillonReservation,
  type ContexteReservation,
} from './creation-reservation';
import { ECRANS_PROPRIETAIRE, creationProprietaire, ecranDuChampProprietaire, erreursEcranProprietaire, recapProprietaire } from './creation-proprietaire';
import { erreursProprietaire, proprietaireDepuisSaisie, saisieProprietaireInitiale, type SaisieProprietaire } from './creation-logement';
import { ECRANS_CONTACT, brouillonContact, contactDepuisBrouillon, doublonContact, erreursContact, recapContact, type BrouillonContact } from './creation-contact';
import {
  ECRANS_INCIDENT,
  brouillonIncident,
  erreursIncident,
  incidentDepuisBrouillon,
  listePreuves,
  recapIncident,
  sejoursConcernes,
  type BrouillonIncident,
} from './creation-incident';
import { ECRANS_PRESTATAIRE, brouillonPrestataire, erreursPrestataire, prestataireDepuisBrouillon, recapPrestataire, type BrouillonPrestataire } from './creation-prestataire';
import {
  EMAIL_RESPONSABLE,
  NOUVELLE_PERSONNE,
  brouillonResponsable,
  ecransResponsable,
  erreursResponsable,
  ficheAvecEmail,
  personnesLibres,
  recapResponsable,
  roleRetenu,
} from './creation-responsable';
import { ECRANS_CHARGE, brouillonCharge, chargeDepuisBrouillon, erreursCharge, recapCharge } from './creation-charge';
import { ECRANS_PROSPECT, brouillonDe, creationProspect, erreursEcranProspect, erreursProspect, recapProspect, versProspect } from './creation-prospect';
import { ECRANS_FACTURE, brouillonFacture, erreursFacture, factureDepuisBrouillon, recapFacture, totauxFacture } from './creation-facture';
import { AUJOURDHUI, ajouterJours, ecartJours, versCentimes } from './format';
import { mandatAuJour } from './selectors';
import { conflits, statutSelonDates } from '../modules/reservations/_composants/outils';
import { telephoneNormalise, trouverDoublon } from './crm';
import type { ContactCrm, Logement, Mandat, Prestataire, Reservation } from './types';
import type { MembreEquipe } from './types-operations';

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}`);
  }
}
const section = (titre: string) => console.log(`\n${titre}`);

/** JSON aux clés triées, champs absents et `undefined` confondus (comme à l'enregistrement). */
const empreinte = (x: unknown): string =>
  JSON.stringify(x, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));
const NBSP = ' ';

/* ================================================================ parcours */

section('Parcours : Continuer, Retour, Modifier');
{
  const E = ['a', 'b', 'c', 'recapitulatif'] as const;
  verifier(ecranSuivant(E, { ecran: 'a', retourRecap: false }).ecran === 'b', 'Continuer : écran suivant');
  verifier(ecranSuivant(E, { ecran: 'c', retourRecap: false }).ecran === 'recapitulatif', 'Continuer au dernier écran : le récapitulatif');
  verifier(ecranSuivant(E, { ecran: 'recapitulatif', retourRecap: false }).ecran === 'recapitulatif', 'au récapitulatif, on y reste (l’action finale est ailleurs)');
  const modifie = { ecran: 'a' as const, retourRecap: true };
  verifier(ecranSuivant(E, modifie).ecran === 'recapitulatif' && !ecranSuivant(E, modifie).retourRecap, 'arrivé par « Modifier » : Continuer ramène au récapitulatif');
  verifier(ecranPrecedent(E, modifie)?.ecran === 'recapitulatif', 'arrivé par « Modifier » : Retour ramène au récapitulatif');
  verifier(ecranPrecedent(E, { ecran: 'a', retourRecap: false }) === undefined, 'premier écran : pas de Retour');
  verifier(ecranPrecedent(E, { ecran: 'c', retourRecap: false })?.ecran === 'b', 'Retour : écran précédent');
  verifier(!retourPossible(E, { ecran: 'a', retourRecap: false }) && retourPossible(E, modifie) && retourPossible(E, { ecran: 'b', retourRecap: false }), 'Retour proposé partout sauf au premier écran');
  verifier(libelleSuite(E, { ecran: 'a', retourRecap: false }, 'Créer') === 'Continuer', 'bouton : « Continuer »');
  verifier(libelleSuite(E, modifie, 'Créer') === 'Revenir au récapitulatif', 'bouton après « Modifier » : « Revenir au récapitulatif »');
  verifier(libelleSuite(E, { ecran: 'recapitulatif', retourRecap: false }, 'Créer') === 'Créer', 'bouton du récapitulatif : l’action finale');
  const pr = progression(E, 'b');
  verifier(pr.rang === 2 && pr.total === 4 && pr.pourcent === 50, `progression : étape 2 sur 4, 50 % (${JSON.stringify(pr)})`);
  // Un écran retiré du parcours par une réponse : on va au récapitulatif, sans planter.
  verifier(ecranSuivant(['a', 'recapitulatif'] as const, { ecran: 'b' as never, retourRecap: false }).ecran === 'recapitulatif', 'écran disparu du parcours : Continuer mène au récapitulatif');
}

section('Parcours : ce qui manque, dit une seule fois');
{
  const erreurs = { nom: 'Indiquez le nom.', email: 'Indiquez son e-mail.' };
  const b0 = blocage(erreurs, () => false);
  verifier(!b0.valide && b0.raison === 'Indiquez le nom.', 'rien de quitté : la première erreur au-dessus de « Continuer »');
  verifier(b0.erreurChamp('nom') === undefined, 'rien de quitté : rien sous les champs');
  const b1 = blocage(erreurs, (k) => k === 'nom');
  verifier(b1.raison === 'Indiquez son e-mail.' && b1.erreurChamp('nom') === 'Indiquez le nom.', 'champ quitté : son erreur sous lui, la suivante au-dessus de « Continuer »');
  const b2 = blocage(erreurs, () => true);
  verifier(!b2.valide && b2.raison === undefined, 'tout est sous les champs : pas de doublon au pied (bouton toujours grisé)');
  verifier(blocage({}, () => false).valide, 'écran complet : « Continuer » permis');
  verifier(!brouillonModifie({ a: '' }, { a: '' }) && brouillonModifie({ a: '' }, { a: 'x' }), 'fermer demande confirmation dès que quelque chose a été saisi');
}

/* ============================================================= réservation */

const L1 = { id: 'log-1', nom: 'T2 Gare', ville: 'Corbeil-Essonnes', statut: 'actif', capacite: 4, proprietaireId: 'pro-1' } as Logement;
const L2 = { id: 'log-2', nom: 'Studio Parc', ville: 'Évry', statut: 'actif', capacite: 2, proprietaireId: 'pro-2' } as Logement;
const L3 = { id: 'log-3', nom: 'Maison en préparation', ville: 'Linas', statut: 'lancement', capacite: 6, proprietaireId: 'pro-1' } as Logement;
const mandats = [
  { id: 'man-1', proprietaireId: 'pro-1', logementId: 'log-1', reference: 'M1', statut: 'signe', commissionPct: 20, fraisMenageCentimes: 5000, dateDebut: '2026-01-01', preavisJours: 30 },
] as Mandat[];
const J = AUJOURDHUI;
const existante = {
  id: 'res-x',
  logementId: 'log-1',
  canal: 'airbnb',
  voyageur: { nom: 'Ana Lopez', nbPersonnes: 2 },
  arrivee: ajouterJours(J, 20),
  depart: ajouterJours(J, 23),
  nuits: 3,
  statut: 'confirmee',
  montantBrutCentimes: 40000,
  commissionPlateformeCentimes: 6000,
  fraisMenageCentimes: 5000,
} as Reservation;
const ctxR: ContexteReservation = { logements: [L1, L2, L3], reservations: [existante], mandats, aujourdhui: J };

/** L'ancien formulaire (ModalNouvelleReservation.tsx avant l'assistant), recopié tel quel. */
function ancienneReservation(f: { logementId: string; arrivee: string; depart: string; nom: string; pays: string; nbPersonnes: string; hebergement: string; menage: string }, id: string): Reservation | Record<string, string> {
  const logement = ctxR.logements.find((l) => l.id === f.logementId);
  const mandat = logement ? mandatAuJour(ctxR.mandats, logement, f.arrivee || AUJOURDHUI) : undefined;
  const menageDefaut = mandat?.fraisMenageCentimes;
  const datesValides = f.arrivee && f.depart && f.depart > f.arrivee;
  const chev = logement && datesValides ? conflits(ctxR.reservations, logement.id, f.arrivee, f.depart) : [];
  const nuits = datesValides ? ecartJours(f.arrivee, f.depart) : 0;
  const err: Record<string, string> = {};
  if (!logement) err.logementId = 'x';
  if (!f.arrivee) err.arrivee = 'x';
  else if (f.arrivee < AUJOURDHUI) err.arrivee = 'x';
  if (!datesValides) err.depart = 'x';
  if (f.nom.trim().length < 2) err.nom = 'x';
  const nb = Number(f.nbPersonnes);
  if (!Number.isInteger(nb) || nb < 1) err.nbPersonnes = 'x';
  else if (logement && nb > logement.capacite) err.nbPersonnes = 'x';
  const heb = versCentimes(f.hebergement);
  if (!Number.isFinite(heb) || heb <= 0) err.hebergement = 'x';
  const men = f.menage.trim() === '' ? (menageDefaut ?? 0) : versCentimes(f.menage);
  if (!Number.isFinite(men) || men < 0) err.menage = 'x';
  if (chev.length) err.depart = 'x';
  if (Object.keys(err).length || !logement) return err;
  return {
    id,
    logementId: logement.id,
    canal: 'direct',
    voyageur: { nom: f.nom.trim(), pays: f.pays.trim() || undefined, nbPersonnes: nb },
    arrivee: f.arrivee,
    depart: f.depart,
    nuits,
    statut: statutSelonDates(f.arrivee, f.depart),
    montantBrutCentimes: heb + men,
    commissionPlateformeCentimes: 0,
    fraisMenageCentimes: men,
  };
}

const resa = (x: Partial<BrouillonReservation> = {}): BrouillonReservation => ({
  ...brouillonReservation(J),
  logementId: 'log-1',
  nom: '  Jean Dupont ',
  hebergement: '360',
  ...x,
});

section('Réservation directe : valeurs de départ et logements réservables');
{
  const b = brouillonReservation(J);
  verifier(b.arrivee === ajouterJours(J, 7) && b.depart === ajouterJours(J, 10) && b.pays === 'France' && b.nbPersonnes === 2 && !b.logementId, 'départ : arrivée J+7, départ J+10, France, 2 voyageurs, aucun logement');
  verifier(logementsReservables([L1, L2, L3]).map((l) => l.id).join() === 'log-1,log-2', 'seuls les logements actifs se réservent');
  verifier(ECRANS_RESERVATION.join() === 'logement,dates,voyageur,montants,recapitulatif', 'écrans : logement, dates, voyageur, montants, récapitulatif');
}

section('Réservation directe : règles de chaque écran');
{
  verifier(erreursReservation('logement', resa({ logementId: '' }), ctxR).logementId, 'aucun logement : bloqué');
  verifier(erreursReservation('logement', resa({ logementId: 'log-3' }), ctxR).logementId, 'logement en préparation : refusé');
  verifier(!Object.keys(erreursReservation('logement', resa(), ctxR)).length, 'logement actif : permis');
  verifier(erreursReservation('dates', resa({ arrivee: ajouterJours(J, -1) }), ctxR).arrivee === 'L’arrivée ne peut pas être dans le passé.', 'arrivée dans le passé : refusée');
  verifier(erreursReservation('dates', resa({ arrivee: '' }), ctxR).arrivee === 'Indiquez la date d’arrivée.', 'arrivée vide : « Indiquez la date d’arrivée. »');
  verifier(erreursReservation('dates', resa({ depart: ajouterJours(J, 7) }), ctxR).depart === 'Le départ doit être après l’arrivée.', 'départ le jour de l’arrivée : refusé');
  const chev = resa({ arrivee: ajouterJours(J, 21), depart: ajouterJours(J, 25) });
  verifier(erreursReservation('dates', chev, ctxR).conflit === 'Ces dates chevauchent une réservation existante.', 'chevauchement : surbooking refusé');
  verifier(chevauchements(chev, ctxR).length === 1 && chevauchements(chev, ctxR)[0].nuits.length === 2, 'chevauchement : la réservation et ses 2 nuits en conflit');
  verifier(!erreursReservation('dates', resa({ arrivee: ajouterJours(J, 23), depart: ajouterJours(J, 25) }), ctxR).conflit, 'arrivée le jour d’un départ : permise');
  verifier(!erreursReservation('dates', resa({ logementId: 'log-2', arrivee: ajouterJours(J, 21), depart: ajouterJours(J, 25) }), ctxR).conflit, 'autre logement aux mêmes dates : permis');
  verifier(!erreursReservation('dates', resa({ arrivee: J, depart: ajouterJours(J, 1) }), ctxR).arrivee, 'arrivée aujourd’hui : permise');
  verifier(erreursReservation('voyageur', resa({ nom: ' ' }), ctxR).nom === 'Indiquez le nom du voyageur.', 'nom vide : « Indiquez le nom du voyageur. »');
  verifier(erreursReservation('voyageur', resa({ nom: 'J' }), ctxR).nom, 'nom d’une lettre : refusé');
  verifier(erreursReservation('voyageur', resa({ nbPersonnes: 5 }), ctxR).nbPersonnes === `Capacité maximale${NBSP}: 4 personnes.`, 'au-delà de la capacité : refusé, avec la capacité');
  verifier(erreursReservation('voyageur', resa({ nbPersonnes: 0 }), ctxR).nbPersonnes === 'Au moins 1 personne.', '0 voyageur : refusé');
  verifier(erreursReservation('montants', resa({ hebergement: '' }), ctxR).hebergement === 'Indiquez le prix des nuits.', 'prix vide : « Indiquez le prix des nuits. »');
  verifier(erreursReservation('montants', resa({ hebergement: '0' }), ctxR).hebergement, 'prix à 0 : refusé');
  verifier(erreursReservation('montants', resa({ hebergement: 'abc' }), ctxR).hebergement, 'prix illisible : refusé');
  verifier(erreursReservation('montants', resa({ menage: '-5' }), ctxR).menage === 'Montant invalide.', 'ménage négatif : refusé');
  verifier(menageDuMandat(resa(), ctxR) === 5000 && menageDuMandat(resa({ logementId: 'log-2' }), ctxR) === undefined, 'ménage par défaut : celui du mandat, rien sans mandat');
  verifier(Object.keys(erreursReservation('recapitulatif', resa({ nom: '', hebergement: '' }), ctxR)).join() === 'nom,hebergement', 'récapitulatif : les erreurs de tous les écrans, dans l’ordre');
  verifier(ecranDeLaCle('conflit') === 'dates' && ecranDeLaCle('hebergement') === 'montants' && ecranDeLaCle('nbPersonnes') === 'voyageur', 'chaque erreur ramène à son écran');
}

section('Réservation directe : même séjour que l’ancien formulaire');
{
  const cas: Partial<BrouillonReservation>[] = [
    {},
    { menage: '45,5', pays: '  Espagne ', nbPersonnes: 3 },
    { logementId: 'log-2', hebergement: '412,50', pays: ' ', nbPersonnes: 1 },
    { arrivee: J, depart: ajouterJours(J, 2), menage: '0' },
    { arrivee: ajouterJours(J, 23), depart: ajouterJours(J, 30), hebergement: '1 200' },
  ];
  for (const x of cas) {
    const b = resa(x);
    const r = reservationDepuisBrouillon(b, { ...ctxR, id: 'res-nouvelle' });
    const avant = ancienneReservation({ ...b, nbPersonnes: String(b.nbPersonnes) }, 'res-nouvelle');
    verifier(r.ok && empreinte(r.reservation) === empreinte(avant), `même séjour enregistré (${JSON.stringify(x)})${r.ok ? '' : ` : ${r.erreur}`}`);
  }
  const ok = reservationDepuisBrouillon(resa(), { ...ctxR, id: 'res-n' });
  if (ok.ok) {
    const r = ok.reservation;
    verifier(r.canal === 'direct' && r.commissionPlateformeCentimes === 0, 'séjour direct, sans commission');
    verifier(r.montantBrutCentimes === 36000 + 5000 && r.fraisMenageCentimes === 5000, 'montants en centimes : nuits + ménage du mandat');
    verifier(r.nuits === 3 && r.statut === 'confirmee', 'à venir : 3 nuits, « confirmée »');
    verifier(r.voyageur.nom === 'Jean Dupont', 'nom du voyageur sans espaces autour');
  } else verifier(false, `séjour valide créé (${ok.erreur})`);
  const encours = reservationDepuisBrouillon(resa({ arrivee: J, depart: ajouterJours(J, 2) }), { ...ctxR, id: 'res-n' });
  verifier(encours.ok && encours.reservation.statut === statutSelonDates(J, ajouterJours(J, 2)) && encours.reservation.statut === 'en_cours', 'arrivée aujourd’hui : statut selon les dates (« en cours »)');
  // Une réservation est arrivée sur ces dates entre-temps : rien n'est créé, retour aux dates.
  const tard = reservationDepuisBrouillon(resa({ arrivee: ajouterJours(J, 21), depart: ajouterJours(J, 22) }), { ...ctxR, id: 'res-n' });
  verifier(!tard.ok && tard.ecran === 'dates', 'chevauchement au dernier moment : rien n’est créé, retour à l’écran des dates');
  verifier(!reservationDepuisBrouillon(resa({ logementId: 'log-3' }), { ...ctxR, id: 'res-n' }).ok, 'logement non actif : rien n’est créé');
  verifier(nuitsReservation(resa({ depart: '' })) === 0, 'dates incomplètes : 0 nuit');
}

section('Réservation directe : récapitulatif');
{
  const lignes = recapReservation(resa({ menage: '' }), ctxR);
  verifier(lignes.map((l) => l.ecran).join() === 'logement,dates,voyageur,montants', 'une ligne par écran, chacune modifiable');
  verifier(lignes[0].valeur === 'T2 Gare (Corbeil-Essonnes)', `logement : nom et ville (${lignes[0].valeur})`);
  verifier(lignes[1].valeur.endsWith('· 3 nuits'), `dates : avec les nuits (${lignes[1].valeur})`);
  verifier(lignes[2].valeur === 'Jean Dupont · France · 2 voyageurs', `voyageur (${lignes[2].valeur})`);
  verifier(/^410,00\s€ \(nuits 360,00\s€, ménage 50,00\s€\)$/.test(lignes[3].valeur), `montant total et détail (${lignes[3].valeur})`);
  verifier(recapReservation(resa({ hebergement: '' }), ctxR)[3].valeur === '', 'montant illisible : « À compléter »');
}

/* ============================================================ propriétaire */

section('Nouveau propriétaire : écrans et règles');
{
  const vide = saisieProprietaireInitiale();
  verifier(ECRANS_PROPRIETAIRE.join() === 'type,nom,contact,adresse,notes,recapitulatif', 'écrans : type, nom, contact, adresse, notes, récapitulatif');
  verifier(!Object.keys(erreursEcranProprietaire('type', vide)).length, 'type : « Particulier » d’office, comme le formulaire');
  verifier(erreursEcranProprietaire('nom', vide).nom === 'Indiquez le nom du propriétaire.', 'nom vide : « Indiquez le nom du propriétaire. »');
  verifier(erreursEcranProprietaire('nom', { ...vide, nom: 'A' }).nom === 'Le nom est obligatoire.', 'nom d’une lettre : règle du formulaire');
  const contact = erreursEcranProprietaire('contact', { ...vide, email: 'pas-un-mail', telephone: '' });
  verifier(contact.email === 'Adresse e-mail invalide.' && contact.telephone === 'Indiquez son téléphone.', 'contact : e-mail invalide, téléphone à indiquer');
  verifier(Object.keys(contact).join() === 'email,telephone', 'contact : dans l’ordre de l’écran');
  verifier(erreursEcranProprietaire('adresse', vide).adresse === 'Indiquez son adresse postale.', 'adresse vide : à indiquer');
  verifier(!Object.keys(erreursEcranProprietaire('notes', vide)).length, 'notes : facultatives');
  verifier(ecranDuChampProprietaire('telephone') === 'contact' && ecranDuChampProprietaire('adresse') === 'adresse', 'chaque erreur ramène à son écran');
}

section('Nouveau propriétaire : même fiche que le formulaire');
{
  const saisies: SaisieProprietaire[] = [
    { type: 'particulier', nom: ' Alice Martin ', email: ' alice@exemple.fr ', telephone: '06 00 00 00 01', adresse: ' 1 rue A, 91100 Corbeil ', notes: ' Préfère le matin ' },
    { type: 'sci', nom: 'SCI Les Tilleuls', email: 'sci@exemple.fr', telephone: '+33 6 00 00 00 02', adresse: '2 rue B', notes: '' },
  ];
  for (const s of saisies) {
    const r = creationProprietaire(s, 'pro-nouveau', '2026-11-05');
    verifier(Object.keys(erreursProprietaire(s)).length === 0, `saisie valide pour le formulaire (${s.nom.trim()})`);
    verifier(r.ok && empreinte(r.proprietaire) === empreinte(proprietaireDepuisSaisie(s, 'pro-nouveau', '2026-11-05')), `même fiche que le formulaire (${s.nom.trim()})`);
  }
  const ko = creationProprietaire({ ...saisieProprietaireInitiale(), nom: 'Bob' }, 'p', '2026-11-05');
  verifier(!ko.ok && ko.ecran === 'contact', 'saisie incomplète : rien n’est créé, retour au premier écran à corriger');
  const recap = recapProprietaire({ ...saisies[1] });
  verifier(recap.find((l) => l.cle === 'nom')?.libelle === 'Raison sociale' && recap.find((l) => l.cle === 'notes')?.valeur === 'Aucune', 'récapitulatif : « Raison sociale » pour une SCI, notes « Aucune »');
}

/* ================================================================ contact */

const contactsExistants = [
  { id: 'crm-1', nom: 'Marc Petit', telephone: '+33 6 12 34 56 78', email: 'marc@exemple.fr', statut: 'a_appeler' },
  { id: 'crm-2', nom: 'Léa Roux', telephone: '06 98 76 54 32', statut: 'signe' },
] as ContactCrm[];

/** L'ancien formulaire « Nouveau contact » (crm/index.tsx), recopié tel quel. */
function ancienContact(f: BrouillonContact, id: string, par: string, maintenant: string): ContactCrm {
  return {
    id,
    nom: f.nom.trim(),
    ...(f.telephone.trim() ? { telephone: f.telephone.trim() } : {}),
    ...(f.email.trim() ? { email: f.email.trim().toLowerCase() } : {}),
    ...(f.ville.trim() ? { ville: f.ville.trim() } : {}),
    ...(f.typeBien.trim() ? { typeBien: f.typeBien.trim() } : {}),
    source: 'manuel',
    statut: 'a_appeler',
    notes: f.notes.trim(),
    tentatives: 0,
    historique: [{ le: maintenant, par, resultat: 'note', texte: 'Contact ajouté à la main.' }],
    creeLe: maintenant,
    majLe: maintenant,
  };
}

section('Nouveau contact : écrans et règles');
{
  const vide = brouillonContact();
  verifier(ECRANS_CONTACT.join() === 'nom,joindre,bien,notes,recapitulatif', 'écrans : nom, joindre, bien, notes, récapitulatif');
  verifier(erreursContact('nom', vide).nom === 'Indiquez son nom.', 'nom vide : bloqué');
  verifier(erreursContact('joindre', vide).joindre === 'Indiquez un téléphone ou un e-mail.', 'ni téléphone ni e-mail : bloqué');
  verifier(!erreursContact('joindre', { ...vide, email: 'a@b.fr' }).joindre && !erreursContact('joindre', { ...vide, telephone: '06' }).joindre, 'un téléphone ou un e-mail suffit (comme avant)');
  verifier(!Object.keys(erreursContact('bien', vide)).length && !Object.keys(erreursContact('notes', vide)).length, 'bien et notes : facultatifs');
  verifier(doublonContact(contactsExistants, { ...vide, telephone: '06 12 34 56 78' })?.id === 'crm-1', 'doublon : même numéro, indicatif ramené à 0');
  verifier(doublonContact(contactsExistants, { ...vide, email: ' MARC@exemple.fr' })?.id === 'crm-1', 'doublon : même e-mail, sans casse');
  verifier(!doublonContact(contactsExistants, { ...vide, telephone: '06 98 76 54 32' }), 'contact signé (clos) : pas de doublon signalé');
  verifier(!doublonContact(contactsExistants, { ...vide, telephone: '06 12' }), 'numéro trop court : rien de comparé');
  // Même règle que l'ancien formulaire (trouverDoublon dès 9 chiffres ou un e-mail).
  const tel = '06 12 34 56 78';
  verifier(doublonContact(contactsExistants, { ...vide, telephone: tel }) === (telephoneNormalise(tel).length >= 9 ? trouverDoublon(contactsExistants, { email: '', telephone: tel }) : undefined), 'doublon : même résultat que l’ancien formulaire');
}

section('Nouveau contact : même ligne que l’ancien formulaire');
{
  const cas: BrouillonContact[] = [
    { nom: ' Paul Martin ', telephone: ' 06 11 22 33 44 ', email: '', ville: '', typeBien: '', notes: '' },
    { nom: 'Inès', telephone: '', email: ' Ines@Exemple.FR ', ville: ' Évry ', typeBien: ' T2 ', notes: ' Rappeler en mars ' },
  ];
  for (const b of cas) {
    const r = contactDepuisBrouillon(b, { id: 'crm-n', par: 'Abdel', maintenant: '2026-11-05T10:30:00+01:00' });
    verifier(r.ok && empreinte(r.contact) === empreinte(ancienContact(b, 'crm-n', 'Abdel', '2026-11-05T10:30:00+01:00')), `même contact enregistré (${b.nom.trim()})`);
  }
  const r = contactDepuisBrouillon(cas[0], { id: 'crm-n', par: 'Abdel', maintenant: 'm' });
  verifier(r.ok && !('email' in r.contact) && !('ville' in r.contact), 'champs vides : absents de la ligne');
  verifier(!contactDepuisBrouillon({ ...cas[0], telephone: '' }, { id: 'x', par: 'a', maintenant: 'm' }).ok, 'ni téléphone ni e-mail : rien n’est créé');
  const recap = recapContact({ ...cas[0] });
  verifier(recap.find((l) => l.cle === 'email')?.valeur === 'Non renseigné' && recap.find((l) => l.cle === 'notes')?.valeur === 'Aucune', 'récapitulatif : facultatifs vides lisibles');
  verifier(recapContact(brouillonContact()).find((l) => l.cle === 'telephone')?.valeur === '', 'récapitulatif : ni téléphone ni e-mail, « À compléter »');
}

/* =============================================================== incident */

const resasIncident = [
  { id: 'r1', logementId: 'log-1', statut: 'terminee', arrivee: '2026-09-01', depart: '2026-09-04', voyageur: { nom: 'A', nbPersonnes: 2 } },
  { id: 'r2', logementId: 'log-1', statut: 'annulee', arrivee: '2026-09-10', depart: '2026-09-12', voyageur: { nom: 'B', nbPersonnes: 2 } },
  { id: 'r3', logementId: 'log-2', statut: 'terminee', arrivee: '2026-09-05', depart: '2026-09-06', voyageur: { nom: 'C', nbPersonnes: 2 } },
  { id: 'r4', logementId: 'log-1', statut: 'confirmee', arrivee: '2026-12-01', depart: '2026-12-04', voyageur: { nom: 'D', nbPersonnes: 2 } },
] as Reservation[];

/** L'ancien formulaire « Signaler un incident », recopié tel quel (ce qu'il passait à creerIncident). */
function ancienIncident(f: BrouillonIncident) {
  const preuves = f.preuves.split(/\s+/).map((u) => u.trim()).filter(Boolean);
  const cout = f.cout.trim() ? versCentimes(f.cout) : undefined;
  return {
    logementId: f.logementId,
    reservationId: f.reservationId || undefined,
    date: f.date,
    categorie: f.categorie,
    gravite: f.gravite,
    description: f.description.trim(),
    responsable: f.responsable || undefined,
    preuves,
    refacturable: f.refacturable,
    coutCentimes: cout,
  };
}

section('Incident : écrans et règles');
{
  const ctxI = { logements: [L1, L2], aujourdhui: '2026-11-05' };
  const b = (x: Partial<BrouillonIncident> = {}): BrouillonIncident => ({ ...brouillonIncident('2026-11-05'), logementId: 'log-1', description: 'Vitre de la douche cassée.', ...x });
  verifier(ECRANS_INCIDENT.length === 8 && ECRANS_INCIDENT[ECRANS_INCIDENT.length - 1] === 'recapitulatif', 'écrans : 7 questions puis le récapitulatif');
  const d0 = brouillonIncident('2026-11-05');
  verifier(d0.date === '2026-11-05' && d0.categorie === 'menage' && d0.gravite === 'moyenne' && d0.refacturable === 'aucun', 'départ : constat du jour, ménage, normal, non refacturé (comme avant)');
  verifier(erreursIncident('logement', b({ logementId: '' }), ctxI).logementId, 'logement manquant : bloqué');
  verifier(erreursIncident('quand', b({ date: '' }), ctxI).date === 'Indiquez la date du constat.', 'date vide : à indiquer');
  verifier(erreursIncident('quand', b({ date: '2026-11-06' }), ctxI).date, 'date dans le futur : refusée');
  verifier(erreursIncident('description', b({ description: 'Cassé' }), ctxI).description === 'Décrivez l’incident (10 caractères minimum).', 'description trop courte : 10 caractères au moins');
  verifier(erreursIncident('description', b({ description: '' }), ctxI).description === 'Décrivez ce qui s’est passé.', 'description vide : « Décrivez ce qui s’est passé. »');
  verifier(erreursIncident('preuves', b({ preuves: 'photo.jpg' }), ctxI).preuves, 'preuve qui n’est pas une adresse : refusée');
  verifier(!erreursIncident('preuves', b({ preuves: 'https://x.fr/a.jpg\ndemo://incidents/log-1/b.jpg stockage://c.pdf' }), ctxI).preuves, 'adresses https, fichiers joints : permis');
  verifier(listePreuves(' https://a.fr\n\nhttps://b.fr ').length === 2, 'preuves : une par ligne, lignes vides ignorées');
  verifier(erreursIncident('cout', b({ cout: 'abc' }), ctxI).cout === 'Montant invalide.' && !erreursIncident('cout', b({ cout: '' }), ctxI).cout, 'coût : illisible refusé, vide permis');
  const sej = sejoursConcernes(resasIncident, { logementId: 'log-1', date: '2026-11-05' });
  verifier(sej.map((r) => r.id).join() === 'r1', 'séjours proposés : du logement, non annulés, arrivés avant le constat');
  for (const x of [{}, { reservationId: 'r1', responsable: 'Inès', preuves: 'https://a.fr/1.jpg\nhttps://a.fr/2.jpg', refacturable: 'voyageur' as const, cout: '120,50', gravite: 'haute' as const, categorie: 'casse' as const }]) {
    const r = incidentDepuisBrouillon(b(x), ctxI);
    verifier(r.ok && empreinte(r.incident) === empreinte(ancienIncident(b(x))), `même incident transmis à creerIncident (${Object.keys(x).length ? 'complet' : 'minimal'})`);
  }
  const r = incidentDepuisBrouillon(b({ description: 'court' }), ctxI);
  verifier(!r.ok && r.ecran === 'description', 'description trop courte : rien n’est créé, retour à son écran');
  const recap = recapIncident(b({ cout: '120', refacturable: 'proprietaire' }), { logements: [L1], reservations: resasIncident });
  verifier(recap.find((l) => l.cle === 'cout')?.valeur.includes('refacturé au propriétaire') === true, `récapitulatif : coût et refacturation (${recap.find((l) => l.cle === 'cout')?.valeur})`);
  verifier(recap.find((l) => l.cle === 'suivi')?.valeur === 'Personne pour l’instant' && recap.find((l) => l.cle === 'preuves')?.valeur === 'Aucune pour l’instant', 'récapitulatif : facultatifs vides lisibles');
}

/* ============================================================ prestataire */

/** L'ancien formulaire « Ajouter un prestataire », recopié tel quel. */
function ancienPrestataire(f: BrouillonPrestataire, id: string): Prestataire {
  const siret = f.siret.replace(/\s/g, '');
  return {
    id,
    nom: f.nom.trim(),
    raisonSociale: f.raisonSociale.trim() || undefined,
    siret,
    type: f.type,
    telephone: f.telephone.trim(),
    email: f.email.trim() || undefined,
    zone: f.zone.split(',').map((v) => v.trim()).filter(Boolean),
    statut: 'actif',
    tarifs: [],
    documents: (['contrat', 'rc_pro', 'urssaf', 'kbis'] as const).map((type) => ({ type, statut: 'manquant' as const })),
    missionsRealisees: 0,
  };
}

section('Prestataire : écrans et règles');
{
  const ok: BrouillonPrestataire = { ...brouillonPrestataire(), nom: ' Nadia Benali ', siret: '123 456 789 00012', telephone: '06 12 34 56 78', zone: ' Corbeil-Essonnes, Évry ,', sansCascade: true };
  verifier(ECRANS_PRESTATAIRE.join() === 'metier,identite,contact,zone,engagement,recapitulatif', 'écrans : métier, identité, contact, zone, engagement, récapitulatif');
  verifier(erreursPrestataire('identite', { ...ok, siret: '123' }).siret === `Le SIRET compte 14 chiffres${NBSP}: pas de prestataire non déclaré.`, 'SIRET incomplet : refusé');
  verifier(erreursPrestataire('identite', { ...ok, siret: '' }).siret === 'Indiquez son SIRET.', 'SIRET vide : à indiquer');
  verifier(erreursPrestataire('identite', { ...ok, nom: 'N' }).nom === 'Nom obligatoire.', 'nom d’une lettre : refusé');
  verifier(!erreursPrestataire('identite', { ...ok, raisonSociale: '' }).raisonSociale, 'raison sociale : facultative');
  verifier(erreursPrestataire('contact', { ...ok, telephone: '12' }).telephone === 'Téléphone invalide.', 'téléphone illisible : refusé');
  verifier(erreursPrestataire('contact', { ...ok, email: 'nadia@' }).email === 'Adresse e-mail invalide.' && !erreursPrestataire('contact', ok).email, 'e-mail : facultatif, mais valide');
  verifier(erreursPrestataire('zone', { ...ok, zone: ' ' }).zone === 'Indiquez au moins une ville.', 'zone vide : refusée');
  verifier(erreursPrestataire('engagement', { ...ok, sansCascade: false }).sansCascade, 'engagement non coché : bloqué');
  verifier(erreursPrestataire('contact', { ...ok, email: ' n@exemple.fr' }).email, 'e-mail avec une espace devant : refusé, comme dans l’ancien formulaire');
  for (const x of [ok, { ...ok, raisonSociale: ' SAS Net ', email: 'n@exemple.fr', type: 'linge' as const }]) {
    const r = prestataireDepuisBrouillon(x, 'pre-n');
    verifier(r.ok && empreinte(r.prestataire) === empreinte(ancienPrestataire(x, 'pre-n')), `même fiche que l’ancien formulaire (${x.type})`);
  }
  const r = prestataireDepuisBrouillon(ok, 'pre-n');
  verifier(r.ok && r.prestataire.documents.every((d) => d.statut === 'manquant') && r.prestataire.zone.join('|') === 'Corbeil-Essonnes|Évry', 'documents manquants, villes nettoyées');
  verifier(!prestataireDepuisBrouillon({ ...ok, sansCascade: false }, 'x').ok, 'sans engagement : rien n’est créé');
  verifier(recapPrestataire(ok).find((l) => l.cle === 'siret')?.valeur === '12345678900012', 'récapitulatif : SIRET sans espaces, comme enregistré');
}

/* ============================================================ responsable */

section('Responsable : écrans et règles');
{
  const equipe = [
    { id: 'eq-1', nom: 'Inès Morel', role: 'agent', email: 'ines@exemple.fr', telephone: '06 00 00 00 01', logementIds: ['log-1'], actif: true },
    { id: 'eq-2', nom: 'Yanis Bel', role: 'pole', email: 'yanis@exemple.fr', logementIds: ['log-2'], actif: true },
    { id: 'eq-3', nom: 'Ancien', role: 'agent', email: 'ancien@exemple.fr', logementIds: [], actif: false },
  ] as MembreEquipe[];
  const libres = personnesLibres(equipe, 'log-1');
  verifier(libres.map((m) => m.id).join() === 'eq-2', 'personnes proposées : actives, qui ne suivent pas encore le logement');
  verifier(ecransResponsable('eq-2').join() === 'qui,recapitulatif', 'personne de l’équipe : la choisir, puis rattacher');
  verifier(ecransResponsable(NOUVELLE_PERSONNE).join() === 'qui,email,identite,logements,recapitulatif', 'nouvelle personne : e-mail, nom et rôle, logements, puis inviter');
  verifier(brouillonResponsable('log-1', libres).choix === '' && brouillonResponsable('log-1', []).choix === NOUVELLE_PERSONNE, 'toute l’équipe suit déjà le logement : « nouvelle personne » d’office');
  verifier(brouillonResponsable('log-1', libres).logementIds.join() === 'log-1', 'le logement de la fiche est coché d’office');
  const ctx = { equipe, libres };
  const b = { ...brouillonResponsable('log-1', libres) };
  verifier(erreursResponsable('qui', b, ctx).choix === 'Choisissez une personne.', 'personne choisie : obligatoire');
  verifier(erreursResponsable('qui', { ...b, choix: 'eq-1' }, ctx).choix, 'personne qui suit déjà le logement : refusée');
  const n = { ...b, choix: NOUVELLE_PERSONNE };
  verifier(erreursResponsable('email', n, ctx).email === 'Indiquez son adresse e-mail.', 'e-mail vide : à indiquer');
  verifier(erreursResponsable('email', { ...n, email: 'a@b' }, ctx).email === 'Adresse e-mail invalide.', 'e-mail invalide : refusé (même règle que Paramètres → Accès)');
  verifier(EMAIL_RESPONSABLE.test('a@b.fr') && !EMAIL_RESPONSABLE.test('a@b.f'), 'règle d’e-mail de Paramètres → Accès');
  verifier(erreursResponsable('identite', { ...n, email: 'nouveau@exemple.fr', nom: '' }, ctx).nom === 'Indiquez le nom.', 'nouvelle fiche : nom obligatoire');
  verifier(!erreursResponsable('identite', { ...n, email: ' YANIS@exemple.fr', nom: '' }, ctx).nom, 'fiche reprise (même adresse) : son nom suffit');
  verifier(ficheAvecEmail(equipe, ' Ines@Exemple.fr ')?.id === 'eq-1', 'fiche reprise : adresse comparée sans casse ni espaces');
  verifier(roleRetenu({ email: 'yanis@exemple.fr' }, equipe) === 'pole' && roleRetenu({ email: 'x@y.fr' }, equipe) === 'agent' && roleRetenu({ email: 'yanis@exemple.fr', role: 'agent' }, equipe) === 'agent', 'rôle : choisi, sinon celui de la fiche reprise, sinon agent');
  verifier(erreursResponsable('logements', { ...n, email: 'x@y.fr', logementIds: [] }, ctx).logementIds === 'Cochez au moins un logement.', 'aucun logement coché : bloqué');
  verifier(!erreursResponsable('logements', { ...n, email: 'yanis@exemple.fr', logementIds: [] }, ctx).logementIds, 'fiche reprise qui suit déjà des logements : permis');
  verifier(Object.keys(erreursResponsable('recapitulatif', { ...b, choix: 'eq-2' }, ctx)).length === 0, 'rattacher une personne libre : rien ne manque');
  const recap = recapResponsable({ ...n, email: 'Yanis@exemple.fr', logementIds: ['log-1'] }, { equipe, logements: [L1, L2] });
  verifier(recap.find((l) => l.cle === 'nom')?.valeur === 'Yanis Bel (fiche reprise)' && recap.find((l) => l.cle === 'logements')?.valeur === 'Studio Parc, T2 Gare', 'récapitulatif : fiche reprise, ses logements et le nouveau');
}

/* ================================================================= charge */

section('Charge : écrans, règles et même ligne que le formulaire');
{
  const b0 = brouillonCharge('2026-11-05');
  verifier(ECRANS_CHARGE.join() === 'libelle,montant,categorie,logement,recapitulatif', 'écrans : libellé, montant, catégorie, logement, récapitulatif');
  verifier(b0.date === '2026-11-05' && b0.categorie === 'produits' && b0.logementId === '', 'départ : aujourd’hui, « Produits », charge générale (comme avant)');
  verifier(erreursCharge('libelle', b0).libelle === 'Indiquez un libellé.', 'libellé vide : bloqué');
  verifier(erreursCharge('montant', { ...b0, montant: '' }).montant === 'Indiquez le montant.', 'montant vide : à indiquer');
  verifier(erreursCharge('montant', { ...b0, montant: '0' }).montant === 'Montant invalide.' && erreursCharge('montant', { ...b0, montant: 'abc' }).montant, 'montant nul ou illisible : refusé');
  verifier(erreursCharge('montant', { ...b0, montant: '12', date: '' }).date === 'Date requise.', 'date vide : refusée');
  const ancienne = (x: typeof b0, id: string) => ({ id, date: x.date, libelle: x.libelle.trim(), categorie: x.categorie, montantCentimes: versCentimes(x.montant), logementId: x.logementId || undefined });
  for (const x of [{ ...b0, libelle: ' Produits d’entretien ', montant: '42,90' }, { ...b0, libelle: 'Assurance', montant: '1 200', categorie: 'assurance' as const, logementId: 'log-1' }]) {
    const r = chargeDepuisBrouillon(x, 'chg-n');
    verifier(r.ok && empreinte(r.charge) === empreinte(ancienne(x, 'chg-n')), `même charge enregistrée (${x.libelle.trim()})`);
  }
  verifier(recapCharge({ ...b0, libelle: 'X', montant: '10' }, [L1]).find((l) => l.cle === 'logement')?.valeur === 'Charge générale', 'récapitulatif : « Charge générale » sans logement');
}

/* =============================================================== prospect */

section('Prospect : écrans, règles et même prospect que le formulaire');
{
  const b0 = brouillonDe({ prochaineAction: 'Premier appel de qualification', prochaineActionLe: '2026-11-05' });
  const ok = { ...b0, nom: ' Mme Garnier ', ville: ' Massy ', typeBien: ' T3 60 m² ', revenu: '18000' };
  verifier(ECRANS_PROSPECT[0] === 'proprietaire' && ECRANS_PROSPECT[ECRANS_PROSPECT.length - 1] === 'recapitulatif', 'écrans : du propriétaire au récapitulatif');
  verifier(erreursEcranProspect('proprietaire', b0).nom === 'Indiquez le nom du propriétaire.', 'nom : obligatoire');
  verifier(Object.keys(erreursEcranProspect('bien', b0)).join() === 'ville,typeBien', 'bien : ville et type, dans l’ordre de l’écran');
  verifier(erreursEcranProspect('revenu', { ...ok, revenu: '0' }).revenu === 'Montant annuel en euros, supérieur à 0.', 'revenu nul : refusé');
  verifier(erreursEcranProspect('action', { ...ok, prochaineAction: '' }).prochaineAction === 'Précisez l’action prévue à cette date.', 'date sans action : refusée');
  verifier(erreursEcranProspect('action', { ...ok, prochaineActionLe: '' }).prochaineActionLe === 'Choisissez une date pour cette action.', 'action sans date : refusée');
  verifier(!Object.keys(erreursEcranProspect('action', { ...ok, prochaineAction: '', prochaineActionLe: '' })).length, 'ni action ni date : permis');
  verifier(JSON.stringify(erreursEcranProspect('recapitulatif', b0)) === JSON.stringify(erreursProspect(b0)), 'récapitulatif : exactement les erreurs du formulaire');
  const r = creationProspect(ok, { id: 'pst-n', creeLe: '2026-11-05' });
  verifier(r.ok && empreinte(r.prospect) === empreinte(versProspect(ok, { id: 'pst-n', creeLe: '2026-11-05' })), 'même prospect que le formulaire');
  verifier(r.ok && r.prospect.revenuEstimeAnnuelCentimes === 1800000 && r.prospect.nom === 'Mme Garnier', 'revenu en centimes, nom sans espaces autour');
  const simulateur = brouillonDe({ ville: 'Évry', typeBien: 'T2 4 pers.', revenuEstimeAnnuelCentimes: 1534000, etape: 'contact', prochaineAction: 'Envoyer l’estimation de revenus', notes: 'Simulation' });
  verifier(simulateur.revenu === '15340' && simulateur.etape === 'contact' && erreursEcranProspect('recapitulatif', simulateur).nom !== undefined, 'pré-rempli par le simulateur : il ne manque que le nom (et la date de l’action)');
  verifier(recapProspect(ok).find((l) => l.cle === 'action')?.valeur.startsWith('Premier appel de qualification, le ') === true, 'récapitulatif : prochaine action et sa date');
}

/* ================================================================ facture */

section('Facture : écrans, règles et même facture que l’ancien formulaire');
{
  const props = [{ id: 'pro-1', nom: 'Alice Martin' }];
  const ctxF = { proprietaires: props };
  const b0 = brouillonFacture('2026-11-05');
  const ok: typeof b0 = { ...b0, proprietaireId: 'pro-1', lignes: [{ libelle: ' Commission octobre ', quantite: '1', pu: '412,50' }, { libelle: 'Ménage', quantite: '2,5', pu: '30' }] };
  verifier(ECRANS_FACTURE.join() === 'type,destinataire,dates,lignes,tva,statut,recapitulatif', 'écrans : type, destinataire, dates, lignes, TVA, envoi, récapitulatif');
  verifier(b0.type === 'commission' && b0.destinataire === 'proprietaire' && b0.echeance === '2026-11-20' && b0.tva === '20' && b0.lignes.length === 1 && b0.statut === 'emise', 'départ : comme l’ancien formulaire (échéance à 15 jours, TVA 20 %)');
  verifier(erreursFacture('destinataire', b0, ctxF).proprietaireId === 'Choisissez le propriétaire destinataire.', 'propriétaire destinataire : à choisir');
  verifier(!erreursFacture('destinataire', { ...b0, destinataire: 'voyageur' }, ctxF).proprietaireId, 'voyageur : pas de propriétaire à choisir');
  verifier(erreursFacture('dates', { ...ok, echeance: '2026-11-01' }, ctxF).echeance === 'L’échéance doit suivre la date d’émission.', 'échéance avant l’émission : refusée');
  verifier(erreursFacture('dates', { ...ok, emission: '' }, ctxF).emission === 'Indiquez la date d’émission.', 'date d’émission vide : à indiquer');
  const l = erreursFacture('lignes', { ...ok, lignes: [{ libelle: '', quantite: '0', pu: '' }] }, ctxF);
  verifier(Object.keys(l).join() === 'ligne-0-libelle,ligne-0-quantite,ligne-0-pu', 'ligne incomplète : désignation, quantité, prix');
  verifier(l['ligne-0-libelle'] === `Ligne 1${NBSP}: désignation manquante.`, 'message de ligne de l’ancien formulaire');
  verifier(!erreursFacture('lignes', { ...ok, type: 'avoir', lignes: [{ libelle: 'Remboursement', quantite: '1', pu: '-50' }] }, ctxF)['ligne-0-pu'], 'avoir : prix négatif permis');
  verifier(erreursFacture('lignes', { ...ok, lignes: [{ libelle: 'X', quantite: '1', pu: '-50' }] }, ctxF)['ligne-0-pu'], 'facture : prix négatif refusé');
  verifier(erreursFacture('tva', { ...ok, tva: '31' }, ctxF).tva === 'Taux de TVA invalide.' && !erreursFacture('tva', { ...ok, tva: '5,5' }, ctxF).tva, 'TVA : de 0 à 30 %, virgule permise');
  const t = totauxFacture(ok);
  verifier(t.ht === 41250 + 7500 && t.tva === 9750 && t.ttc === 58500, `totaux : HT, TVA, TTC (${JSON.stringify(t)})`);
  /** L'ancien formulaire (NouvelleFacture.tsx avant l'assistant), recopié tel quel. */
  const ancienne = (x: typeof b0, statut: 'emise' | 'brouillon') => {
    const lues = x.lignes.map((li) => ({ libelle: li.libelle.trim(), quantite: Number(li.quantite.replace(',', '.')), puCentimes: versCentimes(li.pu) }));
    const totalHt = lues.reduce((s, li) => s + (Number.isFinite(li.quantite) && Number.isFinite(li.puCentimes) ? Math.round(li.quantite * li.puCentimes) : 0), 0);
    return { id: 'fac-n', numero: 'LM-2026-0042', type: x.type, destinataire: x.destinataire, proprietaireId: x.destinataire === 'proprietaire' ? x.proprietaireId : undefined, dateEmission: x.emission, echeance: x.echeance, montantHtCentimes: totalHt, tvaPct: Number(x.tva.replace(',', '.')), statut, lignes: lues };
  };
  const cas: [typeof b0, 'emise' | 'brouillon'][] = [
    [ok, 'emise'],
    [{ ...ok, statut: 'brouillon', destinataire: 'voyageur', tva: '10' }, 'brouillon'],
    [{ ...ok, type: 'avoir', lignes: [{ libelle: 'Avoir', quantite: '1', pu: '-80' }] }, 'emise'],
  ];
  for (const [x, statut] of cas) {
    const r = factureDepuisBrouillon(x, { ...ctxF, id: 'fac-n', numero: 'LM-2026-0042' });
    verifier(r.ok && empreinte(r.facture) === empreinte(ancienne(x, statut)), `même facture (${x.type}, ${statut})`);
  }
  verifier(recapFacture(ok, props).find((x) => x.cle === 'lignes')?.valeur.split('\n').length === 2, 'récapitulatif : une ligne par ligne de facture');
}

console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
(globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
