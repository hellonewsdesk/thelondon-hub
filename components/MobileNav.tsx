'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { NavItem } from '../config/sites';
import { SearchForm } from './SearchForm';
import { isActiveNavHref, sectionStyleForHref } from './NavMenu';

/**
 * Hamburger disclosure for narrow viewports: a full-screen chrome panel with
 * a compact search form and the section list.
 *
 * Client component: a disclosure toggle, which needs state. Kept as small as
 * possible so the rest of the header stays server-rendered. It is a
 * CONVENIENCE, never the only path — the nav strip itself scroll-snaps
 * horizontally on mobile, so every section stays reachable with this closed
 * (or with JS off, when this button simply does nothing).
 *
 * The three-bar icon is hand-drawn from spans (`.nav-toggle__bar`) — the
 * style allows exactly one search mark and a nav toggle, both
 * dependency-free.
 */
export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();

  // Lock body scroll while the panel is open (restoring whatever value was
  // there before), and let Escape close it — returning focus to the toggle,
  // which the full-screen panel had covered.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="min-[900px]:hidden">
      <button
        ref={toggleRef}
        type="button"
        className="icon-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? 'Close sections menu' : 'Open sections menu'}
      >
        <span aria-hidden="true">
          <span className="nav-toggle__bar" />
          <span className="nav-toggle__bar" />
          <span className="nav-toggle__bar" />
        </span>
      </button>

      {/* Conditional render, not `hidden`: closed is a REAL close — the
          panel's ~15 links stay out of the tab order and the a11y tree. */}
      {open ? (
        <div id="mobile-nav-panel" className="mobile-panel">
          <div className="mobile-panel__head">
            <h2 className="masthead__tagline">Sections</h2>
            <button
              type="button"
              className="btn"
              onClick={() => setOpen(false)}
              aria-label="Close sections menu"
            >
              Close
            </button>
          </div>

          <SearchForm compact />

          <nav aria-label="Sections">
            <ul className="mobile-panel__list">
              {items.map((item) => {
                const active = isActiveNavHref(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="mobile-panel__link"
                      // Section colour pair so the active item wears its own
                      // colour (see .mobile-panel__link[aria-current='page']).
                      style={sectionStyleForHref(item.href)}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
