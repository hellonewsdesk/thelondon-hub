import { cachedJson } from './cached.ts';
import type { SiteConfig } from '../config/sites.ts';
import type { WPCategory, WPPost } from '../types/wp.ts';
import { getPosts, hydratePostImages } from './wp.ts';
import { getCategories } from './wp-cache.ts';
import { parseWpDate } from './format.ts';
import { getFeaturedImage } from './wp-helpers.ts';
import { slimPost } from './slim-post.ts';

/**
 * Homepage composition.
 *
 * The whole page is assembled here so deduplication can be global. Recon
 * found 104 non-empty categories across only 105 posts (70 of them
 * singletons) — heavy multi-category overlap — so without a single shared
 * "already used" set the same story appears in the hero, in UK News, and
 * again in Politics.
 *
 * Fetch strategy is dictated by the API being slow cold (12 posts + _embed
 * took 11.8s in recon):
 *   - ONE pass of 60 recent posts, three pages of 20 in parallel, then sliced
 *     in memory for the breaking ticker, hero band, Latest rail and scroll
 *     rail. Many sequential fetches would blow the build budget.
 *   - Section blocks fetch in parallel, with the _fields whitelist.
 * The composed result is cached under the `homepage` tag for 15 minutes, so
 * the cost above is paid once per window rather than per visitor.
 */

/** A story is "breaking" for this long after publication. */
const BREAKING_WINDOW_MINUTES = 90;

/** How many posts to pull in the single recent pass. */
const RECENT_PER_PAGE = 20;
const RECENT_PAGES = 3;

export const HOMEPAGE_REVALIDATE = 900;

export interface CategoryBlock {
  category: WPCategory;
  /** The large first card of the 4-card row — the one that leads with its image. */
  lead: WPPost;
  /** The standard cards beside it (up to 3). */
  items: WPPost[];
}

export interface HomepageData {
  /** Most recent post if it is younger than the breaking window, else null. */
  breaking: WPPost | null;
  /** Hero band: the large lead card. */
  lead: WPPost | null;
  /** Hero band: the two stacked secondary cards to the lead's right. */
  subLead: WPPost[];
  /** Latest News: 1 feature + 4 compact cards. */
  rail: WPPost[];
  /** "More from the Hub" scroll rail, after the section blocks. */
  slider: WPPost[];
  blocks: CategoryBlock[];
  /**
   * Shape parity with the network's HomepageData. London's homepage has no
   * tail grid — the newsletter band closes the page — so this is always empty.
   */
  tail: WPPost[];
  /** Every post rendered anywhere, in page order — feeds the ItemList schema. */
  ordered: WPPost[];
}

function minutesSince(post: WPPost, now: number): number {
  const d = parseWpDate(post.date);
  if (!d) return Number.POSITIVE_INFINITY;
  return (now - d.getTime()) / 60000;
}

/**
 * Pull the recent pool in one parallel burst and de-duplicate by id — pages
 * can overlap when the pipeline publishes between requests.
 */
async function fetchRecentPool(site: SiteConfig): Promise<WPPost[]> {
  const results = await Promise.allSettled(
    Array.from({ length: RECENT_PAGES }, (_, i) =>
      getPosts(site, {
        perPage: RECENT_PER_PAGE,
        page: i + 1,
        embed: false,
        // Match the homepage's own 15-minute window. On the 3h default the
        // composition re-runs every 15 minutes but against stale fetch
        // responses, so a new article could take 3 hours to reach the front
        // page unless the WP webhook fired.
        revalidate: HOMEPAGE_REVALIDATE,
      }),
    ),
  );

  // Do not cache an outage as an empty publication. Older pages are
  // optional, but the newest page must succeed (or the previous ISR entry
  // remains in use). A truly empty successful response is still valid.
  const first = results[0];
  if (first.status === 'rejected') throw first.reason;
  const pages = results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );

  const seen = new Set<number>();
  const out: WPPost[] = [];
  for (const { posts } of pages) {
    for (const post of posts) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);
      out.push(post);
    }
  }

  // The API returns newest-first per page, but three pages merged need an
  // explicit sort to stay strictly ordered.
  return out.sort((a, b) => {
    const da = parseWpDate(a.date)?.getTime() ?? 0;
    const db = parseWpDate(b.date)?.getTime() ?? 0;
    return db - da;
  });
}

