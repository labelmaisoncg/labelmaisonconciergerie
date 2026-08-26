/**
 * Client de l'API Channex.
 *
 * Channex est notre source de vérité pour les annonces, les réservations et les
 * messages voyageurs. Un seul compte — le nôtre, celui de l'éditeur — et un
 * `group` par conciergerie cliente. Elles n'ont jamais de compte Channex.
 *
 * Bascule staging → production : la variable CHANNEX_BASE_URL, rien d'autre.
 */

const BASE = process.env.CHANNEX_BASE_URL || 'https://staging.channex.io';
const CLE = () => process.env.CHANNEX_API_KEY || '';

/** Codes canaux Channex. */
export const AIRBNB = 'ABB';
export const BOOKING = 'BDC';

export const enProduction = (): boolean => BASE.includes('secure.channex.io');

async function appel<T = any>(
  methode: 'GET' | 'POST',
  chemin: string,
  corps?: unknown,
): Promise<T> {
  const reponse = await fetch(`${BASE}/api/v1${chemin}`, {
    method: methode,
    headers: {
      'user-api-key': CLE(),
      'Content-Type': 'application/json',
    },
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

export type NouveauLogement = {
  titre: string;
  ville: string;
  groupId: string;
  adresse?: string;
  codePostal?: string;
  email?: string;
  telephone?: string;
};

export async function creerPropriete(l: NouveauLogement): Promise<{ id: string; titre: string }> {
  const r = await appel('POST', '/properties', {
    property: {
      title: l.titre,
      currency: 'EUR',
      country: 'FR',
      city: l.ville,
      address: l.adresse || l.ville,
      zip_code: l.codePostal || '00000',
      email: l.email || 'contact@labelmaisonconciergerie.fr',
      phone: l.telephone || '+33600000000',
      timezone: 'Europe/Paris',
      property_type: 'apartment',
      group_id: l.groupId,
    },
  });
  return { id: r.data.id, titre: r.data.attributes.title };
}

export async function listerProprietes(groupId?: string): Promise<Array<{ id: string; titre: string }>> {
  const r = await appel('GET', '/properties');
  return (r.data ?? [])
    .filter((p: any) => !groupId || p.relationships?.group?.data?.id === groupId)
    .map((p: any) => ({ id: p.id, titre: p.attributes.title }));
}

// --- Connexion des OTA ---

/**
 * Jeton d'accès unique, valable 15 minutes. Une fois l'écran chargé par la
 * cliente, la session n'expire plus — mais si elle clique deux jours plus tard,
 * le lien est mort et il faut en régénérer un. C'est le piège numéro un de
 * l'onboarding.
 */
export async function jetonUnique(proprieteId: string, groupId: string, utilisateur: string): Promise<string> {
  const r = await appel('POST', '/auth/one_time_token', {
    property_id: proprieteId,
    group_id: groupId,
    username: utilisateur,
  });
  return r.data.token;
}

/**
 * Construit le lien que le bot envoie dans la conversation. La cliente clique
 * depuis son téléphone, arrive déjà authentifiée chez Channex — sans compte
 * Channex — sur l'écran de connexion du canal demandé, et autorise avec SES
 * identifiants Airbnb ou Booking.
 */
export async function lienConnexion(
  proprieteId: string,
  groupId: string,
  canal: string,
  utilisateur: string,
): Promise<string> {
  const jeton = await jetonUnique(proprieteId, groupId, utilisateur);
  // `redirect_to` doit rester une barre oblique littérale : URLSearchParams
  // l'encoderait en %2F, que Channex n'interprète pas comme un chemin.
  return (
    `${BASE}/auth/exchange` +
    `?oauth_session_key=${encodeURIComponent(jeton)}` +
    `&app_mode=headless` +
    `&redirect_to=/channels` +
    `&property_id=${encodeURIComponent(proprieteId)}` +
    `&channels=${encodeURIComponent(canal)}`
  );
}

/** Canaux montés sur une propriété — sert à vérifier qu'une connexion a abouti. */
export async function listerCanaux(
  proprieteId: string,
): Promise<Array<{ id: string; canal: string; titre: string; actif: boolean }>> {
  const r = await appel('GET', '/channels');
  return (r.data ?? [])
    .filter((c: any) => c.attributes?.property_id === proprieteId)
    .map((c: any) => ({
      id: c.id,
      canal: c.attributes.channel,
      titre: c.attributes.title,
      actif: c.attributes.is_active !== false,
    }));
}
