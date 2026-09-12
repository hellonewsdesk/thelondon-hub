/**
 * URL construction.
 *
 * WordPress serves posts at `/%postname%/` (root-level, one segment across
 * all 100 sampled URLs) and categories at `/category/%category%/`, both WITH
 * a trailing slash — recon-verified against the live install on 2026-09-10.
 * Every path this file returns therefore ends in a slash, and
 * `next.config.ts` sets `trailingSlash: true` to match.
 *
 * Nothing here may invent a URL shape. If you need a new route, confirm the
 * WordPress equivalent first.
 */

import type { SiteConfig } from '../config/sites';

/** `/london-underground-strike-latest/` */
export function postPath(slug: string): string {
  return `/${slug}/`;
}

/** `/category/uk-news/` */
export function categoryPath(slug: string): string {
  return `/category/${slug}/`;
}

/** `/category/uk-news/page/2/` — page 1 is always the bare category path. */
export function categoryPagePath(slug: string, page: number): string {
  return page <= 1 ? categoryPath(slug) : `/category/${slug}/page/${page}/`;
}

/** `/page/2/` — page 1 is always `/`. */
export function homePagePath(page: number): string {
  return page <= 1 ? '/' : `/page/${page}/`;
}

/** `/author/news-desk/` */
export function authorPath(slug: string): string {
  return `/author/${slug}/`;
}

/** `/search/?q=...` */
export function searchPath(query?: string): string {
  return query ? `/search/?q=${encodeURIComponent(query)}` : '/search/';
}

/**
 * Dynamic OG image endpoint.
 *
 * Trailing-slashed like everything else: `trailingSlash: true` applies to
 * route handlers too, so the unslashed form answers 308. Social crawlers
 * vary in how well they follow redirects on image URLs, so we publish the
 * final URL and save them the hop.
 */
export function ogImagePath(slug: string): string {
  return `/og/${slug}/`;
}

/** Absolute URL on the current tenant. Always use for canonicals and schema. */
export function absoluteUrl(site: SiteConfig, path: string): string {
  const base = site.siteUrl.replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * WordPress `link` fields are absolute URLs on the WP origin. Since Next is
 * serving the same hostname this is usually already correct, but converting
 * to a path keeps `<Link>` client-side and survives a staging domain.
 */
export function pathFromWpLink(link: string, fallback: string): string {
  try {
    const { pathname, search } = new URL(link);
    return `${pathname}${search}`;
  } catch {
    return fallback;
  }
}
