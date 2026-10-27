/**
 * Auto-contrôle de la synchronisation Repull → ERP (repull.ts,
 * repull-synchro.ts, signature du webhook) sans réseau : une fausse API
 * Repull (charges utiles construites sur les schémas de l'OpenAPI Repull) et
 * une fausse API PostgREST en mémoire.
 *
 * Vérifie : formes conformes aux types de l'ERP, montants en centimes,
 * idempotence (second passage sans aucune écriture de données), survie des
 * champs saisis par l'équipe, annulation, message entrant sur un fil clos,
 * annonce archivée, passage incrémental (updated_since), limite du bouton
 * (10 min), part mensuelle d'appels, ménage créé par le moteur
 * d'automatisations, et signature X-Repull-Signature (repull-signature.ts).
 *
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-repull.ts --bundle --platform=node \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-repull.cjs \
 *     && node /tmp/verifier-repull.cjs
 */
import { signatureValide, type OutilsSignature } from './repull-signature';
import { executerAutomatisations } from '../automatisations';
import { donneesVides } from './collections';
import { ID_PROPRIETAIRE_A_RENSEIGNER, canonique, ecartsBilan, montantsReservation, noteSur5, heure, photosDepuisContenu, tarifsDepuisBooking, versFil, type RepullConversation } from './repull';
import { attendEquipe } from './attente-equipe';
import { BaseErp, ClientRepull, COLLECTION_ETAT, ErreurRepull, ID_ETAT, ID_SELECTION, ecritureRepullPermise, lancer, phasesDues, type EtatRepull, type ResultatLancement, type SelectionRepull } from './repull-synchro';
import { ErreurConnexion, deconnecter, demarrerConnexion, enregistrerSelection, lireEtatConnexions, type ContexteConnexion } from './repull-connexion';
import { ErreurEnvoi, cleEnvoi, envoyerMessage, messageEchecEnvoi } from './messagerie-envoi';
import { faitsPageAirbnb, idAirbnbDuLogement, lirePageAirbnb, photosPageAirbnb } from './page-airbnb';
import { PAR_MESSAGE_AUTO } from './messages-programmes';
import { auteurAffiche } from '../modules/messagerie/_composants/logique';
import type { ErpDonnees, FilMessages, Journal, Logement, Proprietaire, Reservation } from './types';

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

/* ------------------------------------------------------ fausse API Repull */

const R = {
  listings: [
    {
      id: '101',
      name: 'Studio Cœur de Ville',
      address: { street: '12 rue Pasteur', city: 'Évry-Courcouronnes' },
      thumbnailUrl: 'https://cdn.repull.dev/p/101.jpg',
      status: 'active',
      channels: [
        { platform: 'airbnb', externalId: '998877665544332211', active: true, syncEnabled: true },
        { platform: 'booking', externalId: '5566771', active: true, syncEnabled: true },
      ],
      content: {
        name: 'Studio Cœur de Ville',
        houseRules: 'Pas de fête. Non-fumeur.',
        summary: 'Studio lumineux au cœur de la ville.',
        description: 'Idéal pour un couple.\r\n\r\n\r\n\r\nCuisine équipée.',
        neighborhoodOverview: 'Commerces au pied de l’immeuble.',
        transit: '',
      },
      details: {
        propertyType: 'apartment',
        propertyTypeCategory: 'apartment',
        bedrooms: 0,
        beds: 1,
        personCapacity: 2,
        checkInTimeStart: '4 PM',
        checkOutTime: '11:00',
        wifiNetwork: 'Box-101',
        wifiPassword: 'motdepasse101',
        directions: 'Boîte à clés à gauche de la porte.',
        propertySize: { value: 24, unit: 'sqm' },
      },
      createdAt: '2026-01-10T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: '102',
      name: 'Maison des Tilleuls',
      address: { street: '3 allée des Tilleuls', city: 'Massy' },
      thumbnailUrl: 'https://cdn.repull.dev/p/102.jpg',
      status: 'active',
      channels: [{ platform: 'airbnb', externalId: '112233', active: true, syncEnabled: true }],
      content: null,
      details: { propertyTypeCategory: 'house', bedrooms: 3, personCapacity: 6, checkInTimeStart: '15:00', checkOutTime: '10:00', bathrooms: '1.5', houseManual: 'Poubelles : local vélo, sortie le mardi soir.' },
      // Lectures ?include=photos,rooms,policies,rules,pricing,fees (schémas ListingContentPhoto, ListingRoom…).
      publicName: 'Maison familiale avec jardin',
      photos: [
        { url: 'https://cdn.repull.dev/p/102-b.jpg', sortOrder: 2 },
        { url: 'http://pas-sur/102.jpg', sortOrder: 0 },
        { url: 'https://cdn.repull.dev/p/102-a.jpg', sortOrder: 1 },
      ],
      rooms: [
        { type: 'bedroom', number: 1, beds: [{ type: 'queen_bed', quantity: 1 }] },
        { type: 'bedroom', number: 2, beds: [{ type: 'single_bed', quantity: 2 }] },
        { type: 'living_room', beds: [{ type: 'sofa_bed', quantity: 1 }] },
        { type: 'full_bathroom', beds: [] },
      ],
      policies: {
        cancellationPolicy: 'moderate',
        checkIn: { method: 'lockbox', instructions: 'Boîte à clés sous la boîte aux lettres.', from: '15:00', until: '22:00' },
        checkOut: { until: '10:00' },
        allowsPets: false,
        allowsSmoking: false,
        allowsEvents: false,
        allowsChildren: true,
        quietHours: { start: '22:00', end: '07:00' },
        securityDeposit: 300,
      },
      rules: { minNights: 2, maxNights: 28, advanceNoticeHours: 24, instantBook: 'everyone' },
      pricing: { currency: 'EUR', basePrice: 120, weekendPrice: 140, cleaningFee: 50, extraGuestFee: 0, guestsIncluded: 4, weeklyDiscountPercent: 10 },
      fees: [
        { type: 'cleaning', amount: 50, amountType: 'flat', chargedPer: 'stay' },
        { type: 'pet', amount: 15, amountType: 'flat', chargedPer: 'stay', optional: true },
      ],
      createdAt: '2026-02-10T10:00:00.000Z',
      updatedAt: '2026-09-02T10:00:00.000Z',
    },
  ] as Record<string, unknown>[],
  amenities: [
    { amenityKey: 'wifi', isPresent: true },
    { amenityKey: 'air_conditioning', isPresent: true },
    { amenityKey: 'pool', isPresent: false },
  ],
  reservations: [
    {
      id: '5001',
      listingId: '101',
      checkIn: '2026-10-02',
      checkOut: '2026-10-05',
      checkInTime: '16:00',
      checkOutTime: '11:00',
      status: 'confirmed',
      source: 'airbnb',
      confirmationCode: 'HMXYZ123',
      primaryGuest: { id: '801', firstName: 'Alex', lastName: 'Morgan', email: 'alex@example.com' },
      occupancy: { adults: 2, children: 1, infants: 0, pets: 0, total: 3 },
      financials: {
        totalPrice: 739.32,
        currency: 'EUR',
        host: {
          accommodation: 485,
          discounts: [],
          hostFees: [{ name: 'Host service fee', type: 'host_service', amount: 18.28, vat: 3.66 }],
          revenue: 566.72,
        },
        guest: {
          totalPrice: 739.32,
          fees: [
            { name: 'Cleaning Fee', type: 'cleaning', amount: 60 },
            { name: 'Service fee', type: 'guest_service', amount: 94.32 },
          ],
          taxes: [{ name: 'Taxe de séjour', type: 'airbnb_collected', amount: 6 }],
        },
      },
      createdAt: '2026-09-10T08:00:00.000Z',
      updatedAt: '2026-09-10T08:00:00.000Z',
      guestName: 'Alex Morgan',
    },
    {
      id: '5002',
      listingId: '102',
      checkIn: '2026-09-01',
      checkOut: '2026-09-04',
      status: 'completed',
      source: 'booking.com',
      confirmationCode: '4455667788',
      primaryGuest: { id: '802', firstName: 'Julie', lastName: 'Martin' },
      occupancy: { total: 4 },
      financials: { totalPrice: 900, currency: 'EUR' },
      createdAt: '2026-08-01T08:00:00.000Z',
      updatedAt: '2026-09-05T08:00:00.000Z',
      guestName: 'Julie Martin',
    },
    {
      id: '5003',
      listingId: '101',
      checkIn: '2026-11-10',
      checkOut: '2026-11-12',
      status: 'pending',
      pendingReason: 'host_approval',
      source: 'airbnb',
      createdAt: '2026-09-20T08:00:00.000Z',
      updatedAt: '2026-09-20T08:00:00.000Z',
      guestName: 'Demande Enattente',
    },
  ] as Record<string, unknown>[],
  reviews: [
    {
      id: '9001',
      platform: 'booking',
      listingId: '102',
      reservationId: '5002',
      reservationConfirmationCode: '4455667788',
      reviewerRole: 'guest',
      rating: 9,
      publicReview: 'Maison très agréable.',
      privateFeedback: 'La douche coule un peu.',
      submittedAt: '2026-09-06T09:00:00.000Z',
    },
  ] as Record<string, unknown>[],
  conversations: [
    {
      id: '7001',
      platform: 'airbnb',
      listingId: '101',
      reservationId: '5001',
      lastMessageAt: '2026-09-10T09:05:00.000Z',
      createdAt: '2026-09-10T08:01:00.000Z',
      updatedAt: '2026-09-10T09:05:00.000Z',
      status: 'open',
    },
  ] as Record<string, unknown>[],
  messages: {
    '7001': [
      { id: 'm1', direction: 'inbound', senderType: 'guest', senderName: 'Alex', body: 'Bonjour, à quelle heure peut-on arriver ?', attachments: [], sentAt: '2026-09-10T08:01:00.000Z' },
      { id: 'm2', direction: 'outbound', senderType: 'host', senderName: 'Label Maison', body: 'Dès 16 h, bienvenue !', attachments: [], aiGenerated: true, sentAt: '2026-09-10T09:05:00.000Z' },
    ],
  } as Record<string, Record<string, unknown>[]>,
  guests: [
    { id: '801', displayName: 'Alex', country: 'US' },
    { id: '802', displayName: 'Julie', country: 'FR' },
  ],
};

interface Appel {
  chemin: string;
  params: URLSearchParams;
  methode: string;
  corps?: Record<string, unknown>;
  cle?: string | null;
}

class FauxRepull {
  appels: Appel[] = [];
  /** Réponses gardées par clé d'idempotence (Repull : 24 h). */
  idempotence = new Map<string, { charge: string; reponse: Record<string, unknown> }>();
  /** Refus imposé au prochain envoi de message (422 message_not_sent...). */
  refusEnvoi: { status: number; corps: unknown } | null = null;
  envois: { conversation: string; message: string; cle: string }[] = [];
  /** Taille de page simulée (la vraie limite est 100) : force la pagination par curseur. */
  page = 2;
  /** Rien de déposé chez Repull pour 101 (photos, calendrier) : les lectures Booking.com prennent le relais. */
  ficheRepullVide = false;
  /** Booking.com refuse les lectures (403 listing_inactive), pour les raisons en clair. */
  bookingInactif = false;
  /** Pages publiques Airbnb servies (id d'annonce → HTML) ; les autres répondent 403. */
  pagesAirbnb = new Map<string, string>();
  /** Pages publiques Airbnb demandées (adresse, en-têtes). */
  lecturesAirbnb: { url: string; entetes: Headers }[] = [];
  /** Lectures étendues des annonces refusées (422), pour tester le repli. */
  refusInclusEtendus = false;
  /** Annonces actives permises par l'offre (gratuite : 3), comme l'API (402). */
  limiteActives = 3;
  /** Compte au-delà de sa limite : l'API répond 402 partout (sauf usage et DELETE). */
  bloque402 = false;
  connexions: Record<string, unknown>[] = [
    { id: 'c1', provider: 'airbnb', status: 'active', externalAccountId: '4455', createdAt: '2026-09-01T10:00:00Z', host: { displayName: 'Camille' } },
  ];

  private refus402(): Response {
    const actives = R.listings.filter((l) => l.status === 'active').length;
    return json(
      { error: { code: 'listings_limit_exceeded', message: 'over cap', fix: 'Reduce your active listings.', tier: 'free', limit: this.limiteActives, active_listings: actives } },
      402,
    );
  }

  compter(prefixe: string) {
    return this.appels.filter((a) => a.chemin.startsWith(prefixe)).length;
  }

