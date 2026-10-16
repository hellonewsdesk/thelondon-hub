/**
 * WordPress REST v2 read layer.
 *
 * Every exported function takes a SiteConfig first — nothing here knows
 * or cares which site it is talking to. Safe to import from plain Node
 * scripts: the `next` fetch option is ignored outside Next.
 *
 * Performance constraints proved by recon against the live origin
 * (verified 2026-09-10 — the origin is slow when cold):
 *   12 posts + _embed   →  753 KB, ~11.8s cold
 *   20 posts + _embed   → 1250 KB, ~10.7s cold
 *   100 posts, _fields  →   14 KB,  ~6.8s cold
 * Hence: 20s timeout, _fields whitelisting everywhere, and a hard cap of
 * 20 on any _embed query.
 */

import type { SiteConfig } from '../config/sites.ts';
import type { WPCategory, WPPost, WPPostSlugRef, WPAuthor, WPMedia } from '../types/wp.ts';
import { getPrimaryCategory, getFeaturedImage } from './wp-helpers.ts';

/** 3 hours — matches the publishing pipeline's cadence. */
export const REVALIDATE_SECONDS = 10800;

/** Categories change rarely; hold them far longer than posts. */
const CATEGORIES_REVALIDATE_SECONDS = 86400;

/** Upper bound WP allows for per_page. */
const MAX_PER_PAGE = 100;

/**
 * Hard ceiling for any query carrying `_embed`.
 * Recon: 20 + _embed already takes ~10.7s cold on this origin. Do not raise this.
 */
export const MAX_EMBED_PER_PAGE = 20;

/**
 * Recon proves the origin is slow cold — 12 posts + _embed took 11.8s,
 * so 10s is nowhere near enough headroom.
 */
const REQUEST_TIMEOUT_MS = 20_000;

/** Tries per request when the origin reports it is busy. */
const FETCH_ATTEMPTS = 4;

/** Backstop so a bad totalPages header can never spin forever. */
const MAX_PAGES = 200;

/**
 * Field whitelist for listing queries. Trims the 1250KB/20-post payload down
 * to what a StoryCard actually renders. `_links` is required for `_embed`
 * to resolve at all.
 */
export const LIST_FIELDS =
  'id,slug,title,excerpt,date,modified,featured_media,categories,author,link,_links,_embedded';

// Expand only resources rendered by the site; replies and other relations
// make the origin do unnecessary work on every listing request.
const POST_EMBEDS = 'author,wp:featuredmedia,wp:term';

function isInvalidPostPage(error: unknown): boolean {
  if (!(error instanceof WPError) || error.status !== 400) return false;
  try {
    return JSON.parse(error.body).code === 'rest_post_invalid_page_number';
  } catch {
    return false;
  }
}

function isTransientFetchError(error: unknown): boolean {
  if (error instanceof WPError) return error.status === 429 || error.status >= 500;
  return error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError' || error instanceof TypeError);
}

/** Article view needs the body and tags on top of the listing fields. */
export const ARTICLE_FIELDS = `${LIST_FIELDS},content,tags`;

export class WPError extends Error {
  readonly status: number;
  readonly path: string;
  readonly site: string;
  readonly body: string;

  constructor(status: number, path: string, site: string, body = '') {
    super(`WP ${status} for ${site}${path}${body ? ` — ${body.slice(0, 200)}` : ''}`);
    this.name = 'WPError';
    this.status = status;
    this.path = path;
    this.site = site;
    this.body = body;
  }
}

export interface WPResult<T> {
  data: T;
  /** X-WP-Total, 0 when the header is absent. */
  total: number;
  /** X-WP-TotalPages, 0 when the header is absent. */
  totalPages: number;
}

export interface WPFetchOptions {
  /** Extra cache tags. Site scoping is added automatically. */
  tags?: string[];
  /** Override the 3h default. Use 0 to opt out of the data cache. */
  revalidate?: number;
  signal?: AbortSignal;
}

interface NextFetchInit extends RequestInit {
  next?: { revalidate?: number; tags?: string[] };
}

