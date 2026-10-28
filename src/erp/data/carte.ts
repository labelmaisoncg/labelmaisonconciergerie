/**
 * Carte des logements (octobre 2026) : où sont les logements gérés et ce qui
 * s'y passe aujourd'hui, d'un coup d'œil. Pur (ni réseau ni écran), partagé
 * par l'accueil du gérant, le serveur des espaces propriétaire et opérations
 * (api/espace-proprietaire.ts, api/espace-operations.ts) et leurs démos ;
 * vérifié par verifier-carte.ts.
 *
 * État du jour d'un logement, une seule couleur à la fois (couleurs choisies
 * par le gérant : le rouge veut dire « réservé », jamais « problème ») :
 * - « Ménage » (orange) : le ménage du jour n'est pas fini. En cours, même
 *   en milieu de séjour (« le ménage est en train d'être fait ») ; ou à
 *   faire alors que personne n'est dans les lieux (départ du jour, logement
 *   vide). Un ménage en milieu de séjour pas encore commencé ne compte pas :
 *   le voyageur est là, le logement reste « Réservé ».
 * - « Réservé » (rouge) : quelqu'un dort là ce soir (séjour en cours, ou
 *   arrivée du jour).
 * - « Libre » (vert) : personne ce soir, rien en attente.
 * Ordre : le ménage l'emporte sur la réservation. Jour de rotation (départ et
 * arrivée le même jour) : « Ménage » jusqu'à ce que le ménage soit fait, puis
 * « Réservé » ; départ seul : « Ménage », puis « Libre ».
 *
 * Ménage du jour :
 * - la mission de ménage d'un prestataire datée d'aujourd'hui. Fait : « à
 *   valider » ou « validée » (le prestataire a fini) ; refusée : à refaire ;
 * - sans mission, le départ du jour (ménage hors de l'ERP) : « ménage prévu
 *   aujourd'hui », orange jusqu'à ce que le contrôle qualité de ce départ
 *   soit fait ; rien si la mission de ce séjour est prévue un autre jour ;
 * - un ménage interne (prévu par Claude, jamais confié ni payé) ne compte
 *   que s'il n'y a pas de mission de prestataire ce jour-là. Il suit alors
 *   la règle du départ sans mission : orange jusqu'au contrôle qualité fait,
 *   ou jusqu'à ce que l'équipe le marque « Fait » (validée, menages/Detail).
 *
 * « Problème » : un incident ouvert (pas réglé) sur le logement, urgent ou
 * non. Il s'ajoute à la couleur (un « ! » sur le point), sans la cacher.
 * Chaque espace ne passe que les incidents qu'il voit déjà.
 *
 * Positions (Logement.position) : seulement si elle correspond à l'adresse
 * actuelle ; une adresse changée depuis rend le logement « à placer ». Les
 * espaces propriétaire et opérations ne reçoivent que lat, lng et précision,
 * pour les logements qu'ils voient déjà ; ils ne géocodent jamais.
 *
 * Géocodage (gérant seulement, data/geocodage.ts) : le texte de l'adresse
 * seul (rue, code postal, commune) part au géocodeur public de l'IGN
 * (Géoplateforme) ; jamais un nom. Un résultat n'est gardé qu'avec un bon
 * score (SEUIL_SCORE) et le même code postal (sans code postal : le même
 * nom exact de commune) ; sinon le centre de la commune, montré comme
 * approximatif ;
 * sinon rien.
 *
 * Imports en « .js » : ce module tourne aussi sous Node (fonctions Vercel).
 */
import { ajouterJours, estUrgent, trierIncidents } from './operations.js';
import type { CategorieIncident, DateISO, Horodatage, Id, Incident, Logement, Mission, PositionLogement, Reservation } from './types';
import type { ControleQualite } from './types-operations';

/* ------------------------------------------------------------------ états */

export type EtatCarte = 'reserve' | 'libre' | 'menage';
export type StatutMenageCarte = 'a_faire' | 'en_cours' | 'fait';

/** Ordre des états dans la légende et la liste : ce qui demande une action d'abord. */
export const ETATS_CARTE: readonly EtatCarte[] = ['menage', 'reserve', 'libre'];

/** Mot de chaque état (légende, pastille, liste). */
export const LIBELLES_ETAT: Record<EtatCarte, { un: string; plusieurs: string }> = {
  reserve: { un: 'réservé', plusieurs: 'réservés' },
  libre: { un: 'libre', plusieurs: 'libres' },
  menage: { un: 'ménage', plusieurs: 'ménages' },
};