  private paginer<T>(liste: T[], p: URLSearchParams): Response {
    const debut = Number(p.get('cursor') ?? '0');
    const tranche = liste.slice(debut, debut + this.page);
    const suite = debut + this.page < liste.length;
    return json({ data: tranche, pagination: { nextCursor: suite ? String(debut + this.page) : null, hasMore: suite, total: liste.length } });
  }

  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    if (url.hostname === 'www.airbnb.fr') {
      this.lecturesAirbnb.push({ url: url.href, entetes: new Headers(init?.headers) });
      const html = this.pagesAirbnb.get(/^\/rooms\/(\d+)$/.exec(url.pathname)?.[1] ?? '');
      return html ? new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }) : new Response('Accès refusé', { status: 403 });
    }
    const auth = new Headers(init?.headers).get('authorization');
    if (auth !== 'Bearer sk_test_verif') return json({ error: { code: 'unauthorized', message: 'bad key' } }, 401);
    const chemin = url.pathname;
    const p = url.searchParams;
    const methode = (init?.method ?? 'GET').toUpperCase();
    const corps = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    const cle = new Headers(init?.headers).get('idempotency-key');
    this.appels.push({ chemin, params: p, methode, corps, cle });
    let m: RegExpExecArray | null;
    if (this.bloque402 && methode !== 'DELETE' && !chemin.startsWith('/v1/usage/')) return this.refus402();
    if ((m = /^\/v1\/channels\/booking\/properties\/(\d+)\/rooms$/.exec(chemin))) {
      return json({ hotelId: '9990' + m[1], listingId: m[1], source: 'booking', rooms: [{ roomId: 'R' + m[1], roomName: 'Chambre', rates: [{ rateId: 'P1' }] }] });
    }
    if (chemin === '/v1/channels/booking/availability' && methode === 'PUT') {
      return json({ ok: true });
    }
    if (chemin === '/v1/connect/providers') {
      return json({
        data: [
          { id: 'airbnb', displayName: 'Airbnb', category: 'ota', connectPattern: 'oauth', status: 'live', logoUrl: 'https://x/a.png', docsUrl: 'https://x' },
          { id: 'booking', displayName: 'Booking.com', category: 'ota', connectPattern: 'claim', status: 'live', logoUrl: 'https://x/b.png', docsUrl: 'https://x' },
          { id: 'vrbo', displayName: 'Vrbo', category: 'ota', connectPattern: 'credentials', status: 'live', logoUrl: 'https://x/v.png', docsUrl: 'https://x' },
          { id: 'hostaway', displayName: 'Hostaway', category: 'pms', connectPattern: 'credentials', status: 'live', logoUrl: 'https://x/h.png', docsUrl: 'https://x' },
        ],
      });
    }
    if (chemin === '/v1/connect' && methode === 'GET') return this.paginer(this.connexions, p);
    if (chemin === '/v1/connect' && methode === 'POST') {
      return json({ sessionId: 'sess_p', url: 'https://connect.repull.dev/sess_p', expiresAt: '2026-10-01T00:00:00Z' }, 201);
    }
    if ((m = /^\/v1\/connect\/([^/]+)$/.exec(chemin)) && methode === 'POST') {
      return json({ sessionId: `sess_${m[1]}`, url: `https://connect.repull.dev/${m[1]}/sess`, expiresAt: '2026-10-01T00:00:00Z' });
    }
    if ((m = /^\/v1\/connect\/([^/]+)$/.exec(chemin)) && methode === 'DELETE') {
      if (m[1] !== 'airbnb' && m[1] !== 'booking') return json({ error: { code: 'not_implemented', message: 'no', fix: 'Disconnect Repull from your Hostaway settings.' } }, 501);
      const liees = R.listings.filter((l) => (l.channels as { platform: string }[]).some((c) => c.platform === m![1]) && l.status === 'active').map((l) => String(l.id));
      for (const l of R.listings) if (liees.includes(String(l.id))) l.status = 'inactive';
      this.connexions = this.connexions.filter((c) => c.provider !== m![1]);
      return json({ disconnected: true, provider: m[1], accountId: p.get('accountId'), listingsDeactivated: liees });
    }
    if (chemin === '/v1/listings/status' && methode === 'POST') {
      const ids = (corps?.listingIds as string[]) ?? [];
      const actif = corps?.active === true;
      const inconnus = ids.filter((id) => !R.listings.some((l) => l.id === id));
      if (inconnus.length) return json({ error: { code: 'not_found', message: inconnus.join(',') } }, 404);
      if (actif) {
        const apres = new Set(R.listings.filter((l) => l.status === 'active').map((l) => String(l.id)));
        ids.forEach((id) => apres.add(id));
        if (apres.size > this.limiteActives) return this.refus402();
      }
      const updated: string[] = [];
      for (const l of R.listings) {
        if (!ids.includes(String(l.id))) continue;
        const cible = actif ? 'active' : 'inactive';
        if (l.status !== cible) updated.push(String(l.id));
        l.status = cible;
      }
      return json({ active: actif, updated, unchanged: ids.filter((id) => !updated.includes(id)) });
    }
    if (chemin === '/v1/listings') {
      // Les lectures étendues n'arrivent que demandées (?include=…), comme l'API.
      const inclus = new Set((p.get('include') ?? '').split(','));
      if (this.refusInclusEtendus && inclus.has('photos')) return json({ error: { code: 'invalid_include', message: 'bad include', valid_values: ['content', 'details', 'thumbnail'] } }, 422);
      const etendus = ['photos', 'rooms', 'policies', 'rules', 'pricing', 'fees'];
      return this.paginer(
        R.listings.map((l) => Object.fromEntries(Object.entries(l).filter(([k]) => !etendus.includes(k) || inclus.has(k)))),
        p,
      );
    }
    if (chemin === '/v1/channels/booking/properties' && methode === 'GET' && this.ficheRepullVide) {
      return json([{ hotelId: '5566771', mappingStatus: 'mapped', active: true, listings: [{ listingId: '101', roomBookingId: '556677101', status: 'active' }] }]);
    }
    if (this.bookingInactif && (chemin === '/v1/channels/booking/content' || /^\/v1\/channels\/booking\/listings\/[^/]+\/pricing$/.test(chemin)) && methode === 'GET') {
      return json({ error: { code: 'listing_inactive', message: 'Listing is inactive', fix: 'Activate the listing.' } }, 403);
    }
    if (chemin === '/v1/channels/booking/content' && methode === 'GET') {
      if (p.get('property_id') !== '5566771' || p.get('type') !== 'photos') return json({ error: { code: 'not_found' } }, 404);
      // Galerie de la chambre vide : celle de l'établissement sert.
      if (p.get('room_id')) return json({ photos: [] });
      return json({
        photos: [
          { photo_id: 'p1', url_square60: 'https://cf.bstatic.com/xdata/images/hotel/square60/1.jpg', url_max1280: 'https://cf.bstatic.com/xdata/images/hotel/max1280/1.jpg' },
          { photo_id: 'p2', url_max1280: 'https://cf.bstatic.com/xdata/images/hotel/max1280/2.jpg' },
        ],
      });
    }
    if (chemin === '/v1/channels/booking/listings/101/pricing' && methode === 'GET') {
      return json({
        hotelId: '5566771',
        listingId: '101',
        room: [{ id: '556677101', date: [{ value: '2026-10-20', rate: [{ id: '1', price: '120' }, { id: '2', price: '108' }], roomstosell: '1' }, { value: '2026-10-21', rate: [{ id: '1', price: '130' }], roomstosell: '0' }] }],
      });
    }
    if (chemin === '/v1/listings/101/photos' && this.ficheRepullVide) return json({ listingId: '101', photos: [] });
    if (chemin === '/v1/availability/101' && this.ficheRepullVide) return json({ propertyId: '101', currency: 'EUR', days: [], coverage: { requestedDays: 61, coveredDays: 0, missingDates: [] } });
    if (chemin === '/v1/listings/101/photos') {
      return json({ listingId: '101', photos: [{ url: 'https://cdn.repull.dev/p/101-1.jpg' }, { url: 'https://cdn.repull.dev/p/101-2.jpg' }, { url: 'http://pas-sur/x.jpg' }, { url: 'javascript:alert(1)' }, { url: 'https://cdn.repull.dev/p/101-1.jpg' }] });
    }
    if (chemin === '/v1/availability/101') {
      return json({
        propertyId: '101',
        currency: 'EUR',
        days: [
          { date: '2026-09-26', available: true, price: 89, minNights: 2, availableUnits: 1 },
          { date: '2026-09-25', available: false, price: 95.5, minNights: 2, availableUnits: 0 },
          { date: 'demain', available: true, price: 80 },
          { date: '2026-09-27', available: true, price: -5 },
        ],
        coverage: { requestedDays: 61, coveredDays: 2, missingDates: [] },
      });
    }
    if ((m = /^\/v1\/listings\/([^/]+)$/.exec(chemin))) {
      const l = R.listings.find((x) => x.id === m![1]);
      return l ? json({ ...l, amenities: R.amenities }) : json({ error: { code: 'not_found' } }, 404);
    }
    if (chemin === '/v1/reservations') {
      const depuis = Date.parse(p.get('updated_since') ?? '1970-01-01T00:00:00Z');
      const inactives = new Set(R.listings.filter((l) => l.status === 'inactive').map((l) => String(l.id)));
      const liste = R.reservations
        .filter((r) => Date.parse(String(r.updatedAt)) >= depuis && !inactives.has(String(r.listingId)))
        .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)) || String(a.id).localeCompare(String(b.id)));
      return this.paginer(liste, p);
    }
    if ((m = /^\/v1\/reservations\/([^/]+)$/.exec(chemin))) {
      const r = R.reservations.find((x) => x.id === m![1]);
      return r ? json(r) : json({ error: { code: 'not_found' } }, 404);
    }
    if (chemin === '/v1/reviews') return this.paginer(R.reviews, p);
    if (chemin === '/v1/conversations') return this.paginer(R.conversations, p);
    if ((m = /^\/v1\/conversations\/([^/]+)\/messages$/.exec(chemin)) && methode === 'POST') {
      const charge = JSON.stringify(corps ?? {});
      const deja = cle ? this.idempotence.get(cle) : undefined;
      if (deja) return deja.charge === charge ? json(deja.reponse) : json({ error: { code: 'idempotency_key_reused', message: 'key reused' } }, 422);
      if (this.refusEnvoi) return json(this.refusEnvoi.corps, this.refusEnvoi.status);
      const id = String(900000 + this.envois.length);
      const texte = String(corps?.message ?? '');
      const conv = R.conversations.find((c) => c.id === m![1]);
      const reponse = { id, conversationId: Number(m[1]), externalMessageId: `ext-${id}`, channel: 'booking', status: 'sent', direction: 'outbound', contentRewritten: false, submittedContent: texte, deliveredContent: texte, statusReason: null, attachments: [] };
      this.envois.push({ conversation: m[1], message: texte, cle: cle ?? '' });
      if (cle) this.idempotence.set(cle, { charge, reponse });
      const quand = new Date(Date.parse(String(conv?.lastMessageAt ?? '2026-09-26T08:00:00.000Z')) + 60_000).toISOString();
      (R.messages[m[1]] ??= []).push({ id, direction: 'outbound', senderType: 'host', body: texte, attachments: [], aiGenerated: false, sentAt: quand });
      if (conv) Object.assign(conv, { lastMessageAt: quand, updatedAt: quand });
      return json(reponse);
    }
    if ((m = /^\/v1\/conversations\/([^/]+)\/messages$/.exec(chemin))) {
      const liste = [...(R.messages[m[1]] ?? [])].sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
      return this.paginer(p.get('order') === 'asc' ? liste.reverse() : liste, p);
    }
    if (chemin === '/v1/guests') return this.paginer(R.guests, p);
    if ((m = /^\/v1\/guests\/([^/]+)$/.exec(chemin))) return json(R.guests.find((g) => g.id === m![1]) ?? {});
    if (chemin === '/v1/usage/tier') {
      return json({ tier: 'free', limits: { monthlyRequests: 1000 }, used: { monthly: 57 }, remaining: { monthly: 943 }, resetsAt: '2026-10-01T00:00:00.000Z' });
    }
    return json({ error: { code: 'not_found', message: chemin } }, 404);
  };
}

function json(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });
}

/* ---------------------------------------------------- fausse API PostgREST */

class FausseBase {
  lignes = new Map<string, { collection: string; id: string; donnees: unknown; maj_par?: string }>();
  ecritures: { collection: string; id: string }[] = [];
  jetons = 0;

  cle = (c: string, id: string) => `${c}\u0000${id}`;

  /** Postgres (jsonb) ne garde pas l'ordre des clés : on le mélange pour être réaliste. */
  private melanger(v: unknown): unknown {
    if (Array.isArray(v)) return v.map((x) => this.melanger(x));
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v as object)
          .sort((a, b) => a.length - b.length || a.localeCompare(b))
          .map((k) => [k, this.melanger((v as Record<string, unknown>)[k])]),
      );
    }
    return v;
  }

  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    if (url.pathname === '/auth/v1/token') {
      this.jetons++;
      return json({ access_token: 'jeton-equipe', expires_in: 3600 });
    }
    const h = new Headers(init?.headers);
    if (h.get('authorization') !== 'Bearer jeton-equipe') return json({ message: 'JWT invalide' }, 401);
    if (url.pathname !== '/rest/v1/enregistrements') return json({ message: 'inconnu' }, 404);
    const methode = (init?.method ?? 'GET').toUpperCase();
    if (methode === 'GET') {
      if (h.get('accept-profile') !== 'erp') return json({ code: 'PGRST106' }, 406);
      const collection = (url.searchParams.get('collection') ?? '').replace(/^eq\./, '');
      const filtreIds = url.searchParams.get('id');
      const ids = filtreIds ? new Set(filtreIds.replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''))) : null;
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 1000);
      const res = [...this.lignes.values()]
        .filter((l) => l.collection === collection && (!ids || ids.has(l.id)))
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(offset, offset + limit)
        .map((l) => ({ id: l.id, donnees: JSON.parse(JSON.stringify(l.donnees)) }));
      return json(res);
    }
    if (methode === 'POST') {
      if (h.get('content-profile') !== 'erp' || !/merge-duplicates/.test(h.get('prefer') ?? '')) return json({ message: 'en-têtes' }, 400);
      if (url.searchParams.get('on_conflict') !== 'collection,id') return json({ message: 'on_conflict' }, 400);
      const lignes = JSON.parse(String(init?.body)) as { collection: string; id: string; donnees: unknown; maj_par?: string }[];
      for (const l of lignes) {
        this.lignes.set(this.cle(l.collection, l.id), { ...l, donnees: this.melanger(l.donnees) });
        this.ecritures.push({ collection: l.collection, id: l.id });
      }
      return new Response(null, { status: 201 });
    }
    return json({ message: 'méthode' }, 405);
  };

  collection<T>(c: string): T[] {
    return [...this.lignes.values()].filter((l) => l.collection === c).map((l) => l.donnees as T);
  }
  get<T>(c: string, id: string): T | undefined {
    return this.lignes.get(this.cle(c, id))?.donnees as T | undefined;
  }
  poser<T extends { id: string }>(c: string, e: T) {
    this.lignes.set(this.cle(c, e.id), { collection: c, id: e.id, donnees: this.melanger(JSON.parse(JSON.stringify(e))) });
  }
  ecrituresDonnees() {
    return this.ecritures.filter((e) => e.collection !== 'journal' && e.collection !== COLLECTION_ETAT);
  }
}

