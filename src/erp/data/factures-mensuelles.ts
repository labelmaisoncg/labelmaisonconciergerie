/**
 * Facture mensuelle du propriétaire : ce que la conciergerie lui facture pour
 * un mois, calculé avec les mêmes règles que son bilan (bilanMensuel).
 *
 * - Lignes : la commission de gestion de chaque logement (taux du mandat de
 *   CE propriétaire, sur la base nette : encaissé − commissions des
 *   plateformes − ménage ; versements Airbnb et montants nets Booking), puis
 *   un ménage par séjour, prolongations regroupées (consoliderSejours : deux
 *   réservations qui se suivent, même voyageur, même logement = un séjour =
 *   un ménage). Montants au prorata des nuits du mois, comme le bilan : la
 *   commission et les ménages de la facture sont ceux du bilan, au centime.
 * - Brouillon chaque mois : créé à partir du 1er par le passage planifié
 *   (api/_factures-mensuelles.ts, une fois par mois et par espace), ou à la
 *   demande du gérant. Un seul par propriétaire et par mois (id
 *   `fm-<propriétaire>-<mois>`) : refaire le passage ne crée rien de plus.
 * - Le gérant relit ; il ne change pas les lignes calculées, il ajoute au
 *   besoin un ajustement, toujours avec sa raison.
 * - Validation : le numéro est attribué (`2026-0001`, à la suite dans
 *   l'espace, jamais réutilisé : compteur par année dans les réglages), puis
 *   lignes, montants, identités (conciergerie et propriétaire), période et
 *   mention de TVA sont figés. Ensuite seuls le partage et le paiement
 *   changent (relances.ts).
 * - TVA : celle du régime de l'espace (identite-conciergerie.ts). Franchise
 *   en base : 0 % et « TVA non applicable, art. 293 B du CGI ».
 *
 * Module pur (navigateur et serveur) : imports en « .js ».
 */
import type { Espace } from './espaces.js';
import { ID_REGLAGE_SOCIETE, erreursIdentite, identiteConciergerie, mentionTva, normaliserIdentite, tauxTva } from './identite-conciergerie.js';
import { ajouterJoursISO, bilanMensuel, moisDe, moisPrecedent, moisSuivant, moisValide, proprietaireAutorise } from './proprietaire.js';
import { eurosTexte, montantTtcFacture } from './relances.js';
import type {
  AjustementFacture,
  Centimes,
  CompteurFactures,
  DateISO,
  Facture,
  FactureMensuelle,
  Horodatage,
  Id,
  IdentiteSociete,
  LigneFacture,
  Logement,
  Mandat,
  Proprietaire,
  Reglage,
  Reservation,
} from './types';
import type { ChiffresBilan, FactureVue, SejourBilan } from './types-proprietaire';

/* --------------------------------------------------------------- repères */

export const idFactureMensuelle = (proprietaireId: Id, mois: string): Id => `fm-${proprietaireId}-${mois}`;

/** Échéance : date d'émission + 15 jours. */
export const DELAI_PAIEMENT_JOURS = 15;

/** Élément de `reglages` qui tient la numérotation de l'espace. */
export const ID_COMPTEUR_FACTURES = 'numerotation-factures';

/** Collection serveur : un élément par mois quand le passage planifié a préparé les brouillons de l'espace. */
export const COLLECTION_PASSAGES_FACTURES = 'passagesFacturesMensuelles';

/** Auteur d'un brouillon créé par le passage planifié. */
export const PAR_AUTOMATIQUE = 'automatique';

type Donnees = { logements: readonly Logement[]; reservations: readonly Reservation[]; mandats: readonly Mandat[] };

const NUMERO = /^(\d{4})-(\d{4,})$/;

const MOIS_COURT = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
const MOIS_LONG = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' });
const jourTexte = (d: DateISO) => (Number(d.slice(8, 10)) === 1 ? '1er' : String(Number(d.slice(8, 10))));

/**
 * « du 3 au 5 août », « du 29 août au 3 sept. » ; `long` : mois en toutes
 * lettres ; `annee` : « du 1er au 31 août 2026 ». Deux années différentes :
 * toujours écrites.
 */
