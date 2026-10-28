/**
 * Auto-contrôle de la carte des logements (sans réseau ni navigateur) :
 *   - état du jour : réservé, libre, ménage (et l'ordre ménage → réservé un
 *     jour de rotation), problème en plus de la couleur ;
 *   - positions : seulement si elles correspondent à l'adresse actuelle,
 *     réduites à lat, lng et précision pour les espaces ;
 *   - géocodage : seul le texte de l'adresse part, bon score et même code
 *     postal exigés, sinon le centre de la commune, sinon rien ; démo sans
 *     aucun appel ;
 *   - espaces : le propriétaire et l'équipe de terrain ne voient que ce
 *     qu'ils voyaient déjà (ni description d'incident ni prestataire pour le
 *     propriétaire, ni incident qu'un agent ne voit pas) ;
 *   - ménage interne (prévu par Claude) : s'efface devant celui d'un
 *     prestataire, sinon orange jusqu'au contrôle qualité ou à « Fait » ;
 *     jamais confié ni payé ;
 *   - démo : les quatre cas, positions factices près du centre des communes ;
 *   - phrases de la fiche et de la légende ; repères écartés quand ils se
 *     chevauchent.
 *
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-carte.ts --bundle --platform=node \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
 *     --outfile=/tmp/verifier-carte.mjs --format=esm && node /tmp/verifier-carte.mjs
 */
import {
  SEUIL_SCORE,
  SOURCE_GEOPLATEFORME,
  TITRES_PROPRIETAIRE,
  URL_GEOCODEUR,
  compterCarte,
  etatDuJour,
  garderPoint,
  lirePosition,
  logementsAPlacer,
  nomCommune,
  positionAJour,
  positionVue,
  requeteAdresse,
  requeteCommune,
  texteAdresse,
  trierPoints,
  urlGeocodage,
  type EntreesCarte,
  type PointCarte,
} from './carte';
import { geocoderLogement } from './geocodage';
import { CENTRES_COMMUNES_DEMO } from './seed-carte';
import { DATE_DEMO } from './format';
import { vueProprietaire } from './proprietaire';
import { vueOperations, type EntreesOperations } from './espace-operations';
import { versLogement } from './repull';
import { creerSeed } from './seed';
import { pointsDeLaVue, pointsDuGerant } from '../carte/points';
import { libelleRepere, ligneMenage, phraseDuJour, phraseFiltreVide, phraseLegende, precisionMenage } from '../carte/phrases';
import { phraseBilan } from '../carte/placer';
import { ECART_PX, ecartements } from '../carte/ecartement';
import { executerAutomatisations } from '../automatisations';
import { menageInterneFait } from './selectors';
import type { Incident, Logement, Mission, PositionLogement, Reservation } from './types';
import type { ControleQualite } from './types-operations';

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

const J = '2026-09-24';
const VEILLE = '2026-09-23';
const DEMAIN = '2026-09-25';
const L = 'log-a';

const sejour = (id: string, arrivee: string, depart: string, extra: Partial<Reservation> = {}): Reservation =>
  ({
    id,
    logementId: L,
    canal: 'airbnb',
    voyageur: { nom: 'Marie Durand', pays: 'France', nbPersonnes: 2 },
    arrivee,
    depart,
    nuits: 1,
    statut: 'confirmee',
    montantBrutCentimes: 0,
    commissionPlateformeCentimes: 0,
    fraisMenageCentimes: 0,
    ...extra,
  }) as Reservation;

const mission = (id: string, statut: Mission['statut'], extra: Partial<Mission> = {}): Mission => ({
  id,
  type: 'menage',
  logementId: L,
  date: J,
  heureDebut: '11:00',
  heureFinMax: '16:00',
  statut,
  checklist: [],
  photos: [],
  tarifCentimes: 0,
  controleQualite: false,
  ...extra,
});

const incident = (id: string, extra: Partial<Incident> = {}): Incident => ({
  id,
  logementId: L,
  date: VEILLE,
  categorie: 'panne',
  gravite: 'moyenne',
  description: 'Chauffe-eau en panne, note interne : code du local 4512.',
  statut: 'ouvert',
  refacturable: 'aucun',
  preuves: [],
  ...extra,
});

const etat = (e: EntreesCarte) => etatDuJour(L, e, J);

/* ------------------------------------------------------------ état du jour */

