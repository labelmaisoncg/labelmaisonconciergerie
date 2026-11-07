/**
 * Auto-contrôle des connexions d'un logement : l'annonce Airbnb et l'annonce
 * Booking.com d'un même appartement réunies sur un seul logement
 * (data/annonces-liees.ts, repull-connexion.ts : relierAutreAnnonce,
 * repull-synchro.ts : indexerLogements, verrou des connexions), sans réseau :
 * une fausse API du service de connexion et une fausse base PostgREST en
 * mémoire (écritures conditionnelles, ajout si absent, suppression refusée
 * pour un logement qui a encore un historique, comme la base).
 *
 * Vérifie : le modèle et la correspondance annonce → logement (la liaison
 * l'emporte sur un logement importé), la ressemblance (fiable seulement),
 * les refus, la fusion des seuls champs vides, le déplacement de chaque
 * collection, l'opération serveur (verrou, idempotence, reprise, journal,
 * trace), une synchronisation après coup (pas de logement recréé,
 * réservations et conversations de l'annonce reliée sur le logement gardé,
 * nom et photos de l'annonce principale gardés), le choix de la page
 * Connexions avec « même logement que… », et qu'aucune écriture ne part
 * vers le service de connexion (seulement des lectures).
 *
 * Données fictives seulement (noms inventés, adresses en @exemple.fr).
 *
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-regroupement.ts --bundle --platform=node \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-regroupement.cjs \
 *     && node /tmp/verifier-regroupement.cjs
 */
import {
  BaseErp,
  COLLECTION_ETAT,
  DUREE_VERROU_MS,
  ID_ANNONCES_RELIEES,
  ID_SELECTION,
  SynchroInterrompue,
  baseGardee,
  ecritureRepullPermise,
  indexerLogements,
  lancer,
  lireVerrou,
  prendreVerrou,
  rendreVerrou,
  verrouPris,
} from './repull-synchro';
import { ErreurConnexion, enregistrerSelectionAvecLiaisons, relierAutreAnnonce, type ContexteConnexion, type ResultatConnexion } from './repull-connexion';
import {
  COLLECTIONS_AUTRES,
  COLLECTIONS_LOGEMENT_ID,
  accueilleCanal,
  annoncesDe,
  annoncesProposees,
  canalApporte,
  canalDe,
  canauxDuLogement,
  canauxPrincipaux,
  fusionnerLogement,
  logementPortant,
  logementsPourAnnonce,
  nouvelleLiee,
  pairesSuggerees,
  phraseCeQuiRejoint,
  relierConnexionDe,
  ressemblance,
  sansPlateforme,
  suggestionPour,
  verifierConnexion,
  ceQuiRejoint,
} from './annonces-liees';
import { delierPossible, lierLogement, verifierLiaison } from './liaison-annonce';
import { annonceSuivie } from './suppression-logement';
import { operationReserveeAuGerant } from './ecritures-gerant';
import { donneesVides } from './collections';
import { ID_PROPRIETAIRE_A_RENSEIGNER, versLogement } from './repull';
import type { ErpDonnees, FilMessages, Journal, Logement, Reservation } from './types';

/* ------------------------------------------------------------ assertions */

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string, detail?: unknown) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}${detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 400)}`}`);
  }
}
function section(titre: string) {
  console.log(`\n${titre}`);
}

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });

/* ------------------------------------------------ fausse API du service de connexion */

type Brut = Record<string, unknown>;

class FauxRepull {
  appels: { methode: string; chemin: string }[] = [];
  listings: Brut[] = [];
  reservations: Brut[] = [];
  conversations: Brut[] = [];
  messages: Record<string, Brut[]> = {};

  private page(liste: unknown[]) {
    return json({ data: liste, pagination: { nextCursor: null, hasMore: false, total: liste.length } });
  }

  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    if (url.hostname !== 'api.repull.dev') return new Response('non', { status: 403 });
    const methode = (init?.method ?? 'GET').toUpperCase();
    const chemin = url.pathname;
    this.appels.push({ methode, chemin });
    const corps = init?.body ? (JSON.parse(String(init.body)) as Brut) : {};
    let m: RegExpExecArray | null;
    if (chemin === '/v1/listings/status' && methode === 'POST') {
      const ids = (corps.listingIds as string[]) ?? [];
      for (const l of this.listings) if (ids.includes(String(l.id))) l.status = corps.active ? 'active' : 'inactive';
      return json({ active: corps.active, updated: ids, unchanged: [] });
    }
    if (methode !== 'GET') return json({ error: { code: 'not_found' } }, 404);
    if (chemin === '/v1/listings') return this.page(this.listings);
    if ((m = /^\/v1\/listings\/([^/]+)$/.exec(chemin))) {
      const l = this.listings.find((x) => String(x.id) === m![1]);
      return l ? json({ ...l, amenities: [] }) : json({ error: { code: 'not_found' } }, 404);
    }
    if (/^\/v1\/listings\/[^/]+\/photos$/.test(chemin)) return json({ photos: [] });
    if (/^\/v1\/availability\//.test(chemin)) return json({ days: [] });
    if (chemin === '/v1/channels/booking/properties') return json([]);
    if (chemin === '/v1/reservations') {
      const depuis = Date.parse(url.searchParams.get('updated_since') ?? '1970-01-01T00:00:00Z');
      return this.page(this.reservations.filter((r) => Date.parse(String(r.updatedAt)) >= depuis).sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt))));
    }
    if ((m = /^\/v1\/reservations\/([^/]+)$/.exec(chemin))) {
      const r = this.reservations.find((x) => String(x.id) === m![1]);
      return r ? json(r) : json({ error: { code: 'not_found' } }, 404);
    }
    if (chemin === '/v1/conversations') return this.page(this.conversations);
    if ((m = /^\/v1\/conversations\/([^/]+)\/messages$/.exec(chemin))) return this.page([...(this.messages[m[1]] ?? [])].sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt))));
    if (chemin === '/v1/reviews' || chemin === '/v1/guests') return this.page([]);
    if (chemin === '/v1/usage/tier') return json({ tier: 'custom' });
    if (chemin === '/v1/connect' || chemin === '/v1/connect/providers') return this.page([]);
    return json({ error: { code: 'not_found', message: chemin } }, 404);
  };

  ecrituresVers = () => this.appels.filter((a) => a.methode !== 'GET');
}

/* ------------------------------------------------------- fausse base PostgREST */

/** Collections et champ qui comptent pour la règle « un logement qui a vécu ne se supprime pas » (base). */
const HISTORIQUE_BASE = ['reservations', 'filsMessages', 'missions', 'mouvementsLinge', 'incidents', 'controles', 'charges', 'documentsProprietaire', 'dossiers', 'avisADeposer', 'envoisProgrammes'];

class FausseBase {
  lignes = new Map<string, { collection: string; id: string; donnees: Brut; maj_le: string }>();
  /** Appelé avant chaque suppression (un ménage créé au mauvais moment, par exemple). */
  avantSuppression?: (collection: string, id: string) => void;
  ecritures: { collection: string; id: string; op: string }[] = [];
  private v = 0;
  private version = () => `2026-11-07T08:00:00.${String(++this.v).padStart(6, '0')}+00:00`;
  private cle = (c: string, id: string) => `${c}\u0000${id}`;

  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    if (url.pathname !== '/rest/v1/enregistrements') return json({ message: 'inconnu' }, 404);
    const methode = (init?.method ?? 'GET').toUpperCase();
    const p = url.searchParams;
    const egal = (k: string) => (p.get(k) ?? '').replace(/^eq\./, '');
    const ids = (p.get('id') ?? '').startsWith('in.') ? new Set((p.get('id') ?? '').replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''))) : null;
    if (methode === 'GET') {
      const c = egal('collection');
      const res = [...this.lignes.values()]
        .filter((l) => l.collection === c && (!ids || ids.has(l.id)))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((l) => ({ id: l.id, donnees: JSON.parse(JSON.stringify(l.donnees)), maj_le: l.maj_le }));
      return json(res);
    }
    if (methode === 'PATCH') {
      const l = this.lignes.get(this.cle(egal('collection'), egal('id')));
      if (!l || l.maj_le !== egal('maj_le')) return json([]);
      const { donnees } = JSON.parse(String(init?.body)) as { donnees: Brut };
      this.lignes.set(this.cle(l.collection, l.id), { ...l, donnees, maj_le: this.version() });
      this.ecritures.push({ collection: l.collection, id: l.id, op: 'remplacer' });
      return json([{ id: l.id }]);
    }
    if (methode === 'POST') {
      const prefer = new Headers(init?.headers).get('prefer') ?? '';
      const lignes = JSON.parse(String(init?.body)) as { collection: string; id: string; donnees: Brut }[];
      const ajoutees: { id: string }[] = [];
      for (const l of lignes) {
        if (/ignore-duplicates/.test(prefer) && this.lignes.has(this.cle(l.collection, l.id))) continue;
        this.lignes.set(this.cle(l.collection, l.id), { collection: l.collection, id: l.id, donnees: l.donnees, maj_le: this.version() });
        this.ecritures.push({ collection: l.collection, id: l.id, op: 'ecrire' });
        ajoutees.push({ id: l.id });
      }
      return /return=representation/.test(prefer) ? json(ajoutees) : new Response(null, { status: 201 });
    }
    if (methode === 'DELETE') {
      const c = egal('collection');
      const res: { id: string }[] = [];
      for (const id of ids ?? []) {
        this.avantSuppression?.(c, id);
        if (c === 'logements' && [...this.lignes.values()].some((l) => HISTORIQUE_BASE.includes(l.collection) && l.donnees.logementId === id)) {
          return json({ code: '42501', message: 'Ce logement a un historique : passez-le en « Sorti » plutôt que de le supprimer.' }, 403);
        }
        if (this.lignes.delete(this.cle(c, id))) {
          res.push({ id });
          this.ecritures.push({ collection: c, id, op: 'supprimer' });
        }
      }
      return json(res);
    }
    return json({ message: 'méthode' }, 405);
  };

  poser<T extends { id: string }>(c: string, e: T) {
    this.lignes.set(this.cle(c, e.id), { collection: c, id: e.id, donnees: JSON.parse(JSON.stringify(e)), maj_le: this.version() });
  }
  get<T>(c: string, id: string): T | undefined {
    return this.lignes.get(this.cle(c, id))?.donnees as T | undefined;
  }
  collection<T>(c: string): T[] {
    return [...this.lignes.values()].filter((l) => l.collection === c).map((l) => l.donnees as T);
  }
  donnees = () => this.ecritures.filter((e) => e.collection !== 'journal' && e.collection !== COLLECTION_ETAT);
}

