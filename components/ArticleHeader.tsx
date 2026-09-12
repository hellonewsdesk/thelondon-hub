import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { SiteConfig } from '../config/sites';
import type { WPPost } from '../types/wp';
import { getSection } from '../config/sections';
import {
  excerptText,
  getAuthor,
  getFeaturedImage,
  getPrimaryCategory,
  postTitle,
  readingTime,
} from '../lib/wp-helpers';
import { absoluteUrl, authorPath, categoryPath, postPath } from '../lib/urls';
import { formatDateTime, isoDateTime } from '../lib/format';
import { ShareRow } from './ShareRow';

/**
 * Article furniture in the order docs/DESIGN.md fixes:
 *
 *   kicker (section colour) → H1 → standfirst → bordered meta strip
 *   (author · dates · reading time, ShareRow right) → featured image
 *   with caption.
 *
 * The breadcrumb above this block is the page's job (it pairs with the
 * BreadcrumbList JSON-LD the page emits).
 *
 * Headline is always left-aligned, never centred, never italic, never
 * all-caps, and never CSS-clamped — an H1 that needs truncating is a content
 * problem. When there is no hero image (rare here — recon says 99 of 100
 * posts carry one, but wp:featuredmedia is still optional) nothing is
 * substituted: the meta strip runs straight into the body.
 *
 * The section-colour pair is exposed on the root so the kicker picks up the
 * article's section colour; ArticleBody re-declares the same pair for the
 * prose (h2 rules, blockquote) because the two are siblings, not nested.
 */
export function ArticleHeader({ site, post }: { site: SiteConfig; post: WPPost }) {
  const title = postTitle(post);
  const category = getPrimaryCategory(post);
  const author = getAuthor(post);
  const image = getFeaturedImage(post);
  const standfirst = excerptText(post, 260);
  const minutes = readingTime(post);
  const published = formatDateTime(post.date, site.locale);
  const modified =
    post.modified && post.modified !== post.date
      ? formatDateTime(post.modified, site.locale)
      : null;

  const section = category ? getSection(category.slug) : null;
  const sectionVars = section
    ? ({ '--section-light': section.light, '--section-dark': section.dark } as CSSProperties)
    : undefined;

  return (
    <header style={sectionVars}>
      {category ? (
        <Link href={categoryPath(category.slug)} className="kicker">
          {category.name}
        </Link>
      ) : null}

      <h1 className="h-lead mt-2.5" style={{ maxWidth: '18em' }}>
        {title}
      </h1>

      {standfirst ? <p className="standfirst mt-4">{standfirst}</p> : null}

      {/* The bordered meta strip. justify-between puts the facts left and the
          share controls right; both wrap gracefully on narrow screens. */}
      <div className="article-meta">
        <div className="article-meta__facts">
          {author ? (
            <p className="meta">
              By{' '}
              <Link href={authorPath(author.slug)} rel="author" className="meta meta-strong">
                {author.name}
              </Link>
            </p>
          ) : null}

          <time dateTime={isoDateTime(post.date)} className="meta">
            {published}
          </time>

          {modified ? (
            <span className="meta">
              Updated <time dateTime={isoDateTime(post.modified)}>{modified}</time>
            </span>
          ) : null}

          <span className="meta">{minutes} min read</span>
        </div>

        <ShareRow url={absoluteUrl(site, postPath(post.slug))} title={title} />
      </div>

      {image ? (
        <figure className="article-figure">
          {image.width > 0 && image.height > 0 ? (
            <Image
              src={image.url}
              // The hero is content here, not a decorative duplicate of the
              // headline link — real alt, doubling as the caption below.
              alt={image.alt}
              width={image.width}
              height={image.height}
              // The article hero is always the LCP element — the only place
              // besides the homepage lead where priority is justified. Next
              // preloads `priority` images but does not mark the fetch
              // high-priority, so it still queues behind preloaded scripts and
              // Lighthouse's LCP-discovery audit fails on exactly that;
              // fetchPriority pairs with it deliberately.
              priority
              fetchPriority="high"
              sizes="(max-width: 1024px) 100vw, 760px"
            />
          ) : (
            // No intrinsic dimensions from WP: reserve a 3:2 box (the typical
            // 1200x800 shape on this install) so the hero cannot shift layout.
            <div className="relative aspect-[3/2] overflow-hidden">
              <Image
                src={image.url}
                alt={image.alt}
                fill
                priority
                fetchPriority="high"
                sizes="(max-width: 1024px) 100vw, 760px"
                className="object-cover"
              />
            </div>
          )}
          {image.alt ? <figcaption>{image.alt}</figcaption> : null}
        </figure>
      ) : null}
    </header>
  );
}
