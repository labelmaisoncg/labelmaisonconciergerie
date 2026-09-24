/**
 * Détection des défauts d'un bien à partir des données de l'ERP.
 * Chaque défaut a un code stable (repris par les améliorations et le suivi).
 */
import { PLAFOND_NUITS_RESIDENCE_PRINCIPALE } from '../data/constantes';
import { euros, nombre, pourcentage } from '../data/format';
import type { CategorieIncident, Incident, Logement, Reservation } from '../data/types';
import type { Defaut } from './types';

/** Thèmes de plainte repérés dans les commentaires des avis négatifs (< 4,6). */
export const THEMES_PLAINTE = {
  proprete: { libelle: 'propreté', motif: /calcaire|sale|cheveu|poussi|trace|odeur|propret|tache/i },
  bruit: { libelle: 'bruit', motif: /bruit|bruyant|fen[eê]tre|isolation|voisin/i },
  literie: { libelle: 'literie', motif: /literie|matelas|oreiller|mal dormi|sommier/i },
  chauffage: { libelle: 'chauffage', motif: /chauffage|froid|radiateur|clim/i },
  wifi: { libelle: 'wifi', motif: /wifi|wi-fi|internet|connexion/i },
  equipement: { libelle: 'équipement', motif: /manquait|manque|vaisselle|serviette|cafeti|équipement|equipement/i },
  checkin: { libelle: 'arrivée / clés', motif: /check-in|cl[ée]s?\b|clef|bo[iî]te [àa] cl|code d.acc|attendu|attente/i },
} as const;

export type ThemePlainte = keyof typeof THEMES_PLAINTE;

/** Nombre de mentions par thème dans les avis négatifs. */
export function plaintesParTheme(reservations: Reservation[]): Record<ThemePlainte, number> {
  const compte = Object.fromEntries(Object.keys(THEMES_PLAINTE).map((k) => [k, 0])) as Record<ThemePlainte, number>;
  for (const r of reservations) {
    if (r.noteVoyageur === undefined || r.noteVoyageur >= 4.6 || !r.commentaireVoyageur) continue;
    for (const [cle, t] of Object.entries(THEMES_PLAINTE) as [ThemePlainte, (typeof THEMES_PLAINTE)[ThemePlainte]][]) {
      if (t.motif.test(r.commentaireVoyageur)) compte[cle] += 1;
    }
  }
  return compte;
}

export interface Mesures {
  logement: Logement;
  occupation90: number;
  medianeOccupation: number;
  ratioAdr: number;
  ratioRevpar: number;
  note12?: number;
  nbAvis12: number;
  plaintes: Record<ThemePlainte, number>;
  incidents12: Incident[];
  pertesLinge12: number;
  commissionPct?: number;
  couvertureMenage?: number;
  coutMenageMoyen?: number;
  fraisMenageMandat?: number;
  nuitsAnnee?: number;
  margeMois: number;
  marge90: number;
  moisNegatifsConsecutifs: number;
  tauxPhotos?: number;
  delaiReponse?: number;
  aDonnees: boolean;
}

const LIBELLE_CATEGORIE: Partial<Record<CategorieIncident, string>> = { casse: 'casse', panne: 'panne', acces: 'accès' };

