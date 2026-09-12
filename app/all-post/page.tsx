import type { CSSProperties } from 'react';
import type { Metadata } from 'next';

import { getCurrentSite } from '@/lib/site';
import { getPosts } from '@/lib/wp';
import { buildMetadata, INDEX_FOLLOW } from '@/lib/seo';
import { homePagePath } from '@/lib/urls';
import { breadcrumbSchema, type Crumb } from '@/lib/schema';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { StoryCard } from '@/components/StoryCard';
import { Pagination } from '@/components/Pagination';

/**
 * /all-post/ — the full archive, page 1.
 *
 * This is a REAL page on the live WordPress install (recon-verified
 * 2026-09-10, listed in config/route-allowlist.ts), already indexed at this
 * exact path, so it is carried across as the archive's front door: the
 * "View more" target of the homepage's Latest block. It renders the same
 * river as the deeper /page/N/ archive pages and its pagination links into
 * them — page 1 lives HERE, so the pagination never emits /page/1/.
 */

// The archive river moves with the front page: 15 minutes, not the 3h
// article cadence. The getPosts call below passes this SAME window down —
// recomposing a 15-minute page over 3h-cached fetches silently serves stale
// data (a shipped bug on the sibling build).
export const revalidate = 900;

const PER_PAGE = 12;
const ALL_POSTS_PATH = '/all-post/';

/** Same responsive well as the category pages: 3-up desktop, 1-up mobile. */
const WELL_GRID: CSSProperties = {
  display: 'grid',
  gap: 'var(--gutter)',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
};

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return buildMetadata({
    site,
    title: 'All stories',
    description: `The full ${site.name} archive — every published story, newest first.`,
    // Canonical to itself: a live, indexed WP URL carried across.
    path: ALL_POSTS_PATH,
    robots: INDEX_FOLLOW,
  });
}

export default async function AllPostsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const site = await getCurrentSite();
  const query = await searchParams;
  const forceNoImage = query['no-images'] === '1';

  const { posts, totalPages, total } = await getPosts(site, {
    perPage: PER_PAGE,
    page: 1,
    // Fetch-window passthrough — same value this route exports as revalidate.
    revalidate: 900,
  });

  // One clock per render, passed down, so relative timestamps agree.
  const now = new Date();

  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: 'All stories', path: ALL_POSTS_PATH },
  ];

  return (
    <>
      <JsonLd data={breadcrumbSchema(site, crumbs)} id="ld-breadcrumbs" />

      <div className="container">
        <div style={{ paddingTop: '1.25rem' }}>
          <Breadcrumbs crumbs={crumbs} />
        </div>

        {/* The cat-band with no section pair set: the Anton title and rule
            wear the brand green fallback — the archive is a cross-section
            surface, so no single section colour may own it. */}
        <header className="cat-band">
          <h1 className="cat-band__title">All stories</h1>
          <p className="cat-band__desc">
            Every story published by {site.name}, newest first.
          </p>
          <p className="cat-band__count">
            {total} {total === 1 ? 'story' : 'stories'}
            {totalPages > 1 ? ` · page 1 of ${totalPages}` : ''}
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="standfirst">Nothing to read just yet.</p>
        ) : (
          <section aria-label="All stories, newest first">
            <h2 className="sr-only">Newest stories</h2>
            <div style={WELL_GRID}>
              {posts.map((post) => (
                <StoryCard
                  key={post.id}
                  site={site}
                  post={post}
                  variant={forceNoImage ? 'text' : 'standard'}
                  now={now}
                />
              ))}
            </div>
          </section>
        )}

        <Pagination
          page={1}
          totalPages={totalPages}
          // Page 1 lives at THIS live WP URL; deeper pages are the app's
          // /page/N/ archive river (homePagePath). Never emit /page/1/.
          buildHref={(p) => (p <= 1 ? ALL_POSTS_PATH : homePagePath(p))}
          label="Archive pagination"
        />
      </div>
    </>
  );
}
