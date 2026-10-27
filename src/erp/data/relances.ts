/**
 * Factures partagées et relances de paiement (espace propriétaire, phase 2).
 * Règles pures, partagées par le serveur (passage quotidien, envoi validé
 * par un gérant), l'espace du propriétaire et l'aperçu du gérant.
 *
 * - Une facture est vue par le propriétaire et relancée seulement si elle
 *   lui est destinée (proprietaireId) ET partagée (partageeLe).
 * - Calendrier par espace : J+5, J+15, J+30 après l'échéance par défaut. Une
 *   relance par étape et par facture (id `${factureId}-r${niveau}`) : un
 *   nouveau passage ne crée ni n'envoie jamais deux fois la même.
 * - En retard de plusieurs étapes d'un coup : seule la plus avancée est
 *   créée (pas trois e-mails le même jour). Une relance encore à valider
 *   est remplacée par l'étape suivante.
 * - Tout s'arrête dès que la facture est payée (ou annulée, ou plus
 *   partagée) : les relances à valider deviennent « sans objet ».
 * - Mode « proposer » (par défaut) : le passage ne fait que proposer, un
 *   gérant valide chaque envoi. Mode « automatique » : envoi par e-mail avec
 *   l'expéditeur de l'espace ; sans expéditeur, la relance reste à valider.
 *
 * Imports en « .js » : ce module tourne aussi sous Node (fonctions Vercel).
 */
import { estLabelMaison } from './espaces.js';
import { emetteurDeLabelMaison } from './identite-conciergerie.js';
import type { Centimes, DateISO, Facture, Horodatage, Id, IdentiteSociete, LigneFacture, Proprietaire } from './types';
import type { DocumentProprietaire, FactureMensuelleVue, FactureVue, RelancePaiement, ReglagesRelances, StatutFactureVue } from './types-proprietaire';

/** « 2026-09-20 » + 5 jours (sans dépendre de proprietaire.ts, qui importe ce module). */
function ajouterJoursISO(d: DateISO, n: number): DateISO {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

/** Collections serveur (jamais écrites par le navigateur). */
export const COLLECTION_RELANCES = 'relancesPaiement';
export const COLLECTION_REGLAGES_RELANCES = 'reglagesRelances';

export const JOURS_RELANCE_DEFAUT = [5, 15, 30];
export const REGLAGES_RELANCES_DEFAUT: ReglagesRelances = { id: 'relances', actif: true, mode: 'proposer', jours: JOURS_RELANCE_DEFAUT };

/** Réglages lus avec tolérance : étapes entières de 1 à 120 jours, croissantes, 5 au plus. */
export function reglagesRelances(brut: Partial<ReglagesRelances> | null | undefined): ReglagesRelances {
  const jours = Array.isArray(brut?.jours)
    ? [...new Set(brut.jours.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 120))].sort((a, b) => a - b).slice(0, 5)
    : [];
  return {
    id: 'relances',
    actif: brut?.actif !== false,
    mode: brut?.mode === 'automatique' ? 'automatique' : 'proposer',
    jours: jours.length ? jours : JOURS_RELANCE_DEFAUT,
    ...(brut?.majLe ? { majLe: brut.majLe } : {}),
    ...(brut?.majPar ? { majPar: brut.majPar } : {}),
  };
}

/* -------------------------------------------------------------- factures */

export function montantTtcFacture(f: Pick<Facture, 'montantHtCentimes' | 'tvaPct'>): Centimes {
  return Math.round((Number(f.montantHtCentimes) || 0) * (1 + (Number(f.tvaPct) || 0) / 100));
}

/**
 * Facture partagée avec ce propriétaire : adressée AU propriétaire (pas une
 * facture voyageur rattachée à son logement), la sienne, émise (pas un
 * brouillon ni une facture annulée).
 */
export function facturePartagee(f: Facture, proprietaireId: Id): boolean {
  return !!f && f.destinataire === 'proprietaire' && !!proprietaireId && f.proprietaireId === proprietaireId && !!f.partageeLe && f.statut !== 'brouillon' && f.statut !== 'annulee';
}

