import Link from 'next/link';
import type { WPCategory } from '../types/wp';
import { SECTIONS } from '../config/sections';
import { categoryPath } from '../lib/urls';
import { sectionStyleVars } from './section-style';

/**
 * The chip rail — docs/DESIGN.md § Homepage 2: a horizontal scroll-snap rail
 * of section chips on the white well. Square 1px-bordered chips, label +
 * live post count, text/border in the section colour; hover fills the chip
 * (all in `.chip` CSS).
 *
 * Fed from the CURATED section registry (config/sections.ts) crossed with
 * the live category list for counts — never generated from the API alone,
 * which would surface the google-news syndication meta-category and the
 * long tail of thin categories. A curated section with no live category or
 * zero posts renders no chip: nothing rather than a dead link or an
 * invented count.
 *
 * No tabindex on the rail: unlike the story slider, every scrollable item
 * here is itself a focusable link, so keyboard users can already reach all
 * content (the container scrolls items into view on focus).
 */
export function SectionChips({ categories }: { categories: WPCategory[] }) {
  const bySlug = new Map(categories.map((category) => [category.slug, category]));

  const chips = SECTIONS.flatMap((section) => {
    const category = bySlug.get(section.slug);
    if (!category || category.count < 1) return [];
    return [{ section, category }];
  });

  if (chips.length === 0) return null;

  return (
    <nav className="chip-rail" aria-label="Sections">
      {chips.map(({ section, category }) => (
        <Link
          key={section.slug}
          href={categoryPath(section.slug)}
          className="chip"
          style={sectionStyleVars(section.slug)}
        >
          {section.name}
          <span className="chip__count">
            {category.count}
            <span className="sr-only"> stories</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
