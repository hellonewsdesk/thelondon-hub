import type { SiteConfig } from '../config/sites';
import type { WPPost } from '../types/wp';
import { StoryCard } from './StoryCard';
import { SectionHeading } from './SectionHeading';

/**
 * The "Latest News" block — docs/DESIGN.md § Homepage 3: section header
 * (Anton `Latest` + the green square the accent fallback provides) with a
 * bordered `View more →` button to /all-post/ (a real WP page,
 * recon-verified live), then `.grid-latest`: one large feature card on the
 * left (7 of 12 cols) and up to four compact horizontal cards on the right.
 *
 * Renders its own `.home-section` rhythm wrapper — callers must NOT wrap it
 * in another, so a null render (no posts) leaves no phantom gap.
 *
 * No section pair is set here: Latest is a cross-section block, so its
 * heading wears the brand green fallback while each card wears its own
 * section colour.
 */
export function LatestRail({
  site,
  posts,
  now,
  title = 'Latest',
  moreHref = '/all-post/',
}: {
  site: SiteConfig;
  posts: WPPost[];
  now: Date;
  title?: string;
  moreHref?: string;
}) {
  if (posts.length === 0) return null;

  const [feature, ...rest] = posts;
  const compacts = rest.slice(0, 4);

  return (
    <section className="home-section" aria-labelledby="latest-rail-heading">
      <SectionHeading
        title={title}
        id="latest-rail-heading"
        href={moreHref}
        moreLabel="View more"
        moreVariant="button"
      />

      <div className="grid-latest">
        <StoryCard site={site} post={feature} variant="feature" now={now} />

        {compacts.length > 0 ? (
          <ol className="grid-latest__list">
            {compacts.map((post) => (
              <li key={post.id}>
                <StoryCard site={site} post={post} variant="compact" now={now} />
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