section('État du jour : réservé, libre, ménage');
{
  verifier(etat({ reservations: [] }).etat === 'libre', 'personne, rien en attente : libre');
  verifier(etat({ reservations: [sejour('r1', VEILLE, '2026-09-27')] }).etat === 'reserve', 'séjour en cours : réservé');
  verifier(etat({ reservations: [sejour('r1', J, '2026-09-27')] }).etat === 'reserve', 'arrivée du jour : réservé');
  verifier(etat({ reservations: [sejour('r1', DEMAIN, '2026-09-27')] }).etat === 'libre', 'arrivée demain : libre ce soir');
  verifier(etat({ reservations: [sejour('r1', DEMAIN, '2026-09-27')] }).prochaineArrivee === DEMAIN, 'libre : la prochaine arrivée est connue');
  verifier(etat({ reservations: [sejour('r1', J, '2026-09-27', { statut: 'annulee' })] }).etat === 'libre', 'réservation annulée : ignorée');

  const depart = sejour('r0', '2026-09-21', J);
  verifier(etat({ reservations: [depart] }).etat === 'menage', 'départ du jour sans mission : ménage à faire (orange)');
  verifier(etat({ reservations: [depart] }).menage?.statut === 'a_faire', 'départ du jour sans mission : statut « à faire »');
  const controleFait: ControleQualite = { id: 'c1', logementId: L, reservationId: 'r0', echeance: J, statut: 'fait', points: [] };
  verifier(etat({ reservations: [depart], controles: [controleFait] }).etat === 'libre', 'départ du jour, contrôle qualité fait : ménage fait, libre');
  // Le contrôle rattrapé aujourd'hui d'un autre départ, ou un contrôle sans séjour du matin, ne termine pas le ménage de ce départ.
  const autreDepart: ControleQualite = { id: 'c9', logementId: L, reservationId: 'r-avant', echeance: '2026-09-18', statut: 'fait', points: [], realiseLe: `${J}T09:00:00+02:00` };
  const sansSejour: ControleQualite = { id: 'c8', logementId: L, echeance: J, statut: 'fait', points: [], realiseLe: `${J}T08:00:00+02:00` };
  verifier(etat({ reservations: [depart], controles: [autreDepart] }).etat === 'menage' && etat({ reservations: [depart], controles: [sansSejour] }).etat === 'menage', 'départ du jour : un contrôle d’un autre séjour, ou sans séjour, ne fait pas le ménage');
  verifier(etat({ reservations: [depart], missions: [mission('m0', 'attribuee', { reservationId: 'r0', date: DEMAIN })] }).etat === 'libre', 'ménage de ce départ prévu demain : pas de ménage aujourd’hui');

  // Rotation : départ et arrivée le même jour.
  const rotation = [depart, sejour('r1', J, '2026-09-27')];
  for (const [statut, attendu] of [
    ['a_attribuer', 'menage'],
    ['attribuee', 'menage'],
    ['en_cours', 'menage'],
    ['refusee', 'menage'],
    ['a_valider', 'reserve'],
    ['validee', 'reserve'],
  ] as const) {
    verifier(etat({ reservations: rotation, missions: [mission('m1', statut, { reservationId: 'r0' })] }).etat === attendu, `rotation, mission « ${statut} » : ${attendu}`);
  }
  verifier(etat({ reservations: rotation, missions: [mission('m1', 'annulee', { reservationId: 'r0' })] }).etat === 'menage', 'rotation, mission annulée : ménage toujours à faire (départ du jour)');
  verifier(etat({ reservations: rotation, missions: [mission('m1', 'attribuee', { reservationId: 'r0', interne: true })] }).etat === 'menage', 'ménage interne (copilote) : compté aussi');
  verifier(etat({ reservations: [depart], missions: [mission('m1', 'validee', { reservationId: 'r0' })] }).etat === 'libre', 'départ seul, ménage fait : libre');
  verifier(etat({ reservations: [depart], missions: [mission('m1', 'en_cours', { reservationId: 'r0' })] }).etat === 'menage', 'départ seul, ménage en cours : ménage');

  // Milieu de séjour : le voyageur est là.
  const present = [sejour('r2', VEILLE, '2026-09-28')];
  verifier(etat({ reservations: present, missions: [mission('m2', 'attribuee', { reservationId: 'r2' })] }).etat === 'reserve', 'milieu de séjour, ménage pas commencé : réservé');
  verifier(etat({ reservations: present, missions: [mission('m2', 'en_cours', { reservationId: 'r2' })] }).etat === 'menage', 'milieu de séjour, ménage en cours : ménage');
  verifier(etat({ reservations: [], missions: [mission('m3', 'attribuee')] }).etat === 'menage', 'logement vide, ménage prévu aujourd’hui : ménage');
  verifier(etat({ reservations: [], missions: [mission('m3', 'validee')] }).etat === 'libre', 'logement vide, ménage validé : libre');
  verifier(etat({ reservations: [], missions: [mission('m4', 'attribuee', { type: 'maintenance' })] }).etat === 'libre', 'une intervention n’est pas un ménage');
  verifier(etat({ reservations: [], missions: [mission('m5', 'attribuee', { logementId: 'log-autre' })] }).etat === 'libre', 'ménage d’un autre logement : ignoré');
  const deux = etat({ reservations: [], missions: [mission('m6', 'validee'), mission('m7', 'en_cours')] });
  verifier(deux.menage?.statut === 'en_cours' && deux.menage.mission?.id === 'm7', 'deux ménages du jour : le moins avancé compte');
}

