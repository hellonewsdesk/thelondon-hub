'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * A slim progress bar across the top during a page navigation.
 *
 * WHY THIS AND NOT A ROOT `loading.tsx`: a loading file makes Next flush the
 * document shell the moment navigation starts, which means a 200 has already
 * gone out before the page can call `notFound()`. That turns every unknown
 * article slug into a soft 404 — a page that says "not found" while telling
 * Google it found something. The root loading file must never exist in this
 * project for exactly that reason.
 *
 * A progress bar has none of that coupling. It is pure client state layered
 * over whatever the server ends up returning, so a 404 stays a 404.
 *
 * Behaviour is the one readers already know from GitHub and YouTube:
 *
 *   - Nothing at all under ~120ms. Fast navigations should leave no trace: a
 *     bar that flashes on every click makes a fast site look busy.
 *   - Once shown it eases towards 90% and waits. It never claims to be
 *     finished before the page is, because a bar that sits full while nothing
 *     has changed reads as broken.
 *   - On arrival it completes and fades.
 */

/** Below this, the navigation is imperceptible and the bar stays away. */
const SHOW_AFTER = 120;

/** How far the bar creeps while waiting. Never 100 until the page lands. */
const CEILING = 90;

export function NavProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState<number | null>(null);

  const showTimer = useRef<number | null>(null);
  const creepTimer = useRef<number | null>(null);
  const doneTimer = useRef<number | null>(null);
  // The path we were on when a navigation started, so arrival is detectable.
  const navigatingFrom = useRef<string | null>(null);

  const clearAll = () => {
    for (const t of [showTimer, creepTimer, doneTimer]) {
      if (t.current !== null) window.clearTimeout(t.current);
      t.current = null;
    }
  };

  /* ---- Start on any click that will actually navigate ------------------ */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Let the browser handle anything that is not a plain left click: new
      // tab, download, context menu.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest?.('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      // Same-origin only, and not a jump to an anchor on this very page.
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      navigatingFrom.current = window.location.pathname;
      clearAll();

      showTimer.current = window.setTimeout(() => {
        setProgress(12);

        // Ease towards the ceiling: big steps early, smaller as it approaches,
        // so a slow response still looks like it is making headway.
        const creep = () => {
          setProgress((current) => {
            if (current === null) return current;
            const next = current + Math.max(0.4, (CEILING - current) * 0.08);
            return Math.min(next, CEILING);
          });
          creepTimer.current = window.setTimeout(creep, 180);
        };
        creepTimer.current = window.setTimeout(creep, 180);
      }, SHOW_AFTER);
    };

    document.addEventListener('click', onClick, { capture: true });
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      clearAll();
    };
  }, []);

  /* ---- Finish when the new path renders -------------------------------- */
  useEffect(() => {
    if (navigatingFrom.current === null) return;
    if (navigatingFrom.current === pathname) return;

    navigatingFrom.current = null;
    clearAll();

    // Only complete a bar that was actually shown. A navigation that beat the
    // 120ms threshold should leave no trace at all.
    setProgress((current) => (current === null ? null : 100));
    doneTimer.current = window.setTimeout(() => setProgress(null), 260);

    return clearAll;
  }, [pathname]);

  if (progress === null) return null;

  return (
    <div
      className="navprogress"
      // Decorative: the page transition itself is announced by the new
      // document. A live progress role here would interrupt a screen reader
      // mid-sentence on every click.
      aria-hidden="true"
    >
      <span
        className="navprogress__bar"
        data-complete={progress >= 100 ? 'true' : undefined}
        // Transform, never width — width animates on the layout thread and
        // would compete with the very navigation it is reporting on.
        style={{ transform: `scaleX(${progress / 100})` }}
      />
    </div>
  );
}