function toInt(value: string | null): number {
  if (!value) return 0;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Cache tags are namespaced per site so revalidating one tenant
 * never evicts another tenant's data.
 */
function scopeTags(site: SiteConfig, tags: string[]): string[] {
  return [`site:${site.key}`, ...tags.map((t) => `${site.key}:${t}`)];
}

/**
 * The single fetch primitive. Builds the URL from the site's API base,
 * applies ISR settings, and throws WPError on any non-2xx.
 */
export async function wp<T>(
  site: SiteConfig,
  path: string,
  opts: WPFetchOptions = {},
): Promise<WPResult<T>> {
  const base = site.wpApiBase.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const url = base + suffix;

  const init: NextFetchInit = {
    headers: { Accept: 'application/json' },
    signal: opts.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: {
      revalidate: opts.revalidate ?? REVALIDATE_SECONDS,
      tags: scopeTags(site, opts.tags ?? []),
    },
  };

  // The origin is shared hosting that answers 508/429/5xx when it is busy
  // (concurrent build workers trip it). Back off and retry a few times
  // rather than failing a build or a visitor's render on a momentary limit.
  let res: Response | undefined;
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt++) {
    res = await fetch(url, init);
    const busy = res.status === 429 || res.status === 508 || res.status >= 500;
    if (res.ok || !busy || attempt === FETCH_ATTEMPTS - 1) break;
    await res.arrayBuffer().catch(() => undefined);
    await new Promise((r) => setTimeout(r, 750 * 2 ** attempt + Math.random() * 400));
  }

  if (!res || !res.ok) {
    const status = res?.status ?? 0;
    const body = await res?.text().catch(() => '') ?? '';
    throw new WPError(status, path, site.hostname, body);
  }

  const data = (await res.json()) as T;

  return {
    data,
    total: toInt(res.headers.get('X-WP-Total')),
    totalPages: toInt(res.headers.get('X-WP-TotalPages')),
  };
}

export interface GetPostsOptions {
  page?: number;
  perPage?: number;
  categoryId?: number;
  search?: string;
  authorId?: number;
  exclude?: number[];
  /** Defaults to true. Turn off for bulk queries that only need text. */
  embed?: boolean;
  /** Override the `_fields` whitelist. */
  fields?: string;
  /** ISO date; maps to WP's `after` param. Used by the news sitemap. */
  after?: string;
  /**
   * Fetch-cache window override, in seconds.
   *
   * The default is the 3h pipeline cadence, which is right for article pages
   * but WRONG for surfaces that promise faster updates: the homepage
   * recomposes every 15 minutes and the news sitemap every 10 — recomposing
   * from 3h-stale fetch responses silently defeats both. Pass the surface's
   * own window here so the data underneath actually refreshes with it.
   */
  revalidate?: number;
}

export interface PostsPage {
  posts: WPPost[];
  totalPages: number;
  total: number;
}

/** Resolve missing artwork in bounded bulk requests, without expensive WP embeds. */
export async function hydratePostImages(
  site: SiteConfig,
  posts: WPPost[],
  revalidate = REVALIDATE_SECONDS,
): Promise<WPPost[]> {
  const ids = [...new Set(posts
    .filter((post) => !getFeaturedImage(post) && post.featured_media)
    .map((post) => post.featured_media as number))];
  if (!ids.length) return posts;

  const batches: number[][] = [];
  for (let i = 0; i < ids.length; i += 20) batches.push(ids.slice(i, i + 20));
  const results = await Promise.allSettled(batches.map(async (include) => {
    const params = new URLSearchParams({
      include: include.join(','), per_page: String(include.length),
      _fields: 'id,source_url,alt_text,media_details.width,media_details.height,media_details.sizes.large',
    });
    return (await wp<WPMedia[]>(site, `/media?${params}`, {
      revalidate, tags: ['posts', 'media'],
    })).data;
  }));
  const media = new Map<number, WPMedia>();
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const item of result.value) media.set(item.id, item);
    } else {
      console.warn(`WordPress image batch unavailable for ${site.key}.`);
    }
  }
  return posts.map((post) => {
    const image = post.featured_media ? media.get(post.featured_media) : undefined;
    return image && !getFeaturedImage(post)
      ? { ...post, _embedded: { ...post._embedded, 'wp:featuredmedia': [image] } }
      : post;
  });
}

/**
 * Listing query. Enforces the _embed page-size ceiling: the origin is
 * already at ~10.7s cold for 20 + _embed, so this fails loudly in
 * development rather than silently hanging in production.
 */
