import { Instagram, Mail, MapPin, Music, Phone } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

const EMAIL = 'contact@labelmaisoncgexperience.fr';
const PHONE_DISPLAY = '+33 7 49 54 83 55';
const PHONE_HREF = 'tel:+33749548355';

export function Footer() {
  return (
    <footer className="relative bg-[#F4F1EA] mt-[60px] md:mt-[100px] overflow-hidden">
      <div className="relative max-w-[1152px] mx-auto px-6 pt-[60px] md:pt-[100px] pb-10 md:pb-[60px] flex flex-col gap-10 md:gap-[60px]">
        {/* Section 1 — Tagline + nav columns */}
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] gap-10">
          <div>
            <h3 className="text-2xl md:text-3xl font-bold leading-tight max-w-md">
              Votre conciergerie de confiance pour faire de votre logement une{' '}
              <span className="font-serif-italic font-bold text-[#A97C30]">source de revenu passif</span>.
            </h3>

            <ul className="mt-6 space-y-3 text-[15px] text-neutral-700">
              <li className="flex items-start gap-3">
                <Mail size={16} className="text-[#A97C30] shrink-0 mt-1" />
                <a href={`mailto:${EMAIL}`} className="hover:text-[#A97C30] break-all">
                  {EMAIL}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={16} className="text-[#A97C30] shrink-0" />
                <a href={PHONE_HREF} className="hover:text-[#A97C30]">
                  {PHONE_DISPLAY}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <MapPin size={16} className="text-[#A97C30] shrink-0" />
                <span>Paris</span>
              </li>
            </ul>

            <div className="mt-6 flex items-center gap-3">
              <a
                href="https://www.instagram.com/labelmaisoncg/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram @labelmaisoncg"
                className="inline-flex items-center gap-2 px-3 h-10 rounded-full bg-black/5 hover:bg-[#A97C30] hover:text-white transition-colors text-[13px] font-medium"
              >
                <Instagram size={16} />
                @labelmaisoncg
              </a>
              <a
                href="https://www.tiktok.com/@labelmaison.cg"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok @labelmaison.cg"
                className="inline-flex items-center gap-2 px-3 h-10 rounded-full bg-black/5 hover:bg-[#A97C30] hover:text-white transition-colors text-[13px] font-medium"
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
                <a href="#services" className="hover:text-[#A97C30]">
                  Services
                </a>
              </li>
              <li>
                <a href="#process" className="hover:text-[#A97C30]">
                  Comment ça marche ?
                </a>
              </li>
              <li>
                <a href="#offre" className="hover:text-[#A97C30]">
                  Notre offre
                </a>
              </li>
              {/* Lien permanent vers la love room : présent sur toutes les pages
                  de l'app, il fait remonter /bacam-spa dans le maillage interne. */}
              <li>
                <a href="/bacam-spa" className="hover:text-[#A97C30]">
                  Ba'cam Spa — love room &amp; spa privatif
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
                <a href="#faq" className="hover:text-[#A97C30]">
                  F.A.Q
                </a>
              </li>
              <li>
                <a href="#valeurs" className="hover:text-[#A97C30]">
                  Nos valeurs
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-[#A97C30]">
                  Contact
                </a>
              </li>
              <li>
                <a href="#apropos" className="hover:text-[#A97C30]">
                  Qui sommes-nous ?
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Section 2 — Logo & CTAs */}
        <div className="border-t border-black/10 pt-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <a href="/" className="flex items-center" aria-label="Label Maison Conciergerie - Accueil">
            <BrandLogo layout="stacked" size={30} />
          </a>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <a
              href="#contact"
              className="inline-flex items-center justify-center bg-[#403118] text-white font-bold text-[14px] px-6 py-3.5 rounded-full hover:bg-[#2C2418]"
            >
              Contacter
            </a>
            <a
              href="#services"
              className="inline-flex items-center justify-center bg-transparent border border-[#403118]/20 text-[#403118] font-bold text-[14px] px-6 py-3.5 rounded-full hover:border-[#A97C30] hover:text-[#7C561D] transition-colors"
            >
              Services
            </a>
          </div>
        </div>

        {/* Section 2 bis — Maillage territorial.
            Ces liens sont présents sur toutes les pages de l'app : ils font remonter
            les hubs des silos SEO (Paris, France, Côte d'Azur, banlieue, Essonne)
            et les pages de service, qui distribuent ensuite vers les communes. */}
        <nav aria-label="Nos territoires et services" className="border-t border-black/10 pt-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-[13px] text-neutral-600">
            <div>
              <h4 className="font-semibold uppercase tracking-[1px] text-neutral-500 mb-3">
                Nos territoires
              </h4>
              <ul className="space-y-2">
                {[
                  ['Conciergerie Airbnb à Paris', '/conciergerie-airbnb-paris'],
                  ['Banlieue parisienne', '/conciergerie-airbnb-banlieue-parisienne'],
                  ['Essonne (91)', '/conciergerie-airbnb-essonne'],
                  ['Côte d’Azur', '/conciergerie-cote-d-azur'],
                  ['Toute la France', '/conciergerie-airbnb-france'],
                ].map(([label, href]) => (
                  <li key={href}>
                    <a href={href} className="hover:text-[#A97C30]">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold uppercase tracking-[1px] text-neutral-500 mb-3">
                Propriétaires
              </h4>
              <ul className="space-y-2">
                {[
                  ['Estimer mes revenus', '/estimation-rentabilite-airbnb'],
                  ['Simulateur de revenus', '/simulateur-revenus-airbnb'],
                  ['Gestion locative à Paris', '/gestion-locative-paris'],
                  ['Gestion locative en France', '/gestion-locative-france'],
                  ['Investissement locatif', '/investissement-locatif-paris'],
                  ['Gestion de villa Côte d’Azur', '/gestion-villa-cote-d-azur'],
                ].map(([label, href]) => (
                  <li key={href}>
                    <a href={href} className="hover:text-[#A97C30]">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold uppercase tracking-[1px] text-neutral-500 mb-3">
                Conciergerie privée
              </h4>
              <ul className="space-y-2">
                {[
                  ['Conciergerie de luxe à Paris', '/conciergerie-privee-paris'],
                  ['Conciergerie à Nice', '/conciergerie-privee-nice'],
                  ['Conciergerie de luxe à Cannes', '/conciergerie-luxe-cannes'],
                  ['Conciergerie à Monaco', '/conciergerie-monaco'],
                  ['Marrakech & Dubaï', '/conciergerie-marrakech'],
                ].map(([label, href]) => (
                  <li key={href}>
                    <a href={href} className="hover:text-[#A97C30]">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold uppercase tracking-[1px] text-neutral-500 mb-3">
                Nos services
              </h4>
              <ul className="space-y-2">
                {[
                  ['Van avec chauffeur', '/van-avec-chauffeur-paris'],
                  ['Navette aéroport', '/navette-aeroport-paris'],
                  ['Montres de luxe', '/achat-vente-montres-de-luxe'],
                  ['Personal shopper', '/personal-shopper-paris'],
                  ['Le blog des propriétaires', '/blog'],
                ].map(([label, href]) => (
                  <li key={href}>
                    <a href={href} className="hover:text-[#A97C30]">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </nav>

        {/* Section 3 — Copyright */}
        <div className="border-t border-black/10 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[13px] text-neutral-500">
          <p>© 2026 Label Maison Conciergerie · Tous droits réservés</p>
          <div className="flex items-center gap-4">
            <a href="/mentions-legales" className="hover:text-[#A97C30]">
              Mentions légales
            </a>
            <span className="opacity-40">·</span>
            <a href="/politique-de-confidentialite" className="hover:text-[#A97C30]">
              Confidentialité
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
