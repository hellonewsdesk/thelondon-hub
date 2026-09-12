import Link from 'next/link';
import type { WPPost } from '../types/wp';
import { postTitle } from '../lib/wp-helpers';
import { postPath } from '../lib/urls';

/**
 * The topbar's breaking ticker: a red BREAKING flag and one truncating
 * headline link for the latest story.
 *
 * Designed for the 40px topbar (docs/DESIGN.md chrome spec), so unlike the
 * bwave original it does not bring its own full-width band or `.container`
 * wrapper — the Masthead places it inside `.topbar__inner`, where
 * `.topbar__breaking` gives it the flexible, truncation-safe left slot.
 *
 * Renders nothing at all when there is no qualifying story — never an empty
 * flag with no headline. The ticker is a STATIC link: no marquee, no
 * animation, no auto-rotation. A strip that moves on its own is an
 * accessibility problem (nothing to pause) and reads as an ad; a truncating
 * one-liner tells the same story without either.
 */
export function BreakingStrip({ post }: { post: WPPost | null }) {
  if (!post) return null;

  return (
    <aside className="topbar__breaking" aria-label="Latest headline">
      <span className="topbar__flag">Latest</span>
      <Link href={postPath(post.slug)} className="topbar__ticker">
        {postTitle(post)}
      </Link>
    </aside>
  );
}
