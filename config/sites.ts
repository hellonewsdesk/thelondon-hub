/**
 * Multi-tenant site registry.
 *
 * THIS IS THE ONLY FILE IN THE PROJECT THAT MAY NAME A SPECIFIC SITE.
 * Adding site 16 = adding one entry to SITES below. Nothing else changes.
 */

/** A curated nav entry. Never auto-generate these from the API: the WP
 *  install carries a 32-post syndication meta-category (google-news) and a
 *  long tail of thin categories that must never surface in navigation. */
export interface NavItem {
  /** Display label. */
  label: string;
  /** Category slug on the WP install, or an absolute path for static pages. */
  href: string;
}

export interface SiteConfig {
  /** Stable internal id. Used for cache tags, so it must be unique + URL-safe. */
  key: string;
  /** Bare hostname, no scheme, no port, no `www.` */
  hostname: string;
  /** Public origin, no trailing slash */
  siteUrl: string;
  /** WP REST v2 namespace root, no trailing slash */
  wpApiBase: string;
  name: string;
  tagline: string;
  city: string;
  /** Wider editorial region, used in copy and schema `areaServed`. */
  region: string;
  /** BCP-47 tag, e.g. 'en-GB' */
  locale: string;
  /** OpenGraph locale form, e.g. 'en_GB' */
  ogLocale: string;
  /** primary drives --accent (the structural brand green); accent drives its
   *  hover/active shade. Both must clear 4.5:1 on #FFFFFF. */
  theme: { primary: string; accent: string };

  /** Curated primary navigation. Order matters. */
  nav: NavItem[];

  /**
   * Category slugs that get their own block on the homepage, in render order.
   *
   * Curated, never generated: an API-driven homepage would surface the
   * google-news syndication meta-category and one-item sections. Keep this
   * to sections with real depth.
   */
  homepageSections: string[];

  /**
   * Publisher identity for JSON-LD and the standing pages.
   *
   * Everything except `email` and `country` is optional, and every consumer
   * renders it only when non-empty. That is deliberate: a legal page reading
   * "Company number [TODO]" is worse than one that omits the line, and
   * inventing a registration number is not an option.
   */
  publisher: {
    email: string;
    country: string;
    /** Registered entity name, once incorporated. */
    legalName?: string;
    addressLine?: string;
    postalCode?: string;
    companyNumber?: string;
    icoRegistration?: string;
  };

  /** Absolute or root-relative social profile URLs, used for `sameAs`. */
  social: { platform: string; url: string }[];

  /**
   * Advertising is OFF everywhere and no ad slot renders while it is.
   * The field and the AdSlot component stay in the codebase so that turning
   * ads on later reuses the reserved-height slots (the CLS protection) rather
   * than reintroducing layout shift ad hoc. Enabling also requires: the
   * AdSense loader in ConsentScripts, the ad-network origins in the CSP, and
   * a rewrite of the cookie banner + privacy policy BEFORE the first ad.
   */
  adsense: {
    enabled: boolean;
    /** ca-pub-XXXXXXXXXXXXXXXX. Empty until an account is approved. */
    clientId: string;
  };

  analytics: {
    /** GA4 measurement id, e.g. G-XXXXXXXXXX. Empty disables analytics. */
    gaMeasurementId: string;
  };
}

/** Keyed by bare hostname (the same value as `hostname` on each entry). */
export const SITES: Record<string, SiteConfig> = {
  'thelondonhub.co.uk': {
    key: 'londonhub',
    hostname: 'thelondonhub.co.uk',
    siteUrl: 'https://thelondonhub.co.uk',
    wpApiBase: 'https://thelondonhub.co.uk/wp-json/wp/v2',
    name: 'The London Hub',
    tagline: 'Your Daily Source for Reliable News',
    city: 'London',
    region: 'Greater London',
    locale: 'en-GB',
    ogLocale: 'en_GB',
    theme: { primary: '#047857', accent: '#065F46' },

    // Curated from recon (2026-09-10): only categories with real depth.
    // uk-news 36 · world-news 34 · football 19 · technology 14 · sports 11 ·
    // entertainment 10 · lifestyle 8 · business 6 · politics 5.
    // google-news (32) is a syndication meta-category and is deliberately
    // excluded from nav, homepage and every derived surface — see
    // config/category-overrides.ts.
    nav: [
      { label: 'UK News', href: '/category/uk-news/' },
      { label: 'World', href: '/category/world-news/' },
      { label: 'Football', href: '/category/football/' },
      { label: 'Sport', href: '/category/sports/' },
      { label: 'Tech', href: '/category/technology/' },
      { label: 'Entertainment', href: '/category/entertainment/' },
      { label: 'Lifestyle', href: '/category/lifestyle/' },
      { label: 'Business', href: '/category/business/' },
      { label: 'Politics', href: '/category/politics/' },
    ],

    // Ordered by depth from recon: uk-news 36 · world-news 34 · football 19 ·
    // technology 14 · sports 11 · entertainment 10 · lifestyle 8 · business 6.
    // politics (5 posts) stays in the nav but is too thin for a homepage
    // block; google-news is excluded as a syndication meta-category.
    homepageSections: [
      'uk-news',
      'world-news',
      'football',
      'technology',
      'sports',
      'entertainment',
      'lifestyle',
      'business',
    ],

    publisher: {
      // Verified on the live contact page (recon 2026-09-10).
      email: 'newsdesk@thelondonhub.co.uk',
      country: 'United Kingdom',
      // Left unset on purpose — see the interface note. Fill any of these in
      // and it appears on About, Contact, Privacy, Terms and in the footer at
      // once; leave it empty and nothing is rendered.
      legalName: '',
      addressLine: '',
      postalCode: '',
      companyNumber: '',
      icoRegistration: '',
    },

    social: [],

    adsense: {
      enabled: false,
      clientId: '',
    },

    analytics: {
      gaMeasurementId: '',
    },
  },
};

/**
 * The site used when the request carries no usable host — local dev,
 * CLI scripts, build-time calls outside a request scope.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_DEFAULT_HOST, if it names a registered site
 *   2. the first entry in SITES
 */
function resolveDefaultSite(): SiteConfig {
  const fromEnv = process.env.NEXT_PUBLIC_DEFAULT_HOST;
  if (fromEnv) {
    const match = SITES[normalizeHost(fromEnv)];
    if (match) return match;
  }
  const first = Object.values(SITES)[0];
  if (!first) {
    throw new Error('config/sites.ts: SITES is empty — at least one site is required.');
  }
  return first;
}

/** Strip scheme, path, port and a leading `www.`; lowercase. */
export function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/^www\./, '');
}

export const DEFAULT_SITE: SiteConfig = resolveDefaultSite();

/**
 * Resolve a request host to a site. Falls back to DEFAULT_SITE for
 * localhost, preview URLs, missing headers and unknown hosts.
 */
export function getSiteByHost(host: string | undefined | null): SiteConfig {
  if (!host) return DEFAULT_SITE;
  return SITES[normalizeHost(host)] ?? DEFAULT_SITE;
}

/** Every registered site. Used by next.config.ts to derive image patterns. */
export function allSites(): SiteConfig[] {
  return Object.values(SITES);
}