export function intervalleDates(du: DateISO, au: DateISO, o: { long?: boolean; annee?: boolean } = {}): string {
  const mois = (d: DateISO) => (o.long ? MOIS_LONG : MOIS_COURT).format(new Date(`${d}T12:00:00Z`));
  const memeAnnee = du.slice(0, 4) === au.slice(0, 4);
  const an = (d: DateISO, toujours: boolean) => (toujours ? ` ${d.slice(0, 4)}` : '');
  if (memeAnnee && du.slice(0, 7) === au.slice(0, 7)) return `du ${jourTexte(du)} au ${jourTexte(au)} ${mois(au)}${an(au, !!o.annee)}`;
  return `du ${jourTexte(du)} ${mois(du)}${an(du, !memeAnnee)} au ${jourTexte(au)} ${mois(au)}${an(au, !memeAnnee || !!o.annee)}`;
}

const tauxTexte = (n: number) => `${String(Math.round(n * 100) / 100).replace('.', ',')} %`;
const montantLigne = (l: Pick<LigneFacture, 'quantite' | 'puCentimes'>): Centimes => Math.round((Number(l.quantite) || 0) * (Number(l.puCentimes) || 0));

/** Mois facturé par le passage planifié : le mois terminé (à partir du 1er du suivant). */
export const moisAFacturerAutomatiquement = (aujourdhui: DateISO): string => moisPrecedent(moisDe(aujourdhui));

/** Du 1er au dernier jour du mois. */
export function periodeDuMois(mois: string): { du: DateISO; au: DateISO } {
  return { du: `${mois}-01`, au: ajouterJoursISO(`${moisSuivant(mois)}-01`, -1) };
}

/** Facture mensuelle (créée ici, brouillon ou validée). */
export const estFactureMensuelle = (f: Facture | undefined | null): f is Facture & { mensuelle: FactureMensuelle } =>
  !!f && !!f.mensuelle && moisValide(f.mensuelle.mois) && f.destinataire === 'proprietaire';

/** Validée : elle a reçu un numéro, plus rien ne change dans son contenu. */
export const factureFigee = (f: Facture | undefined | null): boolean => !!f && (!!String(f.numero ?? '').trim() || !!f.mensuelle?.valideeLe);

/* ---------------------------------------------------------------- calcul */

export interface CalculFacture {
  mois: string;
  /** Bilan du mois (mêmes séjours, mêmes ménages, même commission). */
  chiffres: ChiffresBilan;
  /** Commission puis ménages (lignes calculées, jamais modifiées à la main). */
  lignes: LigneFacture[];
  commission: Centimes;
  menage: Centimes;
  /** Logements facturés ce mois-ci. */
  logements: string[];
  /** Logements sans mandat à ce propriétaire : pas de taux, pas de commission. */
  sansTaux: string[];
}

function detailMenage(s: SejourBilan): string {
  const morceaux = [`Séjour ${intervalleDates(s.arrivee, s.depart)}`, s.voyageur];
  if (s.prolongations) morceaux.push(s.prolongations > 1 ? `${s.prolongations} prolongations comprises` : 'prolongation comprise');
  if (s.nuits !== s.nuitsSejour) morceaux.push(`${s.nuits} nuits sur ${s.nuitsSejour} ce mois-ci`);
  return morceaux.join(' · ');
}

/**
 * Lignes calculées d'un mois pour un propriétaire, tirées de son bilan :
 * une commission par logement (s'il a un taux), un ménage par séjour.
 */
export function calculerFactureMois(d: Donnees, proprietaireId: Id, mois: string): CalculFacture {
  const c = bilanMensuel(d, proprietaireId, mois);
  const actifs = c.logements.filter((l) => l.sejours > 0 || l.commission !== 0);
  const plusieurs = actifs.length > 1;
  const lignes: LigneFacture[] = [];
  for (const l of actifs) {
    if (!l.commission || typeof l.commissionPct !== 'number') continue;
    const base = l.encaisse - l.fraisPlateforme - l.menage;
    lignes.push({
      code: 'commission',
      libelle: `Commission de gestion${plusieurs ? ` · ${l.nom}` : ''}`,
      detail: `${tauxTexte(l.commissionPct)} de ${eurosTexte(base)} de revenus nets (encaissé ${eurosTexte(l.encaisse)} − plateformes ${eurosTexte(l.fraisPlateforme)} − ménage ${eurosTexte(l.menage)})`,
      quantite: 1,
      puCentimes: l.commission,
    });
  }
  const nom = (id: Id) => c.logements.find((l) => l.logementId === id)?.nom ?? 'Logement';
  for (const s of c.sejours) {
    if (!s.menage) continue;
    lignes.push({ code: 'menage', libelle: `Ménage${plusieurs ? ` · ${nom(s.logementId)}` : ''}`, detail: detailMenage(s), quantite: 1, puCentimes: s.menage });
  }
  return {
    mois,
    chiffres: c,
    lignes,
    commission: c.totaux.commission,
    menage: c.totaux.menage,
    logements: actifs.map((l) => l.nom),
    sansTaux: actifs.filter((l) => typeof l.commissionPct !== 'number').map((l) => l.nom),
  };
}

