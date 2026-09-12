import type { SiteConfig } from '../config/sites';
import type { WPCategory, WPPost } from '../types/wp';
import { getSection } from '../config/sections';
import { QUARANTINED_SLUGS } from '../config/category-overrides';
import { getFeaturedImage, stripHtml } from '../lib/wp-helpers';
import { categoryPath } from '../lib/urls';
import { StoryCard } from './StoryCard';
import { SectionHeading } from './SectionHeading';
import { sectionStyleVars } from './section-style';

/**
 * One colour-owned homepage section block — docs/DESIGN.md § Homepage 4:
 * SectionHeading in the section colour (swatch + Anton title + 2px rule +
 * "More {name} →"), then a 4-card `.grid-section` row: one feature card
 * (leads with its image where one exists) and up to three standards.
 *
 * Dedup contract: `exclude` is the PAGE-GLOBAL "already rendered" id set.
 * The block filters its candidate pool against it and adds every id it
 * renders — heavy multi-category overlap on this install (104 categories
 * across 105 posts at recon) would otherwise repeat the same story from the
 * hero down through three sections. Fewer than 3 undeduped stories and the
 * block renders NOTHING rather than filler — the design contract.
 *
 * Renders its own `.home-section` rhythm wrapper — callers must NOT wrap it
 * in another, so a null render leaves no phantom gap.
 */
export function CategoryBlock({
  site,
  category,
  posts,
  now,
  exclude,
}: {
  site: SiteConfig;
  category: WPCategory;
  /** Candidate pool for this section, newest first (fetch more than 4 — the dedup set eats entries). */
  posts: WPPost[];
  now: Date;
  /** Page-global dedup set; ids this block renders are added to it. */
  exclude?: Set<number>;
}) {
  // Belt-and-braces: a quarantined meta-category (google-news) never gets a
  // derived surface, even if a caller slips it in.
  if (QUARANTINED_SLUGS.has(category.slug)) return null;

  const seen = new Set<number>();
  const available = posts.filter((post) => {
    if (exclude?.has(post.id) || seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });

  // A block is 1 feature + up to 3 standards. Below 3 available stories it
  // renders nothing — never filler.
  if (available.length < 3) return null;

  // The feature slot should actually lead with a picture: newest available
  // story with artwork, else the newest — the colour-block card carries an
  // imageless lead, never a placeholder.
  const lead = available.find((post) => getFeaturedImage(post) !== null) ?? available[0];
  const items = available.filter((post) => post.id !== lead.id).slice(0, 3);

  if (exclude) {
    exclude.add(lead.id);
    for (const item of items) exclude.add(item.id);
  }

  // Curated display name for curated sections (matches the nav label); the
  // registry fallback echoes the slug, in which case the WP name is the
  // truth — never invent one.
  const section = getSection(category.slug);
  const name =
    section.name !== section.slug
      ? section.name
      : stripHtml(category.name) || category.slug;

  return (
    <section
      className="home-section"
      aria-labelledby={`sec-${category.slug}`}
      style={sectionStyleVars(category.slug)}
    >
      <SectionHeading
        title={name}
        href={categoryPath(category.slug)}
        id={`sec-${category.slug}`}
        moreLabel={`More ${name}`}
      />

      <div className="grid-section">
        <StoryCard site={site} post={lead} variant="feature" now={now} />

        {items.map((post) => (
          <StoryCard key={post.id} site={site} post={post} variant="standard" now={now} />
        ))}
      </div>
    </section>
  );
}
