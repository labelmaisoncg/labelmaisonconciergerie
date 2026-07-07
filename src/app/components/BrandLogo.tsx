/**
 * BrandLogo — lockup officiel « Ivoire & or » (source : Label Maison - Identite).
 * Clé or (key-gold-deep sur fond clair, key-gold sur fond foncé) + « LABEL MAISON »
 * brun profond #403118 + « CONCIERGERIE » or #8a6f34, en Cormorant.
 *
 * Ratios repris au pixel près de la charte :
 *  - stacked  (Logo principal) : clé 300 / LABEL 60 / CONCIERGERIE 22 / filets 52×1
 *  - horizontal (Version horizontale) : clé 190 / LABEL 40 / CONCIERGERIE 16
 *
 * `size` = taille en px du mot « LABEL MAISON » (tout le reste est en em, donc scale).
 */
export function BrandLogo({
  layout = 'horizontal',
  size = 20,
  dark = false,
  animated = false,
  className = '',
}: {
  layout?: 'horizontal' | 'stacked';
  size?: number | string;
  dark?: boolean;
  animated?: boolean;
  className?: string;
}) {
  const keySrc = dark ? '/images/key-gold.png' : '/images/key-gold-deep.png';

  return (
    <span
      className={`brandlogo bl-${layout} ${dark ? 'bl-dark' : ''} ${animated ? 'bl-anim' : ''} ${className}`}
      style={{ fontSize: typeof size === 'number' ? `${size}px` : size }}
      aria-label="Label Maison Conciergerie"
      role="img"
    >
      <span className="bl-key-wrap">
        <img className="bl-key" src={keySrc} alt="" aria-hidden="true" />
        {animated && (
          <span
            className="bl-shine"
            aria-hidden="true"
            style={{ WebkitMaskImage: `url(${keySrc})`, maskImage: `url(${keySrc})` }}
          />
        )}
      </span>
      <span className="bl-divider" aria-hidden="true" />
      <span className="bl-text">
        <span className="bl-name">LABEL MAISON</span>
        <span className="bl-sub">
          <span className="bl-rule bl-rule-l" aria-hidden="true" />
          <span className="bl-conc">CONCIERGERIE</span>
          <span className="bl-rule bl-rule-r" aria-hidden="true" />
        </span>
      </span>
    </span>
  );
}
