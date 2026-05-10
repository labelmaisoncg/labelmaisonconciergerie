import { useEffect, useState, type RefObject } from 'react';

export function useCenterDetection(ref: RefObject<HTMLDivElement | null>) {
  const [centerIdx, setCenterIdx] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let rafId = 0;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const cards = el.querySelectorAll<HTMLElement>('[data-card-idx]');
      let bestIdx = 0;
      let bestDist = Infinity;
      cards.forEach((card) => {
        const r = card.getBoundingClientRect();
        const c = r.left + r.width / 2;
        const d = Math.abs(c - center);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = Number(card.dataset.cardIdx) || 0;
        }
      });
      setCenterIdx(bestIdx);
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(compute);
    };

    compute();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [ref]);

  return centerIdx;
}
