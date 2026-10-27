/**
 * Auto-contrôle des prix conseillés (A7), du prévisionnel (A14) et des
 * anomalies (A9), sans réseau : trous, nuits proches qui ne se vendent
 * pas, forte demande, plancher et écart maximal respectés, rien sans
 * données suffisantes, notification du matin une seule fois par jour,
 * double réservation, prix inhabituel, départ sans personne en charge,
 * occupation jamais à 0 % avec des séjours (logement « en pause »), et
 * aucune écriture vers les plateformes.
 *
 * Lancement (Node 18+, depuis la racine du dépôt) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-prix-conseils.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-prix-conseils.mjs \
 *     && node /tmp/verifier-prix-conseils.mjs
 */
import { detecterAnomalies } from './anomalies';
import { jourDemande, paques } from './calendrier-fr';
import { mesurer as mesurerMcp } from './cm-mcp';
import { mesurerOccupation } from './occupation';
import { previsionLogement, previsionParc } from './previsionnel';
import { conseillerPrix, conseilsParNuit, decider, lireElementsPrix, plusJours, reglagesPrix, type ElementPrix, type EntreesConseils, type SourceMarche } from './prix-conseils';
import { INTERVALLE_ANOMALIES_MS, passerDansEspace, planifierPassage, travauxDus, type BasePassagePrix } from './prix-passage';
import type { GroupeNotification } from './notifications';
import { DATE_DEMO } from './format';
import { conseilsDuJour } from '../modules/logements/_composants/prix';
import { elementsPrixEtAnomalies } from '../modules/tableau-de-bord/_composants/aTraiterAnalyse';
import { ecritureRepullPermise } from './repull-synchro';
import { indicateurs } from './selectors';
import { creerSeed } from './seed';
import { mesurer as mesurerAccueil } from '../modules/tableau-de-bord/_composants/calculs';
import type { Logement, Reservation } from './types';
import type { AffectationLogement, MembreEquipe } from './types-operations';

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

/* ------------------------------------------------------------ jeu d'essai */

const J = '2026-10-05'; // lundi
const MAINTENANT = '2026-10-05T09:00:00+02:00';
const j = (n: number) => plusJours(J, n);

/** Logement avec 60 jours de prix lus (tous libres) au prix donné. */
function logement(id: string, x: Partial<Logement> = {}, prix = 10000): Logement {
  return {
    id,
    nom: `Logement ${id}`,
    adresse: '',
    ville: 'Évry',
    codePostal: '91000',
    type: 'T2',
    surfaceM2: 40,
    capacite: 4,
    chambres: 1,
    lits: [],
    statut: 'actif',
    proprietaireId: 'p',
    residencePrincipale: false,
    serrure: 'boite_a_cles',
    fiche: { wifiNom: '', wifiCode: '', heureArrivee: '', heureDepart: '', acces: '', parking: '', regles: '', equipements: [] },
    dotationLinge: [],
    annonces: [{ canal: 'airbnb', url: 'https://www.airbnb.fr/rooms/123', connecte: true }],
    checklistLancement: [],
    tarifs: { devise: 'EUR', luLe: '2026-10-05T06:00:00+02:00', jours: Array.from({ length: 60 }, (_, k) => ({ date: j(k), prixCentimes: prix, libre: true })) },
    ...x,
  } as Logement;
}

let n = 0;
/** Séjour à 100 € la nuit (+ 50 € de ménage) par défaut. */
function resa(logementId: string, arrivee: string, nuits: number, x: Partial<Reservation> = {}): Reservation {
  n++;
  return {
    id: `r${n}`,
    logementId,
    canal: 'airbnb',
    voyageur: { nom: `Voyageur ${n}`, nbPersonnes: 2 },
    arrivee,
    depart: plusJours(arrivee, nuits),
    nuits,
    statut: arrivee < J ? 'terminee' : 'confirmee',
    montantBrutCentimes: nuits * 10000 + 5000,
    commissionPlateformeCentimes: 0,
    fraisMenageCentimes: 5000,
    ...x,
  };
}

/** Historique : 90 jours passés occupés à 80 % (4 nuits réservées, 1 libre), à 100 € la nuit. */
function historique(logementId: string): Reservation[] {
  const liste: Reservation[] = [];
  for (let d = j(-90); d < J; d = plusJours(d, 5)) liste.push(resa(logementId, d, 4));
  return liste;
}

/** Les nuits de prix lus marquées prises là où un séjour les occupe. */
function caler(l: Logement, resas: Reservation[]): Logement {
  const siennes = resas.filter((r) => r.logementId === l.id && r.statut !== 'annulee');
  return { ...l, tarifs: { ...l.tarifs!, jours: l.tarifs!.jours.map((x) => ({ ...x, libre: x.libre && !siennes.some((r) => r.arrivee <= x.date && x.date < r.depart) })) } };
}

/* Le logement A : nuits proches libres (J à J+9), un trou d'une nuit (J+13), un trou de deux (J+22, J+23),
   trois nuits libres sans trou (J+32 à J+34). B à E : comparables, occupés autour de J+40 (forte demande). */
