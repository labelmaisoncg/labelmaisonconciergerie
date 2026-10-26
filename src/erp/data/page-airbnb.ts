/**
 * Page publique d'une annonce Airbnb (https://www.airbnb.fr/rooms/<id>) :
 * ses photos et quelques faits (voyageurs, chambres, lits, salles de bain,
 * couchage), quand le service de connexion n'en transmet aucun. Lecture
 * seule d'une page ouverte à tous : aucun cookie, aucun compte, rien
 * n'est jamais envoyé à Airbnb.
 *
 * Les photos du logement sont les adresses
 *   https://a0.muscache.com/im/pictures/<dossier>/Hosting-<clé>/original/<fichier>
 * où <clé> est l'id de l'annonce, en clair (anciennes annonces) ou en base64
 * de « StaySupplyListing:<id> ». La page contient aussi d'autres images
 * d'Airbnb (icônes, photos de profil, autres logements) : elles sont écartées.
 *
 * Ce module ne doit importer que des types et des constantes (il tourne côté
 * serveur, hors de Vite).
 */
import { MAX_PHOTOS } from './repull.js';

type Fetch = typeof fetch;

/** Id d'annonce Airbnb accepté : des chiffres seulement. */
export const idAirbnbValide = (id: string): boolean => /^\d{1,20}$/.test(id);

const echapperRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Les écritures possibles de la clé « Hosting-… » d'une annonce dans une adresse de photo. */
function clesHosting(id: string): string[] {
  const b64 = btoa(`StaySupplyListing:${id}`);
  const urlSure = b64.replace(/\+/g, '-').replace(/\//g, '_');
  const variantes = new Set<string>([id]);
  for (const v of [b64, urlSure]) {
    variantes.add(v);
    variantes.add(v.replace(/=+$/, ''));
    variantes.add(v.replace(/=/g, '%3D'));
  }
  return [...variantes].map((v) => `Hosting-${v}`);
}

/** Taille des photos gardées (largeur en pixels, servie par le CDN d'Airbnb). */
const LARGEUR_PHOTO = 1200;

/**
 * Photos d'une annonce dans le HTML de sa page : seulement celles du logement
 * `idAirbnb`, sans doublon (même fichier en plusieurs tailles), dans l'ordre
 * de la page (la photo de couverture d'abord), 24 au plus, en 1 200 px.
 */
export function photosPageAirbnb(html: string, idAirbnb: string): string[] {
  if (!idAirbnbValide(idAirbnb) || !html) return [];
  const cles = clesHosting(idAirbnb).map(echapperRegex).join('|');
  const re = new RegExp(`https://a\\d*\\.muscache\\.com/im/pictures/((?:[A-Za-z0-9_-]+/)?(?:${cles}))/original/([A-Za-z0-9-]+\\.(?:jpe?g|png|webp))`, 'gi');
  const vus = new Set<string>();
  const photos: string[] = [];
  for (const m of html.matchAll(re)) {
    const fichier = m[2].toLowerCase();
    if (vus.has(fichier)) continue;
    vus.add(fichier);
    photos.push(`https://a0.muscache.com/im/pictures/${m[1]}/original/${m[2]}?im_w=${LARGEUR_PHOTO}`);
    if (photos.length >= MAX_PHOTOS) break;
  }
  return photos;
}

export interface FaitsPageAirbnb {
  /** Titre de partage de la page (og:title). */
  titre?: string;
  voyageurs?: number;
  chambres?: number;
  lits?: number;
  sallesDeBain?: number;
  /** « Où vous dormirez » : pièce par pièce. */
  couchage?: { piece: string; lits: string }[];
}

const decoderHtml = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/ /g, ' ')
    .trim();

const decoderJson = (s: string) => {
  try {
    return JSON.parse(`"${s}"`) as string;
  } catch {
    return s;
  }
};

/** Un nombre devant un mot (« 6 voyageurs », « 1,5 salle de bain »), dans un texte court. */
function compte(textes: string[], mot: RegExp): number | undefined {
  for (const t of textes) {
    const m = new RegExp(`(\\d+(?:[.,]5)?)\\s*${mot.source}`, 'i').exec(t.replace(/ /g, ' '));
    if (m) return Number(m[1].replace(',', '.'));
  }
  return undefined;
}

/**
 * Faits lus dans la page : capacité (`"personCapacity"`), et le résumé
 * « 6 voyageurs · 2 chambres · 3 lits · 1 salle de bain » (bloc « overview »
 * ou og:title) ; couchage pièce par pièce (« Où vous dormirez »).
 */
