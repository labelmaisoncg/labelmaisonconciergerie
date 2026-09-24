/**
 * Brouillon du lancement d'un mandat : validation par étape et construction
 * des entités (propriétaire, logement en lancement, mandat envoyé).
 */
import { addMonths, format, parseISO } from 'date-fns';
import { CHECKLIST_LANCEMENT, COMMISSION_CIBLE_MIN } from '../../../../data/constantes';
import { AUJOURDHUI, ajouterJours, versCentimes } from '../../../../data/format';
import { nouvelId } from '../../../../data/store';
import type { Logement, Mandat, Proprietaire, Prospect, Serrure, TypeLogement, TypeProprietaire } from '../../../../data/types';

export interface BrouillonLancement {
  prospectId: string;
  modeProprio: 'nouveau' | 'existant';
  proprietaireId: string;
  propType: TypeProprietaire;
  propNom: string;
  email: string;
  telephone: string;
  propAdresse: string;
  logNom: string;
  adresse: string;
  ville: string;
  codePostal: string;
  type: TypeLogement;
  surface: string;
  capacite: string;
  chambres: string;
  residencePrincipale: boolean;
  serrure: Serrure;
  commissionPct: string;
  fraisMenage: string;
  dateDebut: string;
  dureeMois: string;
  essai: boolean;
  preavisJours: string;
  checklistComprise: boolean;
}

export type Erreurs = Partial<Record<keyof BrouillonLancement, string>>;

export function ajouterMois(date: string, n: number): string {
  return format(addMonths(parseISO(date), n), 'yyyy-MM-dd');
}

function typeDepuis(texte: string): TypeLogement {
  const m = texte.match(/studio|maison|T[1-4]/i);
  if (!m) return 'T2';
  const v = m[0];
  if (/studio/i.test(v)) return 'studio';
  if (/maison/i.test(v)) return 'maison';
  return v.toUpperCase() as TypeLogement;
}

export function brouillonInitial(p?: Prospect): BrouillonLancement {
  const type = p ? typeDepuis(p.typeBien) : 'T2';
  const surface = p?.typeBien.match(/(\d+)\s*m²/)?.[1] ?? '';
  return {
    prospectId: p?.id ?? '',
    modeProprio: 'nouveau',
    proprietaireId: '',
    propType: p?.nom.startsWith('SCI') ? 'sci' : 'particulier',
    propNom: p?.nom ?? '',
    email: '',
    telephone: '',
    propAdresse: '',
    logNom: p ? `${p.ville} ${type === 'maison' ? 'Maison' : type}` : '',
    adresse: '',
    ville: p?.ville ?? '',
    codePostal: '',
    type,
    surface,
    capacite: type === 'studio' ? '2' : type === 'T2' ? '4' : '6',
    chambres: type === 'studio' ? '0' : type === 'T2' ? '1' : '2',
    residencePrincipale: false,
    serrure: 'boite_a_cles',
    commissionPct: '18',
    fraisMenage: '45',
    dateDebut: ajouterJours(AUJOURDHUI, 14),
    dureeMois: '12',
    essai: true,
    preavisJours: '90',
    checklistComprise: false,
  };
}

