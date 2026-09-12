import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getTaxonomy, TAXONOMIES } from './taxonomy.ts';
import { QUARANTINED_SLUGS } from './category-overrides.ts';

/**
 * Category redirects, generated from the approved merge plan at build time.
 *
 * Generated rather than hand-listed so the redirects can never drift from
 * `data/category-merge-plan.json` — edit the plan (or the reviewed overrides
 * behind it), re-run `npm run cat:audit`, and the redirects follow.
 *
 * London has no approved merge plan yet, so this generates ZERO redirects
 * (with a console warning) until `npm run cat:audit` has been run against
 * the live install and the publisher has reviewed the result. The mechanism
 * and its guards are kept in full so that day needs no new code.
 *
 * Every merged category gets a permanent 308 from `/category/<old>/` to
 * `/category/<new>/`, trailing slashes on both sides to match the site-wide
 * convention and the already-indexed post URLs (recon 2026-09-10: all
 * sampled URLs carry a trailing slash).
 *
 * NOTE: this only redirects the frontend. The merges themselves happen in
 * WordPress, executed by the publishing pipeline. Until they do, the source
 * categories still hold posts and this redirect simply sends readers and
 * crawlers to the destination we intend to consolidate into — which is the
 * correct behaviour either way.
 */

export interface RedirectRule {
  source: string;
  destination: string;
  permanent: true;
}

interface MergePlan {
  merges: { from: string; to: string }[];
}

/** Slugs this app serves as live category routes — a redirect must never shadow one. */
function liveCategorySlugs(): Set<string> {
  const slugs = new Set<string>();
  for (const key of Object.keys(TAXONOMIES)) {
    for (const entry of TAXONOMIES[key]) slugs.add(entry.slug);
  }
  return slugs;
}

export function categoryRedirects(): RedirectRule[] {
  const planPath = join(process.cwd(), 'data', 'category-merge-plan.json');
  if (!existsSync(planPath)) {
    console.warn(
      '\nREDIRECTS: data/category-merge-plan.json is missing — no category ' +
        'redirects generated this build. Run `npm run cat:audit`.\n',
    );
    return [];
  }

  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as MergePlan;
  const live = liveCategorySlugs();
  const rules: RedirectRule[] = [];
  const seen = new Set<string>();

  for (const merge of plan.merges) {
    // ---- Guards. Each of these would be a live bug, so they throw. ------

    // 1. A redirect source that is also a live route would shadow the page:
    //    the route would become unreachable and its content would vanish
    //    from the site with no error anywhere.
    if (live.has(merge.from)) {
      throw new Error(
        `REDIRECT COLLISION: /category/${merge.from}/ is BOTH a merge source ` +
          `and a live category in config/taxonomy.ts. The redirect would shadow ` +
          `the real page. Remove it from the taxonomy or from the merge plan.`,
      );
    }

    // 2. Redirecting to a slug we do not serve produces a 308 into a 404.
    if (!live.has(merge.to)) {
      throw new Error(
        `REDIRECT TARGET MISSING: merge "${merge.from}" → "${merge.to}", but ` +
          `"${merge.to}" is not in config/taxonomy.ts, so the redirect would ` +
          `land on a page this app does not serve.`,
      );
    }

    // 3. Quarantined categories keep their URLs — never redirected away.
    if (QUARANTINED_SLUGS.has(merge.from)) {
      throw new Error(
        `QUARANTINED CATEGORY IN MERGE PLAN: "${merge.from}" must never be ` +
          `merged (see config/category-overrides.ts). Its URL stays reachable ` +
          `and unpromoted.`,
      );
    }

    // 4. Duplicate sources would make the winner arbitrary.
    if (seen.has(merge.from)) {
      throw new Error(
        `DUPLICATE REDIRECT SOURCE: /category/${merge.from}/ appears twice in ` +
          `the merge plan.`,
      );
    }
    seen.add(merge.from);

    rules.push({
      source: `/category/${merge.from}/`,
      destination: `/category/${merge.to}/`,
      permanent: true,
    });
    // trailingSlash rewrites /x -> /x/ BEFORE redirects run, so an
    // unslashed-only source would never match. Both forms are needed.
    rules.push({
      source: `/category/${merge.from}`,
      destination: `/category/${merge.to}/`,
      permanent: true,
    });
  }

  // 5. No chains: A→B→C costs an extra hop and dilutes the signal. Every
  //    destination must be terminal.
  for (const rule of rules) {
    const destSlug = rule.destination.replace(/^\/category\/|\/$/g, '');
    if (seen.has(destSlug)) {
      throw new Error(
        `REDIRECT CHAIN: "${rule.source}" points at "${destSlug}", which is ` +
          `itself redirected elsewhere. Flatten the plan so every destination ` +
          `is final.`,
      );
    }
  }

  return rules;
}

/** Count for the build report. */
export function redirectSummary(): { generated: number; sources: number } {
  const rules = categoryRedirects();
  return { generated: rules.length, sources: rules.length / 2 };
}

export { getTaxonomy };
