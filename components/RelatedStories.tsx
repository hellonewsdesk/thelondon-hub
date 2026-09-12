import type { CSSProperties } from 'react';
import type { SiteConfig } from '../config/sites';
import type { WPPost } from '../types/wp';
import { getSection } from '../config/sections';
import { getPrimaryCategory } from '../lib/wp-helpers';
import { StoryCard } from './StoryCard';
import { SectionHeading } from './SectionHeading';

/**
 * "More on this" after an article: exactly three standard cards from the
 * SAME section as the article.
 *
 * The relevance rule is bwave's, enforced here rather than trusted from the
 * data layer: a related story shares the article's primary category
 * (`post.categories[0]`, the id lib/wp.ts queries by). getRelatedPosts pads
 * a thin category with most-recent stories so its callers always get a full
 * list — that padding is FILLER by this component's definition, so it is
 * filtered out, and when fewer than three genuine same-section stories
 * remain the block renders NOTHING. An article page with no related block
 * beats one padded with unrelated stories.
 */
const RELATED_COUNT = 3;

export function RelatedStories({
  site,
  post,
  posts,
  now,
  title = 'More on this',
}: {
  site: SiteConfig;
  /** The article being read — source of the same-section rule. */
  post: WPPost;
  /** Candidates, e.g. from getRelatedPosts (self already excluded). */
  posts: WPPost[];
  /** Request-time clock, threaded so timestamps cannot hydrate-mismatch. */
  now: Date;
  title?: string;
}) {
  const primaryId = post.categories?.[0];
  const primary = getPrimaryCategory(post);
  if (typeof primaryId !== 'number' || !primary) return null;

  const sameSection = posts.filter(
    (p) => p.id !== post.id && (p.categories?.includes(primaryId) ?? false),
  );
  if (sameSection.length < RELATED_COUNT) return null;

  const shown = sameSection.slice(0, RELATED_COUNT);

  const section = getSection(primary.slug);
  const sectionVars = {
    '--section-light': section.light,
    '--section-dark': section.dark,
  } as CSSProperties;

  return (
    <section aria-labelledby="related-heading" className="home-section" style={sectionVars}>
      <SectionHeading title={title} id="related-heading" />

      <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
        {shown.map((related) => (
          <StoryCard
            key={related.id}
            site={site}
            post={related}
            variant="standard"
            showExcerpt={false}
            now={now}
          />
        ))}
      </div>
    </section>
  );
}
