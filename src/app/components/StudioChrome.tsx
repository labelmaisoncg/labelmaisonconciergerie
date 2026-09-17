import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

// =============================================================================
// Habillage propre à « Label Maison Studio ». La page est une landing dédiée :
// la navigation générale du site et son grand pied de page sont masqués (voir
// Navigation.tsx / Footer.tsx) pour ne rien mettre entre le visiteur et le
// tunnel. On garde ici le strict nécessaire : logo, téléphone, appel à l'action.
// =============================================================================

const GOLD = '#A97C30';
const GOLD_LIGHT = '#E6CD93';
const PHONE_DISPLAY = '+33 7 49 54 83 55';
const PHONE_HREF = 'tel:+33749548355';

export function StudioHeader({ cta = true }: { cta?: boolean }) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(251,249,244,0.88)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E6DDC9',
      }}
    >
      <div className="max-w-[1120px] mx-auto px-5 md:px-6 min-h-[64px] md:min-h-[76px] flex items-center justify-between gap-4">
        <Link to="/studio" aria-label="Label Maison Studio" className="flex items-center">
          <BrandLogo layout="stacked" size={11} />
        </Link>

        <div className="flex items-center gap-2 md:gap-3">
          {cta && (
            <a
              href="#studio"
              className="inline-flex items-center gap-2 font-bold text-[13px] md:text-[14px] px-5 md:px-6 py-2.5 md:py-3 rounded-full transition-transform hover:-translate-y-0.5"
              style={{ background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD})`, color: '#2B220C' }}
            >
              Composer mon rendu <ArrowRight size={14} />
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

export function StudioFooter() {
  return (
    <footer style={{ background: '#241C0C', color: '#CFC6B2' }}>
      <div className="max-w-[1120px] mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
        <BrandLogo layout="stacked" size={11} dark />
        <div className="text-[13px] leading-relaxed">
          <p>
            Paris · Dubaï · Marrakech —{' '}
            <a href={PHONE_HREF} className="hover:underline">
              {PHONE_DISPLAY}
            </a>{' '}
            ·{' '}
            <a href="https://labelmaisoncg.fr" className="hover:underline">
              labelmaisoncg.fr
            </a>
          </p>
          <p className="mt-1.5" style={{ color: '#9C927C' }}>
            Rendu à titre indicatif, non contractuel ·{' '}
            <Link to="/studio/conditions" className="underline">
              Conditions, remboursement, données personnelles
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
