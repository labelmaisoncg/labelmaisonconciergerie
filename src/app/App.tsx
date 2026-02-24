import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Navigation } from './components/Navigation';
import { Footer } from './components/Footer';
import { ScrollToTop } from './components/ScrollToTop';
import { Home } from './pages/Home';
import { Proprietaires } from './pages/Proprietaires';
import { Billetterie } from './pages/Billetterie';
import { Logement } from './pages/Logement';
import { Transport } from './pages/Transport';
import { Activites } from './pages/Activites';
import { Shopping } from './pages/Shopping';

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
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
          </Routes>
          <Footer />
        </div>
      </BrowserRouter>
    </HelmetProvider>
  );
}