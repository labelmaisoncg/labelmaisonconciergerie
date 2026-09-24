import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LogOut } from 'lucide-react';
import { useErp } from '../data/store';
import { LIBELLES } from '../data/libelles';
import { Avatar, cn } from '../ui';

/** Sélecteur d'utilisateur de la démo (Abdel / Kamel) et déconnexion. */
export function UserSwitcher() {
  const { utilisateur, utilisateurs, changerUtilisateur } = useErp();
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const equipe = utilisateurs.filter((u) => u.role === 'gerant' || u.role === 'operations');

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
        <div role="menu" className="lm-apparition absolute right-0 z-40 mt-1 w-60 rounded-xl border border-(--lm-bord) bg-(--lm-surface) p-1.5 shadow-(--lm-ombre-haute)">
          <p className="px-2.5 pt-1 pb-1.5 text-[11.5px] text-(--lm-encre-3)">Changer d’utilisateur (démo)</p>
          {equipe.map((u) => (
            <button
              key={u.id}
              type="button"
              role="menuitemradio"
              aria-checked={u.id === utilisateur.id}
              onClick={() => {
                changerUtilisateur(u.id);
                setOuvert(false);
              }}
              className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-(--lm-surface-2)')}
            >
              <Avatar nom={u.nom} taille="sm" />
              <span className="flex-1">
                <span className="block text-[13px] font-medium">{u.nom}</span>
                <span className="block text-[11.5px] text-(--lm-encre-3)">{LIBELLES.role[u.role]}</span>
              </span>
              {u.id === utilisateur.id && <Check className="size-4 text-(--lm-or)" aria-hidden />}
            </button>
          ))}
          <div className="my-1 border-t border-(--lm-bord)" />
          <a
            role="menuitem"
            href="/erp/deconnexion"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre)"
          >
            <LogOut className="size-4" aria-hidden />
            Se déconnecter
          </a>
        </div>
      )}
    </div>
  );
}