/** Ce que la carte sait d'un logement aujourd'hui (avant réduction pour un espace). */
export interface EtatDuJour {
  logementId: Id;
  etat: EtatCarte;
  /** Séjour de ce soir : en cours, ou qui arrive aujourd'hui. */
  ceSoir?: Reservation;
  /** Séjour qui part aujourd'hui. */
  depart?: Reservation;
  menage?: { statut: StatutMenageCarte; mission?: Mission };
  /** Incidents ouverts, urgents d'abord. */
  problemes: Incident[];
  /** Prochaine arrivée après aujourd'hui (logement libre ce soir). */
  prochaineArrivee?: DateISO;
}

/** Ce qu'il faut pour calculer l'état du jour (chaque espace passe ce qu'il voit). */
export interface EntreesCarte {
  reservations: readonly Reservation[];
  missions?: readonly Mission[];
  incidents?: readonly Incident[];
  controles?: readonly ControleQualite[];
}

const RANG_MENAGE: Record<StatutMenageCarte, number> = { en_cours: 0, a_faire: 1, fait: 2 };

/** Statut de ménage d'une mission : fini quand le prestataire a terminé (à valider ou validée). */
export function statutMenage(m: Pick<Mission, 'statut'>): StatutMenageCarte {
  if (m.statut === 'en_cours') return 'en_cours';
  if (m.statut === 'a_valider' || m.statut === 'validee') return 'fait';
  return 'a_faire';
}

const estMenage = (m: Mission | undefined): m is Mission => !!m && m.type === 'menage' && m.statut !== 'annulee';
const valide = (r: Reservation | undefined): r is Reservation =>
  !!r && r.statut !== 'annulee' && typeof r.arrivee === 'string' && typeof r.depart === 'string' && r.arrivee < r.depart;

/**
 * État du jour d'un logement (voir l'en-tête : ménage, puis réservé, puis
 * libre ; problème en plus).
 */
export function etatDuJour(logementId: Id, e: EntreesCarte, date: DateISO): EtatDuJour {
  const sejours = e.reservations.filter((r) => valide(r) && r.logementId === logementId);
  const ceSoir = sejours.filter((r) => r.arrivee <= date && date < r.depart).sort((a, b) => b.arrivee.localeCompare(a.arrivee))[0];
  const depart = sejours.find((r) => r.depart === date);
  // Quelqu'un dort là avant et après aujourd'hui : ménage en milieu de séjour.
  const present = !!ceSoir && ceSoir.arrivee < date;

  const missions = (e.missions ?? []).filter((m) => estMenage(m) && m.logementId === logementId);
  // Contrôle qualité fait : pour ce séjour, ou ce jour-là dans ce logement.
  const controleFait = (reservationId?: Id) =>
    (e.controles ?? []).some(
      (c) => c?.logementId === logementId && c.statut === 'fait' && ((!!reservationId && c.reservationId === reservationId) || String(c.realiseLe ?? '').slice(0, 10) === date),
    );
  const duJour = missions.filter((m) => m.date === date);
  // Un ménage interne s'efface devant celui d'un prestataire le même jour.
  const prestataires = duJour.filter((m) => m.interne !== true);
  const retenues = (prestataires.length ? prestataires : duJour).sort((a, b) => RANG_MENAGE[statutMenage(a)] - RANG_MENAGE[statutMenage(b)]);
  let menage: EtatDuJour['menage'];
  if (retenues.length) {
    const m = retenues[0];
    const statut = statutMenage(m);
    // Ménage interne pas encore marqué « Fait » : comme un départ sans mission, fait au contrôle qualité.
    menage = { statut: m.interne === true && statut !== 'fait' && controleFait(m.reservationId ?? depart?.id) ? 'fait' : statut, mission: m };
  } else if (depart && !missions.some((m) => m.reservationId === depart.id)) {
    // Ménage hors de l'ERP : fait quand le contrôle qualité de ce départ est fait.
    menage = { statut: controleFait(depart.id) ? 'fait' : 'a_faire' };
  }

  const enAttente = menage && (menage.statut === 'en_cours' || (menage.statut === 'a_faire' && !present));
  const etat: EtatCarte = enAttente ? 'menage' : ceSoir ? 'reserve' : 'libre';
  const problemes = trierIncidents((e.incidents ?? []).filter((i) => i?.logementId === logementId && i.statut !== 'resolu'));
  const prochaineArrivee = ceSoir ? undefined : sejours.filter((r) => r.arrivee > date).sort((a, b) => a.arrivee.localeCompare(b.arrivee))[0]?.arrivee;
  return {
    logementId,
    etat,
    ...(ceSoir ? { ceSoir } : {}),
    ...(depart ? { depart } : {}),
    ...(menage ? { menage } : {}),
    problemes,
    ...(prochaineArrivee ? { prochaineArrivee } : {}),
  };
}

