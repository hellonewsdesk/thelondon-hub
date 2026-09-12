/**
 * Category audit — `npm run cat:audit`.
 *
 * Reads every category and every post's category assignments from the live
 * WordPress API, then reports:
 *   - all categories, count-descending, with their indexability under the
 *     current rules (curated taxonomy AND >= 3 posts)
 *   - near-duplicate slug pairs (plural variants, containment, edit distance)
 *   - for every category not in the kept taxonomy, the keeper categories its
 *     posts ALSO belong to — the evidence for a merge target
 *
 * and writes a machine-readable data/category-merge-plan.json.
 *
 * ██ THIS SCRIPT EXECUTES NOTHING. ██
 * The plan is a proposal for the publisher to review. Merges happen in
 * WordPress (and as redirects here) only after that review.
 *
 * Efficiency note: rather than querying each thin category individually
 * (recon found 104 non-empty categories, 70 with a single post — that would
 * be 70+ slow API calls), this pulls every post's id+categories in a couple
 * of paginated `_fields` requests (~12KB each) and computes all overlap
 * locally. Total runtime is a few seconds against an API where a single
 * embedded listing costs ten.
 */

import { DEFAULT_SITE } from '../config/sites.ts';
import { getTaxonomy } from '../config/taxonomy.ts';
import {
  MERGE_OVERRIDES,
  QUARANTINED,
  QUARANTINED_SLUGS,
  overrideFor,
} from '../config/category-overrides.ts';
import { getCategoriesUncached, getPosts } from '../lib/wp.ts';
import type { WPCategory } from '../types/wp.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------

interface MergeSuggestion {
  from: string;
  to: string;
  postCount: number;
  reason: 'duplicate-concept' | 'thin-category' | 'consolidate-non-keeper';
  /** Share of `from`'s posts already assigned to `to` (0–1, 2dp). */
  overlap: number;
  /**
   * True when a human corrected the target (config/category-overrides.ts).
   * Reviewed entries are authoritative — the heuristic never overrides them.
   */
  reviewed?: boolean;
  /** What the heuristic had proposed, kept so the correction is auditable. */
  heuristicProposed?: string;
  overrideReason?: string;
}

interface Unresolved {
  slug: string;
  count: number;
  note: string;
}

const MIN_INDEXABLE = 3;

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[] = Array.from({ length: rows * cols }, () => 0);
  for (let i = 0; i < rows; i += 1) d[i * cols] = i;
  for (let j = 0; j < cols; j += 1) d[j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i * cols + j] = Math.min(
        d[(i - 1) * cols + j] + 1,
        d[i * cols + (j - 1)] + 1,
        d[(i - 1) * cols + (j - 1)] + cost,
      );
    }
  }
  return d[rows * cols - 1];
}

/** Why two slugs look like the same concept, or null if they don't. */
function nearDuplicateReason(a: string, b: string): string | null {
  if (a === b) return null;
  if (a === `${b}s` || b === `${a}s`) return 'singular/plural';
  if (a.startsWith(`${b}-`) || a.endsWith(`-${b}`)) return `contains "${b}"`;
  if (b.startsWith(`${a}-`) || b.endsWith(`-${a}`)) return `contains "${a}"`;
  if (a.length >= 5 && b.length >= 5 && levenshtein(a, b) <= 2) {
    return `edit distance ${levenshtein(a, b)}`;
  }
  return null;
}

// ---------------------------------------------------------------------------

async function fetchAllPostCategories(): Promise<Map<number, number[]>> {
  const byPost = new Map<number, number[]>();
  let page = 1;

  for (;;) {
    const { posts } = await getPosts(DEFAULT_SITE, {
      perPage: 100,
      page,
      embed: false,
      fields: 'id,categories',
    });
    if (posts.length === 0) break;
    for (const post of posts) {
      byPost.set(post.id, post.categories ?? []);
    }
    if (posts.length < 100) break;
    page += 1;
  }

  return byPost;
}

