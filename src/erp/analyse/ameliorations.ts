/**
 * Améliorations à proposer au propriétaire (ou à porter par Label Maison),
 * déduites des défauts constatés. Codes stables : le suivi des
 * recommandations (collection `recommandations`) s'appuie dessus.
 */
import { euros, nombre } from '../data/format';
import type { Logement } from '../data/types';
import type { Mesures } from './defauts';
import type { Amelioration, Defaut, Finances } from './types';

export interface EntreeAmeliorations {
  logement: Logement;
  defauts: Defaut[];
  mesures: Mesures;
  f90: Finances;
  /** Revenu brut mensuel moyen du bien (90 jours). */
  revenuMois: number;
  /** Séjours par mois (90 jours). */
  sejoursMois: number;
  /** Base commissionnable mensuelle (90 jours). */
  baseMois: number;
  medianeOccupation: number;
}

const arrondi = (c: number) => Math.max(0, Math.round(c / 500) * 500);

export function suggererAmeliorations(e: EntreeAmeliorations): Amelioration[] {
  const { logement: l, mesures: m } = e;
  const codes = new Set(e.defauts.map((d) => d.code));
  const a = (x: Amelioration) => out.push(x);
  const out: Amelioration[] = [];
  const gainOccupation = (points: number) => arrondi((e.revenuMois / Math.max(m.occupation90, 0.2)) * points);

  if (codes.has('commission_basse') && m.commissionPct !== undefined) {
    const gain = arrondi((e.baseMois * (18 - m.commissionPct)) / 100);
    a({
      code: 'commission_18', titre: 'Passer la commission à 18 % au renouvellement',
      pourquoi: `Le mandat est à ${nombre(m.commissionPct)} %, hérité des débuts. Le service actuel (agent IA, contrôle photo, linge suivi) correspond à l’offre à 18 %.`,
      impactEstime: { texte: `+${euros(gain, true)} de marge par mois pour Label Maison`, centimesMois: gain, sur: 'marge_label_maison' },
      cout: 'faible', porteur: 'label_maison', defauts: ['commission_basse', 'marge_faible', 'marge_negative'].filter((c) => codes.has(c)),
    });
  }
  if (codes.has('menage_sous_facture') && m.coutMenageMoyen !== undefined && m.fraisMenageMandat !== undefined) {
    const cible = Math.ceil((m.coutMenageMoyen * 1.25) / 500) * 500;
    const gain = arrondi((cible - m.fraisMenageMandat) * e.sejoursMois);
    a({
      code: 'frais_menage', titre: `Ajuster les frais de ménage à ${euros(cible, true)}`,
      pourquoi: 'Les frais facturés au voyageur ne couvrent pas le ménage, le linge et les produits. Payés par le voyageur, ils ne coûtent rien au propriétaire.',
      impactEstime: { texte: `+${euros(gain, true)} de marge par mois`, centimesMois: gain, sur: 'marge_label_maison' },
      cout: 'faible', porteur: 'label_maison', defauts: ['menage_sous_facture'],
    });
  }
  if (codes.has('occupation_faible') || codes.has('prix_bas')) {
    a({
      code: 'tarification_dynamique', titre: 'Tarification dynamique et séjour minimum ajusté',
      pourquoi: 'Occupation ou prix sous le parc : baisser le séjour minimum en semaine et moduler les prix selon la demande locale (événements, salons, vacances).',
      impactEstime: { texte: `+${euros(gainOccupation(0.08), true)} de revenu brut par mois (8 points d’occupation)`, centimesMois: gainOccupation(0.08), sur: 'revenu_bien' },
      cout: 'faible', porteur: 'label_maison', defauts: ['occupation_faible', 'prix_bas'].filter((c) => codes.has(c)),
    });
    a({
      code: 'photos_annonce', titre: 'Photos professionnelles et refonte de l’annonce',
      pourquoi: 'Les premières photos et le titre font l’essentiel du taux de clic. Une annonce refaite relance le classement.',
      impactEstime: { texte: `+${euros(gainOccupation(0.05), true)} de revenu brut par mois`, centimesMois: gainOccupation(0.05), sur: 'revenu_bien' },
      cout: 'faible', porteur: 'label_maison', defauts: ['occupation_faible', 'prix_bas'].filter((c) => codes.has(c)),
    });
  }
  if (codes.has('plainte_literie')) {
    a({
      code: 'literie', titre: 'Literie neuve (matelas et oreillers)',
      pourquoi: 'Plusieurs voyageurs se plaignent du couchage : c’est la première cause de notes à 4 étoiles.',
      impactEstime: { texte: '+0,2 point de note attendu' },
      cout: 'moyen', porteur: 'proprietaire', defauts: ['plainte_literie'],
    });
  }
  if (codes.has('plainte_bruit')) {
    a({
      code: 'isolation_rideaux', titre: 'Rideaux occultants et joints acoustiques',
      pourquoi: 'Le bruit revient dans les avis. Rideaux épais, joints de fenêtre et bouchons d’oreille en attention limitent la gêne sans gros travaux.',
      impactEstime: { texte: '+0,1 à 0,2 point de note attendu' },
      cout: 'faible', porteur: 'proprietaire', defauts: ['plainte_bruit'],
    });
  }
  if (codes.has('plainte_chauffage')) {
    a({
      code: 'chauffage', titre: 'Révision du chauffage et thermostat connecté',
      pourquoi: 'Le confort thermique est cité dans les avis négatifs.',
      impactEstime: { texte: 'Moins de plaintes et de déplacements l’hiver' },
      cout: 'moyen', porteur: 'proprietaire', defauts: ['plainte_chauffage'],
    });
  }
  if (codes.has('plainte_wifi') || codes.has('plainte_equipement')) {
    a({
      code: 'equipements', titre: 'Compléter les équipements cités par les voyageurs',
      pourquoi: 'Box wifi fiable, serviettes en réserve, petit électroménager : les manques relevés dans les avis coûtent des étoiles.',
      impactEstime: { texte: '+0,1 point de note, moins de messages' },
      cout: 'faible', porteur: 'proprietaire', defauts: ['plainte_wifi', 'plainte_equipement'].filter((c) => codes.has(c)),
    });
  }
  if (l.serrure !== 'connectee' && (codes.has('plainte_checkin') || codes.has('incidents_acces') || codes.has('note_faible') || m.occupation90 >= 0.6)) {
    a({
      code: 'serrure_connectee', titre: 'Installer une serrure connectée',
      pourquoi: 'Arrivées autonomes à toute heure, codes uniques par séjour, plus de boîte à clés forcée ni de clés perdues.',
      impactEstime: { texte: 'Environ 2 déplacements évités par mois', centimesMois: 6000, sur: 'marge_label_maison' },
      cout: 'moyen', porteur: 'proprietaire', defauts: ['plainte_checkin', 'incidents_acces'].filter((c) => codes.has(c)),
    });
  }
  if (codes.has('plainte_proprete') || codes.has('menages_sans_photos')) {
    a({
      code: 'controle_menage', titre: 'Contrôle qualité renforcé du ménage',
      pourquoi: 'Contrôle sur place un départ sur trois pendant un mois, et changement de prestataire si les écarts persistent.',
      impactEstime: { texte: 'Retour de la note au-dessus de 4,7' },
      cout: 'faible', porteur: 'label_maison', defauts: ['plainte_proprete', 'menages_sans_photos'].filter((c) => codes.has(c)),
    });
  }
  if (codes.has('incidents_panne') || codes.has('incidents_casse') || codes.has('entretien_proprietaire')) {
    a({
      code: 'remplacer_equipements', titre: 'Remplacer les équipements qui tombent en panne',
      pourquoi: 'Les réparations successives coûtent plus cher qu’un remplacement et dégradent les séjours.',
      impactEstime: { texte: 'Moins d’interventions d’urgence et de gestes commerciaux' },
      cout: 'moyen', porteur: 'proprietaire', defauts: ['incidents_panne', 'incidents_casse', 'entretien_proprietaire'].filter((c) => codes.has(c)),
    });
  }
  if (l.dpe === 'E' || l.dpe === 'F' || l.dpe === 'G') {
    a({
      code: 'travaux_dpe', titre: `Travaux de rénovation énergétique (DPE ${l.dpe})`,
      pourquoi: 'Isolation, fenêtres, chauffage performant : indispensable pour rester louable en meublé de tourisme (loi Le Meur) et réduire les charges.',
      impactEstime: { texte: 'Conformité assurée jusqu’en 2034' },
      cout: 'eleve', porteur: 'proprietaire', defauts: ['dpe'],
    });
  }
  // Aménagement (offre Label Maison Studio) : grand bien sous-exploité ou petit bien à démarquer.
  const grand = l.surfaceM2 >= 60 || l.capacite >= 6;
  const petit = l.type === 'studio' || l.surfaceM2 <= 32;
  if ((grand && (m.occupation90 < e.medianeOccupation || m.ratioAdr < 1)) || (petit && m.ratioAdr < 1.05 && (codes.has('occupation_faible') || codes.has('prix_bas')))) {
    a({
      code: 'amenagement_studio',
      titre: grand ? 'Réaménager pour les groupes et familles (Label Maison Studio)' : 'Concept thématique type love room (Label Maison Studio)',
      pourquoi: grand
        ? 'La surface permet un couchage de plus et un espace de télétravail : un bien pour 6 à 8 se vend plus cher la nuit.'
        : 'Un petit bien se démarque par une mise en scène forte (suite romantique, spa) : prix par nuit bien supérieur à un studio standard.',
      impactEstime: { texte: `+${euros(arrondi(e.revenuMois * 0.15), true)} de revenu brut par mois (prix +15 %)`, centimesMois: arrondi(e.revenuMois * 0.15), sur: 'revenu_bien' },
      cout: 'eleve', porteur: 'proprietaire', defauts: ['occupation_faible', 'prix_bas'].filter((c) => codes.has(c)),
    });
  }
  if (codes.has('plafond_120')) {
    a({
      code: 'prix_plafond', titre: 'Réserver les nuits restantes aux dates les plus chères',
      pourquoi: 'Résidence principale proche du plafond de 120 nuits : chaque nuit restante doit être vendue au meilleur prix (week-ends, salons, fêtes), avec un séjour minimum de 2 nuits.',
      impactEstime: { texte: 'Même nombre de nuits, prix moyen +10 à 15 %' },
      cout: 'faible', porteur: 'label_maison', defauts: ['plafond_120'],
    });
  }
  return out;
}
