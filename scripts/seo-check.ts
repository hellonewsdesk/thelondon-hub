/**
 * On-page SEO regression guard — `npm run seo:check`.
 *
 * Runs against a PRODUCTION server and reads the HTML that actually ships,
 * because the bugs this catches only exist after Next has composed metadata:
 * a title template applied twice, a canonical that lost its trailing slash, a
 * page that quietly ships two h1s. None of those are visible in the source.
 *
 * Usage:
 *   npm run build && npm run start
 *   npm run seo:check
 *   SEO_BASE_URL=http://localhost:3200 npm run seo:check
 *
 * URLs are discovered from the site's own feed and config, so the check keeps
 * working as content and tenants change. No hardcoded slugs.
 */

import { DEFAULT_SITE } from '../config/sites.ts';

const BASE = (process.env.SEO_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const site = DEFAULT_SITE;

/** Google truncates around here. Outside the range is a warning, not a fail. */
const TITLE_MIN = 15;
const TITLE_MAX = 65;
const DESC_MIN = 70;
const DESC_MAX = 165;

interface Problem {
  path: string;
  rule: string;
  message: string;
}

const errors: Problem[] = [];
const warnings: Problem[] = [];

const fail = (path: string, rule: string, message: string) =>
  errors.push({ path, rule, message });
const warn = (path: string, rule: string, message: string) =>
  warnings.push({ path, rule, message });

function decode(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ');
}

function allMatches(html: string, re: RegExp): string[] {
  return [...html.matchAll(re)].map((m) => decode(m[1].trim()));
}

/** How many times `needle` occurs in `haystack`, case-insensitively. */
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  const hay = haystack.toLowerCase();
  const pin = needle.toLowerCase();
  let count = 0;
  let index = 0;
  for (;;) {
    const at = hay.indexOf(pin, index);
    if (at === -1) return count;
    count += 1;
    index = at + pin.length;
  }
}

