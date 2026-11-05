/**
 * Nouveau mandat de gestion, pas à pas (modules/mandats/FormMandat.tsx :
 * fiche logement « Ajouter son mandat », factures du propriétaire « mandat à
 * saisir », liste des contrats) : déjà signé ou non (quand on le propose),
 * le propriétaire, le logement, la commission, les frais de ménage, les
 * dates, le préavis, puis le récapitulatif. La modification garde sa fenêtre.
 *
 * Mêmes règles et même mandat que l'ancien formulaire : commission entre 0
 * et 50 %, frais de ménage en euros, date de début, fin d'essai après le
 * début, préavis en jours, un seul mandat en cours par logement et
 * propriétaire ; référence LM-M-année-numéro ; « brouillon », ou « signé »
 * dès la date de début quand il l'est déjà.
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */
import { COMMISSION_CIBLE_MIN } from './constantes';
import { ajouterJours, versCentimes } from './format';
import type { DateISO, Id, Mandat } from './types';

export type EcranMandat = 'signe' | 'proprietaire' | 'logement' | 'commission' | 'menage' | 'dates' | 'preavis' | 'recapitulatif';

/** Écrans du parcours : « déjà signé » seulement quand on le propose (après un changement de propriétaire). */
export const ecransMandat = (proposerSigne: boolean): EcranMandat[] => [
  ...(proposerSigne ? (['signe'] as const) : []),
  'proprietaire',
  'logement',
  'commission',
  'menage',
  'dates',
  'preavis',
  'recapitulatif',
];

export interface BrouillonMandat {
  proprietaireId: Id;
  logementId: Id;
  commissionPct: string;
  fraisMenage: string;
  dateDebut: DateISO;
  periodeEssaiFin: DateISO;
  preavisJours: string;
  /** Mandat déjà signé (proposé après un changement de propriétaire). */
  signe: boolean;
}

export interface PreselectionMandat {
  proprietaireId?: Id;
  logementId?: Id;
  dateDebut?: DateISO;
  dejaSigne?: boolean;
}

/** Départ, comme l'ancien formulaire : commission cible basse, 45 € de ménage, début dans 14 jours, essai de 92 jours, 90 jours de préavis. */
export function brouillonMandat(p: PreselectionMandat | undefined, aujourdhui: DateISO): BrouillonMandat {
  const debut = p?.dateDebut ?? ajouterJours(aujourdhui, 14);
  return {
    proprietaireId: p?.proprietaireId ?? '',
    logementId: p?.logementId ?? '',
    commissionPct: String(COMMISSION_CIBLE_MIN),
    fraisMenage: '45',
    dateDebut: debut,
    periodeEssaiFin: ajouterJours(p?.dateDebut ?? ajouterJours(aujourdhui, 14), 92),
    preavisJours: '90',
    signe: !!p?.dejaSigne,
  };
}

/** Choix et paire de dates : les choix sont dits au-dessus de « Continuer ». */
export const SANS_CHAMP_MANDAT = new Set(['signe', 'proprietaireId', 'logementId']);

export const pourcentage = (b: Pick<BrouillonMandat, 'commissionPct'>): number => Number(b.commissionPct.replace(',', '.'));

const CHAMPS: Record<Exclude<EcranMandat, 'recapitulatif'>, string[]> = {
  signe: [],
  proprietaire: ['proprietaireId'],
  logement: ['logementId'],
  commission: ['commissionPct'],
  menage: ['fraisMenage'],
  dates: ['dateDebut', 'periodeEssaiFin'],
  preavis: ['preavisJours'],
};

/** Toutes les erreurs de la saisie (règles de l'ancien formulaire). */
function erreursSaisie(b: BrouillonMandat, mandats: readonly Mandat[]): Record<string, string> {
  const e: Record<string, string> = {};
  if (!b.proprietaireId) e.proprietaireId = 'Choisissez le propriétaire.';
  if (!b.logementId) e.logementId = 'Choisissez le logement.';
  const pct = pourcentage(b);
  if (!(pct > 0 && pct <= 50)) e.commissionPct = 'Pourcentage entre 0 et 50.';
  if (!(versCentimes(b.fraisMenage) >= 0)) e.fraisMenage = 'Montant en euros, ex. 45 ou 45,50.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.dateDebut)) e.dateDebut = 'Indiquez la date de début.';
  if (b.periodeEssaiFin && b.periodeEssaiFin <= b.dateDebut) e.periodeEssaiFin = 'La fin d’essai doit être après la date de début.';
  if (!/^\d+$/.test(b.preavisJours)) e.preavisJours = 'Indiquez un nombre de jours.';
  const doublon = mandats.find((m) => m.logementId === b.logementId && m.proprietaireId === b.proprietaireId && (m.statut === 'signe' || m.statut === 'envoye'));
  if (doublon) e.logementId = `Ce logement a déjà un mandat en cours (${doublon.reference}).`;
  return e;
}

