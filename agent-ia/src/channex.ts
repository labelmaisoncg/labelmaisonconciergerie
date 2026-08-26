/**
 * Client de l'API Channex.
 *
 * Channex est la source de vérité pour les annonces, les réservations et les
 * messages voyageurs. Un seul compte — le nôtre, celui de l'éditeur — et un
 * `group` par conciergerie cliente. Elles n'ont jamais de compte Channex.
 *
 * Bascule staging → production : la variable CHANNEX_BASE_URL, rien d'autre.
 *
 * ⚠️ Deux systèmes de codes canaux coexistent, et les confondre coûte une heure :
 *    - l'API veut `AirBNB`, `BookingCom`, `Expedia` (casse exacte, vérifiée)
 *    - le filtre du lien d'intégration veut `ABB`, `BDC`
 */

const BASE = process.env.CHANNEX_BASE_URL || 'https://staging.channex.io';
const CLE = () => process.env.CHANNEX_API_KEY || '';

export type Canal = 'airbnb' | 'booking';

const CODES: Record<Canal, { api: string; lien: string; nom: string }> = {
  airbnb: { api: 'AirBNB', lien: 'ABB', nom: 'Airbnb' },
  booking: { api: 'BookingCom', lien: 'BDC', nom: 'Booking.com' },
};

export const enProduction = (): boolean => BASE.includes('secure.channex.io');

async function appel<T = any>(
  methode: 'GET' | 'POST' | 'PUT',
  chemin: string,
  corps?: unknown,
): Promise<T> {
  const reponse = await fetch(`${BASE}/api/v1${chemin}`, {
    method: methode,
    headers: { 'user-api-key': CLE(), 'Content-Type': 'application/json' },
    ...(corps ? { body: JSON.stringify(corps) } : {}),
  });
  const texte = await reponse.text();
  if (!reponse.ok) {
    throw new Error(`[channex] ${methode} ${chemin} → ${reponse.status} ${texte.slice(0, 300)}`);
  }
  return texte ? JSON.parse(texte) : ({} as T);
}

// --- Conciergeries (groups) ---

export async function creerGroupe(titre: string): Promise<{ id: string; titre: string }> {
  const r = await appel('POST', '/groups', { group: { title: titre } });
  return { id: r.data.id, titre: r.data.attributes.title };
}

// --- Logements (properties) ---

export async function creerPropriete(l: {
  titre: string;
  ville: string;
  groupId: string;
}): Promise<{ id: string; titre: string }> {
  const r = await appel('POST', '/properties', {
    property: {
      title: l.titre,
      currency: 'EUR',
      country: 'FR',
      city: l.ville,
      address: l.ville,
      zip_code: '00000',
      email: 'contact@labelmaisonconciergerie.fr',
      phone: '+33600000000',
      timezone: 'Europe/Paris',
      property_type: 'apartment',
      group_id: l.groupId,
    },
  });
  return { id: r.data.id, titre: r.data.attributes.title };
}

// --- Canaux et connexion des OTA ---

/**
 * Crée le canal AVANT d'envoyer le lien. C'est ce qui fait passer la cliente de
 * trois clics à un : sans canal préexistant elle atterrit sur un formulaire de
 * création, avec canal elle tombe directement sur le bouton de connexion.
 * Le canal naît `is_active: false` ; l'OAuth l'active.
 */
export async function creerCanal(
  proprieteId: string,
  groupId: string,
  canal: Canal,
): Promise<{ id: string; actif: boolean }> {
  const r = await appel('POST', '/channels', {
    channel: {
      channel: CODES[canal].api,
      group_id: groupId,
      title: CODES[canal].nom,
      properties: [proprieteId],
      settings: {},
    },
  });
  return { id: r.data.id, actif: r.data.attributes.is_active === true };
}

export async function canauxDe(
  proprieteId: string,
): Promise<Array<{ id: string; code: string; titre: string; actif: boolean }>> {
  const r = await appel('GET', '/channels');
  return (r.data ?? [])
    .filter((c: any) => (c.attributes?.properties ?? []).includes(proprieteId))
    .map((c: any) => ({
      id: c.id,
      code: c.attributes.channel,
      titre: c.attributes.title,
      actif: c.attributes.is_active === true,
    }));
}

export async function canalConnecte(proprieteId: string, canal: Canal): Promise<boolean> {
  const canaux = await canauxDe(proprieteId);
  return canaux.some((c) => c.code === CODES[canal].api && c.actif);
}

/** Jeton d'accès unique, valable 15 minutes. */
async function jetonUnique(proprieteId: string, groupId: string, utilisateur: string): Promise<string> {
  const r = await appel('POST', '/auth/one_time_token', {
    property_id: proprieteId,
    group_id: groupId,
    username: utilisateur,
  });
  return r.data.token;
}

/**
 * Le lien que le bot envoie dans la conversation. La cliente clique depuis son
 * téléphone, arrive déjà authentifiée chez Channex — sans compte Channex — et
 * autorise avec SES identifiants Airbnb ou Booking.
 *
 * `redirect_to` doit garder une barre oblique littérale : encodée en %2F,
 * Channex ne la reconnaît plus comme un chemin et renvoie une erreur
 * d'authentification. C'est le bug qui a coûté le premier essai.
 */
