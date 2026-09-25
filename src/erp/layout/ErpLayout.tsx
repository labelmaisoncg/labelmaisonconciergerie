import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { IconButton, useFenetre } from '../ui';
import { DemoBanner } from './DemoBanner';
import { AlerteSynchro, BandeauLecture } from './EtatSynchro';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/**
 * Cadre de l'ERP : barre latérale fixe (tiroir sous 1024 px), bandeau démo
 * (développement) ou lecture seule, en-tête, contenu, alertes d'enregistrement. Aucun défilement horizontal de page : les tableaux
 * défilent dans leur propre conteneur.
 */
export function ErpLayout({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  const tiroir = useFenetre<HTMLDivElement>(menu, () => setMenu(false));

  // Corps entre accolades : un effet ne doit rien renvoyer d'autre qu'une
  // fonction de nettoyage. Certaines extensions du navigateur font renvoyer
  // une valeur à window.scrollTo, et React plantait (« o is not a function »).
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen overflow-x-clip">
      <aside className="lm-sans-impression sticky top-0 hidden h-screen w-60 shrink-0 border-r border-(--lm-bord) lg:block">
        <Sidebar />
      </aside>

      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div aria-hidden className="lm-apparition absolute inset-0 bg-[rgba(20,17,14,0.32)]" onClick={() => setMenu(false)} />
          <div
            ref={tiroir}
            role="dialog"
            aria-modal="true"
            aria-label="Menu de l’ERP"
            tabIndex={-1}
            className="lm-tiroir-gauche relative h-full w-[min(85vw,280px)] shadow-(--lm-ombre-haute) outline-none"
          >
            <Sidebar onNaviguer={() => setMenu(false)} />
            <IconButton label="Fermer le menu" onClick={() => setMenu(false)} className="absolute top-2.5 right-2">
              <X />
            </IconButton>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <BandeauLecture />
        <Topbar onMenu={() => setMenu(true)} />
        <main id="contenu" className="mx-auto w-full max-w-[1400px] min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7">
          {children}
        </main>
      </div>
      <AlerteSynchro />
    </div>
  );
}