export const lignesAjustements = (a: readonly AjustementFacture[]): LigneFacture[] =>
  a.map((x) => ({ code: 'ajustement' as const, libelle: x.libelle, detail: x.motif, quantite: 1, puCentimes: Math.round(Number(x.montantCentimes) || 0) }));

/** Somme des lignes d'une nature (commission, ménage, ajustement). */
export const totalCode = (lignes: readonly LigneFacture[], code: NonNullable<LigneFacture['code']>): Centimes =>
  lignes.filter((l) => l.code === code).reduce((s, l) => s + montantLigne(l), 0);

export function totauxLignes(lignes: readonly LigneFacture[], tvaPct: number): { ht: Centimes; tva: Centimes; ttc: Centimes } {
  const ht = lignes.reduce((s, l) => s + montantLigne(l), 0);
  const ttc = montantTtcFacture({ montantHtCentimes: ht, tvaPct });
  return { ht, tva: ttc - ht, ttc };
}

/** La facture a-t-elle la commission et les ménages de ce bilan ? (ajustements à part) */
export function memesMontantsQueLeBilan(c: Pick<ChiffresBilan, 'totaux'>, f: Pick<Facture, 'lignes'>): boolean {
  return totalCode(f.lignes ?? [], 'commission') === c.totaux.commission && totalCode(f.lignes ?? [], 'menage') === c.totaux.menage;
}

/* ------------------------------------------------------------- brouillon */

export interface OptionsBrouillon {
  donnees: Donnees;
  proprietaireId: Id;
  mois: string;
  /** Facture déjà enregistrée pour ce mois (brouillon à rafraîchir). */
  existante?: Facture;
  /** Régime de TVA de l'espace (sans : celui du brouillon existant, sinon 0). */
  identite?: Pick<IdentiteSociete, 'regimeTva' | 'tvaPct'>;
  aujourdhui: DateISO;
  maintenant: Horodatage;
  par: string;
}

/**
 * Brouillon du mois, recalculé sur les données du moment (ajustements du
 * gérant gardés). null : facture déjà validée (jamais touchée), propriétaire
 * ou mois illisible.
 */
export function preparerBrouillon(o: OptionsBrouillon): Facture | null {
  if (!proprietaireAutorise(o.proprietaireId) || !moisValide(o.mois)) return null;
  const e = o.existante;
  if (e && (factureFigee(e) || e.id !== idFactureMensuelle(o.proprietaireId, o.mois))) return null;
  const calcul = calculerFactureMois(o.donnees, o.proprietaireId, o.mois);
  const ajustements = e?.mensuelle?.ajustements ?? [];
  const lignes = [...calcul.lignes, ...lignesAjustements(ajustements)];
  const tvaPct = o.identite ? tauxTva(o.identite) : Number(e?.tvaPct) || 0;
  return {
    id: idFactureMensuelle(o.proprietaireId, o.mois),
    numero: '',
    type: 'commission',
    destinataire: 'proprietaire',
    proprietaireId: o.proprietaireId,
    dateEmission: o.aujourdhui,
    echeance: ajouterJoursISO(o.aujourdhui, DELAI_PAIEMENT_JOURS),
    montantHtCentimes: totauxLignes(lignes, tvaPct).ht,
    tvaPct,
    statut: 'brouillon',
    lignes,
    mensuelle: {
      mois: o.mois,
      ajustements,
      creeeLe: e?.mensuelle?.creeeLe ?? o.maintenant,
      creeePar: e?.mensuelle?.creeePar ?? o.par,
    },
  };
}

