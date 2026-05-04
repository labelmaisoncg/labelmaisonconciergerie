import { useEffect, useState } from 'react';
import { AnimatedLogo } from './AnimatedLogo';

const SESSION_KEY = 'lm_intro_seen';
const HOLD_AFTER_ANIMATION_MS = 800;
const FADE_OUT_MS = 700;

/**
 * Full-screen splash that plays the AnimatedLogo on first visit per session,
 * then fades out and unmounts. Subsequent navigations within the same tab
 * skip the intro so the user isn't forced through it again.
 *
 * Click anywhere on the splash to skip immediately.
 */
export function SplashIntro() {
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.sessionStorage.getItem(SESSION_KEY) === '1') return false;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    return true;
  });
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!show) return;

    // Lock body scroll while splash is up
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // The AnimatedLogo finishes its main reveal around 5.8s
    // (key 0.1→3s, wordmark 3.2→4.6s, baseline ends 5.8s).
    const totalAnimation = 5800;
    const fadeStart = window.setTimeout(() => setFading(true), totalAnimation + HOLD_AFTER_ANIMATION_MS);
    const unmount = window.setTimeout(() => {
      setShow(false);
      window.sessionStorage.setItem(SESSION_KEY, '1');
    }, totalAnimation + HOLD_AFTER_ANIMATION_MS + FADE_OUT_MS);

    return () => {
      clearTimeout(fadeStart);
      clearTimeout(unmount);
      document.body.style.overflow = prevOverflow;
    };
  }, [show]);

  if (!show) return null;

  const handleSkip = () => {
    setFading(true);
    window.setTimeout(() => {
      setShow(false);
      window.sessionStorage.setItem(SESSION_KEY, '1');
    }, FADE_OUT_MS);
  };

  return (
    <div
      role="presentation"
      onClick={handleSkip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#d6dcd5',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
      }}
      aria-label="Intro Label Maison Conciergerie — cliquez pour passer"
    >
      <div style={{ width: 'min(86vmin, 920px)', aspectRatio: '1 / 1' }}>
        <AnimatedLogo />
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleSkip();
        }}
        style={{
          position: 'fixed',
          top: 24,
          right: 24,
          background: 'transparent',
          color: '#2f4a3a',
          border: '1px solid rgba(47, 74, 58, 0.35)',
          padding: '8px 16px',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          borderRadius: 999,
          cursor: 'pointer',
          fontFamily: "'Cormorant Garamond', serif",
        }}
      >
        Passer →
      </button>
    </div>
  );
}
