import type { CSSProperties } from 'react';
import { getSection } from '../config/sections';

/**
 * The section-colour pair as inline CSS custom properties.
 *
 * docs/DESIGN.md + globals.css contract: a block exposes its section colour
 * by setting BOTH `--section-light` and `--section-dark` inline; the rules in
 * globals.css recompute `var(--section)` per element and per theme from that
 * pair. NEVER set `--section` directly — an inline `--section` would override
 * the dark-theme remap on every descendant and lock dark mode to a
 * failing-contrast value.
 *
 * With no slug (post has no category) this returns an empty object and every
 * `var(--section)` consumer falls back to the brand accent.
 */
export type SectionStyleVars = CSSProperties & {
  '--section-light'?: string;
  '--section-dark'?: string;
};

export function sectionStyleVars(slug: string | null | undefined): SectionStyleVars {
  if (!slug) return {};
  const section = getSection(slug);
  return { '--section-light': section.light, '--section-dark': section.dark };
}