const resasA = [
  ...historique('A'),
  resa('A', j(10), 3),
  resa('A', j(14), 8),
  resa('A', j(24), 8),
  resa('A', j(35), 5),
  resa('A', j(43), 4),
];
const autres = ['B', 'C', 'D', 'E'].flatMap((id) => [...historique(id), resa(id, j(0), 30), resa(id, j(36), 10)]);
const TOUTES = [...resasA, ...autres];
const PARC = ['A', 'B', 'C', 'D', 'E'].map((id) => caler(logement(id), TOUTES));
const base: EntreesConseils = { logements: PARC, reservations: TOUTES, aujourdhui: J, maintenant: MAINTENANT, reglages: { confianceMin: 0 } };
const nuitsDe = (e: EntreesConseils, id = 'A') => conseilsParNuit(e).filter((c) => c.logementId === id);
const nuit = (e: EntreesConseils, d: string, id = 'A') => nuitsDe(e, id).find((c) => c.nuit === d);

section('Calendrier français');
{
  verifier(paques(2026) === '2026-04-05' && paques(2027) === '2027-03-28', `Pâques 2026 et 2027 (${paques(2026)}, ${paques(2027)})`);
  verifier(jourDemande('2026-11-10').ferie === 'Armistice', 'veille du 11 novembre : jour férié');
  verifier(jourDemande('2026-10-20').vacances === 'vacances de la Toussaint' && !jourDemande('2026-11-05').vacances, 'vacances de la Toussaint (zone C)');
  verifier(jourDemande('2026-10-09').weekend && jourDemande('2026-10-10').weekend && !jourDemande('2026-10-11').weekend, 'nuits de week-end : vendredi et samedi');
}

section('Trous dans le calendrier');
{
  const t1 = nuit(base, j(13));
  verifier(t1?.type === 'trou' && t1.prixConseille === 8500, `1 nuit entre deux séjours : trou, 100 € → 85 € (${JSON.stringify(t1)})`);
  verifier(nuit(base, j(22))?.type === 'trou' && nuit(base, j(23))?.type === 'trou', '2 nuits entre deux séjours : trou');
  const plage = conseillerPrix(base).find((p) => p.logementId === 'A' && p.debut === j(22));
  verifier(plage?.nuits === 2 && plage.fin === j(24) && /^Trou dans le calendrier : proposez 85 € du 27 au 29 oct\. pour le combler\.$/.test(plage.raison), `une plage de 2 nuits, une phrase (${plage?.raison})`);
  verifier(![32, 33, 34].some((k) => nuit(base, j(k))?.type === 'trou'), '3 nuits libres : pas un trou');
  const avecMin = conseillerPrix({ ...base, logements: PARC.map((l) => (l.id === 'A' ? { ...l, descriptif: { sejour: { nuitsMin: 3 } } } : l)) }).find((p) => p.logementId === 'A' && p.debut === j(13));
  verifier(/et acceptez 1 nuit minimum\.$/.test(avecMin?.raison ?? ''), `minimum de 3 nuits : « acceptez 1 nuit minimum » (${avecMin?.raison})`);
}

section('Nuits proches qui ne se vendent pas → baisse');
{
  const n0 = nuit(base, j(0));
  const n5 = nuit(base, j(5));
  const n9 = nuit(base, j(9));
  verifier(n0?.type === 'baisse' && n0.prixConseille === 8500, `ce soir, libre : −15 % (${JSON.stringify(n0)})`);
  verifier(n5?.type === 'baisse' && n5.prixConseille === 9000, `dans 5 jours : −10 % (${n5?.prixConseille})`);
  verifier(n9?.type === 'baisse' && n9.prixConseille === 9400, `dans 9 jours : −6 % (${n9?.prixConseille})`);
  const p = conseillerPrix(base).find((x) => x.logementId === 'A' && x.debut === J);
  verifier(!!p && p.type === 'baisse' && p.raison.startsWith('Peu de demande : Logement A reste vide') && p.raison.includes('baissez à 85 €'), `phrase : ${p?.raison}`);
  // Même logement presque plein autour : pas de baisse.
  const plein = [...historique('A'), resa('A', j(0), 4), resa('A', j(5), 5)];
  const lPlein = caler(logement('A'), plein);
  verifier(nuit({ ...base, logements: [lPlein, ...PARC.slice(1)], reservations: [...plein, ...autres] }, j(4))?.type !== 'baisse', 'une nuit libre entre deux séjours n’est pas « invendue »');
}

section('Forte demande et prix bas → hausse');
{
  // J+40 à J+42 : A libre, B à E réservés (4 sur 5 = 80 %).
  const h = nuit(base, j(41));
  verifier(h?.type === 'hausse' && h.motif === 'demande' && h.prixConseille === 11000, `parc réservé à 80 % : +10 % (${JSON.stringify(h)})`);
  const p = conseillerPrix(base).find((x) => x.logementId === 'A' && x.motif === 'demande');
  verifier(!!p && p.raison.startsWith('Forte demande : montez Logement A à 110 €'), `phrase : ${p?.raison}`);
  // Prix actuel à 80 € loin dans le temps, d'habitude 100 € : remonter, dans la limite de 20 %.
  const bas = PARC.map((l) => (l.id === 'A' ? { ...l, tarifs: { ...l.tarifs!, jours: l.tarifs!.jours.map((x) => (x.date === j(33) ? { ...x, prixCentimes: 8000 } : x)) } } : l));
  const n33 = nuit({ ...base, logements: bas }, j(33));
  verifier(n33?.type === 'hausse' && n33.motif === 'niveau' && n33.prixConseille === 9600, `sous le prix habituel : 80 € → 96 € (+20 % au plus) (${JSON.stringify(n33)})`);
}

