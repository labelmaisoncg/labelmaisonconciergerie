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
import { MentionsLegales } from './pages/MentionsLegales';
import { PolitiqueConfidentialite } from './pages/PolitiqueConfidentialite';
import { CercleAnnounce } from './components/CercleAnnounce';

// L'ERP interne (/erp) est chargé à la demande : le site public ne télécharge
// jamais son code. Il s'affiche seul, sans la navigation ni le pied du site.
const ErpApp = lazy(() => import('../erp/ErpApp'));
// Dossier propriétaire (assistant plein écran, lien envoyé après l'appel) : chargé à la demande, sans la navigation du site.
const DossierProprietaire = lazy(() => import('./pages/DossierProprietaire'));
// Espace propriétaire (logements, calendrier, bilans, documents) : chargé à la demande, sans la navigation du site.
const EspaceProprietaire = lazy(() => import('./pages/EspaceProprietaire'));
// Espace opérations (responsables de pôle, agents de terrain) : chargé à la demande, sans la navigation du site.
const EspaceOperations = lazy(() => import('./pages/EspaceOperations'));
// Livret d'accueil et check-in en ligne d'un séjour (lien envoyé au voyageur) : chargé à la demande, sans la navigation du site.
const Sejour = lazy(() => import('./pages/Sejour'));

const estErp = () => typeof window !== 'undefined' && /^\/erp(\/|$)/.test(window.location.pathname);
const estDossier = () => typeof window !== 'undefined' && /^\/dossier-proprietaire\/?$/.test(window.location.pathname);
const estEspaceProprietaire = () => typeof window !== 'undefined' && /^\/espace-proprietaire\/?$/.test(window.location.pathname);
const estEspaceOperations = () => typeof window !== 'undefined' && /^\/espace-operations\/?$/.test(window.location.pathname);
const estSejour = () => typeof window !== 'undefined' && /^\/sejour\/?$/.test(window.location.pathname);

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
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/politique-de-confidentialite" element={<PolitiqueConfidentialite />} />
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
      {!estErp() && !estDossier() && !estEspaceProprietaire() && !estEspaceOperations() && !estSejour() && <SplashIntro />}
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
          <Route
            path="/dossier-proprietaire"
            element={
              <Suspense fallback={<div style={{ minHeight: '100vh', background: '#FBF9F4' }} />}>
                <DossierProprietaire />
              </Suspense>
            }
          />
          <Route
            path="/espace-proprietaire"
            element={
              <Suspense fallback={<div style={{ minHeight: '100vh', background: '#FBFAF8' }} />}>
                <EspaceProprietaire />
              </Suspense>
            }
          />
          <Route
            path="/espace-operations"
            element={
              <Suspense fallback={<div style={{ minHeight: '100vh', background: '#FBFAF8' }} />}>
                <EspaceOperations />
              </Suspense>
            }
          />
          <Route
            path="/sejour"
            element={
              <Suspense fallback={<div style={{ minHeight: '100vh', background: '#FBFAF8' }} />}>
                <Sejour />
              </Suspense>
            }
          />
          <Route path="*" element={<SiteShell />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
}