export async function getPosts(
  site: SiteConfig,
  {
    page = 1,
    perPage = 12,
    categoryId,
    search,
    authorId,
    exclude,
    embed = true,
    fields = LIST_FIELDS,
    after,
    revalidate,
  }: GetPostsOptions = {},
): Promise<PostsPage> {
  if (embed && perPage > MAX_EMBED_PER_PAGE) {
    const message =
      `getPosts: perPage=${perPage} with _embed exceeds the ${MAX_EMBED_PER_PAGE} ceiling. ` +
      `The origin cannot answer above this inside the timeout budget. ` +
      `Pass { embed: false } for bulk queries.`;
    if (process.env.NODE_ENV !== 'production') throw new Error(message);
    console.warn(message);
    perPage = MAX_EMBED_PER_PAGE;
  }

  const params = new URLSearchParams({
    page: String(Math.max(1, page)),
    per_page: String(Math.min(MAX_PER_PAGE, Math.max(1, perPage))),
    _fields: fields,
  });
  if (embed) params.set('_embed', POST_EMBEDS);
  if (typeof categoryId === 'number') params.set('categories', String(categoryId));
  if (typeof authorId === 'number') params.set('author', String(authorId));
  if (search) params.set('search', search);
  if (after) params.set('after', after);
  if (exclude?.length) params.set('exclude', exclude.join(','));

  const tags = ['posts'];
  if (typeof categoryId === 'number') tags.push(`category:${categoryId}`);

  try {
    const { data, total, totalPages } = await wp<WPPost[]>(
      site,
      `/posts?${params.toString()}`,
      { tags, revalidate },
    );
    return { posts: data, totalPages, total };
  } catch (err) {
    // WP answers page-past-the-end with 400 rest_post_invalid_page_number.
    if (isInvalidPostPage(err)) {
      return { posts: [], totalPages: 0, total: 0 };
    }
    // An overloaded embed endpoint must not hide published stories. Retry
    // once without expansion, retaining pagination, filters and cache window.
    if (embed && isTransientFetchError(err)) {
      console.warn(`WordPress embeds unavailable for ${site.key}; retrying posts without embeds.`);
      const result = await getPosts(site, {
        page, perPage, categoryId, search, authorId, exclude,
        embed: false, fields, after, revalidate,
      });
      return { ...result, posts: await hydratePostImages(site, result.posts, revalidate) };
    }
    throw err;
  }
}

/** Returns null for a slug that does not exist. Never throws on not-found. */
export async function getPostBySlug(
  site: SiteConfig,
  slug: string,
): Promise<WPPost | null> {
  if (!slug) return null;
  const params = new URLSearchParams({
    slug,
    _embed: POST_EMBEDS,
    per_page: '1',
    _fields: ARTICLE_FIELDS,
  });

  try {
    const { data } = await wp<WPPost[]>(site, `/posts?${params.toString()}`, {
      tags: ['posts', `post:${slug}`],
    });
    return data[0] ?? null;
  } catch (err) {
    if (err instanceof WPError && (err.status === 404 || err.status === 400)) return null;
    throw err;
  }
}

/**
 * All non-empty categories. Paginates deliberately: this install already
 * has 104, so a single per_page=100 request would silently truncate.
 *
 * Wrapped in unstable_cache — 104 items across 2 round trips, changing
 * maybe weekly, requested by the nav on every single page.
 */
export async function getCategoriesUncached(site: SiteConfig): Promise<WPCategory[]> {
  const out: WPCategory[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const params = new URLSearchParams({
      per_page: String(MAX_PER_PAGE),
      hide_empty: 'true',
      orderby: 'count',
      order: 'desc',
      page: String(page),
      _fields: 'id,name,slug,count,description,parent,link',
    });

    let res: WPResult<WPCategory[]>;
    try {
      res = await wp<WPCategory[]>(site, `/categories?${params.toString()}`, {
        tags: ['categories'],
        revalidate: CATEGORIES_REVALIDATE_SECONDS,
      });
    } catch (err) {
      if (err instanceof WPError && err.status === 400) break;
      throw err;
    }

    if (res.data.length === 0) break;
    out.push(...res.data);
    totalPages = res.totalPages || 1;
    page += 1;
  } while (page <= totalPages && page <= MAX_PAGES);

  return out;
}

export async function getCategoryBySlug(
  site: SiteConfig,
  slug: string,
): Promise<WPCategory | null> {
  if (!slug) return null;
  const params = new URLSearchParams({
    slug,
    per_page: '1',
    _fields: 'id,name,slug,count,description,parent,link',
  });

  try {
    const { data } = await wp<WPCategory[]>(site, `/categories?${params.toString()}`, {
      tags: ['categories', `category:${slug}`],
      revalidate: CATEGORIES_REVALIDATE_SECONDS,
    });
    return data[0] ?? null;
  } catch (err) {
    if (err instanceof WPError && (err.status === 404 || err.status === 400)) return null;
    throw err;
  }
}