/* ------------------------------------------------------------- positions */

export type PrecisionPosition = PositionLogement['precision'];
/** Position telle que l'écran la reçoit : ni le texte géocodé, ni la source. */
export interface PositionVue {
  lat: number;
  lng: number;
  precision: PrecisionPosition;
}

const espaces = (t: unknown) => String(t ?? '').replace(/\s+/g, ' ').trim();

/** Texte de l'adresse tel qu'il est géocodé : « 12 quai des Tanneurs 91100 Corbeil-Essonnes ». */
export function texteAdresse(l: Pick<Logement, 'adresse' | 'codePostal' | 'ville'>): string {
  return [espaces(l.adresse), espaces(l.codePostal), espaces(l.ville)].filter(Boolean).join(' ');
}

/** Coordonnées plausibles (nombres finis, dans les bornes du globe, pas le point 0,0). */
export function coordonneesValides(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

/** La position enregistrée correspond-elle à l'adresse actuelle ? (sinon : à placer de nouveau) */
export function positionAJour(l: Pick<Logement, 'adresse' | 'codePostal' | 'ville' | 'position'>): boolean {
  const p = l.position;
  return !!p && coordonneesValides(p.lat, p.lng) && (p.precision === 'adresse' || p.precision === 'commune') && espaces(p.adresse).toLowerCase() === texteAdresse(l).toLowerCase();
}

/** Position montrée (à jour seulement), réduite à lat, lng et précision. */
export function positionVue(l: Pick<Logement, 'adresse' | 'codePostal' | 'ville' | 'position'>): PositionVue | undefined {
  if (!positionAJour(l)) return undefined;
  const p = l.position!;
  return { lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6, precision: p.precision };
}

/** Logements gérés à placer (gérant) : jamais placés, ou dont l'adresse a changé ; adresse connue. */
export function logementsAPlacer<L extends Pick<Logement, 'statut' | 'adresse' | 'codePostal' | 'ville' | 'position'>>(logements: readonly L[]): L[] {
  return logements.filter((l) => l && l.statut !== 'sorti' && !positionAJour(l) && !!requeteCommune(l));
}

/* ------------------------------------------------------------- géocodage */

/** Score minimal d'un résultat du géocodeur (0 à 1). */
export const SEUIL_SCORE = 0.8;
export const SOURCE_GEOPLATEFORME = 'geoplateforme';
export const URL_GEOCODEUR = 'https://data.geopf.fr/geocodage/search';

/** Requête « adresse » : rue, code postal, commune ; null sans rue ni commune. */
export function requeteAdresse(l: Pick<Logement, 'adresse' | 'codePostal' | 'ville'>): string | null {
  if (!espaces(l.adresse) || !(espaces(l.codePostal) || espaces(l.ville))) return null;
  return texteAdresse(l).slice(0, 200);
}

/** Requête « commune » : code postal et commune ; null sans commune ni code postal. */
export function requeteCommune(l: Pick<Logement, 'codePostal' | 'ville'>): string | null {
  const t = [espaces(l.codePostal), espaces(l.ville)].filter(Boolean).join(' ');
  return t ? t.slice(0, 120) : null;
}

/** Adresse de la requête : seulement le texte de l'adresse, rien d'autre. */
export function urlGeocodage(q: string, type: 'adresse' | 'commune'): string {
  const p = new URLSearchParams({ q, limit: '1' });
  if (type === 'commune') p.set('type', 'municipality');
  return `${URL_GEOCODEUR}?${p}`;
}

/** « Évry-Courcouronnes » ≈ « evry courcouronnes » ; « St » = « Saint ». */
export function nomCommune(t: unknown): string {
  return String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bste\b/g, 'sainte')
    .replace(/\bst\b/g, 'saint')
    .trim();
}

/** Types de résultat assez précis pour « adresse » : numéro, rue, lieu-dit. */
const TYPES_ADRESSE = new Set(['housenumber', 'street', 'locality']);

