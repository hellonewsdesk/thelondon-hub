/**
 * Human review decisions for the category merge plan.
 *
 * `scripts/category-audit.ts` proposes merges from slug similarity and
 * co-occurrence. That heuristic has known failure modes, caught during
 * review on the sibling Birmingham build — keep them in mind when the
 * London audit runs:
 *
 *   A. Word containment ≠ same topic (american-football → football would
 *      poison the strongest category's topic signal).
 *   B. For a single-post category the "100% overlap" target is just
 *      whatever else that one post happened to be tagged with — an
 *      artefact, not a relationship.
 *   C. A tighter keeper may exist than the proposed parent.
 *   D. The publisher may reverse a proposal outright (e.g. keeping the
 *      shorter, stronger slug even though it holds fewer posts).
 *
 * These overrides are the reviewed corrections. They live in code, not in
 * the generated JSON, so re-running the audit can never silently discard
 * them. Every entry states why.
 */

export interface MergeOverride {
  /** Source category slug. */
  from: string;
  /** Corrected target, replacing whatever the heuristic proposed. */
  to: string;
  /** What the heuristic proposed, kept so the diff is auditable. */
  wasProposed: string;
  reason: string;
}

/**
 * Corrections to the proposed targets.
 *
 * Empty until `npm run cat:audit` has been run against the London install
 * and the publisher has reviewed its proposals. Do not pre-invent merges:
 * every entry must correct a real, generated proposal.
 */
export const MERGE_OVERRIDES: MergeOverride[] = [];

export interface QuarantinedCategory {
  slug: string;
  reason: string;
}

/**
 * Categories that must NEVER be merged and never carry a live signal.
 *
 * They keep their URLs — inbound links may exist — but stay `noindex, follow`
 * permanently, out of the nav and out of every sitemap. They are excluded
 * from the merge plan entirely: folding them into a keeper would push their
 * content into a category we do promote, which is the opposite of the point.
 */
export const QUARANTINED: QuarantinedCategory[] = [
  {
    slug: 'google-news',
    reason:
      'Syndication meta-category (32 of 105 posts at recon, 2026-09-10) ' +
      'that duplicates stories already filed under their real sections. ' +
      'Promoting or merging it would surface duplicates in nav, homepage ' +
      'and sitemaps. /category/google-news/ stays reachable but is never ' +
      'promoted and never indexed.',
  },
];

export const QUARANTINED_SLUGS = new Set(QUARANTINED.map((q) => q.slug));

/** Corrected target for a slug, or null when the heuristic stands. */
export function overrideFor(slug: string): MergeOverride | null {
  return MERGE_OVERRIDES.find((o) => o.from === slug) ?? null;
}
