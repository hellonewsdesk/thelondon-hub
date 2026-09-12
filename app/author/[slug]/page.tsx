import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getCurrentSite } from '@/lib/site';
import type { SiteConfig } from '@/config/sites';
import { getAuthorBySlug, getPosts, REVALIDATE_SECONDS } from '@/lib/wp';
import { getAuthor, stripHtml } from '@/lib/wp-helpers';
import {
  buildMetadata,
  INDEX_FOLLOW,
  MIN_AUTHOR_POSTS_TO_INDEX,
  NOINDEX_FOLLOW,
} from '@/lib/seo';
import { authorPath } from '@/lib/urls';
import { breadcrumbSchema, personSchema, type Crumb } from '@/lib/schema';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { StoryCard } from '@/components/StoryCard';
import type { WPPost } from '@/types/wp';

// 3h, the pipeline cadence; passed down to every getPosts call below.
export const revalidate = 10800;
export const dynamicParams = true;

/**
 * Byline page — docs/DESIGN.md: simple header + grid. This site has 3
 * authors across 105 posts; keep it clean.
 *
 * Google News expects a resolvable author entity — it is a direct E-E-A-T
 * signal, and the NewsArticle schema links here. The WP `/users` endpoint is
 * often closed to anonymous callers, so this falls back to reconstructing the
 * author from the embedded data on their posts.
 */
interface ResolvedAuthor {
  name: string;
  slug: string;
  description: string;
}

/** Same responsive well as the category pages: 3-up desktop, 1-up mobile. */
const WELL_GRID: CSSProperties = {
  display: 'grid',
  gap: 'var(--gutter)',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
};

async function resolveAuthor(
  site: SiteConfig,
  slug: string,
): Promise<{ author: ResolvedAuthor; posts: WPPost[]; total: number } | null> {
  const user = await getAuthorBySlug(site, slug);

  if (user) {
    const { posts, total } = await getPosts(site, {
      perPage: 12,
      authorId: user.id,
      revalidate: REVALIDATE_SECONDS,
    });
    return {
      author: {
        name: stripHtml(user.name) || slug,
        slug: user.slug,
        description: stripHtml(user.description) || '',
      },
      posts,
      total,
    };
  }

  // Fallback: /users is blocked. Find the author on their own posts.
  // (Only sees the newest 12 posts, so a prolific-but-quiet author can
  // under-count — the honest trade against an extra slow origin call.)
  const { posts, total } = await getPosts(site, {
    perPage: 12,
    revalidate: REVALIDATE_SECONDS,
  });
  const match = posts
    .map((post) => ({ post, author: getAuthor(post) }))
    .find((entry) => entry.author?.slug === slug);

  if (!match?.author) return null;

  const byAuthor = posts.filter((post) => getAuthor(post)?.slug === slug);

  return {
    author: { name: match.author.name, slug: match.author.slug, description: '' },
    posts: byAuthor,
    total: byAuthor.length || total,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getCurrentSite();
  const resolved = await resolveAuthor(site, slug);

  if (!resolved) {
    return { title: 'Author not found', robots: { index: false, follow: true } };
  }

  const { author, total } = resolved;

  return buildMetadata({
    site,
    title: author.name,
    description:
      author.description ||
      `Stories, reporting and analysis by ${author.name} for ${site.name}.`,
    path: authorPath(author.slug),
    // E-E-A-T page, but only with substance behind it: an author needs
    // MIN_AUTHOR_POSTS_TO_INDEX bylines before the page earns an index slot.
    robots: total >= MIN_AUTHOR_POSTS_TO_INDEX ? INDEX_FOLLOW : NOINDEX_FOLLOW,
  });
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getCurrentSite();
  const resolved = await resolveAuthor(site, slug);

  if (!resolved) notFound();

  const { author, posts, total } = resolved;
  // One clock per render, passed down, so relative timestamps agree.
  const now = new Date();

  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: author.name, path: authorPath(author.slug) },
  ];

  return (
    <>
      <JsonLd data={personSchema(site, author)} id="ld-person" />
      <JsonLd data={breadcrumbSchema(site, crumbs)} id="ld-breadcrumbs" />

      <div className="container">
        <div style={{ paddingTop: '1.25rem' }}>
          <Breadcrumbs crumbs={crumbs} />
        </div>

        <header
          style={{
            paddingBottom: '1.5rem',
            borderBottom: '2px solid var(--rule)',
            marginBottom: '2rem',
          }}
        >
          {/* No section pair on this page, so the kicker wears the brand
              green fallback — authors are not sections. */}
          <p className="kicker">Author</p>
          <h1 className="h-lead" style={{ marginTop: '0.5rem' }}>
            {author.name}
          </h1>
          <p className="standfirst" style={{ marginTop: '0.75rem', maxWidth: '46rem' }}>
            {author.description ||
              `${author.name} writes for ${site.name}, covering news, sport and culture from ${site.city} and beyond.`}
          </p>
          <p className="meta" style={{ marginTop: '0.75rem' }}>
            {total} {total === 1 ? 'story' : 'stories'}
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="standfirst">No stories by this author yet.</p>
        ) : (
          <div style={WELL_GRID}>
            {posts.map((post) => (
              <StoryCard
                key={post.id}
                site={site}
                post={post}
                variant="standard"
                now={now}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
