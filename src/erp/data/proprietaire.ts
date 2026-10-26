/**
 * Espace propriétaire : calculs purs, partagés par le serveur
 * (api/espace-proprietaire.ts), l'aperçu du gérant et la démo.
 *
 * Règles :
 * - filtrage strict : seuls les logements dont `proprietaireId` est celui du
 *   propriétaire, seules leurs réservations (jamais celles d'un autre) ;
 * - aucune donnée personnelle de voyageur : « Prénom N. » et le nombre de
 *   personnes, rien d'autre (ni contact, ni pays, ni avis, ni codes d'accès) ;
 * - bilan d'un mois au prorata des nuits : un séjour du 29 août au 3 septembre
 *   compte 3 nuits en août et 2 en septembre, montants partagés de même ;
 * - le propriétaire ne voit que les bilans publiés, tels que publiés.
 *
 * Imports en « .js » : ce module tourne aussi sous Node (fonctions Vercel).
 */
import { espaceOuvert, estLabelMaison } from './espaces.js';
import { ID_PROPRIETAIRE_A_RENSEIGNER } from './repull.js';
import type { CanalReservation, DateISO, Id, Logement, Mandat, Proprietaire, Reservation } from './types';
import type {
  ArriveeVue,
  BilanProprietaire,
  BilanVue,
  CalendrierLogement,
  CategorieDocumentProprietaire,
  ChiffresBilan,
  ChiffresMoisVue,
  ContactsConciergerie,
  DocumentProprietaire,
  DocumentVue,
  JourCalendrier,
  LogementBilan,
  LogementVue,
  SejourBilan,
  TotauxBilan,
  VueProprietaire,
} from './types-proprietaire';

/* --------------------------------------------------------------- repères */

export const CATEGORIES_DOCUMENT: { valeur: CategorieDocumentProprietaire; libelle: string }[] = [
  { valeur: 'contrat', libelle: 'Contrat' },
  { valeur: 'attestation', libelle: 'Attestation' },
  { valeur: 'bilan', libelle: 'Bilan' },
  { valeur: 'facture', libelle: 'Facture' },
  { valeur: 'autre', libelle: 'Autre' },
];

export const LIBELLE_CATEGORIE = Object.fromEntries(CATEGORIES_DOCUMENT.map((c) => [c.valeur, c.libelle])) as Record<CategorieDocumentProprietaire, string>;

/** Contacts publics de la conciergerie (ceux du site). */
export const CONTACTS_LABEL_MAISON: ContactsConciergerie = {
  nom: 'Label Maison Conciergerie',
  email: 'contact@labelmaisoncgexperience.fr',
  telephone: '+33 7 49 54 83 55',
  lienTelephone: 'tel:+33749548355',
  whatsapp: 'https://wa.me/33749548355',
  adresse: '10 chemin des Bas Cornus, 91100 Villabé',
  site: 'labelmaisoncg.fr',
};

/** Prochaines arrivées montrées sur l'accueil. */
export const NB_PROCHAINES_ARRIVEES = 5;

/* ----------------------------------------------------------------- dates */

