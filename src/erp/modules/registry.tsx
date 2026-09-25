/**
 * Registre des modules de l'ERP : route, rubrique de la barre latérale et
 * composant chargé à la demande. Chaque module gère ses propres sous-routes :
 * il est monté sur `<segment>/*`.
 *
 * Navigation simplifiée (septembre 2026) : sept rubriques dans la barre
 * latérale, plus Paramètres en bas. Une rubrique qui regroupe plusieurs
 * modules affiche une petite barre d'onglets sous l'en-tête (voir
 * layout/OngletsRubrique.tsx) ; les anciennes adresses restent valables.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { BotMessageSquare, CalendarDays, Home, House, Settings, Sparkles, Users, Wallet, type LucideIcon } from 'lucide-react';

export type GroupeModule =
  | 'accueil'
  | 'logements'
  | 'reservations'
  | 'messagerie'
  | 'operations'
  | 'proprietaires'
  | 'finance'
  | 'parametres';

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
  { cle: 'logements', libelle: 'Logements', icon: Home, path: '/erp/logements' },
  { cle: 'reservations', libelle: 'Réservations', icon: CalendarDays, path: '/erp/reservations' },
  { cle: 'messagerie', libelle: 'Messagerie agentique', icon: BotMessageSquare, path: '/erp/messagerie' },
  { cle: 'operations', libelle: 'Opérations', icon: Sparkles, path: '/erp/menages' },
  { cle: 'proprietaires', libelle: 'Propriétaires', icon: Users, path: '/erp/proprietaires' },
  { cle: 'finance', libelle: 'Finance', icon: Wallet, path: '/erp/finance' },
  { cle: 'parametres', libelle: 'Paramètres', icon: Settings, path: '/erp/parametres', bas: true },
];

/** Compteurs affichables dans la barre latérale (calculés par le layout). */
export type CleCompteur = 'missionsAAttribuer' | 'messagesEnAttente' | 'incidentsOuverts';

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
  module('tableau-de-bord', '', 'Accueil', 'accueil', lazy(() => import('./tableau-de-bord')), { motsCles: 'tableau de bord aujourd’hui' }),
  module('logements', 'logements', 'Vos logements', 'logements', lazy(() => import('./logements')), { motsCles: 'biens appartements fiches' }),
  module('performance', 'performance', 'Rentabilité', 'logements', lazy(() => import('./performance')), {
    motsCles: 'performance marge analyse recommandations',
  }),
  module('annonces', 'annonces', 'Annonces', 'logements', lazy(() => import('./annonces')), { motsCles: 'descriptions airbnb booking textes' }),
  module('reservations', 'reservations', 'Réservations', 'reservations', lazy(() => import('./reservations')), {
    motsCles: 'calendrier séjours voyageurs',
  }),
  module('messagerie', 'messagerie', 'Messagerie agentique', 'messagerie', lazy(() => import('./messagerie')), {
    compteur: 'messagesEnAttente',
    motsCles: 'messages conversations agent ia voyageurs',
  }),
  module('menages', 'menages', 'Ménages', 'operations', lazy(() => import('./menages')), {
    compteur: 'missionsAAttribuer',
    motsCles: 'missions planning nettoyage',
  }),
  module('linge', 'linge', 'Linge', 'operations', lazy(() => import('./linge')), { motsCles: 'draps serviettes blanchisserie' }),
  module('incidents', 'incidents', 'Incidents', 'operations', lazy(() => import('./incidents')), {
    compteur: 'incidentsOuverts',
    motsCles: 'casse panne maintenance',
  }),
  module('prestataires', 'prestataires', 'Prestataires', 'operations', lazy(() => import('./prestataires')), { motsCles: 'équipe ménage artisans' }),
  module('proprietaires', 'proprietaires', 'Propriétaires', 'proprietaires', lazy(() => import('./proprietaires')), { motsCles: 'clients' }),
  module('mandats', 'mandats', 'Contrats de gestion', 'proprietaires', lazy(() => import('./mandats')), { motsCles: 'mandats contrats signature' }),
  module('commercial', 'commercial', 'Prospection', 'proprietaires', lazy(() => import('./commercial')), {
    motsCles: 'commercial pipeline prospects simulateur',
  }),
  module('finance', 'finance', 'Finance', 'finance', lazy(() => import('./finance')), { motsCles: 'factures paiements relevés charges' }),
  module('conformite', 'conformite', 'Conformité', 'finance', lazy(() => import('./conformite')), { motsCles: 'déclarations mairie assurances documents' }),
  module('parametres', 'parametres', 'Paramètres', 'parametres', lazy(() => import('./parametres')), { motsCles: 'utilisateurs équipe intégrations' }),
  module('automatisations', 'automatisations', 'Automatisations', 'parametres', lazy(() => import('./automatisations')), { motsCles: 'règles automatiques' }),
];

/** Module correspondant à un chemin sous /erp. */
export function moduleDuChemin(pathname: string): ModuleErp | undefined {
  const reste = pathname.replace(/^\/erp\/?/, '');
  const segment = reste.split('/')[0] ?? '';
  return MODULES.find((m) => m.segment === segment);
}

/** Rubrique d'un module. */
export function rubriqueDe(m: ModuleErp | undefined): Rubrique | undefined {
  return m ? GROUPES.find((g) => g.cle === m.group) : undefined;
}

/** Modules d'une rubrique, dans l'ordre des onglets. */
export function modulesDe(cle: GroupeModule): ModuleErp[] {
  return MODULES.filter((m) => m.group === cle);
}
