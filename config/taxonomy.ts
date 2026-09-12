import type { SiteConfig } from './sites.ts';

/**
 * The target taxonomy — the categories each site actually KEEPS.
 *
 * Recon (2026-09-10) against the live install found nine categories with
 * real editorial depth plus a 32-post syndication meta-category
 * (google-news) and a long tail of thin categories. This file defines the
 * categories worth an index slot; everything else is `noindex, follow`
 * regardless of its count (see lib/seo.ts categoryRobots). google-news is
 * quarantined in config/category-overrides.ts — its URL resolves but it
 * never appears in nav, homepage blocks, sitemaps or any derived surface.
 *
 * This file does NOT merge anything. The merge plan lives in
 * data/category-merge-plan.json (produced by `npm run cat:audit`) and is
 * executed only after the publisher reviews it.
 *
 * Descriptions are 60–160 characters, written for the category page intro
 * and its meta description. Weight orders homepage blocks and any future
 * "browse" surfaces — higher first.
 */

export interface TaxonomyEntry {
  /** Must match the live WP category slug exactly (see data/wp-url-inventory.json). */
  slug: string;
  name: string;
  /** 60–160 chars; category page standfirst + meta description. */
  description: string;
  /** Ordering weight, higher = earlier. */
  weight: number;
  /** Slug of the parent entry, for sub-topics. */
  parent?: string;
  showInNav: boolean;
  /**
   * False for categories that do not exist in WordPress yet and must be
   * created by the publishing pipeline before they resolve. Pages for these
   * 404 until then — nothing is invented.
   */
  existsInWp?: boolean;
}

export const TAXONOMIES: Record<string, TaxonomyEntry[]> = {
  londonhub: [
    // All nine below are live WP categories, recon-verified 2026-09-10.
    // Post counts at recon are noted per entry; weights follow depth.
    {
      slug: 'uk-news', // 36 posts at recon
      name: 'UK News',
      description:
        'The national stories that matter — politics, public services, transport and the news shaping everyday life across the UK.',
      weight: 100,
      showInNav: true,
    },
    {
      slug: 'world-news', // 34 posts at recon
      name: 'World',
      description:
        'World news explained for UK readers — international events, conflicts, elections and economies, and why they matter here.',
      weight: 95,
      showInNav: true,
    },
    {
      slug: 'football', // 19 posts at recon
      name: 'Football',
      description:
        'Football coverage from the Premier League to the EFL — transfers, match reaction and the stories around London’s clubs.',
      weight: 90,
      showInNav: true,
    },
    {
      slug: 'technology', // 14 posts at recon
      name: 'Tech',
      description:
        'Technology news in plain English — gadgets, apps, AI and the digital changes reshaping how we live and work.',
      weight: 85,
      showInNav: true,
    },
    {
      slug: 'sports', // 11 posts at recon
      name: 'Sport',
      description:
        'Sport beyond the football pitch — cricket, rugby, tennis, boxing and athletics, the rest of the sporting week in one place.',
      weight: 80,
      showInNav: true,
    },
    {
      slug: 'entertainment', // 10 posts at recon
      name: 'Entertainment',
      description:
        'Entertainment news across film, TV, music and celebrity — what to watch, stream and talk about this week.',
      weight: 75,
      showInNav: true,
    },
    {
      slug: 'lifestyle', // 8 posts at recon
      name: 'Lifestyle',
      description:
        'Lifestyle features on food, homes, fashion, health and days out — practical reads for life in and around the capital.',
      weight: 70,
      showInNav: true,
    },
    {
      slug: 'business', // 6 posts at recon
      name: 'Business',
      description:
        'Business and money news — companies, markets, jobs and the economic decisions that reach your pocket.',
      weight: 65,
      showInNav: true,
    },
    {
      // 5 posts at recon: kept in the nav as a standing section, but too
      // thin for a homepage block (see homepageSections in config/sites.ts).
      slug: 'politics',
      name: 'Politics',
      description:
        'Politics from Westminster and City Hall — parties, policy and the decisions shaping the country and the capital.',
      weight: 60,
      showInNav: true,
    },
  ],
};

/** The kept taxonomy for a site. Empty array = no curation defined yet. */
export function getTaxonomy(site: SiteConfig): TaxonomyEntry[] {
  return TAXONOMIES[site.key] ?? [];
}

/** Fast membership test for index-hygiene decisions. */
export function taxonomySlugs(site: SiteConfig): Set<string> {
  return new Set(getTaxonomy(site).map((entry) => entry.slug));
}
