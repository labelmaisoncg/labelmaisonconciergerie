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
 * - le propriétaire ne voit que les bilans publiés, tels que publiés (un
 *   bilan publié est figé : jamais recalculé) ;
 * - logement passé à un autre propriétaire (changerProprietaire) : chacun
 *   n'a que sa période, l'ancien jusqu'à la veille, le nouveau à partir du
 *   jour du changement (et du début de son mandat). Un séjour est à celui
 *   qui avait le logement le jour de l'arrivée, toutes ses nuits comprises ;
 * - taux de commission : le mandat du propriétaire, jamais celui d'un autre
 *   (sans mandat à lui : pas de taux, pas de commission).
 *
 * Imports en « .js » : ce module tourne aussi sous Node (fonctions Vercel).
 */
import { espaceOuvert, estLabelMaison } from './espaces.js';
import { facturePartagee, facturesVue } from './relances.js';
import { ID_PROPRIETAIRE_A_RENSEIGNER } from './repull.js';
import type { CanalReservation, DateISO, Facture, Id, Logement, Mandat, Proprietaire, Reservation } from './types';
import type {
  ArriveeVue,
  AvisVue,
  BilanProprietaire,
  BilanVue,
  CalendrierLogement,
  CategorieDocumentProprietaire,
  ChiffresBilan,
  ChiffresMoisVue,
  ContactsConciergerie,
  DocumentProprietaire,
  DocumentVue,
  FicheLogementVue,
  JourCalendrier,
  LogementBilan,
  LogementVue,
  MoisPerformance,
  RelancePaiement,
  SejourBilan,
  TotauxBilan,
  TotauxPerformance,
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
/**
 * Ce que contient l'espace propriétaire, en une phrase : la même partout
 * (page de connexion, e-mail d'invitation, écrans du gérant).
 */
export const CONTENU_ESPACE = {
  /** « Vos logements, … » : au propriétaire. */
  vous: 'vos logements, votre calendrier, vos bilans publiés, vos factures partagées et vos documents',
  /** « Il voit ses logements, … » : au gérant. */
  lui: 'ses logements, son calendrier, ses bilans publiés, ses factures partagées et ses documents',
} as const;

export const NB_PROCHAINES_ARRIVEES = 5;
/** Fiche d'un logement : mois de performance, derniers avis, prochains séjours. */
export const NB_MOIS_PERFORMANCE = 12;
export const NB_DERNIERS_AVIS = 3;
export const NB_PROCHAINS_SEJOURS = 6;

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

/** Période où un propriétaire a un logement : [debut, fin), bornes absentes = ouvertes. */
export interface PeriodeProprietaire {
  debut?: DateISO;
  fin?: DateISO;
}

const plusTard = (a: DateISO | undefined, b: DateISO | undefined): DateISO | undefined => (!a ? b : !b ? a : a > b ? a : b);

/**
 * Le logement passe à un autre propriétaire à partir de `jour` (inclus) :
 * l'ancien garde ce qui était à lui jusqu'à la veille, le nouveau ne voit
 * rien d'avant. Premier vrai propriétaire (logement créé sans propriétaire,
 * ou importé avec la fiche d'attente) : tout l'historique est à lui.
 * Même propriétaire : rien ne change.
 */
export function changerProprietaire<T extends Pick<Logement, 'proprietaireId' | 'proprietaireDepuis' | 'proprietairesPrecedents'>>(
  l: T,
  proprietaireId: Id,
  jour: DateISO,
): T {
  if (l.proprietaireId === proprietaireId) return l;
  const le = dateValide(jour) ? jour : dateParisISO();
  const precedents = [...(l.proprietairesPrecedents ?? [])];
  const avaitUnProprietaire = proprietaireAutorise(l.proprietaireId);
  if (avaitUnProprietaire) precedents.push({ proprietaireId: l.proprietaireId, ...(dateValide(l.proprietaireDepuis) ? { depuis: l.proprietaireDepuis } : {}), jusquAu: le });
  const depuis = avaitUnProprietaire ? le : precedents[precedents.length - 1]?.jusquAu;
  const { proprietaireDepuis: _depuis, proprietairesPrecedents: _precedents, ...reste } = l;
  return { ...reste, proprietaireId, ...(depuis ? { proprietaireDepuis: depuis } : {}), ...(precedents.length ? { proprietairesPrecedents: precedents } : {}) } as T;
}

/** Périodes où ce propriétaire a eu, ou a, ce logement. */
export function periodesDuProprietaire(l: Logement | undefined, proprietaireId: Id): PeriodeProprietaire[] {
  if (!l || !proprietaireAutorise(proprietaireId)) return [];
  const res: PeriodeProprietaire[] = [];
  for (const x of l.proprietairesPrecedents ?? []) {
    if (x?.proprietaireId === proprietaireId && dateValide(x.jusquAu)) res.push({ ...(dateValide(x.depuis) ? { debut: x.depuis } : {}), fin: x.jusquAu });
  }
  if (l.proprietaireId === proprietaireId) res.push(dateValide(l.proprietaireDepuis) ? { debut: l.proprietaireDepuis } : {});
  return res;
}

/** Logements que ce propriétaire a, ou a eus avant un changement de propriétaire, avec ses périodes. */
export function logementsEtPeriodes(logements: readonly Logement[], proprietaireId: Id): { logement: Logement; periodes: PeriodeProprietaire[] }[] {
  return logements.map((logement) => ({ logement, periodes: periodesDuProprietaire(logement, proprietaireId) })).filter((x) => x.periodes.length > 0);
}

/**
 * Le séjour est-il à ce propriétaire ? Il est à celui qui avait le logement
 * le jour de l'arrivée, toutes ses nuits comprises (même après un changement).
 */
const arriveDans = (r: Reservation, p: PeriodeProprietaire) => (!p.debut || r.arrivee >= p.debut) && (!p.fin || r.arrivee < p.fin);

/** Le jour est-il dans la période ? */
const jourDans = (d: DateISO, p: PeriodeProprietaire) => (!p.debut || d >= p.debut) && (!p.fin || d < p.fin);

/** Mandat de ce propriétaire pour ce logement, jamais celui d'un autre ; sans : pas de taux ni de commission. */
export function mandatDuProprietaire(mandats: readonly Mandat[], logementId: Id, proprietaireId: Id): Mandat | undefined {
  return mandatEnVigueur(
    mandats.filter((m) => m?.proprietaireId === proprietaireId),
    logementId,
  );
}

/** Période bornée au début de son mandat : un séjour arrivé avant n'est pas géré pour lui. */
const bornerAuMandat = (p: PeriodeProprietaire, mandat: Mandat | undefined): PeriodeProprietaire => ({
  ...p,
  ...(dateValide(mandat?.dateDebut) ? { debut: plusTard(p.debut, mandat!.dateDebut) } : {}),
});

/**
 * Jours du mois à ce propriétaire (dénominateur de l'occupation) : les nuits
 * de ses séjours, et les jours de ses périodes que n'occupe pas le séjour de
 * quelqu'un d'autre (arrivé avant son premier jour).
 */
function joursAuProprietaire(mois: string, periodes: readonly PeriodeProprietaire[], siens: readonly Reservation[], autres: readonly Reservation[]): number {
  let n = 0;
  for (let i = 0, d = `${mois}-01`; i < joursDuMois(mois); i++, d = ajouterJoursISO(d, 1)) {
    const nuit = (r: Reservation) => r.arrivee <= d && d < r.depart;
    if (siens.some(nuit) || (!autres.some(nuit) && periodes.some((p) => jourDans(d, p)))) n++;
  }
  return n;
}

/**
 * Ce qui sort de la base pour ce propriétaire (le serveur filtre avant tout
 * calcul) : ses logements ; ceux qu'il a cédés, réduits au nom et à ses
 * périodes ; ses séjours (arrivés pendant ses périodes) ; le séjour d'un
 * autre qui déborde sur sa période, réduit à ses dates (pour l'occupation :
 * ni voyageur, ni montants, ni avis) ; ses mandats seulement.
 */
export function donneesDuProprietaire(
  d: { logements: readonly Logement[]; reservations: readonly Reservation[]; mandats: readonly Mandat[] },
  proprietaireId: Id,
): { logements: Logement[]; reservations: Reservation[]; mandats: Mandat[] } {
  const siens = logementsEtPeriodes(d.logements, proprietaireId);
  const periodes = new Map(siens.map((x) => [x.logement.id, x.periodes]));
  const logements = siens.map(({ logement: l }) =>
    l.proprietaireId === proprietaireId
      ? l
      : ({
          id: l.id,
          nom: l.nom,
          ville: l.ville,
          statut: l.statut,
          proprietaireId: '',
          proprietairesPrecedents: (l.proprietairesPrecedents ?? []).filter((x) => x?.proprietaireId === proprietaireId),
        } as unknown as Logement),
  );
  const reservations: Reservation[] = [];
  for (const r of d.reservations) {
    const siennes = periodes.get(r?.logementId);
    if (!siennes) continue;
    if (siennes.some((p) => arriveDans(r, p))) reservations.push(r);
    else if (dateValide(r.arrivee) && dateValide(r.depart) && siennes.some((p) => (!p.debut || r.depart > p.debut) && (!p.fin || r.arrivee < p.fin))) {
      reservations.push({ id: r.id, logementId: r.logementId, arrivee: r.arrivee, depart: r.depart, statut: r.statut } as Reservation);
    }
  }
  return {
    logements,
    reservations,
    mandats: d.mandats.filter((m) => m?.proprietaireId === proprietaireId && periodes.has(m.logementId)),
  };
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
 * encore gérés, plus un logement sorti ou cédé (changement de propriétaire)
 * s'il a eu des nuits à lui dans le mois. Seuls comptent ses séjours :
 * arrivés pendant sa période, à partir du début de son mandat (toutes leurs
 * nuits) ; l'occupation se compte sur ses jours (joursAuProprietaire). Sans
 * mandat à lui : pas de taux ni de commission (commissionPct absent).
 */
export function bilanMensuel(
  d: { logements: readonly Logement[]; reservations: readonly Reservation[]; mandats: readonly Mandat[] },
  proprietaireId: Id,
  mois: string,
): ChiffresBilan {
  const valide = moisValide(mois);
  const joursMois = valide ? joursDuMois(mois) : 0;
  const siens = logementsEtPeriodes(d.logements, proprietaireId);
  const ids = new Set(siens.map((x) => x.logement.id));
  const actifs = valide ? sejoursDe(d.reservations, ids) : [];
  const sejours: SejourBilan[] = [];
  const logements: LogementBilan[] = [];
  let joursGeres = 0;
  for (const { logement: l, periodes } of siens) {
    const mandat = mandatDuProprietaire(d.mandats, l.id, proprietaireId);
    const bornes = periodes.map((p) => bornerAuMandat(p, mandat));
    const duMois = valide ? actifs.filter((r) => r.logementId === l.id && r.arrivee < `${moisSuivant(mois)}-01` && r.depart > `${mois}-01`) : [];
    const aLui = duMois.filter((r) => bornes.some((b) => arriveDans(r, b)));
    const lignes = aLui
      .map((r) => sejourDuMois(r, mandat, mois))
      .filter((s): s is SejourBilan => !!s)
      .sort((a, b) => a.arrivee.localeCompare(b.arrivee));
    if ((l.statut === 'sorti' || l.proprietaireId !== proprietaireId) && !lignes.length) continue;
    const jours = valide ? joursAuProprietaire(mois, bornes, aLui, duMois.filter((r) => !aLui.includes(r))) : 0;
    joursGeres += jours;
    const t = totauxVides();
    for (const s of lignes) ajouter(t, s);
    sejours.push(...lignes);
    logements.push({
      logementId: l.id,
      nom: l.nom,
      ...t,
      occupation: jours ? Math.min(1, t.nuits / jours) : 0,
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
    occupation: joursGeres ? Math.min(1, totaux.nuits / joursGeres) : 0,
  };
}

/** Logements d'un bilan sans taux (pas de mandat à ce propriétaire) : pour le gérant, « Taux de commission à renseigner ». */
export function logementsSansTaux(c: ChiffresBilan): string[] {
  return (c?.logements ?? []).filter((l) => typeof l?.commissionPct !== 'number').map((l) => l.nom);
}

/** Logement d'un bilan publié passé depuis à un autre propriétaire. */
export interface LogementTransfere {
  logementId: Id;
  nom: string;
  /** Premier jour du nouveau propriétaire (absent : inconnu, changement d'avant cette date). */
  depuis?: DateISO;
}

/**
 * État d'un bilan côté gérant. Publié : figé ; s'il contient un logement
 * passé depuis à un autre propriétaire, jamais recalculé ni proposé à la mise
 * à jour (« Logement transféré depuis le … ») ; sinon « À mettre à jour »
 * quand les chiffres ont changé. `chiffres` : ceux à montrer (ceux du bilan
 * publié s'il est transféré).
 */
export function etatBilan(
  d: { logements: readonly Logement[]; reservations: readonly Reservation[]; mandats: readonly Mandat[] },
  proprietaireId: Id,
  mois: string,
  existant?: BilanProprietaire,
): { statut: 'aucun' | 'brouillon' | 'publie' | 'a_mettre_a_jour' | 'transfere'; chiffres: ChiffresBilan; transferts: LogementTransfere[] } {
  const calcule = bilanMensuel(d, proprietaireId, mois);
  if (!existant) return { statut: 'aucun', chiffres: calcule, transferts: [] };
  if (existant.statut !== 'publie') return { statut: 'brouillon', chiffres: calcule, transferts: [] };
  const transferts: LogementTransfere[] = (existant.chiffres?.logements ?? [])
    .filter((x) => d.logements.find((l) => l.id === x.logementId)?.proprietaireId !== proprietaireId)
    .map((x) => {
      const l = d.logements.find((y) => y.id === x.logementId);
      return { logementId: x.logementId, nom: String(x.nom ?? l?.nom ?? ''), ...(l && dateValide(l.proprietaireDepuis) ? { depuis: l.proprietaireDepuis } : {}) };
    });
  if (transferts.length) return { statut: 'transfere', chiffres: existant.chiffres, transferts };
  return { statut: memesChiffres(existant.chiffres, calcule) ? 'publie' : 'a_mettre_a_jour', chiffres: calcule, transferts: [] };
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

/**
 * Bilans publiés du propriétaire, du plus récent au plus ancien. Un bilan
 * publié est figé : tels que publiés, même si un de ses logements a changé
 * de propriétaire depuis (seules ses lignes propres sont gardées : un séjour
 * d'un logement absent du bilan est retiré).
 */
export function bilansPublies(bilans: readonly BilanProprietaire[], proprietaireId: Id): BilanVue[] {
  if (!proprietaireAutorise(proprietaireId)) return [];
  return bilans
    .filter((b) => b?.proprietaireId === proprietaireId && b.statut === 'publie' && !!b.publieLe && moisValide(b.mois) && b.chiffres)
    .map((b) => ({
      mois: b.mois,
      commentaire: String(b.commentaire ?? ''),
      publieLe: b.publieLe!,
      chiffres: chiffresPublics(b.chiffres, new Set((b.chiffres.logements ?? []).map((l) => l?.logementId))),
    }))
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

/* --------------------------------------------- fiche « Mes logements » */

/**
 * Partie publique d'un avis : jamais le « Message privé » (retour réservé à
 * l'hôte), ni adresse, numéro ou lien glissé dans le texte ; 600 caractères
 * au plus.
 */
export function avisPublic(texte: unknown): string | undefined {
  let t = String(texte ?? '');
  const prive = t.search(/(^|\n)\s*Message privé\s*:/i);
  if (prive >= 0) t = t.slice(0, prive);
  t = t
    .replace(/https?:\/\/\S+|www\.\S+/gi, '…')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '…')
    .replace(/\+?\d[\d\s.-]{7,}\d/g, '…')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  if (t.length > 600) t = `${t.slice(0, 599).trimEnd()}…`;
  return t || undefined;
}

const noteValide = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 5;

/** Totaux des mois suivis ; séjours comptés une fois (ids des séjours de ces mois). */
function totauxPerformance(mois: readonly MoisPerformance[], sejoursParMois: ReadonlyMap<string, ReadonlySet<string>>): TotauxPerformance {
  const suivis = mois.filter((m) => m.suivi);
  const somme = (k: 'net' | 'encaisse' | 'hebergement' | 'nuits' | 'jours') => suivis.reduce((x, m) => x + m[k], 0);
  const sejours = new Set(suivis.flatMap((m) => [...(sejoursParMois.get(m.mois) ?? [])]));
  const nuits = somme('nuits');
  const jours = somme('jours');
  return {
    mois: suivis.length,
    net: somme('net'),
    encaisse: somme('encaisse'),
    nuits,
    sejours: sejours.size,
    jours,
    occupation: jours ? Math.min(1, nuits / jours) : 0,
    prixMoyenNuit: nuits ? Math.round(somme('hebergement') / nuits) : 0,
  };
}

/**
 * Fiche d'un logement : les 12 derniers mois terminés, comparés aux mêmes
 * mois un an plus tôt, avec les seules données de l'ERP. Un mois n'est
 * « suivi » qu'à partir du premier séjour connu (et du début du mandat) :
 * avant, l'ERP n'a pas de données, ce n'est pas un mois vide.
 * `pour` : le propriétaire actuel ; seuls ses séjours (arrivés à partir de
 * son premier jour et du début de son mandat), avec leurs avis ; son mandat
 * seulement (sans : pas de commission).
 */
export function ficheLogement(
  d: { reservations: readonly Reservation[]; mandats: readonly Mandat[] },
  logementId: Id,
  aujourdhui: DateISO,
  pour?: { proprietaireId: Id; logement: Logement },
): FicheLogementVue {
  const depuis = pour && pour.logement.proprietaireId === pour.proprietaireId && dateValide(pour.logement.proprietaireDepuis) ? pour.logement.proprietaireDepuis : undefined;
  const mandat = pour ? mandatDuProprietaire(d.mandats, logementId, pour.proprietaireId) : mandatEnVigueur(d.mandats, logementId);
  const borne = bornerAuMandat(depuis ? { debut: depuis } : {}, mandat);
  const tous = sejoursDe(d.reservations, new Set([logementId]));
  const actifs = tous.filter((r) => arriveDans(r, borne));
  const autres = tous.filter((r) => !arriveDans(r, borne));
  const premier = actifs.reduce<DateISO | undefined>((x, r) => (!x || r.arrivee < x ? r.arrivee : x), undefined);
  const debutSuivi = premier ? plusTard(premier, borne.debut) : undefined;

  // 24 mois : les 12 derniers mois terminés et les 12 d'avant.
  const fin = moisPrecedent(moisDe(aujourdhui));
  const liste: string[] = [];
  for (let i = 0, m = fin; i < 2 * NB_MOIS_PERFORMANCE; i++, m = moisPrecedent(m)) liste.unshift(m);
  const sejoursParMois = new Map<string, Set<string>>();
  const mois: MoisPerformance[] = liste.map((m) => {
    const suivi = !!debutSuivi && m >= moisDe(debutSuivi);
    const lignes = suivi ? actifs.map((r) => ({ r, s: sejourDuMois(r, mandat, m) })).filter((x): x is { r: Reservation; s: SejourBilan } => !!x.s) : [];
    sejoursParMois.set(m, new Set(lignes.map((x) => x.r.id)));
    const jours = suivi ? joursAuProprietaire(m, [borne], lignes.map((x) => x.r), autres) : 0;
    const nuits = lignes.reduce((x, l) => x + l.s.nuits, 0);
    const hebergement = lignes.reduce((x, l) => x + l.s.encaisse - l.s.menage, 0);
    return {
      mois: m,
      suivi,
      net: lignes.reduce((x, l) => x + l.s.net, 0),
      encaisse: lignes.reduce((x, l) => x + l.s.encaisse, 0),
      hebergement,
      nuits,
      sejours: lignes.length,
      jours,
      occupation: jours ? Math.min(1, nuits / jours) : 0,
      prixMoyenNuit: nuits ? Math.round(hebergement / nuits) : 0,
    };
  });
  const precedents = mois.slice(0, NB_MOIS_PERFORMANCE);
  const derniers = mois.slice(NB_MOIS_PERFORMANCE);
  const comparables = derniers.map((m, i) => m.suivi && precedents[i].suivi);
  const nbMois = comparables.filter(Boolean).length;

  const avecNote = actifs.filter((r) => noteValide(r.noteVoyageur) && r.depart <= aujourdhui).sort((a, b) => b.depart.localeCompare(a.depart));
  const avis: AvisVue[] = avecNote.slice(0, NB_DERNIERS_AVIS).map((r) => {
    const texte = avisPublic(r.commentaireVoyageur);
    return { date: r.depart, note: r.noteVoyageur!, voyageur: prenomInitiale(r.voyageur?.nom), canal: canalPublic(r.canal), ...(texte ? { texte } : {}) };
  });

  return {
    logementId,
    mois: derniers,
    totaux: totauxPerformance(derniers, sejoursParMois),
    ...(nbMois
      ? {
          comparaison: {
            nbMois,
            actuel: totauxPerformance(derniers.filter((_, i) => comparables[i]), sejoursParMois),
            precedent: totauxPerformance(precedents.filter((_, i) => comparables[i]), sejoursParMois),
          },
        }
      : {}),
    ...(avecNote.length
      ? {
          avis: {
            moyenne: Math.round((avecNote.reduce((x, r) => x + r.noteVoyageur!, 0) / avecNote.length) * 10) / 10,
            nombre: avecNote.length,
            derniers: avis,
          },
        }
      : {}),
    prochainsSejours: actifs
      .filter((r) => r.depart > aujourdhui)
      .sort((a, b) => a.arrivee.localeCompare(b.arrivee))
      .slice(0, NB_PROCHAINS_SEJOURS)
      .map((r) => ({ logementId, ...sejourVu(r) })),
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
  /** Factures (seules les siennes, partagées, sont vues). */
  factures?: readonly Facture[];
  /** Relances envoyées (date du dernier rappel) ; collection serveur. */
  relancesPaiement?: readonly RelancePaiement[];
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
  const bilans = bilansPublies(e.bilansProprietaire, proprietaireId);

  const courant = moisDe(aujourdhui);
  const precedent = moisPrecedent(courant);
  const publiePrecedent = bilans.find((b) => b.mois === precedent);
  const moisCalendrier = moisValide(o.mois) ? o.mois : courant;
  // Logement reçu d'un autre propriétaire : seulement les séjours arrivés à partir de son premier jour.
  const depuisDe = new Map(geres.map((l) => [l.id, dateValide(l.proprietaireDepuis) ? l.proprietaireDepuis : undefined]));
  const actifs = sejoursDe(e.reservations, new Set(geres.map((l) => l.id))).filter((r) => {
    const depuis = depuisDe.get(r.logementId);
    return !depuis || r.arrivee >= depuis;
  });

  const prochainesArrivees: ArriveeVue[] = actifs
    .filter((r) => r.arrivee >= aujourdhui)
    .sort((a, b) => a.arrivee.localeCompare(b.arrivee) || a.logementId.localeCompare(b.logementId))
    .slice(0, NB_PROCHAINES_ARRIVEES)
    .map((r) => ({ logementId: r.logementId, ...sejourVu(r) }));

  const logements: LogementVue[] = geres.map((l) => {
    const photo = o.photo ? o.photo(l) : photoCouverture(l);
    return { id: l.id, nom: l.nom, ville: l.ville, capacite: entier(l.capacite), chambres: entier(l.chambres), ...(photo ? { photo } : {}) };
  });

  // Le PDF d'une facture ne se voit que tant que la facture est partagée.
  const facturesPartagees = new Set((e.factures ?? []).filter((f) => facturePartagee(f, proprietaireId)).map((f) => f.id));
  const documents: DocumentVue[] = e.documentsProprietaire
    .filter((x) => x?.proprietaireId === proprietaireId && CATEGORIES.has(x.categorie) && (!x.factureId || facturesPartagees.has(x.factureId)))
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
    fiches: geres.map((l) => ficheLogement({ reservations: actifs, mandats: e.mandats }, l.id, aujourdhui, { proprietaireId, logement: l })),
    bilans,
    documents,
    factures: facturesVue(e.factures ?? [], proprietaireId, aujourdhui, { documents: e.documentsProprietaire, relances: e.relancesPaiement }),
    conciergerie: { nom: conciergerie.nom },
    ...(conciergerie.contacts ? { contacts: conciergerie.contacts } : {}),
  };
}
