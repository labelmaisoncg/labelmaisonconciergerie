import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import styles from './drag-carousel.module.css';
import { useDragScroll } from './useDragScroll';
import { useCenterDetection } from './useCenterDetection';
import { useArrowKeys } from './useArrowKeys';

type Props = {
  count: number;
  renderCard: (args: { index: number; isCenter: boolean }) => ReactNode;
  cardWidth?: number;
  loop?: boolean;
  showIndicator?: boolean;
  showHint?: boolean;
  className?: string;
  ariaLabel?: string;
};

const GAP = 16;

export function DragCarousel({
  count,
  renderCard,
  cardWidth = 240,
  loop = false,
  showIndicator = true,
  showHint = true,
  className,
  ariaLabel = 'Carousel, faites glisser pour explorer',
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [hintHidden, setHintHidden] = useState(false);
  const total = loop ? count * 3 : count;
  const step = cardWidth + GAP;

  useDragScroll(scrollerRef);
  const centerIdx = useCenterDetection(scrollerRef);
  useArrowKeys(scrollerRef, step);

  // Initial position: start of 2nd set when looping
  useLayoutEffect(() => {
    if (!loop) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollLeft = step * count;
  }, [loop, count, step]);

  // Silent jump: keep scrollLeft inside the middle third
  useEffect(() => {
    if (!loop) return;
    const el = scrollerRef.current;
    if (!el) return;
    let rafId = 0;
    const setWidth = step * count;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (el.scrollLeft < setWidth * 0.5) {
          el.scrollLeft += setWidth;
        } else if (el.scrollLeft > setWidth * 2.5) {
          el.scrollLeft -= setWidth;
        }
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [loop, count, step]);

  // Auto-hide hint on first interaction
  useEffect(() => {
    if (!showHint) return;
    const el = scrollerRef.current;
    if (!el) return;
    const hide = () => setHintHidden(true);
    el.addEventListener('scroll', hide, { once: true, passive: true });
    el.addEventListener('pointerdown', hide, { once: true });
    return () => {
      el.removeEventListener('scroll', hide);
      el.removeEventListener('pointerdown', hide);
    };
  }, [showHint]);

  const realIdx = loop ? centerIdx % count : centerIdx;

  return (
    <div className={`${styles.wrapper} ${className ?? ''}`}>
      {showIndicator && (
        <div className={styles.indicator}>
          <span className={styles.pulseDot} />
          {String(realIdx + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
        </div>
      )}
      <div className={styles.viewport}>
        <div
          ref={scrollerRef}
          className={styles.scroller}
          role="region"
          aria-label={ariaLabel}
          tabIndex={0}
          style={{ '--card-half': `${cardWidth / 2}px` } as CSSProperties}
        >
          {Array.from({ length: total }, (_, i) => {
            const idx = loop ? i % count : i;
            return (
              <div
                key={i}
                className={styles.card}
                data-card-idx={i}
                style={{ width: cardWidth }}
              >
                {renderCard({ index: idx, isCenter: i === centerIdx })}
              </div>
            );
          })}
        </div>
      </div>
      {showHint && (
        <div className={styles.dragHint} data-hidden={hintHidden}>
          ✨ Glissez pour explorer
        </div>
      )}
    </div>
  );
}
