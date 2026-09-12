'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import type { NavItem } from '../config/sites';
import { getSection } from '../config/sections';

/**
 * The sticky section nav — 48px, on the chrome, directly under the masthead.
 *
 * Uppercase Archivo links, white on near-black; hover underlines 3px in the
 * brand green; the ACTIVE section underlines 3px in its OWN colour and
 * carries `aria-current="page"`. On narrow screens the strip scroll-snaps
 * horizontally (CSS on `.nav__list`) so every section stays reachable — no
 * hamburger-only dead-end.
 *
 * WHY THIS IS A CLIENT COMPONENT (a deliberate exception to the "server by
 * default" chrome): the active state depends on the live route, and the
 * masthead renders once in the root layout, where a server component cannot
 * know which page it is wrapping. `usePathname` is the same mechanism
 * NavProgress already relies on. The cost is small and the degradation
 * clean: the links are plain `<Link>`s present in the server-rendered HTML,
 * so with JS off the nav still navigates — it only loses the active
 * underline, never a destination.
 *
 * NOTE ON THE NAME: bwave's NavMenu is a dropdown-panel controller. London's
 * design has no nav dropdowns (no panel classes exist in globals.css and
 * docs/DESIGN.md specs a plain strip), so here NavMenu IS the nav strip.
 * Items come from `site.nav` config, never from the WP API — the install
 * carries a syndication meta-category (google-news) that must never surface
 * in navigation.
 */

const CATEGORY_HREF = /^\/category\/([^/]+)\/?$/;

/** Ensure the compared path carries the trailing slash the config hrefs use. */
function withTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

/**
 * Whether a nav href is the current location. Exact match for static pages;
 * prefix match for category hrefs so `/category/uk-news/page/2/` still
 * lights up UK News. Article pages match nothing — a story's section is not
 * derivable from its root-level slug, and a wrong underline is worse than
 * none.
 */
export function isActiveNavHref(pathname: string, href: string): boolean {
  const current = withTrailingSlash(pathname);
  const target = withTrailingSlash(href);
  if (current === target) return true;
  return CATEGORY_HREF.test(href) && current.startsWith(target);
}

/**
 * The section colour pair for a category nav href, as the inline custom
 * properties the globals.css section-colour mechanism consumes. NEVER sets
 * `--section` directly (an inline value would override the per-theme
 * recomputation); non-category hrefs get no pair and fall back to the brand
 * accent.
 */
export function sectionStyleForHref(href: string): CSSProperties | undefined {
  const match = CATEGORY_HREF.exec(href);
  if (!match) return undefined;
  const section = getSection(match[1]);
  return {
    '--section-light': section.light,
    '--section-dark': section.dark,
  } as CSSProperties;
}

export function NavMenu({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections" className="nav">
      <div className="container">
        <ul className="nav__list">
          {items.map((item) => {
            const active = isActiveNavHref(pathname, item.href);
            return (
              <li key={item.href} className="nav__item">
                <Link
                  href={item.href}
                  className="nav__link"
                  style={sectionStyleForHref(item.href)}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