/**
 * Lit la réponse du géocodeur (GeoJSON) : la position, si le premier
 * résultat a un bon score et tombe dans le même code postal (la même commune
 * quand le code postal n'est pas connu). null sinon.
 */
export function lirePosition(
  reponse: unknown,
  attendu: Pick<Logement, 'codePostal' | 'ville'>,
  type: 'adresse' | 'commune',
): { lat: number; lng: number } | null {
  const f = (reponse as { features?: unknown } | null)?.features;
  const premier = Array.isArray(f) ? (f[0] as { geometry?: { type?: unknown; coordinates?: unknown }; properties?: Record<string, unknown> } | undefined) : undefined;
  if (!premier || premier.geometry?.type !== 'Point' || !Array.isArray(premier.geometry.coordinates)) return null;
  const [lng, lat] = premier.geometry.coordinates as unknown[];
  if (!coordonneesValides(lat, lng)) return null;
  const pr = premier.properties ?? {};
  const score = typeof pr.score === 'number' ? pr.score : 0;
  if (!(score >= SEUIL_SCORE)) return null;
  const genre = String(pr.type ?? '');
  if (type === 'adresse' ? !TYPES_ADRESSE.has(genre) : genre !== 'municipality') return null;
  const cp = espaces(attendu.codePostal);
  if (cp) {
    if (String(pr.postcode ?? '') !== cp) return null;
  } else {
    // Sans code postal : le nom exact de la commune (« Saint » n'est pas Saint-Michel-sur-Orge).
    const voulu = nomCommune(attendu.ville);
    const villes = [pr.city, pr.municipality, pr.name].map(nomCommune);
    if (!voulu || !villes.includes(voulu)) return null;
  }
  return { lat: lat as number, lng: lng as number };
}

/** Position à enregistrer sur le logement. */
export function nouvellePosition(l: Pick<Logement, 'adresse' | 'codePostal' | 'ville'>, c: { lat: number; lng: number }, precision: PrecisionPosition, source: string, le: Horodatage): PositionLogement {
  return { lat: c.lat, lng: c.lng, precision, source, adresse: texteAdresse(l), le };
}

/* ------------------------------------------------------- vue d'un espace */

/** Un logement sur la carte, tel que l'écran le reçoit (déjà réduit à ce que l'espace voit). */
export interface PointCarte {
  id: Id;
  nom: string;
  ville: string;
  /** Photo de couverture (adresse affichable, ou fichier de l'équipe pour le gérant). */
  photo?: string;
  position?: PositionVue;
  etat: EtatCarte;
  /** Voyageur de ce soir : « Prénom N. » (absent : pas à montrer), arrivée et départ. */
  sejour?: { voyageur?: string; arrivee: DateISO; depart: DateISO };
  /** Voyageur qui part aujourd'hui. */
  depart?: { voyageur?: string };
  /** Ménage du jour : statut, heure prévue, qui (gérant seulement). */
  /**
   * Ménage du jour : statut, heure prévue, qui (gérant seulement). Gérant
   * seulement aussi : `interne` (prévu par Claude, personne n'est prévenu) et
   * l'id de la mission, pour le marquer « Fait ».
   */
  menage?: { statut: StatutMenageCarte; heure?: string; par?: string; interne?: true; missionId?: Id };
  /** Incidents ouverts : titre court, urgent, id (pour l'ouvrir, quand l'espace le peut). */
  problemes: { titre: string; urgent: boolean; id?: Id }[];
  prochaineArrivee?: DateISO;
  /** Ligne de plus (gérant) : « En préparation », « En pause ». */
  note?: string;
}

/** Ce que l'espace ajoute à un logement qu'il voit déjà : sa position et son état du jour. */
export type JourCarte = Omit<PointCarte, 'id' | 'nom' | 'ville' | 'photo' | 'note'>;

/** Ce qu'un espace montre d'un séjour, d'un ménage et d'un incident. */
export interface VarianteCarte {
  /** « Prénom N. » du voyageur ; undefined : rien (séjour qui n'est pas à lui). */
  voyageur: (r: Reservation) => string | undefined;
  /** Titre de l'incident. */
  probleme: (i: Incident) => string;
  /** L'incident s'ouvre depuis la carte (id transmis). */
  lienProbleme: boolean;
  /** Qui fait le ménage (gérant seulement). */
  menagePar?: (m: Mission) => string | undefined;
  /** Ménage interne signalé, avec l'id de sa mission (gérant seulement : il le marque « Fait »). */
  menageInterne?: boolean;
}

