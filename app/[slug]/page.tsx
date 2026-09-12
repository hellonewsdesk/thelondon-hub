import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getCurrentSite } from '../../lib/site';
import { DEFAULT_SITE } from '../../config/sites';
import { getPostBySlug, getPosts, getRelatedPosts } from '../../lib/wp';
import {
  excerptText,
  getFeaturedImage,
  getPrimaryCategory,
  postTitle,
} from '../../lib/wp-helpers';
import { buildMetadata, INDEX_FOLLOW } from '../../lib/seo';
import {
  breadcrumbSchema,
  extractFaqEntries,
  faqSchema,
  newsArticleSchema,
  type Crumb,
} from '../../lib/schema';
import { sanitizeArticleHtml } from '../../lib/sanitize';
import { categoryPath, ogImagePath, postPath } from '../../lib/urls';
import { isoDateTime } from '../../lib/format';

import { JsonLd } from '../../components/JsonLd';
import { Breadcrumbs } from '../../components/Breadcrumbs';
import { ArticleHeader } from '../../components/ArticleHeader';
import { ArticleBody } from '../../components/ArticleBody';
import { RelatedStories } from '../../components/RelatedStories';
import { MoreStories } from '../../components/MoreStories';

/**
 * The article page — the root-level catch-all matching WordPress's
 * /%postname%/ permalink structure (root-level, one segment, trailing slash
 * — recon-verified across all 100 sampled URLs). Static segments (about-us,
 * search, category, author, page, og, feed.xml, sitemaps) always win over
 * this dynamic [slug]; it catches only the remaining single-segment paths.
 */

// 3h, matching the publishing pipeline's cadence.
export const revalidate = 10800;
export const dynamicParams = true;

/**
 * Prebuild only the 50 most recent slugs.
 *
 * Recon: 12 posts + _embed costs ~11.8s cold on this origin, and prebuilding
 * all 105 (and growing) would strain any CI budget for little gain — the
 * tail renders on first request and is then cached for 3h.
 */
export async function generateStaticParams() {
  const TARGET = 50;
  const PER_PAGE = 25;

  try {
    // per_page must stay constant across the loop: mixing sizes shifts the
    // pagination window, so pages overlap and the unique count comes up short.
    const pages = await Promise.all(
      [1, 2].map((page) =>
        getPosts(DEFAULT_SITE, { perPage: PER_PAGE, page, embed: false }),
      ),
    );

    const seen = new Set<string>();
    for (const { posts } of pages) {
      for (const post of posts) seen.add(post.slug);
    }

    return [...seen].slice(0, TARGET).map((slug) => ({ slug }));
  } catch {
    // A slow or unreachable origin must not fail the build — these pages
    // simply render on demand instead.
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getCurrentSite();
  const post = await getPostBySlug(site, slug);

  if (!post) {
    return { title: 'Story not found', robots: { index: false, follow: true } };
  }

  const title = postTitle(post);
  const description = excerptText(post, 160);
  const featured = getFeaturedImage(post);
  const category = getPrimaryCategory(post);

  const base = buildMetadata({
    site,
    title,
    description,
    // Trailing slash is mandatory — every live URL is indexed this way.
    path: postPath(post.slug),
    // 99 of 100 recon posts carry a featured image, so it leads; the dynamic
    // /og/{slug}/ card covers the rare imageless story.
    image: featured?.url ?? ogImagePath(post.slug),
    robots: INDEX_FOLLOW,
    type: 'article',
  });

  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: 'article',
      publishedTime: isoDateTime(post.date),
      modifiedTime: isoDateTime(post.modified || post.date),
      section: category?.name,
      authors: [site.name],
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getCurrentSite();
  const post = await getPostBySlug(site, slug);

  // Unknown slug renders the styled 404, never a 500.
  if (!post) notFound();

  // 6 related candidates rather than 3: RelatedStories enforces the
  // same-section rule strictly and drops the recency padding getRelatedPosts
  // uses to fill thin categories, so it needs headroom to reach three
  // genuine matches. The latest rail feeds the MoreStories tail.
  const [related, latest] = await Promise.all([
    getRelatedPosts(site, post, 6),
    getPosts(site, { perPage: 6, exclude: [post.id] }),
  ]);

  const category = getPrimaryCategory(post);
  const now = new Date();

  // Extract from the SANITISED body — the same HTML the reader sees — so the
  // schema can never describe content that was stripped before render.
  const faq = faqSchema(
    site,
    post,
    extractFaqEntries(
      sanitizeArticleHtml(post.content?.rendered, { internalHost: site.hostname }),
    ),
  );

  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    ...(category ? [{ name: category.name, path: categoryPath(category.slug) }] : []),
    { name: postTitle(post), path: postPath(post.slug) },
  ];

  return (
    <>
      {/* Exactly one NewsArticle block on the page — the two inbound JSON-LD
          scripts every post on this install carries (recon-verified) are
          stripped by lib/sanitize.ts. */}
      <JsonLd data={newsArticleSchema(site, post)} id="ld-article" />
      <JsonLd data={breadcrumbSchema(site, crumbs)} id="ld-breadcrumbs" />
      {/* FAQPage only when the body genuinely contains question-headings
          with real answers under them. Never fabricated for a rich result. */}
      {faq ? <JsonLd data={faq} id="ld-faq" /> : null}

      <div className="container py-6">
        <Breadcrumbs crumbs={crumbs} />

        {/* Single column, capped at the width the ArticleHeader hero image
            sizes itself for (760px) — the body's own 66ch measure sits
            inside it. ShareRow lives in the header's bordered meta strip. */}
        <article style={{ maxWidth: '760px' }}>
          <ArticleHeader site={site} post={post} />
          <ArticleBody site={site} post={post} />
        </article>

        {/* Same-section stories only; renders nothing over filler. */}
        <RelatedStories site={site} post={post} posts={related} now={now} />

        <MoreStories site={site} posts={latest.posts} now={now} />
      </div>
    </>
  );
}