section('Ménage interne (prévu par Claude) : jamais devant celui d’un prestataire');
{
  const depart = sejour('r0', '2026-09-21', J);
  const rotation = [depart, sejour('r1', J, '2026-09-27')];
  const interne = (statut: Mission['statut'], extra: Partial<Mission> = {}) => mission('mi', statut, { interne: true, ...extra });
  const avec = etat({ reservations: rotation, missions: [mission('mp', 'validee', { reservationId: 'r0' }), interne('a_attribuer')] });
  verifier(avec.etat === 'reserve' && avec.menage?.mission?.id === 'mp', 'rotation : ménage du prestataire validé, ménage interne ignoré → réservé');
  verifier(etat({ reservations: rotation, missions: [mission('mp', 'en_cours', { reservationId: 'r0' }), interne('a_attribuer')] }).menage?.mission?.id === 'mp', 'le ménage du prestataire compte, même en cours');
  const seul = etat({ reservations: [depart], missions: [interne('a_attribuer', { reservationId: 'r0' })] });
  verifier(seul.etat === 'menage' && seul.menage?.statut === 'a_faire', 'ménage interne seul, départ du jour : orange (ménage prévu)');
  const controle: ControleQualite = { id: 'c1', logementId: L, reservationId: 'r0', echeance: J, statut: 'fait', points: [] };
  verifier(etat({ reservations: [depart], missions: [interne('a_attribuer', { reservationId: 'r0' })], controles: [controle] }).etat === 'libre', 'ménage interne seul : fait au contrôle qualité du départ');
  verifier(etat({ reservations: [], missions: [interne('a_attribuer')] }).etat === 'menage', 'ménage interne seul, logement vide : orange');
  const controleDuJour: ControleQualite = { id: 'c2', logementId: L, echeance: J, statut: 'fait', points: [], realiseLe: `${J}T15:00:00+02:00` };
  verifier(etat({ reservations: [], missions: [interne('a_attribuer')], controles: [controleDuJour] }).etat === 'libre', 'ménage interne seul : un contrôle fait ce jour-là le termine');
  verifier(etat({ reservations: [], missions: [interne('validee')] }).etat === 'libre', 'ménage interne marqué « Fait » (validé) : libre');

  const fait = menageInterneFait(interne('a_attribuer'));
  verifier(fait.ok && fait.mission.statut === 'validee', '« Fait » : le ménage interne passe validé');
  verifier(!menageInterneFait(mission('mp', 'a_valider')).ok, '« Fait » refusé pour un ménage de prestataire (il se valide)');
  verifier(!menageInterneFait(interne('annulee')).ok && !menageInterneFait(interne('validee')).ok, '« Fait » refusé pour un ménage annulé ou déjà fait');

  // Jamais confié ni payé : le moteur d'automatisations ne le touche pas.
  const seed = creerSeed();
  const avant = seed.missions.find((m) => m.id === 'mis-demo-interne')!;
  verifier(!!avant && avant.interne === true && avant.date === DATE_DEMO, 'démo : un ménage interne prévu aujourd’hui (Juvisy)');
  const valide = { ...avant, statut: 'validee' as const, tarifCentimes: 4500 };
  const apres = executerAutomatisations({ ...seed, missions: seed.missions.map((m) => (m.id === valide.id ? valide : m)) }, { date: DATE_DEMO, maintenant: `${DATE_DEMO}T10:30:00+02:00`, journaliser: false }).donnees;
  verifier(!apres.paiementsPrestataires.some((x) => x.missions.includes(valide.id)), 'ménage interne fait : dans aucun paiement de prestataire');
  verifier(!apres.missions.find((m) => m.id === valide.id)?.prestataireId, 'ménage interne : jamais confié à un prestataire');
  const aFaire = executerAutomatisations(seed, { date: DATE_DEMO, maintenant: `${DATE_DEMO}T10:30:00+02:00`, journaliser: false }).donnees;
  verifier(!aFaire.missions.find((m) => m.id === avant.id)?.prestataireId, 'ménage interne à faire : le moteur ne le confie pas');

  // Sur la carte : orange à Juvisy ; le gérant peut le marquer « Fait » ; les espaces ne voient ni « interne » ni l'id.
  const juvisy = pointsDuGerant(seed, DATE_DEMO).find((x) => x.id === 'log-juvisy')!;
  verifier(juvisy.etat === 'menage' && juvisy.menage?.interne === true && juvisy.menage.missionId === avant.id, 'gérant : Juvisy en ménage (interne), avec de quoi le marquer « Fait »');
  verifier(ligneMenage(juvisy) === 'Ménage prévu par Claude à 14 h : aucun prestataire n’est prévenu.', 'gérant : la fiche dit que personne n’est prévenu');
  const faitSeed = { ...seed, missions: seed.missions.map((m) => (m.id === avant.id ? { ...m, statut: 'validee' as const } : m)) };
  verifier(pointsDuGerant(faitSeed, DATE_DEMO).find((x) => x.id === 'log-juvisy')?.etat === 'libre', 'marqué « Fait » : Juvisy redevient libre');
  const opsJuvisy = vueOperations(seed as unknown as EntreesOperations, 'eq-ines', { aujourdhui: DATE_DEMO })!.logements.find((l) => l.id === 'log-juvisy')!;
  verifier(opsJuvisy.carte?.etat === 'menage' && !('interne' in (opsJuvisy.carte.menage ?? {})) && !('missionId' in (opsJuvisy.carte.menage ?? {})), 'opérations : ménage prévu, sans « interne » ni id de mission');
  const proJuvisy = vueProprietaire(seed, 'pro-nguyen', { aujourdhui: DATE_DEMO })!.logements.find((l) => l.id === 'log-juvisy')!;
  verifier(proJuvisy.carte?.etat === 'menage' && !('missionId' in (proJuvisy.carte.menage ?? {})), 'propriétaire : ménage prévu, sans id de mission');
}

