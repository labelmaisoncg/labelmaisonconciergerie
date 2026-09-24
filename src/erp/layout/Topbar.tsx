import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Menu } from 'lucide-react';
import { IconButton } from '../ui';
import { moduleDuChemin } from '../modules/registry';
import { GlobalSearch } from './GlobalSearch';
import { UserSwitcher } from './UserSwitcher';

export interface TopbarProps {
  onMenu: () => void;
}

/** En-tête : menu mobile, fil d'Ariane, recherche globale, utilisateur. */
export function Topbar({ onMenu }: TopbarProps) {
  const { pathname } = useLocation();
  const module = moduleDuChemin(pathname);
  const titre = module?.label ?? 'Page introuvable';

  return (
    <header className="lm-sans-impression sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-(--lm-bord) bg-(--lm-surface)/90 px-3 backdrop-blur sm:gap-3 sm:px-5">
      <IconButton label="Ouvrir le menu" onClick={onMenu} className="lg:hidden">
        <Menu />
      </IconButton>
      <nav aria-label="Position" className="hidden min-w-0 items-center gap-1 text-[13px] md:flex">
        <Link to="/erp" className="text-(--lm-encre-3) hover:text-(--lm-or)">
          ERP
        </Link>
        <ChevronRight className="size-3.5 text-(--lm-encre-3)" aria-hidden />
        <span aria-current="page" className="truncate font-medium text-(--lm-encre)">
          {titre}
        </span>
      </nav>
      <GlobalSearch className="min-w-0 flex-1 md:ml-auto md:max-w-sm md:flex-none lg:w-96 lg:max-w-none" />
      <UserSwitcher />
    </header>
  );
}