/**
 * Brouillons à créer pour un mois (passage planifié) : un par propriétaire
 * qui a quelque chose à payer et n'a encore AUCUNE facture mensuelle pour ce
 * mois (brouillon, écartée ou validée). Idempotent : refait, il ne propose
 * rien de plus.
 */
export function brouillonsDuMois(o: {
  donnees: Donnees & { proprietaires: readonly Proprietaire[]; factures: readonly Facture[] };
  mois: string;
  identite?: Pick<IdentiteSociete, 'regimeTva' | 'tvaPct'>;
  aujourdhui: DateISO;
  maintenant: Horodatage;
  par?: string;
}): Facture[] {
  const existantes = new Set(o.donnees.factures.map((f) => f?.id));
  const res: Facture[] = [];
  for (const p of o.donnees.proprietaires) {
    if (!proprietaireAutorise(p?.id) || existantes.has(idFactureMensuelle(p.id, o.mois))) continue;
    const b = preparerBrouillon({ donnees: o.donnees, proprietaireId: p.id, mois: o.mois, identite: o.identite, aujourdhui: o.aujourdhui, maintenant: o.maintenant, par: o.par ?? PAR_AUTOMATIQUE });
    if (b && b.lignes.length && b.montantHtCentimes > 0) res.push(b);
  }
  return res;
}

/** Brouillon écarté par le gérant (« Ne pas facturer ce mois ») : gardé, pour que le passage ne le recrée pas. */
export function ecarterBrouillon(f: Facture): Facture | null {
  return estFactureMensuelle(f) && !factureFigee(f) ? { ...f, statut: 'annulee' } : null;
}

/* ------------------------------------------------------------ ajustements */

export type ResultatFacture = { ok: true; facture: Facture } | { ok: false; erreur: string };

function avecAjustements(f: Facture & { mensuelle: FactureMensuelle }, ajustements: AjustementFacture[]): Facture {
  const lignes = [...f.lignes.filter((l) => l.code !== 'ajustement'), ...lignesAjustements(ajustements)];
  return { ...f, lignes, montantHtCentimes: totauxLignes(lignes, f.tvaPct).ht, mensuelle: { ...f.mensuelle, ajustements } };
}