const nouvelleBase = (b: FausseBase) => new BaseErp({ url: 'https://base.exemple.fr', cleAnon: 'anon', fetch: b.fetch as typeof fetch, jeton: async () => 'jeton-serveur' });

/* ---------------------------------------------------------------- données */

const GERANT = { email: 'gerant@exemple.fr', role: 'gerant' };
const PROPRIO = 'pro-fictif';

/** Annonce du service de connexion (forme de l'OpenAPI, réduite). */
function annonce(id: string, nom: string, plateforme: 'airbnb' | 'booking', o: Brut = {}): Brut {
  return {
    id,
    name: nom,
    address: { street: '4 quai des Fictifs', city: 'Corbeil-Essonnes' },
    thumbnailUrl: `https://cdn.exemple.fr/${id}-couverture.jpg`,
    status: 'active',
    channels: [{ platform: plateforme, externalId: `ext-${id}`, active: true, syncEnabled: true }],
    content: { name: nom, summary: `Résumé de l’annonce ${id}.`, description: `Description de l’annonce ${id}.` },
    details: { propertyTypeCategory: 'apartment', bedrooms: 2, personCapacity: 4 },
    photos: [
      { url: `https://cdn.exemple.fr/${id}-1.jpg`, sortOrder: 0 },
      { url: `https://cdn.exemple.fr/${id}-2.jpg`, sortOrder: 1 },
    ],
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...o,
  };
}

function reservation(id: string, listingId: string, plateforme: string, arrivee: string, maj: string): Brut {
  return {
    id,
    listingId,
    platform: plateforme,
    source: plateforme,
    status: 'confirmed',
    checkIn: arrivee,
    checkOut: `${arrivee.slice(0, 8)}${String(Number(arrivee.slice(8, 10)) + 3).padStart(2, '0')}`,
    guestName: `Voyageur ${id}`,
    occupancy: { adults: 2 },
    totalPrice: 300,
    confirmationCode: `C${id}`,
    updatedAt: maj,
  };
}

/** Un élément fictif qui porte un logement, pour chaque collection. */
function elementsDe(logementId: string, suffixe: string): Partial<ErpDonnees> {
  const id = (c: string) => `${c}-${suffixe}`;
  return {
    missions: [
      { id: id('mis-menage'), type: 'menage', logementId, date: '2026-11-20', heureDebut: '11:00', heureFinMax: '15:00', statut: 'attribuee', checklist: [], photos: [], tarifCentimes: 4000, controleQualite: false },
      { id: id('mis-controle'), type: 'controle', logementId, date: '2026-11-21', heureDebut: '11:00', heureFinMax: '15:00', statut: 'attribuee', checklist: [], photos: [], tarifCentimes: 0, controleQualite: true },
    ],
    mouvementsLinge: [{ id: id('lin'), logementId, date: '2026-11-01', type: 'depot', articles: [] } as never],
    incidents: [{ id: id('inc'), logementId, date: '2026-11-02', categorie: 'casse', gravite: 'faible', description: 'Verre cassé.', statut: 'ouvert' } as never],
    controles: [{ id: id('ctl'), logementId, echeance: '2026-11-30', statut: 'a_faire', points: [] } as never],
    charges: [{ id: id('chg'), date: '2026-11-03', libelle: 'Ampoules', categorie: 'fournitures', montantCentimes: 900, logementId } as never],
    documentsProprietaire: [{ id: id('doc'), proprietaireId: PROPRIO, logementId, titre: 'Attestation', categorie: 'attestation' } as never],
    dossiers: [{ id: id('dos'), logementId, recuLe: '2026-10-01T10:00:00+02:00', valeurs: {} } as never],
    mandats: [{ id: id('man'), proprietaireId: PROPRIO, logementId, statut: 'signe', commissionPct: 20, dateDebut: '2026-01-01' } as never],
    avisADeposer: [{ id: id('avd'), reservationId: 'x', logementId, voyageur: 'Lina', depart: '2026-10-10', canal: 'booking', statut: 'a_relire', creeLe: '' } as never],
    envoisProgrammes: [{ id: id('env'), reservationId: 'x', logementId, declencheur: 'arrivee', voyageur: 'Lina', statut: 'envoye', le: '' } as never],
    reponsesAvis: [{ id: id('rep'), reservationId: 'x', logementId, voyageur: 'Lina', canal: 'booking', note: 5, creeLe: '' } as never],
    recommandations: [{ id: id('rec'), logementId, proprietaireId: PROPRIO, code: 'literie', titre: 'Literie', detail: '', porteur: 'proprietaire', statut: 'proposee', creeLe: '2026-10-01' } as never],
    versionsAnnonce: [{ id: id('ver'), logementId, mois: '2026-11', statut: 'validee', titre: 'T', description: 'D', accroche: 'A', raisons: [], source: 'humain', creeLe: '2026-11-01' } as never],
    signalementsLogement: [{ id: id('sig'), logementId, membreId: 'mem-1', le: '', statut: 'ouvert' } as never],
    demandesProprietaires: [{ id: id('dem'), proprietaireId: PROPRIO, logementId, type: 'question', sujet: 'autre', statut: 'envoyee' } as never],
  };
}

function logementVide(id: string, nom: string): Logement {
  return {
    id,
    nom,
    adresse: '',
    ville: '',
    codePostal: '',
    type: 'T3',
    surfaceM2: 0,
    capacite: 0,
    chambres: 0,
    lits: [],
    statut: 'actif',
    proprietaireId: ID_PROPRIETAIRE_A_RENSEIGNER,
    residencePrincipale: false,
    serrure: 'boite_a_cles',
    fiche: { wifiNom: '', wifiCode: '', heureArrivee: '16:00', heureDepart: '11:00', acces: '', parking: '', regles: '', equipements: [] },
    dotationLinge: [],
    annonces: [],
    checklistLancement: [
      { cle: 'mandat_signe', libelle: 'Mandat signé', fait: false },
      { cle: 'linge_etiquete', libelle: 'Linge étiqueté', fait: false },
    ],
  };
}

/** Logement importé d'une annonce (comme versLogement), canal unique. */
function importe(idAnnonce: string, nom: string, canal: 'airbnb' | 'booking', o: Partial<Logement> = {}): Logement {
  return {
    ...logementVide(`repull-${idAnnonce}`, nom),
    annonces: [{ canal, connecte: true }],
    repull: { id: idAnnonce, canaux: [{ plateforme: canal, idExterne: `ext-${idAnnonce}`, actif: true }] },
    ...o,
  };
}

/* ---------------------------------------------------------------- scénario */