/** Erreurs d'un écran, dans l'ordre de l'écran ; le récapitulatif réunit celles de tous les écrans. */
export function erreursMandat(ecran: EcranMandat, b: BrouillonMandat, mandats: readonly Mandat[]): Record<string, string> {
  const e = erreursSaisie(b, mandats);
  const champs = ecran === 'recapitulatif' ? Object.values(CHAMPS).flat() : CHAMPS[ecran];
  const r: Record<string, string> = {};
  for (const k of champs) if (e[k]) r[k] = e[k];
  return r;
}

export function ecranDuChampMandat(cle: string): EcranMandat {
  for (const [ecran, champs] of Object.entries(CHAMPS)) if (champs.includes(cle)) return ecran as EcranMandat;
  return 'recapitulatif';
}

/** Référence suivante de l'année : LM-M-2026-001, 002… */
export function prochaineReference(mandats: readonly Mandat[], aujourdhui: DateISO): string {
  const annee = aujourdhui.slice(0, 4);
  const max = mandats
    .map((m) => m.reference.match(new RegExp(`^LM-M-${annee}-(\\d+)$`))?.[1])
    .filter(Boolean)
    .reduce((a, n) => Math.max(a, Number(n)), 0);
  return `LM-M-${annee}-${String(max + 1).padStart(3, '0')}`;
}

export type ResultatMandat = { ok: true; mandat: Mandat } | { ok: false; ecran: EcranMandat; erreur: string };

/** Ce qu'enregistre « Créer le mandat » : le même mandat que l'ancien formulaire. */
export function mandatDepuisBrouillon(b: BrouillonMandat, o: { mandats: readonly Mandat[]; id: Id; aujourdhui: DateISO; proposerSigne: boolean }): ResultatMandat {
  const erreurs = Object.entries(erreursMandat('recapitulatif', b, o.mandats));
  if (erreurs.length) return { ok: false, ecran: ecranDuChampMandat(erreurs[0][0]), erreur: erreurs[0][1] };
  const reference = prochaineReference(o.mandats, o.aujourdhui);
  return {
    ok: true,
    mandat: {
      ...(o.proposerSigne && b.signe
        ? { id: o.id, reference, statut: 'signe' as const, signeLe: b.dateDebut, documentUrl: undefined }
        : { id: o.id, reference, statut: 'brouillon' as const, documentUrl: undefined }),
      proprietaireId: b.proprietaireId,
      logementId: b.logementId,
      commissionPct: pourcentage(b),
      fraisMenageCentimes: versCentimes(b.fraisMenage),
      dateDebut: b.dateDebut,
      periodeEssaiFin: b.periodeEssaiFin || undefined,
      preavisJours: Number(b.preavisJours),
    },
  };
}

/** Lignes du récapitulatif ; `nom*` : noms lisibles, `jour` et `euros` : formats. */
export function recapMandat(
  b: BrouillonMandat,
  o: { proposerSigne: boolean; nomProprietaire: (id: Id) => string; nomLogement: (id: Id) => string; jour: (iso: DateISO) => string; euros: (c: number) => string },
): { cle: string; ecran: Exclude<EcranMandat, 'recapitulatif'>; libelle: string; valeur: string }[] {
  const frais = versCentimes(b.fraisMenage);
  const pct = pourcentage(b);
  const nb = ' ';
  return [
    ...(o.proposerSigne ? [{ cle: 'signe', ecran: 'signe' as const, libelle: 'Statut', valeur: b.signe ? `Déjà signé${nb}: il s’applique dès la date de début` : 'Brouillon, à envoyer puis à signer' }] : []),
    { cle: 'proprietaire', ecran: 'proprietaire', libelle: 'Propriétaire', valeur: b.proprietaireId ? o.nomProprietaire(b.proprietaireId) : '' },
    { cle: 'logement', ecran: 'logement', libelle: 'Logement', valeur: b.logementId ? o.nomLogement(b.logementId) : '' },
    { cle: 'commission', ecran: 'commission', libelle: 'Commission', valeur: pct > 0 && pct <= 50 ? `${String(pct).replace('.', ',')}${nb}%` : '' },
    { cle: 'menage', ecran: 'menage', libelle: 'Frais de ménage', valeur: frais >= 0 ? `${o.euros(frais)} par séjour` : '' },
    {
      cle: 'dates',
      ecran: 'dates',
      libelle: 'Dates',
      valeur: /^\d{4}-\d{2}-\d{2}$/.test(b.dateDebut) ? `Début le ${o.jour(b.dateDebut)}${b.periodeEssaiFin ? `, essai jusqu’au ${o.jour(b.periodeEssaiFin)}` : ', sans période d’essai'}` : '',
    },
    { cle: 'preavis', ecran: 'preavis', libelle: 'Préavis', valeur: /^\d+$/.test(b.preavisJours) ? `${b.preavisJours}${nb}jours` : '' },
  ];
}
