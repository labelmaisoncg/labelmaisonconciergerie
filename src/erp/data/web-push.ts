/**
 * Envoi d'une notification Web Push, sans dépendance (Web Crypto, disponible
 * dans Node comme dans le navigateur) :
 *   - chiffrement du contenu : RFC 8291 (« aes128gcm », RFC 8188) ;
 *   - identification du serveur : VAPID, RFC 8292 (jeton ES256).
 *
 * Les clés ont le format de la bibliothèque web-push (base64url) : clé
 * publique non compressée de 65 octets, clé privée brute de 32 octets.
 * Vérifié contre l'exemple de la RFC 8291 (verifier-notifications.ts).
 *
 * Utilisé côté serveur (api/_erp-notifications.ts) ; le navigateur n'en
 * importe que `endpointAccepte` et les conversions base64url.
 */

export interface ClesVapid {
  /** Clé publique (base64url, 65 octets), donnée aux navigateurs. */
  publique: string;
  /** Clé privée (base64url, 32 octets) : variable Vercel, jamais ailleurs. */
  privee: string;
  /** Contact du serveur (mailto: ou https:), exigé par les services. */
  sujet: string;
}

export interface AbonnementPush {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/* ------------------------------------------------------------ base64url */

export function b64url(octets: Uint8Array): string {
  let bin = '';
  for (const o of octets) bin += String.fromCharCode(o);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function deB64url(texte: string): Uint8Array {
  const s = String(texte ?? '').replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return new Uint8Array(0);
  try {
    const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return new Uint8Array(0);
  }
}

const texte = (s: string) => new TextEncoder().encode(s);

function concat(...parties: Uint8Array[]): Uint8Array {
  const r = new Uint8Array(parties.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parties) {
    r.set(p, i);
    i += p.length;
  }
  return r;
}

const tampon = (o: Uint8Array) => o as unknown as BufferSource;

/** Web Crypto (global dans Node 19+ et les navigateurs ; module node:crypto sinon). */
async function subtil(): Promise<SubtleCrypto> {
  const g = (globalThis as { crypto?: Crypto }).crypto;
  if (g?.subtle) return g.subtle;
  const m = (await import('node:crypto' as string)) as { webcrypto: Crypto };
  return m.webcrypto.subtle;
}

/** Empreinte SHA-256 en hexadécimal. */
export async function empreinte(valeur: string): Promise<string> {
  const h = new Uint8Array(await (await subtil()).digest('SHA-256', tampon(texte(valeur))));
  return [...h].map((o) => o.toString(16).padStart(2, '0')).join('');
}

/* ----------------------------------------------------------------- VAPID */

const P256 = { name: 'ECDSA', namedCurve: 'P-256' } as const;

/** JWK d'une clé privée P-256 à partir de sa clé publique non compressée. */
function jwkPrive(publique: Uint8Array, privee: Uint8Array): JsonWebKey {
  return { kty: 'EC', crv: 'P-256', d: b64url(privee), x: b64url(publique.slice(1, 33)), y: b64url(publique.slice(33, 65)), ext: true };
}

/** Nouvelle paire de clés VAPID (bouton du gérant ; jamais journalisée). */
export async function genererClesVapid(): Promise<{ publique: string; privee: string }> {
  const s = await subtil();
  const paire = (await s.generateKey(P256, true, ['sign', 'verify'])) as CryptoKeyPair;
  const publique = new Uint8Array(await s.exportKey('raw', paire.publicKey));
  const jwk = await s.exportKey('jwk', paire.privateKey);
  return { publique: b64url(publique), privee: jwk.d ?? '' };
}

/** Les clés ont-elles le bon format (65 et 32 octets) ? */
export function clesValides(c: { publique: string; privee: string }): boolean {
  const pub = deB64url(c.publique);
  return pub.length === 65 && pub[0] === 4 && deB64url(c.privee).length === 32;
}

/** En-tête Authorization VAPID pour un service de notifications (origine de l'endpoint). */
export async function enteteVapid(endpoint: string, cles: ClesVapid, maintenantS = Math.floor(Date.now() / 1000)): Promise<string> {
  if (!clesValides(cles)) throw new Error('Clés de notification invalides (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).');
  const s = await subtil();
  const cle = await s.importKey('jwk', jwkPrive(deB64url(cles.publique), deB64url(cles.privee)), P256, false, ['sign']);
  const aud = new URL(endpoint).origin;
  const entete = b64url(texte(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const charge = b64url(texte(JSON.stringify({ aud, exp: maintenantS + 12 * 3600, sub: cles.sujet })));
  // Web Crypto signe au format r || s (64 octets), celui qu'attend JWS.
  const signature = new Uint8Array(await s.sign({ name: 'ECDSA', hash: 'SHA-256' }, cle, tampon(texte(`${entete}.${charge}`))));
  return `vapid t=${entete}.${charge}.${b64url(signature)}, k=${cles.publique}`;
}

/* ----------------------------------------------------------- chiffrement */

async function hkdf(ikm: Uint8Array, sel: Uint8Array, info: Uint8Array, longueur: number): Promise<Uint8Array> {
  const s = await subtil();
  const cle = await s.importKey('raw', tampon(ikm), 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await s.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: tampon(sel), info: tampon(info) }, cle, longueur * 8));
}

/**
 * Chiffre un contenu pour un abonnement (RFC 8291). `ephemere` et `sel` ne
 * servent qu'aux tests (exemple de la RFC) ; en vrai ils sont tirés au hasard.
 */
export async function chiffrer(
  contenu: Uint8Array,
  abonnement: AbonnementPush,
  ephemere?: { publique: Uint8Array; privee: Uint8Array },
  sel?: Uint8Array,
): Promise<Uint8Array> {
  const s = await subtil();
  const uaPublic = deB64url(abonnement.keys.p256dh);
  const auth = deB64url(abonnement.keys.auth);
  if (uaPublic.length !== 65 || auth.length < 16) throw new Error('Abonnement illisible (clés du navigateur).');
  const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;
  const cleUa = await s.importKey('raw', tampon(uaPublic), ECDH, false, []);
  let privee: CryptoKey;
  let asPublic: Uint8Array;
  if (ephemere) {
    privee = await s.importKey('jwk', jwkPrive(ephemere.publique, ephemere.privee), ECDH, false, ['deriveBits']);
    asPublic = ephemere.publique;
  } else {
    const paire = (await s.generateKey(ECDH, true, ['deriveBits'])) as CryptoKeyPair;
    privee = paire.privateKey;
    asPublic = new Uint8Array(await s.exportKey('raw', paire.publicKey));
  }
  const secret = new Uint8Array(await s.deriveBits({ name: 'ECDH', public: cleUa }, privee, 256));
  const ikm = await hkdf(secret, auth, concat(texte('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = sel ?? (globalThis.crypto?.getRandomValues ? globalThis.crypto.getRandomValues(new Uint8Array(16)) : await aleatoire(16));
  const cek = await hkdf(ikm, salt, texte('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, salt, texte('Content-Encoding: nonce\0'), 12);
  const cleAes = await s.importKey('raw', tampon(cek), 'AES-GCM', false, ['encrypt']);
  // Un seul enregistrement : le contenu suivi du délimiteur de fin (0x02) ; Web Crypto ajoute l'étiquette.
  const corps = new Uint8Array(await s.encrypt({ name: 'AES-GCM', iv: tampon(nonce) }, cleAes, tampon(concat(contenu, Uint8Array.of(2)))));
  const taille = new Uint8Array(4);
  new DataView(taille.buffer).setUint32(0, 4096);
  return concat(salt, taille, Uint8Array.of(asPublic.length), asPublic, corps);
}

async function aleatoire(n: number): Promise<Uint8Array> {
  const m = (await import('node:crypto' as string)) as { randomBytes: (n: number) => Uint8Array };
  return new Uint8Array(m.randomBytes(n));
}

/* ------------------------------------------------------------------ envoi */

export interface ResultatEnvoi {
  ok: boolean;
  statut: number;
  /** Abonnement disparu (404/410) : à oublier. */
  expire: boolean;
}

/** Envoie une notification (contenu JSON) à un abonnement. Ne lève jamais. */
export async function envoyerPush(
  abonnement: AbonnementPush,
  contenu: unknown,
  cles: ClesVapid,
  o: { ttl?: number; urgente?: boolean; fetch?: typeof fetch; delaiMs?: number } = {},
): Promise<ResultatEnvoi> {
  try {
    const corps = await chiffrer(texte(JSON.stringify(contenu)), abonnement);
    const f = o.fetch ?? fetch;
    const controle = new AbortController();
    const minuteur = setTimeout(() => controle.abort(), o.delaiMs ?? 6_000);
    try {
      const r = await f(abonnement.endpoint, {
        method: 'POST',
        headers: {
          Authorization: await enteteVapid(abonnement.endpoint, cles),
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          TTL: String(o.ttl ?? 24 * 3600),
          Urgency: o.urgente ? 'high' : 'normal',
        },
        body: tampon(corps),
        signal: controle.signal,
      });
      return { ok: r.status >= 200 && r.status < 300, statut: r.status, expire: r.status === 404 || r.status === 410 };
    } finally {
      clearTimeout(minuteur);
    }
  } catch {
    return { ok: false, statut: 0, expire: false };
  }
}

/** Services de notifications connus (pas d'envoi vers une adresse quelconque). */
export function endpointAccepte(endpoint: string): boolean {
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.port) return false;
  const h = u.hostname.toLowerCase();
  return (
    h === 'fcm.googleapis.com' ||
    h === 'updates.push.services.mozilla.com' ||
    h === 'web.push.apple.com' ||
    h.endsWith('.push.apple.com') ||
    h.endsWith('.notify.windows.com') ||
    h.endsWith('.push.services.mozilla.com')
  );
}
