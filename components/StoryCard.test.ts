import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StoryCard } from './StoryCard';
import { DEFAULT_SITE } from '@/config/sites';
import type { WPPost } from '@/types/wp';

/**
 * Guards the card contract from docs/DESIGN.md § Cards:
 *
 *   1. "Never render the headline twice (regression-guarded)" — the headline
 *      appears exactly ONCE in the markup of every variant, with and without
 *      an image. That includes aria-label/title-attribute duplication: a
 *      second copy anywhere is announced twice by screen readers and is the
 *      regression this file exists to catch.
 *   2. "The whole card is one link (stretched-link pattern) with the
 *      headline as the accessible name" — exactly one <a> per card.
 *   3. No image → the colour-block card (section-colour plane, Anton
 *      headline), never an <img>, never an empty grey frame.
 *   4. Image present → the real featured image renders.
 *
 * Written with createElement rather than JSX so the test has no dependency
 * on any transformer's JSX configuration.
 */

const NOW = new Date('2026-09-10T12:00:00Z');
const HEADLINE = 'Distinctive Test Headline Zq';

function post(overrides: Partial<WPPost>): WPPost {
  return {
    id: 1,
    slug: 'test-story',
    link: 'https://example.invalid/test-story/',
    date: '2026-09-10T09:00:00',
    modified: '2026-09-10T09:00:00',
    title: { rendered: HEADLINE },
    excerpt: { rendered: '<p>Excerpt copy for the card.</p>' },
    content: { rendered: '' },
    ...overrides,
  };
}

const withImage = post({
  featured_media: 99,
  _embedded: {
    'wp:featuredmedia': [
      {
        id: 99,
        source_url: 'https://example.invalid/wp-content/uploads/pic.jpg',
        alt_text: 'A real photo',
        media_details: { width: 1200, height: 800 },
      },
    ],
  },
});

const withoutImage = post({ id: 2, slug: 'imageless-story', featured_media: 0 });

/** All variants named in docs/DESIGN.md § Cards. */
const VARIANTS = ['hero', 'feature', 'standard', 'compact', 'text'] as const;
type Variant = (typeof VARIANTS)[number];

function render(p: WPPost, variant: Variant): string {
  return renderToStaticMarkup(
    createElement(StoryCard, {
      site: DEFAULT_SITE,
      post: p,
      variant,
      now: NOW,
    }),
  );
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = 0;
  for (;;) {
    const at = haystack.indexOf(needle, index);
    if (at === -1) return count;
    count += 1;
    index = at + needle.length;
  }
}

describe('StoryCard headline contract', () => {
  it.each(VARIANTS)(
    'renders the headline exactly once in the %s variant (image present)',
    (variant: Variant) => {
      expect(countOccurrences(render(withImage, variant), HEADLINE)).toBe(1);
    },
  );

  it.each(VARIANTS)(
    'renders the headline exactly once in the %s variant (no image)',
    (variant: Variant) => {
      expect(countOccurrences(render(withoutImage, variant), HEADLINE)).toBe(1);
    },
  );
});

describe('StoryCard media selection', () => {
  it('uses the real featured image when one exists', () => {
    expect(render(withImage, 'standard')).toContain('pic.jpg');
  });

  it('renders no <img> for an imageless post — the colour-block card, not a frame', () => {
    expect(render(withoutImage, 'standard')).not.toContain('<img');
  });
});

describe('StoryCard stretched-link contract', () => {
  it.each(VARIANTS)('the whole %s card is exactly one link', (variant: Variant) => {
    expect(countOccurrences(render(withImage, variant), '<a ')).toBe(1);
  });
});
