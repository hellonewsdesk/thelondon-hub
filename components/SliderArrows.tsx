'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The scripted half of StorySlider: two square arrow buttons over a track it
 * locates by id (the track itself is server-rendered).
 *
 * Behaviour contract (docs/DESIGN.md § Slider):
 *   - hidden entirely when the track does not overflow;
 *   - disabled at the respective end;
 *   - scrollBy one page of cards, keeping one card of overlap as a visual
 *     anchor;
 *   - aria-hidden and out of the tab order: these are pointer conveniences.
 *     Keyboard users focus the track (tabIndex=0) and use native arrow-key
 *     scrolling, so a keyboard-reachable duplicate control would only add
 *     tab stops.
 *
 * With JS off this component renders nothing on the server beyond its
 * initial null state — the rail simply scrolls.
 */
export function SliderArrows({ trackId }: { trackId: string }) {
  const trackRef = useRef<HTMLElement | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    // 2px slack: sub-pixel widths otherwise leave "next" enabled at the end.
    const max = el.scrollWidth - el.clientWidth;
    setOverflows(max > 2);
    setCanPrev(el.scrollLeft > 2);
    setCanNext(el.scrollLeft < max - 2);
  }, []);

  useEffect(() => {
    const el = document.getElementById(trackId);
    if (!el) return;
    trackRef.current = el;
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', sync);
      ro.disconnect();
      trackRef.current = null;
    };
  }, [trackId, sync]);

  function scrollByPage(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    // One viewport of the track minus a card's worth of overlap.
    const step = Math.max(el.clientWidth * 0.85, 240);
    // No explicit `behavior`: the default ("auto") defers to the track's CSS
    // scroll-behavior, which globals.css makes smooth ONLY under
    // prefers-reduced-motion: no-preference. Passing 'smooth' here would
    // override the reader's motion preference.
    el.scrollBy({ left: step * direction });
  }

  if (!overflows) return null;

  return (
    <div className="slider__nav mb-3 justify-end" aria-hidden="true">
      <button
        type="button"
        className="slider__btn"
        tabIndex={-1}
        disabled={!canPrev}
        onClick={() => scrollByPage(-1)}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" focusable="false">
          <path d="M10 2 4 8l6 6" strokeLinecap="square" />
        </svg>
      </button>
      <button
        type="button"
        className="slider__btn"
        tabIndex={-1}
        disabled={!canNext}
        onClick={() => scrollByPage(1)}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" focusable="false">
          <path d="M6 2l6 6-6 6" strokeLinecap="square" />
        </svg>
      </button>
    </div>
  );
}