section('Plancher, plafond et écart maximal');
{
  const plancher = { ...base, reglages: { confianceMin: 0, parLogement: { A: { plancher: 9000 } } } };
  const tous = nuitsDe(plancher);
  verifier(tous.length > 0 && tous.every((c) => c.prixConseille >= 9000), `jamais sous le plancher de 90 € (${Math.min(...tous.map((c) => c.prixConseille))})`);
  verifier(nuit(plancher, j(0))?.prixConseille === 9000, 'ce soir : 90 € (plancher) au lieu de 85 €');
  const aPlancher = { ...plancher, reglages: { confianceMin: 0, parLogement: { A: { plancher: 10000 } } } };
  verifier(!nuitsDe(aPlancher).some((c) => c.type !== 'hausse'), 'déjà au plancher : aucune baisse ni trou');
  const plafond = nuit({ ...base, reglages: { confianceMin: 0, parLogement: { A: { plafond: 10500 } } } }, j(41));
  verifier(plafond?.prixConseille === 10500, `jamais au-dessus du plafond de 105 € (${plafond?.prixConseille})`);
  const max5 = nuitsDe({ ...base, reglages: { confianceMin: 0, variationMaxPct: 5 } });
  verifier(max5.length > 0 && max5.every((c) => Math.abs(c.prixConseille - c.prixActuel) <= c.prixActuel * 0.05), `écart maximal de 5 % respecté (${max5.map((c) => c.variationPct).join(',')})`);
  verifier(nuitsDe(base).every((c) => Math.abs(c.prixConseille - c.prixActuel) <= c.prixActuel * 0.2 + 1), 'écart maximal par défaut (20 %) respecté');
  verifier(reglagesPrix({ variationMaxPct: 500, horizonJours: 400, parLogement: { A: { plancher: 9000, plafond: 8000 } } }).variationMaxPct === 50 && reglagesPrix({ horizonJours: 400 }).horizonJours === 60 && !reglagesPrix({ parLogement: { A: { plancher: 9000, plafond: 8000 } } }).parLogement.A.plafond, 'réglages bornés (50 %, 60 jours, plafond sous le plancher ignoré)');
  const horizon = nuitsDe({ ...base, reglages: { confianceMin: 0, horizonJours: 14 } });
  verifier(horizon.length > 0 && horizon.every((c) => c.nuit < j(14)), 'horizon de 14 jours respecté');
  verifier(conseillerPrix({ ...base, reglages: { actif: false } }).length === 0, 'conseils en pause : rien');
}

section('Pas assez de données : aucun conseil');
{
  // F : pas d'historique, aucun logement comparable (10 voyageurs, Paris), pas de source de marché.
  const F = logement('F', { capacite: 10, codePostal: '75014', ville: 'Paris' });
  const e = { ...base, logements: [...PARC, F] };
  verifier(nuitsDe(e, 'F').length === 0, 'sans historique ni comparable : aucun conseil');
  const peu = [resa('F', j(-20), 3), resa('F', j(-10), 3)];
  verifier(nuitsDe({ ...e, reservations: [...TOUTES, ...peu] }, 'F').length === 0, '6 nuits vendues seulement : aucun conseil');
  const vieux = PARC.map((l) => (l.id === 'A' ? { ...l, tarifs: { ...l.tarifs!, luLe: '2026-09-30T06:00:00+02:00' } } : l));
  verifier(nuitsDe({ ...base, logements: vieux }).length === 0, 'prix lus il y a 5 jours : aucun conseil');
  verifier(nuitsDe({ ...base, logements: PARC.map((l) => (l.id === 'A' ? { ...l, statut: 'sorti' } : l)) }).length === 0, 'logement sorti : aucun conseil');
  // Une source du marché (interface prête, aucune branchée en vrai) suffit à donner une référence.
  const marche: SourceMarche = { nom: 'Essai', prixMarche: () => ({ prix: 15000, fiabilite: 1 }) };
  const avecMarche = nuitsDe({ ...e, marche: [marche] }, 'F');
  verifier(avecMarche.length > 0 && avecMarche.every((c) => c.type === 'hausse'), `source de marché branchée : référence à 150 €, hausses (${avecMarche.length})`);
  const surs = conseillerPrix({ ...base, reglages: { confianceMin: 0.9 } });
  verifier(conseillerPrix(base).every((c) => c.confiance >= 0 && c.confiance <= 1) && surs.every((c) => c.confiance >= 0.9) && surs.length < conseillerPrix(base).length, 'confiance entre 0 et 1, et filtrée par le minimum');
}

