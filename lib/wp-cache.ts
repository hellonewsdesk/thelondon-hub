/**
 * Next-only caching wrappers.
 *
 * These live apart from lib/wp.ts on purpose. `next/cache` cannot be resolved
 * by plain Node — its package exports are bundler-only — and importing it from
 * the fetch layer would break `npm run smoke`, which runs the data layer
 * directly against the live API with no build step. Keeping lib/wp.ts free of
 * framework imports is what makes that recon script possible.
 *
 * Server components import getCategories from here; scripts import
 * getCategoriesUncached from lib/wp.ts.
 */

import { cachedJson } from './cached.ts';
import type { SiteConfig } from '../config/sites.ts';
import type { WPCategory } from '../types/wp.ts';
import { getCategoriesUncached } from './wp.ts';

const CATEGORIES_REVALIDATE_SECONDS = 86400;

/**
 * All non-empty categories, memoised.
 *
 * Worth caching beyond the fetch layer: 104 categories arrive across two
 * round trips, the nav asks for them on every render, and they change maybe
 * weekly. The key includes site.key so tenants never share an entry.
 *
 * cachedJson, not bare unstable_cache: every cache entry in this codebase is
 * size-asserted after the silent-2MB-refusal bug. See lib/cached.ts.
 */
export function getCategories(site: SiteConfig): Promise<WPCategory[]> {
  return cachedJson(
    () => getCategoriesUncached(site),
    ['wp-categories', site.key],
    {
      revalidate: CATEGORIES_REVALIDATE_SECONDS,
      tags: [`site:${site.key}`, `${site.key}:categories`],
    },
  )();
}