section('Problème : un incident ouvert, en plus de la couleur');
{
  const e = etat({ reservations: [sejour('r1', VEILLE, '2026-09-27')], incidents: [incident('i1'), incident('i2', { gravite: 'haute' }), incident('i3', { statut: 'resolu', resoluLe: VEILLE })] });
  verifier(e.etat === 'reserve', 'un problème ne change pas la couleur (réservé)');
  verifier(e.problemes.map((i) => i.id).join(',') === 'i2,i1', 'incidents ouverts seulement, urgents d’abord');
  verifier(etat({ reservations: [], incidents: [incident('i4', { statut: 'en_cours' })] }).problemes.length === 1, '« On s’en occupe » : toujours un problème');
  verifier(etat({ reservations: [], incidents: [incident('i5', { logementId: 'log-autre' })] }).problemes.length === 0, 'incident d’un autre logement : rien');
}

/* -------------------------------------------------------------- positions */

const base: Logement = {
  ...creerSeed().logements.find((l) => l.id === 'log-corbeil-t2')!,
  id: L,
  nom: 'Chez Marie Dupont',
  adresse: '12 quai des Tanneurs',
  codePostal: '91100',
  ville: 'Corbeil-Essonnes',
  position: undefined,
};
const pos = (l: Pick<Logement, 'adresse' | 'codePostal' | 'ville'>, precision: PositionLogement['precision'] = 'adresse'): PositionLogement => ({
  lat: 48.6123,
  lng: 2.4812,
  precision,
  source: SOURCE_GEOPLATEFORME,
  adresse: texteAdresse(l),
  le: `${J}T09:00:00+02:00`,
});

section('Positions : à jour, réduites');
{
  verifier(texteAdresse(base) === '12 quai des Tanneurs 91100 Corbeil-Essonnes', 'texte géocodé : rue, code postal, commune');
  const place = { ...base, position: pos(base) };
  verifier(positionAJour(place), 'position faite pour cette adresse : à jour');
  verifier(!positionAJour({ ...place, adresse: '14 quai des Tanneurs' }), 'adresse changée depuis : à placer de nouveau');
  verifier(positionAJour({ ...place, adresse: '12  quai des Tanneurs ' }), 'espaces en trop : même adresse');
  verifier(!positionAJour({ ...place, position: { ...place.position!, lat: Number.NaN } }), 'coordonnées illisibles : rien');
  verifier(!positionAJour({ ...place, position: { ...place.position!, lat: 0, lng: 0 } }), 'point (0, 0) : rien');
  const vue = positionVue(place)!;
  verifier(Object.keys(vue).sort().join(',') === 'lat,lng,precision', 'position envoyée aux espaces : lat, lng, précision (ni adresse, ni source, ni date)');
  verifier(positionVue({ ...place, ville: 'Évry' }) === undefined, 'position périmée : jamais envoyée');
  const aPlacer = logementsAPlacer([
    base,
    place,
    { ...place, id: 'b', adresse: '1 rue Neuve' },
    { ...base, id: 'c', statut: 'sorti' },
    { ...base, id: 'd', adresse: '', codePostal: '', ville: '' },
  ]);
  verifier(aPlacer.map((l) => l.id).join(',') === `${L},b`, 'à placer : jamais placé ou adresse changée ; pas les logements sortis ni sans adresse');
}

section('Synchronisation des plateformes : la position reste, une adresse changée la périme');
{
  const place = { ...base, position: pos(base) };
  const ctx = { id: L, aujourdhui: J, proprietaireId: base.proprietaireId };
  const meme = versLogement({ id: '1001', name: base.nom, address: { street: base.adresse, city: base.ville } }, place, ctx);
  verifier(meme.position === place.position && positionAJour(meme), 'même adresse lue sur la plateforme : position gardée, à jour');
  // Logement importé (« repull-1001 ») : l'adresse suit l'annonce.
  const importe = { ...place, id: 'repull-1001' };
  const autre = versLogement({ id: '1001', name: base.nom, address: { street: '3 rue du Port', city: base.ville } }, importe, { ...ctx, id: importe.id });
  verifier(autre.adresse === '3 rue du Port' && !!autre.position && !positionAJour(autre), 'logement importé, nouvelle rue lue sur la plateforme : position gardée mais périmée (à placer de nouveau)');
  // Logement créé à la main puis relié : l'adresse de l'équipe reste, la position aussi.
  const relie = versLogement({ id: '1001', name: base.nom, address: { street: '3 rue du Port', city: 'Évry' } }, { ...place, repull: { id: '1001' } }, ctx);
  verifier(relie.adresse === base.adresse && relie.ville === base.ville && relie.position === place.position && positionAJour(relie), 'logement créé à la main et relié : adresse de l’équipe et position gardées');
}

/* ------------------------------------------------------------- géocodage */

