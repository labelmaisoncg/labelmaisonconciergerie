/**
 * Point d'entrée de l'ERP, monté par App.tsx sur /erp/* (chargement paresseux).
 * Routes relatives : chaque module gère ses sous-routes sous `<segment>/*`.
 */
import { lazy, Suspense, useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Compass } from 'lucide-react';
import './erp.css';
import { demarrerApplication } from './data/application';
import { lienIncident } from './data/incidents-erp';
import { ErpProvider, useErp } from './data/store';
import { ErpLayout } from './layout';
import { ModuleErrorBoundary } from './layout/ModuleErrorBoundary';
import { ANCIENNES_ADRESSES, MODULES } from './modules/registry';
import { ButtonLink, EmptyState, PageSkeleton } from './ui';
import { figerEcran } from './layout/ecranFige';

// Écran d'autorisation OAuth ouvert par Claude (connecteur du CRM), hors mise en page.
const AutoriserClaude = lazy(() => import('./modules/crm/AutoriserClaude'));
// Page du lien d'installation de l'app (téléphone, ordinateur), hors mise en page.
const Installer = lazy(() => import('./modules/parametres/_application/Installer'));

/** Titre d'onglet et noindex tant que l'ERP est affiché ; état du site rétabli ensuite. */
function useEnteteDocument() {
  useEffect(() => {
    const titre = document.title;
    document.title = 'ERP · Label Maison';
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const cree = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    const contenu = meta.content;
    meta.content = 'noindex, nofollow';
    return () => {
      document.title = titre;
      if (cree) meta!.remove();
      else meta!.content = contenu;
    };
  }, []);
}

function Introuvable() {
  return (
    <EmptyState
      icone={<Compass />}
      titre="Page introuvable"
      description="Cette page n’existe pas (ou plus). Revenez à l’accueil, ou cherchez ce qu’il vous faut avec la recherche en haut."
      action={
        <ButtonLink to="/erp" variant="primary">
          Revenir à l’accueil
        </ButtonLink>
      }
    />
  );
}

/** Anciens liens /erp/incidents?id=… (journal, recherche, linge) : la fiche du logement, sur l'incident. */
function AncienIncident() {
  const d = useErp();
  const [p] = useSearchParams();
  const id = p.get('id');
  const i = id ? d.donnees.incidents.find((x) => x.id === id) : undefined;
  return <Navigate to={i ? lienIncident(i) : '/erp/logements'} replace />;
}

function Contenu() {
  const { pathname } = useLocation();
  const segment = pathname.split('/')[2] ?? '';
  return (
    <ModuleErrorBoundary key={segment}>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          {MODULES.map(({ key, segment: seg, component: Module }) =>
            seg ? <Route key={key} path={`${seg}/*`} element={<Module />} /> : <Route key={key} index element={<Module />} />,
          )}
          <Route path="incidents/*" element={<AncienIncident />} />
          {Object.entries(ANCIENNES_ADRESSES).map(([seg, vers]) => (
            <Route key={seg} path={`${seg}/*`} element={<Navigate to={vers} replace />} />
          ))}
          <Route path="*" element={<Introuvable />} />
        </Routes>
      </Suspense>
    </ModuleErrorBoundary>
  );
}

/**
 * App installée : service worker (version construite) et notifications
 * touchées pendant que l'app est ouverte, qui mènent au bon écran.
 */
function useApplication() {
  const naviguer = useNavigate();
  // useNavigate change à chaque page : on garde la dernière sans réenregistrer le service worker.
  const suivre = useRef(naviguer);
  useEffect(() => {
    suivre.current = naviguer;
  });
  useEffect(() => demarrerApplication((chemin) => suivre.current(chemin)), []);
  useEffect(() => figerEcran(), []);
}

/**
 * Mise en page de l'ERP, sauf pour l'écran de consentement OAuth ouvert par
 * Claude (plein écran, sans menu ni barre du haut, rien d'autre à faire que
 * décider) et la page d'installation de l'app.
 */
function Coquille() {
  const { pathname } = useLocation();
  useApplication();
  if (/^\/erp\/autoriser-claude\/?$/.test(pathname)) {
    return (
      <main className="min-h-screen px-4 pb-12">
        <Suspense fallback={<PageSkeleton />}>
          <AutoriserClaude />
        </Suspense>
      </main>
    );
  }
  if (/^\/erp\/installer\/?$/.test(pathname)) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <Installer />
      </Suspense>
    );
  }
  return (
    <ErpLayout>
      <Contenu />
    </ErpLayout>
  );
}

export default function ErpApp() {
  useEnteteDocument();
  return (
    <div className="erp-root">
      <ErpProvider>
        <Coquille />
      </ErpProvider>
    </div>
  );
}
