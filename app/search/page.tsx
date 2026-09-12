import type { CSSProperties } from 'react';
import type { Metadata } from 'next';

import { getCurrentSite } from '@/lib/site';
import { searchPosts } from '@/lib/wp';
import { buildMetadata, NOINDEX_NOFOLLOW } from '@/lib/seo';
import { searchPath } from '@/lib/urls';
import { StoryCard } from '@/components/StoryCard';
import { SearchForm } from '@/components/SearchForm';
import { Pagination } from '@/components/Pagination';

// The one route that is never cached: every query is a live upstream hit.
export const dynamic = 'force-dynamic';

const PER_PAGE = 12;

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
    title: 'Search',
    description: `Search news, sport, culture and more from ${site.name}.`,
    path: searchPath(),
    // Search results are an infinite low-value URL space: out of the index
    // AND not crawled onward — everything they link to has a real home.
    robots: NOINDEX_NOFOLLOW,
  });
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const site = await getCurrentSite();
  const params = await searchParams;
  const query = firstParam(params.q).slice(0, 120);
  const page = Math.max(1, Number.parseInt(firstParam(params.page) || '1', 10) || 1);
  const forceNoImage = params['no-images'] === '1';

  // Empty query short-circuits without touching the API.
  const { posts, totalPages, total } = query
    ? await searchPosts(site, query, page, PER_PAGE)
    : { posts: [], totalPages: 0, total: 0 };

  // One clock per render, passed down, so relative timestamps agree.
  const now = new Date();

  return (
    <div className="container" style={{ paddingBlock: '2rem 0' }}>
      <header
        style={{ paddingBottom: '1.5rem', borderBottom: '2px solid var(--rule)' }}
      >
        <p className="kicker">Search</p>
        <h1 className="h-lead" style={{ marginTop: '0.5rem' }}>
          {query ? `Results for “${query}”` : 'Search stories'}
        </h1>
        <div style={{ marginTop: '1.25rem', maxWidth: '28rem' }}>
          <SearchForm defaultValue={query} />
        </div>
        {query ? (
          <p className="meta" style={{ marginTop: '0.75rem' }}>
            {total} {total === 1 ? 'result' : 'results'}
          </p>
        ) : null}
      </header>

      {/* Honest empty state — no filler stories, no fake suggestions. */}
      {query && posts.length === 0 ? (
        <div style={{ marginTop: '2rem' }}>
          <p className="standfirst">No stories matched “{query}”.</p>
          <p className="standfirst" style={{ marginTop: '0.5rem' }}>
            Try a shorter phrase, or browse a section from the menu above.
          </p>
        </div>
      ) : null}

      {posts.length > 0 ? (
        <div style={{ ...WELL_GRID, marginTop: '2rem' }}>
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
      ) : null}

      <Pagination
        page={page}
        totalPages={totalPages}
        // The one sanctioned string-concatenation outside lib/urls: paging a
        // query keeps the ?q= from searchPath and appends &page=N.
        buildHref={(p) => `${searchPath(query)}&page=${p}`}
        label="Search results pagination"
      />
    </div>
  );
}
