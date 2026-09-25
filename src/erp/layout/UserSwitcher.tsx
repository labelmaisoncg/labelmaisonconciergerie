import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useErp } from '../data/store';
import { LIBELLES } from '../data/libelles';
import { pluriel } from '../data/format';
import { Avatar } from '../ui';

/** Menu du membre connecté : nom, rôle, adresse, déconnexion. */
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
        onClick={() => setOuvert((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-lg px-1.5 hover:bg-(--lm-surface-2)"
      >
        <Avatar nom={utilisateur.nom} taille="sm" />
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-[13px] font-medium text-(--lm-encre)">{utilisateur.nom}</span>
          <span className="block text-[11.5px] text-(--lm-encre-3)">{LIBELLES.role[utilisateur.role]}</span>
        </span>
        <ChevronDown className="size-4 text-(--lm-encre-3)" aria-hidden />
      </button>
      {ouvert && (
        <div role="menu" className="lm-apparition absolute right-0 z-40 mt-1 w-64 rounded-xl border border-(--lm-bord) bg-(--lm-surface) p-1.5 shadow-(--lm-ombre-haute)">
          <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-2">
            <Avatar nom={utilisateur.nom} taille="sm" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">{utilisateur.nom}</span>
              <span className="block truncate text-[11.5px] text-(--lm-encre-3)">
                {mode === 'demo' ? 'Données de démonstration' : utilisateur.email}
              </span>
            </span>
          </div>
          <div className="my-1 border-t border-(--lm-bord)" />
          <button
            type="button"
            role="menuitem"
            onClick={deconnecter}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre)"
          >
            <LogOut className="size-4" aria-hidden />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