export function faitsPageAirbnb(html: string): FaitsPageAirbnb {
  const f: FaitsPageAirbnb = {};
  if (!html) return f;
  const og = /<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i.exec(html) ?? /<meta[^>]+content="([^"]*)"[^>]+property="og:title"/i.exec(html);
  if (og) f.titre = decoderHtml(og[1]);
  const resume: string[] = [];
  const items = /"overview":\{[^{}]*?"items":\[((?:"(?:[^"\\]|\\.)*",?)*)\]/.exec(html);
  if (items) for (const m of items[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)) resume.push(decoderJson(m[1]));
  if (f.titre) resume.push(...f.titre.split('·'));
  const capacite = /"personCapacity":(\d+)/.exec(html);
  f.voyageurs = capacite ? Number(capacite[1]) : compte(resume, /voyageurs?\b/);
  f.chambres = compte(resume, /chambres?\b/) ?? (resume.some((t) => /^\s*studio\s*$/i.test(t)) ? 0 : undefined);
  f.lits = compte(resume, /lits?\b/);
  f.sallesDeBain = compte(resume, /salles? de bains?\b/);
  // « Où vous dormirez » : chaque arrêt (pièce) et ses lits.
  const debut = html.indexOf('"sleepingArrangements"');
  const fin = debut >= 0 ? html.indexOf('"name":"Où vous dormirez"', debut) : -1;
  if (debut >= 0 && fin > debut && fin - debut < 200_000) {
    const couchage: { piece: string; lits: string }[] = [];
    for (const arret of html.slice(debut, fin).split('"__typename":"MediaTourStop"').slice(1)) {
      const piece = /"name":"((?:[^"\\]|\\.)*)"/.exec(arret);
      const lits = [...arret.matchAll(/"__typename":"LocalizedText","text":"((?:[^"\\]|\\.)*)"/g)].map((m) => decoderJson(m[1]).trim()).filter(Boolean);
      if (piece && lits.length) couchage.push({ piece: decoderJson(piece[1]).trim(), lits: lits.join(', ') });
      if (couchage.length >= 20) break;
    }
    if (couchage.length) f.couchage = couchage;
  }
  for (const k of Object.keys(f) as (keyof FaitsPageAirbnb)[]) if (f[k] === undefined) delete f[k];
  return f;
}

/** User-Agent d'un navigateur courant : la page n'est servie complète qu'à un navigateur. */
const NAVIGATEUR =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

export type PageAirbnb = { ok: true; html: string } | { ok: false; raison: string };

/**
 * Lit https://www.airbnb.fr/rooms/<id> (id numérique seulement) : 8 s au
 * plus, 3 Mo au plus, sans cookie. Ne lève jamais : une page refusée,
 * absente ou trop lente donne { ok: false }.
 */
export async function lirePageAirbnb(idAirbnb: string, f: Fetch = fetch, o: { delaiMs?: number; maxOctets?: number } = {}): Promise<PageAirbnb> {
  if (!idAirbnbValide(idAirbnb)) return { ok: false, raison: 'identifiant Airbnb invalide' };
  const max = o.maxOctets ?? 3_000_000;
  const arret = new AbortController();
  const minuterie = setTimeout(() => arret.abort(), o.delaiMs ?? 8_000);
  try {
    const r = await f(`https://www.airbnb.fr/rooms/${idAirbnb}`, {
      method: 'GET',
      headers: {
        'User-Agent': NAVIGATEUR,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      credentials: 'omit',
      redirect: 'follow',
      cache: 'no-store',
      signal: arret.signal,
    });
    if (r.status !== 200) return { ok: false, raison: `page refusée (${r.status})` };
    // Lecture plafonnée : au-delà de `max` octets, la suite est ignorée.
    const lecteur = r.body?.getReader();
    if (!lecteur) {
      const t = await r.text();
      return { ok: true, html: t.slice(0, max) };
    }
    const morceaux: Uint8Array[] = [];
    let total = 0;
    while (total < max) {
      const { done, value } = await lecteur.read();
      if (done || !value) break;
      morceaux.push(value);
      total += value.length;
    }
    await lecteur.cancel().catch(() => undefined);
    const tout = new Uint8Array(Math.min(total, max));
    let pos = 0;
    for (const m of morceaux) {
      const part = m.subarray(0, Math.max(0, tout.length - pos));
      tout.set(part, pos);
      pos += part.length;
      if (pos >= tout.length) break;
    }
    return { ok: true, html: new TextDecoder('utf-8').decode(tout) };
  } catch {
    return { ok: false, raison: arret.signal.aborted ? 'délai dépassé' : 'pas de réponse' };
  } finally {
    clearTimeout(minuterie);
  }
}

/** Id Airbnb d'un logement : son canal Airbnb relié, sinon l'adresse de son annonce (…/rooms/<id>). */
export function idAirbnbDuLogement(l: { repull?: { canaux?: { plateforme: string; idExterne: string }[] }; annonces?: { canal: string; url?: string }[] }): string | undefined {
  for (const c of l.repull?.canaux ?? []) {
    const id = String(c.idExterne ?? '').trim();
    if (c.plateforme.toLowerCase().includes('airbnb') && idAirbnbValide(id)) return id;
  }
  for (const a of l.annonces ?? []) {
    const m = a.canal === 'airbnb' ? /airbnb\.[a-z.]+\/rooms\/(\d{1,20})/i.exec(a.url ?? '') : null;
    if (m) return m[1];
  }
  return undefined;
}
