/**
 * Identité légale de la conciergerie, par espace (Paramètres → Société) :
 * raison sociale, forme, SIRET, adresse du siège, régime de TVA et mentions
 * libres. Imprimée sur les factures mensuelles et en tête des bilans.
 *
 * Stockage : collection `reglages` de l'espace, élément 'societe'
 * (synchronisée comme les autres réglages ; chaque espace a les siens).
 *
 * Règles :
 * - Label Maison garde son identité d'avant (celle de ENTREPRISE), en
 *   franchise en base de TVA par défaut, tant que rien n'est enregistré ;
 * - un autre espace n'a JAMAIS l'identité de Label Maison : sans
 *   enregistrement, son nom seul (identité incomplète : aucune facture ne
 *   se valide) ; une identité enregistrée qui porte le SIRET de Label Maison
 *   (sauvegarde de Label Maison rechargée ailleurs) est ignorée ;
 * - décidé par l'identifiant de l'espace, jamais par son nom ;
 * - aucun taux de TVA écrit en dur sur une facture : il vient du régime de
 *   l'espace (franchise : 0 et la mention « art. 293 B » ; TVA : son taux).
 *
 * Module pur (navigateur et serveur) : imports en « .js ».
 */
import { estLabelMaison, type Espace } from './espaces.js';
import type { IdentiteSociete, Reglage, ReglagesSociete, RegimeTva } from './types';

export const ID_REGLAGE_SOCIETE = 'societe';

/** Taux normal proposé en régime « TVA » (modifiable par l'espace). */
export const TAUX_TVA_NORMAL = 20;

export const MENTION_FRANCHISE_TVA = 'TVA non applicable, art. 293 B du CGI';

export const REGIMES_TVA: { valeur: RegimeTva; libelle: string }[] = [
  { valeur: 'franchise', libelle: 'Franchise en base' },
  { valeur: 'tva', libelle: 'TVA facturée' },
];

/** Identité de Label Maison (mêmes valeurs que modules/finance/_composants/entreprise.ts). */
export const IDENTITE_LABEL_MAISON: IdentiteSociete = {
  raisonSociale: 'Label Maison Conciergerie',
  forme: 'SASU',
  siret: '993 428 200 00014',
  adresse: '10 chemin des Bas Cornus, 91100 Villabé',
  regimeTva: 'franchise',
  tvaPct: TAUX_TVA_NORMAL,
};

type EspaceVu = Pick<Espace, 'id' | 'nom'>;

const ligne = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const texteLibre = (v: unknown, max: number): string =>
  typeof v === 'string'
    ? v
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((x) => x.replace(/[ \t]+/g, ' ').trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, max)
    : '';

export const chiffresSiret = (s: unknown): string => String(s ?? '').replace(/\D/g, '');
export const siretValide = (s: unknown): boolean => chiffresSiret(s).length === 14;

/** « 99342820000014 » → « 993 428 200 00014 » (tel quel s'il n'a pas 14 chiffres). */
export function formaterSiret(s: unknown): string {
  const c = chiffresSiret(s);
  return c.length === 14 ? `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6, 9)} ${c.slice(9)}` : ligne(s, 40);
}

/** Taux lisible : un nombre de 0 à 100, sinon le taux normal. */
const taux = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 100 ? Math.round(n * 100) / 100 : TAUX_TVA_NORMAL;
};

/** Identité saisie, nettoyée (champs connus seulement, longueurs bornées). */
export function normaliserIdentite(brut: Partial<IdentiteSociete> | null | undefined): IdentiteSociete {
  const regimeTva: RegimeTva = brut?.regimeTva === 'tva' ? 'tva' : 'franchise';
  const numeroTva = ligne(brut?.numeroTva, 20).toUpperCase().replace(/\s/g, '');
  const mentions = texteLibre(brut?.mentions, 600);
  return {
    raisonSociale: ligne(brut?.raisonSociale, 120),
    forme: ligne(brut?.forme, 60),
    siret: formaterSiret(brut?.siret),
    adresse: ligne(brut?.adresse, 200),
    regimeTva,
    tvaPct: taux(brut?.tvaPct),
    ...(regimeTva === 'tva' && numeroTva ? { numeroTva } : {}),
    ...(mentions ? { mentions } : {}),
  };
}

