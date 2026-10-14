import type { SiteConfig } from '../config/sites';
import type { WPCategory, WPPost } from '../types/wp';
import { SECTIONS } from '../config/sections';
import { StoryCard } from './StoryCard';
import { SectionHeading } from './SectionHeading';
import { SectionChips } from './SectionChips';

/**
 * The article page's right-hand rail: latest stories (compact cards) and the
 * curated section chips. Sticky on wide screens; on narrow screens it simply
 * stacks below the article.
 */
export function ArticleSidebar({
  site,
  posts,
  categories,
  now,
}: {
  site: SiteConfig;
  posts: WPPost[];
  categories: WPCategory[];
  now: Date;
}) {
  const hasSections = SECTIONS.some((s) =>
    categories.some((c) => c.slug === s.slug && c.count > 0),
  );
  if (posts.length === 0 && !hasSections) return null;

  return (
    <aside className="article-sidebar" aria-label="More from The London Hub">
      {posts.length > 0 ? (
        <section aria-labelledby="sidebar-latest">
          <SectionHeading title="Latest" id="sidebar-latest" href="/all-post/" />
          <ol className="list-none m-0 p-0">
            {posts.map((post) => (
              <li key={post.id} className="py-3 border-t border-[color:var(--rule)] first:border-t-0">
                <StoryCard site={site} post={post} variant="compact" now={now} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {hasSections ? (
        <section aria-labelledby="sidebar-sections" className="article-sidebar__sections">
          <SectionHeading title="Sections" id="sidebar-sections" />
          <SectionChips categories={categories} />
        </section>
      ) : null}
    </aside>
  );
}
