import { useEffect, type RefObject } from 'react';

export function useArrowKeys(ref: RefObject<HTMLDivElement | null>, step: number) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onKey = (e: KeyboardEvent) => {
      if (!el.contains(document.activeElement)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        el.scrollBy({ left: step, behavior: 'smooth' });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        el.scrollBy({ left: -step, behavior: 'smooth' });
      }
    };

    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [ref, step]);
}