/* ------------------------------------------------- page publique Airbnb */

const b64Airbnb = (id: string) => btoa(`StaySupplyListing:${id}`);
const imageAirbnb = (cle: string, fichier: string, q = '') => `https://a0.muscache.com/im/pictures/hosting/Hosting-${cle}/original/${fichier}${q}`;

/** Page d'annonce Airbnb réduite : photos du logement (clé en base64 et ancienne clé en clair), images d'Airbnb et d'autres logements, résumé, couchage. */
function pageAirbnbFactice(id: string, n = 3): string {
  const photos = Array.from({ length: n }, (_, i) => imageAirbnb(b64Airbnb(id), `photo-${i + 1}.jpeg`));
  return [
    '<!doctype html><html><head>',
    '<meta property="og:title" content="Appartement · Corbeil-Essonnes · ★4,8 · 2 chambres · 3 lits · 1\u00a0salle de bain"/>',
    `<meta property="og:image" content="${imageAirbnb(b64Airbnb(id), 'photo-1.jpeg', '?im_w=720&amp;width=720')}"/>`,
    '</head><body>',
    '<img src="https://a0.muscache.com/im/pictures/AirbnbPlatformAssets/AirbnbPlatformAssets-Favicons/original/icone.png?im_w=240">',
    '<img src="https://a0.muscache.com/im/pictures/user/User-42/original/profil.jpeg">',
    `<img src="${imageAirbnb(b64Airbnb('999'), 'autre-logement.jpeg')}">`,
    `<img src="https://a0.muscache.com/im/pictures/hosting/Hosting-${id}9/original/voisin.jpeg">`,
    `<script>{"personCapacity":4,${photos.map((u) => `"uri":"${u}"`).join(',')},"uri":"https://a0.muscache.com/im/pictures/miso/Hosting-${id}/original/ancienne.jpg",`,
    '"sleepingArrangements":{"__typename":"MediaTour","stops":[{"__typename":"MediaTourStop","id":"a","name":"Chambre 1","items":[],"description":{"descriptions":[{"__typename":"LocalizedText","text":"1 lit double"}]}},{"__typename":"MediaTourStop","id":"b","name":"Chambre 2","items":[],"description":{"descriptions":[{"__typename":"LocalizedText","text":"2 lits simples"}]}}],"name":"Où vous dormirez"},',
    '"overview":{"__typename":"StaysPdpOverview","title":"Appartement","items":["4 voyageurs","2 chambres","3 lits","1\u00a0salle de bain"]}}</script>',
    '</body></html>',
  ].join('\n');
}

/* ----------------------------------------------------------- contrôles de forme */

const estChaine = (v: unknown) => typeof v === 'string';
/** Date 'YYYY-MM-DD' à Paris (comme l'ERP). */
const dateParisVerif = (d: Date) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const estEntier = (v: unknown) => typeof v === 'number' && Number.isInteger(v);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function verifierLogement(l: Logement) {
  const ctx = `logement ${l.id}`;
  verifier(estChaine(l.nom) && l.nom.length > 0, `${ctx} : nom`);
  for (const k of ['adresse', 'ville', 'codePostal', 'proprietaireId'] as const) verifier(estChaine(l[k]), `${ctx} : ${k}`);
  verifier(['studio', 'T1', 'T2', 'T3', 'T4', 'maison', 'autre'].includes(l.type), `${ctx} : type`);
  verifier(['lancement', 'actif', 'pause', 'sorti'].includes(l.statut), `${ctx} : statut`);
  verifier(['connectee', 'boite_a_cles', 'cles'].includes(l.serrure), `${ctx} : serrure`);
  for (const k of ['surfaceM2', 'capacite', 'chambres'] as const) verifier(estEntier(l[k]), `${ctx} : ${k} entier`);
  verifier(typeof l.residencePrincipale === 'boolean', `${ctx} : residencePrincipale`);
  verifier(Array.isArray(l.lits) && Array.isArray(l.dotationLinge) && Array.isArray(l.annonces), `${ctx} : tableaux`);
  verifier(l.checklistLancement.length === 9 && l.checklistLancement.every((c) => estChaine(c.cle) && typeof c.fait === 'boolean'), `${ctx} : checklist`);
  const f = l.fiche;
  verifier(
    f && ['wifiNom', 'wifiCode', 'heureArrivee', 'heureDepart', 'acces', 'parking', 'regles'].every((k) => estChaine((f as unknown as Record<string, unknown>)[k])) && Array.isArray(f.equipements),
    `${ctx} : fiche complète`,
  );
  verifier(/^\d{2}:\d{2}$/.test(f.heureArrivee) && /^\d{2}:\d{2}$/.test(f.heureDepart), `${ctx} : horaires HH:MM`);
  verifier(l.annonces.every((a) => ['airbnb', 'booking', 'direct'].includes(a.canal) && typeof a.connecte === 'boolean'), `${ctx} : annonces`);
  verifier(!!l.repull?.id, `${ctx} : marqué « importé de Repull »`);
}

function verifierReservation(r: Reservation) {
  const ctx = `réservation ${r.id}`;
  verifier(estChaine(r.logementId) && r.logementId.length > 0, `${ctx} : logementId`);
  verifier(['airbnb', 'booking', 'direct', 'autre'].includes(r.canal), `${ctx} : canal`);
  verifier(DATE.test(r.arrivee) && DATE.test(r.depart), `${ctx} : dates`);
  verifier(estEntier(r.nuits) && r.nuits > 0, `${ctx} : nuits`);
  verifier(['confirmee', 'annulee', 'en_cours', 'terminee'].includes(r.statut), `${ctx} : statut`);
  verifier(
    estEntier(r.montantBrutCentimes) && estEntier(r.commissionPlateformeCentimes) && estEntier(r.fraisMenageCentimes),
    `${ctx} : montants en centimes entiers`,
  );
  verifier(estChaine(r.voyageur?.nom) && estEntier(r.voyageur?.nbPersonnes), `${ctx} : voyageur`);
  verifier(!!r.repull?.id, `${ctx} : marqué « importé de Repull »`);
}

function verifierFil(f: FilMessages) {
  const ctx = `fil ${f.id}`;
  verifier(['ouvert', 'escalade', 'clos'].includes(f.statut), `${ctx} : statut`);
  verifier(['agent', 'humain', 'en_attente'].includes(f.traitePar), `${ctx} : traitePar`);
  verifier(f.messages.every((m) => ['voyageur', 'hote', 'agent'].includes(m.auteur) && estChaine(m.texte) && !!Date.parse(m.envoyeLe)), `${ctx} : messages`);
  const t = f.messages.map((m) => Date.parse(m.envoyeLe));
  verifier(t.every((x, i) => i === 0 || t[i - 1] <= x), `${ctx} : messages dans l'ordre chronologique`);
  verifier(Date.parse(f.dernierMessageLe) === t[t.length - 1], `${ctx} : dernierMessageLe = dernier message`);
}

/* ------------------------------------------------------------------ scénario */