const MOIS = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const moisValide = (m: unknown): m is string => typeof m === 'string' && MOIS.test(m);
const dateValide = (d: unknown): d is DateISO => typeof d === 'string' && DATE.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`));

export function ajouterJoursISO(d: DateISO, n: number): DateISO {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export function ecartJoursISO(de: DateISO, a: DateISO): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

export const moisDe = (d: DateISO): string => d.slice(0, 7);

export function moisSuivant(m: string): string {
  const [a, mo] = m.split('-').map(Number);
  return mo === 12 ? `${a + 1}-01` : `${a}-${String(mo + 1).padStart(2, '0')}`;
}

export function moisPrecedent(m: string): string {
  const [a, mo] = m.split('-').map(Number);
  return mo === 1 ? `${a - 1}-12` : `${a}-${String(mo - 1).padStart(2, '0')}`;
}

export const joursDuMois = (m: string): number => ecartJoursISO(`${m}-01`, `${moisSuivant(m)}-01`);

/** Date du jour à Paris (« 2026-10-26 »), côté serveur comme navigateur. */
export function dateParisISO(d: Date = new Date()): DateISO {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Les `n` derniers mois terminés, du plus récent au plus ancien (mois que le gérant peut publier). */
export function moisTermines(aujourdhui: DateISO, n = 6): string[] {
  const res: string[] = [];
  let m = moisPrecedent(moisDe(aujourdhui));
  for (let i = 0; i < n; i++, m = moisPrecedent(m)) res.push(m);
  return res;
}

/* -------------------------------------------------------------- voyageurs */

const majuscule = (mot: string) =>
  mot
    .split('-')
    .map((x) => (x ? x[0].toLocaleUpperCase('fr') + x.slice(1).toLocaleLowerCase('fr') : x))
    .join('-');

/**
 * « Camille Martin » → « Camille M. ». Un nom qui ressemble à une adresse
 * e-mail ou à un numéro devient « Voyageur ». Idempotent (« Camille M. »
 * reste « Camille M. »).
 */
export function prenomInitiale(nom: unknown): string {
  const propre = String(nom ?? '').replace(/\s+/g, ' ').trim();
  if (!propre || /[@\d]/.test(propre)) return 'Voyageur';
  const mots = propre.split(' ').filter((m) => /\p{L}/u.test(m));
  if (!mots.length) return 'Voyageur';
  const prenom = majuscule(mots[0].replace(/[^\p{L}'-]/gu, '')).slice(0, 24) || 'Voyageur';
  if (mots.length < 2) return prenom;
  const lettre = mots[mots.length - 1].replace(/[^\p{L}]/gu, '')[0];
  return lettre ? `${prenom} ${lettre.toLocaleUpperCase('fr')}.` : prenom;
}

const CANAUX: CanalReservation[] = ['airbnb', 'booking', 'direct', 'autre'];
const canalPublic = (c: unknown): CanalReservation => (CANAUX.includes(c as CanalReservation) ? (c as CanalReservation) : 'autre');
const entier = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 0);

/* -------------------------------------------------------------- filtrage */

/** Un propriétaire réel (pas la fiche d'attente des logements importés). */
export function proprietaireAutorise(id: unknown): id is Id {
  return typeof id === 'string' && id.trim() !== '' && id !== ID_PROPRIETAIRE_A_RENSEIGNER;
}

/** Logements du propriétaire, et seulement les siens. */
export function logementsDe(logements: readonly Logement[], proprietaireId: Id): Logement[] {
  if (!proprietaireAutorise(proprietaireId)) return [];
  return logements.filter((l) => l?.proprietaireId === proprietaireId);
}

/** Séjours non annulés de ces logements, dates lisibles. */
function sejoursDe(reservations: readonly Reservation[], logementIds: ReadonlySet<Id>): Reservation[] {
  return reservations.filter(
    (r) => r && logementIds.has(r.logementId) && r.statut !== 'annulee' && dateValide(r.arrivee) && dateValide(r.depart) && r.arrivee < r.depart,
  );
}

/** Mandat en vigueur d'un logement : signé d'abord, sinon le plus récent non résilié, sinon le premier. */
export function mandatEnVigueur(mandats: readonly Mandat[], logementId: Id): Mandat | undefined {
  const siens = mandats.filter((m) => m?.logementId === logementId);
  return (
    siens.find((m) => m.statut === 'signe') ??
    siens.filter((m) => m.statut !== 'resilie').sort((a, b) => String(b.dateDebut).localeCompare(String(a.dateDebut)))[0] ??
    siens[0]
  );
}

/** Adresse web affichable telle quelle (https, ou image du site). */
export const adresseWeb = (u: unknown): boolean => typeof u === 'string' && /^(https:\/\/|\/[^/])/.test(u);

/** Photo de couverture : celles de l'équipe d'abord, puis celles des plateformes. */
export function photoCouverture(l: Logement): string | undefined {
  const equipe = (l.photosEquipe ?? []).find(Boolean);
  if (equipe) return equipe;
  if (l.photoUrl?.startsWith('stockage://')) return l.photoUrl;
  const plateforme = (l.photos ?? []).find(adresseWeb);
  if (plateforme) return plateforme;
  return adresseWeb(l.photoUrl) ? l.photoUrl : undefined;
}

/* ----------------------------------------------------------------- bilan */

const totauxVides = (): TotauxBilan => ({ sejours: 0, nuits: 0, encaisse: 0, fraisPlateforme: 0, menage: 0, commission: 0, net: 0 });

function ajouter(t: TotauxBilan, s: SejourBilan) {
  t.sejours += 1;
  t.nuits += s.nuits;
  t.encaisse += s.encaisse;
  t.fraisPlateforme += s.fraisPlateforme;
  t.menage += s.menage;
  t.commission += s.commission;
  t.net += s.net;
}

/** Nuits du séjour comprises entre `debut` (inclus) et `fin` (exclu). */
function nuitsEntre(r: Reservation, debut: DateISO, fin: DateISO): number {
  const de = r.arrivee > debut ? r.arrivee : debut;
  const a = r.depart < fin ? r.depart : fin;
  return Math.max(0, ecartJoursISO(de, a));
}

/**
 * Séjour du mois vu par le propriétaire. Chaque montant est proratisé, puis
 * le net est déduit des autres : les lignes s'additionnent au centime près.
 * Commission Label Maison = (encaissé − frais de plateforme − ménage) × taux du mandat.
 */
export function sejourDuMois(r: Reservation, mandat: Mandat | undefined, mois: string): SejourBilan | null {
  const debut = `${mois}-01`;
  const fin = `${moisSuivant(mois)}-01`;
  const nuits = nuitsEntre(r, debut, fin);
  if (!nuits) return null;
  const nuitsSejour = Math.max(1, ecartJoursISO(r.arrivee, r.depart));
  const brut = entier(r.montantBrutCentimes);
  const plateforme = entier(r.commissionPlateformeCentimes);
  const menage = entier(r.fraisMenageCentimes);
  const pct = typeof mandat?.commissionPct === 'number' && Number.isFinite(mandat.commissionPct) ? mandat.commissionPct : 0;
  const commissionSejour = Math.round(((brut - plateforme - menage) * pct) / 100);
  const part = (m: number) => Math.round((m * nuits) / nuitsSejour);
  const encaisse = part(brut);
  const fraisPlateforme = part(plateforme);
  const menageMois = part(menage);
  const commission = part(commissionSejour);
  return {
    logementId: r.logementId,
    arrivee: r.arrivee,
    depart: r.depart,
    nuits,
    nuitsSejour,
    voyageur: prenomInitiale(r.voyageur?.nom),
    nbPersonnes: Math.max(0, entier(r.voyageur?.nbPersonnes)),
    canal: canalPublic(r.canal),
    encaisse,
    fraisPlateforme,
    menage: menageMois,
    commission,
    net: encaisse - fraisPlateforme - menageMois - commission,
  };
}

/**
 * Bilan locatif d'un mois pour un propriétaire. Logements comptés : ceux
 * encore gérés, plus un logement sorti s'il a eu des nuits dans le mois.
 */
export function bilanMensuel(
  d: { logements: readonly Logement[]; reservations: readonly Reservation[]; mandats: readonly Mandat[] },
  proprietaireId: Id,
  mois: string,
): ChiffresBilan {
  const joursMois = moisValide(mois) ? joursDuMois(mois) : 0;
  const siens = logementsDe(d.logements, proprietaireId);
  const ids = new Set(siens.map((l) => l.id));
  const actifs = moisValide(mois) ? sejoursDe(d.reservations, ids) : [];
  const sejours: SejourBilan[] = [];
  const logements: LogementBilan[] = [];
  for (const l of siens) {
    const mandat = mandatEnVigueur(d.mandats, l.id);
    const lignes = actifs
      .filter((r) => r.logementId === l.id)
      .map((r) => sejourDuMois(r, mandat, mois))
      .filter((s): s is SejourBilan => !!s)
      .sort((a, b) => a.arrivee.localeCompare(b.arrivee));
    if (l.statut === 'sorti' && !lignes.length) continue;
    const t = totauxVides();
    for (const s of lignes) ajouter(t, s);
    sejours.push(...lignes);
    logements.push({
      logementId: l.id,
      nom: l.nom,
      ...t,
      occupation: joursMois ? t.nuits / joursMois : 0,
      ...(mandat ? { commissionPct: mandat.commissionPct } : {}),
    });
  }
  const totaux = totauxVides();
  for (const s of sejours) ajouter(totaux, s);
  sejours.sort((a, b) => a.arrivee.localeCompare(b.arrivee) || a.logementId.localeCompare(b.logementId));
  return {
    mois,
    joursMois,
    logements,
    sejours,
    totaux,
    occupation: joursMois && logements.length ? totaux.nuits / (joursMois * logements.length) : 0,
  };
}

/** Mêmes chiffres (pour signaler au gérant qu'un bilan publié a changé depuis). */
export function memesChiffres(a: ChiffresBilan, b: ChiffresBilan): boolean {
  return JSON.stringify({ t: a.totaux, s: a.sejours, l: a.logements }) === JSON.stringify({ t: b.totaux, s: b.sejours, l: b.logements });
}

/**
 * Chiffres d'un bilan tels qu'envoyés au propriétaire : champs connus
 * seulement, séjours de ses logements seulement, voyageurs anonymisés.
 */
export function chiffresPublics(c: ChiffresBilan, logementIds: ReadonlySet<Id>): ChiffresBilan {
  const totaux = (t: Partial<TotauxBilan> | undefined): TotauxBilan => ({
    sejours: entier(t?.sejours),
    nuits: entier(t?.nuits),
    encaisse: entier(t?.encaisse),
    fraisPlateforme: entier(t?.fraisPlateforme),
    menage: entier(t?.menage),
    commission: entier(t?.commission),
    net: entier(t?.net),
  });
  const ratio = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
  return {
    mois: String(c?.mois ?? ''),
    joursMois: entier(c?.joursMois),
    logements: (c?.logements ?? [])
      .filter((l) => logementIds.has(l?.logementId))
      .map((l) => ({
        logementId: l.logementId,
        nom: String(l.nom ?? ''),
        ...totaux(l),
        occupation: ratio(l.occupation),
        ...(typeof l.commissionPct === 'number' ? { commissionPct: l.commissionPct } : {}),
      })),
    sejours: (c?.sejours ?? [])
      .filter((s) => logementIds.has(s?.logementId))
      .map((s) => ({
        logementId: s.logementId,
        arrivee: String(s.arrivee),
        depart: String(s.depart),
        nuits: entier(s.nuits),
        nuitsSejour: entier(s.nuitsSejour),
        voyageur: prenomInitiale(s.voyageur),
        nbPersonnes: entier(s.nbPersonnes),
        canal: canalPublic(s.canal),
        encaisse: entier(s.encaisse),
        fraisPlateforme: entier(s.fraisPlateforme),
        menage: entier(s.menage),
        commission: entier(s.commission),
        net: entier(s.net),
      })),
    totaux: totaux(c?.totaux),
    occupation: ratio(c?.occupation),
  };
}

/** Bilans publiés du propriétaire, du plus récent au plus ancien. */
export function bilansPublies(bilans: readonly BilanProprietaire[], proprietaireId: Id, logementIds: ReadonlySet<Id>): BilanVue[] {
  if (!proprietaireAutorise(proprietaireId)) return [];
  return bilans
    .filter((b) => b?.proprietaireId === proprietaireId && b.statut === 'publie' && !!b.publieLe && moisValide(b.mois) && b.chiffres)
    .map((b) => ({ mois: b.mois, commentaire: String(b.commentaire ?? ''), publieLe: b.publieLe!, chiffres: chiffresPublics(b.chiffres, logementIds) }))
    .sort((a, b) => b.mois.localeCompare(a.mois));
}

/* ------------------------------------------------------------- calendrier */

const sejourVu = (r: Reservation) => ({
  arrivee: r.arrivee,
  depart: r.depart,
  nuits: Math.max(1, ecartJoursISO(r.arrivee, r.depart)),
  voyageur: prenomInitiale(r.voyageur?.nom),
  nbPersonnes: Math.max(0, entier(r.voyageur?.nbPersonnes)),
  canal: canalPublic(r.canal),
});

/** Mois d'un logement, jour par jour : nuits réservées ou libres, arrivées, départs. */
export function calendrierMois(reservations: readonly Reservation[], logementId: Id, mois: string): CalendrierLogement {
  const sejours = sejoursDe(reservations, new Set([logementId]));
  const n = moisValide(mois) ? joursDuMois(mois) : 0;
  const nuitReservee = (d: DateISO) => sejours.some((r) => r.arrivee <= d && d < r.depart);
  const jours: JourCalendrier[] = Array.from({ length: n }, (_, i) => {
    const date = ajouterJoursISO(`${mois}-01`, i);
    return {
      date,
      occupe: nuitReservee(date),
      veille: nuitReservee(ajouterJoursISO(date, -1)),
      arrivee: sejours.some((r) => r.arrivee === date),
      depart: sejours.some((r) => r.depart === date),
    };
  });
  const nuitsReservees = jours.filter((j) => j.occupe).length;
  const debut = `${mois}-01`;
  const fin = n ? `${moisSuivant(mois)}-01` : debut;
  return {
    logementId,
    jours,
    nuitsReservees,
    nuitsLibres: n - nuitsReservees,
    occupation: n ? nuitsReservees / n : 0,
    sejours: sejours
      .filter((r) => r.arrivee < fin && r.depart > debut)
      .sort((a, b) => a.arrivee.localeCompare(b.arrivee))
      .map(sejourVu),
  };
}

/* ---------------------------------------------------------------- la vue */

export interface EntreesProprietaire {
  proprietaires: readonly Proprietaire[];
  logements: readonly Logement[];
  reservations: readonly Reservation[];
  mandats: readonly Mandat[];
  documentsProprietaire: readonly DocumentProprietaire[];
  bilansProprietaire: readonly BilanProprietaire[];
}

export interface OptionsVue {
  aujourdhui: DateISO;
  /** Mois du calendrier (le mois en cours par défaut). */
  mois?: string;
  /** Adresse affichable d'une photo (lien signé côté serveur) ; sans : telle quelle. */
  photo?: (l: Logement) => string | undefined;
  /**
   * Conciergerie de l'espace (le serveur la donne toujours). Sans : l'espace
   * ouvert dans l'ERP (aperçu du gérant), avec les contacts de Label Maison
   * pour Label Maison seulement.
   */
  conciergerie?: { nom: string; contacts?: ContactsConciergerie };
}

function conciergerieOuverte(): { nom: string; contacts?: ContactsConciergerie } {
  const e = espaceOuvert();
  return estLabelMaison(e) ? { nom: 'Label Maison', contacts: CONTACTS_LABEL_MAISON } : { nom: e.nom };
}

const CATEGORIES = new Set<string>(CATEGORIES_DOCUMENT.map((c) => c.valeur));

function chiffresMois(c: ChiffresBilan, provisoire: boolean): ChiffresMoisVue {
  return { mois: c.mois, net: c.totaux.net, nuits: c.totaux.nuits, occupation: c.occupation, sejours: c.totaux.sejours, provisoire };
}

/**
 * Tout ce que voit le propriétaire. `null` : propriétaire inconnu ou fiche
 * d'attente. Rien d'un autre propriétaire n'y entre, quelles que soient les
 * entrées (le serveur les filtre aussi avant).
 */
export function vueProprietaire(e: EntreesProprietaire, proprietaireId: Id, o: OptionsVue): VueProprietaire | null {
  if (!proprietaireAutorise(proprietaireId)) return null;
  const p = e.proprietaires.find((x) => x?.id === proprietaireId);
  if (!p) return null;
  const conciergerie = o.conciergerie ?? conciergerieOuverte();
  const aujourdhui = dateValide(o.aujourdhui) ? o.aujourdhui : dateParisISO();
  const tous = logementsDe(e.logements, proprietaireId);
  const tousIds = new Set(tous.map((l) => l.id));
  const geres = tous.filter((l) => l.statut !== 'sorti');
  const donnees = { logements: e.logements, reservations: e.reservations, mandats: e.mandats };
  const bilans = bilansPublies(e.bilansProprietaire, proprietaireId, tousIds);

  const courant = moisDe(aujourdhui);
  const precedent = moisPrecedent(courant);
  const publiePrecedent = bilans.find((b) => b.mois === precedent);
  const moisCalendrier = moisValide(o.mois) ? o.mois : courant;
  const actifs = sejoursDe(e.reservations, new Set(geres.map((l) => l.id)));

  const prochainesArrivees: ArriveeVue[] = actifs
    .filter((r) => r.arrivee >= aujourdhui)
    .sort((a, b) => a.arrivee.localeCompare(b.arrivee) || a.logementId.localeCompare(b.logementId))
    .slice(0, NB_PROCHAINES_ARRIVEES)
    .map((r) => ({ logementId: r.logementId, ...sejourVu(r) }));

  const logements: LogementVue[] = geres.map((l) => {
    const photo = o.photo ? o.photo(l) : photoCouverture(l);
    return { id: l.id, nom: l.nom, ville: l.ville, capacite: entier(l.capacite), chambres: entier(l.chambres), ...(photo ? { photo } : {}) };
  });

  const documents: DocumentVue[] = e.documentsProprietaire
    .filter((x) => x?.proprietaireId === proprietaireId && CATEGORIES.has(x.categorie))
    .map((x) => ({
      id: x.id,
      categorie: x.categorie,
      titre: String(x.titre ?? '').trim() || String(x.nomFichier ?? 'Document'),
      nomFichier: String(x.nomFichier ?? ''),
      ajouteLe: x.ajouteLe,
      ...(x.logementId && tousIds.has(x.logementId) ? { logementId: x.logementId } : {}),
    }))
    .sort((a, b) => String(b.ajouteLe).localeCompare(String(a.ajouteLe)));

  return {
    proprietaire: { id: p.id, nom: p.nom },
    aujourdhui,
    logements,
    moisCourant: chiffresMois(bilanMensuel(donnees, proprietaireId, courant), true),
    moisPrecedent: publiePrecedent ? chiffresMois(publiePrecedent.chiffres, false) : chiffresMois(bilanMensuel(donnees, proprietaireId, precedent), true),
    prochainesArrivees,
    calendrier: { mois: moisCalendrier, logements: geres.map((l) => calendrierMois(actifs, l.id, moisCalendrier)) },
    bilans,
    documents,
    conciergerie: { nom: conciergerie.nom },
    ...(conciergerie.contacts ? { contacts: conciergerie.contacts } : {}),
  };
}