export async function getAuthorBySlug(
  site: SiteConfig,
  slug: string,
): Promise<WPAuthor | null> {
  if (!slug) return null;
  const params = new URLSearchParams({
    slug,
    per_page: '1',
    _fields: 'id,name,slug,description,link,avatar_urls',
  });

  try {
    const { data } = await wp<WPAuthor[]>(site, `/users?${params.toString()}`, {
      tags: ['authors', `author:${slug}`],
      revalidate: CATEGORIES_REVALIDATE_SECONDS,
    });
    return data[0] ?? null;
  } catch (err) {
    // WP frequently blocks /users to anonymous callers. Not fatal.
    if (err instanceof WPError) return null;
    throw err;
  }
}

/**
 * Stories for the "More on this" block.
 *
 * Same primary category, self excluded. Falls back to most-recent when the
 * category is too thin to fill the slot — recon says 70 of 104 categories
 * hold a single post, so the fallback is the common path, not the edge case.
 */
export async function getRelatedPosts(
  site: SiteConfig,
  post: WPPost,
  limit = 4,
): Promise<WPPost[]> {
  const perPage = Math.min(limit, MAX_EMBED_PER_PAGE);
  const primary = getPrimaryCategory(post);
  const categoryId = post.categories?.[0];

  const collected: WPPost[] = [];
  const seen = new Set<number>([post.id]);

  if (typeof categoryId === 'number' && primary) {
    const { posts } = await getPosts(site, {
      perPage,
      categoryId,
      exclude: [post.id],
    });
    for (const p of posts) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      collected.push(p);
    }
  }

  if (collected.length < limit) {
    const { posts } = await getPosts(site, {
      perPage: Math.min(limit + 4, MAX_EMBED_PER_PAGE),
      exclude: [post.id],
    });
    for (const p of posts) {
      if (collected.length >= limit) break;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      collected.push(p);
    }
  }

  return collected.slice(0, limit);
}

export async function searchPosts(
  site: SiteConfig,
  query: string,
  page = 1,
  perPage = 12,
): Promise<PostsPage> {
  const trimmed = query.trim();
  if (!trimmed) return { posts: [], totalPages: 0, total: 0 };
  return getPosts(site, { search: trimmed, page, perPage });
}

/**
 * Google News sitemap window: strictly the last 48 hours, `_fields` only.
 * Google ignores anything older, and the news sitemap is capped at 1000 URLs.
 */
export async function getRecentPostsForNewsSitemap(
  site: SiteConfig,
  hours = 48,
): Promise<WPPost[]> {
  // Sliced to 19 chars (no Z/offset): WP's `after` param takes a naive
  // local datetime.
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString().slice(0, 19);

  const { posts } = await getPosts(site, {
    perPage: 100,
    embed: false,
    after: since,
    fields: 'id,slug,title,date,modified',
    // The news sitemap exists to tell Google about stories within minutes.
    // Left on the 3h default, the route's own 10-minute revalidate would
    // keep re-serializing the same stale fetch response.
    revalidate: 600,
  });

  return posts.slice(0, 1000);
}

/**
 * Every post slug on the site, with dates. Feeds the sitemap, so it
 * walks all pages rather than stopping at the first 100 (this install holds
 * 105 posts and growing). No _embed here: this is a bulk call and the embed
 * payload would multiply transfer for nothing.
 */
export async function getAllPostSlugs(site: SiteConfig): Promise<WPPostSlugRef[]> {
  const out: WPPostSlugRef[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const params = new URLSearchParams({
      per_page: String(MAX_PER_PAGE),
      page: String(page),
      _fields: 'slug,modified,date',
      orderby: 'date',
      order: 'desc',
    });

    let res: WPResult<WPPostSlugRef[]>;
    try {
      res = await wp<WPPostSlugRef[]>(site, `/posts?${params.toString()}`, {
        tags: ['posts', 'slugs'],
      });
    } catch (err) {
      // Ran off the end — treat as done rather than failing the whole sitemap.
      if (err instanceof WPError && err.status === 400) break;
      throw err;
    }

    if (res.data.length === 0) break;
    out.push(...res.data);
    totalPages = res.totalPages || 1;
    page += 1;
  } while (page <= totalPages && page <= MAX_PAGES);

  return out;
}
