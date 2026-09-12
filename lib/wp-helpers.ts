/**
 * Pure, dependency-free readers for the `_embed` block and rendered HTML.
 * Nothing here throws, nothing here fetches, nothing here knows a site.
 *
 * On this install a featured image is set on 99 of 100 sampled posts and
 * `_embedded` resolved on 19 of 20 — but nothing in the API contract
 * guarantees either, so every path is optional-chained anyway.
 */

import type {
  WPMedia,
  WPPost,
  WPTerm,
} from '../types/wp.ts';
import { isEmbedError } from '../types/wp.ts';

export interface FeaturedImage {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface TermRef {
  name: string;
  slug: string;
}

export interface AuthorRef {
  name: string;
  slug: string;
}

/** Named entities WP actually emits in titles/excerpts, plus the basics. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  pound: '£',
  euro: '€',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  middot: '·',
  bull: '•',
  prime: '′',
  Prime: '″',
};

function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_m, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&([a-z]+);/gi, (m, name: string) => NAMED_ENTITIES[name] ?? m);
}

/**
 * HTML -> plain text. Drops <script>/<style> bodies wholesale, which matters
 * here: recon found 2 inline JSON-LD <script> blocks in every article body
 * on this install — they would otherwise land in meta descriptions as raw JSON.
 */
export function stripHtml(html: string | undefined | null): string {
  if (!html) return '';
  return decodeEntities(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\[(?:&hellip;|…|\.\.\.)\]/g, '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Truncate on a word boundary, appending an ellipsis only if cut. */
function truncate(text: string, maxLen: number): string {
  if (maxLen <= 0 || text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-]+$/, '')}…`;
}

/** Meta-description-ready text. Falls back to the body when excerpt is empty. */
export function excerptText(post: WPPost, maxLen = 160): string {
  const fromExcerpt = stripHtml(post.excerpt?.rendered);
  const text = fromExcerpt || stripHtml(post.content?.rendered);
  return truncate(text, maxLen);
}

/** Decoded plain-text title. */
export function postTitle(post: WPPost): string {
  return stripHtml(post.title?.rendered);
}

function firstEmbeddedMedia(post: WPPost): WPMedia | null {
  const list = post._embedded?.['wp:featuredmedia'];
  if (!Array.isArray(list)) return null;
  for (const entry of list) {
    if (!entry || isEmbedError(entry)) continue;
    if (typeof entry.source_url === 'string' && entry.source_url) return entry;
  }
  return null;
}

/**
 * Featured image, or null. Prefers the `large` size when present so cards
 * don't pull the typical 1200x800 original; falls back to the full source_url.
 */
export function getFeaturedImage(post: WPPost): FeaturedImage | null {
  const media = firstEmbeddedMedia(post);
  if (!media?.source_url) return null;

  const details = media.media_details;
  const preferred = details?.sizes?.large ?? details?.sizes?.full;

  const url = preferred?.source_url ?? media.source_url;
  const width = preferred?.width ?? details?.width ?? 0;
  const height = preferred?.height ?? details?.height ?? 0;

  return {
    url,
    alt: decodeEntities(media.alt_text || stripHtml(media.title?.rendered) || postTitle(post)),
    width,
    height,
  };
}

function embeddedTerms(post: WPPost): WPTerm[] {
  const groups = post._embedded?.['wp:term'];
  if (!Array.isArray(groups)) return [];
  return groups.flatMap((group) => (Array.isArray(group) ? group : []));
}

/**
 * First category on the post. WP has no native "primary category" concept,
 * so this takes the first embedded term whose taxonomy is `category`,
 * preferring the order WP returned (which follows the post's own term order).
 */
export function getPrimaryCategory(post: WPPost): TermRef | null {
  const categories = embeddedTerms(post).filter(
    (t) => t.taxonomy === 'category' && t.slug && t.name,
  );
  if (categories.length === 0) return null;

  // If the post lists category ids, honour that ordering.
  const ordered = post.categories?.length
    ? categories.slice().sort((a, b) => {
        const ia = post.categories?.indexOf(a.id) ?? -1;
        const ib = post.categories?.indexOf(b.id) ?? -1;
        return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
      })
    : categories;

  const first = ordered[0];
  return { name: decodeEntities(first.name), slug: first.slug };
}

/** All categories on the post, in WP's order. */
export function getCategoriesFromPost(post: WPPost): TermRef[] {
  return embeddedTerms(post)
    .filter((t) => t.taxonomy === 'category' && t.slug && t.name)
    .map((t) => ({ name: decodeEntities(t.name), slug: t.slug }));
}

/** All tags on the post, in WP's order. */
export function getTags(post: WPPost): TermRef[] {
  return embeddedTerms(post)
    .filter((t) => t.taxonomy === 'post_tag' && t.slug && t.name)
    .map((t) => ({ name: decodeEntities(t.name), slug: t.slug }));
}

export function getAuthor(post: WPPost): AuthorRef | null {
  const list = post._embedded?.author;
  if (!Array.isArray(list)) return null;
  for (const entry of list) {
    if (!entry || isEmbedError(entry)) continue;
    if (entry.name && entry.slug) {
      return { name: decodeEntities(entry.name), slug: entry.slug };
    }
  }
  return null;
}

const WORDS_PER_MINUTE = 200;

/** Whole minutes, never less than 1. */
export function readingTime(post: WPPost): number {
  const text = stripHtml(post.content?.rendered);
  if (!text) return 1;
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
