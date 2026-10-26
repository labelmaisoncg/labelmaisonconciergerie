/**
 * Registre des modules de l'ERP : route, rubrique de la barre latérale et
 * composant chargé à la demande. Chaque module gère ses propres sous-routes :
 * il est monté sur `<segment>/*`.
 *
 * Channel manager (octobre 2026) : six rubriques, Accueil, Logements,
 * Réservations, Messagerie, CRM et Paramètres. Finance, Opérations
 * (ménages, linge, incidents, prestataires), Rentabilité, Annonces et la
 * rubrique Propriétaires sortent du menu ; leur code et leurs données restent
 * (ménages et linge reviendront avec BNB Cleaning). Leurs anciennes adresses
 * mènent vers la page la plus proche (ANCIENNES_ADRESSES).
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { BotMessageSquare, Building2, CalendarDays, House, PhoneCall, Settings, type LucideIcon } from 'lucide-react';

export type GroupeModule = 'accueil' | 'logements' | 'reservations' | 'messagerie' | 'crm' | 'parametres';

export interface Rubrique {
  cle: GroupeModule;
  libelle: string;
  icon: LucideIcon;
  /** Page ouverte par un clic dans la barre latérale. */
  path: string;
  /** Rangée en bas de la barre latérale (Paramètres). */
  bas?: boolean;
}

/** Rubriques de la barre latérale, dans l'ordre. */
export const GROUPES: Rubrique[] = [
  { cle: 'accueil', libelle: 'Accueil', icon: House, path: '/erp' },
  { cle: 'logements', libelle: 'Logements', icon: Building2, path: '/erp/logements' },
  { cle: 'reservations', libelle: 'Réservations', icon: CalendarDays, path: '/erp/reservations' },
  { cle: 'messagerie', libelle: 'Messagerie', icon: BotMessageSquare, path: '/erp/messagerie' },
  { cle: 'crm', libelle: 'CRM', icon: PhoneCall, path: '/erp/crm' },
  { cle: 'parametres', libelle: 'Paramètres', icon: Settings, path: '/erp/parametres', bas: true },
];

/** Compteurs affichables dans la barre latérale (calculés par le layout). */
export type CleCompteur = 'missionsAAttribuer' | 'messagesEnAttente' | 'incidentsOuverts' | 'contactsAAppeler';

export interface ModuleErp {
  key: string;
  /** Segment sous /erp ('' pour l'accueil). */
  segment: string;
  /** Chemin absolu, pour les liens. */
  path: string;
  /** Nom de l'onglet dans sa rubrique (et du fil d'Ariane). */
  label: string;
  group: GroupeModule;
  /** Synonymes pour la recherche « Aller à… ». */
  motsCles?: string;
  component: LazyExoticComponent<ComponentType>;
  compteur?: CleCompteur;
}

const module = (
  key: string,
  segment: string,
  label: string,
  group: GroupeModule,
  component: LazyExoticComponent<ComponentType>,
  options: { compteur?: CleCompteur; motsCles?: string } = {},
): ModuleErp => ({ key, segment, path: segment ? `/erp/${segment}` : '/erp', label, group, component, ...options });

/** L'ordre compte : c'est celui des onglets de chaque rubrique. */
export const MODULES: ModuleErp[] = [
  module('tableau-de-bord', '', 'Accueil', 'accueil', lazy(() => import('./tableau-de-bord')), { motsCles: 'tableau de bord aujourd’hui indicateurs' }),
  module('logements', 'logements', 'Logements', 'logements', lazy(() => import('./logements')), { motsCles: 'biens appartements fiches photos' }),
  module('reservations', 'reservations', 'Réservations', 'reservations', lazy(() => import('./reservations')), {
    motsCles: 'calendrier planning séjours voyageurs',
  }),
  module('messagerie', 'messagerie', 'Messagerie', 'messagerie', lazy(() => import('./messagerie')), {
    compteur: 'messagesEnAttente',
    motsCles: 'messages conversations agent ia voyageurs',
  }),
  module('crm', 'crm', 'CRM', 'crm', lazy(() => import('./crm')), {
    compteur: 'contactsAAppeler',
    motsCles: 'appels contacts formulaires demandes prospects propriétaires à appeler rappeler',
  }),
  module('parametres', 'parametres', 'Paramètres', 'parametres', lazy(() => import('./parametres')), { motsCles: 'utilisateurs équipe connexions' }),
];

/**
 * Pages hors du menu mais encore ouvertes depuis une autre page (la fiche
 * d'un propriétaire, depuis la fiche de son logement). Ni rubrique, ni
 * recherche « Aller à… ».
 */
export const MODULES_HORS_MENU: ModuleErp[] = [
  module('proprietaires', 'proprietaires', 'Propriétaire', 'logements', lazy(() => import('./proprietaires'))),
];

/** Anciennes adresses des modules sortis du menu → page la plus proche. */
export const ANCIENNES_ADRESSES: Record<string, string> = {
  performance: '/erp/logements',
  annonces: '/erp/logements',
  menages: '/erp/reservations',
  linge: '/erp/logements',
  incidents: '/erp/logements',
  prestataires: '/erp/parametres',
  mandats: '/erp/logements',
  commercial: '/erp/crm',
  finance: '/erp',
  conformite: '/erp/logements',
  automatisations: '/erp/parametres',
};

/** Module correspondant à un chemin sous /erp. */
export function moduleDuChemin(pathname: string): ModuleErp | undefined {
  const reste = pathname.replace(/^\/erp\/?/, '');
  const segment = reste.split('/')[0] ?? '';
  return MODULES.find((m) => m.segment === segment) ?? MODULES_HORS_MENU.find((m) => m.segment === segment);
}

/** Rubrique d'un module. */
export function rubriqueDe(m: ModuleErp | undefined): Rubrique | undefined {
  return m ? GROUPES.find((g) => g.cle === m.group) : undefined;
}

/** Modules d'une rubrique, dans l'ordre des onglets. */
export function modulesDe(cle: GroupeModule): ModuleErp[] {
  return MODULES.filter((m) => m.group === cle);
}
