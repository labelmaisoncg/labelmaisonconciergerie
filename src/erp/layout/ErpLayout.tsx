import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { DemandeNotifications } from '../modules/parametres/_application/DemandeNotifications';
import { BarreOnglets } from './BarreOnglets';
import { DemoBanner } from './DemoBanner';
import { AlerteSynchro, BandeauLecture } from './EtatSynchro';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { OngletsRubrique } from './OngletsRubrique';

/**
 * Cadre de l'ERP : barre latérale fixe (barre d'onglets en bas sous
 * 1024 px, comme une app), bandeau démo (développement) ou lecture seule,
 * en-tête, contenu, alertes d'enregistrement, demande des notifications à
 * l'ouverture. Aucun défilement horizontal de page : les tableaux défilent
 * dans leur propre conteneur.
 */
export function ErpLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  // Corps entre accolades : un effet ne doit rien renvoyer d'autre qu'une
  // fonction de nettoyage. Certaines extensions du navigateur font renvoyer
  // une valeur à window.scrollTo, et React plantait (« o is not a function »).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen overflow-x-clip">
      <aside className="lm-sans-impression sticky top-0 hidden h-screen w-64 shrink-0 border-r border-(--lm-bord) lg:block">
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <BandeauLecture />
        <Topbar />
        <main id="contenu" className="mx-auto w-full max-w-[1400px] min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <OngletsRubrique />
          {children}
        </main>
      </div>
      <BarreOnglets />
      <AlerteSynchro />
      <DemandeNotifications />
    </div>
  );
}