async function check(path: string, label: string): Promise<void> {
  const url = `${BASE}${path}`;
  let html: string;
  let status: number;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    status = res.status;
    html = await res.text();
  } catch (error) {
    fail(path, 'unreachable', `${label}: ${(error as Error).message}`);
    return;
  }

  if (status !== 200) {
    fail(path, 'status', `${label}: expected 200, got ${status}`);
    return;
  }

  const headEnd = html.indexOf('</head>');
  const head = headEnd === -1 ? html : html.slice(0, headEnd + 7);

  /* ---- title -------------------------------------------------------- */
  const titles = allMatches(head, /<title[^>]*>([\s\S]*?)<\/title>/gi);

  if (titles.length === 0) {
    fail(path, 'title-missing', `${label}: no title tag`);
  } else if (titles.length > 1) {
    fail(path, 'title-duplicate', `${label}: ${titles.length} title tags`);
  } else {
    const title = titles[0];

    // THE regression this script was written for. Next's title template
    // (`%s | Site`) appends the masthead; a page title that already carried
    // the site name produced "Thing | Site | Site". Any page composing its
    // own title must use `title.absolute` — see buildMetadata in lib/seo.ts.
    const nameCount = countOccurrences(title, site.name);
    if (nameCount > 1) {
      fail(
        path,
        'title-site-name-doubled',
        `${label}: "${title}" names the site ${nameCount} times. ` +
          'Use title.absolute instead of letting the layout template append it.',
      );
    }

    if (title.length > TITLE_MAX) {
      warn(
        path,
        'title-length',
        `${label}: title is ${title.length} chars (over ${TITLE_MAX}, will truncate)`,
      );
    } else if (title.length < TITLE_MIN) {
      warn(path, 'title-length', `${label}: title is only ${title.length} chars`);
    }
  }

  /* ---- meta description --------------------------------------------- */
  const descs = allMatches(
    head,
    /<meta[^>]+name="description"[^>]+content="([^"]*)"[^>]*>/gi,
  );

  if (descs.length === 0) {
    fail(path, 'description-missing', `${label}: no meta description`);
  } else if (descs.length > 1) {
    fail(path, 'description-duplicate', `${label}: ${descs.length} meta descriptions`);
  } else if (descs[0].length > DESC_MAX) {
    warn(
      path,
      'description-length',
      `${label}: description is ${descs[0].length} chars (over ${DESC_MAX})`,
    );
  } else if (descs[0].length < DESC_MIN) {
    warn(
      path,
      'description-length',
      `${label}: description is only ${descs[0].length} chars`,
    );
  }

  /* ---- canonical ----------------------------------------------------- */
  const canonicals = allMatches(
    head,
    /<link[^>]+rel="canonical"[^>]+href="([^"]*)"[^>]*>/gi,
  );

  if (canonicals.length !== 1) {
    fail(path, 'canonical', `${label}: ${canonicals.length} canonical links, expected 1`);
  } else {
    const canonical = canonicals[0];
    if (!canonical.startsWith('http')) {
      fail(path, 'canonical-relative', `${label}: canonical "${canonical}" is not absolute`);
    }
    const canonicalPath = canonical.startsWith('http')
      ? new URL(canonical).pathname
      : canonical;

    // Every live URL on this WP install carries a trailing slash (100/100
    // sampled posts, every page, every category — recon 2026-09-10). A
    // canonical without one points at a URL that 308s, which wastes the
    // signal.
    if (!canonicalPath.endsWith('/')) {
      fail(path, 'canonical-slash', `${label}: canonical "${canonical}" has no trailing slash`);
    }

    // Query-string result states must canonical back to the clean path so
    // they never compete with it.
    const expected = path.split('?')[0];
    if (canonicalPath !== expected) {
      warn(
        path,
        'canonical-target',
        `${label}: canonical points at ${canonicalPath}, page is ${expected}`,
      );
    }
  }

  /* ---- headings ------------------------------------------------------ */
  const h1s = allMatches(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi);
  if (h1s.length === 0) {
    fail(path, 'h1-missing', `${label}: no h1`);
  } else if (h1s.length > 1) {
    fail(path, 'h1-duplicate', `${label}: ${h1s.length} h1 tags`);
  }

  /* ---- metadata must be in head, never streamed into body ------------ */
  const bodyAt = html.indexOf('<body');
  if (bodyAt > -1) {
    const body = html.slice(bodyAt);
    if (/<title[^>]*>/i.test(body) || /rel="canonical"/i.test(body)) {
      fail(
        path,
        'metadata-in-body',
        `${label}: metadata streamed into body. htmlLimitedBots must match this UA.`,
      );
    }
  }

  console.log(`     ok   ${path.padEnd(48)} ${(titles[0] ?? '(none)').slice(0, 58)}`);
}

/* ---- URL discovery ----------------------------------------------------- */

async function discoverArticlePath(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/feed.xml`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const match = (await res.text()).match(/<item>[\s\S]*?<link>([^<]+)<\/link>/);
    return match ? new URL(match[1]).pathname : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  console.log('');
  console.log('  ON-PAGE SEO CHECK');
  console.log(`  ${'='.repeat(78)}`);
  console.log(`  base: ${BASE}   site: ${site.name}`);
  console.log('');

  const targets: Array<[string, string]> = [['/', 'homepage']];

  const firstSection = site.homepageSections[0];
  if (firstSection) {
    targets.push([`/category/${firstSection}/`, `category: ${firstSection}`]);
  }

  const article = await discoverArticlePath();
  if (article) {
    targets.push([article, 'article']);
  } else {
    warn('/feed.xml', 'discovery', 'could not discover an article from the feed');
  }

  // Real WP pages only (recon-verified). Never invent a path here — the
  // route truth check in next.config.ts enforces the same rule at build time.
  targets.push(['/about-us/', 'standing page']);
  targets.push(['/all-post/', 'all posts']);

  for (const [path, label] of targets) await check(path, label);

  console.log('');
  console.log(`  ${'='.repeat(78)}`);
  for (const w of warnings) console.log(`  WARN  [${w.rule}] ${w.message}`);

  if (errors.length > 0) {
    console.log('');
    console.log('  ##  SEO CHECK FAILED  ##');
    console.log('');
    for (const e of errors) console.log(`  FAIL  [${e.rule}] ${e.message}`);
    console.log('');
    process.exitCode = 1;
  } else {
    console.log(`  ${targets.length} URL(s) checked — no on-page SEO errors.`);
    console.log('');
  }
}

await main();
