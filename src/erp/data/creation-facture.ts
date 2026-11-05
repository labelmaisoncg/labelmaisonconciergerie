/**
 * Nouvelle facture, saisie pas à pas (modules/finance/_composants/NouvelleFacture.tsx) :
 * le type, le destinataire, les dates, les lignes, la TVA, l'émettre ou la
 * garder en brouillon, puis le récapitulatif.
 *
 * Mêmes règles et même facture que l'ancien formulaire : propriétaire
 * choisi quand c'est lui le destinataire, échéance après l'émission, TVA
 * entre 0 et 30 %, au moins une ligne, chacune avec une désignation, une
 * quantité positive et un prix unitaire HT (négatif permis pour un avoir) ;
 * montants en centimes, numéro attribué automatiquement. Les deux dates
 * sont demandées.
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */
import { LIBELLES } from './libelles';
import { ajouterJours, dateJour, euros, versCentimes } from './format';
import type { Centimes, DateISO, DestinataireFacture, Facture, Id, LigneFacture, Proprietaire, StatutFacture, TypeFacture } from './types';

export const ECRANS_FACTURE = ['type', 'destinataire', 'dates', 'lignes', 'tva', 'statut', 'recapitulatif'] as const;
export type EcranFacture = (typeof ECRANS_FACTURE)[number];

export interface LigneSaisie {
  libelle: string;
  quantite: string;
  pu: string;
}

export interface BrouillonFacture {
  type: TypeFacture;
  destinataire: DestinataireFacture;
  proprietaireId: Id;
  emission: DateISO | '';
  echeance: DateISO | '';
  /** Taux en %, tel que tapé (« 20 », « 5,5 »). */
  tva: string;
  lignes: LigneSaisie[];
  /** Émise tout de suite, ou gardée en brouillon. */
  statut: Extract<StatutFacture, 'emise' | 'brouillon'>;
}

export const LIGNE_VIDE: LigneSaisie = { libelle: '', quantite: '1', pu: '' };

/** Départ de l'ancien formulaire : commission au propriétaire, émise aujourd'hui, échéance à 15 jours, TVA 20 %, une ligne. */
export const brouillonFacture = (aujourdhui: DateISO): BrouillonFacture => ({
  type: 'commission',
  destinataire: 'proprietaire',
  proprietaireId: '',
  emission: aujourdhui,
  echeance: ajouterJours(aujourdhui, 15),
  tva: '20',
  lignes: [{ ...LIGNE_VIDE }],
  statut: 'emise',
});

/** Lignes lues (comme l'ancien formulaire) : désignation sans espaces autour, quantité décimale, prix en centimes. */
export const lignesLues = (lignes: readonly LigneSaisie[]): LigneFacture[] =>
  lignes.map((l) => ({ libelle: l.libelle.trim(), quantite: Number(l.quantite.replace(',', '.')), puCentimes: versCentimes(l.pu) }));

export const tvaLue = (tva: string): number => Number(tva.replace(',', '.'));

/** Totaux : HT (lignes lisibles seulement), TVA et TTC arrondis au centime. */
export function totauxFacture(b: Pick<BrouillonFacture, 'lignes' | 'tva'>): { ht: Centimes; tva: Centimes; ttc: Centimes } {
  const ht = lignesLues(b.lignes).reduce((s, l) => s + (Number.isFinite(l.quantite) && Number.isFinite(l.puCentimes) ? Math.round(l.quantite * l.puCentimes) : 0), 0);
  const pct = Number.isFinite(tvaLue(b.tva)) ? tvaLue(b.tva) : 0;
  return { ht, tva: Math.round((ht * pct) / 100), ttc: Math.round(ht * (1 + pct / 100)) };
}

/** Erreurs sans champ à elles (choix) : dites au-dessus de « Continuer ». */
export const SANS_CHAMP_FACTURE = new Set(['type', 'destinataire', 'proprietaireId', 'lignes', 'statut']);

/** Clés des champs d'une ligne : `ligne-0-libelle`, `ligne-0-quantite`, `ligne-0-pu`. */
export const cleLigne = (i: number, champ: keyof LigneSaisie) => `ligne-${i}-${champ}`;