export async function lienConnexion(
  proprieteId: string,
  groupId: string,
  canal: Canal,
  utilisateur: string,
  canalId?: string,
): Promise<string> {
  const jeton = await jetonUnique(proprieteId, groupId, utilisateur);
  const destination = canalId ? `/channels/${canalId}` : '/channels/create';
  return (
    `${BASE}/auth/exchange` +
    `?oauth_session_key=${encodeURIComponent(jeton)}` +
    `&app_mode=headless` +
    `&redirect_to=${destination}` +
    `&property_id=${encodeURIComponent(proprieteId)}` +
    `&channels=${CODES[canal].lien}`
  );
}

// --- Réservations ---

export type Reservation = {
  id: string;
  ref: string;
  canal: string;
  logementId: string;
  arrivee: string;
  depart: string;
  voyageur: string | null;
  personnes: number | null;
  montant: number | null;
  statut: string;
};

const versReservation = (b: any): Reservation => {
  const a = b.attributes ?? {};
  const client = a.customer ?? {};
  return {
    id: b.id,
    ref: a.ota_reservation_code ?? a.unique_id ?? b.id,
    canal: a.ota_name ?? a.ota ?? 'inconnu',
    logementId: a.property_id,
    arrivee: a.arrival_date,
    depart: a.departure_date,
    voyageur: [client.name, client.surname].filter(Boolean).join(' ') || null,
    personnes: a.occupancy?.adults != null ? a.occupancy.adults + (a.occupancy.children ?? 0) : null,
    montant: a.amount != null ? Number(a.amount) : null,
    statut: a.status ?? 'inconnu',
  };
};

/** Réservations d'un logement chevauchant une fenêtre de dates. */
export async function reservations(
  proprieteId: string,
  du: string,
  au: string,
): Promise<Reservation[]> {
  const p = new URLSearchParams({
    'filter[property_id]': proprieteId,
    'filter[arrival_date][gte]': du,
    'filter[arrival_date][lte]': au,
    'pagination[limit]': '100',
  });
  const r = await appel('GET', `/bookings?${p}`);
  return (r.data ?? []).map(versReservation);
}

/** Départs d'une date donnée : un départ = un ménage. */
export async function departsDu(proprieteId: string, date: string): Promise<Reservation[]> {
  const p = new URLSearchParams({
    'filter[property_id]': proprieteId,
    'filter[departure_date][eq]': date,
    'pagination[limit]': '100',
  });
  const r = await appel('GET', `/bookings?${p}`);
  return (r.data ?? []).map(versReservation);
}

// --- Écriture des calendriers (ARI) ---

export async function typesDeChambre(proprieteId: string): Promise<Array<{ id: string; titre: string }>> {
  const r = await appel('GET', `/room_types?filter[property_id]=${proprieteId}`);
  return (r.data ?? []).map((t: any) => ({ id: t.id, titre: t.attributes.title }));
}

/**
 * Bloque ou débloque des dates. Part chez l'OTA en quelques secondes — pas de
 * retour en arrière silencieux, d'où la confirmation par bouton en amont.
 */
export async function definirDisponibilite(
  proprieteId: string,
  typeChambreId: string,
  du: string,
  au: string,
  quantite: number,
): Promise<void> {
  await appel('POST', '/availability', {
    values: [
      {
        property_id: proprieteId,
        room_type_id: typeChambreId,
        date_from: du,
        date_to: au,
        availability: quantite,
      },
    ],
  });
}

// --- Messagerie voyageurs ---

export type FilMessages = {
  id: string;
  logementId: string;
  canal: string;
  voyageur: string | null;
  reservationRef: string | null;
  ferme: boolean;
};

export type MessageVoyageur = {
  id: string;
  auteur: 'voyageur' | 'hote';
  texte: string;
  envoyeLe: string;
};

export async function filsDeMessages(proprieteId?: string): Promise<FilMessages[]> {
  const p = new URLSearchParams({ 'pagination[limit]': '100' });
  if (proprieteId) p.set('filter[property_id]', proprieteId);
  const r = await appel('GET', `/message_threads?${p}`);
  return (r.data ?? []).map((t: any) => {
    const a = t.attributes ?? {};
    return {
      id: t.id,
      logementId: a.property_id,
      canal: a.channel ?? 'inconnu',
      voyageur: a.customer_name ?? null,
      reservationRef: a.booking_id ?? null,
      ferme: a.status === 'closed',
    };
  });
}

export async function messagesDuFil(filId: string): Promise<MessageVoyageur[]> {
  const r = await appel('GET', `/message_threads/${filId}/messages`);
  return (r.data ?? []).map((m: any) => {
    const a = m.attributes ?? {};
    return {
      id: m.id,
      auteur: a.sender === 'guest' || a.direction === 'inbound' ? 'voyageur' : 'hote',
      texte: a.message ?? a.text ?? '',
      envoyeLe: a.inserted_at ?? a.sent_at ?? '',
    };
  });
}

export async function repondreAuFil(filId: string, texte: string): Promise<void> {
  await appel('POST', `/message_threads/${filId}/messages`, { message: { message: texte } });
}