section('Géocodage : seule l’adresse part, résultats triés');
{
  verifier(requeteAdresse(base) === '12 quai des Tanneurs 91100 Corbeil-Essonnes', 'requête adresse : le texte de l’adresse');
  verifier(requeteCommune(base) === '91100 Corbeil-Essonnes', 'requête commune : code postal et commune');
  verifier(requeteAdresse({ adresse: '', codePostal: '91100', ville: 'Corbeil' }) === null, 'sans rue : pas de requête adresse');
  verifier(requeteCommune({ codePostal: '', ville: '' }) === null, 'sans commune : rien à chercher');
  const u = new URL(urlGeocodage(requeteAdresse(base)!, 'adresse'));
  verifier(`${u.origin}${u.pathname}` === URL_GEOCODEUR && u.origin === 'https://data.geopf.fr', 'service : Géoplateforme de l’IGN (data.geopf.fr)');
  verifier([...u.searchParams.keys()].sort().join(',') === 'limit,q', 'paramètres : q et limit, rien d’autre');
  verifier(!u.href.includes('Marie') && !u.href.includes('Dupont') && !u.href.includes(base.proprietaireId), 'ni nom du logement, ni propriétaire dans la requête');
  verifier(new URL(urlGeocodage('91100 Corbeil-Essonnes', 'commune')).searchParams.get('type') === 'municipality', 'requête commune : type=municipality');

  const reponse = (props: Record<string, unknown>, coords: unknown = [2.4821, 48.6088]) => ({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: props }] });
  const bon = { score: 0.93, type: 'housenumber', postcode: '91100', city: 'Corbeil-Essonnes' };
  verifier(JSON.stringify(lirePosition(reponse(bon), base, 'adresse')) === JSON.stringify({ lat: 48.6088, lng: 2.4821 }), 'bon score, même code postal : position (lat, lng dans le bon ordre)');
  verifier(lirePosition(reponse({ ...bon, score: 0.61 }), base, 'adresse') === null, `score sous ${SEUIL_SCORE} : refusé (adresse inconnue du service)`);
  verifier(lirePosition(reponse({ ...bon, postcode: '91000' }), base, 'adresse') === null, 'autre code postal : refusé');
  verifier(lirePosition(reponse({ ...bon, type: 'street' }), base, 'adresse') !== null, 'rue trouvée (sans numéro) : acceptée comme adresse');
  verifier(lirePosition(reponse({ ...bon, type: 'municipality' }), base, 'adresse') === null, 'commune rendue pour une adresse : refusée (pas d’adresse précise)');
  verifier(lirePosition(reponse(bon, [200, 48]), base, 'adresse') === null, 'coordonnées hors du globe : refusées');
  verifier(lirePosition({ features: [] }, base, 'adresse') === null && lirePosition(null, base, 'adresse') === null, 'réponse vide ou illisible : rien');
  const commune = { score: 0.95, type: 'municipality', postcode: '91100', city: 'Corbeil-Essonnes', name: 'Corbeil-Essonnes' };
  verifier(lirePosition(reponse(commune), base, 'commune') !== null, 'commune : type municipality et même code postal');
  verifier(lirePosition(reponse({ ...commune, type: 'housenumber' }), base, 'commune') === null, 'commune : un autre type est refusé');
  // Sans code postal (logement importé des plateformes) : même commune exigée.
  const sansCp = { adresse: '9 place de l’Agora', codePostal: '', ville: 'Evry Courcouronnes' };
  verifier(lirePosition(reponse({ ...bon, postcode: '91000', city: 'Évry-Courcouronnes' }), sansCp, 'adresse') !== null, 'sans code postal : la même commune suffit (accents et tirets ignorés)');
  verifier(lirePosition(reponse({ ...bon, postcode: '91300', city: 'Massy' }), sansCp, 'adresse') === null, 'sans code postal : une autre commune est refusée');
  verifier(nomCommune('St-Germain-lès-Corbeil') === nomCommune('Saint Germain les Corbeil'), '« St » = « Saint »');
  verifier(lirePosition(reponse({ ...bon, postcode: '91240', city: 'Saint-Michel-sur-Orge' }), { codePostal: '', ville: 'Saint' }, 'adresse') === null, 'sans code postal : « Saint » n’est pas Saint-Michel-sur-Orge (nom exact seulement)');
}

section('Géocodage : adresse, puis commune, puis rien ; démo sans appel');
{
  const appels: string[] = [];
  const service =
    (...reponses: unknown[]) =>
    async (url: string) => {
      appels.push(url);
      return reponses.shift() ?? 'reseau';
    };
  const geo = (props: Record<string, unknown>) => ({ features: [{ geometry: { type: 'Point', coordinates: [2.48, 48.61] }, properties: props }] });
  const le = `${J}T10:00:00+02:00`;

  appels.length = 0;
  const exact = await geocoderLogement(base, { demo: false, le, rechercher: service(geo({ score: 0.9, type: 'housenumber', postcode: '91100' })) });
  verifier(exact.ok && exact.position.precision === 'adresse' && exact.position.source === SOURCE_GEOPLATEFORME && exact.position.adresse === texteAdresse(base) && exact.position.le === le, 'adresse trouvée : précision « adresse », source et texte géocodé gardés');
  verifier(appels.length === 1, 'adresse trouvée : une seule requête');

  appels.length = 0;
  const approx = await geocoderLogement(base, { demo: false, le, rechercher: service(geo({ score: 0.6, type: 'housenumber', postcode: '91100' }), geo({ score: 0.95, type: 'municipality', postcode: '91100' })) });
  verifier(approx.ok && approx.position.precision === 'commune', 'adresse douteuse : centre de la commune, montré comme approximatif');
  verifier(appels.length === 2 && new URL(appels[1]).searchParams.get('type') === 'municipality', 'puis une requête « commune »');

  appels.length = 0;
  const rien = await geocoderLogement(base, { demo: false, le, rechercher: service(geo({ score: 0.5, type: 'street', postcode: '91100' }), geo({ score: 0.9, type: 'municipality', postcode: '75014' })) });
  verifier(!rien.ok && rien.raison === 'introuvable', 'rien de sûr : pas de position (introuvable)');

  const panne = await geocoderLogement(base, { demo: false, le, rechercher: service() });
  verifier(!panne.ok && panne.raison === 'reseau', 'service muet : « réseau », rien n’est posé');

  verifier(appels.every((u) => u.startsWith(`${URL_GEOCODEUR}?`) && !u.includes('Marie') && !u.includes('Dupont')), 'chaque requête : le géocodeur public, sans nom');

  appels.length = 0;
  const demo = await geocoderLogement(base, { le, rechercher: service(geo({ score: 1, type: 'housenumber', postcode: '91100' })) });
  verifier(demo.ok && demo.position.precision === 'commune' && demo.position.source === 'demo', 'démo : centre de la commune (factice)');
  verifier(appels.length === 0, 'démo : aucun appel au géocodeur');
}

