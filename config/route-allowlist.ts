/**
 * Deliberate static routes — the reviewed exceptions to the URL truth check.
 *
 * The build-time assertion in next.config.ts requires every top-level static
 * route this app serves to exist in data/wp-url-inventory.json (a real URL on
 * the live WordPress install, produced by `npm run urls:fetch`) OR to be
 * listed here with a reason. Anything in neither place fails the build.
 *
 * Adding to this file IS the review step: only add a route the publisher has
 * signed off, and say why. This guard exists because a sibling build once
 * invented /about/, /contact/ and /terms/ while its live site really served
 * /about-us/, /contact-us/ and /terms-conditions/ — guessing a URL on an
 * already-indexed site is a mass-404 event.
 *
 * The London Hub has NO /tools/, NO /corrections/ and NO /editorial-policy/:
 * its WordPress install has no such pages and none have been approved.
 * Do not add routes bwave has that London's WP lacks.
 */

export interface AllowedRoute {
  /** Root-relative, trailing slash (file-like routes keep their extension). */
  path: string;
  /** Why this route may exist without a WordPress counterpart. */
  reason: string;
}

export const ROUTE_ALLOWLIST: AllowedRoute[] = [
  // ---- Live WordPress pages (recon-verified 2026-09-10) -----------------
  // These six ARE real URLs on the live install and belong in
  // data/wp-url-inventory.json once `npm run urls:fetch` has been run
  // against thelondonhub.co.uk. They are listed here as well so the truth
  // check passes deterministically before the inventory exists; once the
  // inventory is committed these entries are redundant but harmless.
  // If a page is ever deleted from WordPress, remove its entry here too —
  // otherwise the allowlist would keep a dead route passing the check.
  {
    path: '/about-us/',
    reason: 'Live WP page (verified 2026-09-10). Same path, carried across.',
  },
  {
    path: '/contact-us/',
    reason: 'Live WP page (verified 2026-09-10). Same path, carried across.',
  },
  {
    path: '/privacy-policy/',
    reason: 'Live WP page (verified 2026-09-10). Same path, carried across.',
  },
  {
    path: '/terms-conditions/',
    reason:
      'Live WP page (verified 2026-09-10). The slug is /terms-conditions/, ' +
      'never /terms/ — that shorter form only exists as a redirect.',
  },
  {
    path: '/disclaimer/',
    reason:
      'Live WP page (verified 2026-09-10), already indexed. Dropping it in ' +
      'the rebuild would 404 a live URL, so it is carried across at the ' +
      'same path.',
  },
  {
    path: '/all-post/',
    reason:
      'Live WP page (verified 2026-09-10): the full post archive. Served ' +
      'here as the archive listing at the same path.',
  },

  // ---- App-native routes with no WordPress counterpart ------------------
  {
    path: '/search/',
    reason:
      'Site search. WordPress used /?s= query search, so no page URL exists ' +
      'to mirror; noindex, so no indexation risk.',
  },

  // ---- Documentation entries: dynamic segments and route handlers -------
  // The truth check only polices top-level app/ folders that contain a
  // page.tsx directly, so none of the following are enforced by it. They
  // are recorded here anyway so this file reads as the complete route map
  // and a reviewer can see every URL family the app claims.
  {
    path: '/page/',
    reason:
      'Homepage pagination /page/N/ (dynamic segment, not policed by the ' +
      'truth check). App-native archive paging; self-canonical, ' +
      'noindex-follow via paginationRobots.',
  },
  {
    path: '/category/',
    reason:
      'Category archives /category/<slug>/ (dynamic segment). Mirrors the ' +
      'live WP category base /category/%category%/ verified 2026-09-10.',
  },
  {
    path: '/author/',
    reason:
      'Author pages /author/<slug>/ (dynamic segment). E-E-A-T entity ' +
      'target linked from NewsArticle schema; index-gated by post count.',
  },
  {
    path: '/feed.xml',
    reason:
      'RSS feed (route handler). WP served /feed/, which next.config.ts ' +
      'permanently redirects here.',
  },
  {
    path: '/sitemap.xml',
    reason:
      'Sitemap index (route handler), with per-type child sitemaps also ' +
      'served as route handlers. WP’s own /wp-sitemap.xml redirects here.',
  },
  {
    path: '/og/',
    reason:
      'Dynamic Open Graph image endpoint (route handler). Social-card ' +
      'images for posts; never linked as a page.',
  },
  {
    path: '/api/revalidate/',
    reason:
      'On-demand ISR webhook (route handler) called by the WP publish hook ' +
      'with REVALIDATE_SECRET. Trailing slash required: trailingSlash ' +
      'rewrites make the unslashed path answer 308, and the WP hook fires ' +
      'non-blocking so it cannot follow a redirect.',
  },
];
