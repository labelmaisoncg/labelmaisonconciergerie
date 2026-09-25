import { useLocation } from 'react-router-dom';
import { ChevronRight, Menu } from 'lucide-react';
import { IconButton } from '../ui';
import { moduleDuChemin, rubriqueDe } from '../modules/registry';
import { GlobalSearch } from './GlobalSearch';
import { UserSwitcher } from './UserSwitcher';
import { IndicateurSynchro } from './EtatSynchro';

export interface TopbarProps {
  onMenu: () => void;
}

/** En-tête : menu mobile, où l'on est, recherche globale, utilisateur. */
export function Topbar({ onMenu }: TopbarProps) {
  const { pathname } = useLocation();
  const module = moduleDuChemin(pathname);
  const rubrique = rubriqueDe(module);

  return (
    <header className="lm-sans-impression sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-(--lm-bord) bg-(--lm-surface)/90 px-3 backdrop-blur sm:gap-3 sm:px-5">
      <IconButton label="Ouvrir le menu" onClick={onMenu} className="lg:hidden">
        <Menu />
      </IconButton>
      <nav aria-label="Vous êtes ici" className="hidden min-w-0 items-center gap-1 text-[13px] md:flex">
        {module ? (
          <>
            <span className={module.label === rubrique?.libelle ? 'font-medium text-(--lm-encre)' : 'text-(--lm-encre-3)'}>{rubrique?.libelle}</span>
            {rubrique && module.label !== rubrique.libelle && (
              <>
                <ChevronRight className="size-3.5 text-(--lm-encre-3)" aria-hidden />
                <span aria-current="page" className="truncate font-medium text-(--lm-encre)">
                  {module.label}
                </span>
              </>
            )}
          </>
        ) : (
          <span className="font-medium text-(--lm-encre)">Page introuvable</span>
        )}
      </nav>
      <GlobalSearch className="min-w-0 flex-1 md:ml-auto md:max-w-md lg:w-[28rem] lg:flex-none" />
      <IndicateurSynchro />
      <UserSwitcher />
    </header>
  );
}