/* ---------------------------------------------------------------- espaces */

section('Espace propriétaire : ses logements, rien de plus');
{
  const seed = creerSeed();
  const corbeil = seed.logements.find((l) => l.id === 'log-corbeil-t3')!;
  const avecIncident = {
    ...seed,
    incidents: [
      ...seed.incidents,
      incident('inc-proprio', { logementId: corbeil.id, categorie: 'casse', description: 'Miroir cassé ; voyageur Marc Dupuis, 06 12 34 56 78.' }),
      incident('inc-autre', { logementId: 'log-massy', description: 'Fuite chez un autre propriétaire.' }),
      incident('inc-voyageur', { logementId: corbeil.id, categorie: 'voyageur', description: 'Différend avec le voyageur sur la caution.' }),
    ],
    missions: [...seed.missions, mission('mis-proprio', 'en_cours', { logementId: corbeil.id, prestataireId: 'pre-net' })],
  };
  const vue = vueProprietaire(avecIncident, 'pro-sci-tilleuls', { aujourdhui: DATE_DEMO })!;
  const texte = JSON.stringify(vue);
  const l = vue.logements.find((x) => x.id === corbeil.id)!;
  verifier(vue.logements.length === 1 && !!l.carte, 'son logement a sa carte du jour');
  verifier(!!l.carte?.position && Object.keys(l.carte.position).sort().join(',') === 'lat,lng,precision', 'position : lat, lng, précision seulement');
  verifier(!texte.includes(corbeil.adresse), 'l’adresse en clair ne part pas avec la carte');
  verifier(l.carte?.problemes.length === 1 && l.carte.problemes[0].titre === TITRES_PROPRIETAIRE.casse && !('id' in l.carte.problemes[0]), 'problème : sa nature (« Casse à réparer »), sans lien ni description');
  verifier(!texte.includes('Miroir cassé') && !texte.includes('06 12 34 56 78') && !texte.includes('Marc Dupuis'), 'ni description d’incident, ni contact, ni nom complet');
  verifier(!texte.includes('Fuite chez un autre') && !texte.includes('log-massy'), 'rien d’un autre propriétaire');
  verifier(!texte.includes('caution') && !texte.includes(TITRES_PROPRIETAIRE.voyageur), 'un différend avec un voyageur n’est pas montré au propriétaire');
  verifier(l.carte?.etat === 'menage' && l.carte.menage?.statut === 'en_cours' && !('par' in (l.carte.menage ?? {})), 'ménage en cours : visible, sans le nom du prestataire');
  verifier(!!l.carte?.sejour?.voyageur && /^\p{L}+ \p{L}\.$/u.test(l.carte.sejour.voyageur), `voyageur : « Prénom N. » (${l.carte?.sejour?.voyageur})`);
  verifier(!texte.includes('pre-net') && !texte.includes('mis-proprio'), 'ni prestataire ni identifiant de mission');
  const sans = vueProprietaire({ ...seed, missions: undefined, incidents: undefined, controles: undefined } as never, 'pro-sci-tilleuls', { aujourdhui: DATE_DEMO })!;
  verifier(!!sans.logements[0].carte && sans.logements[0].carte.problemes.length === 0, 'sans ménages ni incidents lus : l’état se lit sur les séjours');
}

