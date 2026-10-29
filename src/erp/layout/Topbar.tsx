import { useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { moduleDuChemin, rubriqueDe } from '../modules/registry';
import { GlobalSearch } from './GlobalSearch';
import { UserSwitcher } from './UserSwitcher';
import { IndicateurSynchro } from './EtatSynchro';

/** En-tête : où l'on est, recherche globale, utilisateur (sur téléphone, les rubriques sont en bas). */
export function Topbar() {
  const { pathname } = useLocation();
  const module = moduleDuChemin(pathname);
  const rubrique = rubriqueDe(module);
  // Sur une sous-page (fiche, Connexions…), le titre de la page dit où l'on est :
  // l'en-tête ne la présente pas comme la page courante.
  const sousPage = !!module && pathname.replace(/\/$/, '') !== module.path;

  return (
    // En-tête blanc d'Airbnb, un filet dessous ; la recherche en pilule au centre de l'attention.
    <header className="lm-sans-impression sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-(--lm-bord) bg-(--lm-surface) px-4 sm:gap-3 sm:px-6 lg:h-[4.5rem]">
      <nav aria-label="Vous êtes ici" className="hidden min-w-0 items-center gap-1 text-[14px] md:flex">
        {module ? (
          <>
            <span className={module.label === rubrique?.libelle ? 'font-semibold text-(--lm-encre)' : 'text-(--lm-encre-2)'}>{rubrique?.libelle}</span>
            {rubrique && module.label !== rubrique.libelle && (
              <>
                <ChevronRight className="size-4 text-(--lm-encre-2)" aria-hidden />
                <span aria-current={sousPage ? undefined : 'page'} className={sousPage ? 'truncate text-(--lm-encre-2)' : 'truncate font-semibold text-(--lm-encre)'}>
                  {module.label}
                </span>
              </>
            )}
          </>
        ) : (
          <span className="font-semibold text-(--lm-encre)">Page introuvable</span>
        )}
      </nav>
      <GlobalSearch className="min-w-0 flex-1 md:ml-auto md:max-w-lg lg:w-[30rem] lg:flex-none" />
      <IndicateurSynchro />
      <UserSwitcher />
    </header>
  );
}