/** Ajoute une ligne d'ajustement (montant HT, positif ou négatif) avec sa raison, sur un brouillon seulement. */
export function ajouterAjustement(
  f: Facture,
  a: { libelle: string; montantCentimes: number; motif: string },
  o: { id: Id; maintenant: Horodatage; par: string },
): ResultatFacture {
  if (!estFactureMensuelle(f)) return { ok: false, erreur: 'Facture introuvable.' };
  if (factureFigee(f)) return { ok: false, erreur: 'Cette facture est validée : elle ne change plus.' };
  const libelle = String(a.libelle ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const motif = String(a.motif ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const montant = Math.round(Number(a.montantCentimes));
  if (!libelle) return { ok: false, erreur: 'Indiquez le libellé de la ligne.' };
  if (!Number.isFinite(montant) || montant === 0 || Math.abs(montant) > 10_000_000) return { ok: false, erreur: 'Indiquez un montant (négatif pour une remise).' };
  if (!motif) return { ok: false, erreur: 'Indiquez la raison de cet ajustement.' };
  return { ok: true, facture: avecAjustements(f, [...f.mensuelle.ajustements, { id: o.id, libelle, montantCentimes: montant, motif, ajouteLe: o.maintenant, ajoutePar: o.par }]) };
}

export function retirerAjustement(f: Facture, id: Id): ResultatFacture {
  if (!estFactureMensuelle(f)) return { ok: false, erreur: 'Facture introuvable.' };
  if (factureFigee(f)) return { ok: false, erreur: 'Cette facture est validée : elle ne change plus.' };
  return { ok: true, facture: avecAjustements(f, f.mensuelle.ajustements.filter((x) => x.id !== id)) };
}

/* ------------------------------------------------------------- numéro */

/** Compteur de l'espace (réglages), lu avec tolérance. */
export function compteurFactures(d: { reglages?: readonly Reglage[] | null }): CompteurFactures {
  const c = (d.reglages ?? []).find((r): r is CompteurFactures => r?.id === ID_COMPTEUR_FACTURES);
  const derniers: Record<string, number> = {};
  for (const [annee, n] of Object.entries(c?.derniers ?? {})) if (/^\d{4}$/.test(annee) && Number.isInteger(n) && n > 0) derniers[annee] = n;
  return { id: ID_COMPTEUR_FACTURES, derniers, ...(c?.majLe ? { majLe: c.majLe } : {}) };
}

/**
 * Numéro suivant de l'année (« 2026-0004 ») : après le plus grand déjà
 * attribué, qu'il soit dans le compteur ou sur une facture. Jamais un
 * numéro déjà donné, même si sa facture a disparu depuis.
 */
export function prochainNumero(factures: readonly Pick<Facture, 'numero'>[], compteur: CompteurFactures | undefined, annee: string): { numero: string; sequence: number } {
  let dernier = Number(compteur?.derniers?.[annee]) || 0;
  for (const f of factures) {
    const m = NUMERO.exec(String(f?.numero ?? '').trim());
    if (m && m[1] === annee) dernier = Math.max(dernier, Number(m[2]));
  }
  const sequence = dernier + 1;
  return { numero: `${annee}-${String(sequence).padStart(4, '0')}`, sequence };
}

/* ------------------------------------------------------------ validation */

export type ResultatValidation = { ok: true; facture: Facture; compteur: CompteurFactures } | { ok: false; erreur: string };

/**
 * Valide un brouillon : recalculé une dernière fois, numéroté, puis figé
 * (lignes, montants, émission, échéance, identités, logements, mention de
 * TVA). Renvoie la facture et le compteur à enregistrer ensemble.
 */
export function validerFacture(o: {
  facture: Facture;
  donnees: Donnees;
  /** Toutes les factures de l'espace (numéros déjà attribués). */
  factures: readonly Facture[];
  compteur?: CompteurFactures;
  proprietaire: Pick<Proprietaire, 'id' | 'nom' | 'adresse'> | undefined;
  identite: IdentiteSociete;
  aujourdhui: DateISO;
  maintenant: Horodatage;
  par: string;
}): ResultatValidation {
  const f = o.facture;
  if (!estFactureMensuelle(f)) return { ok: false, erreur: 'Facture introuvable.' };
  if (factureFigee(f)) return { ok: false, erreur: 'Cette facture est déjà validée : elle ne change plus.' };
  if (f.statut === 'annulee') return { ok: false, erreur: 'Ce mois n’est plus à facturer : préparez de nouveau la facture.' };
  if (Object.keys(erreursIdentite(o.identite)).length) return { ok: false, erreur: 'Complétez l’identité de votre société (Paramètres → Société) : raison sociale, SIRET et adresse.' };
  const p = o.proprietaire;
  if (!p || p.id !== f.proprietaireId) return { ok: false, erreur: 'Propriétaire introuvable.' };
  const nom = String(p.nom ?? '').trim();
  const adresse = String(p.adresse ?? '').replace(/\s+/g, ' ').trim();
  if (!nom || !adresse) return { ok: false, erreur: 'Ajoutez le nom et l’adresse du propriétaire sur sa fiche : ils figurent sur la facture.' };
  const mois = f.mensuelle.mois;
  const frais = preparerBrouillon({ donnees: o.donnees, proprietaireId: p.id, mois, existante: f, identite: o.identite, aujourdhui: o.aujourdhui, maintenant: o.maintenant, par: o.par });
  if (!frais || !frais.mensuelle) return { ok: false, erreur: 'Facture introuvable.' };
  if (frais.montantHtCentimes <= 0) return { ok: false, erreur: 'Rien à facturer ce mois-ci : le total n’est pas positif.' };
  const annee = o.aujourdhui.slice(0, 4);
  const { numero, sequence } = prochainNumero(o.factures, o.compteur, annee);
  const emetteur = normaliserIdentite(o.identite);
  const mention = mentionTva(emetteur);
  const facture: Facture = {
    ...frais,
    numero,
    statut: 'emise',
    dateEmission: o.aujourdhui,
    echeance: ajouterJoursISO(o.aujourdhui, DELAI_PAIEMENT_JOURS),
    tvaPct: tauxTva(emetteur),
    montantHtCentimes: totauxLignes(frais.lignes, tauxTva(emetteur)).ht,
    mensuelle: {
      ...frais.mensuelle,
      valideeLe: o.maintenant,
      valideePar: o.par,
      emetteur,
      client: { nom: nom.slice(0, 160), adresse: adresse.slice(0, 240) },
      logements: calculerFactureMois(o.donnees, p.id, mois).logements,
      ...(mention ? { mentionTva: mention } : {}),
    },
  };
  const compteur: CompteurFactures = { id: ID_COMPTEUR_FACTURES, derniers: { ...(o.compteur?.derniers ?? {}), [annee]: sequence }, majLe: o.maintenant };
  return { ok: true, facture, compteur };
}

/* --------------------------------------------------------------- document */

/** Tout ce que montre la facture imprimée (une seule mise en page : DocumentFacture.tsx). */
export interface DocumentFacture {
  /** Pas encore validée : sans numéro, montants encore susceptibles de changer. */
  brouillon: boolean;
  numero: string;
  dateEmission: DateISO;
  echeance: DateISO;
  mois: string;
  periode: { du: DateISO; au: DateISO };
  emetteur: IdentiteSociete;
  client: { nom: string; adresse: string };
  logements: string[];
  lignes: { code?: LigneFacture['code']; libelle: string; detail?: string; quantite: number; pu: Centimes; montant: Centimes }[];
  totalHt: Centimes;
  tvaPct: number;
  tva: Centimes;
  totalTtc: Centimes;
  mentionTva?: string;
}

/**
 * Document d'une facture mensuelle de l'ERP. Validée : uniquement ce qui a
 * été figé. Brouillon : l'identité et le propriétaire du moment (`brouillon`).
 */
export function documentDeFacture(
  f: Facture,
  brouillon?: { identite: IdentiteSociete; proprietaire?: Pick<Proprietaire, 'nom' | 'adresse'>; logements: string[] },
): DocumentFacture | null {
  if (!estFactureMensuelle(f)) return null;
  const m = f.mensuelle;
  const fige = factureFigee(f);
  const emetteur = fige ? m.emetteur : brouillon?.identite;
  if (!emetteur) return null;
  const tvaPct = fige ? Number(f.tvaPct) || 0 : tauxTva(emetteur);
  const lignes = (f.lignes ?? []).map((l) => ({ code: l.code, libelle: l.libelle, ...(l.detail ? { detail: l.detail } : {}), quantite: l.quantite, pu: l.puCentimes, montant: montantLigne(l) }));
  const t = totauxLignes(f.lignes ?? [], tvaPct);
  const mention = fige ? m.mentionTva : mentionTva(emetteur);
  return {
    brouillon: !fige,
    numero: fige ? f.numero : '',
    dateEmission: f.dateEmission,
    echeance: f.echeance,
    mois: m.mois,
    periode: periodeDuMois(m.mois),
    emetteur,
    client: fige ? (m.client ?? { nom: '', adresse: '' }) : { nom: String(brouillon?.proprietaire?.nom ?? ''), adresse: String(brouillon?.proprietaire?.adresse ?? '') },
    logements: fige ? (m.logements ?? []) : (brouillon?.logements ?? []),
    lignes,
    totalHt: t.ht,
    tvaPct,
    tva: t.tva,
    totalTtc: t.ttc,
    ...(mention ? { mentionTva: mention } : {}),
  };
}

/** Document d'une facture mensuelle telle que la voit le propriétaire (null : autre facture). */
export function documentDeFactureVue(f: FactureVue): DocumentFacture | null {
  const m = f.mensuelle;
  if (!m) return null;
  return {
    brouillon: false,
    numero: f.numero,
    dateEmission: f.dateEmission,
    echeance: f.echeance,
    mois: m.mois,
    periode: periodeDuMois(m.mois),
    emetteur: m.emetteur,
    client: m.client,
    logements: m.logements,
    lignes: f.lignes.map((l) => ({ code: l.code, libelle: l.libelle, ...(l.detail ? { detail: l.detail } : {}), quantite: l.quantite, pu: l.pu, montant: Math.round(l.quantite * l.pu) })),
    totalHt: f.montantHt,
    tvaPct: f.tvaPct,
    tva: f.montantTtc - f.montantHt,
    totalTtc: f.montantTtc,
    ...(m.mentionTva ? { mentionTva: m.mentionTva } : {}),
  };
}

/* ------------------------------------------------------- liste du gérant */

/**
 * Mois terminés (les `n` derniers) qui ont quelque chose à facturer et pas
 * encore de facture mensuelle active (brouillon ou validée) pour ce
 * propriétaire, du plus récent au plus ancien.
 */
export function moisSansFacture(d: Donnees & { factures: readonly Facture[] }, proprietaireId: Id, aujourdhui: DateISO, n = 12): { mois: string; montant: Centimes }[] {
  const res: { mois: string; montant: Centimes }[] = [];
  let m = moisPrecedent(moisDe(aujourdhui));
  for (let i = 0; i < n; i++, m = moisPrecedent(m)) {
    const f = d.factures.find((x) => x.id === idFactureMensuelle(proprietaireId, m));
    if (f && f.statut !== 'annulee') continue;
    if (f && factureFigee(f)) continue;
    const c = calculerFactureMois(d, proprietaireId, m);
    const montant = c.lignes.reduce((s, l) => s + montantLigne(l), 0);
    if (montant > 0) res.push({ mois: m, montant });
  }
  return res;
}

/* ------------------------------------------------------ passage planifié */

/** Ce dont le passage a besoin dans la base d'un espace (BaseErp ; une base en mémoire pour les vérifications). */
export interface BasePassageFactures {
  lire<T>(collection: string, ids?: string[]): Promise<T[]>;
  ecrire(collection: string, elements: { id: string }[], auteur?: string): Promise<void>;
  /** Ajoute seulement les éléments absents (jamais de remplacement) ; renvoie le nombre ajouté. */
  ajouterSiAbsent(collection: string, elements: { id: string }[], auteur?: string): Promise<number>;
}

export interface PassageFactures {
  mois: string;
  statut: 'deja_fait' | 'fait';
  brouillons: number;
}

const AUTEUR_PASSAGE = 'factures-mensuelles';

/**
 * Passage planifié d'un espace (api/_factures-mensuelles.ts), à partir du
 * 1er : brouillons du mois terminé pour chaque propriétaire qui a quelque
 * chose à payer. Une fois par mois et par espace (trace dans
 * COLLECTION_PASSAGES_FACTURES) ; l'écriture n'ajoute que les factures
 * absentes : un brouillon déjà là, ou une facture validée entre-temps par
 * le gérant, n'est jamais remplacé.
 */
export async function passageFacturesMensuelles(
  base: BasePassageFactures,
  espace: Pick<Espace, 'id' | 'nom'>,
  o: { aujourdhui: DateISO; maintenant: Horodatage },
): Promise<PassageFactures> {
  const mois = moisAFacturerAutomatiquement(o.aujourdhui);
  const [deja] = await base.lire<{ id: string }>(COLLECTION_PASSAGES_FACTURES, [mois]);
  if (deja) return { mois, statut: 'deja_fait', brouillons: 0 };
  const proprietaires = (await base.lire<Proprietaire>('proprietaires')).filter((p) => proprietaireAutorise(p?.id));
  let brouillons = 0;
  if (proprietaires.length) {
    const [factures, logements, reservations, mandats, reglages] = await Promise.all([
      base.lire<Facture>('factures', proprietaires.map((p) => idFactureMensuelle(p.id, mois))),
      base.lire<Logement>('logements'),
      base.lire<Reservation>('reservations'),
      base.lire<Mandat>('mandats'),
      base.lire<Reglage>('reglages', [ID_REGLAGE_SOCIETE]),
    ]);
    const nouveaux = brouillonsDuMois({
      donnees: { proprietaires, logements, reservations, mandats, factures },
      mois,
      identite: identiteConciergerie({ reglages }, espace),
      aujourdhui: o.aujourdhui,
      maintenant: o.maintenant,
    });
    if (nouveaux.length) brouillons = await base.ajouterSiAbsent('factures', nouveaux, AUTEUR_PASSAGE);
  }
  const trace: { id: string; faitLe: Horodatage; brouillons: number } = { id: mois, faitLe: o.maintenant, brouillons };
  await base.ecrire(COLLECTION_PASSAGES_FACTURES, [trace], AUTEUR_PASSAGE);
  return { mois, statut: 'fait', brouillons };
}