section('« C’est fait » et « Ignorer »');
{
  const p = conseillerPrix(base).find((x) => x.logementId === 'A' && x.debut === j(13))!;
  const ignore = decider(p, 'ignore', { le: MAINTENANT, par: 'Abdel' });
  verifier(!conseillerPrix({ ...base, decisions: [ignore] }).some((x) => x.cle === p.cle), 'ignoré : ne revient pas');
  const fait = decider(p, 'fait', { le: '2026-10-03T10:00:00+02:00', par: 'Abdel' });
  verifier(!conseillerPrix({ ...base, decisions: [fait] }).some((x) => x.cle === p.cle), 'fait il y a 2 jours : pas de nouveau conseil (temps de la mise à jour)');
  const ancien = decider(p, 'fait', { le: '2026-09-30T10:00:00+02:00', par: 'Abdel' });
  verifier(conseillerPrix({ ...base, decisions: [ancien] }).some((x) => x.cle === p.cle), 'fait il y a 5 jours et toujours au même prix : le conseil revient');
  const { decisions, reglages } = lireElementsPrix([ignore, { ...reglagesPrix({ variationMaxPct: 10 }) }] as ElementPrix[]);
  verifier(decisions.length === 1 && reglages.variationMaxPct === 10, 'collection lue : décisions et réglages');
}

