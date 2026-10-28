import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';

const DUREE_MS = 5000;

/**
 * Court message de réussite après une action qui ramène sur une autre page
 * (« « Studio » a été supprimé. ») : passé dans l'état de la navigation,
 * navigate(page, { state: { message } }), montré quelques secondes en bas de
 * l'écran, puis retiré de l'historique du navigateur (un retour en arrière
 * ou un rechargement ne le remontre pas). Dès 1024 px, centré sur la zone de
 * contenu, à droite de la barre latérale (w-64 à partir de lg, ErpLayout.tsx).
 */
export function MessageRetour() {
  const { pathname, search, hash, state } = useLocation();
  const naviguer = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const recu = (state as { message?: unknown } | null)?.message;

  useEffect(() => {
    if (typeof recu !== 'string' || !recu.trim()) return;
    setMessage(recu.trim());
    naviguer({ pathname, search, hash }, { replace: true, state: null });
  }, [recu, pathname, search, hash, naviguer]);

  useEffect(() => {
    if (!message) return;
    const minuterie = setTimeout(() => setMessage(null), DUREE_MS);
    return () => clearTimeout(minuterie);
  }, [message]);

  return (
    // Toujours présent (vide au repos) : un lecteur d'écran annonce le message quand il arrive.
    <div
      role="status"
      className={
        message
          ? 'lm-sans-impression lm-apparition fixed inset-x-3 bottom-[calc(var(--lm-barre-onglets)+0.75rem)] z-50 mx-auto lg:left-[calc(16rem+0.75rem)] flex max-w-sm items-center gap-2.5 rounded-xl border border-(--lm-bord) bg-(--lm-surface) py-2 pr-2 pl-3.5 text-[13.5px] shadow-(--lm-ombre-haute) sm:bottom-[calc(var(--lm-barre-onglets)+1.25rem)]'
          : 'sr-only'
      }
    >
      {message && (
        <>
          <CheckCircle2 className="size-[18px] shrink-0 text-(--lm-succes)" aria-hidden />
          <p className="min-w-0 flex-1 text-(--lm-encre)">{message}</p>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Fermer"
            className="grid size-8 shrink-0 place-items-center rounded-md text-(--lm-encre-3) hover:text-(--lm-encre)"
          >
            <X className="size-4" aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}
