import type { NextConfig } from 'next';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allSites } from './config/sites';
import { ROUTE_ALLOWLIST } from './config/route-allowlist';
import { categoryRedirects } from './config/redirects';

/* ==========================================================================
   URL TRUTH CHECK — runs every time this config loads (build and start).

   Every top-level static route this app serves must be a URL that really
   exists on the live WordPress install (data/wp-url-inventory.json, produced
   by `npm run urls:fetch`) or a deliberate, reviewed addition in
   config/route-allowlist.ts. Anything in neither place fails the build with
   the offending path named.

   Exists because a sibling build once invented /about/, /contact/ and
   /terms/ while its live site really served /about-us/, /contact-us/ and
   /terms-conditions/. The London Hub has 105 posts and six standing pages
   already indexed; guessing a URL here is a mass-404 event, and this makes
   the guess impossible to ship.
   ========================================================================== */
function assertRoutesMatchWordPress(): void {
  const appDir = join(__dirname, 'app');
  const inventoryPath = join(__dirname, 'data', 'wp-url-inventory.json');

  // Static leaf routes: top-level app/ folders that render a page directly.
  // Dynamic segments ([slug]), route handlers (route.ts) and infra folders
  // have no invented-URL risk and are out of scope by construction.
  const staticRoutes = readdirSync(appDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !entry.name.startsWith('[') && !entry.name.startsWith('_'))
    .filter((entry) => existsSync(join(appDir, entry.name, 'page.tsx')))
    .map((entry) => `/${entry.name}/`);

  if (!existsSync(inventoryPath)) {
    console.warn(
      '\nURL TRUTH CHECK: data/wp-url-inventory.json is missing — run ' +
        '`npm run urls:fetch` and commit it. Static routes are UNVERIFIED ' +
        `this build: ${staticRoutes.join(', ')}\n`,
    );
    return;
  }

  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as {
    pages: string[];
  };
  const known = new Set([
    ...inventory.pages,
    ...ROUTE_ALLOWLIST.map((route) => route.path),
  ]);

  const invented = staticRoutes.filter((route) => !known.has(route));
  if (invented.length > 0) {
    throw new Error(
      `URL TRUTH CHECK FAILED — route(s) served by this app exist neither on ` +
        `the live WordPress install nor in config/route-allowlist.ts: ` +
        `${invented.join(', ')}. Either rename to the real WP path (check ` +
        `data/wp-url-inventory.json), or add an allowlist entry with a reason ` +
        `after review. Do not invent URLs.`,
    );
  }
}

assertRoutesMatchWordPress();

/**
 * Image hosts are derived from the site registry, so adding site 16 needs
 * no edit here — that is the whole point of config/sites.ts.
 *
 * Both the bare host and its `www.` form are covered: WP media libraries
 * routinely hold absolute upload URLs under whichever host the site ran on
 * historically, and a pattern miss makes next/image 400 the render.
 */
const remotePatterns = allSites().flatMap((site) => {
  const bare = new URL(site.siteUrl).hostname.replace(/^www\./, '');
  return [bare, `www.${bare}`].map((hostname) => ({
    protocol: 'https' as const,
    hostname,
    pathname: '/wp-content/uploads/**',
  }));
});

/** Every registered origin (bare + www), for CSP img sources. */
const siteOrigins = allSites().flatMap((site) => {
  const url = new URL(site.siteUrl);
  const bare = url.hostname.replace(/^www\./, '');
  return [`https://${bare}`, `https://www.${bare}`];
});

/**
 * Content-Security-Policy.
 *
 * SHIPPED AS REPORT-ONLY ON PURPOSE.
 *
 * This site carries NO advertising, so no ad-network origins appear below —
 * not googlesyndication, not doubleclick, not any Google ad frame host. That
 * makes this policy far tighter than a typical news site's. If advertising is
 * ever added, those origins must be reintroduced here at the same time as the
 * loader and the consent copy, or the ads will be silently blocked.
 *
 * Promote this to the enforcing `Content-Security-Policy` header ONLY after:
 *   1. GA4 (if enabled in config) is confirmed against `script-src` and
 *      `connect-src` with real traffic.
 *   2. `'unsafe-inline'` below is replaced with a nonce. Next injects inline
 *      bootstrap scripts, so removing it requires wiring a nonce through
 *      middleware — do that before enforcing, not after.
 *
 * Until then this reports violations without breaking the page.
 */
const csp = [
  "default-src 'self'",
  // 'unsafe-inline' is required by Next's inline bootstrap until a nonce is wired.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googletagmanager.com https://*.google-analytics.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.google-analytics.com ${siteOrigins.join(' ')}`,
  // Fonts are self-hosted by next/font — no third-party font origin needed.
  "font-src 'self' data:",
  "connect-src 'self' https://*.google-analytics.com https://*.googletagmanager.com",
  // Only the video embeds lib/sanitize.ts allowlists can ever appear.
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  // NOTE: `upgrade-insecure-requests` is deliberately NOT here. Browsers
  // ignore it in a report-only policy and log a console error saying so,
  // which shows up as a Best Practices failure. ADD IT BACK at the same time
  // you promote this header to the enforcing `Content-Security-Policy`.
].join('; ');