section('Notification du matin : une seule fois par jour');
{
  const entrees = { logements: PARC, reservations: TOUTES, elements: [] as ElementPrix[] };
  const tot = planifierPassage({ ...entrees, maintenant: new Date('2026-10-05T05:30:00Z') });
  verifier(tot.notifications.length === 0 && tot.ecritures.length === 0 && !!tot.raison, 'avant 8 h à Paris : rien');
  const p1 = planifierPassage({ ...entrees, maintenant: new Date('2026-10-05T07:00:00Z') });
  const notif = p1.notifications.find((x) => x.cle === 'prix-2026-10-05');
  verifier(!!notif && notif.variantes[0].type === 'prix' && /^\d+ logements : prix à revoir$|^Prix à revoir · /.test(notif.variantes[0].titre), `9 h : une notification groupée (${notif?.variantes[0].titre})`);
  verifier(!!notif && /^\/erp\/logements\/[^/]+#prix$/.test(notif.variantes[0].url), `elle ouvre le logement (${notif?.variantes[0].url})`);
  verifier(p1.ecritures.length === 1 && p1.ecritures[0].dernierCalcul === '2026-10-05' && (p1.ecritures[0].historique ?? []).length === 1, 'état écrit : jour calculé et historique');
  const p2 = planifierPassage({ ...entrees, elements: [...p1.ecritures], maintenant: new Date('2026-10-05T07:30:00Z') });
  verifier(!p2.notifications.some((x) => x.cle.startsWith('prix-')) && p2.conseils.length === 0, 'même jour, passage suivant : ni nouveau calcul ni notification');
  const p3 = planifierPassage({ ...entrees, elements: [...p1.ecritures], maintenant: new Date('2026-10-06T07:00:00Z') });
  verifier(p3.notifications.some((x) => x.cle === 'prix-2026-10-06'), 'le lendemain : nouvelle notification');
  const sansNotif = planifierPassage({ ...entrees, elements: [reglagesPrix({ notifications: false })], maintenant: new Date('2026-10-05T07:00:00Z') });
  verifier(!sansNotif.notifications.some((x) => x.cle.startsWith('prix-')) && sansNotif.ecritures.length === 1, 'notification coupée par le gérant : calcul seul');
  const sansCles = planifierPassage({ ...entrees, maintenant: new Date('2026-10-05T07:00:00Z'), notifier: false });
  verifier(sansCles.notifications.length === 0 && sansCles.ecritures[0]?.historique?.[0]?.notifie === false, 'sans clés de notification : calcul et historique seulement');
}

section('Anomalies');
{
  const L = logement('L');
  const r1 = resa('L', j(5), 3, { canal: 'airbnb' });
  const r2 = resa('L', j(7), 2, { canal: 'booking' });
  const r3 = resa('L', j(9), 2, { canal: 'airbnb' });
  const anomalies = (x: Partial<Parameters<typeof detecterAnomalies>[0]>) => detecterAnomalies({ logements: [L], reservations: [], aujourdhui: J, maintenant: MAINTENANT, ...x });
  const doubles = anomalies({ reservations: [r1, r2, r3] }).filter((a) => a.type === 'chevauchement');
  verifier(doubles.length === 1 && doubles[0].grave && doubles[0].id === `chevauchement-${[r1.id, r2.id].sort().join('-')}` && doubles[0].detail.startsWith('Airbnb et Booking.com se chevauchent'), `Airbnb et Booking.com sur la même nuit : double réservation (${doubles[0]?.detail})`);
  verifier(!anomalies({ reservations: [r1, { ...r2, statut: 'annulee' }, r3] }).some((a) => a.type === 'chevauchement'), 'séjour annulé, ou départ le jour d’une arrivée : pas de chevauchement');

  const prixEtranges = { ...L, tarifs: { ...L.tarifs!, jours: L.tarifs!.jours.map((x, k) => (k === 10 ? { ...x, prixCentimes: 1900 } : k === 20 ? { ...x, prixCentimes: 30000 } : k === 30 ? { ...x, prixCentimes: 24000 } : x)) } };
  const etrange = anomalies({ logements: [prixEtranges] }).find((a) => a.type === 'prix_anormal');
  verifier(!!etrange && !etrange.grave && etrange.detail.startsWith('19 € la nuit du 15 oct. (et 1 autre nuit), d’habitude 100 €'), `19 € et 300 € pour 100 € d’habitude : prix inhabituel (${etrange?.detail})`);
  verifier(!anomalies({ logements: [L] }).some((a) => a.type === 'prix_anormal'), 'prix réguliers : rien');
  verifier(!nuitsDe({ ...base, logements: PARC.map((l) => (l.id === 'A' ? { ...l, tarifs: { ...l.tarifs!, jours: l.tarifs!.jours.map((x) => (x.date === j(41) ? { ...x, prixCentimes: 1900 } : x)) } } : l)) }).some((c) => c.nuit === j(41)), 'une nuit à 19 € (faute de frappe) n’est pas une base de conseil');

  const equipe: MembreEquipe[] = [
    { id: 'm1', nom: 'Clara Dumas', role: 'agent', logementIds: ['L'], actif: true },
    { id: 'm2', nom: 'Yanis Lefort', role: 'agent', logementIds: ['L'], actif: true },
  ];
  const depart = resa('L', j(-2), 3);
  const sans = anomalies({ reservations: [depart], equipe, affectations: [], absences: [] }).find((a) => a.type === 'sans_charge');
  verifier(!!sans && sans.grave && sans.titre.startsWith('Départ demain sans personne en charge'), `départ demain, deux agents sans choix : alerte (${sans?.titre})`);
  const affectations: AffectationLogement[] = [{ id: 'L', responsableId: 'm1' }];
  verifier(!anomalies({ reservations: [depart], equipe, affectations, absences: [] }).some((a) => a.type === 'sans_charge'), 'quelqu’un est choisi : rien');
  verifier(!anomalies({ reservations: [resa('L', j(-2), 6)], equipe, affectations: [], absences: [] }).some((a) => a.type === 'sans_charge'), 'départ dans 4 jours : pas encore');

  const jourMeme = resa('L', j(1), 9, { repull: { id: 'x', reserveeLe: '2026-10-06T07:12:00Z', voyageurId: 'v-neuf' } });
  const suspecte = anomalies({ reservations: [jourMeme] }).find((a) => a.type === 'reservation_suspecte');
  verifier(!!suspecte && suspecte.grave && suspecte.detail.includes('réservée le jour même pour 9 nuits par un nouveau voyageur'), `réservée le jour de l’arrivée, 9 nuits, nouveau voyageur (${suspecte?.detail})`);
  const habitue = resa('L', j(-60), 2, { repull: { id: 'y', voyageurId: 'v-neuf' } });
  verifier(!anomalies({ reservations: [jourMeme, habitue] }).some((a) => a.type === 'reservation_suspecte'), 'voyageur déjà venu : rien');
  const incoherente = resa('L', j(3), 2, { commissionPlateformeCentimes: 90000 });
  const mont = anomalies({ reservations: [incoherente] }).find((a) => a.type === 'reservation_suspecte');
  verifier(!!mont && !mont.grave && mont.detail.includes('commission ou ménage plus élevés que le total'), `montants incohérents (${mont?.detail})`);

  verifier(anomalies({ derniereSynchro: '2026-10-04T03:00:00+02:00' }).some((a) => a.type === 'synchro_ancienne') && !anomalies({ derniereSynchro: '2026-10-05T06:00:00+02:00' }).some((a) => a.type === 'synchro_ancienne'), 'plateformes pas mises à jour depuis plus de 24 h');
  const orpheline = resa('inconnu', j(-10), 4);
  const integrite = anomalies({ reservations: [orpheline] }).find((a) => a.type === 'integrite');
  verifier(!!integrite && integrite.detail.startsWith('4 nuits réservées ne sont pas comptées'), `séjour d’un logement inconnu : occupation à vérifier (${integrite?.detail})`);

  // Passage du matin : une anomalie grave notifiée une seule fois.
  const entrees = { logements: [L], reservations: [r1, r2], elements: [] as ElementPrix[] };
  const a1 = planifierPassage({ ...entrees, maintenant: new Date('2026-10-05T07:00:00Z') });
  const n1 = a1.notifications.find((x) => x.cle.startsWith('anomalies-'));
  verifier(!!n1 && n1.urgente && n1.variantes[0].type === 'anomalie' && n1.variantes[0].titre.startsWith('Risque de double réservation'), `double réservation : notifiée, urgente (${n1?.variantes[0].titre})`);
  const a2 = planifierPassage({ ...entrees, elements: a1.ecritures, maintenant: new Date('2026-10-05T07:30:00Z') });
  verifier(!a2.notifications.length && !a2.dus.anomalies && !a2.ecritures.length, 'une demi-heure après : pas de nouvelle recherche des anomalies');
  const a3 = planifierPassage({ ...entrees, elements: a1.ecritures, maintenant: new Date('2026-10-05T08:30:00Z') });
  verifier(a3.dus.anomalies && !a3.notifications.length && a3.ecritures[0]?.anomaliesVerifieesLe === '2026-10-05T08:30:00.000Z', 'une heure et demie après : recherchée de nouveau, déjà notifiée, pas une seconde fois');
}

section('Anomalies : au plus une recherche par heure et par espace');
{
  const etat = (le?: string, jour = '2026-10-05') => ({ id: 'etat' as const, genre: 'etat' as const, dernierCalcul: jour, ...(le ? { anomaliesVerifieesLe: le } : {}) });
  verifier(travauxDus(etat(), new Date('2026-10-05T07:10:00Z')).anomalies, 'jamais recherchées : dues');
  verifier(!travauxDus(etat('2026-10-05T07:00:00.000Z'), new Date('2026-10-05T07:59:00Z')).anomalies, '59 minutes après : pas encore');
  verifier(travauxDus(etat('2026-10-05T07:00:00.000Z'), new Date(Date.parse('2026-10-05T07:00:00Z') + INTERVALLE_ANOMALIES_MS)).anomalies, 'une heure après : dues');
  verifier(!travauxDus(etat(), new Date('2026-10-05T07:10:00Z'), { notifier: false }).anomalies, 'sans notification possible : pas de recherche');
  verifier(!travauxDus(etat(), new Date('2026-10-05T05:10:00Z')).anomalies && !travauxDus(undefined, new Date('2026-10-05T05:10:00Z')).prix, 'avant 8 h à Paris : rien');
}

/* ------------------------------------------------------------ base en mémoire, avec versions */

/** Base de l'espace en mémoire : versions (comme maj_le), écriture conditionnelle, lectures comptées. */
class BaseMemoire implements BasePassagePrix {
  private lignes = new Map<string, { element: { id: string }; version: number }>();
  private v = 0;
  lectures: string[] = [];
  constructor(donnees: Record<string, { id: string }[]>) {
    for (const [c, els] of Object.entries(donnees)) for (const e of els) this.lignes.set(`${c}/${e.id}`, { element: e, version: ++this.v });
  }
  private async pause() {
    await Promise.resolve();
  }
  async lire<T>(c: string, ids?: string[]): Promise<T[]> {
    return (await this.lireVersions<T>(c, ids)).map((x) => x.element);
  }
  async lireVersions<T>(c: string, ids?: string[]): Promise<{ element: T; version: string }[]> {
    await this.pause();
    this.lectures.push(ids ? `${c}/${ids.join(',')}` : c);
    return [...this.lignes.entries()]
      .filter(([k]) => k.startsWith(`${c}/`) && (!ids || ids.includes(k.slice(c.length + 1))))
      .map(([, x]) => ({ element: structuredClone(x.element) as T, version: String(x.version) }));
  }
  async remplacerSi(c: string, e: { id: string }, version: string): Promise<boolean> {
    await this.pause();
    const x = this.lignes.get(`${c}/${e.id}`);
    if (!x || String(x.version) !== version) return false;
    this.lignes.set(`${c}/${e.id}`, { element: structuredClone(e), version: ++this.v });
    return true;
  }
  async ajouterSiAbsent(c: string, els: { id: string }[]): Promise<number> {
    await this.pause();
    let n = 0;
    for (const e of els) {
      if (this.lignes.has(`${c}/${e.id}`)) continue;
      this.lignes.set(`${c}/${e.id}`, { element: structuredClone(e), version: ++this.v });
      n++;
    }
    return n;
  }
  get<T>(c: string, id: string): T | undefined {
    return this.lignes.get(`${c}/${id}`)?.element as T | undefined;
  }
}

section('Deux passages en même temps : une seule notification');
{
  const L = logement('L');
  const donnees = { logements: [...PARC, L], reservations: [...TOUTES, resa('L', j(5), 3, { canal: 'airbnb' }), resa('L', j(7), 2, { canal: 'booking' })] };
  const envois: GroupeNotification[][] = [];
  const o = (h: string) => ({ maintenant: new Date(h), notifier: true, envoyer: async (g: GroupeNotification[]) => void envois.push(g) });

  // Premier passage du jour, état encore absent : « ajouter s'il est absent ».
  const b = new BaseMemoire(donnees);
  const [x, y] = await Promise.all([passerDansEspace(b, o('2026-10-05T07:00:00Z')), passerDansEspace(b, o('2026-10-05T07:00:00Z'))]);
  const statuts = [x.statut, y.statut].sort().join(',');
  verifier(statuts === 'deja-pris,fait' && envois.length === 1, `état absent : un seul passage prend la main et envoie (${statuts}, ${envois.length} envoi)`);
  verifier(!!envois[0]?.some((g) => g.cle === 'prix-2026-10-05') && !!envois[0]?.some((g) => g.cle.startsWith('anomalies-')), 'il envoie les prix du jour et la double réservation');
  verifier(b.get<{ dernierCalcul?: string }>('conseilsPrix', 'etat')?.dernierCalcul === '2026-10-05', 'l’état est écrit (avant l’envoi)');

  // Une demi-heure plus tard : rien de dû, une seule lecture (l'état).
  b.lectures = [];
  const z = await passerDansEspace(b, o('2026-10-05T07:30:00Z'));
  verifier(z.statut === 'rien' && b.lectures.length === 1 && b.lectures[0] === 'conseilsPrix/etat' && envois.length === 1, `rien de dû : une seule lecture (${b.lectures.join(' ; ')})`);
  // Une heure après : anomalies seulement (pas de nouveau calcul des prix, ni de relecture des réglages).
  b.lectures = [];
  const w = await passerDansEspace(b, o('2026-10-05T08:05:00Z'));
  verifier(w.statut === 'fait' && !!w.plan?.dus.anomalies && !w.plan.dus.prix && !b.lectures.includes('conseilsPrix') && b.lectures.includes('equipe') && envois.length === 1, `une heure après : anomalies relues, rien de renotifié (${b.lectures.join(' ; ')})`);

  // Le lendemain, état présent : « remplacer s'il n'a pas changé ».
  const [p, q] = await Promise.all([passerDansEspace(b, o('2026-10-06T07:00:00Z')), passerDansEspace(b, o('2026-10-06T07:00:00Z'))]);
  const s2 = [p.statut, q.statut].sort().join(',');
  verifier(s2 === 'deja-pris,fait' && envois.length === 2 && envois[1].some((g) => g.cle === 'prix-2026-10-06'), `état présent : un seul passage envoie (${s2}, ${envois.length} envois en tout)`);

  // Envoi en échec : l'état reste écrit, pas de seconde tentative le même jour (au plus une notification).
  const b2 = new BaseMemoire(donnees);
  const echec = await passerDansEspace(b2, { maintenant: new Date('2026-10-05T07:00:00Z'), notifier: true, envoyer: async () => Promise.reject(new Error('réseau')) });
  const encore = await passerDansEspace(b2, o('2026-10-05T07:10:00Z'));
  verifier(echec.statut === 'fait' && encore.statut === 'rien', 'envoi en échec : le passage suivant ne renvoie pas');
}

section('Accueil : « N logements : prix à revoir »');
{
  const seed = creerSeed();
  const conseils = conseilsDuJour(seed);
  const logements = new Set(conseils.map((c) => c.logementId));
  const ligne = elementsPrixEtAnomalies(seed, DATE_DEMO, { gerant: true }).find((x) => x.type === 'prix');
  verifier(logements.size > 1 && ligne?.titre === `${logements.size} logements : prix à revoir`, `le titre compte les logements (${ligne?.titre} ; ${conseils.length} conseils)`);
  verifier(ligne?.details.length === logements.size && ligne.liens?.length === logements.size && ligne.liens.every((l) => /^\/erp\/logements\/[^/]+#prix$/.test(l)), 'une ligne par logement, chacune mène à sa carte');
  const noms = [...logements].map((id) => seed.logements.find((l) => l.id === id)!.nom);
  verifier(!!ligne?.apercu && noms.slice(0, 3).every((n) => ligne.apercu!.includes(n)) && /et \d+ autres?$/.test(ligne.apercu), `dans la carte : les logements concernés (${ligne?.apercu})`);
  const un = elementsPrixEtAnomalies({ ...seed, logements: seed.logements.filter((l) => l.id === conseils[0].logementId || !logements.has(l.id)) }, DATE_DEMO, { gerant: true }).find((x) => x.type === 'prix');
  verifier(un?.titre === 'Un logement : prix à revoir' && !!un.apercu?.startsWith(`${conseils[0].nom} : `), `un seul logement : « Un logement : prix à revoir » (${un?.titre} / ${un?.apercu})`);
  verifier(!elementsPrixEtAnomalies(seed, DATE_DEMO, { gerant: false }).some((x) => x.type === 'prix'), 'pas de ligne de prix pour un compte qui n’est pas gérant');
}

section('Occupation : jamais 0 % avec des séjours (logement « en pause »)');
{
  // Annonce « inactive » chez le service de connexion → logement « en pause », mais réservée.
  const P = logement('P', { statut: 'pause' });
  const sejours = [resa('P', j(-20), 15)];
  const f = { debut: j(-30), fin: J };
  const seed = creerSeed();
  const d = { ...seed, logements: [P], reservations: sejours };
  const accueil = mesurerAccueil(d, f);
  verifier(Math.abs(accueil.occupation - 0.5) < 1e-9 && accueil.logements === 1, `Accueil : 50 % (15 nuits sur 30), pas 0 % (${accueil.occupation})`);
  const mcp = mesurerMcp([P], sejours, f);
  verifier(mcp.occupation === accueil.occupation, `connecteur Claude : même occupation que l’Accueil (${mcp.occupation})`);
  verifier(Math.abs(indicateurs(d, J).occupation30j - 0.5) < 1e-9, `indicateurs du tableau de bord : 50 % (${indicateurs(d, J).occupation30j})`);
  verifier(mesurerOccupation([P], [], f).logements === 0 && mesurerOccupation([{ ...P, statut: 'actif' }], [], f).logements === 1, 'en pause sans séjour : non compté ; actif : compté');
  verifier(!detecterAnomalies({ logements: [P], reservations: sejours, aujourdhui: J, maintenant: MAINTENANT }).some((a) => a.type === 'integrite'), 'contrôle d’intégrité : rien à signaler');
  // Même règle sur la démo : l'Accueil et le connecteur donnent le même chiffre.
  const fd = { debut: plusJours(seed.reservations[0].arrivee, 30), fin: plusJours(seed.reservations[0].arrivee, 60) };
  verifier(mesurerMcp(seed.logements, seed.reservations, fd).occupation === mesurerAccueil(seed, fd).occupation, 'démo : Accueil et connecteur alignés');
}

section('Prévisionnel 30 / 60 / 90 jours');
{
  const A = PARC[0];
  const p = previsionLogement(A, TOUTES, J)!;
  const h30 = p.horizons[0];
  verifier(!!p && p.horizons.map((h) => h.jours).join() === '30,60,90', 'trois horizons');
  // Séjours de J+10 (3 nuits), J+14 (8 nuits) et J+24 (6 de ses 8 nuits avant J+30).
  verifier(h30.nuitsReservees === 17 && h30.nuitsDisponibles === 30, `30 jours : 17 nuits déjà réservées sur 30 (${h30.nuitsReservees}/${h30.nuitsDisponibles})`);
  verifier(p.projection && h30.occupation > h30.occupationReservee && h30.occupation <= 1 && h30.revenu > h30.revenuReserve, `projection au rythme habituel : ${Math.round(h30.occupation * 100)} % attendus, ${Math.round(h30.occupationReservee * 100)} % réservés`);
  // Versé par la plateforme, ménage compris, au prorata des nuits : 350 € + 850 € + 6/8 × 850 €.
  verifier(h30.revenuReserve === 183750, `revenu déjà réservé : 1 837,50 € (${h30.revenuReserve})`);
  const neuf = logement('N');
  const pn = previsionLogement(neuf, [resa('N', j(3), 2)], J)!;
  verifier(!pn.projection && pn.horizons[0].nuitsProjetees === 0 && pn.horizons[0].nuitsReservees === 2, 'sans historique : déjà réservé seulement');
  verifier(previsionLogement(neuf, [], J) === undefined && previsionParc([neuf], [], J) === undefined, 'rien réservé, pas d’historique : rien à montrer');
  const parc = previsionParc(PARC, TOUTES, J)!;
  verifier(parc.horizons[0].nuitsDisponibles === 150 && parc.horizons[0].nuitsReservees === 17 + 4 * 30, 'parc : somme des logements');
}

section('Lecture seule : aucune écriture vers les plateformes');
{
  // Modules de Node chargés à l'exécution (l'ERP n'a pas les types de Node).
  const nomFs = 'node:fs';
  const nomChemins = 'node:path';
  const fs = (await import(/* @vite-ignore */ nomFs)) as { existsSync(p: string): boolean; readFileSync(p: string, e: 'utf8'): string };
  const chemins = (await import(/* @vite-ignore */ nomChemins)) as { join(...p: string[]): string; dirname(p: string): string; resolve(...p: string[]): string };
  /** Source d'un fichier du dépôt, cherché depuis le dossier courant et ses parents. */
  function source(chemin: string): string | undefined {
    let dossier = (globalThis as { process?: { cwd(): string } }).process!.cwd();
    for (let i = 0; i < 6; i++) {
      const f = chemins.join(dossier, chemin);
      if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
      dossier = chemins.dirname(chemins.resolve(dossier));
    }
    return undefined;
  }
  const imports = (s: string) => [...s.matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gms)].map((m) => m[1]);
  for (const f of ['prix-conseils.ts', 'prix-passage.ts', 'anomalies.ts', 'previsionnel.ts', 'occupation.ts', 'calendrier-fr.ts']) {
    const s = source(`src/erp/data/${f}`);
    verifier(!!s, `${f} lisible (lancer depuis la racine du dépôt)`);
    if (!s) continue;
    verifier(!imports(s).some((i) => /repull|_erp-repull|agent-ia/i.test(i)), `${f} n’importe pas le client des plateformes (${imports(s).join(', ')})`);
    verifier(!/\bfetch\s*\(|\/v1\/|method\s*:\s*['"](PUT|POST|PATCH|DELETE)/i.test(s), `${f} : aucun appel réseau ni écriture`);
  }
  const serveur = source('api/_prix-conseils.ts');
  verifier(!!serveur && !imports(serveur).some((i) => /repull-synchro|agent-ia/i.test(i)) && !/\/v1\/|ecritureRepull|RepullClient/.test(serveur), 'passage du serveur : base de l’ERP seulement, jamais les plateformes');
  const passage = source('src/erp/data/prix-passage.ts') ?? '';
  const ecritures = [...passage.matchAll(/\.(ecrire|remplacerSi|ajouterSiAbsent)\(\s*([A-Z_]+|'[^']+')/g)];
  verifier(!!serveur && !/\.ecrire\(|remplacerSi|ajouterSiAbsent/.test(serveur) && ecritures.length === 2 && ecritures.every((m) => m[1] !== 'ecrire' && m[2] === 'COLLECTION_PRIX'), `le serveur n’écrit que l’état, sous condition, dans la collection des prix conseillés (${ecritures.map((m) => m[1]).join(', ')})`);
  verifier(
    !ecritureRepullPermise('PUT', '/v1/availability/123', { price: 90 }) &&
      !ecritureRepullPermise('POST', '/v1/availability/123', {}) &&
      !ecritureRepullPermise('PATCH', '/v1/listings/123', { price: 90 }) &&
      !ecritureRepullPermise('POST', '/v1/channels/booking/listings/123/pricing', {}),
    'le verrou des écritures refuse toujours prix, calendrier et annonce',
  );
}

console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
(globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
