import type { CSSProperties } from 'react';
import type { SiteConfig } from '@/config/sites';
import type { WPCategory, WPPost } from '@/types/wp';
import { StoryCard } from '@/components/StoryCard';
import { Pagination } from '@/components/Pagination';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SectionHeading } from '@/components/SectionHeading';
import { JsonLd } from '@/components/JsonLd';
import { sectionStyleVars } from '@/components/section-style';
import { breadcrumbSchema, collectionPageSchema, type Crumb } from '@/lib/schema';
import { categoryPagePath, categoryPath } from '@/lib/urls';
import { stripHtml } from '@/lib/wp-helpers';
import { isCategoryIndexable } from '@/lib/seo';
import { getSection } from '@/config/sections';
import { getTaxonomy } from '@/config/taxonomy';

/**
 * Display name for a category: the curated section name where one exists
 * (matches the nav label — 'World', not the WP install's longer form), else
 * the WP name. The registry fallback echoes the slug, in which case the WP
 * name is the truth — never invent one.
 */
export function categoryDisplayName(category: WPCategory): string {
  const section = getSection(category.slug);
  if (section.name !== section.slug) return section.name;
  return stripHtml(category.name) || category.slug;
}

/**
 * Title label for a section. Appending "news" is what makes a bare section
 * name ("Football", "Business") read as a news heading, but half of London's
 * curated slugs already carry the word ("UK News", "World News", "Sports
 * News") and blind appending produced "UK News news | The London Hub".
 */
export function categoryTitleLabel(category: WPCategory): string {
  const name = categoryDisplayName(category);
  return /\bnews\b/i.test(name) ? name : `${name} news`;
}

/**
 * Category standfirst / meta description. The curated taxonomy descriptions
 * were written for exactly this slot (60–160 chars — see config/taxonomy.ts),
 * so they win; the WP description is next; the generated line is the last
 * resort so the band never renders empty.
 */
export function categoryDescription(site: SiteConfig, category: WPCategory): string {
  const curated = getTaxonomy(site).find((entry) => entry.slug === category.slug);
  if (curated?.description) return curated.description;
  const fromWp = stripHtml(category.description);
  if (fromWp) return fromWp;
  const name = categoryDisplayName(category);
  const subject = /\bnews\b/i.test(name) ? name.toLowerCase() : `${name.toLowerCase()} news`;
  return `The latest ${subject}, reporting and analysis from ${site.name}.`;
}

/**
 * The standards well: responsive without media queries (inline styles cannot
 * carry them) — 3-up on the 1152px well, 2-up on tablets, 1-up on phones.
 * globals.css deliberately has no generic multi-row card grid; this is the
 * one shared layout the listing routes need.
 */
const WELL_GRID: CSSProperties = {
  display: 'grid',
  gap: 'var(--gutter)',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
};

/**
 * Category index, shared by `/category/[slug]/` and its paginated pages —
 * docs/DESIGN.md § Category page: the colour-owned H1 band (big Anton title
 * in the section colour + description + post count), then 1 feature +
 * standards grid on page 1 (deeper pages are a plain well), then pagination
 * whose current button fills with the section colour.
 *
 * The wrapping div sets the section pair (see components/section-style.ts),
 * so the band, kickers, card hovers and the pagination current-state all
 * resolve `var(--section)` to this category's colour.
 *
 * `forceNoImage` is the `?no-images=1` QA switch: every card renders as the
 * explicit `text` variant — the designed colour-block no-image treatment.
 */
export function CategoryView({
  site,
  category,
  posts,
  page,
  totalPages,
  total,
  forceNoImage = false,
}: {
  site: SiteConfig;
  category: WPCategory;
  posts: WPPost[];
  page: number;
  totalPages: number;
  total: number;
  forceNoImage?: boolean;
}) {
  // One clock per render, passed down, so relative timestamps agree.
  const now = new Date();
  const name = categoryDisplayName(category);
  const description = categoryDescription(site, category);

  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name, path: categoryPath(category.slug) },
    ...(page > 1
      ? [{ name: `Page ${page}`, path: categoryPagePath(category.slug, page) }]
      : []),
  ];

  const [lead, ...rest] = posts;
  const showLead = page === 1 && Boolean(lead);
  const well = showLead ? rest : posts;

  return (
    <>
      <JsonLd
        data={collectionPageSchema(
          site,
          category,
          categoryPagePath(category.slug, page),
          description,
          // The ItemList mirrors exactly what this page renders, in order,
          // so the structured data matches what a crawler actually sees.
          posts,
        )}
        id="ld-collection"
      />
      <JsonLd data={breadcrumbSchema(site, crumbs)} id="ld-breadcrumbs" />

      <div className="container" style={sectionStyleVars(category.slug)}>
        <div style={{ paddingTop: '1.25rem' }}>
          <Breadcrumbs crumbs={crumbs} />
        </div>

        <header className="cat-band">
          <h1 className="cat-band__title">{name}</h1>
          <p className="cat-band__desc">{description}</p>
          <p className="cat-band__count">
            {total} {total === 1 ? 'story' : 'stories'}
            {page > 1 ? ` · page ${page} of ${totalPages}` : ''}
            {!isCategoryIndexable(site, category) ? (
              <span className="sr-only"> (not indexed)</span>
            ) : null}
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="standfirst">No stories in this section yet.</p>
        ) : (
          <>
            {showLead && lead ? (
              <section aria-labelledby="category-lead-heading">
                {/* The lead card's own headline is an h3 (the step-up to h2 is
                    gated on the `hero` variant), so without this the document
                    ran h1 -> h3 and Lighthouse flagged a skipped level. A
                    labelled region is the honest fix: it names the lead for
                    screen readers instead of restyling a heading to fake the
                    level. */}
                <h2 id="category-lead-heading" className="sr-only">
                  Top story
                </h2>
                <StoryCard
                  site={site}
                  post={lead}
                  variant={forceNoImage ? 'text' : 'feature'}
                  // The feature image is this page's LCP element. On the
                  // `feature` variant `priority` only marks the image
                  // high-priority — the hero-lead heading step-up is gated on
                  // the `hero` variant, so nothing structural changes.
                  priority
                  now={now}
                />
              </section>
            ) : null}

            <section
              className={showLead ? 'home-section' : undefined}
              aria-labelledby="category-well-heading"
            >
              <SectionHeading
                title={showLead ? 'More stories' : name}
                id="category-well-heading"
              />
              <div style={WELL_GRID}>
                {well.map((post) => (
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
          </>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          buildHref={(p) => categoryPagePath(category.slug, p)}
          label={`${name} pagination`}
        />
      </div>
    </>
  );
}