async function composeHomepage(site: SiteConfig, nowMs: number): Promise<HomepageData> {
  const [recent, categories] = await Promise.all([
    fetchRecentPool(site),
    getCategories(site).catch(() => [] as WPCategory[]),
  ]);
  // The front page is current news. Older stories remain in category and
  // archive pages, rather than padding a news section with last year's copy.
  const cutoff = nowMs - 30 * 24 * 60 * 60 * 1000;
  const current = recent.filter((post) => (parseWpDate(post.date)?.getTime() ?? 0) >= cutoff);
  const candidates = current.length ? current : recent.slice(0, 8);
  const illustrated = await hydratePostImages(site, candidates, HOMEPAGE_REVALIDATE);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const pool = illustrated.map((post) => ({
    ...post,
    _embedded: {
      ...post._embedded,
      'wp:term': [(post.categories ?? [])
        .flatMap((id) => {
          const category = categoryById.get(id);
          return category ? [{ ...category, taxonomy: 'category' }] : [];
        })
        .sort((a, b) => Number(site.homepageSections.includes(b.slug)) - Number(site.homepageSections.includes(a.slug)))],
    },
  }));

  // Global dedup set. Every section filters against it, in render order.
  const used = new Set<number>();
  const take = (posts: WPPost[], n: number): WPPost[] => {
    const out: WPPost[] = [];
    for (const post of posts) {
      if (out.length >= n) break;
      if (used.has(post.id)) continue;
      used.add(post.id);
      out.push(post);
    }
    return out;
  };

  /**
   * Pick n unused posts, PREFERRING ones that carry a picture.
   *
   * Recon says 99 of 100 posts carry a featured image on this install, so
   * the preference rarely reaches past the newest stories — but the guard
   * stays for the odd imageless post, because the hero and the scroll rail
   * are the page's image-led surfaces. Only reach within `window`: a hero
   * lead must still be current news, not the most recent story that happens
   * to have artwork.
   */
  const takePreferImage = (posts: WPPost[], n: number, window: number): WPPost[] => {
    const scope = posts.slice(0, window);
    const withImage = scope.filter((p) => !used.has(p.id) && getFeaturedImage(p) !== null);
    const picked = take(withImage, n);
    // Top up from plain recency if there were not enough pictures.
    if (picked.length < n) picked.push(...take(posts, n - picked.length));
    return picked;
  };

  const newest = pool[0] ?? null;
  const breaking =
    newest && minutesSince(newest, nowMs) < BREAKING_WINDOW_MINUTES ? newest : null;

  // The breaking ticker repeats the lead deliberately — it is a banner over
  // the same story, not a separate slot — so it does not consume the id.
  // Hero lead: prefer a picture from the newest 8 only. Beyond that the
  // story is no longer fresh enough to lead a news front page, and the
  // colour-block card carries a text lead perfectly well.
  const [lead = null] = takePreferImage(pool, 1, 8);
  // Two stacked secondary image cards sit to the lead's right in the hero
  // band. They are image cards by design, so prefer artwork within the
  // newest 10 — with the 99% image rate this is almost always plain recency.
  const subLead = takePreferImage(pool, 2, 10);
  // Latest News: 1 large card + 4 compact cards.
  const rail = take(pool, 5);

  // Reuse the same illustrated recent pool for sections. This avoids sixteen
  // extra category/post requests and inconsistent artwork across the page.
  const fetched = site.homepageSections.flatMap((slug) => {
    const category = categories.find((item) => item.slug === slug);
    return category ? [{ category, posts: pool.filter((post) =>
      (parseWpDate(post.date)?.getTime() ?? 0) >= cutoff && post.categories?.includes(category.id),
    ) }] : [];
  });

  const blocks: CategoryBlock[] = [];
  for (const entry of fetched) {
    if (!entry) continue;

    const available = entry.posts.filter((p) => !used.has(p.id));
    // A block is a 4-card row (1 large + 3 standard). Fewer than 3 undeduped
    // stories and it renders nothing rather than filler — the design contract.
    if (available.length < 3) continue;

    // The block's large first card should actually lead with a picture:
    // newest available story with artwork, else the newest — the colour-block
    // treatment carries an imageless lead, never a placeholder.
    const withImage = available.find((p) => getFeaturedImage(p) !== null);
    const lead = withImage ?? available[0];
    const items = available.filter((p) => p.id !== lead.id).slice(0, 3);

    used.add(lead.id);
    for (const item of items) used.add(item.id);

    blocks.push({ category: entry.category, lead, items });
  }

  // "More from the Hub" is the closing picture rail, rendered after the
  // section blocks — so it is allocated after them too, and draws images
  // from the whole recent pool rather than the top of it.
  const slider = takePreferImage(pool, 8, pool.length);

  // No tail grid on this design; the newsletter band closes the page.
  const tail: WPPost[] = [];

  const ordered = [
    ...(lead ? [lead] : []),
    ...subLead,
    ...rail,
    ...blocks.flatMap((b) => [b.lead, ...b.items]),
    ...slider,
  ];

  // Slim everything before it reaches the cache. See lib/slim-post.ts: on
  // the Birmingham sibling the full payload was 6.9MB, and Next silently
  // refuses to cache over 2MB, which made every request recompose the page.
  const slim = (posts: WPPost[]) => posts.map(slimPost);

  return {
    breaking: breaking ? slimPost(breaking) : null,
    lead: lead ? slimPost(lead) : null,
    subLead: slim(subLead),
    rail: slim(rail),
    slider: slim(slider),
    blocks: blocks.map((b) => ({
      category: b.category,
      lead: slimPost(b.lead),
      items: slim(b.items),
    })),
    tail,
    ordered: slim(ordered),
  };
}

/**
 * Cached entry point.
 *
 * Keep the key stable across refreshes so ISR can retain the last successful
 * composition when WordPress is unavailable. Recompute the clock on refresh.
 */
export function getHomepage(site: SiteConfig): Promise<HomepageData> {
  // cachedJson, not bare unstable_cache: it asserts the payload stays under
  // the data-cache size ceiling. The equivalent entry on the Birmingham
  // sibling once hit 6.9MB, failed to cache silently, and recomposed on
  // every request (8.5s TTFB).
  return cachedJson(
    () => composeHomepage(site, Date.now()),
    ['homepage-v3-images', site.key],
    {
      revalidate: HOMEPAGE_REVALIDATE,
      tags: [`site:${site.key}`, `${site.key}:homepage`, `${site.key}:posts`],
    },
  )();
}
