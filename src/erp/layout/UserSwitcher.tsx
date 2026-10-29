import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Settings } from 'lucide-react';
import { useErp } from '../data/store';
import { LIBELLES } from '../data/libelles';
import { pluriel } from '../data/format';
import { Avatar } from '../ui';

/** Menu du membre connecté : nom, rôle, adresse, Paramètres (le seul accès sur téléphone), déconnexion. */
export function UserSwitcher() {
  const { utilisateur, seDeconnecter, synchro, mode } = useErp();
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && setOuvert(false);
    document.addEventListener('mousedown', clic);
    document.addEventListener('keydown', touche);
    return () => {
      document.removeEventListener('mousedown', clic);
      document.removeEventListener('keydown', touche);
    };
  }, [ouvert]);

  const deconnecter = () => {
    const enAttente = synchro?.enAttente ?? 0;
    if (
      enAttente > 0 &&
      !window.confirm(
        `${pluriel(enAttente, 'modification')} pas encore enregistrée${enAttente > 1 ? 's' : ''} dans la base. ` +
          'Elles partiront à la prochaine connexion sur cet appareil. Se déconnecter quand même ?',
      )
    )
      return;
    setOuvert(false);
    seDeconnecter();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label={`${utilisateur.nom} : compte et paramètres`}
        onClick={() => setOuvert((o) => !o)}
        // Menu du compte d'Airbnb : une pilule blanche bordée, qui flotte au survol.
        className="flex h-12 items-center gap-2 rounded-full border border-(--lm-bord) bg-(--lm-surface) py-1 pr-1.5 pl-3 transition-shadow hover:shadow-(--lm-ombre-haute) md:pl-1.5"
      >
        <Menu className="size-4 text-(--lm-encre) md:hidden" aria-hidden />
        <Avatar nom={utilisateur.nom} />
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-[13px] font-semibold text-(--lm-encre)">{utilisateur.nom}</span>
          <span className="block text-[12px] text-(--lm-encre-2)">{LIBELLES.role[utilisateur.role]}</span>
        </span>
        <ChevronDown className="mr-1 hidden size-4 text-(--lm-encre) md:block" aria-hidden />
      </button>
      {ouvert && (
        <div role="menu" className="lm-apparition absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-(--lm-bord) bg-(--lm-surface) py-2 shadow-(--lm-ombre-haute)">
          <div className="flex items-center gap-2.5 px-4 pt-1 pb-2.5">
            <Avatar nom={utilisateur.nom} />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold">{utilisateur.nom}</span>
              <span className="block truncate text-[12px] text-(--lm-encre-2)">
                {mode === 'demo' ? 'Données de démonstration' : utilisateur.email}
              </span>
            </span>
          </div>
          <div className="my-1.5 border-t border-(--lm-bord)" />
          <Link
            to="/erp/parametres"
            role="menuitem"
            onClick={() => setOuvert(false)}
            className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-[14px] text-(--lm-encre) hover:bg-(--lm-surface-2)"
          >
            <Settings className="size-4" aria-hidden />
            Paramètres
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={deconnecter}
            className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-[14px] text-(--lm-encre) hover:bg-(--lm-surface-2)"
          >
            <LogOut className="size-4" aria-hidden />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
