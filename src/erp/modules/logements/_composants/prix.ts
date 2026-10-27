/**
 * Prix conseillés dans l'ERP : calcul à partir du store (réglages et
 * décisions de la collection `conseilsPrix`) et liens vers le calendrier de
 * l'annonce sur chaque plateforme. Un lien s'ouvre chez Airbnb ou Booking :
 * c'est l'équipe qui y change le prix, jamais l'ERP.
 */
import { AUJOURDHUI, MAINTENANT } from '../../../data/format';
import { idAirbnbDuLogement } from '../../../data/page-airbnb';
import { conseillerPrix, lireElementsPrix, type PlagePrix } from '../../../data/prix-conseils';
import type { ErpDonnees, Logement } from '../../../data/types';

/**
 * Les prix sont l'affaire du gérant (c'est lui qui les change sur Airbnb
 * et Booking) : la ligne « prix à revoir » de l'Accueil (construireATraiter,
 * `gerant`) et la carte « Prix conseillés » du logement sont pour lui seul,
 * jamais pour les opérations ni la lecture seule. Le prévisionnel reste
 * visible de tous les membres.
 */
export const voitPrixConseilles = (u: { role: string }, lectureSeule = false): boolean => u.role === 'gerant' && !lectureSeule;

/** Les conseils du jour (tous les logements, ou un seul), avec les réglages et décisions de l'espace. */
export function conseilsDuJour(d: Pick<ErpDonnees, 'logements' | 'reservations' | 'conseilsPrix'>, logementId?: string): PlagePrix[] {
  const { reglages, decisions } = lireElementsPrix(d.conseilsPrix);
  return conseillerPrix({
    logements: d.logements,
    reservations: d.reservations,
    reglages,
    decisions,
    aujourdhui: AUJOURDHUI,
    maintenant: MAINTENANT,
    ...(logementId ? { logementId } : {}),
  });
}

export interface LienCalendrier {
  plateforme: 'Airbnb' | 'Booking.com';
  url: string;
}

/**
 * Où changer le prix : le calendrier de l'annonce Airbnb (espace hôte), ou
 * l'extranet de Booking.com (l'établissement s'y choisit après connexion).
 * Rien n'est envoyé : ce sont de simples liens.
 */
export function liensCalendrier(l: Logement): LienCalendrier[] {
  const liens: LienCalendrier[] = [];
  const airbnb = idAirbnbDuLogement(l);
  if (airbnb) liens.push({ plateforme: 'Airbnb', url: `https://www.airbnb.fr/multicalendar/${airbnb}` });
  const surBooking = l.annonces.some((a) => a.canal === 'booking') || (l.repull?.canaux ?? []).some((c) => /booking/i.test(c.plateforme));
  if (surBooking) liens.push({ plateforme: 'Booking.com', url: 'https://admin.booking.com/' });
  return liens;
}