async function principal() {
  /* ================================================================ 1. modèle */
  section('1. Le modèle : une annonce principale, des annonces reliées');
  {
    const a = importe('501', 'Duplex Saint-Spire', 'airbnb');
    const b = importe('502', 'Duplex Saint-Spire Booking', 'booking');
    const lie: Logement = { ...a, annonces: [...a.annonces, { canal: 'booking', connecte: true }], repull: { ...a.repull!, liees: [nouvelleLiee({ annonce: '502', canal: 'booking', le: 'x', par: 'y' })] } };
    verifier(canalDe('Booking.com') === 'booking' && canalDe('airbnb') === 'airbnb' && canalDe('vrbo') === null, 'plateformes : Airbnb, Booking.com, rien d’autre');
    verifier(canauxPrincipaux(a).join() === 'airbnb' && canauxPrincipaux(b).join() === 'booking', 'plateforme de l’annonce principale (repull.canaux)');
    verifier(canauxDuLogement(lie).sort().join() === 'airbnb,booking' && annoncesDe(lie).join() === '501,502', 'logement relié : ses deux plateformes, ses deux annonces (la principale d’abord)');
    verifier(logementPortant('502', [b, lie])?.id === lie.id && logementPortant('501', [b, lie])?.id === lie.id, 'annonce reliée → le logement qui la porte, même si son logement importé existe encore (la liaison l’emporte)');
    verifier(!accueilleCanal(lie, 'booking') && accueilleCanal(a, 'booking') && !accueilleCanal(a, 'airbnb') && !accueilleCanal(logementVide('log-1', 'Fait main'), 'booking'), 'une seule annonce par plateforme ; un logement sans annonce n’en reçoit pas d’autre');

    const confirme = { annonces: { '502': { logementId: lie.id, canal: 'booking' } } };
    const index = indexerLogements([b, lie], confirme);
    verifier(index.parAnnonce.get('502') === lie.id && index.parAnnonce.get('501') === lie.id && index.liees.get('502') === lie.id && !index.liees.has('501'), 'synchronisation (indexerLogements) : 502 → le logement relié, pas « repull-502 »');
    const sansTrace = indexerLogements([b, lie]);
    verifier(sansTrace.parAnnonce.get('502') === b.id && !sansTrace.liees.size, 'repull.liees sans la trace du serveur (posé par un compte « opérations », une vieille page) : n’aiguille rien');
    const trace = { annonces: { '502': { logementId: a.id, canal: 'booking' } } };
    const sansLiee = indexerLogements([a, b], trace);
    verifier(sansLiee.parAnnonce.get('502') === a.id, 'logement réécrit sans son annonce reliée : la trace côté serveur la renvoie encore sur lui');
    verifier(indexerLogements([b], trace).parAnnonce.get('502') === b.id, 'trace vers un logement absent : ignorée');

    // versLogement (synchronisation de l'annonce principale) garde les annonces reliées.
    const apres = versLogement(annonce('501', 'Duplex renommé', 'airbnb') as never, lie, { id: lie.id, aujourdhui: '2026-11-07', proprietaireId: ID_PROPRIETAIRE_A_RENSEIGNER });
    verifier(apres.repull?.liees?.length === 1 && apres.repull.liees[0].id === '502' && apres.nom === 'Duplex renommé', 'versLogement : nom de l’annonce principale, annonces reliées gardées');
    verifier(apres.annonces.some((x) => x.canal === 'booking' && x.connecte) && apres.annonces.some((x) => x.canal === 'airbnb'), 'versLogement : l’entrée Booking.com de la fiche reste à côté de celle d’Airbnb');
    verifier(!delierPossible({ ...lie, liaison: { annonce: '501', le: '', par: '', avant: {} }, id: 'log-main' } as Logement, [], []).ok, '« Délier » refusé quand une autre annonce est reliée');
    verifier(annonceSuivie(lie) && annonceSuivie({ ...lie, repull: { ...lie.repull!, horsSelection: true } }), 'suppression : un logement avec une annonce reliée est encore suivi');
  }

  /* ================================================================ 2. ressemblance */
  section('2. Ressemblance : seulement si c’est fiable');
  {
    const r = (a: string, b: string, va = 'Corbeil-Essonnes', vb = va) => ressemblance({ nom: a, ville: va }, { nom: b, ville: vb });
    verifier(r('Atelier Spire 3 piece Balcon Projecteur — Two-Bedroom Apartment', 'Atelier Spire •2 chambres • Balcon • Projecteur').niveau === 'forte', 'mêmes mots propres (pièces, chambres, « Two-Bedroom » ignorés) : forte');
    verifier(r('Bel appartement v2', 'Bel appartement Airbnb').niveau === 'forte', 'même nom, sans « v2 » ni « Airbnb » : forte');
    verifier(r('Appartement T2', 'Appartement T2').niveau === null, 'seulement des mots génériques : rien');
    verifier(r('Corbeil Rives de Seine', 'Corbeil Centre Familial').niveau === null, 'seulement le nom de la commune en commun : rien');
    verifier(r('Studio des Tanneurs', 'Studio des Tanneurs', 'Massy', 'Linas').niveau === null, 'deux communes différentes : jamais');
    verifier(r('Duplex Saint-Spire terrasse', 'Duplex Saint-Spire calme').niveau === 'proche', 'deux mots propres sur trois : proche, pas forte');
    verifier(
      ressemblance({ nom: 'A', adresse: '4 quai des Fictifs', ville: 'Corbeil-Essonnes' }, { nom: 'B', adresse: '4, Quai des Fictifs', ville: '' }).niveau === 'forte' &&
        ressemblance({ nom: 'A', adresse: 'quai des Fictifs', ville: 'Corbeil' }, { nom: 'B', adresse: 'quai des Fictifs', ville: 'Corbeil' }).niveau === null,
      'même adresse avec son numéro : forte ; une rue sans numéro ne suffit pas',
    );
    const a = importe('501', 'Atelier Spire •2 chambres • Balcon • Projecteur', 'airbnb', { ville: 'Corbeil-Essonnes' });
    const b = importe('502', 'Atelier Spire 3 piece Balcon Projecteur — Two-Bedroom Apartment', 'booking', { ville: 'Corbeil-Essonnes' });
    const c = importe('503', 'Atelier Spire 3 piece Balcon Projecteur', 'booking', { ville: 'Corbeil-Essonnes' });
    verifier(suggestionPour(a, [a, b])?.id === b.id && suggestionPour(b, [a, b])?.id === a.id, 'un seul candidat fiable : proposé, des deux côtés');
    verifier(!suggestionPour(a, [a, b, c]), 'deux candidats fiables : rien n’est proposé (on ne sait pas lequel)');
    const aY = { ...a, proprietaireId: 'pro-y' };
    verifier(!suggestionPour(aY, [aY, { ...b, proprietaireId: 'pro-x' }]) && suggestionPour(aY, [aY, b])?.id === b.id, 'deux propriétaires connus différents : rien (un « à renseigner » ne gêne pas)');
    verifier(!suggestionPour(a, [a, importe('504', b.nom, 'airbnb', { ville: 'Corbeil-Essonnes' })]), 'même plateforme : rien');
    const paires = pairesSuggerees([b, a]);
    verifier(paires.length === 1 && paires[0].garde.id === a.id && paires[0].autre.id === b.id, 'page Connexions : la paire, le logement Airbnb gardé par défaut');
    const pour = logementsPourAnnonce({ id: '505', nom: 'Atelier Spire · 2 pièces · Balcon · Projecteur', ville: 'Corbeil-Essonnes', plateformes: ['booking'] }, [a, importe('506', 'Maison des Lilas', 'airbnb', { ville: 'Corbeil-Essonnes' }), importe('507', 'Loft du Port', 'airbnb', { ville: 'Massy' })]);
    verifier(pour.forte?.id === a.id && pour.candidats.length === 2 && pour.candidats[0].id === a.id, 'annonce cochée : « Est-ce le même logement que… » (fiable), sinon la liste de la même commune');
  }

  /* ================================================================ 2 bis. plateforme inconnue */
  section('2 bis. Annonce sans plateforme connue : elle prend celle qui manque au logement');
  {
    const a = importe('521', 'Atelier Spire •2 chambres • Balcon • Projecteur', 'airbnb', { ville: 'Corbeil-Essonnes' });
    // Le service de connexion ne dit aucune plateforme pour cette annonce (aucun canal).
    const b: Logement = { ...importe('522', 'Atelier Spire 3 piece Balcon Projecteur — Two-Bedroom Apartment', 'booking', { ville: 'Corbeil-Essonnes' }), annonces: [], repull: { id: '522', canaux: [] } };
    const autrePlateforme: Logement = { ...b, id: 'repull-523', repull: { id: '523', canaux: [{ plateforme: 'vrbo', idExterne: 'v', actif: true }] } };
    verifier(sansPlateforme(b) && !sansPlateforme(a) && !sansPlateforme(autrePlateforme) && !sansPlateforme(logementVide('log-x', 'Fait main')), 'sans plateforme : aucun canal (une autre plateforme, ou pas d’annonce, ne compte pas)');
    verifier(canalApporte(a, b) === 'booking' && canalApporte(b, a) === 'airbnb' && canalApporte(a, autrePlateforme) === null, 'elle apporte la plateforme qui manque au logement gardé');
    verifier(suggestionPour(a, [a, b])?.id === b.id && suggestionPour(b, [a, b])?.id === a.id, 'noms très proches : proposée, des deux côtés');
    const paires = pairesSuggerees([b, a]);
    verifier(paires.length === 1 && paires[0].garde.id === a.id && paires[0].autre.id === b.id, 'page Connexions : le logement dont la plateforme est connue est gardé');
    const annonces = [{ id: '522', nom: b.nom, plateformes: [], statutRepull: 'active', selectionnee: true, logementId: b.id }, { id: '523', nom: 'Autre plateforme', plateformes: ['vrbo'], statutRepull: 'active', selectionnee: true }];
    const pB = annoncesProposees(a, 'booking', annonces, [a, b]);
    verifier(pB.length === 1 && pB[0].annonce.id === '522' && !pB[0].bloquee && pB[0].logement?.id === b.id, '« Relier l’annonce Booking.com » : elle est proposée, choisissable', pB.map((x) => x.annonce.id));
    verifier(!annoncesProposees(a, 'airbnb', annonces, [a, b]).length, 'pas pour la plateforme que le logement a déjà');
    const v = verifierConnexion({ role: 'gerant', logementId: a.id, annonceId: '522', logements: [a, b], annonces });
    verifier(v.ok && v.mode === 'absorber' && v.canal === 'booking' && v.autre?.id === b.id, 'relier : accepté, comme une annonce Booking.com', v);
    const v2 = verifierConnexion({ role: 'gerant', logementId: a.id, annonceId: '523', logements: [a, b, autrePlateforme], annonces });
    verifier(!v2.ok, 'une annonce d’une autre plateforme (ni Airbnb ni Booking.com) : toujours refusée');
    const deuxInconnues = verifierConnexion({ role: 'gerant', logementId: b.id, annonceId: '524', logements: [a, b], annonces: [{ id: '524', nom: 'x', plateformes: [], statutRepull: 'active', selectionnee: true }] });
    verifier(!deuxInconnues.ok, 'deux plateformes inconnues : refusé (on ne saurait pas laquelle)');
    if (v.ok) {
      const f = fusionnerLogement(a, nouvelleLiee({ annonce: '522', canal: v.canal, le: 'x', par: 'y', depuis: b.id }), b);
      verifier(f.logement.annonces.some((x) => x.canal === 'booking' && !x.connecte) && f.logement.annonces.some((x) => x.canal === 'airbnb' && x.connecte), 'fiche : l’entrée Booking.com, pas « en ligne » tant que la synchronisation ne l’a pas vue');
    }
  }

  /* ================================================================ 3. refus */
  section('3. Vérification : les refus');
  {
    const a = importe('501', 'Duplex Saint-Spire', 'airbnb');
    const b = importe('502', 'Duplex Saint-Spire B', 'booking');
    const memePlateforme = importe('503', 'Autre Airbnb', 'airbnb');
    const deuxPlateformes = { ...importe('504', 'Les deux', 'airbnb'), repull: { id: '504', canaux: [{ plateforme: 'airbnb', idExterne: '1', actif: true }, { plateforme: 'booking', idExterne: '2', actif: true }] } };
    const main1 = logementVide('log-main-1', 'Fait à la main 1');
    const annonces = [{ id: '510', nom: 'Pas encore importée', plateformes: ['booking'], statutRepull: 'active' }, { id: '511', nom: 'Archivée', plateformes: ['booking'], statutRepull: 'archived' }];
    const logements = [a, b, memePlateforme, deuxPlateformes, main1];
    const v = (o: Partial<Parameters<typeof verifierConnexion>[0]>) => verifierConnexion({ role: 'gerant', logementId: a.id, annonceId: '502', logements, annonces, ...o });
    const erreur = (x: ReturnType<typeof verifierConnexion>) => (x.ok ? '' : x.erreur);
    verifier(v({}).ok && (v({}) as { mode: string }).mode === 'absorber', 'annonce Booking.com importée à part : permis (absorber)');
    verifier(!v({ role: 'operations' }).ok && (v({ role: 'operations' }) as { statut: number }).statut === 403, 'pas gérant : refusé (403)');
    verifier(/déjà une annonce Airbnb/.test(erreur(v({ annonceId: '503' }))), 'même plateforme : refusé');
    verifier(/Airbnb et Booking\.com/.test(erreur(v({ annonceId: '504' }))), 'annonce déjà sur les deux plateformes : refusé');
    verifier(/n’est relié à aucune annonce/.test(erreur(v({ logementId: main1.id, annonceId: '510' }))), 'logement fait à la main, sans annonce : refusé (deux logements sans annonce : rien à relier)');
    verifier(/plateformes connectées/.test(erreur(v({ annonceId: '511' }))) && /plateformes connectées/.test(erreur(v({ annonceId: '999' }))), 'annonce archivée ou inconnue : refusé');
    verifier(/illisible/.test(erreur(v({ annonceId: '50 2' }))), 'identifiant illisible : refusé');
    verifier(/Sorti/.test(erreur(verifierConnexion({ role: 'gerant', logementId: a.id, annonceId: '502', logements: [{ ...a, statut: 'sorti' }, b] }))), 'logement « Sorti » : refusé');
    verifier(/même propriétaire/.test(erreur(verifierConnexion({ role: 'gerant', logementId: a.id, annonceId: '502', logements: [{ ...a, proprietaireId: 'pro-a' }, { ...b, proprietaireId: 'pro-b' }] }))), 'deux propriétaires connus différents : refusé');
    const aLie = fusionnerLogement(a, nouvelleLiee({ annonce: '502', canal: 'booking', le: 'x', par: 'y' }), b).logement;
    const c = importe('520', 'Troisième', 'booking');
    verifier(/déjà reliée à «\s?Duplex/.test(erreur(verifierConnexion({ role: 'gerant', logementId: 'repull-530', annonceId: '502', logements: [aLie, importe('530', 'Autre', 'airbnb')] }))), 'annonce déjà reliée à un autre logement : refusé (« déjà regroupé »)');
    verifier(/déjà relié à une autre annonce/.test(erreur(verifierConnexion({ role: 'gerant', logementId: 'repull-530', annonceId: '501', logements: [aLie, importe('530', 'Autre', 'booking')] }))), 'logement qui a déjà une annonce reliée ne rejoint pas un autre : refusé');
    verifier(/déjà relié à «\s?Duplex/.test(erreur(verifierConnexion({ role: 'gerant', logementId: b.id, annonceId: '520', logements: [aLie, b, c] }))), 'logement resté en route (son annonce est reliée ailleurs) : refusé');
    const deja = verifierConnexion({ role: 'gerant', logementId: a.id, annonceId: '502', logements: [aLie] });
    verifier(deja.ok && deja.mode === 'deja', 'déjà relié, l’autre logement parti : « deja » (idempotent)');
    const reprise = verifierConnexion({ role: 'gerant', logementId: a.id, annonceId: '502', logements: [aLie, b] });
    verifier(reprise.ok && reprise.mode === 'absorber' && reprise.autre?.id === b.id, 'déjà relié, l’autre logement encore là (interrompu) : on reprend');
    const lieDAilleurs = fusionnerLogement(a, nouvelleLiee({ annonce: '502', canal: 'booking', le: 'x', par: 'y', depuis: 'repull-999' }), b).logement;
    verifier(/n’est pas le logement d’où vient/.test(erreur(verifierConnexion({ role: 'gerant', logementId: a.id, annonceId: '502', logements: [lieDAilleurs, b] }))), 'reprise : seulement avec le logement d’où vient l’annonce');
    verifier(/même propriétaire/.test(erreur(verifierConnexion({ role: 'gerant', logementId: a.id, annonceId: '502', logements: [{ ...aLie, proprietaireId: 'pro-a' }, { ...b, proprietaireId: 'pro-b' }] }))), 'reprise : les mêmes contrôles (propriétaires)');
    const historique = [{ proprietaireId: 'pro-ancien', jusquau: '2026-06-30' }] as never;
    const bHistorique: Logement = { ...b, proprietaireId: PROPRIO, proprietaireDepuis: '2026-07-01', proprietairesPrecedents: historique };
    verifier(/historique de propriétaires/.test(erreur(verifierConnexion({ role: 'gerant', logementId: a.id, annonceId: '502', logements: [{ ...a, proprietaireId: PROPRIO }, bHistorique] }))), 'historiques de propriétaires différents : refusé (les séjours changeraient de propriétaire)');
    verifier(verifierConnexion({ role: 'gerant', logementId: a.id, annonceId: '502', logements: [a, bHistorique] }).ok, 'gardé « à renseigner » sans historique : permis (il reprend celui de l’autre)');
    verifier(!suggestionPour({ ...a, proprietaireId: PROPRIO, ville: 'Corbeil-Essonnes' }, [{ ...a, proprietaireId: PROPRIO, ville: 'Corbeil-Essonnes' }, { ...bHistorique, nom: a.nom, ville: 'Corbeil-Essonnes' }]), 'historiques différents : aucune suggestion');
    const main2 = logementVide('log-main-2', 'Fait à la main 2');
    verifier(/déjà reliée à «\s?Duplex/.test((() => { const r = verifierLiaison({ role: 'gerant', logementId: main2.id, annonceId: '502', logements: [aLie, main2], annonces: [{ id: '502', nom: 'B', statutRepull: 'active' } as never] }); return r.ok ? '' : r.erreur; })()), '« Relier à une annonce » (logement fait à la main) : une annonce déjà reliée ailleurs est refusée');
    const ajout = verifierConnexion({ role: 'gerant', logementId: a.id, annonceId: '510', logements, annonces });
    verifier(ajout.ok && ajout.mode === 'ajouter' && ajout.canal === 'booking', 'annonce pas encore dans l’ERP : seulement reliée (ajouter)');
  }

  /* ================================================================ 4. fusion */
  section('4. Fusion : seulement les champs vides du logement gardé');
  {
    const garde: Logement = {
      ...importe('501', 'Duplex Saint-Spire', 'airbnb'),
      photos: ['https://cdn.exemple.fr/501-1.jpg'],
      descriptif: { titre: 'Titre Airbnb' } as Logement['descriptif'],
      tarifs: { devise: 'EUR', luLe: 'x', jours: [{ date: '2026-11-08', prixCentimes: 9000 }] } as Logement['tarifs'],
      fiche: { wifiNom: '', wifiCode: '', heureArrivee: '15:00', heureDepart: '10:00', acces: 'Code du gardé', parking: '', regles: '', equipements: [] },
      contacts: [{ role: 'menage', nom: 'Équipe du gardé' }],
      technique: { etage: '2e' },
      adresse: '4 quai des Fictifs',
      ville: 'Corbeil-Essonnes',
    };
    const autre: Logement = {
      ...importe('502', 'Duplex Booking', 'booking'),
      annonces: [{ canal: 'booking', url: 'https://www.booking.com/hotel/fr/fictif.html', connecte: true }],
      proprietaireId: PROPRIO,
      proprietaireDepuis: '2026-01-01',
      numeroEnregistrement: '91000000000XX',
      residencePrincipale: true,
      photos: ['https://cdn.exemple.fr/502-1.jpg'],
      descriptif: { titre: 'Titre Booking' } as Logement['descriptif'],
      fiche: { wifiNom: 'Box-Spire', wifiCode: 'code-fictif', heureArrivee: '17:00', heureDepart: '12:00', acces: 'Code de l’autre', parking: 'Place 12', regles: 'Pas de fête', equipements: ['Lave-linge'], guides: [] },
      contacts: [{ role: 'menage', nom: 'Équipe de l’autre' }],
      technique: { etage: '3e', compteurEau: 'Cave' },
      menage: { duree: '2 h' },
      codePostal: '91100',
      adresse: '4 quai des Fictifs',
      ville: 'Corbeil-Essonnes',
      checklistLancement: [
        { cle: 'mandat_signe', libelle: 'Mandat signé', fait: true, preuve: 'mandat.pdf' },
        { cle: 'linge_etiquete', libelle: 'Linge étiqueté', fait: false },
      ],
      couleur: 'prune',
    };
    const liee = nouvelleLiee({ annonce: '502', canal: 'booking', nom: 'Duplex Booking', le: '2026-11-07T09:00:00+01:00', par: GERANT.email, depuis: autre.id });
    const { logement: f, remplis } = fusionnerLogement(garde, liee, autre);
    verifier(f.nom === garde.nom && f.photos?.[0] === garde.photos![0] && f.descriptif?.titre === 'Titre Airbnb' && f.tarifs?.jours[0].prixCentimes === 9000, 'nom, photos, description et prix : ceux de l’annonce principale');
    verifier(f.fiche.acces === 'Code du gardé' && f.contacts?.[0].nom === 'Équipe du gardé' && f.technique?.etage === '2e', 'ce que l’équipe a saisi sur le gardé n’est jamais écrasé');
    verifier(f.fiche.heureArrivee === '15:00' && f.fiche.heureDepart === '10:00' && f.serrure === garde.serrure && f.statut === garde.statut, 'horaires, serrure et statut du gardé restent');
    verifier(
      f.fiche.wifiNom === 'Box-Spire' && f.fiche.wifiCode === 'code-fictif' && f.fiche.parking === 'Place 12' && f.fiche.regles === 'Pas de fête' && f.fiche.equipements[0] === 'Lave-linge',
      'fiche voyageur : les champs vides remplis par l’autre',
    );
    verifier(f.technique?.compteurEau === 'Cave' && f.menage?.duree === '2 h' && f.numeroEnregistrement === '91000000000XX' && f.residencePrincipale && f.codePostal === '91100' && f.couleur === 'prune', 'terrain, enregistrement, résidence principale, code postal, couleur : remplis s’ils étaient vides');
    verifier(f.proprietaireId === PROPRIO && f.proprietaireDepuis === '2026-01-01', 'propriétaire « à renseigner » ici : celui de l’autre, avec sa date');
    verifier(fusionnerLogement({ ...garde, proprietaireId: 'pro-garde' }, liee, autre).logement.proprietaireId === 'pro-garde', 'propriétaire connu ici : il reste');
    verifier(f.checklistLancement.find((c) => c.cle === 'mandat_signe')?.fait === true && f.checklistLancement.find((c) => c.cle === 'mandat_signe')?.preuve === 'mandat.pdf', 'lancement : une étape faite là-bas l’est ici');
    verifier(f.repull?.liees?.length === 1 && f.repull.liees[0].id === '502' && f.repull.liees[0].depuis === autre.id && f.repull.id === '501', 'annonce reliée ajoutée, annonce principale inchangée');
    verifier(f.annonces.map((a) => `${a.canal}:${a.connecte}:${a.url ?? ''}`).join('|') === 'airbnb:true:|booking:true:https://www.booking.com/hotel/fr/fictif.html', 'fiche : Airbnb puis Booking.com (lien de l’autre)');
    verifier(remplis.includes('fiche.wifiNom') && !remplis.includes('fiche.acces') && !remplis.includes('nom'), 'champs remplis listés (journal)');
    const deux = fusionnerLogement(f, liee, autre);
    verifier(JSON.stringify(deux.logement) === JSON.stringify(f), 'refaite : même résultat (idempotente)');
  }

  /* ================================================================ 5. déplacements (local) */
  section('5. Déplacement de chaque collection');
  {
    const a = importe('501', 'Duplex Saint-Spire', 'airbnb');
    const b = importe('502', 'Duplex Booking', 'booking', { proprietaireId: PROPRIO });
    const c = importe('600', 'Atelier des Tanneurs', 'airbnb');
    const d: ErpDonnees = { ...donneesVides(), logements: [a, b, c] };
    const de = elementsDe(b.id, 'b');
    const autreLogement = elementsDe(c.id, 'c');
    for (const k of Object.keys(de) as (keyof ErpDonnees)[]) (d as unknown as Record<string, unknown[]>)[k] = [...((de[k] as unknown[]) ?? []), ...((autreLogement[k] as unknown[]) ?? [])];
    d.reservations = [
      { id: 'res-b1', logementId: b.id, canal: 'booking', voyageur: { nom: 'Lina', nbPersonnes: 2 }, arrivee: '2026-12-01', depart: '2026-12-04', nuits: 3, statut: 'confirmee', montantBrutCentimes: 30000, commissionPlateformeCentimes: 0, fraisMenageCentimes: 0, repull: { id: '9001' } },
      { id: 'res-c1', logementId: c.id, canal: 'airbnb', voyageur: { nom: 'Noé', nbPersonnes: 2 }, arrivee: '2026-12-01', depart: '2026-12-04', nuits: 3, statut: 'confirmee', montantBrutCentimes: 30000, commissionPlateformeCentimes: 0, fraisMenageCentimes: 0 },
    ];
    d.filsMessages = [{ id: 'fil-b1', logementId: b.id, canal: 'booking', voyageur: 'Lina', statut: 'ouvert', traitePar: 'humain', messages: [], dernierMessageLe: '' } as unknown as FilMessages];
    d.conseilsPrix = [
      { id: 'decision-b', genre: 'decision', logementId: b.id, type: 'baisse', debut: '2026-12-01', fin: '2026-12-02', prixActuel: 1, prixConseille: 1, raison: '', decision: 'fait' } as never,
      { id: 'reglages', genre: 'reglages', actif: true, notifications: true, variationMaxPct: 20, horizonJours: 30, confianceMin: 0.5, parLogement: { [b.id]: { plancher: 7000 }, [c.id]: { plancher: 5000 } } } as never,
    ];
    d.actionsAgent = [
      { id: 'act-1', cibleId: b.id, cible: b.nom, lien: `/erp/logements/${b.id}?onglet=fiche` } as never,
      { id: 'act-2', cibleId: 'res-x', cible: 'Lina', lien: `/erp/logements/${b.id}#prix` } as never,
      { id: 'act-3', cibleId: c.id, cible: c.nom, lien: `/erp/logements/${c.id}` } as never,
    ];
    d.bilansProprietaire = [{ id: 'bil-1', proprietaireId: PROPRIO, mois: '2026-10', statut: 'publie', commentaire: '', majLe: '', chiffres: { mois: '2026-10', joursMois: 31, logements: [{ logementId: b.id, nom: b.nom }, { logementId: c.id, nom: c.nom }], sejours: [{ logementId: b.id }], totaux: {}, occupation: 0 } } as never];
    d.equipe = [
      { id: 'mem-1', nom: 'Sami', role: 'agent', logementIds: [b.id, a.id], actif: true } as never,
      { id: 'mem-2', nom: 'Iris', role: 'agent', logementIds: [b.id], actif: true } as never,
      { id: 'mem-3', nom: 'Hugo', role: 'agent', logementIds: [c.id], actif: true } as never,
    ];
    d.reglages = [
      { id: 'supplements', logements: { [b.id]: { navette: { actif: true } } }, majLe: '', majPar: '' } as never,
      { id: 'messages-programmes', modeles: { arrivee: { actif: true, texte: 'x', logements: { [b.id]: { texte: 'de B' }, [a.id]: { texte: 'de A' } } } } } as never,
    ];
    d.affectations = [{ id: b.id, responsableId: 'mem-2', pointsControle: ['Literie'] }, { id: c.id, responsableId: 'mem-3' }];
    const traces = ceQuiRejoint(b, d);
    verifier(/^Ses 1 réservation|^Ses /.test(phraseCeQuiRejoint(traces)) && phraseCeQuiRejoint(traces).endsWith('rejoignent ce logement.'), 'récapitulatif : « Ses … rejoignent ce logement. »', phraseCeQuiRejoint(traces));
    verifier(phraseCeQuiRejoint([{ cle: 'reservations', nombre: 12, libelle: '12 réservations' }, { cle: 'conversations', nombre: 3, libelle: '3 conversations' }, { cle: 'menages', nombre: 2, libelle: '2 ménages' }]) === 'Ses 12 réservations, 3 conversations et 2 ménages rejoignent ce logement.', 'phrase : « Ses 12 réservations, 3 conversations et 2 ménages rejoignent ce logement. »');
    verifier(phraseCeQuiRejoint([{ cle: 'reservations', nombre: 1, libelle: '1 réservation' }]) === 'Sa réservation rejoint ce logement.' && phraseCeQuiRejoint([]) === '', 'phrase : « Sa réservation rejoint ce logement. » ; rien : pas de phrase');

    const liee = nouvelleLiee({ annonce: '502', canal: 'booking', le: 'x', par: GERANT.email, depuis: b.id });
    const r = relierConnexionDe(d, { garde: a, autre: b, liee });
    const x = r.donnees;
    verifier(!x.logements.some((l) => l.id === b.id) && x.logements.length === 2 && x.logements.find((l) => l.id === c.id) === c, 'l’autre logement retiré ; le troisième intact (même objet)');
    for (const k of COLLECTIONS_LOGEMENT_ID) {
      const liste = x[k] as unknown as { logementId?: string; id: string }[];
      const avant = d[k] as unknown as { logementId?: string; id: string }[];
      const deB = avant.filter((e) => e.logementId === b.id).length;
      verifier(deB > 0 && !liste.some((e) => e.logementId === b.id) && liste.filter((e) => e.logementId === a.id).length === deB, `${k} : ${deB} déplacé(s) sur le logement gardé`);
      verifier(liste.filter((e) => e.logementId === c.id).every((e) => avant.includes(e as never)), `${k} : ceux d’un autre logement intacts (mêmes objets)`);
    }
    const prix = x.conseilsPrix as unknown as { id: string; logementId?: string; parLogement?: Record<string, unknown> }[];
    verifier(prix.find((p) => p.id === 'decision-b')?.logementId === a.id && !!prix.find((p) => p.id === 'reglages')?.parLogement?.[a.id] && !prix.find((p) => p.id === 'reglages')?.parLogement?.[b.id], 'prix conseillés : décision et plancher déplacés');
    const actions = x.actionsAgent as unknown as { id: string; cibleId: string; lien?: string }[];
    verifier(actions[0].cibleId === a.id && actions[0].lien === `/erp/logements/${a.id}?onglet=fiche` && actions[1].lien === `/erp/logements/${a.id}#prix` && actions[2] === (d.actionsAgent[2] as unknown), 'actions de l’IA : cible et lien suivent');
    const bil = (x.bilansProprietaire[0] as unknown as { chiffres: { logements: { logementId: string }[]; sejours: { logementId: string }[] } }).chiffres;
    verifier(bil.logements[0].logementId === a.id && bil.logements[1].logementId === c.id && bil.sejours[0].logementId === a.id, 'bilans : lignes et séjours repointés (chiffres figés inchangés)');
    const equipe = x.equipe as unknown as { id: string; logementIds: string[] }[];
    verifier(equipe[0].logementIds.join() === a.id && equipe[1].logementIds.join() === a.id && equipe[2] === (d.equipe[2] as unknown), 'équipe : logements suivis repointés, sans doublon');
    const reg = x.reglages as unknown as { id: string; logements?: Record<string, unknown>; modeles?: Record<string, { logements: Record<string, { texte: string }> }> }[];
    verifier(!!reg[0].logements?.[a.id] && !reg[0].logements?.[b.id], 'suppléments : réglages de l’autre repris (rien ici)');
    verifier(reg[1].modeles?.arrivee.logements[a.id].texte === 'de A' && !reg[1].modeles?.arrivee.logements[b.id], 'messages automatiques : le texte propre d’ici gardé, celui de l’autre retiré');
    verifier(x.affectations.length === 2 && x.affectations.find((f) => f.id === a.id)?.responsableId === 'mem-2' && !x.affectations.some((f) => f.id === b.id), 'qui le suit : l’affectation de l’autre devient celle d’ici');
    verifier(r.deplaces.reservations === 1 && r.deplaces.filsMessages === 1 && r.deplaces.missions === 2, 'compte des éléments déplacés');
    verifier(COLLECTIONS_AUTRES.every((k) => Array.isArray(x[k])), 'collections hors logementId toutes traitées');
    // Rien d'autre : un jeu sans l'autre logement n'est pas touché.
    const rien = relierConnexionDe(d, { garde: a, liee: nouvelleLiee({ annonce: '777', canal: 'booking', le: 'x', par: 'y' }) });
    verifier(rien.donnees.reservations === d.reservations && rien.donnees.missions === d.missions && rien.donnees.logements.length === 3, 'annonce pas encore dans l’ERP : seule la fiche du logement change');
  }

  /* ================================================================ 6. serveur + synchronisation */
  section('6. Serveur : deux logements importés, puis l’annonce Booking.com reliée au logement Airbnb');
  const repull = new FauxRepull();
  const fb = new FausseBase();
  let horloge = new Date('2026-11-07T08:00:00.000Z');
  const maintenant = () => horloge;
  const ctx = (): ContexteConnexion => ({ cle: 'sk_test_fictif', base: nouvelleBase(fb), echeance: Date.now() + 50_000, fetch: repull.fetch as typeof fetch, attendre: async () => undefined, maintenant, budgetMois: 400 });
  const passe = (extra: Partial<Parameters<typeof lancer>[0]> = {}) =>
    lancer({ cle: 'sk_test_fictif', base: nouvelleBase(fb), declencheur: 'cron', echeance: Date.now() + 50_000, fetch: repull.fetch as typeof fetch, attendre: async () => undefined, maintenant, ...extra });

  repull.listings = [
    annonce('501', 'Duplex Saint-Spire • 2 chambres • Terrasse', 'airbnb'),
    annonce('502', 'Duplex Saint-Spire 3 pièces Terrasse — Two-Bedroom Apartment', 'booking'),
    annonce('600', 'Atelier des Tanneurs', 'airbnb', { address: { street: '9 quai Fictif', city: 'Corbeil-Essonnes' } }),
    annonce('503', 'Atelier des Tanneurs · Booking', 'booking', { address: { street: '9 quai Fictif', city: 'Corbeil-Essonnes' }, status: 'inactive' }),
  ];
  repull.reservations = [
    reservation('7001', '501', 'airbnb', '2026-11-20', '2026-10-02T10:00:00.000Z'),
    reservation('7002', '502', 'booking', '2026-11-25', '2026-10-03T10:00:00.000Z'),
    reservation('7003', '502', 'booking', '2026-12-05', '2026-10-04T10:00:00.000Z'),
  ];
  repull.conversations = [{ id: '8002', listingId: '502', reservationId: '7002', platform: 'booking', lastMessageAt: '2026-10-05T10:00:00.000Z', updatedAt: '2026-10-05T10:00:00.000Z' }];
  repull.messages = { '8002': [{ id: '81', direction: 'inbound', senderType: 'guest', body: 'Bonjour, à quelle heure arriver ?', sentAt: '2026-10-05T10:00:00.000Z' }] };
  const selection = { id: ID_SELECTION, annonces: ['501', '502', '600'], limite: null, majLe: '', majPar: GERANT.email };
  fb.poser(COLLECTION_ETAT, selection);
  fb.poser(COLLECTION_ETAT, {
    id: 'connexions',
    luLe: horloge.toISOString(),
    offre: 'custom',
    offreLuLe: horloge.toISOString(),
    annonces: [
      { id: '501', nom: 'Duplex Saint-Spire • 2 chambres • Terrasse', plateformes: ['airbnb'], statutRepull: 'active' },
      { id: '502', nom: 'Duplex Saint-Spire 3 pièces Terrasse — Two-Bedroom Apartment', plateformes: ['booking'], statutRepull: 'active' },
      { id: '600', nom: 'Atelier des Tanneurs', plateformes: ['airbnb'], statutRepull: 'active' },
      { id: '503', nom: 'Atelier des Tanneurs · Booking', plateformes: ['booking'], statutRepull: 'inactive' },
    ],
  });

  const r0 = await passe();
  verifier(r0.statut === 'fait' && !r0.bilan?.erreurs.length, 'premier passage : fait, sans erreur', r0.bilan?.erreurs);
  const A = 'repull-501';
  const B = 'repull-502';
  verifier(!!fb.get(fb.lignes.size ? 'logements' : 'x', A) && !!fb.get('logements', B), 'deux logements importés, un par annonce (la situation de départ)');
  verifier(fb.get<Reservation>('reservations', 'repull-7002')?.logementId === B && fb.get<FilMessages>('filsMessages', 'repull-8002')?.logementId === B, 'réservations et conversation Booking.com sur le logement Booking.com');

  // L'équipe a rempli la fiche du logement Booking.com, et tout ce qui le concerne.
  const bAvant = fb.get<Logement>('logements', B)!;
  fb.poser('logements', { ...bAvant, proprietaireId: PROPRIO, numeroEnregistrement: '91000000000ZZ', fiche: { ...bAvant.fiche, wifiNom: 'Box-Spire', wifiCode: 'code-fictif', parking: 'Place 12' }, contacts: [{ role: 'menage', nom: 'Équipe fictive', telephone: '06 00 00 00 99' }] });
  const aAvant = fb.get<Logement>('logements', A)!;
  fb.poser('logements', { ...aAvant, fiche: { ...aAvant.fiche, parking: 'Rue, gratuit' } });
  const ext = elementsDe(B, 'b');
  for (const [c, liste] of Object.entries(ext)) for (const e of liste as { id: string }[]) fb.poser(c, e);
  fb.poser('affectations', { id: B, responsableId: 'mem-2' });
  fb.poser('equipe', { id: 'mem-2', nom: 'Iris', role: 'agent', logementIds: [B], actif: true });
  fb.poser('actionsAgent', { id: 'act-1', cibleId: B, cible: 'Duplex', lien: `/erp/logements/${B}` });

  // Verrou pris par quelqu'un d'autre : refusé, sans rien toucher.
  const pris = await prendreVerrou(nouvelleBase(fb), { motif: 'test', par: 'autre@exemple.fr', maintenant: horloge });
  verifier(!!pris, 'verrou : pris une fois');
  verifier(!(await prendreVerrou(nouvelleBase(fb), { motif: 'test', par: 'x@exemple.fr', maintenant: horloge })), 'verrou : une seconde prise refusée');
  const appelsAvant = repull.appels.length;
  const occupe = await passe();
  verifier(occupe.statut === 'occupe' && repull.appels.length === appelsAvant, 'synchronisation pendant le verrou : « occupe », aucun appel au service de connexion');
  let refuse = '';
  try {
    await relierAutreAnnonce(ctx(), A, '502', GERANT);
  } catch (e) {
    refuse = e instanceof ErreurConnexion ? `${e.statut} ${e.message}` : String(e);
  }
  verifier(/^409 .*réessayez dans une minute/.test(refuse), 'relier pendant un autre lien : refusé (409)', refuse);
  {
    // Un passage commencé avant la prise : il s'arrête avant sa prochaine écriture de données.
    const g = (await lireVerrou(nouvelleBase(fb))).verrou!.generation;
    const vieux = baseGardee(nouvelleBase(fb), g - 1, maintenant);
    let arrete = false;
    try {
      await vieux.ecrire('reservations', [{ id: 'jamais' }]);
    } catch (e) {
      arrete = e instanceof SynchroInterrompue;
    }
    verifier(arrete && !fb.get('reservations', 'jamais'), 'passage commencé avant le lien : arrêté avant d’écrire (SynchroInterrompue)');
    await vieux.ecrire('journal', [{ id: 'jrn-ok' }]);
    verifier(!!fb.get('journal', 'jrn-ok'), 'son journal s’écrit quand même');
  }
  await rendreVerrou(nouvelleBase(fb), pris!.jeton, 'autre@exemple.fr');
  verifier(!verrouPris((await lireVerrou(nouvelleBase(fb))).verrou, horloge.getTime()), 'verrou rendu');
  {
    const g = (await lireVerrou(nouvelleBase(fb))).verrou!.generation;
    const ancien = await prendreVerrou(nouvelleBase(fb), { motif: 'test', par: 'x@exemple.fr', maintenant: new Date(horloge.getTime() - DUREE_VERROU_MS - 1000) });
    verifier(!!ancien && !verrouPris((await lireVerrou(nouvelleBase(fb))).verrou, horloge.getTime()) && (await lireVerrou(nouvelleBase(fb))).verrou!.generation === g + 1, 'bail expiré : le verrou se libère seul');
  }

  {
    // Un lien de quelques secondes en cours : le passage (webhook d'une réservation, cron) attend sa fin, puis se fait.
    const court = await prendreVerrou(nouvelleBase(fb), { motif: 'test', par: 'autre@exemple.fr', maintenant: horloge });
    let attentes = 0;
    const r = await passe({
      attendre: async () => {
        attentes++;
        if (court) await rendreVerrou(nouvelleBase(fb), court.jeton, 'autre@exemple.fr');
      },
    });
    verifier(!!court && r.statut === 'fait' && attentes === 1 && !r.bilan?.erreurs.length, 'lien court en cours : le passage attend sa fin puis se fait (rien de perdu)', { statut: r.statut, attentes });
  }

  // Le lien.
  const appelsAvantLien = repull.appels.length;
  const ecrituresAvant = fb.ecritures.length;
  const res: ResultatConnexion = await relierAutreAnnonce(ctx(), A, '502', GERANT);
  verifier(repull.appels.length === appelsAvantLien, 'relier : AUCUN appel au service de connexion (ni lecture, ni écriture)');
  verifier(res.ok && !res.deja && res.retire?.id === B && res.canal === 'booking', 'relié : le logement Booking.com a rejoint le logement Airbnb', res);
  verifier(/^Ses 2 réservations, 1 conversation, 1 ménage et d’autres éléments rejoignent ce logement\.$/.test(res.phrase), 'phrase du résultat : réservations, conversations et ménages d’abord', res.phrase);
  const aApres = fb.get<Logement>('logements', A)!;
  verifier(!fb.get('logements', B), 'le logement Booking.com a disparu de la liste');
  verifier(aApres.repull?.liees?.[0]?.id === '502' && aApres.repull.liees[0].depuis === B && aApres.repull.liees[0].par === GERANT.email && !!aApres.repull.liees[0].le, 'annonce reliée sur le logement gardé (par, le, depuis)');
  verifier(aApres.annonces.some((x) => x.canal === 'booking' && x.connecte) && aApres.annonces.some((x) => x.canal === 'airbnb'), 'ses deux connexions : Airbnb et Booking.com');
  verifier(aApres.proprietaireId === PROPRIO && aApres.fiche.wifiNom === 'Box-Spire' && aApres.numeroEnregistrement === '91000000000ZZ' && aApres.contacts?.[0].nom === 'Équipe fictive', 'saisies de l’équipe sur l’autre : reprises dans les champs vides');
  verifier(aApres.fiche.parking === 'Rue, gratuit' && aApres.nom === aAvant.nom, 'saisies du gardé et nom : intacts');
  for (const k of COLLECTIONS_LOGEMENT_ID) {
    const n = fb.collection<{ logementId?: string }>(k);
    if (!n.length) continue;
    verifier(!n.some((e) => e.logementId === B) && n.some((e) => e.logementId === A), `base : ${k} sur le logement gardé`);
  }
  verifier(fb.get<{ logementIds: string[] }>('equipe', 'mem-2')?.logementIds.join() === A && fb.get<{ responsableId: string }>('affectations', A)?.responsableId === 'mem-2' && !fb.get('affectations', B), 'base : équipe et affectation suivent');
  verifier(fb.get<{ cibleId: string }>('actionsAgent', 'act-1')?.cibleId === A, 'base : action de l’IA repointée');
  const trace = fb.get<{ annonces: Record<string, { logementId: string; depuis: string }> }>(COLLECTION_ETAT, ID_ANNONCES_RELIEES);
  verifier(trace?.annonces['502']?.logementId === A && trace.annonces['502'].depuis === B, 'trace côté serveur : 502 → logement gardé, venu de « repull-502 »');
  const journal = fb.collection<Journal>('journal').find((j) => j.action === 'Annonce reliée au logement');
  verifier(!!journal && journal.auteur === GERANT.email && journal.entiteId === A && !!journal.horodatage && /Booking\.com/.test(journal.details), 'journal : qui, quand, quoi', journal);
  verifier(!verrouPris((await lireVerrou(nouvelleBase(fb))).verrou, horloge.getTime()), 'verrou rendu après le lien');
  verifier(fb.ecritures.slice(ecrituresAvant).every((e) => e.collection !== 'logements' || e.id === A || (e.id === B && e.op === 'supprimer')), 'logements écrits : le gardé (et la suppression de l’autre), rien d’autre');

  // Idempotence.
  const ecrituresApres = fb.donnees().length;
  const encore = await relierAutreAnnonce(ctx(), A, '502', GERANT);
  verifier(encore.deja && fb.donnees().length === ecrituresApres && repull.appels.length === appelsAvantLien, 'refait : « déjà relié », aucune écriture de données, aucun appel');

  section('6 bis. Reprise après une interruption, et un ménage créé pendant l’opération');
  {
    const fb2 = new FausseBase();
    const ctx2 = (): ContexteConnexion => ({ cle: 'sk_test_fictif', base: nouvelleBase(fb2), echeance: Date.now() + 50_000, fetch: repull.fetch as typeof fetch, attendre: async () => undefined, maintenant });
    const g = importe('701', 'Studio des Lavandières', 'airbnb');
    const o = importe('702', 'Studio des Lavandières Booking', 'booking', { proprietaireId: PROPRIO });
    // Interrompu après l'étape 1 : le gardé porte déjà l'annonce reliée, l'autre est encore là avec ses réservations.
    fb2.poser('logements', fusionnerLogement(g, nouvelleLiee({ annonce: '702', canal: 'booking', le: 'x', par: GERANT.email, depuis: o.id }), o).logement);
    fb2.poser('logements', o);
    fb2.poser('reservations', { id: 'res-702', logementId: o.id, canal: 'booking', repull: { id: '99' } });
    fb2.poser(COLLECTION_ETAT, { id: ID_SELECTION, annonces: ['701', '702'], limite: null, majLe: '', majPar: '' });
    let ajoute = false;
    fb2.avantSuppression = (c, id) => {
      // Un ménage arrive sur l'autre logement juste avant sa suppression : la base refuse, on balaie, on réessaie.
      if (c === 'logements' && id === o.id && !ajoute) {
        ajoute = true;
        fb2.poser('missions', { id: 'mis-tard', type: 'menage', logementId: o.id });
      }
    };
    const r = await relierAutreAnnonce(ctx2(), g.id, '702', GERANT);
    verifier(!r.deja && r.retire?.id === o.id && !fb2.get('logements', o.id), 'reprise : l’opération finit ce qui restait');
    verifier(fb2.get<Reservation>('reservations', 'res-702')?.logementId === g.id && fb2.get<{ logementId: string }>('missions', 'mis-tard')?.logementId === g.id, 'ménage arrivé pendant l’opération : déplacé lui aussi (la base refusait la suppression)');
    verifier((fb2.get<Logement>('logements', g.id)?.repull?.liees ?? []).length === 1, 'toujours une seule annonce reliée (rien en double)');
  }

  /* ------------------------------------------------ synchronisation après coup */
  section('7. Synchronisation après le lien');
  horloge = new Date('2026-11-08T08:30:00.000Z');
  const l502 = repull.listings.find((l) => l.id === '502')!;
  Object.assign(l502, { name: 'Nouveau nom Booking', photos: [{ url: 'https://cdn.exemple.fr/502-neuve.jpg', sortOrder: 0 }], thumbnailUrl: 'https://cdn.exemple.fr/502-neuve.jpg', updatedAt: '2026-11-08T07:00:00.000Z' });
  repull.reservations.push(reservation('7004', '502', 'booking', '2026-12-20', '2026-11-08T07:10:00.000Z'));
  repull.conversations[0] = { ...repull.conversations[0], lastMessageAt: '2026-11-08T07:20:00.000Z', updatedAt: '2026-11-08T07:20:00.000Z' };
  repull.messages['8002'].push({ id: '82', direction: 'inbound', senderType: 'guest', body: 'Merci !', sentAt: '2026-11-08T07:20:00.000Z' });
  const appelsAvantSync = repull.appels.length;
  const r1 = await passe();
  verifier(r1.statut === 'fait' && !r1.bilan?.erreurs.length && r1.bilan?.phases.includes('annonces'), 'passage complet (annonces comprises) : fait', r1.bilan);
  verifier(!fb.get('logements', B) && fb.collection<Logement>('logements').length === 2, 'le logement Booking.com n’est PAS recréé');
  const aSync = fb.get<Logement>('logements', A)!;
  verifier(aSync.nom === 'Duplex Saint-Spire • 2 chambres • Terrasse' && aSync.photos?.[0] === 'https://cdn.exemple.fr/501-1.jpg' && aSync.photoUrl === 'https://cdn.exemple.fr/501-couverture.jpg', 'nom et photos : ceux de l’annonce principale (Airbnb), pas de la Booking.com');
  verifier(!/502/.test(JSON.stringify(aSync.descriptif ?? {})), 'description : celle de l’annonce principale');
  verifier(aSync.repull?.liees?.length === 1 && aSync.annonces.some((x) => x.canal === 'booking' && x.connecte), 'annonce reliée et connexion Booking.com gardées');
  verifier(fb.get<Reservation>('reservations', 'repull-7004')?.logementId === A && fb.get<Reservation>('reservations', 'repull-7004')?.canal === 'booking', 'nouvelle réservation Booking.com : sur le logement gardé');
  verifier(fb.get<Reservation>('reservations', 'repull-7002')?.logementId === A, 'anciennes réservations : restées sur le logement gardé');
  const fil = fb.get<FilMessages>('filsMessages', 'repull-8002')!;
  verifier(fil.logementId === A && fil.messages.length === 2, 'conversation Booking.com : sur le logement gardé, avec le nouveau message');
  const appelsSync = repull.appels.slice(appelsAvantSync);
  verifier(appelsSync.length > 0 && appelsSync.every((a) => a.methode === 'GET'), 'synchronisation : seulement des lectures', appelsSync.filter((a) => a.methode !== 'GET'));
  verifier(!appelsSync.some((a) => /\/v1\/(availability\/502|listings\/502\/photos|channels\/booking\/listings\/502)/.test(a.chemin)), 'annonce reliée : ni photos ni prix relus pour elle');
  const ecrituresSync = fb.donnees().length;
  horloge = new Date('2026-11-08T08:45:00.000Z');
  const r2 = await passe();
  verifier(r2.statut === 'fait' && fb.donnees().length === ecrituresSync, 'passage suivant : aucune écriture (idempotent)', fb.donnees().slice(ecrituresSync));

  // Annonce reliée décochée : le logement (son annonce principale) ne passe pas en pause.
  fb.poser(COLLECTION_ETAT, { ...selection, annonces: ['501', '600'] });
  horloge = new Date('2026-11-09T09:00:00.000Z');
  await passe();
  verifier(fb.get<Logement>('logements', A)?.statut === 'actif' && !fb.get('logements', B), 'annonce reliée décochée : le logement reste actif, rien de recréé');
  fb.poser(COLLECTION_ETAT, selection);

  // Logement réécrit sans son annonce reliée (une vieille page ouverte) : la trace la lui rend.
  const sansLiee = fb.get<Logement>('logements', A)!;
  fb.poser('logements', { ...sansLiee, repull: { ...sansLiee.repull!, liees: undefined } });
  horloge = new Date('2026-11-10T09:00:00.000Z');
  repull.reservations.push(reservation('7005', '502', 'booking', '2027-01-05', '2026-11-10T08:00:00.000Z'));
  await passe();
  verifier(!fb.get('logements', B) && fb.get<Reservation>('reservations', 'repull-7005')?.logementId === A, 'sans l’annonce reliée sur la fiche : rien de recréé, réservation sur le logement gardé (trace)');
  verifier(fb.get<Logement>('logements', A)?.repull?.liees?.[0]?.id === '502', 'l’annonce reliée revient sur la fiche (trace côté serveur)');

  section('7 bis. Après le lien : rattrapage, réponse immédiate, relecture des réservations');
  {
    // Une modification faite hors ligne arrive plus tard sur l'autre logement (supprimé) : le passage du cron la ramène.
    fb.poser('missions', { id: 'mis-hors-ligne', type: 'menage', logementId: B });
    horloge = new Date('2026-11-10T10:00:00.000Z');
    await passe();
    verifier(fb.get<{ logementId: string }>('missions', 'mis-hors-ligne')?.logementId === A, 'ménage modifié hors ligne sur l’autre logement : ramené par le passage du cron (rattrapage)');

    // Une réservation plus récente est connue…
    repull.reservations.push(reservation('7012', '502', 'booking', '2027-02-10', '2026-11-10T10:20:00.000Z'));
    horloge = new Date('2026-11-10T10:15:00.000Z');
    await passe();
    // …puis un autre lien est en cours : « déjà relié » répond tout de suite, sans attendre le verrou.
    const autreLien = await prendreVerrou(nouvelleBase(fb), { motif: 'test', par: 'autre@exemple.fr', maintenant: horloge });
    const deja2 = await relierAutreAnnonce(ctx(), A, '502', GERANT);
    verifier(!!autreLien && deja2.deja, 'déjà relié : répond tout de suite, même pendant un autre lien');
    // Un passage (webhook) remis pendant ce lien : relecture demandée.
    const remis = await passe();
    verifier(remis.statut === 'occupe' && !!fb.get<{ depuis?: string }>(COLLECTION_ETAT, 'relire')?.depuis, 'passage remis pendant un lien : relecture des réservations demandée');
    await rendreVerrou(nouvelleBase(fb), autreLien!.jeton, 'autre@exemple.fr');
    // La réservation de ce webhook est plus ancienne que la plus récente connue : relue quand même au passage suivant.
    repull.reservations.push(reservation('7011', '502', 'booking', '2027-02-01', '2026-11-10T10:12:00.000Z'));
    horloge = new Date('2026-11-10T10:30:00.000Z');
    await passe();
    verifier(fb.get<Reservation>('reservations', 'repull-7011')?.logementId === A, 'réservation manquée pendant le lien : relue au passage suivant (relecture), sur le logement gardé');
    verifier(!fb.get<{ depuis?: string }>(COLLECTION_ETAT, 'relire')?.depuis, 'relecture faite : demande effacée');
    verifier(!verrouPris({ jeton: 'x', jusqua: horloge.getTime() + 10 * 60_000 }, horloge.getTime()), 'verrou au bail plus long que prévu (forgé) : ne bloque rien');
    let trop = '';
    try {
      await enregistrerSelectionAvecLiaisons(ctx(), ['501'], Array.from({ length: 11 }, (_, i) => ({ annonce: String(900 + i), logement: A })), GERANT);
    } catch (e) {
      trop = e instanceof Error ? e.message : String(e);
    }
    verifier(/Trop de liens à la fois \(10 au plus\)/.test(trop), '« Enregistrer mon choix » : 10 liens au plus à la fois', trop);
  }

  /* ------------------------------------------------ choix de la page Connexions */
  section('8. Page Connexions : « Est-ce le même logement que… ? » Oui');
  repull.reservations.push(reservation('7006', '503', 'booking', '2027-01-10', '2026-11-10T09:00:00.000Z'));
  const appelsAvantChoix = repull.appels.length;
  horloge = new Date('2026-11-10T10:00:00.000Z');
  const choix = await enregistrerSelectionAvecLiaisons(ctx(), ['501', '502', '600', '503'], [{ annonce: '503', logement: 'repull-600' }], GERANT);
  verifier(choix.liaisons === 1 && choix.selection.includes('503'), 'choix enregistré, un lien posé', choix);
  verifier(!fb.get('logements', 'repull-503') && fb.get<Logement>('logements', 'repull-600')?.repull?.liees?.[0]?.id === '503', 'annonce cochée et dite « même logement » : pas de nouveau logement, reliée à « Atelier des Tanneurs »');
  verifier(fb.get<Reservation>('reservations', 'repull-7006')?.logementId === 'repull-600', 'ses réservations : sur ce logement');
  const ecrituresChoix = repull.appels.slice(appelsAvantChoix).filter((a) => a.methode !== 'GET');
  verifier(ecrituresChoix.every((a) => a.methode === 'POST' && a.chemin === '/v1/listings/status'), 'seule écriture vers le service : celle du choix, déjà existante (logements suivis), rien de nouveau', ecrituresChoix);
  let refusChoix = '';
  try {
    await enregistrerSelectionAvecLiaisons(ctx(), ['501', '502', '600', '503'], [{ annonce: '503', logement: A }], GERANT);
  } catch (e) {
    refusChoix = e instanceof ErreurConnexion ? e.message : String(e);
  }
  verifier(/déjà reliée/.test(refusChoix), 'lien refusé (annonce déjà reliée) : tout s’arrête avant le choix', refusChoix);
  let refusOps = '';
  try {
    await relierAutreAnnonce(ctx(), A, '503', { email: 'ops@exemple.fr', role: 'operations' });
  } catch (e) {
    refusOps = e instanceof ErreurConnexion ? `${e.statut}` : String(e);
  }
  verifier(refusOps === '403', 'compte « opérations » : refusé (403)');

  /* ------------------------------------------------ propositions de l'assistant */
  section('9. Assistant « Relier l’annonce Booking.com » : les annonces proposées');
  {
    const a = importe('501', 'Duplex Saint-Spire • 2 chambres', 'airbnb', { ville: 'Corbeil-Essonnes' });
    const b = importe('502', 'Duplex Saint-Spire 3 pièces', 'booking', { ville: 'Corbeil-Essonnes' });
    const annonces = [
      { id: '502', nom: b.nom, plateformes: ['booking'], statutRepull: 'active', selectionnee: true, logementId: b.id },
      { id: '540', nom: 'Pas suivie', plateformes: ['booking'], statutRepull: 'inactive', selectionnee: false },
      { id: '541', nom: 'Suivie pas encore importée', plateformes: ['booking'], statutRepull: 'active', selectionnee: true },
      { id: '542', nom: 'Airbnb', plateformes: ['airbnb'], statutRepull: 'active' },
      { id: '543', nom: 'Les deux', plateformes: ['airbnb', 'booking'], statutRepull: 'active' },
      { id: '544', nom: 'Archivée', plateformes: ['booking'], statutRepull: 'archived' },
    ];
    const p = annoncesProposees(a, 'booking', annonces, [a, b]);
    verifier(p.map((x) => x.annonce.id).join() === '502,541,540', 'seulement Booking.com, une plateforme, pas archivée ; la plus ressemblante d’abord', p.map((x) => x.annonce.id));
    verifier(p[0].logement?.id === b.id && p[0].niveau === 'forte' && !p[0].bloquee && !p[1].bloquee && /Connexions/.test(p[2].bloquee ?? ''), 'importée à part : choisissable (son logement le rejoindra) ; pas suivie : à cocher d’abord dans Connexions');
  }

  /* ------------------------------------------------ aucune écriture vers les plateformes */
  section('10. Aucune écriture vers les plateformes');
  {
    verifier(repull.ecrituresVers().every((a) => a.chemin === '/v1/listings/status'), 'sur tout le scénario, aucune autre écriture que le choix existant des logements suivis', repull.ecrituresVers());
    verifier(
      !ecritureRepullPermise('POST', '/v1/listings/501', {}) &&
        !ecritureRepullPermise('PUT', '/v1/availability/501', {}) &&
        !ecritureRepullPermise('PATCH', '/v1/listings/502', {}) &&
        !ecritureRepullPermise('POST', '/v1/listings/merge', { ids: ['501', '502'] }) &&
        !ecritureRepullPermise('POST', '/v1/listings/502/link', { to: '501' }),
      'le verrou des écritures refuse toujours annonces, calendrier, prix, et tout « lien » ou « fusion » d’annonces',
    );
    // Le module des connexions et l'opération serveur n'appellent pas le service de connexion.
    const fs = (await import('node:fs' as string)) as { readFileSync: (p: string, e: string) => string };
    const regles = fs.readFileSync('src/erp/data/annonces-liees.ts', 'utf8');
    verifier(!/ClientRepull|avecClient|\.post\(|\.supprimer\(|fetch\(/.test(regles), 'annonces-liees.ts : aucun appel réseau');
    const serveur = fs.readFileSync('src/erp/data/repull-connexion.ts', 'utf8');
    const corps = serveur.slice(serveur.indexOf('export async function relierAutreAnnonce'), serveur.indexOf('export async function enregistrerSelectionAvecLiaisons'));
    verifier(corps.length > 1000 && !/avecClient|ClientRepull|client\.|lancer\(/.test(corps), 'relierAutreAnnonce : ni client du service de connexion, ni passage de synchronisation');
  }

  /* ------------------------------------------------ écran : droits */
  section('11. Droits : le lien entre annonces reste au gérant');
  {
    const a = importe('501', 'Duplex', 'airbnb');
    const d0 = { ...donneesVides(), logements: [a] } as ErpDonnees;
    const ecrire = (id: string, donnees: unknown) => ({ type: 'ecrire', collection: 'logements', id, donnees }) as never;
    const avecLiee = { ...a, repull: { ...a.repull!, liees: [nouvelleLiee({ annonce: '502', canal: 'booking', le: 'x', par: 'y' })] } };
    verifier(operationReserveeAuGerant(ecrire(a.id, avecLiee), d0), 'compte « opérations » : ajouter une annonce reliée refusé (comme la base)');
    verifier(operationReserveeAuGerant(ecrire('log-neuf', { ...logementVide('log-neuf', 'N'), repull: { liees: [] } }), d0), 'compte « opérations » : créer un logement avec des annonces reliées refusé');
    const d1 = { ...donneesVides(), logements: [avecLiee] } as ErpDonnees;
    verifier(!operationReserveeAuGerant(ecrire(a.id, { ...avecLiee, nom: 'Nouveau nom' }), d1), 'modifier le reste d’un logement relié : permis');
    verifier(operationReserveeAuGerant(ecrire('log-main', lierLogement(logementVide('log-main', 'x'), '501', { le: '', par: '' })), d0), 'poser un lien principal : toujours réservé');
  }

  /* ------------------------------------------------ démonstration */
  section('12. Démonstration : une paire Airbnb / Booking.com du même appartement');
  {
    const { creerSeed } = await import('./seed');
    const { etatConnexionsDemo } = await import('./seed-connexions');
    const seed = creerSeed();
    const airbnb = seed.logements.find((l) => l.id === 'repull-219002')!;
    const booking = seed.logements.find((l) => l.id === 'log-massy')!;
    verifier(!!airbnb && canauxPrincipaux(airbnb).join() === 'airbnb' && canauxPrincipaux(booking).join() === 'booking', 'démo : « Massy Atlantis » (Booking.com) et son annonce Airbnb importée à part');
    verifier(suggestionPour(airbnb, seed.logements)?.id === booking.id && suggestionPour(booking, seed.logements)?.id === airbnb.id, 'démo : chacune des deux fiches propose l’autre (même adresse)');
    verifier(seed.logements.filter((l) => suggestionPour(l, seed.logements)).length === 2, 'démo : aucune autre proposition (fiable seulement)');
    const r = relierConnexionDe(seed, { garde: airbnb, autre: booking, liee: nouvelleLiee({ annonce: '219001', canal: 'booking', le: 'x', par: 'demo@exemple.fr', depuis: booking.id }) });
    const etat = etatConnexionsDemo(r.donnees.logements);
    verifier(etat.annonces.filter((a) => a.logementId === airbnb.id).map((a) => a.id).sort().join() === '219001,219002' && !etat.annonces.some((a) => a.logementId === booking.id), 'démo, page Connexions : les deux annonces sur le même logement');
    verifier(r.donnees.reservations.filter((x) => x.logementId === airbnb.id).length > 1 && !r.donnees.reservations.some((x) => x.logementId === booking.id), 'démo : les séjours de « Massy Atlantis » rejoignent le logement gardé');
    const juvisy = etatConnexionsDemo(seed.logements).annonces.find((a) => a.id === '219330')!;
    verifier(logementsPourAnnonce(juvisy, seed.logements).forte?.id === 'log-juvisy', 'démo : cocher « Juvisy Gare · 2 pièces » demande « Est-ce le même logement que Juvisy Gare ? »');
  }

  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
}

principal().catch((e) => {
  console.error(e);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
});