/** Identité tant que rien n'est enregistré : celle de Label Maison pour Label Maison, le nom de l'espace ailleurs. */
export function identiteParDefaut(e: EspaceVu): IdentiteSociete {
  if (estLabelMaison(e)) return { ...IDENTITE_LABEL_MAISON };
  return { raisonSociale: ligne(e.nom, 120), forme: '', siret: '', adresse: '', regimeTva: 'tva', tvaPct: TAUX_TVA_NORMAL };
}

/**
 * Identité de la conciergerie de l'espace `e` : celle enregistrée dans ses
 * réglages, sinon la valeur par défaut. `enregistree` : le gérant l'a déjà
 * enregistrée (sinon le formulaire la propose à vérifier).
 */
export function identiteConciergerie(d: { reglages?: readonly Reglage[] | null }, e: EspaceVu): IdentiteSociete & { enregistree: boolean } {
  const stocke = (d.reglages ?? []).find((r): r is ReglagesSociete => r?.id === ID_REGLAGE_SOCIETE);
  // Jamais l'identité de Label Maison pour un autre espace (sauvegarde rechargée, copie).
  const deLabelMaison = !!stocke && chiffresSiret(stocke.siret) === chiffresSiret(IDENTITE_LABEL_MAISON.siret);
  if (!stocke || (deLabelMaison && !estLabelMaison(e))) return { ...identiteParDefaut(e), enregistree: false };
  return { ...normaliserIdentite(stocke), enregistree: true };
}

/** Élément à enregistrer dans `reglages`. */
export function reglageSociete(i: Partial<IdentiteSociete>, o: { maintenant: string; par: string }): ReglagesSociete {
  return { id: 'societe', ...normaliserIdentite(i), majLe: o.maintenant, majPar: o.par };
}

export type ChampIdentite = 'raisonSociale' | 'siret' | 'adresse' | 'numeroTva' | 'tvaPct';

/** Ce qui manque ou ne va pas, champ par champ (vide : identité utilisable sur une facture). */
export function erreursIdentite(i: Partial<IdentiteSociete>): Partial<Record<ChampIdentite, string>> {
  const e: Partial<Record<ChampIdentite, string>> = {};
  if (!ligne(i.raisonSociale, 120)) e.raisonSociale = 'Indiquez la raison sociale.';
  if (!siretValide(i.siret)) e.siret = 'Le SIRET compte 14 chiffres.';
  if (!ligne(i.adresse, 200)) e.adresse = 'Indiquez l’adresse du siège.';
  if (i.regimeTva === 'tva') {
    const n = ligne(i.numeroTva, 20).replace(/\s/g, '');
    if (n && !/^[A-Z]{2}[0-9A-Z]{2,13}$/i.test(n)) e.numeroTva = 'Numéro de TVA illisible (ex. FR12345678901).';
    const t = Number(String(i.tvaPct ?? '').replace(',', '.'));
    if (!(Number.isFinite(t) && t > 0 && t <= 100)) e.tvaPct = 'Taux de TVA entre 0 et 100 %.';
  }
  return e;
}

export const identiteComplete = (i: Partial<IdentiteSociete>): boolean => Object.keys(erreursIdentite(i)).length === 0;

/** Taux de TVA facturé : 0 en franchise en base, le taux de l'espace sinon. */
export const tauxTva = (i: Pick<IdentiteSociete, 'regimeTva' | 'tvaPct'>): number => (i.regimeTva === 'franchise' ? 0 : taux(i.tvaPct));

/** Mention obligatoire en franchise en base ; aucune sinon. */
export const mentionTva = (i: Pick<IdentiteSociete, 'regimeTva'>): string | undefined => (i.regimeTva === 'franchise' ? MENTION_FRANCHISE_TVA : undefined);

/**
 * Ligne légale (en-tête d'un bilan imprimé, pied d'une facture) :
 * « Label Maison Conciergerie SASU · SIRET 993 428 200 00014 · 10 chemin… ».
 */
export function ligneLegale(i: Partial<IdentiteSociete>): string {
  const nom = [ligne(i.raisonSociale, 120), ligne(i.forme, 60)].filter(Boolean).join(' ');
  return [nom, siretValide(i.siret) ? `SIRET ${formaterSiret(i.siret)}` : '', ligne(i.adresse, 200)].filter(Boolean).join(' · ');
}
