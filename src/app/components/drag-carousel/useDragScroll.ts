import { useEffect, useRef, type RefObject } from 'react';

const DRAG_THRESHOLD = 6;

export function useDragScroll(ref: RefObject<HTMLDivElement | null>) {
  const stateRef = useRef({
    pointerDown: false,
    moved: false,
    startX: 0,
    startScrollLeft: 0,
    lastX: 0,
    lastT: 0,
    velocity: 0,
    rafId: 0,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const state = stateRef.current;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      state.pointerDown = true;
      state.moved = false;
      state.startX = e.clientX;
      state.startScrollLeft = el.scrollLeft;
      state.lastX = e.clientX;
      state.lastT = performance.now();
      state.velocity = 0;
      cancelAnimationFrame(state.rafId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!state.pointerDown) return;
      const dx = e.clientX - state.startX;

      if (!state.moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        state.moved = true;
        el.dataset.dragging = 'true';
      }

      el.scrollLeft = state.startScrollLeft - dx;

      const now = performance.now();
      const dt = now - state.lastT;
      if (dt > 0) {
        state.velocity = (e.clientX - state.lastX) / dt;
      }
      state.lastX = e.clientX;
      state.lastT = now;
    };

    const onPointerUp = () => {
      if (!state.pointerDown) return;
      const wasDrag = state.moved;
      state.pointerDown = false;
      state.moved = false;
      delete el.dataset.dragging;

      if (!wasDrag) return;

      let v = state.velocity;
      const friction = 0.92;
      const step = () => {
        if (Math.abs(v) < 0.02) return;
        el.scrollLeft -= v * 16;
        v *= friction;
        state.rafId = requestAnimationFrame(step);
      };
      step();
    };

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      cancelAnimationFrame(state.rafId);
    };
  }, [ref]);
}