/** Titre court d'un incident : sa description, une ligne. */
export function titreIncident(i: Pick<Incident, 'description' | 'categorie'>, max = 90): string {
  const t = espaces(i.description).replace(/^Contrôle qualité : /, '');
  if (!t) return TITRES_PROPRIETAIRE[i.categorie] ?? 'Problème signalé';
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/**
 * Titre d'un incident pour le propriétaire : la nature seulement, jamais la
 * description (elle peut contenir les notes de l'équipe ou parler d'un
 * voyageur). Les incidents « voyageur » ne lui sont pas montrés
 * (vueProprietaire) : ce titre ne sert qu'à garder la liste complète.
 */
export const TITRES_PROPRIETAIRE: Record<CategorieIncident, string> = {
  menage: 'Ménage à reprendre',
  linge: 'Linge à revoir',
  casse: 'Casse à réparer',
  panne: 'Panne à réparer',
  acces: 'Accès au logement',
  voyageur: 'Suivi d’un séjour',
  autre: 'Point à vérifier',
};

/** Position et état du jour d'un logement, réduits à ce que l'espace montre. */
export function jourCarte(l: Pick<Logement, 'adresse' | 'codePostal' | 'ville' | 'position'>, x: EtatDuJour, v: VarianteCarte): JourCarte {
  const position = positionVue(l);
  const voyageurDe = (r: Reservation) => {
    const n = v.voyageur(r);
    return n ? { voyageur: n } : {};
  };
  const m = x.menage;
  const heure = m?.mission?.heureDebut && /^\d{1,2}:\d{2}$/.test(m.mission.heureDebut) ? m.mission.heureDebut : undefined;
  const par = m?.mission && v.menagePar ? v.menagePar(m.mission) : undefined;
  return {
    ...(position ? { position } : {}),
    etat: x.etat,
    ...(x.ceSoir ? { sejour: { ...voyageurDe(x.ceSoir), arrivee: x.ceSoir.arrivee, depart: x.ceSoir.depart } } : {}),
    ...(x.depart ? { depart: voyageurDe(x.depart) } : {}),
    ...(m
      ? {
          menage: {
            statut: m.statut,
            ...(heure ? { heure } : {}),
            ...(par ? { par } : {}),
            ...(v.menageInterne && m.mission?.interne === true ? { interne: true as const, missionId: m.mission.id } : {}),
          },
        }
      : {}),
    problemes: x.problemes.map((i) => ({ titre: v.probleme(i), urgent: estUrgent(i), ...(v.lienProbleme ? { id: i.id } : {}) })),
    ...(x.prochaineArrivee ? { prochaineArrivee: x.prochaineArrivee } : {}),
  };
}

/* ------------------------------------------------------------- comptes */

export interface ComptesCarte {
  reserve: number;
  libre: number;
  menage: number;
  probleme: number;
  /** Ménages dans un logement où quelqu'un dort ce soir : réservés + ceux-là = logements occupés ce soir. */
  menageOccupe: number;
}

/** Comptes de la légende : un logement par état, et ceux qui ont un problème (en plus). */
export function compterCarte(points: readonly Pick<PointCarte, 'etat' | 'problemes' | 'sejour'>[]): ComptesCarte {
  const c: ComptesCarte = { reserve: 0, libre: 0, menage: 0, probleme: 0, menageOccupe: 0 };
  for (const p of points) {
    c[p.etat]++;
    if (p.problemes.length) c.probleme++;
    if (p.etat === 'menage' && p.sejour) c.menageOccupe++;
  }
  return c;
}

/** Filtre de la légende : un état, ou « problème ». */
export type FiltreCarte = EtatCarte | 'probleme';
export const garderPoint = (p: Pick<PointCarte, 'etat' | 'problemes'>, f: FiltreCarte | null): boolean =>
  !f || (f === 'probleme' ? p.problemes.length > 0 : p.etat === f);

/** Ordre de la liste : problème d'abord, puis ménage, réservé, libre, puis le nom. */
export function trierPoints<P extends Pick<PointCarte, 'etat' | 'problemes' | 'nom'>>(points: readonly P[]): P[] {
  const rang = (p: P) => (p.problemes.length ? 0 : 1) * 10 + ETATS_CARTE.indexOf(p.etat);
  return points.slice().sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, 'fr'));
}

/** Jour suivant (pour « part demain »). */
export const lendemain = (d: DateISO) => ajouterJours(d, 1);