async function main(): Promise<void> {
  const site = DEFAULT_SITE;
  const keepers = getTaxonomy(site).filter((t) => t.existsInWp !== false);
  const keeperSlugs = new Set(keepers.map((t) => t.slug));

  console.log('');
  console.log(`  CATEGORY AUDIT · ${site.hostname}`);
  console.log('  ' + '═'.repeat(74));

  const categories = await getCategoriesUncached(site);
  const byId = new Map<number, WPCategory>(categories.map((c) => [c.id, c]));
  const postCats = await fetchAllPostCategories();

  // posts per category + keeper co-occurrence per category
  const postsIn = new Map<number, number>();
  const coKeeper = new Map<number, Map<number, number>>();

  for (const catIds of postCats.values()) {
    for (const id of catIds) {
      postsIn.set(id, (postsIn.get(id) ?? 0) + 1);
    }
    const keepersHere = catIds.filter((id) => {
      const cat = byId.get(id);
      return cat !== undefined && keeperSlugs.has(cat.slug);
    });
    for (const id of catIds) {
      let co = coKeeper.get(id);
      if (!co) {
        co = new Map<number, number>();
        coKeeper.set(id, co);
      }
      for (const k of keepersHere) {
        if (k === id) continue;
        co.set(k, (co.get(k) ?? 0) + 1);
      }
    }
  }

  const sorted = [...categories].sort((a, b) => b.count - a.count);

  // ---- 1. Full table ------------------------------------------------------
  console.log('');
  console.log('  1. ALL CATEGORIES (count desc)');
  console.log('  ' + '─'.repeat(74));
  console.log(`  ${'count'.padStart(5)}  ${'slug'.padEnd(30)} ${'kept'.padEnd(5)} indexable`);
  let indexable = 0;
  for (const cat of sorted) {
    const kept = keeperSlugs.has(cat.slug);
    const idx = kept && cat.count >= MIN_INDEXABLE;
    if (idx) indexable += 1;
    console.log(
      `  ${String(cat.count).padStart(5)}  ${cat.slug.slice(0, 29).padEnd(30)} ${
        kept ? 'yes' : '·'
      }${kept ? '' : '  '}  ${idx ? 'INDEX' : 'noindex'}`,
    );
  }
  console.log('  ' + '─'.repeat(74));
  console.log(
    `  ${categories.length} categories · ${indexable} indexable · ${
      categories.length - indexable
    } noindexed under current rules`,
  );

  // ---- 2. Near-duplicate pairs --------------------------------------------
  console.log('');
  console.log('  2. NEAR-DUPLICATE SLUG PAIRS');
  console.log('  ' + '─'.repeat(74));
  const dupPairs: { small: WPCategory; big: WPCategory; why: string }[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const why = nearDuplicateReason(sorted[i].slug, sorted[j].slug);
      if (!why) continue;
      // sorted is count-desc, so [i] is the bigger of the pair.
      dupPairs.push({ big: sorted[i], small: sorted[j], why });
    }
  }
  for (const pair of dupPairs) {
    console.log(
      `  ${pair.small.slug.padEnd(28)} → ${pair.big.slug.padEnd(24)} (${pair.why}; ${pair.small.count} vs ${pair.big.count} posts)`,
    );
  }
  console.log(`  ${dupPairs.length} pairs found`);

  // ---- 3. Merge plan -------------------------------------------------------
  const merges: MergeSuggestion[] = [];
  const unresolved: Unresolved[] = [];
  const planned = new Set<string>();

  const bySlug = new Map<string, WPCategory>(categories.map((c) => [c.slug, c]));

  const suggest = (
    from: WPCategory,
    to: WPCategory,
    reason: MergeSuggestion['reason'],
  ) => {
    if (planned.has(from.slug)) return;

    // Quarantined categories are never merged — folding the google-news
    // syndication bucket or WordPress's Uncategorized into a promoted keeper
    // is the exact opposite of what consolidation is for.
    if (QUARANTINED_SLUGS.has(from.slug)) return;

    planned.add(from.slug);

    // A reviewed correction beats the heuristic, always.
    const override = overrideFor(from.slug);
    const target = override ? (bySlug.get(override.to) ?? to) : to;

    const co = coKeeper.get(from.id)?.get(target.id) ?? 0;
    merges.push({
      from: from.slug,
      to: target.slug,
      postCount: from.count,
      reason,
      overlap: from.count > 0 ? Number((co / from.count).toFixed(2)) : 0,
      ...(override
        ? {
            reviewed: true,
            heuristicProposed: override.wasProposed,
            overrideReason: override.reason,
          }
        : {}),
    });
  };

  // 3a. Duplicate-concept: a non-keeper that near-duplicates a keeper.
  for (const pair of dupPairs) {
    const [keeper, other] = keeperSlugs.has(pair.big.slug)
      ? [pair.big, pair.small]
      : keeperSlugs.has(pair.small.slug)
        ? [pair.small, pair.big]
        : [null, null];
    if (!keeper || !other || keeperSlugs.has(other.slug)) continue;
    suggest(other, keeper, 'duplicate-concept');
  }

  // 3b/3c. Every remaining non-keeper: merge into its strongest co-occurring
  // keeper, when the overlap evidence is real.
  for (const cat of sorted) {
    if (keeperSlugs.has(cat.slug) || planned.has(cat.slug)) continue;
    if (QUARANTINED_SLUGS.has(cat.slug)) continue;

    // A reviewed override is authoritative even where the heuristic found no
    // evidence at all — that is the whole point of the human pass.
    const override = overrideFor(cat.slug);
    if (override) {
      const target = bySlug.get(override.to);
      if (target) {
        suggest(cat, target, 'consolidate-non-keeper');
        continue;
      }
    }

    const co = coKeeper.get(cat.id);
    let best: { id: number; n: number } | null = null;
    if (co) {
      for (const [kId, n] of co) {
        if (!best || n > best.n) best = { id: kId, n };
      }
    }

    const target = best ? byId.get(best.id) : undefined;
    const overlap = best && cat.count > 0 ? best.n / cat.count : 0;

    if (target && overlap >= 0.5) {
      suggest(cat, target, cat.count < MIN_INDEXABLE ? 'thin-category' : 'consolidate-non-keeper');
    } else {
      unresolved.push({
        slug: cat.slug,
        count: cat.count,
        note: target
          ? `weak signal: only ${Math.round(overlap * 100)}% of its posts co-assigned to "${target.slug}" — pick a target manually`
          : 'no keeper co-occurrence at all — pick a target manually or delete',
      });
    }
  }

  console.log('');
  console.log('  3. MERGES (' + merges.length + ' — ✎ = human-corrected target)');
  console.log('  ' + '─'.repeat(74));
  for (const m of merges) {
    const mark = m.reviewed ? '✎' : ' ';
    const was = m.reviewed ? `  (heuristic said "${m.heuristicProposed}")` : '';
    console.log(
      `  ${mark} ${m.from.padEnd(28)} → ${m.to.padEnd(16)} ${String(m.postCount).padStart(3)}p  ${String(Math.round(m.overlap * 100)).padStart(3)}%${was}`,
    );
  }

  console.log('');
  console.log('  3b. QUARANTINED — never merged, never promoted (' + QUARANTINED.length + ')');
  console.log('  ' + '─'.repeat(74));
  for (const q of QUARANTINED) {
    const cat = bySlug.get(q.slug);
    console.log(`  ${q.slug.padEnd(28)} ${String(cat?.count ?? 0).padStart(3)}p  ${q.reason.slice(0, 76)}`);
  }

  console.log('');
  console.log('  4. UNRESOLVED — need a human decision (' + unresolved.length + ')');
  console.log('  ' + '─'.repeat(74));
  for (const u of unresolved.slice(0, 20)) {
    console.log(`  ${u.slug.padEnd(30)} ${String(u.count).padStart(3)} posts  ${u.note}`);
  }
  if (unresolved.length > 20) console.log(`  … and ${unresolved.length - 20} more in the JSON`);

  // ---- Write the plan ------------------------------------------------------
  const plan = {
    site: site.hostname,
    generatedAt: new Date().toISOString(),
    status: 'proposed',
    note:
      'PROPOSAL — awaiting publisher review. Nothing here is executed: merges ' +
      'happen in WordPress (and as redirects in this app) only after that ' +
      'review, and this repo never edits WordPress. Targets marked ' +
      '`reviewed: true` were corrected by hand in ' +
      'config/category-overrides.ts and are authoritative — the heuristic ' +
      'never overrides them. `overlap` = share of the source category’s ' +
      'posts already assigned to the target. Once reviewed, this file drives ' +
      'the 308 redirects generated in config/redirects.ts.',
    keepers: [...keeperSlugs].sort(),
    merges,
    quarantined: QUARANTINED.map((q) => ({
      ...q,
      postCount: bySlug.get(q.slug)?.count ?? 0,
    })),
    unresolved,
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = join(here, '..', 'data', 'category-merge-plan.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(plan, null, 2) + '\n');

  const reviewedCount = merges.filter((m) => m.reviewed).length;

  console.log('');
  console.log('  ' + '═'.repeat(74));
  console.log('  Plan written to data/category-merge-plan.json');
  console.log(
    `  ${merges.length} merges (${reviewedCount} human-corrected) · ` +
      `${QUARANTINED.length} quarantined · ${unresolved.length} left unmerged`,
  );
  console.log('');
  console.log('  ██  This repo NEVER edits WordPress. Merges are executed in     ██');
  console.log('  ██  WordPress after publisher review; this file only ever       ██');
  console.log('  ██  drives the redirects.                                       ██');
  console.log('');

  // Fail loudly if a reviewed override names a category that no longer
  // exists — a silently-dropped correction is exactly what the review was
  // meant to prevent.
  const missing = MERGE_OVERRIDES.filter(
    (o) => !bySlug.has(o.from) || !bySlug.has(o.to),
  );
  if (missing.length > 0) {
    console.error('  OVERRIDE ERROR — these reviewed corrections reference');
    console.error('  categories that do not exist in WordPress:');
    for (const o of missing) {
      const which = !bySlug.has(o.from) ? o.from : o.to;
      console.error(`    ${o.from} → ${o.to}   (missing: ${which})`);
    }
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(`  cat:audit failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
