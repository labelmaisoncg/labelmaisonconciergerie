import { lazy, Suspense } from 'react';
import { ErpFiletSecurite } from './securite/ErpFiletSecurite';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Navigation } from './components/Navigation';
import { Footer } from './components/Footer';
import { ScrollToTop } from './components/ScrollToTop';
import { SplashIntro } from './components/SplashIntro';
import { Home } from './pages/Home';
import { Proprietaires } from './pages/Proprietaires';
import { Billetterie } from './pages/Billetterie';
import { Logement } from './pages/Logement';
import { Transport } from './pages/Transport';
import { Activites } from './pages/Activites';
import { Shopping } from './pages/Shopping';
import { CercleLabelMaison } from './pages/CercleLabelMaison';
import { Studio } from './pages/Studio';
import { StudioConditions } from './pages/StudioConditions';
import { CercleAnnounce } from './components/CercleAnnounce';

// L'ERP interne (/erp) est chargé à la demande : le site public ne télécharge
// jamais son code. Il s'affiche seul, sans la navigation ni le pied du site.
const ErpApp = lazy(() => import('../erp/ErpApp'));

const estErp = () => typeof window !== 'undefined' && /^\/erp(\/|$)/.test(window.location.pathname);

/** Habillage du site public : navigation, pages, pied de page. */
function SiteShell() {
  return (
    <>
      <ScrollToTop />
      <div className="min-h-screen">
        <Navigation />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/proprietaires" element={<Proprietaires />} />
          <Route path="/billetterie" element={<Billetterie />} />
          <Route path="/logement" element={<Logement />} />
          <Route path="/transport" element={<Transport />} />
          <Route path="/activites" element={<Activites />} />
          <Route path="/shopping" element={<Shopping />} />
          <Route path="/cerclelabelmaison" element={<CercleLabelMaison />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/studio/conditions" element={<StudioConditions />} />
        </Routes>
        <Footer />
        <CercleAnnounce />
      </div>
    </>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      {/* L'intro animée est réservée au site : jamais sous /erp. */}
      {!estErp() && <SplashIntro />}
      <BrowserRouter>
        <Routes>
          <Route
            path="/erp/*"
            element={
              <ErpFiletSecurite>
                <Suspense fallback={<div style={{ minHeight: '100vh', background: '#FBFAF8' }} />}>
                  <ErpApp />
                </Suspense>
              </ErpFiletSecurite>
            }
          />
          <Route path="*" element={<SiteShell />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
}