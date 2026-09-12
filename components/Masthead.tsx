import Link from 'next/link';
import type { SiteConfig } from '../config/sites';
import type { WPPost } from '../types/wp';
import type { NavMenu as NavMenuData } from '../lib/nav-menu';
import { formatMastheadDate } from '../lib/format';
import { getPosts } from '../lib/wp';
import { HOMEPAGE_REVALIDATE } from '../lib/homepage';
import { BreakingStrip } from './BreakingStrip';
import { Dateline } from './Dateline';
import { ThemeToggle } from './ThemeToggle';
import { MobileNav } from './MobileNav';
import { NavMenu } from './NavMenu';

/**
 * Three-row header, one dark plane (docs/DESIGN.md chrome spec):
 *
 *   1. Topbar   — 40px utility strip: BREAKING flag + latest-headline ticker
 *                 left; request-time dateline (Europe/London) and the
 *                 light/dark segmented control right.
 *   2. Masthead — the Anton wordmark with its green brand square (pure CSS,
 *                 no image), tagline beneath, search icon-button right and
 *                 the mobile hamburger beside it.
 *   3. Nav      — sticky 48px section strip with the 3px section-colour
 *                 active underline; scroll-snaps horizontally on mobile.
 *
 * Server component throughout; only the theme switch, hamburger and nav
 * strip (active-route state) are client islands.
 */

/**
 * The latest headline for the ticker, fetched here so the chrome works on
 * EVERY page without the layout having to wire it. Tiny (`_fields`, no
 * `_embed`, one post) and cached on the homepage's 15-minute window, so it
 * costs one small request per window, not per view. Caught, never thrown: a
 * failing API must never cost the reader the masthead.
 */
async function fetchLatestForTicker(site: SiteConfig): Promise<WPPost | null> {
  try {
    const { posts } = await getPosts(site, {
      perPage: 1,
      embed: false,
      fields: 'id,slug,title,date',
      revalidate: HOMEPAGE_REVALIDATE,
    });
    return posts[0] ?? null;
  } catch {
    return null;
  }
}

export async function Masthead({
  site,
  now,
  breaking,
}: {
  site: SiteConfig;
  now: Date;
  /**
   * The story for the topbar ticker. Omit it (the normal case) and the
   * masthead fetches the latest post itself; pass a post to override; pass
   * `null` explicitly to render a quiet topbar with no ticker.
   */
  breaking?: WPPost | null;
  /**
   * Accepted for drop-in compatibility with the bwave layout composition.
   * London's nav is a plain link strip — the design has no dropdown panels —
   * so menu data is currently unused.
   */
  menu?: NavMenuData | null;
}) {
  const dateline = formatMastheadDate(now, site.locale);
  const ticker = breaking !== undefined ? breaking : await fetchLatestForTicker(site);

  return (
    <>
      {/* ---- 1. Topbar ---- */}
      <div className="topbar">
        <div className="container topbar__inner">
          {ticker ? (
            <BreakingStrip post={ticker} />
          ) : (
            // Quiet day / failed fetch: the city holds the left slot so the
            // space-between row keeps its shape. Never an empty red flag.
            <p className="topbar__date">{site.city}</p>
          )}

          <div className="topbar__tools">
            <Dateline
              initial={dateline}
              locale={site.locale}
              className="topbar__date hidden sm:block"
            />
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* ---- 2. Masthead ---- */}
      <header className="masthead">
        <div className="container masthead__inner">
          <div className="min-w-0">
            {/* The wordmark IS the logo: Anton type plus the CSS brand
                square (::after) — no image file, nothing to preload,
                nothing in the CLS budget. */}
            <Link href="/" className="masthead__wordmark">
              {site.name}
            </Link>
            <p className="masthead__tagline mt-1 hidden sm:block">{site.tagline}</p>
          </div>

          <div className="masthead__tools">
            {/* An icon-button LINK to the search page, not an inline form:
                the masthead stays server-rendered and the target works
                before a byte of JS arrives. */}
            <Link href="/search/" className="icon-btn" aria-label="Search">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                focusable="false"
              >
                <circle cx="7" cy="7" r="5" />
                <path d="M11 11l4 4" strokeLinecap="square" />
              </svg>
            </Link>
            <MobileNav items={site.nav} />
          </div>
        </div>
      </header>

      {/* ---- 3. Sections — curated in config, never generated from the API
          (the WP install carries a google-news syndication meta-category
          that must never surface in navigation). ---- */}
      <NavMenu items={site.nav} />
    </>
  );
}
