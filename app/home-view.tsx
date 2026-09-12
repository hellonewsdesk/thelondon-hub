import type { SiteConfig } from '../config/sites';
import Link from 'next/link';
import type { WPCategory, WPPost } from '../types/wp';
import type { HomepageData } from '../lib/homepage';

import { StoryCard } from '../components/StoryCard';
import { StorySlider } from '../components/StorySlider';
import { SectionHeading } from '../components/SectionHeading';
import { SectionChips } from '../components/SectionChips';
import { SectionWall } from '../components/SectionWall';
import { CategoryBlock } from '../components/CategoryBlock';
import { LatestRail } from '../components/LatestRail';
import { Pagination } from '../components/Pagination';
import { JsonLd } from '../components/JsonLd';

import { itemListSchema } from '../lib/schema';
import { postTitle } from '../lib/wp-helpers';
import { homePagePath } from '../lib/urls';

/**
 * The front page — docs/DESIGN.md § Homepage composition, element by element:
 *
 *   1. Hero band     full-bleed chrome plane continuing from the masthead:
 *                    lead image card (Anton headline, priority) + two stacked
 *                    secondary hero cards.
 *   2. Chip rail     scroll-snap rail of section chips on the white well.
 *   3. Latest News   1 large feature card + 4 compact cards (LatestRail).
 *   4. Section blocks one colour-owned 4-card row per curated section.
 *   5. Scroll rail   "More from the Hub" native scroll-snap slider.
 *   6. Newsletter    chrome band; the form is deliberately inert (no
 *                    provider) with a mailto: fallback. No fake submit.
 *
 * Order is by recency and curated section order, computed at revalidate time
 * in lib/homepage.ts — never random, never shuffled on the client. The
 * breaking story is NOT rendered here: the topbar ticker inside the Masthead
 * carries it on every page.
 *
 * DEDUP: lib/homepage.ts already composes with one global Set, so the data
 * arrives duplicate-free. The `used` set below re-threads the ids through
 * each CategoryBlock in render order anyway — the block's own contract —
 * so a future change to either side cannot silently reintroduce repeats.
 */
