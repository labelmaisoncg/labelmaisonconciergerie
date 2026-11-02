/**
 * Vérification du calendrier mensuel de l'ERP (pur, sans réseau) : la vue
 * « Mois » du module Réservations calcule ses mois sur les réservations du
 * store (calendrier-reservations.ts) avec la même grille de jours que
 * l'espace propriétaire, les séjours avec l'identifiant de la réservation et
 * le nom complet du voyageur, hors annulées ; les bandes du composant
 * partagé (calendrier/calendrier-mois.ts) s'y posent telles quelles, avec un
 * seul bouton nommé par séjour ; et les paramètres d'adresse au changement
 * d'onglet (modules/reservations/_composants/outils.ts) gardent le logement
 * venu d'une fiche.
 *
 * Lancement :
 *   node_modules/.bin/esbuild src/erp/data/verifier-calendrier.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-calendrier.mjs \
 *     && node /tmp/verifier-calendrier.mjs
 */
import { bandesDuMois, libelleJour, libelleSejour, ligneChiffres } from '../calendrier/calendrier-mois';
import { parametresOnglet } from '../modules/reservations/_composants/outils';
import { calendrierMoisReservations } from './calendrier-reservations';
import { calendrierMois } from './proprietaire';
import type { Reservation } from './types';

let ok = 0;
let ko = 0;
function verifier(condition: boolean, libelle: string) {
  if (condition) ok++;
  else {
    ko++;
    console.log(`  ✗ ${libelle}`);
  }
}

let n = 0;
const resa = (logementId: string, arrivee: string, depart: string, o: Partial<Reservation> = {}): Reservation => ({
  id: `res-${++n}`,
  logementId,
  canal: 'airbnb',
  voyageur: { nom: 'Camille Martin', nbPersonnes: 3 },
  arrivee,
  depart,
  nuits: Math.round((Date.parse(depart) - Date.parse(arrivee)) / 86_400_000),
  statut: 'terminee',
  montantBrutCentimes: 50_000,
  commissionPlateformeCentimes: 7_500,
  fraisMenageCentimes: 5_000,
  ...o,
});

const reservations: Reservation[] = [
  resa('log-1', '2026-08-10', '2026-08-14'),
  resa('log-1', '2026-08-29', '2026-09-03', { canal: 'booking', voyageur: { nom: '  jean-pierre   de la tour ', nbPersonnes: 2 } }),
  resa('log-1', '2026-08-20', '2026-08-22', { statut: 'annulee' }),
  resa('log-1', '2026-08-25', '2026-08-25', { voyageur: { nom: 'Dates Fausses', nbPersonnes: 1 } }),
  resa('log-1', '2026-08-26', '2026-08-27', { canal: 'direct', voyageur: { nom: '', nbPersonnes: 0 } }),
  resa('log-2', '2026-08-05', '2026-08-09', { voyageur: { nom: 'Autre Logement', nbPersonnes: 2 } }),
];

