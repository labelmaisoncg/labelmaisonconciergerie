import { useEffect, useRef, useState } from 'react';

/**
 * Animated brand logo — antique key drawn with progressive stroke + wordmark
 * letter-by-letter reveal, then subtle breathing loop. Palette « Ivoire & or » :
 * clé + filet or, « LABEL MAISON » brun, « CONCIERGERIE » or grisé, fond ivoire.
 */
export function AnimatedLogo({
  showBaseline = true,
  showReplay = false,
  className = '',
}: {
  showBaseline?: boolean;
  showReplay?: boolean;
  className?: string;
}) {
  const wordmarkRef = useRef<HTMLHeadingElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const root = wordmarkRef.current;
    if (!root) return;

    const lines = root.querySelectorAll<HTMLSpanElement>('.line');
    const baseDelay = 3.2;
    let i = 0;
    lines.forEach((lineEl) => {
      const text = lineEl.dataset.text ?? '';
      lineEl.innerHTML = '';
      [...text].forEach((c) => {
        const span = document.createElement('span');
        span.className = 'ch' + (c === ' ' ? ' space' : '');
        span.textContent = c === ' ' ? '' : c;
        span.style.animationDelay = baseDelay + i * 0.045 + 's';
        lineEl.appendChild(span);
        i++;
      });
      i += 2;
    });
  }, [tick]);

  return (
    <div className={`animated-logo-stage ${className}`}>
      <div className="animated-logo" key={tick}>
        {/* === Clé === */}
        <div className="key-stage" aria-hidden="true">
          <svg className="key-svg" viewBox="0 0 1000 360" preserveAspectRatio="xMidYMid meet">
            {/* Bouclier en trèfle */}
            <circle className="key-stroke" cx="190" cy="105" r="48" style={{ ['--len' as never]: '320' }} />
            <circle className="key-stroke" cx="190" cy="255" r="48" style={{ ['--len' as never]: '320' }} />
            <circle className="key-stroke" cx="115" cy="180" r="48" style={{ ['--len' as never]: '320' }} />
            <circle className="key-stroke" cx="265" cy="180" r="48" style={{ ['--len' as never]: '320' }} />
            <path
              className="key-stroke"
              style={{ ['--len' as never]: '980' }}
              d="M 190,57 C 220,57 238,75 238,105 C 268,105 312,128 312,180 C 312,232 268,255 238,255 C 238,285 220,303 190,303 C 160,303 142,285 142,255 C 112,255 68,232 68,180 C 68,128 112,105 142,105 C 142,75 160,57 190,57 Z"
            />
            <circle className="key-stroke" cx="190" cy="180" r="22" style={{ ['--len' as never]: '150' }} />
            <circle className="key-fill" cx="190" cy="180" r="5" />

            {/* Tige */}
            <path
              className="key-stroke"
              style={{ ['--len' as never]: '720' }}
              d="M 312,180 L 470,180 M 312,186 L 470,186 M 312,174 L 470,174"
            />
            <path className="key-stroke" style={{ ['--len' as never]: '120' }} d="M 312,165 L 312,195" />

            {/* Ornement central */}
            <circle className="key-stroke" cx="500" cy="180" r="22" style={{ ['--len' as never]: '150' }} />
            <path
              className="key-stroke"
              style={{ ['--len' as never]: '80' }}
              d="M 478,168 L 478,192 M 522,168 L 522,192"
            />
            <circle className="key-fill" cx="500" cy="180" r="6" />

            {/* Tige droite */}
            <path
              className="key-stroke"
              style={{ ['--len' as never]: '720' }}
              d="M 530,180 L 720,180 M 530,186 L 720,186 M 530,174 L 720,174"
            />

            {/* Pannetons */}
            <path
              className="key-stroke"
              style={{ ['--len' as never]: '1100' }}
              d="M 720,150 L 880,150 L 880,210 L 845,210 L 845,250 L 825,250 L 825,210 L 800,210 L 800,260 L 775,260 L 775,210 L 720,210 Z"
            />
            <circle className="key-stroke" cx="755" cy="178" r="6" style={{ ['--len' as never]: '45' }} />

            {/* Détails fins */}
            <g className="key-detail" style={{ ['--len' as never]: '200' }}>
              <path d="M 350,170 L 360,165" />
              <path d="M 380,170 L 390,165" />
              <path d="M 410,170 L 420,165" />
              <path d="M 560,170 L 570,165" />
              <path d="M 590,170 L 600,165" />
              <path d="M 620,170 L 630,165" />
              <path d="M 650,170 L 660,165" />
              <path d="M 685,170 L 695,165" />
            </g>
          </svg>
          <div className="key-shine"></div>
        </div>

        {/* === Filet === */}
        <div className="rule" aria-hidden="true"></div>

        {/* === Wordmark === */}
        <h2 className="wordmark" ref={wordmarkRef}>
          <span className="line" data-text="LABEL MAISON"></span>
          <span className="line" data-text="CONCIERGERIE"></span>
        </h2>

        {showBaseline && <div className="baseline">Service d'exception</div>}
      </div>

      {showReplay && (
        <button type="button" className="replay" onClick={() => setTick((t) => t + 1)}>
          Rejouer
        </button>
      )}

      <style>{`
        .animated-logo-stage {
          --bg: #F4ECDA;
          --bg-2: #EADFC4;
          --ink: #A8813A;           /* or — clé, filet, ornements */
          --ink-soft: #8A6A28;      /* or profond — baseline */
          --word: #3A2C15;          /* brun profond — LABEL MAISON */
          --word-2: #9A855A;        /* or grisé — CONCIERGERIE */
          --hairline: rgba(168, 129, 58, 0.45);
          font-family: 'Cormorant Garamond', 'Garamond', 'Times New Roman', serif;
          color: var(--ink);
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          background: radial-gradient(70% 60% at 50% 45%, #FBF6EA 0%, var(--bg) 58%, var(--bg-2) 100%);
          border-radius: 24px;
          overflow: hidden;
          display: grid;
          place-items: center;
          container-type: inline-size;
        }

        .animated-logo {
          width: 86%;
          aspect-ratio: 1 / 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: clamp(18px, 4cqw, 48px);
          padding: clamp(20px, 4cqw, 56px);
          position: relative;
          animation: logo-breathe 9s ease-in-out 6s infinite;
        }

        /* Key */
        .key-stage {
          width: 78%;
          aspect-ratio: 1000 / 360;
          position: relative;
          transform-origin: 22% 50%;
          animation: keySettle 5.6s cubic-bezier(.6,.05,.2,1) 0.1s forwards;
        }
        @keyframes keySettle {
          0%   { transform: rotate(-22deg) translateX(-18px); opacity: 0; }
          10%  { opacity: 1; }
          35%  { transform: rotate(-8deg)  translateX(-6px); }
          60%  { transform: rotate(6deg)   translateX(2px); }
          80%  { transform: rotate(-2deg)  translateX(0); }
          100% { transform: rotate(0deg)   translateX(0); opacity: 1; }
        }
        .key-svg { width: 100%; height: 100%; display: block; overflow: visible; }
        .key-stroke {
          fill: none;
          stroke: var(--ink);
          stroke-width: 5;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: var(--len, 1200);
          stroke-dashoffset: var(--len, 1200);
          animation: drawStroke 2.6s cubic-bezier(.65,.05,.2,1) 0.2s forwards;
        }
        .key-fill {
          fill: var(--ink);
          opacity: 0;
          animation: fadeIn 1.4s ease-out 2.4s forwards;
        }
        .key-detail {
          fill: none;
          stroke: var(--ink);
          stroke-width: 2.2;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: var(--len, 600);
          stroke-dashoffset: var(--len, 600);
          animation: drawStroke 1.6s cubic-bezier(.65,.05,.2,1) 1.6s forwards;
        }
        @keyframes drawStroke { to { stroke-dashoffset: 0; } }
        @keyframes fadeIn { to { opacity: 1; } }

        .key-shine {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
        }
        .key-shine::after {
          content: '';
          position: absolute;
          top: 38%;
          left: -30%;
          width: 22%;
          height: 24%;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,.55) 50%, transparent 100%);
          filter: blur(8px);
          transform: skewX(-18deg);
          opacity: 0;
          animation: shineSlide 4.2s ease-in-out 5.2s infinite;
        }
        @keyframes shineSlide {
          0%   { left: -30%; opacity: 0; }
          15%  { opacity: 1; }
          60%  { left: 110%; opacity: 0; }
          100% { left: 110%; opacity: 0; }
        }

        /* Rule */
        .rule {
          width: 30%;
          height: 1px;
          background: var(--hairline);
          transform-origin: center;
          transform: scaleX(0);
          animation: ruleIn 1.2s cubic-bezier(.6,.05,.2,1) 3.0s forwards;
          position: relative;
        }
        .rule::before, .rule::after {
          content: '';
          position: absolute;
          top: 50%;
          width: 4px; height: 4px;
          background: var(--ink);
          border-radius: 50%;
          transform: translateY(-50%) scale(0);
          animation: dotIn .5s ease-out 4.0s forwards;
        }
        .rule::before { left: -2px; }
        .rule::after  { right: -2px; }
        @keyframes ruleIn { to { transform: scaleX(1); } }
        @keyframes dotIn  { to { transform: translateY(-50%) scale(1); } }

        /* Wordmark */
        .wordmark {
          text-align: center;
          line-height: 1.05;
          letter-spacing: 0.06em;
          font-weight: 500;
          font-size: clamp(16px, 4.2cqw, 56px);
          text-transform: uppercase;
          color: var(--word);
          user-select: none;
          margin: 0;
          width: 100%;
          max-width: 100%;
        }
        .wordmark .line {
          display: block;
          white-space: nowrap;
        }
        .wordmark .line + .line {
          margin-top: 0.22em;
          color: var(--word-2);
          font-size: 0.62em;
          letter-spacing: 0.30em;
        }
        .wordmark .ch {
          display: inline-block;
          opacity: 0;
          transform: translateY(0.35em);
          filter: blur(6px);
          animation: charIn .9s cubic-bezier(.2,.7,.2,1) forwards;
        }
        .wordmark .ch.space { width: 0.45em; }
        @keyframes charIn { to { opacity: 1; transform: translateY(0); filter: blur(0); } }

        .baseline {
          margin-top: 0.4em;
          font-style: italic;
          font-weight: 400;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          font-size: clamp(8px, 1.2cqw, 13px);
          color: var(--ink-soft);
          opacity: 0;
          animation: fadeIn 1.2s ease-out 4.6s forwards;
        }

        @keyframes logo-breathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.012); }
        }

        .replay {
          position: absolute;
          bottom: 14px; right: 14px;
          background: transparent;
          color: var(--ink);
          border: 1px solid var(--hairline);
          padding: 8px 14px;
          font: 500 10px/1 'Cormorant Garamond', serif;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          border-radius: 999px;
          cursor: pointer;
          backdrop-filter: blur(6px);
          transition: background .25s ease, color .25s ease, border-color .25s ease;
          opacity: 0;
          animation: fadeIn .6s ease-out 5.4s forwards;
        }
        .replay:hover { background: var(--ink); color: var(--bg); border-color: var(--ink); }

        @media (prefers-reduced-motion: reduce) {
          .animated-logo-stage *,
          .animated-logo-stage *::before,
          .animated-logo-stage *::after {
            animation-duration: 0.001ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </div>
  );
}