/** Reste à payer : adressée à un propriétaire, partagée, émise ou en retard, jamais payée. */
export function factureAPayer(f: Facture): boolean {
  return !!f?.proprietaireId && f.destinataire === 'proprietaire' && !!f.partageeLe && (f.statut === 'emise' || f.statut === 'en_retard') && !f.payeeLe;
}

/** Statut vu par le propriétaire : payée, en retard (échéance passée), à payer. */
export function statutFactureVue(f: Facture, aujourdhui: DateISO): StatutFactureVue {
  if (f.statut === 'payee' || f.payeeLe) return 'payee';
  return f.statut === 'en_retard' || f.echeance < aujourdhui ? 'en_retard' : 'a_payer';
}

/** Date de paiement acceptée : une vraie date, pas dans le futur. */
export const datePaiementValide = (d: unknown, aujourdhui: DateISO): d is DateISO =>
  typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`)) && d <= aujourdhui;

/** Paiement annulé (saisi par erreur) : la facture redevient à payer, et entre de nouveau dans les relances. */
export function annulerPaiementFacture(f: Facture): Facture {
  const { payeeLe: _payee, ...reste } = f;
  return { ...reste, statut: 'emise' };
}

/** Partager une facture dans l'espace propriétaire (ou ne plus la partager). */
export function partagerFacture(f: Facture, maintenant: Horodatage): Facture {
  return f.partageeLe ? f : { ...f, partageeLe: maintenant };
}
export function retirerPartageFacture(f: Facture): Facture {
  const { partageeLe: _p, ...reste } = f;
  return reste;
}

const texteVue = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const CODES_LIGNE = new Set(['commission', 'menage', 'ajustement']);

/** Ligne vue par le propriétaire : libellé, quantité, prix, et la précision d'une facture mensuelle. */
function ligneVue(l: LigneFacture): FactureVue['lignes'][number] {
  const detail = texteVue(l.detail, 400);
  return {
    libelle: String(l.libelle ?? ''),
    quantite: Number(l.quantite) || 0,
    pu: Math.round(Number(l.puCentimes) || 0),
    ...(detail ? { detail } : {}),
    ...(l.code && CODES_LIGNE.has(l.code) ? { code: l.code } : {}),
  };
}

/**
 * Partie figée d'une facture mensuelle numérotée (identités, logements,
 * mention de TVA), champs connus seulement ; rien pour un brouillon. Hors de
 * Label Maison, un émetteur au SIRET ou au nom de Label Maison n'est jamais
 * montré (même règle que identiteConciergerie).
 */
function mensuelleVue(f: Facture, espace: string | undefined): FactureMensuelleVue | undefined {
  const m = f.mensuelle;
  if (!m || !String(f.numero ?? '').trim() || !m.emetteur || !m.client || !/^\d{4}-\d{2}$/.test(String(m.mois))) return undefined;
  const e = m.emetteur;
  if (!estLabelMaison(espace) && emetteurDeLabelMaison(e)) return undefined;
  const emetteur: IdentiteSociete = {
    raisonSociale: texteVue(e.raisonSociale, 120),
    forme: texteVue(e.forme, 60),
    siret: texteVue(e.siret, 40),
    adresse: texteVue(e.adresse, 200),
    regimeTva: e.regimeTva === 'tva' ? 'tva' : 'franchise',
    tvaPct: Number(e.tvaPct) || 0,
    ...(e.numeroTva ? { numeroTva: texteVue(e.numeroTva, 20) } : {}),
    ...(e.mentions ? { mentions: texteVue(e.mentions, 600) } : {}),
  };
  return {
    mois: m.mois,
    emetteur,
    client: { nom: texteVue(m.client.nom, 160), adresse: texteVue(m.client.adresse, 240) },
    logements: (m.logements ?? []).map((x) => texteVue(x, 120)).filter(Boolean),
    ...(m.mentionTva ? { mentionTva: texteVue(m.mentionTva, 120) } : {}),
  };
}

/** Factures vues par le propriétaire : les siennes, partagées, des plus récentes aux plus anciennes. */
export function facturesVue(
  factures: readonly Facture[],
  proprietaireId: Id,
  aujourdhui: DateISO,
  o: {
    documents?: readonly DocumentProprietaire[];
    relances?: readonly RelancePaiement[];
    /** Espace des factures (absent : Label Maison, comme avant les espaces). */
    espace?: string;
  } = {},
): FactureVue[] {
  return factures
    .filter((f) => facturePartagee(f, proprietaireId))
    .map((f) => {
      const pdf = (o.documents ?? []).find((d) => d?.factureId === f.id && d.proprietaireId === proprietaireId && d.categorie === 'facture');
      const rappel = (o.relances ?? [])
        .filter((r) => r?.factureId === f.id && r.proprietaireId === proprietaireId && r.statut === 'envoyee' && r.envoyeeLe)
        .map((r) => r.envoyeeLe!.slice(0, 10))
        .sort()
        .pop();
      const statut = statutFactureVue(f, aujourdhui);
      const mensuelle = mensuelleVue(f, o.espace);
      return {
        id: f.id,
        numero: String(f.numero ?? ''),
        dateEmission: f.dateEmission,
        echeance: f.echeance,
        montantHt: Math.round(Number(f.montantHtCentimes) || 0),
        tvaPct: Number(f.tvaPct) || 0,
        montantTtc: montantTtcFacture(f),
        statut,
        ...(statut === 'payee' && f.payeeLe ? { payeeLe: f.payeeLe } : {}),
        lignes: (f.lignes ?? []).map(ligneVue),
        ...(mensuelle ? { mensuelle } : {}),
        ...(pdf ? { pdf: pdf.id } : {}),
        ...(rappel && statut !== 'payee' ? { dernierRappel: rappel } : {}),
      };
    })
    .sort((a, b) => b.dateEmission.localeCompare(a.dateEmission) || b.numero.localeCompare(a.numero));
}

/* --------------------------------------------------------------- relances */

export const idRelance = (factureId: Id, niveau: number): Id => `${factureId}-r${niveau}`;

export interface PlanRelances {
  /** Relances à créer (statut « proposee »). */
  nouvelles: RelancePaiement[];
  /** Relances à valider qui changent : facture payée (sans objet) ou remplacées par l'étape suivante. */
  modifiees: RelancePaiement[];
}

/**
 * Ce que le passage quotidien doit faire, sans rien envoyer : créer l'étape
 * due la plus avancée de chaque facture à payer, fermer les relances
 * devenues sans objet. Idempotent : refait le même jour, il ne change rien.
 */
export function planifierRelances(o: {
  factures: readonly Facture[];
  relances: readonly RelancePaiement[];
  reglages: ReglagesRelances;
  aujourdhui: DateISO;
  maintenant: Horodatage;
  espace?: string;
}): PlanRelances {
  const nouvelles: RelancePaiement[] = [];
  const modifiees: RelancePaiement[] = [];
  const parFacture = new Map<Id, RelancePaiement[]>();
  for (const r of o.relances) if (r?.factureId) parFacture.set(r.factureId, [...(parFacture.get(r.factureId) ?? []), r]);
  const factures = new Map(o.factures.map((f) => [f.id, f]));

  // Facture payée, annulée ou plus partagée : on s'arrête.
  for (const r of o.relances) {
    const f = factures.get(r?.factureId);
    if (r?.statut === 'proposee' && (!f || !factureAPayer(f))) modifiees.push({ ...r, statut: 'sans_objet' });
  }
  if (!o.reglages.actif) return { nouvelles, modifiees };

  for (const f of o.factures) {
    if (!factureAPayer(f) || !/^\d{4}-\d{2}-\d{2}$/.test(String(f.echeance))) continue;
    const existantes = parFacture.get(f.id) ?? [];
    const plusHaut = existantes.reduce((m, r) => Math.max(m, r.niveau), 0);
    // Étape due la plus avancée (les étapes déjà passées ne sont pas rattrapées une à une).
    let niveau = 0;
    o.reglages.jours.forEach((j, i) => {
      if (ajouterJoursISO(f.echeance, j) <= o.aujourdhui) niveau = i + 1;
    });
    if (!niveau || niveau <= plusHaut || existantes.some((r) => r.niveau === niveau)) continue;
    const jours = o.reglages.jours[niveau - 1];
    for (const r of existantes) if (r.statut === 'proposee') modifiees.push({ ...r, statut: 'annulee', motif: 'remplacee', annuleeLe: o.maintenant, annuleePar: 'automatique' });
    nouvelles.push({
      id: idRelance(f.id, niveau),
      factureId: f.id,
      proprietaireId: f.proprietaireId!,
      numero: f.numero,
      niveau,
      joursApresEcheance: jours,
      dueLe: ajouterJoursISO(f.echeance, jours),
      statut: 'proposee',
      creeLe: o.maintenant,
      ...(o.espace ? { espace: o.espace } : {}),
    });
  }
  return { nouvelles, modifiees };
}

/** Peut-on encore envoyer cette relance ? (à valider, facture toujours à payer) */
export function relanceEnvoyable(r: RelancePaiement | undefined, f: Facture | undefined): boolean {
  return !!r && r.statut === 'proposee' && !!f && f.id === r.factureId && f.proprietaireId === r.proprietaireId && factureAPayer(f);
}

/* ---------------------------------------------------------------- message */

const EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const eurosTexte = (c: Centimes): string => EUROS.format(c / 100).replace(/ /g, ' ');
export const dateTexte = (d: DateISO): string => DATE_LONGUE.format(new Date(`${d}T12:00:00Z`));

const echapper = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Nom d'une étape, le même dans l'e-mail et à l'écran : « Petit rappel », « Deuxième rappel », « Nouveau rappel », « Dernier rappel ». */
export function nomRappel(niveau: number, dernier?: boolean): string {
  if (dernier && niveau > 1) return 'Dernier rappel';
  return niveau <= 1 ? 'Petit rappel' : niveau === 2 ? 'Deuxième rappel' : 'Nouveau rappel';
}

/**
 * E-mail de relance : poli, court, signé du nom de l'espace ; montant TTC,
 * numéro, échéance et comment payer (virement avec le numéro en référence).
 * Jamais de coordonnées bancaires.
 */
export function messageRelance(o: {
  relance: Pick<RelancePaiement, 'niveau'>;
  /** Dernière étape du calendrier de l'espace. */
  dernier?: boolean;
  facture: Pick<Facture, 'numero' | 'echeance' | 'montantHtCentimes' | 'tvaPct'>;
  proprietaire: Pick<Proprietaire, 'nom'>;
  conciergerie: string;
  /** Lien de l'espace propriétaire, où la facture est consultable. */
  lienEspace?: string;
}): { sujet: string; texte: string; html: string } {
  const { facture: f } = o;
  const montant = eurosTexte(montantTtcFacture(f));
  const echeance = dateTexte(f.echeance);
  const sujet = `${nomRappel(o.relance.niveau, o.dernier)} : facture ${f.numero} à régler`;
  const paragraphes = [
    `Bonjour ${o.proprietaire.nom},`,
    `Sauf erreur de notre part, la facture ${f.numero} de ${montant}, arrivée à échéance le ${echeance}, n’est pas encore réglée.`,
    `Vous pouvez la régler par virement en indiquant « ${f.numero} » en référence${o.lienEspace ? ' ; elle est aussi disponible dans votre espace propriétaire' : ''}.`,
    'Une question sur ce règlement ? Répondez simplement à ce message. Si vous l’avez réglée entre-temps, merci de ne pas en tenir compte.',
    `Bien cordialement,\n${o.conciergerie}`,
  ];
  const texte = `${paragraphes.join('\n\n')}${o.lienEspace ? `\n\nVotre espace propriétaire : ${o.lienEspace}` : ''}`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#fbfaf8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f1b16">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-family:Georgia,serif;font-size:22px;color:#4a3828;margin:0 0 20px">${echapper(o.conciergerie)}</p>
${paragraphes.map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${echapper(p).replace(/\n/g, '<br>')}</p>`).join('\n')}
${o.lienEspace ? `<p style="margin:20px 0 0"><a href="${echapper(o.lienEspace)}" style="color:#8a6424;font-weight:600">Voir la facture dans votre espace</a></p>` : ''}
</div></body></html>`;
  return { sujet, texte, html };
}
