/**
 * URL truth source — `npm run urls:fetch`.
 *
 * Pulls every published URL from the live WordPress install into
 * `data/wp-url-inventory.json`. That file is the ground truth the build-time
 * route assertion in next.config.ts checks against: a static route this app
 * serves must either exist here (it mirrors a real WP URL) or be declared in
 * config/route-allowlist.ts as a deliberate, reviewed addition.
 *
 * Exists because the sibling project once shipped /about/, /contact/ and
 * /terms/ while the live site's real pages were /about-us/, /contact-us/ and
 * /terms-conditions/ — invented paths that would have 404'd indexed URLs and
 * split link equity. This site's live pages are the same shape (/about-us/,
 * /contact-us/, /terms-conditions/, /privacy-policy/, /disclaimer/,
 * /all-post/ — recon-verified 2026-09-10). Never guess again by accident.
 *
 * Commit the JSON. Re-run whenever WP pages change.
 */

import { DEFAULT_SITE } from '../config/sites.ts';
import { getAllPostSlugs, getCategoriesUncached, wp } from '../lib/wp.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface WPPageRef {
  slug: string;
  link: string;
}

function pathOf(link: string): string | null {
  try {
    const { pathname } = new URL(link);
    return pathname.endsWith('/') ? pathname : `${pathname}/`;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const site = DEFAULT_SITE;
  console.log('');
  console.log(`  WP URL INVENTORY · ${site.hostname}`);
  console.log('  ' + '─'.repeat(60));

  // ---- Pages -------------------------------------------------------------
  const { data: pages } = await wp<WPPageRef[]>(
    site,
    '/pages?per_page=100&_fields=slug,link',
  );
  const pagePaths = pages
    .map((p) => pathOf(p.link))
    .filter((p): p is string => p !== null)
    .sort();
  console.log(`  pages      : ${pagePaths.length}`);

  // ---- Categories --------------------------------------------------------
  const categories = await getCategoriesUncached(site);
  const categoryPaths = categories
    .map((c) => pathOf(c.link))
    .filter((p): p is string => p !== null)
    .sort();
  console.log(`  categories : ${categoryPaths.length}`);

  // ---- Posts -------------------------------------------------------------
  const slugs = await getAllPostSlugs(site);
  const postPaths = slugs.map((s) => `/${s.slug}/`).sort();
  console.log(`  posts      : ${postPaths.length}`);

  const inventory = {
    host: site.hostname,
    fetchedAt: new Date().toISOString(),
    note:
      'Ground truth of live WordPress URLs. Static routes served by this app ' +
      'must exist here or in config/route-allowlist.ts — asserted at build ' +
      'time by next.config.ts.',
    pages: pagePaths,
    categories: categoryPaths,
    posts: postPaths,
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = join(here, '..', 'data', 'wp-url-inventory.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(inventory, null, 2) + '\n');

  console.log('  ' + '─'.repeat(60));
  console.log(`  written    : data/wp-url-inventory.json`);
  console.log('');
}

main().catch((err: unknown) => {
  console.error(`  urls:fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
