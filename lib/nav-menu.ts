import 'server-only';

import type { SiteConfig } from '../config/sites';
import type { WPPost } from '../types/wp';
import { getTaxonomy } from '../config/taxonomy';
import { getPosts } from './wp';
import { cachedJson } from './cached';
import { HOMEPAGE_REVALIDATE } from './homepage';
import { getFeaturedImage, getPrimaryCategory, postTitle } from './wp-helpers';
import { categoryPath, postPath } from './urls';

/**
 * Data for the header's section menus.
 *
 * THE CONSTRAINT THAT SHAPES ALL OF THIS: the masthead renders on every page
 * of the site. A menu that fetched per section would multiply every single
 * page view by one API call per nav section against an origin that needs
 * 10+ seconds cold for twenty embedded posts (recon-timed). So this does
 * what the homepage does — ONE pass over the recent feed, partitioned in
 * memory — and caches the result under its own tag.
 *
 * Sections with nothing recent get their sub-topic links and no pictures,
 * which is a normal state rather than a failure: some taxonomy entries are
 * genuinely quiet for weeks.
 */

/** An hour. The menu is a browse aid, not a front page — it can lag. */
export const NAV_MENU_REVALIDATE = 3600;

/** 3 x 20 is the embed ceiling in lib/wp.ts, and enough to cover every nav section. */
const PAGES = 3;
const PER_PAGE = 20;

/** Cards per section. Two fits the panel at every width without wrapping. */
const CARDS = 2;

/** Sub-topic links per section, before the column gets long enough to scan badly. */
const MAX_CHILDREN = 6;

export interface MenuCard {
  title: string;
  href: string;
  /** Featured image, or null — the panel drops to a text row rather than a placeholder. */
  image: { url: string; width: number; height: number } | null;
  kicker: string | null;
  /**
   * A line under the title. Only used where the title alone is not enough:
   * a news headline explains itself.
   */
  description?: string;
}

export interface MenuLink {
  label: string;
  href: string;
}

export interface MenuSection {
  /** Matches the nav item's href, which is how the client pairs them up. */
  href: string;
  label: string;
  /** Sub-topics from the taxonomy. Free — no API call behind them. */
  children: MenuLink[];
  cards: MenuCard[];
  /** Sentence under the section title. */
  blurb: string | null;
}

export interface NavMenu {
  sections: MenuSection[];
}

/** The taxonomy slug a nav href points at, or null for a non-category link. */
function slugFromHref(href: string): string | null {
  const match = href.match(/^\/category\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

/**
 * A slim card. The full WPPost carries `_links`, every image crop and the
 * rendered body — several hundred KB per post — and the cache refuses a
 * payload over 1.5MB, so only these four fields survive.
 */
function toCard(post: WPPost): MenuCard {
  const image = getFeaturedImage(post);
  const category = getPrimaryCategory(post);

  return {
    title: postTitle(post),
    href: postPath(post.slug),
    image: image ? { url: image.url, width: image.width, height: image.height } : null,
    kicker: category?.name ?? null,
  };
}

async function composeNavMenu(site: SiteConfig): Promise<NavMenu> {
  // One pass over the recent feed, exactly as the homepage does it.
  const pages = await Promise.all(
    Array.from({ length: PAGES }, (_, index) =>
      getPosts(site, {
        perPage: PER_PAGE,
        page: index + 1,
        embed: true,
        // HOMEPAGE_REVALIDATE, not this module's own window, and that is the
        // whole point. `revalidate` is part of the fetch cache key, so asking
        // for the same three pages on a different window made Next treat them
        // as different entries — the menu issued its own 3 x 20 embed fetches
        // alongside the homepage's, six concurrent heavy requests against an
        // origin that needs 10+ seconds cold for twenty posts. They timed out
        // and the menu came back with no pictures (a shipped, fixed bwave bug).
        //
        // Matching the window makes the two callers share one cached fetch, so
        // the menu costs nothing on top of the front page.
        revalidate: HOMEPAGE_REVALIDATE,
      }).catch(() => ({ posts: [] as WPPost[], total: 0, totalPages: 0 })),
    ),
  );

  const recent = pages.flatMap((page) => page.posts);

  // Index posts by every category they carry, so a section can be filled even
  // when the story's PRIMARY category is a different one.
  const byCategory = new Map<string, WPPost[]>();
  for (const post of recent) {
    const terms = post._embedded?.['wp:term']?.[0] ?? [];
    for (const term of terms) {
      const bucket = byCategory.get(term.slug) ?? [];
      bucket.push(post);
      byCategory.set(term.slug, bucket);
    }
  }

  const taxonomy = getTaxonomy(site);

  const sections: MenuSection[] = [];

  for (const item of site.nav) {
    const slug = slugFromHref(item.href);
    if (!slug) continue;

    const entry = taxonomy.find((row) => row.slug === slug);

    // Sub-topics come from the taxonomy's parent field: zero API cost, and
    // curated rather than whatever the API happens to return.
    // `!== false`, not a truthy test: the flag is only set explicitly on
    // categories that do NOT yet exist in WordPress, so every other entry
    // leaves it undefined. A truthy check hid every sub-topic on the site.
    const children = taxonomy
      .filter((row) => row.parent === slug && row.existsInWp !== false)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_CHILDREN)
      .map((row) => ({ label: row.name, href: categoryPath(row.slug) }));

    // Posts in this section OR any of its children, newest first.
    const slugs = new Set([slug, ...taxonomy.filter((r) => r.parent === slug).map((r) => r.slug)]);
    const pool: WPPost[] = [];
    const seen = new Set<number>();
    for (const candidate of slugs) {
      for (const post of byCategory.get(candidate) ?? []) {
        if (seen.has(post.id)) continue;
        seen.add(post.id);
        pool.push(post);
      }
    }
    pool.sort((a, b) => b.date.localeCompare(a.date));

    // Prefer the ones with pictures — the panel is a visual menu, and a story
    // without an image is better used elsewhere on the site.
    const withImage = pool.filter((post) => getFeaturedImage(post) !== null);
    const chosen = [...withImage, ...pool.filter((post) => !withImage.includes(post))].slice(
      0,
      CARDS,
    );

    sections.push({
      href: item.href,
      label: item.label,
      children,
      cards: chosen.map(toCard),
      blurb: entry?.description ?? null,
    });
  }

  return { sections };
}

/**
 * The menu, cached under its own tag.
 *
 * Its own tag, not the homepage's: they revalidate on different clocks and a
 * menu going stale for an hour costs nothing, while re-composing it on the
 * homepage's 15-minute cycle would quadruple the work for no visible gain.
 */
export function getNavMenu(site: SiteConfig): Promise<NavMenu> {
  const bucket = Math.floor(Date.now() / (NAV_MENU_REVALIDATE * 1000));

  return cachedJson(
    () => composeNavMenu(site),
    ['nav-menu', site.key, String(bucket)],
    {
      revalidate: NAV_MENU_REVALIDATE,
      tags: [`${site.key}:posts`, `${site.key}:nav-menu`],
    },
  )();
}
