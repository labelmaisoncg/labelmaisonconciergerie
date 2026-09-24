import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './styles/index.css';
import { rechargerUneFois } from './app/securite/rechargement';

// Vite signale ici un morceau de code introuvable (onglet ouvert pendant un
// déploiement) : on recharge une fois pour récupérer la version en ligne.
window.addEventListener('vite:preloadError', (evenement) => {
  if (rechargerUneFois()) evenement.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