section('Espace opérations : son périmètre, ses incidents');
{
  const seed = creerSeed();
  const cache = incident('inc-cache', { logementId: 'log-massy', assigneA: 'eq-clara', signalePar: 'eq-ines', description: 'Visible du pôle, pas de Yanis.' });
  const e = { ...seed, incidents: [...seed.incidents, cache] } as unknown as EntreesOperations;
  const yanis = vueOperations(e, 'eq-yanis', { aujourdhui: DATE_DEMO })!;
  const ines = vueOperations(e, 'eq-ines', { aujourdhui: DATE_DEMO })!;
  const massyY = yanis.logements.find((l) => l.id === 'log-massy')!;
  const massyI = ines.logements.find((l) => l.id === 'log-massy')!;
  verifier(!!massyY.carte && !massyY.carte.problemes.some((p) => p.titre.includes('Visible du pôle')), 'agent : un incident qu’il ne voit pas n’apparaît pas sur sa carte');
  verifier(massyI.carte!.problemes.some((p) => p.titre.includes('Visible du pôle') && p.id === 'inc-cache'), 'pôle : il le voit, avec de quoi l’ouvrir');
  const vus = new Set(yanis.incidents.filter((i) => i.statut !== 'resolu').map((i) => i.id));
  verifier(yanis.logements.every((l) => (l.carte?.problemes ?? []).every((p) => !!p.id && vus.has(p.id))), 'agent : chaque problème de la carte est un incident de sa liste');
  verifier(yanis.logements.every((l) => !l.carte?.position || Object.keys(l.carte.position).sort().join(',') === 'lat,lng,precision'), 'positions : lat, lng, précision seulement');
  verifier([...yanis.logements, ...ines.logements].every((l) => !('par' in (l.carte?.menage ?? {}))), 'ménage : sans le nom du prestataire');
  const perimetreY = new Set(seed.equipe.find((m) => m.id === 'eq-yanis')!.logementIds);
  verifier(yanis.logements.every((l) => perimetreY.has(l.id)), 'agent : seulement ses logements');
  verifier(!JSON.stringify(yanis).includes('12 quai des Tanneurs'), 'aucune adresse en clair');
}

/* -------------------------------------------------------------------- démo */

section('Démo : les quatre cas, des positions factices');
{
  const seed = creerSeed();
  const points = pointsDuGerant(seed, DATE_DEMO);
  const c = compterCarte(points);
  verifier(c.reserve > 0 && c.libre > 0 && c.menage > 0 && c.probleme > 0, `gérant : réservé ${c.reserve}, libre ${c.libre}, ménage ${c.menage}, problème ${c.probleme}`);
  verifier(!points.some((p) => p.id === 'log-ris'), 'logement sorti : pas sur la carte');
  verifier(points.some((p) => p.menage?.par), 'gérant : qui fait le ménage');
  verifier(points.find((p) => p.id === 'log-linas')?.position === undefined, 'démo : « Maison de Linas » reste à placer');
  verifier(points.find((p) => p.id === 'log-soisy')?.position?.precision === 'commune', 'démo : un logement au centre de sa commune (approximatif)');
  const loin = seed.logements.filter((l) => l.position).filter((l) => {
    const centre = CENTRES_COMMUNES_DEMO[l.codePostal];
    return !centre || Math.abs(centre[0] - l.position!.lat) > 0.02 || Math.abs(centre[1] - l.position!.lng) > 0.02;
  });
  verifier(!loin.length && seed.logements.filter((l) => l.position).every((l) => l.position!.source === 'demo' && positionAJour(l)), 'démo : positions factices, près du centre de leur commune, à jour');
  const ines = pointsDeLaVue(vueOperations(seed as unknown as EntreesOperations, 'eq-ines', { aujourdhui: DATE_DEMO })!.logements);
  const ci = compterCarte(ines);
  verifier(ci.reserve > 0 && ci.libre > 0 && ci.menage > 0 && ci.probleme > 0, `opérations (pôle) : les quatre cas (${JSON.stringify(ci)})`);
  const proprio = pointsDeLaVue(vueProprietaire(seed, 'pro-sci-tilleuls', { aujourdhui: DATE_DEMO })!.logements);
  verifier(proprio.length === 1 && !!proprio[0].position, 'propriétaire de démo : son logement, placé');
}

/* -------------------------------------------------------------- phrases */

