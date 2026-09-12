/**
 * TTFB regression guard — `npm run perf:check`.
 *
 * Exists because a silent cache failure once gave a homepage on this network
 * an 8.5-second TTFB while every other route served in 15ms, and nothing in
 * the toolchain said a word. This makes response time part of acceptance: it
 * hits the homepage, a live article and a category on a PRODUCTION server,
 * warm, and fails the run if any median exceeds the budget.
 *
 * Usage:
 *   npm run build && npm run start      (or the .next-verify pattern)
 *   npm run perf:check                  (defaults to http://localhost:3000)
 *   PERF_BASE_URL=http://localhost:3200 npm run perf:check
 *
 * No hardcoded slugs: the article URL is discovered from the site's own RSS
 * feed and the category from the first configured homepage section, so the
 * check keeps working as content and tenants change.
 */

import { DEFAULT_SITE } from '../config/sites.ts';

const BASE = (process.env.PERF_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/** Warm-response budget. Anything over this is a regression, not a blip. */
const BUDGET_MS = 200;

/** Measured passes per URL after one warming request. */
const PASSES = 3;

interface Result {
  label: string;
  path: string;
  status: number;
  medianMs: number;
  passes: number[];
  ok: boolean;
}

async function timeOnce(url: string): Promise<{ ms: number; status: number }> {
  const started = performance.now();
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  // Consume the body so keep-alive reuse doesn't skew later passes.
  await res.arrayBuffer();
  return { ms: performance.now() - started, status: res.status };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** First article path, straight from the feed the site itself publishes. */
async function discoverArticlePath(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/feed.xml`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const xml = await res.text();
    const match = xml.match(/<item>[\s\S]*?<link>([^<]+)<\/link>/);
    if (!match) return null;
    const url = new URL(match[1]);
    return url.pathname;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  console.log('');
  console.log(`  PERF CHECK · ${BASE} · budget ${BUDGET_MS}ms warm`);
  console.log('  ' + '─'.repeat(66));

  const categorySlug = DEFAULT_SITE.homepageSections[0];
  const articlePath = await discoverArticlePath();

  const targets: { label: string; path: string }[] = [
    { label: 'homepage', path: '/' },
    ...(articlePath ? [{ label: 'article', path: articlePath }] : []),
    ...(categorySlug
      ? [{ label: 'category', path: `/category/${categorySlug}/` }]
      : []),
  ];

  if (!articlePath) {
    console.log('  WARN could not discover an article from /feed.xml — measuring without one');
  }

  const results: Result[] = [];

  for (const target of targets) {
    const url = BASE + target.path;

    // Warming pass: fills ISR/data caches so we measure the steady state,
    // which is what real readers get and what the budget is about.
    const warm = await timeOnce(url);
    if (warm.status !== 200) {
      results.push({
        ...target,
        status: warm.status,
        medianMs: warm.ms,
        passes: [],
        ok: false,
      });
      continue;
    }

    const passes: number[] = [];
    for (let i = 0; i < PASSES; i += 1) {
      const { ms } = await timeOnce(url);
      passes.push(ms);
    }

    const med = median(passes);
    results.push({
      ...target,
      status: 200,
      medianMs: med,
      passes,
      ok: med <= BUDGET_MS,
    });
  }

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed += 1;
    const detail =
      r.status === 200
        ? `${r.medianMs.toFixed(0).padStart(5)}ms median  (${r.passes.map((p) => p.toFixed(0)).join(' / ')}ms)`
        : `HTTP ${r.status}`;
    console.log(
      `  ${r.ok ? 'PASS' : 'FAIL'}  ${r.label.padEnd(10)} ${r.path.padEnd(40).slice(0, 40)} ${detail}`,
    );
  }

  console.log('  ' + '─'.repeat(66));
  if (failed > 0) {
    console.log(`  ${failed} route(s) over the ${BUDGET_MS}ms warm budget.`);
    console.log('  A warm route this slow usually means a cache is silently failing —');
    console.log('  check the server log for cachedJson warnings and "over 2MB" lines.');
    process.exitCode = 1;
  } else {
    console.log(`  All ${results.length} routes inside the ${BUDGET_MS}ms budget.`);
  }
  console.log('');
}

main().catch((err: unknown) => {
  console.error(`  perf:check failed to run: ${err instanceof Error ? err.message : String(err)}`);
  console.error(`  Is a production server listening at ${BASE}?`);
  process.exitCode = 1;
});