const entier = (v: string, min: number, max: number) => /^\d+$/.test(v.trim()) && Number(v) >= min && Number(v) <= max;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validerEtape(etape: number, b: BrouillonLancement): Erreurs {
  const e: Erreurs = {};
  if (etape === 0) {
    if (b.modeProprio === 'existant') {
      if (!b.proprietaireId) e.proprietaireId = 'Choisissez le propriétaire.';
    } else {
      if (b.propNom.trim().length < 2) e.propNom = 'Nom du propriétaire requis.';
      if (!b.email.trim() && !b.telephone.trim()) e.telephone = 'Un e-mail ou un téléphone au minimum.';
      if (b.email.trim() && !EMAIL.test(b.email.trim())) e.email = 'Adresse e-mail invalide.';
    }
  }
  if (etape === 1) {
    if (b.logNom.trim().length < 3) e.logNom = 'Donnez un nom interne au logement.';
    if (!b.adresse.trim()) e.adresse = 'Adresse requise.';
    if (!b.ville.trim()) e.ville = 'Ville requise.';
    if (!/^\d{5}$/.test(b.codePostal.trim())) e.codePostal = 'Code postal à 5 chiffres.';
    if (!entier(b.surface, 8, 1000)) e.surface = 'Surface en m² (8 à 1000).';
    if (!entier(b.capacite, 1, 30)) e.capacite = 'Capacité de 1 à 30 personnes.';
    if (!entier(b.chambres, 0, 15)) e.chambres = 'Nombre de chambres (0 pour un studio).';
  }
  if (etape === 2) {
    const c = Number(b.commissionPct.replace(',', '.'));
    if (!Number.isFinite(c) || c <= 0 || c > 40) e.commissionPct = 'Commission entre 1 et 40 %.';
    const f = versCentimes(b.fraisMenage);
    if (!Number.isFinite(f) || f < 0) e.fraisMenage = 'Montant en euros.';
    if (!b.dateDebut) e.dateDebut = 'Date de début requise.';
    else if (b.dateDebut < AUJOURDHUI) e.dateDebut = 'Le mandat ne peut pas démarrer dans le passé.';
    if (!entier(b.dureeMois, 1, 120)) e.dureeMois = 'Durée en mois (1 à 120).';
    if (!entier(b.preavisJours, 0, 365)) e.preavisJours = 'Préavis en jours (0 à 365).';
  }
  if (etape === 3 && !b.checklistComprise) e.checklistComprise = 'Confirmez avoir compris que la checklist est bloquante.';
  return e;
}

export const sousCible = (b: BrouillonLancement) => Number(b.commissionPct.replace(',', '.')) < COMMISSION_CIBLE_MIN;

export function prochaineReference(mandats: Mandat[], annee = AUJOURDHUI.slice(0, 4)): string {
  const prefixe = `LM-M-${annee}-`;
  const max = mandats
    .filter((m) => m.reference.startsWith(prefixe))
    .reduce((s, m) => Math.max(s, Number(m.reference.slice(prefixe.length)) || 0), 0);
  return `${prefixe}${String(max + 1).padStart(3, '0')}`;
}

export function construire(b: BrouillonLancement, mandats: Mandat[], prospect?: Prospect) {
  const proprietaire: Proprietaire | undefined =
    b.modeProprio === 'nouveau'
      ? {
          id: nouvelId('pro'),
          type: b.propType,
          nom: b.propNom.trim(),
          contact: { email: b.email.trim(), telephone: b.telephone.trim() },
          adresse: b.propAdresse.trim(),
          ibanMasque: '',
          notes: prospect ? `Issu du pipeline commercial (${prospect.nom}). ${prospect.notes}`.trim() : '',
          creeLe: AUJOURDHUI,
        }
      : undefined;
  const proprietaireId = proprietaire?.id ?? b.proprietaireId;
  const chambres = Number(b.chambres);
  const logement: Logement = {
    id: nouvelId('log'),
    nom: b.logNom.trim(),
    adresse: b.adresse.trim(),
    ville: b.ville.trim(),
    codePostal: b.codePostal.trim(),
    type: b.type,
    surfaceM2: Number(b.surface),
    capacite: Number(b.capacite),
    chambres,
    lits: [{ type: 'double', nombre: Math.max(1, chambres) }],
    statut: 'lancement',
    proprietaireId,
    residencePrincipale: b.residencePrincipale,
    serrure: b.serrure,
    fiche: { wifiNom: '', wifiCode: '', heureArrivee: '16:00', heureDepart: '11:00', acces: '', parking: '', regles: '', equipements: [] },
    dotationLinge: [],
    annonces: [],
    checklistLancement: CHECKLIST_LANCEMENT.map((c) => ({ cle: c.cle, libelle: c.libelle, fait: false })),
  };
  const mandat: Mandat = {
    id: nouvelId('man'),
    proprietaireId,
    logementId: logement.id,
    reference: prochaineReference(mandats),
    statut: 'envoye',
    commissionPct: Number(b.commissionPct.replace(',', '.')),
    fraisMenageCentimes: versCentimes(b.fraisMenage),
    dateDebut: b.dateDebut,
    dateFin: ajouterMois(b.dateDebut, Number(b.dureeMois)),
    periodeEssaiFin: b.essai ? ajouterMois(b.dateDebut, 1) : undefined,
    preavisJours: Number(b.preavisJours),
  };
  return { proprietaire, logement, mandat };
}