section('Phrases de la fiche, de la liste et de la légende');
{
  const p = (x: Partial<PointCarte>): PointCarte => ({ id: L, nom: 'Cosy F2', ville: 'Évry', etat: 'libre', problemes: [], ...x });
  const s = { voyageur: 'Lina C.', arrivee: J, depart: '2026-09-26' };
  verifier(phraseDuJour(p({ etat: 'reserve', sejour: s }), J) === 'Lina C. arrive aujourd’hui, jusqu’au 26 sept.', 'arrivée du jour : un seul point final');
  verifier(phraseDuJour(p({ etat: 'reserve', sejour: { ...s, arrivee: VEILLE, depart: DEMAIN } }), J) === 'Lina C. est là, départ demain.', 'séjour qui finit demain');
  verifier(phraseDuJour(p({ etat: 'menage', depart: { voyageur: 'Paul R.' }, menage: { statut: 'a_faire', heure: '11:00' }, sejour: s }), J) === 'Ménage prévu après le départ, Lina C. arrive aujourd’hui, jusqu’au 26 sept.', 'rotation : le ménage, puis l’arrivée');
  verifier(phraseDuJour(p({ etat: 'menage', menage: { statut: 'a_faire' } }), J) === 'Ménage prévu aujourd’hui, libre ce soir.', 'ménage prévu dans un logement vide');
  verifier(phraseDuJour(p({ etat: 'menage', menage: { statut: 'en_cours' } }), J) === 'Ménage en cours, libre ce soir.', 'ménage en cours, personne ce soir');
  verifier(phraseDuJour(p({ etat: 'libre', depart: {}, menage: { statut: 'fait' } }), J) === 'Ménage fait, libre ce soir.', 'départ du jour, ménage fait');
  verifier(phraseDuJour(p({ prochaineArrivee: DEMAIN }), J) === 'Libre ce soir, prochaine arrivée demain.', 'libre, arrivée demain');
  verifier(phraseDuJour(p({ etat: 'reserve', sejour: { arrivee: VEILLE, depart: '2026-09-30' } }), J) === 'Un voyageur est là jusqu’au 30 sept.', 'voyageur qui n’est pas à montrer : « un voyageur »');
  verifier(ligneMenage(p({ etat: 'menage', depart: {}, menage: { statut: 'a_faire', heure: '09:30', par: 'Éclat Services' } })) === 'Ménage prévu à 9 h 30 par Éclat Services.', 'ligne du ménage : heure et qui, sans redire le statut');
  verifier(ligneMenage(p({ etat: 'menage', menage: { statut: 'en_cours' } })) === '', 'ligne du ménage : rien quand la phrase a tout dit');
  verifier(ligneMenage(p({ etat: 'reserve', menage: { statut: 'a_faire', heure: '14:00' } })) === 'Ménage prévu à 14 h.', 'milieu de séjour : le ménage prévu');
  verifier(libelleRepere(p({ etat: 'menage', problemes: [{ titre: 'x', urgent: false }], position: { lat: 1, lng: 1, precision: 'commune' } })) === 'Cosy F2 : ménage, problème signalé, position approximative', 'libellé d’un repère : état en mots, problème, précision');
  const pts = [p({ id: 'a', nom: 'B', etat: 'reserve' }), p({ id: 'b', nom: 'A', etat: 'libre', problemes: [{ titre: 'x', urgent: true }] }), p({ id: 'c', nom: 'C', etat: 'menage' }), p({ id: 'd', nom: 'D', etat: 'reserve' })];
  const c = compterCarte(pts);
  verifier(c.reserve === 2 && c.libre === 1 && c.menage === 1 && c.probleme === 1 && c.menageOccupe === 0, 'comptes de la légende');
  verifier(phraseLegende(c) === '2 réservés, 1 libre, 1 ménage, 1 problème.', 'légende lue : « 2 réservés, 1 libre, 1 ménage, 1 problème. »');
  const avecArrivee = compterCarte([...pts, p({ id: 'e', nom: 'E', etat: 'menage', sejour: s })]);
  verifier(avecArrivee.menageOccupe === 1 && precisionMenage(avecArrivee) === '1 occupé ce soir', 'ménage avant une arrivée : « 1 occupé ce soir » (réservés + ceux-là = occupés ce soir)');
  verifier(precisionMenage({ menage: 2, menageOccupe: 2 }) === 'occupés ce soir' && precisionMenage({ menage: 2, menageOccupe: 0 }) === '', 'précision du ménage : tous, ou rien');
  verifier(phraseLegende(avecArrivee) === '2 réservés, 1 libre, 2 ménages (1 occupé ce soir), 1 problème.', 'légende lue avec la précision');
  verifier(phraseFiltreVide('libre') === 'Aucun logement libre sur la carte.', 'filtre sans repère placé : une phrase');
  verifier(pts.filter((x) => garderPoint(x, 'probleme')).map((x) => x.id).join() === 'b' && pts.filter((x) => garderPoint(x, 'reserve')).length === 2 && pts.filter((x) => garderPoint(x, null)).length === 4, 'filtre de la légende');
  verifier(trierPoints(pts).map((x) => x.id).join() === 'b,c,a,d', 'liste : problème, puis ménage, réservé, libre');
  verifier(phraseBilan({ exacts: 3, approximatifs: 1, introuvables: 1, reseau: false }) === '3 placés, 1 au centre de sa commune, 1 introuvable : vérifiez l’adresse dans la fiche du logement.', 'bilan du placement');
}

section('Repères qui se chevauchent : écartés, chacun touchable');
{
  const d = ecartements([
    { id: 'a', ecran: { x: 100, y: 100 } },
    { id: 'b', ecran: { x: 108, y: 104 } },
    { id: 'c', ecran: { x: 300, y: 300 } },
  ]);
  const ou = (id: string, x: number, y: number) => ({ x: x + d.get(id)![0], y: y + d.get(id)![1] });
  const a = ou('a', 100, 100);
  const b = ou('b', 108, 104);
  verifier(Math.hypot(a.x - b.x, a.y - b.y) >= ECART_PX - 1, `deux repères à 9 px : écartés d’au moins ${ECART_PX} px`);
  verifier(d.get('c')![0] === 0 && d.get('c')![1] === 0, 'un repère seul ne bouge pas');
  const groupe = Array.from({ length: 6 }, (_, k) => ({ id: `g${k}`, ecran: { x: 200 + k * 5, y: 200 + (k % 2) * 6 } }));
  const dg = ecartements(groupe);
  const pos = groupe.map((g) => ({ x: g.ecran.x + dg.get(g.id)![0], y: g.ecran.y + dg.get(g.id)![1] }));
  let mini = Infinity;
  for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) mini = Math.min(mini, Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y));
  verifier(mini >= ECART_PX - 1, `six repères serrés : au moins ${ECART_PX} px entre deux (${Math.round(mini)} px)`);
  verifier(groupe.every((g) => Math.hypot(...dg.get(g.id)!) <= 80), 'décalage modeste (le repère reste près de sa place)');
}

console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
(globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
