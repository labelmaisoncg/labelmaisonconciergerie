/**
 * Point d'entrée de l'ERP, monté par App.tsx sur /erp/* (chargement paresseux).
 * Routes relatives : chaque module gère ses sous-routes sous `<segment>/*`.
 */
import { Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';
import './erp.css';
import { ErpProvider } from './data/store';
import { ErpLayout } from './layout';
import { ModuleErrorBoundary } from './layout/ModuleErrorBoundary';
import { MODULES } from './modules/registry';
import { ButtonLink, EmptyState, PageSkeleton } from './ui';

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
          <Route path="*" element={<Introuvable />} />
        </Routes>
      </Suspense>
    </ModuleErrorBoundary>
  );
}

export default function ErpApp() {
  useEnteteDocument();
  return (
    <div className="erp-root">
      <ErpProvider>
        <ErpLayout>
          <Contenu />
        </ErpLayout>
      </ErpProvider>
    </div>
  );
}
