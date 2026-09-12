import Link from 'next/link';
import type { WPCategory } from '@/types/wp';
import { SECTIONS } from '@/config/sections';
import { categoryPath } from '@/lib/urls';
import { sectionStyleVars } from './section-style';

/**
 * The closing colour wall — docs/DESIGN.md § Homepage 6.
 *
 * The nine section colours are the strongest thing the design system owns,
 * and up to this point in the page they only ever appear at 12px: a kicker,
 * a 2px rule, a chip border. This band spends them at full scale as the last
 * thing before the footer, so the page closes on the palette rather than on
 * an empty half-width text block.
 *
 * It is also the most useful thing that can sit here. There is no newsletter
 * provider wired, so the alternative was an inert form that must not pretend
 * to submit; a full section index earns the space honestly and gives every
 * section a second entry point at the point where a reader has run out of
 * homepage.
 *
 * Contrast: white on every light section colour is 5.02:1 or better (the
 * lowest is lifestyle #B45309 at 5.02; verified against the token table in
 * docs/DESIGN.md). That is the same guarantee the `text` StoryCard variant
 * relies on, so no new colour pair is introduced here.
 *
 * A section with no live category, or a live category with no posts, renders
 * no tile — nothing rather than a dead link.
 */
export function SectionWall({ categories }: { categories: WPCategory[] }) {
  const bySlug = new Map(categories.map((category) => [category.slug, category]));

  const tiles = SECTIONS.flatMap((section) => {
    const category = bySlug.get(section.slug);
    if (!category || category.count < 1) return [];
    return [{ section, category }];
  });

  if (tiles.length === 0) return null;

  return (
    <nav className="wall" aria-label="All sections">
      {tiles.map(({ section, category }) => (
        <Link
          key={section.slug}
          href={categoryPath(section.slug)}
          className="wall__tile"
          style={sectionStyleVars(section.slug)}
        >
          {/* The count sits above the name and is the only non-Anton element:
              a small tabular number reads as an index, which is what this is. */}
          <span className="wall__count">
            {category.count}
            <span className="sr-only"> stories in</span>
          </span>
          <span className="wall__name">{section.name}</span>
          <span className="wall__go" aria-hidden="true">
            &rarr;
          </span>
        </Link>
      ))}
    </nav>
  );
}