const nextConfig: NextConfig = {
  // Recon 2026-09-10: every live URL is indexed at root-level /%postname%/
  // WITH a trailing slash — 100 of 100 sampled posts, no exceptions.
  // Changing this is a mass-301 event. Do not touch.
  trailingSlash: true,

  /**
   * Build output directory.
   *
   * Overridable so a production build can be verified while a dev server is
   * running: 'next dev' and 'next build' both own '.next', and a dev server
   * left running in another terminal will silently rewrite a production build
   * into dev shape — the stylesheet then 404s and the site renders unstyled.
   * Set NEXT_DIST_DIR to build somewhere else instead of stopping dev.
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // The WordPress origin throttles under parallel load (508). Render few pages
  // at a time at build, and retry a page once before failing the build.
  staticPageGenerationTimeout: 180,
  experimental: {
    staticGenerationMaxConcurrency: 2,
    staticGenerationRetryCount: 2,
  },

  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,

  /**
   * Disable streaming metadata.
   *
   * Next 15 streams `generateMetadata` output into the body by default and
   * only blocks (emitting into <head>) for user-agents matching this regex,
   * which by default covers social unfurlers and bingbot but NOT Googlebot,
   * since Googlebot executes JavaScript.
   *
   * For a news site that is the wrong trade: it makes title, description,
   * canonical and robots depend on Google's render queue, which adds latency
   * exactly where Google News and Discover are most time-sensitive. Matching
   * every UA makes metadata blocking for everyone, so it is always present
   * in the initial <head>. The cost is deferring the shell flush until
   * generateMetadata resolves — negligible here, because it awaits the same
   * deduped fetch the page body already needs.
   */
  htmlLimitedBots: /.*/,

  images: {
    remotePatterns,
    formats: ['image/avif', 'image/webp'],
    // WP serves 1200x800 originals (recon-typical); these cover card → hero
    // without upscaling.
    deviceSizes: [360, 480, 640, 828, 1080, 1200, 1920],
    imageSizes: [96, 128, 200, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()',
          },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // Report-only until the ad stack is confirmed — see the comment above.
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
      {
        // Documents only. The negative lookahead keeps this OFF /_next/*,
        // whose files are content-hashed and served `immutable` for a year —
        // overriding those with `must-revalidate` costs a revalidation
        // round-trip for every chunk on every page view, and measurably moved
        // mobile LCP (2.2s -> 3.0s) on the sibling build when this rule was
        // first written without the exclusion.
        source: '/((?!_next/).*)',
        headers: [
          {
            // Every page here is dynamically rendered, because tenancy is
            // resolved from the Host header and reading headers() opts a
            // route out of static rendering. Next's default for that is
            // `no-store`, which has one consequence that matters a lot for a
            // news site: no-store DISABLES the browser's back/forward cache.
            // Readers bounce front page -> story -> back constantly, and
            // every one of those "back" presses was a full reload.
            //
            // `max-age=0, must-revalidate` keeps the freshness behaviour
            // identical — the browser still revalidates on every normal
            // navigation, so breaking news is never served stale — while
            // letting bfcache do its job. Lighthouse bf-cache goes from fail
            // to pass on every route.
            //
            // Deliberately NO s-maxage at this layer. Shared-cache lifetimes
            // differ per route (the front page moves in minutes, an article
            // in hours) and getting one wrong means serving stale news from
            // a CDN. If a route ever earns a provably safe shared lifetime,
            // add a per-route block below — do not widen this one.
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // WordPress served the feed at /feed/. Subscribers may still poll it.
      { source: '/feed', destination: '/feed.xml', permanent: true },
      { source: '/feed/', destination: '/feed.xml', permanent: true },
      { source: '/rss', destination: '/feed.xml', permanent: true },
      // Slashed variants are required: trailingSlash rewrites /rss -> /rss/
      // BEFORE these rules run, so an unslashed-only source never matches.
      { source: '/rss/', destination: '/feed.xml', permanent: true },
      { source: '/comments/feed', destination: '/feed.xml', permanent: true },
      { source: '/comments/feed/', destination: '/feed.xml', permanent: true },
      // The standing pages live at the SAME paths WordPress served
      // (/about-us/, /contact-us/, /terms-conditions/ — recon-verified),
      // because those are already indexed. These redirects only cover the
      // shorter forms WP itself 301s, so an old bookmark or stray inbound
      // link still lands correctly.
      { source: '/about', destination: '/about-us/', permanent: true },
      { source: '/about/', destination: '/about-us/', permanent: true },
      { source: '/contact', destination: '/contact-us/', permanent: true },
      { source: '/contact/', destination: '/contact-us/', permanent: true },
      { source: '/terms', destination: '/terms-conditions/', permanent: true },
      { source: '/terms/', destination: '/terms-conditions/', permanent: true },

      // WP's own sitemap paths, in case they were submitted to Search Console.
      { source: '/wp-sitemap.xml', destination: '/sitemap.xml', permanent: true },
      { source: '/sitemap_index.xml', destination: '/sitemap.xml', permanent: true },

      // Consolidated categories, generated from the approved merge plan.
      // Guarded: throws if a source shadows a live route, a target is not
      // served, a quarantined slug appears, or a chain would form. Zero
      // rules (with a console warning) until London's plan exists.
      ...categoryRedirects(),
    ];
  },
};

export default nextConfig;