async function principal() {
  const repull = new FauxRepull();
  const base = new FausseBase();
  const baseErp = () =>
    new BaseErp({
      url: 'https://base.test',
      cleAnon: 'anon',
      fetch: base.fetch as typeof fetch,
      jeton: async () => {
        const r = await base.fetch('https://base.test/auth/v1/token?grant_type=password', { method: 'POST' });
        return ((await r.json()) as { access_token: string }).access_token;
      },
    });
  let horloge = new Date('2026-09-25T08:00:00.000Z');
  const options = (declencheur: 'cron' | 'manuel', extra: Partial<Parameters<typeof lancer>[0]> = {}) => ({
    cle: 'sk_test_verif',
    base: baseErp(),
    declencheur,
    echeance: Date.now() + 50_000,
    fetch: repull.fetch as typeof fetch,
    maintenant: () => horloge,
    attendre: async () => undefined,
    lireQuota: declencheur === 'manuel',
    ...extra,
  });
  const avancer = (min: number) => (horloge = new Date(horloge.getTime() + min * 60_000));

  /* --------------------------------------------------------- outils purs */
  section('Conversions');
  verifier(heure('4 PM') === '16:00' && heure('15h30') === '15:30' && heure('flexible') === undefined, 'heures normalisées');
  verifier(noteSur5(9) === 4.5 && noteSur5(4.8) === 4.8, 'note Booking.com ramenée sur 5');
  const m = montantsReservation(R.reservations[0] as never);
  verifier(m?.brut === 58866 && m.commissionPlateforme === 2194 && m.menage === 6000, `montants 5001 (${JSON.stringify(m)})`);
  verifier(canonique({ b: 1, a: { d: undefined, c: [2, 1] } }) === '{"a":{"c":[2,1]},"b":1}', 'sérialisation canonique');
  {
    const p1 = photosDepuisContenu({ photos: [{ id: 1, url_square60: 'https://cf.bstatic.com/x/square60/1.jpg', url_max1280: 'https://cf.bstatic.com/x/max1280/1.jpg' }, { url: 'https://cdn.x.fr/2.webp' }, { url: 'http://pas-sur/3.jpg' }, { lien: 'https://www.booking.com/hotel/fr/x.html' }] });
    verifier(JSON.stringify(p1) === '["https://cf.bstatic.com/x/max1280/1.jpg","https://cdn.x.fr/2.webp"]', `photos Booking : la grande taille, https, pas de page web (${JSON.stringify(p1)})`);
    const p2 = photosDepuisContenu({ data: { images: ['https://a.muscache.com/im/1.jpg', 'https://a.muscache.com/im/1.jpg', 'javascript:alert(1)'] } });
    verifier(JSON.stringify(p2) === '["https://a.muscache.com/im/1.jpg"]', `photos en liste de chaînes, sans doublon (${JSON.stringify(p2)})`);
    verifier(photosDepuisContenu(null).length === 0 && photosDepuisContenu({ error: 'x' }).length === 0, 'photos : réponse vide ou illisible → aucune');
    const t = tarifsDepuisBooking(
      {
        hotelId: '1',
        room: [
          {
            id: 'r1',
            date: [
              { value: '2026-10-20', rate: [{ id: 'a', price: '120.00', price1: '100' }, { id: 'b', price: 108 }, { id: 'c', price: '90', closed: '1' }], roomstosell: '1' },
              { value: '2026-10-21', rate: [{ id: 'a', price1: '95' }], roomstosell: 0 },
              { value: '2026-10-22', rate: [{ id: 'a', price: '3' }] },
              { value: '2020-01-01', rate: [{ id: 'a', price: '50' }] },
            ],
          },
        ],
      },
      '2026-10-19T06:00:00+02:00',
      '2026-10-19',
      '2026-12-18',
    );
    verifier(
      canonique(t?.jours) === canonique([{ date: '2026-10-20', prixCentimes: 10800, libre: true }, { date: '2026-10-21', prixCentimes: 9500, libre: false }]) && t?.devise === 'EUR',
      `tarifs Booking : tarif ouvert le moins cher, plus de chambre à vendre = pris, prix aberrants et hors période écartés (${JSON.stringify(t?.jours)})`,
    );
    verifier(tarifsDepuisBooking({ hotelId: '1' }, '2026-10-19T06:00:00+02:00', '2026-10-19', '2026-12-18') === undefined, 'tarifs Booking : rien de daté → aucun prix');
  }

  section('Page publique Airbnb : lecture');
  {
    const html = pageAirbnbFactice('111');
    const photos = photosPageAirbnb(html, '111');
    verifier(
      JSON.stringify(photos) ===
        JSON.stringify([
          `${imageAirbnb(b64Airbnb('111'), 'photo-1.jpeg')}?im_w=1200`,
          `${imageAirbnb(b64Airbnb('111'), 'photo-2.jpeg')}?im_w=1200`,
          `${imageAirbnb(b64Airbnb('111'), 'photo-3.jpeg')}?im_w=1200`,
          'https://a0.muscache.com/im/pictures/miso/Hosting-111/original/ancienne.jpg?im_w=1200',
        ]),
      `photos du seul logement (clé en base64 et en clair), ordre de la page, sans doublon (${JSON.stringify(photos)})`,
    );
    verifier(!photos.some((u) => /AirbnbPlatformAssets|User-42|autre-logement|voisin/.test(u)), 'icônes d’Airbnb, profils et autres logements écartés');
    verifier(photosPageAirbnb(pageAirbnbFactice('111', 30), '111').length === 24, 'photos plafonnées à 24');
    verifier(photosPageAirbnb(html, '11').length === 0 && photosPageAirbnb(html, 'abc').length === 0, 'id voisin ou invalide : aucune photo');
    const f = faitsPageAirbnb(html);
    verifier(
      f.voyageurs === 4 && f.chambres === 2 && f.lits === 3 && f.sallesDeBain === 1 && f.titre?.startsWith('Appartement') &&
        canonique(f.couchage) === canonique([{ piece: 'Chambre 1', lits: '1 lit double' }, { piece: 'Chambre 2', lits: '2 lits simples' }]),
      `faits lus : voyageurs, chambres, lits, salle de bain, couchage (${JSON.stringify(f)})`,
    );
    verifier(
      idAirbnbDuLogement({ repull: { canaux: [{ plateforme: 'booking', idExterne: '55' }, { plateforme: 'airbnb', idExterne: '123' }] } }) === '123' &&
        idAirbnbDuLogement({ annonces: [{ canal: 'airbnb', url: 'https://www.airbnb.fr/rooms/456?x=1' }] }) === '456' &&
        idAirbnbDuLogement({ annonces: [{ canal: 'booking', url: 'https://www.booking.com/hotel/fr/x.html' }] }) === undefined,
      'id Airbnb : canal relié, sinon adresse de l’annonce',
    );
    const vues: { url: string; init?: RequestInit }[] = [];
    const ok = await lirePageAirbnb('111', (async (u: string, init?: RequestInit) => {
      vues.push({ url: u, init });
      return new Response(html, { status: 200 });
    }) as typeof fetch);
    const h = new Headers(vues[0]?.init?.headers);
    verifier(
      ok.ok && vues[0]?.url === 'https://www.airbnb.fr/rooms/111' && vues[0].init?.method === 'GET' && /Mozilla/.test(h.get('user-agent') ?? '') && !h.get('cookie') && vues[0].init?.credentials === 'omit',
      'page lue en GET, comme un navigateur, sans cookie',
    );
    const refusee = await lirePageAirbnb('111', (async () => new Response('Non', { status: 403 })) as typeof fetch);
    verifier(!refusee.ok, 'page refusée (403) : pas de lecture');
    const lente = await lirePageAirbnb(
      '111',
      ((_: string, init?: RequestInit) => new Promise<Response>((_r, rejeter) => init?.signal?.addEventListener('abort', () => rejeter(new Error('abort'))))) as typeof fetch,
      { delaiMs: 30 },
    );
    verifier(!lente.ok && lente.raison === 'délai dépassé', 'page trop lente : abandon après le délai');
    let appelee = false;
    const invalide = await lirePageAirbnb('../x', (async () => {
      appelee = true;
      return new Response('');
    }) as typeof fetch);
    verifier(!invalide.ok && !appelee, 'id non numérique : aucune requête');
    const grosse = await lirePageAirbnb('111', (async () => new Response('x'.repeat(50_000), { status: 200 })) as typeof fetch, { maxOctets: 1_000 });
    verifier(grosse.ok && grosse.html.length === 1_000, 'taille de la page plafonnée');
  }

  /* ------------------------------------------------ sans choix de logements */
  section('Aucun logement choisi');
  const r0 = await lancer(options('manuel'));
  verifier(r0.statut === 'selection' && /Choisissez vos logements/.test(r0.message ?? ''), `rien n’est importé, message clair (${r0.message})`);
  verifier(repull.appels.length === 0 && base.ecrituresDonnees().length === 0, 'aucun appel Repull, aucune écriture');

  // Choix fait sur la page Connexions (repull/selection).
  base.poser(COLLECTION_ETAT, { id: ID_SELECTION, annonces: ['101', '102'], limite: 3, majLe: '2026-09-25T09:00:00+02:00', majPar: 'test' });

  /* --------------------------------------------------- premier passage */
  section('Premier passage (bouton)');
  const r1 = await lancer(options('manuel'));
  verifier(r1.ok && r1.statut === 'fait', `passage réussi (${r1.message ?? ''})`);
  const logements = base.collection<Logement>('logements');
  const reservations = base.collection<Reservation>('reservations');
  const fils = base.collection<FilMessages>('filsMessages');
  verifier(logements.length === 2, `2 logements importés (${logements.length})`);
  verifier(reservations.length === 2, `2 réservations importées, la demande en attente non (${reservations.length})`);
  verifier(fils.length === 1, 'une conversation importée');
  logements.forEach(verifierLogement);
  reservations.forEach(verifierReservation);
  fils.forEach(verifierFil);

  const l101 = base.get<Logement>('logements', 'repull-101')!;
  verifier(l101.type === 'studio' && l101.capacite === 2 && l101.surfaceM2 === 24, 'studio : type, capacité, surface');
  verifier(l101.fiche.heureArrivee === '16:00' && l101.fiche.wifiNom === 'Box-101' && l101.fiche.regles.startsWith('Pas de fête'), 'fiche : horaires, wifi, règles');
  verifier(l101.fiche.equipements.join('|') === 'Wifi|Air conditioning', `équipements présents seulement (${l101.fiche.equipements.join('|')})`);
  verifier(l101.annonces.length === 2 && l101.annonces[0].url === 'https://www.airbnb.fr/rooms/998877665544332211', 'annonces Airbnb (avec lien) et Booking');
  verifier(l101.statut === 'actif' && l101.proprietaireId === ID_PROPRIETAIRE_A_RENSEIGNER, 'actif, rattaché au propriétaire à renseigner');
  verifier(base.get<Logement>('logements', 'repull-102')?.type === 'maison', 'maison déduite du type Repull');
  verifier(
    JSON.stringify(l101.photos) === '["https://cdn.repull.dev/p/101-1.jpg","https://cdn.repull.dev/p/101-2.jpg"]' && !!l101.repull?.photosLuesLe,
    `photos lues : https seulement, sans doublon (${JSON.stringify(l101.photos)})`,
  );
  verifier(
    l101.tarifs?.devise === 'EUR' && canonique(l101.tarifs.jours) === canonique([{ date: '2026-09-25', prixCentimes: 9550, libre: false }, { date: '2026-09-26', prixCentimes: 8900, libre: true }]),
    `prix par nuit lus, triés, jours illisibles écartés (${JSON.stringify(l101.tarifs?.jours)})`,
  );
  const lecturesTarifs = repull.appels.filter((a) => a.chemin.startsWith('/v1/availability/') || a.chemin.endsWith('/photos'));
  verifier(lecturesTarifs.length > 0 && lecturesTarifs.every((a) => a.methode === 'GET'), 'photos et prix : lectures seules (GET)');
  verifier(lecturesTarifs.some((a) => a.chemin === '/v1/availability/101' && /^\d{4}-\d{2}-\d{2}$/.test(a.params.get('from') ?? '') && /^\d{4}-\d{2}-\d{2}$/.test(a.params.get('to') ?? '')), 'prix demandés sur une période datée');
  const l102 = base.get<Logement>('logements', 'repull-102')!;
  verifier(
    JSON.stringify(l102.photos) === '["https://cdn.repull.dev/p/102-a.jpg","https://cdn.repull.dev/p/102-b.jpg"]',
    `photos de l’annonce : ordre de la plateforme, https seulement (${JSON.stringify(l102.photos)})`,
  );
  verifier(!repull.appels.some((a) => a.chemin === '/v1/listings/102/photos'), 'photos déjà lues avec l’annonce : aucun appel de plus');
  verifier(
    l101.repull?.lecture?.photos === 'repull' && l101.repull.lecture.prix === 'repull' && !l101.repull.lecture.raisonPhotos && !l101.repull.lecture.raisonPrix,
    `note de lecture : photos déposées chez Repull, prix du calendrier Repull (${JSON.stringify(l101.repull?.lecture)})`,
  );
  verifier(
    l102.repull?.lecture?.photos === 'annonce' && l102.repull.lecture.prix === 'aucun' && l102.repull.lecture.raisonPrix === 'Calendrier : aucun prix enregistré',
    `note de lecture : photos de l’annonce, manque de prix expliqué (${JSON.stringify(l102.repull?.lecture)})`,
  );
  {
    const e = base.get<EtatRepull>(COLLECTION_ETAT, ID_ETAT)!;
    verifier(e.annoncesIncompletes === true, 'un logement choisi sans prix : relevé des annonces marqué incomplet');
    const releve = e.dernieresPhases?.annonces ?? '';
    const t15 = new Date(Date.parse(releve) + 15 * 60_000);
    verifier(
      !!releve &&
        phasesDues({ ...e, annoncesIncompletes: true }, 'manuel', t15).includes('annonces') &&
        !phasesDues({ ...e, annoncesIncompletes: false }, 'manuel', t15).includes('annonces') &&
        phasesDues({ ...e, annoncesIncompletes: undefined }, 'manuel', t15).includes('annonces') &&
        !phasesDues({ ...e, annoncesIncompletes: true }, 'cron', t15).includes('annonces'),
      'bouton : annonces relues tout de suite s’il manque une photo ou un prix (sinon après une heure) ; le cron garde son rythme',
    );
  }
  verifier(
    repull.appels.filter((a) => a.chemin === '/v1/listings').every((a) => (a.params.get('include') ?? '').split(',').includes('photos')),
    'annonces lues avec photos, couchage, conditions et prix en un appel par page',
  );
  const d102 = l102.descriptif;
  verifier(d102?.titre === 'Maison familiale avec jardin', `titre vu par les voyageurs (${d102?.titre})`);
  verifier(
    canonique(d102?.couchage) === canonique([
      { piece: 'Chambre 1', lits: '1 lit queen size' },
      { piece: 'Chambre 2', lits: '2 lits simples' },
      { piece: 'Salon', lits: '1 canapé-lit' },
    ]) && d102?.sallesDeBain === 1.5,
    `couchage pièce par pièce, salles de bain (${JSON.stringify(d102?.couchage)})`,
  );
  verifier(
    d102?.conditions?.animaux === false && d102.conditions.fetes === false && d102.conditions.enfants === true && d102.conditions.annulation === 'Modérée' && d102.conditions.arrivee === 'Boîte à clés' && d102.conditions.arriveeJusqua === '22:00' && d102.conditions.calme?.debut === '22:00',
    `conditions en clair (${JSON.stringify(d102?.conditions)})`,
  );
  verifier(
    d102?.sejour?.nuitsMin === 2 && d102.sejour.nuitsMax === 28 && d102.sejour.reservationInstantanee === true,
    `durée de séjour (${JSON.stringify(d102?.sejour)})`,
  );
  verifier(
    d102?.prix?.nuit === 12000 && d102.prix.weekend === 14000 && d102.prix.menage === 5000 && d102.prix.caution === 30000 && d102.prix.remiseSemainePct === 10 && d102.prix.voyageurSupplementaire === undefined,
    `prix de base en centimes (${JSON.stringify(d102?.prix)})`,
  );
  verifier(JSON.stringify(d102?.frais) === '["Animal : 15 € par séjour (en option)"]', `autres frais, ménage à part (${JSON.stringify(d102?.frais)})`);
  verifier(l102.fiche.acces === 'Boîte à clés sous la boîte aux lettres.', 'accès repris des conditions d’arrivée quand la fiche est vide');
  verifier(l102.fiche.aSavoir === 'Poubelles : local vélo, sortie le mardi soir.' && !base.get<Logement>('logements', 'repull-101')?.fiche.aSavoir, 'livret d’accueil de l’annonce repris dans « À savoir » quand il est vide');
  const t101 = base.get<Logement>('logements', 'repull-101')?.descriptif?.textes;
  verifier(
    t101?.resume === 'Studio lumineux au cœur de la ville.' && t101.description === 'Idéal pour un couple.\n\nCuisine équipée.' && t101.quartier?.startsWith('Commerces') && !('transports' in t101),
    `textes de l’annonce nettoyés, champs vides écartés (${JSON.stringify(t101)})`,
  );
  const prop = base.get<Proprietaire>('proprietaires', ID_PROPRIETAIRE_A_RENSEIGNER);
  verifier(prop?.nom === 'Propriétaire à renseigner' && prop.contact.email === '' && !prop.ibanMasque, 'fiche propriétaire d’attente, sans donnée inventée');

  const r5001 = base.get<Reservation>('reservations', 'repull-5001')!;
  verifier(r5001.logementId === 'repull-101' && r5001.canal === 'airbnb' && r5001.nuits === 3, '5001 : logement, canal, nuits');
  verifier(r5001.statut === 'confirmee' && r5001.voyageur.nbPersonnes === 3 && r5001.voyageur.nom === 'Alex Morgan', '5001 : statut, voyageurs');
  verifier(r5001.montantBrutCentimes === 58866 && r5001.fraisMenageCentimes === 6000, '5001 : montants');
  verifier(r5001.repull?.code === 'HMXYZ123' && r5001.repull.devise === 'EUR', '5001 : code et devise');
  const r5002 = base.get<Reservation>('reservations', 'repull-5002')!;
  verifier(r5002.statut === 'terminee' && r5002.canal === 'booking' && r5002.montantBrutCentimes === 90000, '5002 : terminée, Booking, total en repli');
  verifier(r5002.noteVoyageur === 4.5 && (r5002.commentaireVoyageur ?? '').includes('Message privé'), '5002 : avis appliqué (note sur 5, message privé)');
  verifier(r5002.voyageur.pays === 'FR' && r5001.voyageur.pays === 'US', 'pays des voyageurs lus dans leurs fiches');

  const fil = base.get<FilMessages>('filsMessages', 'repull-7001')!;
  verifier(fil.reservationId === 'repull-5001' && fil.logementId === 'repull-101' && fil.voyageur === 'Alex Morgan', 'fil relié à la réservation');
  verifier(fil.messages.map((x) => x.auteur).join(',') === 'voyageur,agent', 'auteurs : voyageur puis agent (réponse IA)');
  verifier(fil.traitePar === 'humain' && fil.statut === 'ouvert', 'dernier message de l’hôte : pas en attente');

  const journal = base.collection<Journal>('journal');
  verifier(journal.length === 1 && journal[0].action === 'Synchronisation Repull' && /Réservations : 2 créées/.test(journal[0].details), `journal : ${journal[0]?.details}`);
  const etat1 = base.get<EtatRepull>(COLLECTION_ETAT, ID_ETAT)!;
  verifier(etat1.appelsMois === repull.appels.length && etat1.appelsMois > 0, `appels comptés (${etat1.appelsMois} = ${repull.appels.length})`);
  verifier(etat1.quota?.utilise === 57 && etat1.quota.limite === 1000, 'quota réel relevé (bouton)');
  console.log(`  premier passage : ${etat1.appelsMois} appels Repull (pages de 2 simulées pour tester les curseurs)`);
  verifier(!repull.appels.some((a) => a.params.get('limit') && a.params.get('limit') !== '100'), 'pages de 100 demandées');

  /* ----------------------------------------------- limite du bouton */
  section('Limite du bouton (10 min)');
  const avant = repull.appels.length;
  avancer(3);
  const r2 = await lancer(options('manuel'));
  verifier(r2.statut === 'limite' && repull.appels.length === avant, 'second clic à 3 min : refusé, aucun appel, bilan précédent renvoyé');
  verifier(!!r2.bilan && /prochaine est possible/.test(r2.message ?? ''), 'message clair');

  /* ------------------------------------------ travail de l'équipe */
  section('Saisies de l’équipe, puis passage sans changement');
  base.poser('logements', {
    ...l101,
    proprietaireId: 'prop-dupont',
    serrure: 'connectee',
    numeroEnregistrement: '91228000123AB',
    residencePrincipale: true,
    photoUrl: 'stockage://erp-fichiers/logements/101.jpg',
    checklistLancement: l101.checklistLancement.map((c) => (c.cle === 'mandat_signe' ? { ...c, fait: true, preuve: 'mandat.pdf' } : c)),
    fiche: { ...l101.fiche, parking: 'Place 12', acces: 'Code 1234 au portail' },
    statut: 'lancement',
  });
  base.poser('reservations', { ...r5001, commentaireVoyageur: 'Client fidèle, arrivée tardive prévue.', voyageur: { ...r5001.voyageur, pays: 'Canada' } });
  base.poser('filsMessages', { ...fil, statut: 'clos', raisonEscalade: 'hors_fiche' });
  const figes = {
    l: base.get<Logement>('logements', 'repull-101'),
    r: base.get<Reservation>('reservations', 'repull-5001'),
    f: base.get<FilMessages>('filsMessages', 'repull-7001'),
  };
  base.ecritures = [];
  avancer(60 * 24); // le lendemain : toutes les phases quotidiennes repassent
  const appelsAvant = repull.appels.length;
  const r3 = await lancer(options('cron'));
  verifier(r3.ok, `passage du cron réussi (${r3.message ?? ''})`);
  verifier(base.ecrituresDonnees().length === 0, `rien n’a changé chez Repull : aucune écriture de données (${JSON.stringify(base.ecrituresDonnees())})`);
  verifier(canonique(base.get('logements', 'repull-101')) === canonique(figes.l), 'logement : saisies de l’équipe intactes');
  verifier(
    base.get<Logement>('logements', 'repull-101')?.repull?.lecture?.le === (figes.l as Logement).repull?.lecture?.le,
    'note de lecture identique : sa date d’origine reste, rien n’est réécrit',
  );
  verifier(canonique(base.get('reservations', 'repull-5001')) === canonique(figes.r), 'réservation : saisies de l’équipe intactes');
  verifier(canonique(base.get('filsMessages', 'repull-7001')) === canonique(figes.f), 'fil : statut et escalade intacts');
  const appelsResa = repull.appels.slice(appelsAvant).filter((a) => a.chemin === '/v1/reservations');
  verifier(
    appelsResa.length > 0 && appelsResa.every((a) => a.params.get('updated_since') === '2000-01-01T00:00:00Z'),
    `premier cron : passage complet hebdomadaire, toutes les réservations relues (${appelsResa.map((a) => a.params.get('updated_since')).join(',')})`,
  );
  verifier(repull.appels.slice(appelsAvant).every((a) => !/\/messages$/.test(a.chemin)), 'conversation inchangée : messages non relus');
  verifier(repull.appels.slice(appelsAvant).every((a) => a.chemin !== '/v1/reviews'), 'avis : pas relus avant une semaine (cron)');
  verifier(repull.appels.slice(appelsAvant).every((a) => a.chemin !== '/v1/usage/tier'), 'quota réel : bouton seulement');

  /* ------------------------------------------------- changements Repull */
  section('Conversation transmise, répondue sur la plateforme');
  {
    const transmise = {
      id: 'repull-9001',
      logementId: 'repull-101',
      canal: 'airbnb',
      voyageur: 'Alex',
      statut: 'escalade',
      traitePar: 'en_attente',
      raisonEscalade: 'litige',
      messages: [
        { id: 'repull-v1', auteur: 'voyageur', texte: 'La douche ne marche plus.', envoyeLe: '2026-09-20T10:00:00+02:00' },
        { id: 'envoi-abc', auteur: 'agent', texte: 'Merci, l’équipe revient vers vous rapidement.', envoyeLe: '2026-09-20T10:01:00+02:00', envoi: { canal: 'airbnb', par: 'Agent IA' } },
      ],
      dernierMessageLe: '2026-09-20T10:01:00+02:00',
    } as unknown as FilMessages;
    const conv = { id: '9001', createdAt: '2026-09-20T08:00:00.000Z', lastMessageAt: '2026-09-20T09:30:00.000Z' } as unknown as RepullConversation;
    const ctx = { id: 'repull-9001', logementId: 'repull-101', canal: 'airbnb' as const };
    const bruts = (x: { id: string; direction: string; body: string; sentAt: string }[]) => [
      { id: 'v1', direction: 'inbound', senderName: 'Alex', body: 'La douche ne marche plus.', sentAt: '2026-09-20T08:00:00.000Z' },
      ...x,
    ];
    const repondue = versFil(conv, bruts([{ id: 'h2', direction: 'outbound', body: 'Un plombier passe à 14 h.', sentAt: '2026-09-20T09:30:00.000Z' }]), transmise, ctx);
    verifier(repondue.statut === 'ouvert' && repondue.traitePar === 'humain' && !attendEquipe(repondue), 'réponse de l’équipe sur Airbnb : conversation répondue, plus « en attente de l’équipe »');
    const retour = versFil(conv, bruts([{ id: 'a2', direction: 'outbound', body: 'Merci, l’équipe revient vers vous rapidement.', sentAt: '2026-09-20T08:01:00.000Z' }]), transmise, ctx);
    verifier(retour.statut === 'escalade' && attendEquipe(retour), 'retour du message d’attente parti de l’ERP : toujours transmise');
    const relance = versFil(conv, bruts([{ id: 'v3', direction: 'inbound', body: 'Toujours rien ?', sentAt: '2026-09-20T09:30:00.000Z' }]), transmise, ctx);
    verifier(relance.statut === 'escalade' && attendEquipe(relance), 'nouveau message du voyageur : toujours transmise');
  }

  section('Changements chez Repull');
  Object.assign(R.reservations[0], { status: 'cancelled', statusDetail: 'cancelled_by_guest', updatedAt: '2026-09-26T07:00:00.000Z' });
  R.messages['7001'].push({ id: 'm3', direction: 'inbound', senderName: 'Alex', body: 'Finalement nous annulons, désolé.', attachments: [], sentAt: '2026-09-26T07:01:00.000Z' });
  Object.assign(R.conversations[0], { lastMessageAt: '2026-09-26T07:01:00.000Z', updatedAt: '2026-09-26T07:01:00.000Z' });
  Object.assign(R.listings[1], { status: 'archived', updatedAt: '2026-09-26T07:00:00.000Z' });
  avancer(60 * 24);
  const avant4 = repull.appels.length;
  const r4 = await lancer(options('cron'));
  verifier(r4.ok, 'passage réussi');
  const r5001b = base.get<Reservation>('reservations', 'repull-5001')!;
  verifier(r5001b.statut === 'annulee' && r5001b.repull?.statutDetail === 'cancelled_by_guest', 'annulation : réservation « annulee », jamais supprimée');
  verifier(r5001b.commentaireVoyageur?.startsWith('Client fidèle') && r5001b.voyageur.pays === 'Canada', 'annulation : saisies de l’équipe intactes');
  const filb = base.get<FilMessages>('filsMessages', 'repull-7001')!;
  verifier(filb.messages.length === 3 && filb.messages[2].auteur === 'voyageur', 'nouveau message ajouté à la fin');
  verifier(filb.statut === 'ouvert' && filb.traitePar === 'en_attente' && filb.raisonEscalade === 'hors_fiche', 'fil clos rouvert, en attente de réponse');
  verifier(repull.appels.slice(avant4).filter((a) => /\/messages$/.test(a.chemin)).length === 1, 'messages relus pour la seule conversation modifiée');
  const resa4 = repull.appels.slice(avant4).filter((a) => a.chemin === '/v1/reservations');
  verifier(
    resa4.length === 1 && resa4[0].params.get('updated_since') === '2026-09-10T08:00:00.000Z',
    `cron suivant : incrémental, updated_since = dernière modification connue (${resa4.map((a) => a.params.get('updated_since')).join(',')})`,
  );
  verifier(repull.appels.length - avant4 <= 6, `passage quotidien économe : ${repull.appels.length - avant4} appels`);
  console.log(`  passage quotidien avec changements : ${repull.appels.length - avant4} appels Repull`);
  verifier(base.get<Logement>('logements', 'repull-102')?.statut === 'sorti', 'annonce archivée : logement « sorti », jamais supprimé');
  verifier(base.get<Logement>('logements', 'repull-101')?.statut === 'lancement', 'annonce inchangée : statut choisi par l’équipe conservé');
  verifier(base.collection('logements').length === 2 && base.collection('reservations').length === 2, 'rien de supprimé');

  section('Annonce Booking.com sans photo ni calendrier chez Repull');
  {
    repull.ficheRepullVide = true;
    // 101 tel qu'en production avant les lectures Booking.com : aucune photo de plateforme (seule
    // celle déposée par l'équipe), un « photosLuesLe » posé il y a une heure par l'ancienne
    // version, et pas encore de note de lecture. Il doit être relu tout de suite.
    const l = base.get<Logement>('logements', 'repull-101')!;
    const { lecture: _ancienne, ...origine } = l.repull!;
    base.poser('logements', { ...l, photos: undefined, repull: { ...origine, photosLuesLe: new Date(horloge.getTime() + 61 * 60_000 - 3_600_000).toISOString() } });
    const avant = repull.appels.length;
    avancer(61); // bouton : annonces relues si le dernier relevé a plus d'une heure
    const r = await lancer(options('manuel'));
    repull.ficheRepullVide = false;
    const appels = repull.appels.slice(avant);
    const l101 = base.get<Logement>('logements', 'repull-101')!;
    verifier(r.ok && r.statut === 'fait', `passage réussi (${r.message ?? ''})`);
    verifier(
      JSON.stringify(l101.photos) === '["https://cf.bstatic.com/xdata/images/hotel/max1280/1.jpg","https://cf.bstatic.com/xdata/images/hotel/max1280/2.jpg"]',
      `photos lues chez Booking.com : chambre, puis établissement (${JSON.stringify(l101.photos)})`,
    );
    verifier(appels.some((a) => a.chemin === '/v1/listings/101/photos'), 'ancien marqueur « photos lues » récent mais sans note de lecture : photos relues tout de suite');
    const contenus = appels.filter((a) => a.chemin === '/v1/channels/booking/content');
    verifier(contenus.length === 2 && contenus[0].params.get('room_id') === '556677101' && !contenus[1].params.get('room_id'), 'galerie de la chambre demandée d’abord, puis celle de l’établissement');
    verifier(
      canonique(l101.tarifs?.jours) === canonique([{ date: '2026-10-20', prixCentimes: 10800, libre: true }, { date: '2026-10-21', prixCentimes: 13000, libre: false }]),
      `prix par nuit lus chez Booking.com quand le calendrier Repull est vide (${JSON.stringify(l101.tarifs?.jours)})`,
    );
    verifier(appels.filter((a) => a.chemin === '/v1/channels/booking/properties').length === 1, 'établissements Booking.com lus une seule fois par passage');
    verifier(
      l101.repull?.lecture?.photos === 'booking-etablissement' && l101.repull.lecture.prix === 'booking' && !l101.repull.lecture.raisonPhotos && !l101.repull.lecture.raisonPrix,
      `note de lecture : photos de l’établissement Booking.com, prix Booking.com (${JSON.stringify(l101.repull?.lecture)})`,
    );
    verifier(appels.every((a) => a.methode === 'GET' || /\/messages$/.test(a.chemin)), 'lectures Booking.com : GET seulement');
  }

  section('Photos et prix introuvables : raisons en clair');
  {
    const l = base.get<Logement>('logements', 'repull-101')!;
    repull.ficheRepullVide = true;
    repull.bookingInactif = true;
    // Plus de photo, et la dernière recherche de photos date d'hier ou avant (marqueur effacé).
    base.poser('logements', { ...l, photos: undefined, repull: { ...l.repull!, photosLuesLe: undefined } });
    avancer(61); // relevé précédent complet : le bouton relit les annonces après une heure
    const r = await lancer(options('manuel'));
    repull.ficheRepullVide = false;
    repull.bookingInactif = false;
    const n = base.get<Logement>('logements', 'repull-101')!.repull?.lecture;
    verifier(r.ok && r.statut === 'fait', `passage réussi (${r.message ?? ''})`);
    verifier(
      n?.photos === 'aucune' &&
        n.raisonPhotos === 'Booking.com : annonce inactive (hors de votre forfait) ; Airbnb : page indisponible',
      `photos manquantes : chaque plateforme dit pourquoi (${n?.raisonPhotos})`,
    );
    verifier(
      n?.prix === 'aucun' && n.raisonPrix === 'Calendrier : aucun prix enregistré ; Booking.com : annonce inactive (hors de votre forfait)',
      `prix manquants : raisons en clair (${n?.raisonPrix})`,
    );
    verifier(n?.le === dateParisVerif(horloge), 'note datée du jour où elle a changé');
    verifier(base.get<EtatRepull>(COLLECTION_ETAT, ID_ETAT)?.annoncesIncompletes === true, 'relevé toujours incomplet : le bouton relira les annonces');
    // Second clic 11 min plus tard : annonces relues (relevé incomplet), mais la recherche de
    // photos, vaine il y a 11 min, n'est refaite qu'une fois par jour (budget d'appels).
    repull.ficheRepullVide = true;
    repull.bookingInactif = true;
    avancer(11);
    const debut = repull.appels.length;
    const r2 = await lancer(options('manuel'));
    repull.ficheRepullVide = false;
    repull.bookingInactif = false;
    const appels2 = repull.appels.slice(debut);
    verifier(r2.statut === 'fait' && appels2.some((a) => a.chemin === '/v1/listings'), 'bouton : annonces relues sans attendre une heure (relevé incomplet)');
    verifier(
      !appels2.some((a) => a.chemin === '/v1/listings/101/photos' || a.chemin === '/v1/channels/booking/content' || a.chemin === '/v1/channels/airbnb/listings/101/photos'),
      `recherche de photos vaine : pas refaite avant le lendemain (${appels2.map((a) => a.chemin).join(', ')})`,
    );
    verifier(repull.lecturesAirbnb.length === 1, `page Airbnb indisponible : pas relue avant le lendemain (${repull.lecturesAirbnb.length} lecture)`);
    base.poser('logements', l);
  }

  section('Page publique Airbnb : logement choisi sans photo');
  {
    const l = base.get<Logement>('logements', 'repull-101')!;
    const idAirbnb = l.repull!.canaux!.find((c) => c.plateforme === 'airbnb')!.idExterne;
    repull.pagesAirbnb.set(idAirbnb, pageAirbnbFactice(idAirbnb));
    repull.ficheRepullVide = true;
    repull.bookingInactif = true;
    base.poser('logements', { ...l, photos: undefined, lits: [], repull: { ...l.repull!, photosLuesLe: undefined } });
    avancer(11);
    const r = await lancer(options('manuel'));
    const apres = base.get<Logement>('logements', 'repull-101')!;
    verifier(r.ok && r.statut === 'fait', `passage réussi (${r.message ?? ''})`);
    verifier(
      apres.photos?.length === 4 && apres.photos[0] === `${imageAirbnb(b64Airbnb(idAirbnb), 'photo-1.jpeg')}?im_w=1200` && apres.repull?.lecture?.photos === 'airbnb-page' && !apres.repull.lecture.raisonPhotos,
      `photos lues sur la page publique Airbnb en dernier recours (${apres.repull?.lecture?.photos}, ${apres.photos?.length})`,
    );
    verifier(
      l.capacite === 2 && apres.capacite === 2 && l.chambres === 0 && apres.chambres === 2,
      `capacité déjà connue : jamais remplacée par la page ; chambres à 0 : complétées (${apres.capacite}, ${apres.chambres})`,
    );
    verifier(canonique(apres.lits) === canonique([{ type: 'double', nombre: 1 }, { type: 'simple', nombre: 2 }]), `lits vides : remplis depuis « Où vous dormirez » (${JSON.stringify(apres.lits)})`);
    // Passage suivant : photos trouvées, page relue une fois par semaine seulement ; rien ne change.
    const lectures = repull.lecturesAirbnb.length;
    avancer(11);
    await lancer(options('manuel'));
    repull.ficheRepullVide = false;
    repull.bookingInactif = false;
    verifier(repull.lecturesAirbnb.length === lectures, 'page déjà lue avec succès : pas relue avant une semaine');
    verifier(canonique(base.get('logements', 'repull-101')) === canonique(apres), 'passage suivant : logement inchangé (idempotence)');
    base.poser('logements', l);
  }

  section('Page publique Airbnb : logement en pause');
  {
    const l = base.get<Logement>('logements', 'repull-101')!;
    const enPause: Logement = {
      ...l,
      id: 'repull-109',
      nom: 'Studio en pause',
      statut: 'pause',
      capacite: 0,
      chambres: 0,
      lits: [],
      photos: undefined,
      photoUrl: undefined,
      tarifs: undefined,
      repull: { id: '109', statut: 'inactive', horsSelection: true, canaux: [{ plateforme: 'airbnb', idExterne: '20669368', actif: false }] },
    };
    base.poser('logements', enPause);
    R.listings.push({ id: '109', name: 'Studio en pause', status: 'inactive', thumbnailUrl: null, address: { city: 'Paris' }, channels: [{ platform: 'airbnb', externalId: '20669368', active: false }] });
    repull.pagesAirbnb.set('20669368', pageAirbnbFactice('20669368', 5));
    const debut = repull.appels.length;
    avancer(61);
    const r = await lancer(options('manuel'));
    const p = base.get<Logement>('logements', 'repull-109')!;
    verifier(r.ok, `passage réussi (${r.message ?? ''})`);
    verifier(
      p.photos?.length === 6 && p.repull?.lecture?.photos === 'airbnb-page' && p.statut === 'pause' && p.repull.horsSelection === true,
      `logement en pause : photos lues sur sa page Airbnb, reste en pause (${p.photos?.length}, ${p.repull?.lecture?.photos})`,
    );
    verifier(p.capacite === 4 && p.chambres === 2 && canonique(p.lits) === canonique([{ type: 'double', nombre: 1 }, { type: 'simple', nombre: 2 }]), 'capacité, chambres et lits vides : remplis depuis la page');
    verifier(!repull.appels.slice(debut).some((a) => a.chemin.includes('/109')), 'logement en pause : aucun appel au service de connexion');
    // Page qui devient indisponible : on garde les photos, relecture hebdomadaire seulement.
    const lectures = repull.lecturesAirbnb.length;
    avancer(11);
    await lancer(options('manuel'));
    verifier(repull.lecturesAirbnb.length === lectures && canonique(base.get('logements', 'repull-109')) === canonique(p), 'passage suivant : page pas relue, logement inchangé');
    // Un autre logement en pause dont la page est refusée : raison en clair, nouvel essai le lendemain.
    base.poser('logements', { ...enPause, id: 'repull-110', repull: { ...enPause.repull!, id: '110', canaux: [{ plateforme: 'airbnb', idExterne: '7777', actif: false }] } });
    R.listings.push({ id: '110', name: 'Autre en pause', status: 'inactive', thumbnailUrl: null, address: { city: 'Paris' }, channels: [{ platform: 'airbnb', externalId: '7777', active: false }] });
    avancer(61);
    await lancer(options('manuel'));
    const refuse = base.get<Logement>('logements', 'repull-110')!;
    verifier(
      refuse.repull?.lecture?.photos === 'aucune' && refuse.repull.lecture.raisonPhotos === 'Airbnb : page indisponible' && !refuse.photos,
      `page refusée : note « Airbnb : page indisponible » (${JSON.stringify(refuse.repull?.lecture)})`,
    );
    const avantNouvelEssai = repull.lecturesAirbnb.length;
    avancer(61);
    await lancer(options('manuel'));
    verifier(repull.lecturesAirbnb.length === avantNouvelEssai, 'page refusée : pas redemandée avant le lendemain');
    // Retour à l'état d'avant (les sections suivantes comptent les logements et les annonces).
    R.listings.splice(R.listings.findIndex((x) => x.id === '109'), 2);
    base.lignes.delete(base.cle('logements', 'repull-109'));
    base.lignes.delete(base.cle('logements', 'repull-110'));
    repull.pagesAirbnb.clear();
  }

  section('Annonce uniquement Booking.com : lien Airbnb saisi, photos de l’équipe');
  {
    const l = base.get<Logement>('logements', 'repull-101')!;
    const canaux = R.listings[0].channels;
    // L'annonce n'est que sur Booking.com chez Repull (cas réel : ni photo ni contenu transmis) ;
    // l'équipe colle le lien de la même annonce sur Airbnb.
    R.listings[0].channels = [{ platform: 'booking', externalId: '5566771', active: true, syncEnabled: true }];
    repull.pagesAirbnb.set('424242', pageAirbnbFactice('424242'));
    repull.ficheRepullVide = true;
    repull.bookingInactif = true;
    base.poser('logements', {
      ...l,
      photos: undefined,
      annonces: [...l.annonces.filter((x) => x.canal !== 'airbnb'), { canal: 'airbnb', url: 'https://www.airbnb.fr/rooms/424242', connecte: false }],
      repull: { ...l.repull!, photosLuesLe: undefined },
    });
    avancer(61);
    const r = await lancer(options('manuel'));
    const apres = base.get<Logement>('logements', 'repull-101')!;
    verifier(r.ok && r.statut === 'fait', `passage réussi (${r.message ?? ''})`);
    verifier(
      !(apres.repull?.canaux ?? []).some((c) => c.plateforme === 'airbnb') && apres.annonces.some((x) => x.canal === 'airbnb' && x.url === 'https://www.airbnb.fr/rooms/424242' && !x.connecte),
      'lien Airbnb saisi par l’équipe : gardé par la synchronisation',
    );
    verifier(
      apres.photos?.length === 4 && apres.repull?.lecture?.photos === 'airbnb-page' && repull.lecturesAirbnb.some((x) => x.url === 'https://www.airbnb.fr/rooms/424242'),
      `annonce uniquement Booking.com : photos lues sur la page de l’annonce Airbnb saisie (${apres.repull?.lecture?.photos})`,
    );
    // Photos déposées par l'équipe : jamais écrasées, quelle que soit la relecture.
    const equipe = ['stockage://erp-fichiers/logements/repull-101/photos/b.jpg', 'stockage://erp-fichiers/logements/repull-101/photos/a.jpg'];
    base.poser('logements', { ...apres, photosEquipe: equipe, repull: { ...apres.repull!, photosLuesLe: undefined } });
    avancer(61);
    await lancer(options('manuel'));
    const final = base.get<Logement>('logements', 'repull-101')!;
    verifier(JSON.stringify(final.photosEquipe) === JSON.stringify(equipe) && final.photos?.length === 4, 'photos de l’équipe : jamais touchées par la synchronisation (ordre compris)');
    R.listings[0].channels = canaux;
    repull.ficheRepullVide = false;
    repull.bookingInactif = false;
    repull.pagesAirbnb.clear();
    base.poser('logements', l);
  }

  section('Lectures étendues refusées : relevé de base');
  {
    const avant = base.get<Logement>('logements', 'repull-102')!;
    repull.refusInclusEtendus = true;
    avancer(60 * 24);
    const debut = repull.appels.length;
    const r = await lancer(options('cron'));
    repull.refusInclusEtendus = false;
    const annonces = repull.appels.slice(debut).filter((a) => a.chemin === '/v1/listings');
    verifier(r.ok, `passage réussi malgré le refus (${r.message ?? ''})`);
    verifier(
      annonces.length === 2 && annonces[1].params.get('include') === 'content,details,thumbnail',
      `second essai avec les lectures de base (${annonces.map((a) => a.params.get('include')).join(' | ')})`,
    );
    const apres = base.get<Logement>('logements', 'repull-102')!;
    verifier(
      canonique(apres.photos) === canonique(avant.photos) && canonique(apres.descriptif?.couchage) === canonique(avant.descriptif?.couchage) && canonique(apres.descriptif?.prix) === canonique(avant.descriptif?.prix),
      'photos, couchage et prix gardés de la dernière lecture',
    );
  }

  /* ------------------------------------------- répondre depuis l'ERP */
  section('Répondre au voyageur depuis l’ERP (envoi par Repull)');
  {
    const ctxEnvoi = (extra: Partial<ContexteConnexion> = {}): ContexteConnexion => ({
      cle: 'sk_test_verif',
      base: baseErp(),
      echeance: Date.now() + 50_000,
      fetch: repull.fetch as typeof fetch,
      maintenant: () => horloge,
      attendre: async () => undefined,
      ...extra,
    });
    const etatAvantEnvoi = base.get<EtatRepull>(COLLECTION_ETAT, ID_ETAT)!;
    const avantEnvoi = repull.appels.length;
    const texte = 'Bonjour Alex, c’est bien noté. Belle journée !';
    const r1 = await envoyerMessage(ctxEnvoi(), { filId: 'repull-7001', texte, auteur: 'hote', par: 'camille@labelmaisoncg.fr' });
    const posts = repull.appels.slice(avantEnvoi).filter((a) => a.methode === 'POST');
    verifier(posts.length === 1 && posts[0].chemin === '/v1/conversations/7001/messages', 'un seul appel : POST /v1/conversations/7001/messages');
    verifier(posts[0]?.corps?.message === texte && Object.keys(posts[0]?.corps ?? {}).length === 1, 'corps conforme à l’OpenAPI ({ message })');
    verifier(posts[0]?.cle === cleEnvoi('repull-7001', texte, horloge) && /^lm-repull-7001-[0-9a-f]{8}-\d+$/.test(posts[0]?.cle ?? ''), `clé d’idempotence fil + texte + minute (${posts[0]?.cle})`);
    const filEnvoi = base.get<FilMessages>('filsMessages', 'repull-7001')!;
    const envoye = filEnvoi.messages[filEnvoi.messages.length - 1];
    verifier(envoye.id === 'repull-900000' && envoye.auteur === 'hote' && envoye.texte === texte && envoye.envoi?.canal === 'booking', 'message écrit dans le fil : auteur hôte, id Repull, trace d’envoi');
    verifier(filEnvoi.statut === 'ouvert' && filEnvoi.traitePar === 'humain' && filEnvoi.dernierMessageLe === envoye.envoyeLe, 'fil répondu : ouvert, suivi par l’équipe');
    verifier(r1.info === 'Envoyé sur Booking.com.' && r1.canal === 'booking', `info prête à afficher (${r1.info})`);
    verifier(base.collection<Journal>('journal').some((j) => j.entiteId === 'repull-7001' && /envoyé/i.test(j.action)), 'ligne de journal');
    const etatApresEnvoi = base.get<EtatRepull>(COLLECTION_ETAT, ID_ETAT)!;
    verifier(etatApresEnvoi.appelsMois === etatAvantEnvoi.appelsMois + 1, `appel compté dans la part du mois (${etatAvantEnvoi.appelsMois} → ${etatApresEnvoi.appelsMois})`);

    // Double clic : même texte, même minute → même clé, Repull rejoue, rien ne repart.
    await envoyerMessage(ctxEnvoi(), { filId: 'repull-7001', texte, auteur: 'hote', par: 'camille@labelmaisoncg.fr' });
    const filDouble = base.get<FilMessages>('filsMessages', 'repull-7001')!;
    verifier(repull.envois.length === 1 && filDouble.messages.filter((m) => m.id === 'repull-900000').length === 1, 'double clic : un seul envoi chez le voyageur, un seul message dans le fil');

    // Fil sans conversation Repull : rien n'est appelé.
    base.poser<FilMessages>('filsMessages', { ...filDouble, id: 'fil-local', repull: undefined, messages: [] });
    const avantLocal = repull.appels.length;
    let eLocal: unknown;
    await envoyerMessage(ctxEnvoi(), { filId: 'fil-local', texte: 'Coucou', auteur: 'hote', par: 'x' }).catch((e) => (eLocal = e));
    verifier(eLocal instanceof ErreurEnvoi && eLocal.code === 'hors_plateforme' && /pas relié à une plateforme/.test(eLocal.message) && repull.appels.length === avantLocal, 'voyageur hors plateforme : message gardé dans l’ERP, aucun appel');

    let eVide: unknown;
    await envoyerMessage(ctxEnvoi(), { filId: 'repull-7001', texte: '   ', auteur: 'hote', par: 'x' }).catch((e) => (eVide = e));
    verifier(eVide instanceof ErreurEnvoi && eVide.code === 'texte', 'message vide refusé');

    // Refus de la plateforme (422 message_not_sent) : rien d'écrit, message clair.
    repull.refusEnvoi = { status: 422, corps: { error: { code: 'message_not_sent', message: 'refused', statusReason: 'Links are not allowed', fix: 'Remove the link.' } } };
    let eRefus: unknown;
    const nbAvantRefus = base.get<FilMessages>('filsMessages', 'repull-7001')!.messages.length;
    await envoyerMessage(ctxEnvoi(), { filId: 'repull-7001', texte: 'Voir https://exemple.fr', auteur: 'hote', par: 'x' }).catch((e) => (eRefus = e));
    repull.refusEnvoi = null;
    verifier(!!eRefus && /refusé le message/.test(messageEchecEnvoi(eRefus)) && /Links are not allowed/.test(messageEchecEnvoi(eRefus)), `refus de la plateforme expliqué (${messageEchecEnvoi(eRefus)})`);
    verifier(base.get<FilMessages>('filsMessages', 'repull-7001')!.messages.length === nbAvantRefus, 'refus : rien d’écrit dans le fil');

    // Part du mois épuisée : aucun appel.
    const etatB = base.get<EtatRepull>(COLLECTION_ETAT, ID_ETAT)!;
    const avantBudget = repull.appels.length;
    let eBudget: unknown;
    await envoyerMessage(ctxEnvoi({ budgetMois: etatB.appelsMois }), { filId: 'repull-7001', texte: 'Autre message', auteur: 'hote', par: 'x' }).catch((e) => (eBudget = e));
    verifier(repull.appels.length === avantBudget && /épuisés/.test(messageEchecEnvoi(eBudget)), 'part épuisée : aucun appel, message clair');

    // Réponse de l'agent, puis synchronisation : pas de doublon, auteur « agent » gardé.
    avancer(1);
    await envoyerMessage(ctxEnvoi(), { filId: 'repull-7001', texte: 'Réponse de l’agent', auteur: 'agent', par: 'Agent IA' });
    // Message automatique (passage-programmes.ts) : même envoi, signé « Message automatique ».
    avancer(1);
    await envoyerMessage(ctxEnvoi(), { filId: 'repull-7001', texte: 'Bonjour Alex, à bientôt !', auteur: 'hote', par: PAR_MESSAGE_AUTO });
    avancer(15);
    const rSync = await lancer(options('manuel'));
    const filSync = base.get<FilMessages>('filsMessages', 'repull-7001')!;
    verifier(rSync.statut === 'fait', 'synchronisation après envoi');
    verifier(filSync.messages.filter((m) => m.id === 'repull-900000').length === 1 && filSync.messages.filter((m) => m.id === 'repull-900001').length === 1, 'synchronisation : messages envoyés reconnus, sans doublon');
    verifier(filSync.messages.find((m) => m.id === 'repull-900001')?.auteur === 'agent' && !!filSync.messages.find((m) => m.id === 'repull-900001')?.envoi, 'synchronisation : auteur « agent » et trace d’envoi gardés');
    const signature = (id: string) => {
      const m = filSync.messages.find((x) => x.id === id);
      return m ? auteurAffiche(m) : undefined;
    };
    verifier(
      signature('repull-900000') === 'Équipe' && signature('repull-900001') === 'Réponse de votre agent' && signature('repull-900002') === 'Message automatique',
      `après synchronisation, sous chaque bulle : équipe, agent, message automatique (${['repull-900000', 'repull-900001', 'repull-900002'].map(signature).join(' | ')})`,
    );
    verifierFil(filSync);
  }

  /* ------------------------------------------------ moteur d'automatisations */
  section('Moteur d’automatisations sur les données importées');
  const d: ErpDonnees = { ...donneesVides(), ...(Object.fromEntries(['logements', 'reservations', 'filsMessages', 'proprietaires'].map((c) => [c, base.collection(c)])) as Partial<ErpDonnees>) };
  Object.assign(R.reservations[0], { status: 'confirmed', updatedAt: '2026-09-27T07:00:00.000Z' });
  avancer(60 * 24);
  await lancer(options('cron'));
  d.reservations = base.collection<Reservation>('reservations');
  d.logements = base.collection<Logement>('logements');
  const auto = executerAutomatisations(d, { date: '2026-09-28', maintenant: '2026-09-28T10:00:00+02:00' });
  const menage = auto.donnees.missions.find((x) => x.id === 'auto-menage-repull-5001');
  verifier(menage?.type === 'menage' && menage.date === '2026-10-05' && menage.heureDebut === '11:00', `ménage créé au départ de la réservation importée (${menage?.date} ${menage?.heureDebut})`);

  /* ------------------------------------------------------ part d'appels */
  section('Part mensuelle d’appels');
  avancer(60 * 24);
  const etatAvant = base.get<EtatRepull>(COLLECTION_ETAT, ID_ETAT)!;
  const r5 = await lancer(options('cron', { budgetMois: etatAvant.appelsMois + 1 }));
  verifier(!r5.ok && /épuisée/.test(r5.message ?? ''), `un seul appel restant : arrêt propre, message clair (${r5.message})`);
  const etatApres = base.get<EtatRepull>(COLLECTION_ETAT, ID_ETAT)!;
  verifier(etatApres.appelsMois === etatAvant.appelsMois + 1, `exactement le reste consommé (${etatAvant.appelsMois} → ${etatApres.appelsMois})`);
  const avant6 = repull.appels.length;
  const r6: ResultatLancement = await lancer(options('cron', { budgetMois: etatApres.appelsMois }));
  verifier(r6.statut === 'budget' && repull.appels.length === avant6, 'part épuisée : aucun appel, statut « budget »');
  horloge = new Date('2026-10-01T06:00:00.000Z');
  const r7 = await lancer(options('cron', { budgetMois: 5 }));
  verifier(r7.statut === 'fait' && r7.etat.mois === '2026-10' && r7.etat.appelsMois <= 5, `nouveau mois : compteur remis à zéro (${r7.etat.appelsMois})`);

  /* ------------------------------------------------ connexions et choix */
  section('Connexions : choix des logements (offre gratuite : 3)');
  // Nouvelle base (autre compte) : 102 est archivée, 103, 104 et 105 viennent d'être connectées.
  const base2 = new FausseBase();
  const erp2 = () =>
    new BaseErp({
      url: 'https://base.test',
      cleAnon: 'anon',
      fetch: base2.fetch as typeof fetch,
      jeton: async () => 'jeton-equipe',
    });
  const annonce = (id: string, nom: string, ville: string, plateforme: string) => ({
    id,
    name: nom,
    address: { city: ville },
    thumbnailUrl: `https://cdn.repull.dev/p/${id}.jpg`,
    status: 'active',
    channels: [{ platform: plateforme, externalId: `x${id}`, active: true, syncEnabled: true }],
    details: { personCapacity: 4 },
    updatedAt: '2026-10-01T05:00:00.000Z',
  });
  R.listings.push(annonce('103', 'Loft Saint-Martin', 'Paris', 'airbnb'), annonce('104', 'Duplex Bellecour', 'Lyon', 'booking.com'), annonce('105', 'Villa Pins', 'Arcachon', 'airbnb'));
  R.reservations.push(
    { id: '5104', listingId: '104', checkIn: '2026-10-20', checkOut: '2026-10-23', status: 'confirmed', source: 'booking.com', guestName: 'Lina Roy', financials: { totalPrice: 420, currency: 'EUR' }, updatedAt: '2026-10-01T05:00:00.000Z' },
    { id: '5105', listingId: '105', checkIn: '2026-10-21', checkOut: '2026-10-24', status: 'confirmed', source: 'airbnb', guestName: 'Paul Roy', financials: { totalPrice: 610, currency: 'EUR' }, updatedAt: '2026-10-01T05:00:00.000Z' },
  );
  R.conversations.push({ id: '7105', platform: 'airbnb', listingId: '105', reservationId: '5105', lastMessageAt: '2026-10-01T05:00:00.000Z', updatedAt: '2026-10-01T05:00:00.000Z', status: 'open' });
  R.messages['7105'] = [{ id: 'm105', direction: 'inbound', senderName: 'Paul', body: 'Bonjour !', attachments: [], sentAt: '2026-10-01T05:00:00.000Z' }];
  horloge = new Date('2026-10-02T08:00:00.000Z');
  const ctx = (): ContexteConnexion => ({
    cle: 'sk_test_verif',
    base: erp2(),
    echeance: Date.now() + 50_000,
    fetch: repull.fetch as typeof fetch,
    maintenant: () => horloge,
    attendre: async () => undefined,
  });
  const appelsBase2 = () => base2.get<EtatRepull>(COLLECTION_ETAT, ID_ETAT)?.appelsMois ?? 0;
  const debutC = repull.appels.length;

  const e1 = await lireEtatConnexions(ctx());
  verifier(e1.limite === 3 && e1.offre === 'free' && e1.sourceLimite === 'repull', `limite lue chez Repull : offre ${e1.offre}, ${e1.limite} logements`);
  verifier(e1.annonces.length === 4 && !e1.annonces.some((a) => a.id === '102'), `4 logements proposés, l’annonce archivée écartée (${e1.annonces.map((a) => a.id).join(',')})`);
  verifier(e1.annonces.find((a) => a.id === '104')?.plateformes.join() === 'booking' && e1.annonces.find((a) => a.id === '103')?.ville === 'Paris', 'plateformes et ville');
  verifier(e1.connexions.length === 1 && e1.connexions[0].fournisseur === 'airbnb' && e1.connexions[0].nom === 'Camille', 'compte Airbnb connecté');
  verifier(e1.fournisseurs.some((f) => f.id === 'hostaway' && f.categorie === 'pms'), 'logiciels de gestion proposés');
  verifier(e1.selection.length === 0 && e1.annonces.every((a) => !a.selectionnee && !a.importee), 'rien de choisi, rien d’importé');
  verifier(appelsBase2() === repull.appels.length - debutC, `appels de la page comptés dans la part du mois (${appelsBase2()})`);
  const avantCache = repull.appels.length;
  await lireEtatConnexions(ctx());
  verifier(repull.appels.length === avantCache, 'relecture dans les 5 min : aucun appel (mémoire)');

  const avantTrop = repull.appels.length;
  let refus = '';
  try {
    await enregistrerSelection(ctx(), ['101', '103', '104', '105'], 'gerant@test');
  } catch (e) {
    refus = e instanceof ErreurConnexion ? e.message : String(e);
  }
  verifier(/permet 3 logements : vous en avez choisi 4/.test(refus), `4 logements refusés, message clair (${refus})`);
  verifier(repull.appels.length === avantTrop && !base2.get(COLLECTION_ETAT, ID_SELECTION), 'refus avant tout appel, choix non enregistré');

  const s1 = await enregistrerSelection(ctx(), ['101', '103', '104'], 'gerant@test');
  verifier(s1.ok && s1.logements === 3, `3 logements importés (${JSON.stringify({ ...s1, bilan: undefined })})`);
  verifier(R.listings.find((l) => l.id === '105')?.status === 'inactive', 'annonce non choisie désactivée chez Repull (hors limite)');
  verifier(!base2.get('logements', 'repull-105') && !base2.get('reservations', 'repull-5105') && !base2.get('filsMessages', 'repull-7105'), 'logement non choisi : ni logement, ni réservation, ni conversation');
  verifier(!base2.get('reservations', 'repull-5002'), 'réservation d’une annonce non choisie ignorée');
  verifier((s1.bilan?.ignores.reservationsHorsSelection ?? 0) >= 1, `réservation écartée comptée (${JSON.stringify(s1.bilan?.ignores)})`);
  verifier(
    ecartsBilan({ ignores: { reservationsHorsSelection: 4, filsHorsSelection: 2 } }).join(' ') ===
      '4 réservations et 2 conversations concernent des logements non choisis : elles n’entrent pas dans l’ERP. Pour les ajouter : Logements → Connexions.',
    'écarts hors choix : une seule phrase, chemin une fois',
  );
  verifier(
    ecartsBilan({ ignores: { reservationsHorsSelection: 1 } })[0] === '1 réservation concerne un logement non choisi : elle n’entre pas dans l’ERP. Pour l’ajouter : Logements → Connexions.' &&
      ecartsBilan({ ignores: { filsHorsSelection: 2, reservationsEnAttente: 1 } }).join(' ') ===
        '2 conversations concernent des logements non choisis : elles n’entrent pas dans l’ERP. Pour les ajouter : Logements → Connexions. 1 réservation en attente de confirmation, importée une fois confirmée.',
    'écarts : accords et autres motifs à la suite',
  );
  verifier(ecartsBilan({ ignores: {} }).length === 0 && ecartsBilan({}).length === 0, 'aucun écart : aucun message');
  verifier(base2.get<Reservation>('reservations', 'repull-5104')?.logementId === 'repull-104' && s1.reservations >= 2, `réservations des logements choisis importées (${s1.reservations})`);
  verifier(base2.get<SelectionRepull>(COLLECTION_ETAT, ID_SELECTION)?.annonces.join() === '101,103,104', 'choix enregistré');
  verifier(appelsBase2() === repull.appels.length - debutC, `tous les appels comptés (${appelsBase2()} = ${repull.appels.length - debutC})`);

  const statut = repull.appels.filter((a) => a.chemin === '/v1/listings/status');
  const s2 = await enregistrerSelection(ctx(), ['101', '103', '105'], 'gerant@test');
  const ordre = repull.appels.filter((a) => a.chemin === '/v1/listings/status').slice(statut.length).map((a) => `${a.corps?.active}:${(a.corps?.listingIds as string[]).join()}`);
  verifier(ordre.join(' ') === 'false:104 true:105', `désactiver avant d’activer, la limite n’est jamais dépassée (${ordre.join(' ')})`);
  const l104 = base2.get<Logement>('logements', 'repull-104')!;
  verifier(s2.ok && l104.statut === 'pause' && l104.repull?.horsSelection === true, `logement retiré : en pause, pas supprimé (${l104.statut})`);
  verifier(!!base2.get('reservations', 'repull-5104'), 'ses réservations restent');
  verifier(base2.get<Logement>('logements', 'repull-105')?.statut === 'actif' && !!base2.get('filsMessages', 'repull-7105'), 'nouveau logement choisi : importé avec sa conversation');

  await enregistrerSelection(ctx(), ['101', '104', '105'], 'gerant@test');
  const l104b = base2.get<Logement>('logements', 'repull-104')!;
  verifier(l104b.statut === 'actif' && !l104b.repull?.horsSelection, 'choisi de nouveau : actif');
  verifier(base2.get<Logement>('logements', 'repull-103')?.statut === 'pause', 'l’autre retiré passe en pause');
  const e2 = await lireEtatConnexions(ctx(), { forcer: true });
  verifier(
    e2.annonces.filter((a) => a.selectionnee).map((a) => a.id).sort().join() === '101,104,105' && e2.annonces.find((a) => a.id === '103')?.importee === false,
    'page : choix et logements importés à jour',
  );

  section('Connexions : connecter, déconnecter, offre dépassée');
  const c1 = await demarrerConnexion(ctx(), 'airbnb', 'https://www.labelmaisoncg.fr/erp/logements/connexions?retour=airbnb');
  const appelAirbnb = repull.appels[repull.appels.length - 1];
  verifier(c1.url.startsWith('https://connect.repull.dev/') && appelAirbnb.chemin === '/v1/connect/airbnb' && appelAirbnb.methode === 'POST', 'Airbnb : page de connexion Repull');
  verifier(String(appelAirbnb.corps?.redirectUrl).endsWith('/erp/logements/connexions?retour=airbnb'), 'retour sur la page Connexions');
  verifier(appelAirbnb.corps?.accessType === 'messaging', 'Airbnb : accès messagerie seulement (calendrier, prix et annonces jamais modifiables)');

  section('Plateformes jamais modifiées : lecture + messages seulement');
  const clientLecture = new ClientRepull({ cle: 'sk_test', echeance: Date.now() + 60_000, fetch: repull.fetch as typeof fetch });
  const avantEcritures = repull.appels.length;
  const refusEcriture: string[] = [];
  for (const [m, c] of [
    ['PUT', '/v1/availability/104'],
    ['PUT', '/v1/channels/booking/availability'],
    ['PATCH', '/v1/listings/104'],
    ['POST', '/v1/listings/104/pricing'],
    ['PUT', '/v1/channels/airbnb/listings/101/availability'],
  ] as const) {
    await clientLecture.requete(m, c, {}, {}).catch((e) => refusEcriture.push(e instanceof ErreurRepull && e.code === 'lecture_seule' ? c : ''));
  }
  verifier(refusEcriture.filter(Boolean).length === 5 && repull.appels.length === avantEcritures, 'calendrier, prix, annonces : écriture refusée avant tout envoi (Airbnb et Booking)');
  verifier(
    ecritureRepullPermise('POST', '/v1/conversations/c1/messages') && ecritureRepullPermise('POST', '/v1/connect/airbnb', { accessType: 'messaging' }) && ecritureRepullPermise('GET', '/v1/reservations')
      && !ecritureRepullPermise('PUT', '/v1/conversations/c1/messages') && !ecritureRepullPermise('POST', '/v1/conversations/c1/archive'),
    'permis : lire, répondre aux voyageurs, connecter un compte',
  );
  verifier(
    !ecritureRepullPermise('POST', '/v1/connect/booking', { redirectUrl: 'x' })
      && !ecritureRepullPermise('POST', '/v1/connect', { allowedProviders: ['booking'] })
      && !ecritureRepullPermise('POST', '/v1/connect', { allowedProviders: ['booking-extranet-login', 'hostaway'] })
      && !ecritureRepullPermise('POST', '/v1/connect/airbnb', { accessType: 'full_access' })
      && !ecritureRepullPermise('POST', '/v1/connect/airbnb', {})
      && ecritureRepullPermise('POST', '/v1/connect', { allowedProviders: ['booking-extranet-login'] })
      && ecritureRepullPermise('POST', '/v1/connect/airbnb', { accessType: 'messaging' }),
    'connexions : Airbnb en messagerie et Booking en Extranet login seulement (jamais fournisseur de connectivité, jamais accès complet)',
  );
  verifier(
    !ecritureRepullPermise('POST', '/v1/conversations/..\\..\\availability\\1#/messages')
      && !ecritureRepullPermise('POST', '/v1/conversations/../messages')
      && !ecritureRepullPermise('POST', '/v1/conversations/%2e%2e/availability/messages')
      && !ecritureRepullPermise('GET', '/v1/x/../../availability'),
    'chemins détournés (.., \\, #, séparateurs encodés) refusés',
  );
  await demarrerConnexion(ctx(), 'booking', 'https://www.labelmaisoncg.fr/erp/logements/connexions?retour=booking');
  const appelBooking = repull.appels[repull.appels.length - 1];
  verifier(
    appelBooking.chemin === '/v1/connect' && JSON.stringify(appelBooking.corps?.allowedProviders) === '["booking-extranet-login"]',
    'Booking.com : connexion « Extranet login » (messages, réservations, avis ; calendrier et prix jamais repris)',
  );
  const avantAutre = repull.appels.length;
  let refusAutre = '';
  await demarrerConnexion(ctx(), 'hostaway', 'https://x').catch((e) => (refusAutre = String(e?.message)));
  let refusInconnu = '';
  await demarrerConnexion(ctx(), 'booking.com', 'https://x').catch((e) => (refusInconnu = String(e?.message)));
  verifier(/Seuls Airbnb et Booking/.test(refusAutre) && /Seuls Airbnb et Booking/.test(refusInconnu) && repull.appels.length === avantAutre, 'logiciels de gestion et variantes de Booking refusés, sans aucun appel');

  let refus501 = '';
  await deconnecter(ctx(), 'hostaway').catch((e) => (refus501 = e instanceof ErreurConnexion ? e.message : String(e)));
  verifier(/depuis son propre site/.test(refus501) && /Hostaway settings/.test(refus501), `déconnexion impossible par l’API : marche à suivre de Repull (${refus501})`);
  const d1 = await deconnecter(ctx(), 'airbnb', '4455');
  verifier(d1.annoncesDesactivees.includes('101') && !base2.get<SelectionRepull>(COLLECTION_ETAT, ID_SELECTION)!.annonces.includes('101'), 'Airbnb déconnecté : ses logements sortent du choix');

  repull.bloque402 = true;
  const e3 = await lireEtatConnexions(ctx(), { forcer: true });
  repull.bloque402 = false;
  verifier(!!e3.depassement && /logements actifs chez Repull/.test(e3.depassement.message) && e3.annonces.length > 0, `offre dépassée : message clair, dernière liste gardée (${e3.depassement?.message})`);
  verifier(appelsBase2() === repull.appels.length - debutC, `part du mois : tous les appels de la page comptés (${appelsBase2()})`);

  const avantBudget = repull.appels.length;
  const ctxEpuise = { ...ctx(), budgetMois: appelsBase2() };
  const e4 = await lireEtatConnexions(ctxEpuise, { forcer: true });
  verifier(repull.appels.length === avantBudget && /épuisés/.test(e4.avertissements.join(' ')), 'part du mois épuisée : aucun appel, avertissement, dernière lecture affichée');

  /* ----------------------------------------------------------- signature */
  section('Signature du webhook');
  // node:crypto chargé à l'exécution (le typage de l'ERP ne connaît pas Node).
  const crypto = (await import('node:crypto' as string)) as {
    createHmac: (a: string, k: string) => { update: (m: string) => { digest: (e: 'hex') => string } };
    timingSafeEqual: (a: Uint8Array, b: Uint8Array) => boolean;
  };
  const enc = new TextEncoder();
  const outils: OutilsSignature = {
    hmacHex: (k, m) => crypto.createHmac('sha256', k).update(m).digest('hex'),
    egal: (a, b) => crypto.timingSafeEqual(enc.encode(a), enc.encode(b)),
  };
  const hmac = outils.hmacHex;
  const secret = 'whsec_test';
  const corps = JSON.stringify({ event: 'reservation.created', eventId: 'e1', data: { object: { id: 5001 } } });
  const t = Math.floor(Date.now() / 1000);
  const v1 = hmac(secret, `${t}.${corps}`);
  verifier(signatureValide(corps, `t=${t},v1=${v1}`, secret, outils), 'signature valide acceptée');
  verifier(signatureValide(corps, `t=${t},v1=deadbeef,v1=${v1}`, secret, outils), 'plusieurs v1 (rotation) acceptés');
  verifier(!signatureValide(`${corps} `, `t=${t},v1=${v1}`, secret, outils), 'corps modifié refusé');
  verifier(!signatureValide(corps, `t=${t},v1=${v1}`, 'whsec_autre', outils), 'mauvais secret refusé');
  verifier(!signatureValide(corps, `t=${t - 600},v1=${hmac(secret, `${t - 600}.${corps}`)}`, secret, outils), 'horodatage de plus de 5 min refusé');
  verifier(!signatureValide(corps, '', secret, outils) && !signatureValide(corps, `t=${t},v1=${v1}`, '', outils), 'en-tête ou secret absent refusé');

  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
}

principal().catch((e) => {
  console.error(e);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
});
