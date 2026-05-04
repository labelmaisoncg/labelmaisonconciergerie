import { useState, useEffect } from 'react';
import { Menu, X, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router-dom';

const navLinks = [
  { hash: 'services', label: 'Services' },
  { hash: 'offre', label: 'Offre' },
  { hash: 'faq', label: 'F.A.Q' },
  { hash: 'apropos', label: 'Qui sommes-nous ?' },
  { hash: 'valeurs', label: 'Nos valeurs' },
  { hash: 'contact', label: 'Contact' },
];

const PHONE_DISPLAY = '+33 7 49 54 83 55';
const PHONE_HREF = 'tel:+33749548355';

export function Navigation() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  // Smart anchor href — uses /#xxx from sub-pages so the nav always works
  const anchorHref = (hash: string) => (isHome ? `#${hash}` : `/#${hash}`);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 bg-white transition-shadow ${
        scrolled ? 'shadow-[0_4px_24px_rgba(0,0,0,0.06)]' : 'shadow-none'
      }`}
    >
      {/* Desktop */}
      <div className="hidden md:block">
        <div className="max-w-[1152px] mx-auto px-6 min-h-[90px] grid grid-cols-[auto_1fr_auto] items-center gap-8">
          <a href="/" className="flex items-center" aria-label="Label Maison Conciergerie - Accueil">
            <img
              src="/images/logo-label-maison.jpg"
              alt="Label Maison Conciergerie"
              className="h-16 w-auto object-contain"
            />
          </a>

          <nav className="flex items-center justify-center gap-7 text-[15px] font-medium">
            {navLinks.map((l) => (
              <a
                key={l.hash}
                href={anchorHref(l.hash)}
                className="text-neutral-700 hover:text-[#556B2F] transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <a
            href={PHONE_HREF}
            aria-label={`Appeler ${PHONE_DISPLAY}`}
            className="inline-flex items-center gap-2 bg-black text-white font-bold text-[14px] px-5 py-3 rounded-full hover:bg-neutral-700 transition-colors"
          >
            <Phone size={16} />
            {PHONE_DISPLAY}
          </a>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <div className="px-4 min-h-[70px] flex items-center justify-between">
          <a href="/" className="flex items-center" aria-label="Label Maison Conciergerie - Accueil">
            <img
              src="/images/logo-label-maison.jpg"
              alt="Label Maison Conciergerie"
              className="h-14 w-auto object-contain"
            />
          </a>

          <div className="flex items-center gap-2">
            <a
              href={PHONE_HREF}
              aria-label={`Appeler ${PHONE_DISPLAY}`}
              className="inline-flex items-center justify-center bg-black text-white font-bold text-[12px] sm:text-[13px] px-3.5 sm:px-4 h-11 rounded-full hover:bg-neutral-700 whitespace-nowrap"
            >
              {PHONE_DISPLAY}
            </a>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={open}
              className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-black/5 hover:bg-black/10 shrink-0"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden bg-white border-t border-black/5"
            >
              <ul className="px-4 py-4 flex flex-col">
                {navLinks.map((l) => (
                  <li key={l.hash}>
                    <a
                      href={anchorHref(l.hash)}
                      onClick={() => setOpen(false)}
                      className="block py-3 text-[15px] font-medium text-neutral-800 hover:text-[#556B2F]"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
