import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { X, ArrowRight } from 'lucide-react';

// Annonce discrète du nouveau programme « Cercle LabelMaison ».
// Pop en bas à droite après le splash, reste ~1 min, puis s'efface toute seule.
// Refermable, et mise en veille quelques jours une fois vue (localStorage).

const STORAGE_KEY = 'lmcg_cercle_announce';
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 jours
const VISIBLE_MS = 60_000; // ~1 minute à l'écran
const INTRO_SESSION_KEY = 'lm_intro_seen';

function recentlyDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function CercleAnnounce() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const onCerclePage = location.pathname.startsWith('/cerclelabelmaison');

  useEffect(() => {
    if (onCerclePage || recentlyDismissed()) return;

    // Laisser le splash finir à la 1ʳᵉ visite ; sinon apparition rapide.
    const introSeen =
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem(INTRO_SESSION_KEY) === '1';
    const appearDelay = introSeen ? 4_000 : 9_000;

    const showTimer = window.setTimeout(() => setOpen(true), appearDelay);
    return () => window.clearTimeout(showTimer);
  }, [onCerclePage]);

  // Auto-dismiss après VISIBLE_MS une fois affichée.
  useEffect(() => {
    if (!open) return;
    const hideTimer = window.setTimeout(() => setOpen(false), VISIBLE_MS);
    return () => window.clearTimeout(hideTimer);
  }, [open]);

  const remember = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* stockage indisponible : on ignore */
    }
  };

  const dismiss = () => {
    remember();
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && !onCerclePage && (
        <motion.aside
          role="complementary"
          aria-label="Nouveau programme : le Cercle LabelMaison"
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="fixed z-40 bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 w-auto sm:w-[360px]"
        >
          <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(64,49,24,0.18)]" style={{ border: '1px solid rgba(169,124,48,0.35)' }}>
            {/* filet or supérieur */}
            <span className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(169,124,48,0.7), transparent)' }} />

            <button
              type="button"
              onClick={dismiss}
              aria-label="Fermer l'annonce"
              className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-full text-[#7A7264] hover:bg-black/5 transition-colors"
            >
              <X size={16} />
            </button>

            <div className="p-5 pr-10">
              <div className="flex items-center gap-3">
                <span className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full" style={{ background: 'rgba(169,124,48,0.1)' }}>
                  <img src="/images/key-gold.png" alt="" aria-hidden className="w-6 h-auto" />
                </span>
                <span className="text-[11px] font-semibold uppercase" style={{ color: '#7C561D', letterSpacing: '0.24em' }}>
                  Nouveau · Programme
                </span>
              </div>

              <h3 className="mt-3 font-serif-title text-[22px] leading-[1.15]" style={{ color: '#2C2418' }}>
                Le Cercle <span className="font-serif-italic" style={{ color: '#A97C30' }}>LabelMaison</span>
              </h3>
              <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: '#5C4D2C' }}>
                Recommandez un propriétaire, gagnez <strong className="font-semibold" style={{ color: '#2C2418' }}>150&nbsp;€</strong>. Rejoignez le Cercle.
              </p>

              <Link
                to="/cerclelabelmaison"
                onClick={dismiss}
                className="mt-4 inline-flex items-center gap-2 font-bold text-[13px] px-5 py-2.5 rounded-full transition-transform hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(180deg, #C39A4A, #A97C30)', color: '#2A1E0C' }}
              >
                Découvrir le programme <ArrowRight size={14} />
              </Link>
            </div>

            {/* barre de progression : se vide sur la durée d'affichage */}
            <motion.span
              className="block h-[3px] origin-left"
              style={{ background: 'linear-gradient(90deg, #C39A4A, #A97C30)' }}
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: VISIBLE_MS / 1000, ease: 'linear' }}
            />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