export function detecterDefauts(m: Mesures): Defaut[] {
  const out: Defaut[] = [];
  const l = m.logement;
  const ajouter = (d: Defaut) => out.push(d);

  if (m.aDonnees && m.occupation90 < 0.55) {
    ajouter({
      code: 'occupation_faible', gravite: m.occupation90 < 0.4 ? 'haute' : 'moyenne', source: 'reservations',
      titre: 'Occupation faible',
      detail: `${pourcentage(m.occupation90)} sur 90 jours, contre ${pourcentage(m.medianeOccupation)} en médiane du parc.`,
    });
  }
  if (m.aDonnees && m.ratioAdr < 0.85) {
    ajouter({
      code: 'prix_bas', gravite: 'faible', source: 'reservations', titre: 'Prix moyen sous le parc',
      detail: `Prix moyen par nuit ${nombre((1 - m.ratioAdr) * 100)} % sous la médiane du parc.`,
    });
  }
  if (m.note12 !== undefined && m.note12 < 4.6) {
    ajouter({
      code: 'note_faible', gravite: m.note12 < 4.4 ? 'haute' : 'moyenne', source: 'avis', titre: 'Note voyageurs basse',
      detail: `${nombre(m.note12, 2)} / 5 sur ${m.nbAvis12} avis (seuil 4,6). Le classement de l’annonce en pâtit.`,
    });
  }
  for (const [cle, n] of Object.entries(m.plaintes) as [ThemePlainte, number][]) {
    if (n < 2) continue;
    ajouter({
      code: `plainte_${cle}`, gravite: n >= 3 ? 'haute' : 'moyenne', source: 'avis',
      titre: `Plaintes récurrentes : ${THEMES_PLAINTE[cle].libelle}`,
      detail: `${n} avis négatifs citent ${THEMES_PLAINTE[cle].libelle === 'wifi' ? 'le wifi' : `un problème de ${THEMES_PLAINTE[cle].libelle}`} sur 12 mois.`,
    });
  }
  for (const cat of ['casse', 'panne', 'acces'] as const) {
    const liste = m.incidents12.filter((i) => i.categorie === cat);
    if (liste.length < 2) continue;
    ajouter({
      code: `incidents_${cat}`, gravite: liste.length >= 3 ? 'haute' : 'moyenne', source: 'incidents',
      titre: `Incidents répétés : ${LIBELLE_CATEGORIE[cat]}`,
      detail: `${liste.length} incidents « ${LIBELLE_CATEGORIE[cat]} » en 12 mois (${liste.map((i) => i.description.split('.')[0]).slice(0, 2).join(' ; ')}).`,
    });
  }
  if (m.pertesLinge12 >= 2) {
    ajouter({
      code: 'pertes_linge', gravite: 'faible', source: 'linge', titre: 'Pertes de linge',
      detail: `${m.pertesLinge12} articles perdus ou mis au rebut en 12 mois.`,
    });
  }
  if (m.commissionPct !== undefined && m.commissionPct < 18) {
    ajouter({
      code: 'commission_basse', gravite: m.commissionPct <= 12 ? 'haute' : 'moyenne', source: 'mandat',
      titre: 'Commission sous la cible',
      detail: `Mandat à ${nombre(m.commissionPct)} % pour une cible de 18 à 20 %.`,
    });
  }
  if (m.couvertureMenage !== undefined && m.couvertureMenage < 1.15 && m.fraisMenageMandat !== undefined && m.coutMenageMoyen !== undefined) {
    ajouter({
      code: 'menage_sous_facture', gravite: m.couvertureMenage < 1 ? 'moyenne' : 'faible', source: 'mandat',
      titre: 'Frais de ménage trop bas',
      detail: `Facturés ${euros(m.fraisMenageMandat)} au voyageur pour un coût moyen de ${euros(Math.round(m.coutMenageMoyen))} (linge et produits non couverts).`,
    });
  }
  if (l.dpe === 'F' || l.dpe === 'G' || l.dpe === 'E') {
    ajouter({
      code: 'dpe', gravite: l.dpe === 'E' ? 'faible' : 'haute', source: 'conformite', titre: `DPE ${l.dpe}`,
      detail: l.dpe === 'G'
        ? 'Classe G : location meublée de tourisme interdite (loi Le Meur).'
        : l.dpe === 'F' ? 'Classe F : interdite à la location de tourisme en 2028 sans travaux.' : 'Classe E : travaux à prévoir avant 2034.',
    });
  }
  if (!l.numeroEnregistrement) {
    ajouter({
      code: 'numero_manquant', gravite: 'haute', source: 'conformite', titre: 'N° d’enregistrement manquant',
      detail: 'Obligatoire sur toutes les annonces : sans lui, le bien ne peut pas être publié.',
    });
  }
  if (l.residencePrincipale && m.nuitsAnnee !== undefined) {
    const restant = PLAFOND_NUITS_RESIDENCE_PRINCIPALE - m.nuitsAnnee;
    if (restant <= 25) {
      ajouter({
        code: 'plafond_120', gravite: restant <= 0 ? 'haute' : 'moyenne', source: 'conformite', titre: 'Plafond des 120 nuits proche',
        detail: `${m.nuitsAnnee} nuits vendues cette année, ${Math.max(0, restant)} restantes. Le bien sera fermé une partie de l’année.`,
      });
    }
  }
  const aLaChargeProprio = m.incidents12.filter((i) => i.refacturable === 'proprietaire');
  const ouvertsProprio = aLaChargeProprio.filter((i) => i.statut !== 'resolu');
  if (ouvertsProprio.length || aLaChargeProprio.length >= 2) {
    const total = aLaChargeProprio.reduce((s, i) => s + (i.coutCentimes ?? 0), 0);
    ajouter({
      code: 'entretien_proprietaire', gravite: ouvertsProprio.length ? 'moyenne' : 'faible', source: 'incidents',
      titre: 'Entretien à la charge du propriétaire',
      detail: `${aLaChargeProprio.length} réparation${aLaChargeProprio.length > 1 ? 's' : ''} refacturée${aLaChargeProprio.length > 1 ? 's' : ''} (${euros(total, true)}), dont ${ouvertsProprio.length} non résolue${ouvertsProprio.length > 1 ? 's' : ''}.`,
    });
  }
  if (m.aDonnees && m.marge90 < 0) {
    ajouter({
      code: 'marge_negative', gravite: 'haute', source: 'finance', titre: 'Marge négative',
      detail: `Le bien coûte ${euros(-m.margeMois, true)} par mois à Label Maison${m.moisNegatifsConsecutifs >= 2 ? ` (${m.moisNegatifsConsecutifs} mois de suite)` : ''}.`,
    });
  } else if (m.aDonnees && m.margeMois < 10000) {
    ajouter({
      code: 'marge_faible', gravite: 'moyenne', source: 'finance', titre: 'Marge faible',
      detail: `${euros(m.margeMois, true)} de marge par mois, sous le seuil de 100 €.`,
    });
  }
  if (m.tauxPhotos !== undefined && m.tauxPhotos < 0.85) {
    ajouter({
      code: 'menages_sans_photos', gravite: 'faible', source: 'operations', titre: 'Ménages sans preuves',
      detail: `${pourcentage(m.tauxPhotos)} des ménages validés avec photos avant et après (cible 95 %).`,
    });
  }
  if (m.delaiReponse !== undefined && m.delaiReponse > 60) {
    ajouter({
      code: 'reponse_lente', gravite: 'faible', source: 'messagerie', titre: 'Réponses lentes aux voyageurs',
      detail: `${nombre(m.delaiReponse)} minutes en moyenne pour répondre (cible 15 minutes).`,
    });
  }
  const ordre = { haute: 0, moyenne: 1, faible: 2 };
  return out.sort((a, b) => ordre[a.gravite] - ordre[b.gravite]);
}
