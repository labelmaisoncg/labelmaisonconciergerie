/**
 * Registre des modules de l'ERP : route, entrée de menu, groupe (couche de la
 * SPEC §1) et composant chargé à la demande. Chaque module gère ses propres
 * sous-routes : il est monté sur `<segment>/*`.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  FileSignature,
  Gauge,
  Home,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Shirt,
  Sparkles,
  Target,
  Users,
  Wallet,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type GroupeModule =
  | 'pilotage'
  | 'commercial'
  | 'referentiel'
  | 'distribution'
  | 'relation'
  | 'operations'
  | 'prestataires'
  | 'finance'
  | 'conformite';

/** Ordre et libellés des groupes de la barre latérale. */
export const GROUPES: { cle: GroupeModule; libelle: string }[] = [
  { cle: 'pilotage', libelle: 'Pilotage' },
  { cle: 'commercial', libelle: 'Commercial' },
  { cle: 'referentiel', libelle: 'Référentiel' },
  { cle: 'distribution', libelle: 'Distribution' },
  { cle: 'relation', libelle: 'Relation voyageur' },
  { cle: 'operations', libelle: 'Opérations' },
  { cle: 'prestataires', libelle: 'Prestataires' },
  { cle: 'finance', libelle: 'Finance' },
  { cle: 'conformite', libelle: 'Conformité & admin' },
];

/** Compteurs affichables dans la barre latérale (calculés par le layout). */
export type CleCompteur = 'missionsAAttribuer' | 'messagesEnAttente' | 'incidentsOuverts';

export interface ModuleErp {
  key: string;
  /** Segment sous /erp ('' pour le tableau de bord). */
  segment: string;
  /** Chemin absolu, pour les liens. */
  path: string;
  label: string;
  group: GroupeModule;
  icon: LucideIcon;
  component: LazyExoticComponent<ComponentType>;
  compteur?: CleCompteur;
}

const module = (
  key: string,
  segment: string,
  label: string,
  group: GroupeModule,
  icon: LucideIcon,
  component: LazyExoticComponent<ComponentType>,
  compteur?: CleCompteur,
): ModuleErp => ({ key, segment, path: segment ? `/erp/${segment}` : '/erp', label, group, icon, component, compteur });

export const MODULES: ModuleErp[] = [
  module('tableau-de-bord', '', 'Tableau de bord', 'pilotage', LayoutDashboard, lazy(() => import('./tableau-de-bord'))),
  module('performance', 'performance', 'Performance des biens', 'pilotage', Gauge, lazy(() => import('./performance'))),
  module('automatisations', 'automatisations', 'Automatisations', 'pilotage', Workflow, lazy(() => import('./automatisations'))),
  module('commercial', 'commercial', 'Pipeline & lancements', 'commercial', Target, lazy(() => import('./commercial'))),
  module('proprietaires', 'proprietaires', 'Propriétaires', 'referentiel', Users, lazy(() => import('./proprietaires'))),
  module('mandats', 'mandats', 'Mandats', 'referentiel', FileSignature, lazy(() => import('./mandats'))),
  module('logements', 'logements', 'Logements', 'referentiel', Home, lazy(() => import('./logements'))),
  module('reservations', 'reservations', 'Réservations', 'distribution', CalendarDays, lazy(() => import('./reservations'))),
  module('messagerie', 'messagerie', 'Messagerie', 'relation', MessagesSquare, lazy(() => import('./messagerie')), 'messagesEnAttente'),
  module('menages', 'menages', 'Ménages', 'operations', Sparkles, lazy(() => import('./menages')), 'missionsAAttribuer'),
  module('linge', 'linge', 'Linge', 'operations', Shirt, lazy(() => import('./linge'))),
  module('incidents', 'incidents', 'Incidents', 'operations', AlertTriangle, lazy(() => import('./incidents')), 'incidentsOuverts'),
  module('prestataires', 'prestataires', 'Prestataires', 'prestataires', Wrench, lazy(() => import('./prestataires'))),
  module('finance', 'finance', 'Finance', 'finance', Wallet, lazy(() => import('./finance'))),
  module('conformite', 'conformite', 'Conformité', 'conformite', ShieldCheck, lazy(() => import('./conformite'))),
  module('parametres', 'parametres', 'Paramètres', 'conformite', Settings, lazy(() => import('./parametres'))),
];

/** Module correspondant à un chemin sous /erp. */
export function moduleDuChemin(pathname: string): ModuleErp | undefined {
  const reste = pathname.replace(/^\/erp\/?/, '');
  const segment = reste.split('/')[0] ?? '';
  return MODULES.find((m) => m.segment === segment);
}
