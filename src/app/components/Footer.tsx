import { Instagram, Mail, MapPin, Music, Phone } from 'lucide-react';

const EMAIL = 'contact@labelmaisoncgexperience.fr';
const PHONE_DISPLAY = '+33 7 49 54 83 55';
const PHONE_HREF = 'tel:+33749548355';

export function Footer() {
  return (
    <footer className="relative bg-zinc-100 mt-[60px] md:mt-[100px] overflow-hidden">
      <div className="relative max-w-[1152px] mx-auto px-6 pt-[60px] md:pt-[100px] pb-10 md:pb-[60px] flex flex-col gap-10 md:gap-[60px]">
        {/* Section 1 — Tagline + nav columns */}
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] gap-10">
          <div>
            <h3 className="text-2xl md:text-3xl font-bold leading-tight max-w-md">
              Votre conciergerie de confiance pour faire de votre logement une{' '}
              <span className="font-serif-italic font-bold text-[#556B2F]">source de revenu passif</span>.
            </h3>

            <ul className="mt-6 space-y-3 text-[15px] text-neutral-700">
              <li className="flex items-start gap-3">
                <Mail size={16} className="text-[#556B2F] shrink-0 mt-1" />
                <a href={`mailto:${EMAIL}`} className="hover:text-[#556B2F] break-all">
                  {EMAIL}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={16} className="text-[#556B2F] shrink-0" />
                <a href={PHONE_HREF} className="hover:text-[#556B2F]">
                  {PHONE_DISPLAY}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <MapPin size={16} className="text-[#556B2F] shrink-0" />
                <span>Paris</span>
              </li>
            </ul>

            <div className="mt-6 flex items-center gap-3">
              <a
                href="https://www.instagram.com/labelmaisoncg/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram @labelmaisoncg"
                className="inline-flex items-center gap-2 px-3 h-10 rounded-full bg-black/5 hover:bg-[#556B2F] hover:text-white transition-colors text-[13px] font-medium"
              >
                <Instagram size={16} />
                @labelmaisoncg
              </a>
              <a
                href="https://www.tiktok.com/@labelmaison.cg"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok @labelmaison.cg"
                className="inline-flex items-center gap-2 px-3 h-10 rounded-full bg-black/5 hover:bg-[#556B2F] hover:text-white transition-colors text-[13px] font-medium"
              >
                <Music size={16} />
                @labelmaison.cg
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-[13px] font-semibold uppercase tracking-[1px] text-neutral-500 mb-4">
              Notre service
            </h4>
            <ul className="space-y-3 text-[15px] text-neutral-700">
              <li>
                <a href="#services" className="hover:text-[#556B2F]">
                  Services
                </a>
              </li>
              <li>
                <a href="#process" className="hover:text-[#556B2F]">
                  Comment ça marche ?
                </a>
              </li>
              <li>
                <a href="#offre" className="hover:text-[#556B2F]">
                  Notre offre
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[13px] font-semibold uppercase tracking-[1px] text-neutral-500 mb-4">
              Liens rapides
            </h4>
            <ul className="space-y-3 text-[15px] text-neutral-700">
              <li>
                <a href="#faq" className="hover:text-[#556B2F]">
                  F.A.Q
                </a>
              </li>
              <li>
                <a href="#valeurs" className="hover:text-[#556B2F]">
                  Nos valeurs
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-[#556B2F]">
                  Contact
                </a>
              </li>
              <li>
                <a href="#apropos" className="hover:text-[#556B2F]">
                  Qui sommes-nous ?
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Section 2 — Logo & CTAs */}
        <div className="border-t border-black/10 pt-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <a href="/" className="flex items-center" aria-label="Label Maison Conciergerie - Accueil">
            <img
              src="/images/logo-label-maison.jpg"
              alt="Label Maison Conciergerie"
              className="h-20 md:h-28 w-auto object-contain"
            />
          </a>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <a
              href="#contact"
              className="inline-flex items-center justify-center bg-black text-white font-bold text-[14px] px-6 py-3.5 rounded-full hover:bg-neutral-700"
            >
              Contacter
            </a>
            <a
              href="#services"
              className="inline-flex items-center justify-center bg-black/5 text-neutral-800 font-bold text-[14px] px-6 py-3.5 rounded-full hover:bg-black/10"
            >
              Services
            </a>
          </div>
        </div>

        {/* Section 3 — Copyright */}
        <div className="border-t border-black/10 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[13px] text-neutral-500">
          <p>© 2026 Label Maison Conciergerie · Tous droits réservés</p>
          <div className="flex items-center gap-4">
            <a href="/mentions-legales" className="hover:text-[#556B2F]">
              Mentions légales
            </a>
            <span className="opacity-40">·</span>
            <a href="/politique-de-confidentialite" className="hover:text-[#556B2F]">
              Confidentialité
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
