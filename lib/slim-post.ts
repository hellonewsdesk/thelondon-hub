import type { WPMedia, WPPost, WPTerm } from '../types/wp.ts';
import { isEmbedError } from '../types/wp.ts';

/**
 * Reduce a WPPost to the fields a listing actually renders.
 *
 * This exists because of a hard limit: Next's data cache rejects any entry
 * over 2MB — silently. A post returned with `_embed` carries the full
 * `_links` block plus a media object listing every generated crop, and on
 * the Birmingham sibling of this network the composed homepage came to
 * 6.9MB that way: the cache write failed silently on every request, the
 * entire composition re-ran, and the front page had a 7-8 second TTFB while
 * every other route served in 15ms. On this origin (20 posts + _embed is
 * already 1250KB) the same failure is one careless field away.
 *
 * Slimming keeps the WPPost *shape* — so getFeaturedImage, getPrimaryCategory
 * and postTitle keep working untouched — while dropping roughly 95% of the
 * bytes. Anything a card does not read is discarded.
 */

function slimMedia(media: WPMedia): WPMedia {
  const details = media.media_details;
  // Keep only the one size the cards ask for, plus the intrinsic dimensions.
  const large = details?.sizes?.large;
  return {
    id: media.id,
    alt_text: media.alt_text,
    source_url: media.source_url,
    media_details: {
      width: details?.width,
      height: details?.height,
      ...(large ? { sizes: { large } } : {}),
    },
  };
}

function slimTerm(term: WPTerm): WPTerm {
  return { id: term.id, name: term.name, slug: term.slug, taxonomy: term.taxonomy };
}

export function slimPost(post: WPPost): WPPost {
  const embedded = post._embedded;

  const media = embedded?.['wp:featuredmedia']
    ?.filter((m): m is WPMedia => Boolean(m) && !isEmbedError(m))
    .slice(0, 1)
    .map(slimMedia);

  const terms = embedded?.['wp:term']?.map((group) =>
    Array.isArray(group) ? group.map(slimTerm) : undefined,
  );

  const author = embedded?.author
    ?.filter((a) => Boolean(a) && !isEmbedError(a))
    .slice(0, 1);

  return {
    id: post.id,
    slug: post.slug,
    link: post.link,
    date: post.date,
    modified: post.modified,
    title: { rendered: post.title?.rendered ?? '' },
    excerpt: { rendered: post.excerpt?.rendered ?? '' },
    // content is never rendered in a listing; dropping it alone saves ~6KB/post.
    content: { rendered: '' },
    featured_media: post.featured_media,
    categories: post.categories,
    // `_links` is the single largest field and nothing reads it after _embed
    // has already been expanded, so it is omitted entirely.
    ...(media?.length || terms?.length || author?.length
      ? {
          _embedded: {
            ...(author?.length ? { author } : {}),
            ...(media?.length ? { 'wp:featuredmedia': media } : {}),
            ...(terms?.length ? { 'wp:term': terms } : {}),
          },
        }
      : {}),
  };
}
