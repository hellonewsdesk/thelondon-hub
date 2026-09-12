/**
 * Section colour registry — one colour per curated section.
 *
 * The single source of truth for the colour-coded-sections rule in
 * docs/DESIGN.md: a section's colour appears on its kicker text, its section
 * rule, its active nav state and its chip — never as a background behind
 * body copy (the colour-block card is the one sanctioned colour plane, and
 * it carries only white display text).
 *
 * Values are copied EXACTLY from the DESIGN.md table and are WCAG-verified
 * (script-checked 2026-09-10): every `light` value clears 4.5:1 on #FFFFFF
 * and every `dark` value clears 4.5:1 on #121212. Do not introduce new
 * colour pairs here without re-checking contrast.
 *
 * Slugs are recon-real category slugs on the live WP install — never
 * invented. Components consume this via CSS custom properties per block
 * (e.g. style={{ '--section': … }}) so they stay generic.
 */

export interface SectionStyle {
  /** Live WP category slug (see config/taxonomy.ts). */
  slug: string;
  /** Curated display name, matching the nav label in config/sites.ts. */
  name: string;
  /** Hex colour used on the light content well (#FFFFFF). ≥4.5:1. */
  light: string;
  /** Hex colour used on the dark content well (#121212). ≥4.5:1. */
  dark: string;
}

/**
 * Fallback colours for any category outside the curated set: the brand
 * accent greens (--accent in each theme). Matching the DESIGN.md rule
 * "Fallback for any other category: --accent".
 */
export const SECTION_FALLBACK_LIGHT = '#047857';
export const SECTION_FALLBACK_DARK = '#34D399';

/** In DESIGN.md table order. Iterable for the homepage chip rail. */
export const SECTIONS: SectionStyle[] = [
  { slug: 'uk-news', name: 'UK News', light: '#047857', dark: '#34D399' },
  { slug: 'world-news', name: 'World', light: '#1D4ED8', dark: '#60A5FA' },
  { slug: 'football', name: 'Football', light: '#6D28D9', dark: '#A78BFA' },
  { slug: 'sports', name: 'Sport', light: '#C2410C', dark: '#FB923C' },
  { slug: 'technology', name: 'Tech', light: '#0E7490', dark: '#22D3EE' },
  { slug: 'entertainment', name: 'Entertainment', light: '#BE185D', dark: '#F472B6' },
  { slug: 'lifestyle', name: 'Lifestyle', light: '#B45309', dark: '#FBBF24' },
  { slug: 'business', name: 'Business', light: '#4338CA', dark: '#818CF8' },
  { slug: 'politics', name: 'Politics', light: '#B91C1C', dark: '#F87171' },
];

const BY_SLUG = new Map(SECTIONS.map((section) => [section.slug, section]));

/**
 * The section style for a category slug.
 *
 * Unknown slugs get the brand-accent green fallback. In the fallback the
 * `name` field echoes the slug verbatim — display names for uncurated
 * categories must come from the WP category data (category.name), never be
 * invented here; callers rendering a label should prefer the WP name and
 * use this registry for colour only.
 */
export function getSection(slug: string): SectionStyle {
  return (
    BY_SLUG.get(slug) ?? {
      slug,
      name: slug,
      light: SECTION_FALLBACK_LIGHT,
      dark: SECTION_FALLBACK_DARK,
    }
  );
}