/** Erreurs d'un écran, dans l'ordre de l'écran ; le récapitulatif réunit celles de tous les écrans. */
export function erreursFacture(ecran: EcranFacture, b: BrouillonFacture, ctx: { proprietaires: readonly Pick<Proprietaire, 'id'>[] }): Record<string, string> {
  if (ecran === 'recapitulatif') {
    return Object.assign({}, ...ECRANS_FACTURE.filter((e) => e !== 'recapitulatif').map((e) => erreursFacture(e, b, ctx)));
  }
  const r: Record<string, string> = {};
  if (ecran === 'destinataire' && b.destinataire === 'proprietaire' && !ctx.proprietaires.some((p) => p.id === b.proprietaireId)) {
    r.proprietaireId = 'Choisissez le propriétaire destinataire.';
  }
  if (ecran === 'dates') {
    if (!b.emission) r.emission = 'Indiquez la date d’émission.';
    if (!b.echeance) r.echeance = 'Indiquez l’échéance.';
    else if (b.emission && b.echeance < b.emission) r.echeance = 'L’échéance doit suivre la date d’émission.';
  }
  if (ecran === 'lignes') {
    if (!b.lignes.length) r.lignes = 'Ajoutez au moins une ligne.';
    lignesLues(b.lignes).forEach((l, i) => {
      if (!l.libelle) r[cleLigne(i, 'libelle')] = `Ligne ${i + 1} : désignation manquante.`;
      if (!Number.isFinite(l.quantite) || l.quantite <= 0) r[cleLigne(i, 'quantite')] = `Ligne ${i + 1} : quantité invalide.`;
      if (!Number.isFinite(l.puCentimes) || (b.type !== 'avoir' && l.puCentimes <= 0)) r[cleLigne(i, 'pu')] = `Ligne ${i + 1} : prix unitaire invalide.`;
    });
  }
  if (ecran === 'tva') {
    const t = tvaLue(b.tva);
    if (!b.tva.trim() || !Number.isFinite(t) || t < 0 || t > 30) r.tva = 'Taux de TVA invalide.';
  }
  return r;
}

export function ecranDeLaCleFacture(cle: string): EcranFacture {
  if (cle === 'proprietaireId') return 'destinataire';
  if (cle === 'emission' || cle === 'echeance') return 'dates';
  if (cle === 'lignes' || cle.startsWith('ligne-')) return 'lignes';
  if (cle === 'tva') return 'tva';
  return 'recapitulatif';
}

export type ResultatFacture = { ok: true; facture: Facture } | { ok: false; ecran: EcranFacture; erreur: string };

/** Ce que le bouton final enregistre : la même facture que l'ancien formulaire (« Émettre » ou « Enregistrer en brouillon »). */
export function factureDepuisBrouillon(b: BrouillonFacture, ctx: { proprietaires: readonly Pick<Proprietaire, 'id'>[]; id: Id; numero: string }): ResultatFacture {
  const erreurs = Object.entries(erreursFacture('recapitulatif', b, ctx));
  if (erreurs.length || !b.emission || !b.echeance) {
    const [cle, erreur] = erreurs[0] ?? ['emission', 'Indiquez la date d’émission.'];
    return { ok: false, ecran: ecranDeLaCleFacture(cle), erreur };
  }
  return {
    ok: true,
    facture: {
      id: ctx.id,
      numero: ctx.numero,
      type: b.type,
      destinataire: b.destinataire,
      proprietaireId: b.destinataire === 'proprietaire' ? b.proprietaireId : undefined,
      dateEmission: b.emission,
      echeance: b.echeance,
      montantHtCentimes: totauxFacture(b).ht,
      tvaPct: tvaLue(b.tva),
      statut: b.statut,
      lignes: lignesLues(b.lignes),
    },
  };
}

/** Lignes du récapitulatif. */
export function recapFacture(
  b: BrouillonFacture,
  proprietaires: readonly Pick<Proprietaire, 'id' | 'nom'>[],
): { cle: string; ecran: Exclude<EcranFacture, 'recapitulatif'>; libelle: string; valeur: string }[] {
  const t = totauxFacture(b);
  const lues = lignesLues(b.lignes);
  const lignesOk = !Object.keys(erreursFacture('lignes', b, { proprietaires })).length;
  const destinataire =
    b.destinataire === 'proprietaire' ? (proprietaires.find((p) => p.id === b.proprietaireId)?.nom ?? '') : LIBELLES.destinataire[b.destinataire];
  return [
    { cle: 'type', ecran: 'type', libelle: 'Type', valeur: LIBELLES.typeFacture[b.type] },
    { cle: 'destinataire', ecran: 'destinataire', libelle: 'Destinataire', valeur: destinataire },
    { cle: 'dates', ecran: 'dates', libelle: 'Dates', valeur: b.emission && b.echeance && b.echeance >= b.emission ? `Émise le ${dateJour(b.emission)}, échéance le ${dateJour(b.echeance)}` : '' },
    {
      cle: 'lignes',
      ecran: 'lignes',
      libelle: lues.length > 1 ? `Lignes (${lues.length})` : 'Ligne',
      valeur: lignesOk ? lues.map((l) => `${l.libelle} : ${String(l.quantite).replace('.', ',')} × ${euros(l.puCentimes)}`).join('\n') : '',
    },
    { cle: 'tva', ecran: 'tva', libelle: 'Total', valeur: lignesOk && !erreursFacture('tva', b, { proprietaires }).tva ? `${euros(t.ttc)} TTC (${euros(t.ht)} HT, TVA ${String(tvaLue(b.tva)).replace('.', ',')} %)` : '' },
    { cle: 'statut', ecran: 'statut', libelle: 'Envoi', valeur: b.statut === 'emise' ? 'Émise maintenant' : 'Gardée en brouillon' },
  ];
}
