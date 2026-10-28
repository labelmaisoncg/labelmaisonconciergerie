/**
 * Placer un logement sur la carte (gérant, dans l'ERP seulement) : son
 * adresse est envoyée au géocodeur public de l'IGN, la Géoplateforme
 * (data.geopf.fr, gratuit, sans clé). Seul le texte de l'adresse part : rue,
 * code postal, commune ; jamais un nom, un contact ni un identifiant, ni
 * cookie ni référent. Règles d'acceptation : data/carte.ts (lirePosition).
 *
 * Quand : à l'enregistrement de la fiche du logement (adresse changée, ou
 * pas encore placé), ou d'un clic sur « Placer sur la carte » (accueil),
 * un logement après l'autre. Jamais au chargement d'une page.
 *
 * Démo : aucun appel, le centre de la commune (seed-carte.ts).
 */
import { MODE_DEMO } from './config';
import { horodatageMaintenant } from './format';
import { SOURCE_GEOPLATEFORME, lirePosition, nouvellePosition, requeteAdresse, requeteCommune, urlGeocodage } from './carte';
import { geocoderDemo } from './seed-carte';
import type { Logement, PositionLogement } from './types';

export type ResultatGeocodage = { ok: true; position: PositionLogement } | { ok: false; raison: 'introuvable' | 'reseau' };

/** Délai d'une requête au géocodeur. */
const DELAI_MS = 8000;
/** Pause entre deux logements (le service accepte 50 requêtes par seconde : on reste très en dessous). */
export const PAUSE_ENTRE_LOGEMENTS_MS = 250;

type Recherche = (url: string) => Promise<unknown>;

/** Requête au géocodeur : sans cookie, sans référent ; 'reseau' si le service ne répond pas. */
const rechercheWeb: Recherche = async (url) => {
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), DELAI_MS);
  try {
    const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: controle.signal });
    if (!r.ok) return 'reseau';
    return await r.json();
  } catch {
    return 'reseau';
  } finally {
    clearTimeout(minuteur);
  }
};

/**
 * Position d'un logement d'après son adresse : l'adresse exacte si le
 * géocodeur la trouve avec un bon score dans le même code postal, sinon le
 * centre de la commune (approximatif), sinon rien.
 */
export async function geocoderLogement(
  l: Pick<Logement, 'adresse' | 'codePostal' | 'ville'>,
  o: { rechercher?: Recherche; le?: string; demo?: boolean } = {},
): Promise<ResultatGeocodage> {
  const le = o.le ?? horodatageMaintenant();
  if (o.demo ?? MODE_DEMO) {
    const p = geocoderDemo(l, le);
    return p ? { ok: true, position: p } : { ok: false, raison: 'introuvable' };
  }
  const rechercher = o.rechercher ?? rechercheWeb;
  let reseau = false;
  const qAdresse = requeteAdresse(l);
  if (qAdresse) {
    const r = await rechercher(urlGeocodage(qAdresse, 'adresse'));
    if (r === 'reseau') reseau = true;
    const c = r === 'reseau' ? null : lirePosition(r, l, 'adresse');
    if (c) return { ok: true, position: nouvellePosition(l, c, 'adresse', SOURCE_GEOPLATEFORME, le) };
  }
  const qCommune = requeteCommune(l);
  if (qCommune) {
    const r = await rechercher(urlGeocodage(qCommune, 'commune'));
    if (r === 'reseau') reseau = true;
    const c = r === 'reseau' ? null : lirePosition(r, l, 'commune');
    if (c) return { ok: true, position: nouvellePosition(l, c, 'commune', SOURCE_GEOPLATEFORME, le) };
  }
  return { ok: false, raison: reseau ? 'reseau' : 'introuvable' };
}

export const pause = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
