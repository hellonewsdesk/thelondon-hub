/**
 * Index hygiene.
 *
 * Recon fact (2026-09-10): 104 categories exist and 70 of them hold a single
 * post — 84 sit below three. Letting Google index dozens of near-empty pages
 * is a thin-content liability that drags the whole domain. These rules decide
 * what gets indexed and what does not.
 */

import type { Metadata } from 'next';
import type { SiteConfig } from '../config/sites';
import type { WPCategory } from '../types/wp';
import { taxonomySlugs } from '../config/taxonomy';
import { absoluteUrl } from './urls';

/**
 * A category needs real depth to earn an index slot.
 * Below this it is `noindex, follow` — crawlable for discovery, absent from
 * the index.
 */
export const MIN_CATEGORY_POSTS_TO_INDEX = 3;

export function shouldIndexCategory(count: number): boolean {
  return count >= MIN_CATEGORY_POSTS_TO_INDEX;
}

/**
 * An author earns an index slot at this many bylined stories. Below it the
 * page exists (schema and byline links still resolve) but stays out of the
 * index — a two-post author page is thin content. This site has 3 authors
 * across 105 posts, so in practice all of them clear the bar; the gate is
 * for whoever gets added later.
 */
export const MIN_AUTHOR_POSTS_TO_INDEX = 5;

/**
 * The full category indexation rule:
 *
 *   indexable ⇔ in the curated taxonomy AND count ≥ 3.
 *
 * Membership comes first: a category outside config/taxonomy.ts is noindex
 * REGARDLESS of its count. Depth alone is not an editorial decision —
 * 'google-news' has 32 posts and is still a syndication meta-category, not a
 * section this site keeps. Everything noindexed here stays `follow`, so its
 * links keep passing.
 *
 * Any surface that lists category URLs (the category sitemap above all) MUST
 * use this same function — submitting a noindexed URL in a sitemap is a
 * contradictory signal and seo:check will treat it as a hard error.
 */
export function isCategoryIndexable(site: SiteConfig, category: WPCategory): boolean {
  return taxonomySlugs(site).has(category.slug) && shouldIndexCategory(category.count);
}

export type RobotsDirective = NonNullable<Metadata['robots']>;

export const INDEX_FOLLOW: RobotsDirective = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  },
};

export const NOINDEX_FOLLOW: RobotsDirective = {
  index: false,
  follow: true,
  googleBot: { index: false, follow: true },
};

/**
 * Search results only. `nofollow` as well as `noindex`: search URLs are an
 * infinite parameter space and crawling onward from them is pure waste —
 * every story a result links to is reachable through real listing pages.
 */
export const NOINDEX_NOFOLLOW: RobotsDirective = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

/**
 * Paginated pages (?page >= 2) are self-canonical and noindex,follow.
 *
 * Self-canonical rather than canonical-to-page-1: pointing page 5 at page 1
 * tells Google the two are duplicates, which they are not, and can suppress
 * discovery of the posts only reachable deep in the archive.
 */
export function paginationRobots(page: number): RobotsDirective {
  return page >= 2 ? NOINDEX_FOLLOW : INDEX_FOLLOW;
}

export interface BaseMetadataInput {
  site: SiteConfig;
  title: string;
  description: string;
  /** Root-relative, trailing-slashed. */
  path: string;
  /** Absolute or root-relative image URL. Defaults to the site OG fallback. */
  image?: string;
  robots?: RobotsDirective;
  type?: 'website' | 'article';
}

/**
 * Shared metadata assembly. Every route builds on this so canonicals,
 * locale and the title template stay consistent.
 */
export function buildMetadata({
  site,
  title,
  description,
  path,
  image,
  robots = INDEX_FOLLOW,
  type = 'website',
}: BaseMetadataInput): Metadata {
  const canonical = absoluteUrl(site, path);

  // ---- One place composes the browser title -----------------------------
  // The root layout carries a `%s | Site` template. A page title that already
  // names the site — the homepage's "Site — Tagline", or any hand-written
  // metaTitle ending in "| Site" — used to pick up a SECOND copy through that
  // template. `absolute` opts this page out of the template entirely, so the
  // composition happens exactly once, here.
  const bare = title.trim();
  const namesSite = bare.toLowerCase().includes(site.name.toLowerCase());
  const documentTitle = namesSite ? bare : `${bare} | ${site.name}`;

  const ogImage = image
    ? image.startsWith('http')
      ? image
      : absoluteUrl(site, image)
    : absoluteUrl(site, '/og-default/');

  return {
    metadataBase: new URL(site.siteUrl),
    title: { absolute: documentTitle },
    description,
    alternates: {
      canonical,
      types: {
        'application/rss+xml': `${site.siteUrl}/feed.xml`,
      },
    },
    robots,
    openGraph: {
      type,
      url: canonical,
      title: bare,
      description,
      siteName: site.name,
      locale: site.ogLocale,
      images: [{ url: ogImage, width: 1200, height: 630, alt: bare }],
    },
    twitter: {
      card: 'summary_large_image',
      title: bare,
      description,
      images: [ogImage],
    },
  };
}
