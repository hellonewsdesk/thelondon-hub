import Link from 'next/link';
import type { SiteConfig } from '../config/sites';
import type { WPPost } from '../types/wp';
import { SectionHeading } from './SectionHeading';
import { postTitle } from '../lib/wp-helpers';
import { postPath } from '../lib/urls';
import { formatRelative, isoDateTime } from '../lib/format';

/**
 * The page tail: a dense three-column river of further stories. Text only
 * and timestamped — by this depth the reader is scanning, not browsing, and
 * images would only slow the page down.
 *
 * The closing button goes to /all-post/ — the live WordPress archive page
 * (recon-verified), the same target docs/DESIGN.md gives the homepage
 * "View more" button.
 */
export function MoreStories({
  site,
  posts,
  now,
}: {
  site: SiteConfig;
  posts: WPPost[];
  /** Request-time clock, threaded so timestamps cannot hydrate-mismatch. */
  now: Date;
}) {
  if (posts.length === 0) return null;

  return (
    <section aria-labelledby="more-stories" className="home-section">
      <SectionHeading title="More stories" id="more-stories" />

      <ol className="list-none m-0 p-0 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <li key={post.id} className="py-3 border-t border-[color:var(--rule)]">
            <time dateTime={isoDateTime(post.date)} className="meta block">
              {formatRelative(post.date, site.locale, now)}
            </time>
            <h3 className="h-compact mt-1">
              <Link href={postPath(post.slug)} className="headline-link">
                {postTitle(post)}
              </Link>
            </h3>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex justify-center">
        <Link href="/all-post/" className="btn">
          More stories
        </Link>
      </div>
    </section>
  );
}