function main() {
  const aout = calendrierMoisReservations(reservations, 'log-1', '2026-08');
  const ref = calendrierMois(reservations, 'log-1', '2026-08');
  verifier(aout.mois === '2026-08' && aout.jours.length === 31, 'mois : 31 jours, mois rappelé');
  verifier(JSON.stringify(aout.jours) === JSON.stringify(ref.jours) && aout.jours.every((j) => !('hors' in j)), 'jours : la même grille que l’espace propriétaire, sans jour « hors »');
  verifier(aout.nuitsReservees === 4 + 3 + 1 && aout.nuitsLibres === 31 - 8 && Math.abs(aout.occupation - 8 / 31) < 1e-9, 'chiffres : nuits réservées, libres, occupation (annulée et dates fausses ignorées)');
  verifier(ligneChiffres(aout) === '8 nuits réservées · 23 libres · 26 %', 'ligne des chiffres, séparateurs et % insécables');
  verifier(aout.sejours.map((s) => s.id).join() === 'res-1,res-5,res-2', 'séjours : les non annulés du logement qui touchent le mois, par date d’arrivée, avec l’identifiant de la réservation');
  const s1 = aout.sejours[0];
  verifier(s1.voyageur === 'Camille Martin' && s1.nbPersonnes === 3 && s1.canal === 'airbnb' && s1.nuits === 4 && s1.arrivee === '2026-08-10' && s1.depart === '2026-08-14', 'séjour : nom complet, voyageurs, plateforme, nuits, dates');
  verifier(aout.sejours[2].voyageur === 'jean-pierre de la tour' && aout.sejours[2].nuits === 5 && aout.sejours[2].canal === 'booking', 'séjour : nom tel quel (espaces réduits), nuits du séjour entier');
  verifier(aout.sejours[1].voyageur === 'Voyageur' && aout.sejours[1].nbPersonnes === 0 && aout.sejours[1].canal === 'direct', 'séjour sans nom : « Voyageur »');
  verifier(!JSON.stringify(aout).includes('Autre Logement') && !JSON.stringify(aout).includes('res-3') && !JSON.stringify(aout).includes('res-4'), 'rien d’un autre logement, ni annulé, ni dates fausses');
  verifier(!/montant|commission|frais|statut/.test(JSON.stringify(aout)), 'rien d’autre que le calendrier (ni montants, ni statut)');

  const sept = calendrierMoisReservations(reservations, 'log-1', '2026-09');
  verifier(sept.sejours.length === 1 && sept.sejours[0].id === 'res-2' && sept.jours[0].veille && sept.jours.find((j) => j.date === '2026-09-03')?.depart === true, 'mois suivant : le séjour à cheval, avec son identifiant');
  const vide = calendrierMoisReservations(reservations, 'log-1', '2026-13');
  verifier(vide.jours.length === 0 && vide.sejours.length === 0 && ligneChiffres(vide) === '', 'mois illisible : rien');
  verifier(calendrierMoisReservations(reservations, 'log-inconnu', '2026-08').sejours.length === 0 && calendrierMoisReservations([], 'log-1', '2026-08').nuitsLibres === 31, 'logement inconnu ou sans réservation : mois libre');

  /* les bandes du composant partagé sur ces séjours */
  const bandes = bandesDuMois('2026-08', aout.jours, aout.sejours);
  verifier(bandes.length === 4 && bandes.filter((b) => b.libelle).length === 3, 'bandes : une par morceau, le nom une fois par séjour');
  // Séjour du 29 août au 3 sept. sur deux lignes (sam.–dim., puis lun.) : un seul bouton nommé, celui qui porte le nom.
  const deuxLignes = bandes.filter((b) => b.sejour.id === 'res-2');
  verifier(
    deuxLignes.length === 2 && deuxLignes[0].ligne === 4 && deuxLignes[1].ligne === 5 && deuxLignes[0].libelle && deuxLignes[0].nomme && !deuxLignes[1].libelle && !deuxLignes[1].nomme,
    'séjour sur deux lignes : un seul morceau nommé (celui du nom), l’autre reste muet pour le lecteur d’écran',
  );
  verifier(bandes.filter((b) => b.nomme).length === 3 && aout.sejours.every((s) => bandes.filter((b) => b.sejour === s && b.nomme).length === 1), 'chaque séjour du mois a exactement un bouton nommé');
  verifier(bandes[0].sejour.id === 'res-1' && bandes[0].ligne === 2 && bandes[0].de === 0.5 && bandes[0].a === 4.5, 'bande : du milieu du 10 au milieu du 14, identifiant conservé pour ouvrir la fiche');
  verifier(libelleSejour(aout.sejours[0]) === 'Camille Martin, du 10 août au 14 août, 4 nuits', 'libellé de la bande : nom complet');
  verifier(libelleJour(aout.jours.find((j) => j.date === '2026-08-10')!, aout.sejours) === '10 août : arrivée de Camille Martin', 'libellé du jour : nom complet, insécable avant le deux-points');
  // Séjour arrivé le 30 : seule une demi-case est dans ce mois, aucun texte dessus (le libellé du bouton le porte).
  const r30 = resa('log-1', '2026-09-30', '2026-10-02', { voyageur: { nom: 'Mehdi Trente', nbPersonnes: 2 } });
  const fin = calendrierMoisReservations([r30], 'log-1', '2026-09');
  const bf = bandesDuMois('2026-09', fin.jours, fin.sejours);
  const suite = calendrierMoisReservations([r30], 'log-1', '2026-10');
  const bs = bandesDuMois('2026-10', suite.jours, suite.sejours);
  verifier(bf.length === 1 && bf[0].a - bf[0].de === 0.5 && !bf[0].libelle && bs.length === 1 && bs[0].libelle && libelleSejour(fin.sejours[0]) === 'Mehdi Trente, du 30 sept. au 2 oct., 2 nuits', 'morceau d’une demi-case seule : sans texte, nom en octobre, libellé complet au bouton');
  verifier(bf[0].nomme && bs[0].nomme, 'sans morceau qui porte le nom dans le mois : le premier morceau est quand même le bouton nommé');
  // Une nuit du dimanche au lundi : jamais une case entière, le nom reste sur la première demi-case.
  const dim = calendrierMoisReservations([resa('log-1', '2026-09-13', '2026-09-14', { voyageur: { nom: 'Una Nuit', nbPersonnes: 1 } })], 'log-1', '2026-09');
  const bd = bandesDuMois('2026-09', dim.jours, dim.sejours);
  verifier(bd.length === 2 && bd[0].libelle && !bd[1].libelle && bd[0].nomme && !bd[1].nomme, 'une nuit du dimanche au lundi : nom et bouton nommé sur la demi-case du dimanche');

  /* onglets de la page Réservations : `?logement=` (venu d'une fiche logement) suit vers Mois et Séjours */
  const depuisFiche = new URLSearchParams('logement=log-1&q=camille');
  verifier(JSON.stringify(parametresOnglet('mois', depuisFiche)) === JSON.stringify({ vue: 'mois', logement: 'log-1' }), 'onglet Mois depuis une fiche logement : le logement reste présélectionné');
  verifier(JSON.stringify(parametresOnglet('liste', depuisFiche)) === JSON.stringify({ vue: 'liste', logement: 'log-1' }), 'onglet Séjours : le logement suit aussi (la recherche, non)');
  verifier(JSON.stringify(parametresOnglet('calendrier', depuisFiche)) === JSON.stringify({ vue: 'calendrier' }), 'onglet Planning : tous les logements, le filtre tombe');
  verifier(JSON.stringify(parametresOnglet('mois', new URLSearchParams('vue=liste'))) === JSON.stringify({ vue: 'mois' }) && JSON.stringify(parametresOnglet('mois', new URLSearchParams('logement='))) === JSON.stringify({ vue: 'mois' }), 'sans logement (ou vide) : seulement la vue');

  console.log(`${ok} contrôles réussis, ${ko} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = ko ? 1 : 0;
}

main();