export function HomeView({
  site,
  data,
  categories,
}: {
  site: SiteConfig;
  data: HomepageData;
  /** Live category list for the chip rail (counts). Empty hides the rail. */
  categories: WPCategory[];
}) {
  const now = new Date();
  const { lead, subLead, rail, slider, blocks, ordered } = data;

  if (!lead) {
    return (
      <div className="container py-16">
        <h1 className="h-lead">Nothing to read just yet</h1>
        <p className="standfirst mt-3">
          Stories will appear here as soon as they are published.
        </p>
      </div>
    );
  }

  const headlines = ordered.slice(0, 10).map((post) => ({
    slug: post.slug,
    title: postTitle(post),
  }));

  // Page-global dedup set, threaded through every section block in render
  // order. Seeded with everything the hero band and Latest have shown.
  const used = new Set<number>();
  used.add(lead.id);
  for (const post of subLead) used.add(post.id);
  for (const post of rail) used.add(post.id);

  return (
    <>
      <JsonLd data={itemListSchema(site, headlines)} id="ld-headlines" />

      {/*
        Exactly one h1, and a news front is the awkward case: the biggest
        text on screen is the lead HEADLINE, which is an h2 because it names
        one story, not the page. The page's own h1 is the masthead line,
        carried visually by the wordmark and spelled out here for screen
        readers and crawlers — a front page with no h1 reads as a page about
        nothing in particular.
      */}
      <h1 className="sr-only">
        {site.name} — {site.tagline}
      </h1>

      {/* 1. Hero band — the chrome plane continues from the masthead so the
          top of the page is one dark surface. */}
      <section className="hero-band" aria-label="Top stories">
        <div className="container hero-band__intro">
          <p className="hero-band__eyebrow">The daily brief</p>
          <p className="hero-band__note">The stories shaping your day</p>
        </div>
        <div className="container hero-band__grid">
          <StoryCard site={site} post={lead} variant="hero" priority now={now} />

          {subLead.length > 0 ? (
            <div className="hero-band__side">
              {subLead.map((post) => (
                <StoryCard key={post.id} site={site} post={post} variant="hero" now={now} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="container">
        {/* 2. Chip rail. SectionChips crosses the curated section registry
            with the live counts and renders nothing when nothing matches. */}
        {categories.length > 0 ? (
          <div className="home-topics">
            <SectionChips categories={categories} />
          </div>
        ) : null}

        {/* 3. Latest News — 1 feature + 4 compacts, View more → /all-post/. */}
        <LatestRail site={site} posts={rail} now={now} />

        {/* 4. Colour-owned section blocks. Each renders its own .home-section
            wrapper, or nothing at all below 3 undeduped stories — never
            filler, never a phantom gap. */}
        {blocks.map((block) => (
          <CategoryBlock
            key={block.category.id}
            site={site}
            category={block.category}
            posts={[block.lead, ...block.items]}
            now={now}
            exclude={used}
          />
        ))}

        {/* 5. The closing picture rail. */}
        {slider.length > 0 ? (
          <section className="home-section" aria-labelledby="more-from-hub">
            <SectionHeading title="More from the Hub" id="more-from-hub" />
            <StorySlider label="More from the Hub" count={slider.length}>
              {slider.map((post) => (
                <StoryCard key={post.id} site={site} post={post} variant="standard" now={now} />
              ))}
            </StorySlider>
          </section>
        ) : null}
      </div>

      {/* 6. Closing band — statement, then the section colour wall.
          [TODO — no provider wired]: there is still no newsletter provider, so
          nothing here pretends to submit and there are no fake success states.
          Rather than park an inert form in the space, the band closes on a
          full section index (SectionWall) — the nine section colours at full
          scale, which is the one place the palette gets to be the headline.
          The mailto: link to the publisher's verified newsdesk address remains
          the real contact path. */}
      <section className="newsletter" aria-labelledby="newsletter-heading">
        <div className="container">
          <div className="newsletter__head">
            <h2 id="newsletter-heading" className="newsletter__title">
              There&rsquo;s more to the story.
            </h2>
            <div>
              <p className="newsletter__copy" id="newsletter-note">
                Every section of {site.name}, and everything published in it.
              </p>
              <div className="newsletter__form">
                <Link href="/all-post/" className="newsletter__btn">
                  Explore all stories &rarr;
                </Link>
              </div>
              <a className="newsletter__alt" href={`mailto:${site.publisher.email}`}>
                Have a story? Contact the newsdesk
              </a>
            </div>
          </div>
          <SectionWall categories={categories} />
        </div>
      </section>
    </>
  );
}

/**
 * Page 2 onward: a plain paginated river. No hero, no chips, no section
 * blocks — a reader this deep is working backwards through the archive.
 * Imported by app/page/[page]/page.tsx.
 */
export function ArchiveView({
  site,
  posts,
  page,
  totalPages,
}: {
  site: SiteConfig;
  posts: WPPost[];
  page: number;
  totalPages: number;
}) {
  const now = new Date();
  // A missing X-WP-TotalPages header reports 0; never print "page 2 of 0".
  const pages = Math.max(totalPages, page);

  return (
    <div className="container">
      {/* The archive owns no section, so the band falls back to the brand
          green — the same .cat-band the category pages colour-own. */}
      <header className="cat-band">
        <p className="kicker">Archive</p>
        <h1 className="cat-band__title mt-2">All stories</h1>
        <p className="cat-band__count">
          Page {page} of {pages}
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <StoryCard key={post.id} site={site} post={post} variant="standard" now={now} />
        ))}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={homePagePath}
        label="Archive pagination"
      />
    </div>
  );
}
