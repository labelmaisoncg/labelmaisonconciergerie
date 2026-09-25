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
import { ID_PROPRIETAIRE_A_RENSEIGNER, canonique, montantsReservation, noteSur5, heure } from './repull';
import { BaseErp, COLLECTION_ETAT, ID_ETAT, ID_SELECTION, lancer, type EtatRepull, type ResultatLancement, type SelectionRepull } from './repull-synchro';
import { ErreurConnexion, deconnecter, demarrerConnexion, enregistrerSelection, lireEtatConnexions, ouvrirCalendrier, type ContexteConnexion } from './repull-connexion';
import { ErreurEnvoi, cleEnvoi, envoyerMessage, messageEchecEnvoi } from './messagerie-envoi';
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
      content: { name: 'Studio Cœur de Ville', houseRules: 'Pas de fête. Non-fumeur.' },
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
      details: { propertyTypeCategory: 'house', bedrooms: 3, personCapacity: 6, checkInTimeStart: '15:00', checkOutTime: '10:00' },
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
    if (chemin === '/v1/listings') return this.paginer(R.listings, p);
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

/* ----------------------------------------------------------- contrôles de forme */

const estChaine = (v: unknown) => typeof v === 'string';
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
  const prop = base.get<Proprietaire>('proprietaires', ID_PROPRIETAIRE_A_RENSEIGNER);
  verifier(prop?.nom === 'Propriétaire à renseigner' && prop.contact.email === '' && prop.ibanMasque === '', 'fiche propriétaire d’attente, sans donnée inventée');

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
    avancer(15);
    const rSync = await lancer(options('manuel'));
    const filSync = base.get<FilMessages>('filsMessages', 'repull-7001')!;
    verifier(rSync.statut === 'fait', 'synchronisation après envoi');
    verifier(filSync.messages.filter((m) => m.id === 'repull-900000').length === 1 && filSync.messages.filter((m) => m.id === 'repull-900001').length === 1, 'synchronisation : messages envoyés reconnus, sans doublon');
    verifier(filSync.messages.find((m) => m.id === 'repull-900001')?.auteur === 'agent' && !!filSync.messages.find((m) => m.id === 'repull-900001')?.envoi, 'synchronisation : auteur « agent » et trace d’envoi gardés');
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

  section('Ouvrir à la réservation : Booking.com seulement');
  const avantCal = repull.appels.length;
  const cal = await ouvrirCalendrier(ctx(), { annonce: '104', prix: 82, minNuits: 2, jours: 10, bloquees: ['2026-10-05', '2026-10-06'] });
  const appelsCal = repull.appels.slice(avantCal);
  verifier(
    appelsCal.length === 3 && appelsCal.every((a) => a.chemin.startsWith('/v1/channels/booking/')),
    `3 appels, tous vers Booking.com (${appelsCal.map((a) => `${a.methode} ${a.chemin}`).join(' ; ')})`,
  );
  verifier(!appelsCal.some((a) => a.chemin.startsWith('/v1/availability') || /airbnb/.test(a.chemin)), 'aucune écriture générique ni Airbnb');
  const tarifs = appelsCal[1]?.corps as { type?: string; property_id?: string; updates?: { dateRange: { start: string; end: string }; price: number; restrictions?: { minStay?: number } }[] };
  verifier(
    tarifs?.type === 'rates' && tarifs.property_id === '9990104' && tarifs.updates?.length === 2 && tarifs.updates[0].price === 82 && tarifs.updates[0].restrictions?.minStay === 2,
    `prix + durée minimale sur 2 périodes (${JSON.stringify(tarifs?.updates?.map((u) => u.dateRange))})`,
  );
  verifier(
    JSON.stringify(tarifs?.updates?.map((u) => u.dateRange)) === JSON.stringify([{ start: '2026-10-02', end: '2026-10-04' }, { start: '2026-10-07', end: '2026-10-11' }]),
    'nuits réservées (5 et 6 octobre) laissées fermées',
  );
  const dispo = appelsCal[2]?.corps as { type?: string; updates?: { availableRooms?: number; closed?: boolean }[] };
  verifier(dispo?.type === 'availability' && dispo.updates?.every((u) => u.availableRooms === 1 && u.closed === false) === true, 'vente rouverte : 1 chambre à vendre');
  verifier(cal.ouvertes === 8 && cal.gardeesFermees === 2 && cal.plateforme === 'booking', `bilan : ${cal.ouvertes} ouvertes, ${cal.gardeesFermees} gardées fermées`);
  await demarrerConnexion(ctx(), 'booking', 'https://www.labelmaisoncg.fr/erp/logements/connexions?retour=booking');
  const appelBooking = repull.appels[repull.appels.length - 1];
  verifier(
    appelBooking.chemin === '/v1/connect' && JSON.stringify(appelBooking.corps?.allowedProviders) === '["booking"]',
    'Booking.com : sélecteur Repull limité à l’identifiant exact du registre',
  );
  await demarrerConnexion(ctx(), 'hostaway', 'https://www.labelmaisoncg.fr/erp/logements/connexions?retour=hostaway');
  const appelPicker = repull.appels[repull.appels.length - 1];
  verifier(appelPicker.chemin === '/v1/connect' && (appelPicker.corps?.allowedProviders as string[]).join() === 'hostaway', 'autre logiciel : sélecteur Repull limité à ce logiciel');
  let refusInconnu = '';
  await demarrerConnexion(ctx(), 'inconnu', 'https://x').catch((e) => (refusInconnu = String(e?.message)));
  verifier(/pas proposée/.test(refusInconnu), 'plateforme inconnue refusée');

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
