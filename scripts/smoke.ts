/**
 * Recon script — `npm run smoke`.
 *
 * Hits the live WP REST API for a site from config/sites.ts and reports what
 * the templates will actually have to deal with: auth, volume, permalink
 * shape, page-builder contamination, taxonomy, media coverage.
 *
 * Usage:
 *   npm run smoke                          # DEFAULT_SITE
 *   npm run smoke -- example.co.uk         # any hostname in the registry
 *
 * Runs on plain Node via native TypeScript stripping. No build step.
 */

import { DEFAULT_SITE, SITES, getSiteByHost, allSites } from '../config/sites.ts';
import type { SiteConfig } from '../config/sites.ts';
import { ARTICLE_FIELDS, getPosts, getCategoriesUncached, wp, WPError } from '../lib/wp.ts';
import {
  excerptText,
  getAuthor,
  getFeaturedImage,
  getPrimaryCategory,
  getTags,
  postTitle,
  readingTime,
} from '../lib/wp-helpers.ts';
import type { WPPost } from '../types/wp.ts';

/** Trimmed post shape used for the cheap wide sample (`_fields`, no `_embed`). */
interface LinkRef {
  link: string;
  slug: string;
  featured_media?: number;
}

// --- tiny presentation helpers ---------------------------------------------

const useColour = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: string, s: string) => (useColour ? `[${code}m${s}[0m` : s);
const bold = (s: string) => c('1', s);
const dim = (s: string) => c('2', s);
const green = (s: string) => c('32', s);
const red = (s: string) => c('31', s);
const yellow = (s: string) => c('33', s);
const cyan = (s: string) => c('36', s);

const WIDTH = 74;

function rule(char = '─') {
  console.log(dim(char.repeat(WIDTH)));
}

function heading(title: string) {
  console.log('');
  console.log(bold(cyan(title)));
  rule();
}

function kv(label: string, value: string) {
  console.log(`  ${label.padEnd(22)} ${value}`);
}

const PASS = () => green('PASS');
const FAIL = () => red('FAIL');

// --- builder-markup detection ----------------------------------------------

/** Markers that mean the body HTML is not portable plain content. */
const BUILDER_MARKERS = {
  elementor: ['elementor-element', 'elementor-widget', '[elementor', 'elementor-section', 'data-elementor'],
  gutenberg: ['wp-block-'],
} as const;

type Verdict = 'CLEAN' | 'ELEMENTOR-WRAPPED' | 'GUTENBERG';

function classifyContent(html: string): { verdict: Verdict; hits: string[] } {
  const elementorHits = BUILDER_MARKERS.elementor.filter((m) => html.includes(m));
  const gutenbergHits = BUILDER_MARKERS.gutenberg.filter((m) => html.includes(m));

  if (elementorHits.length > 0) {
    return { verdict: 'ELEMENTOR-WRAPPED', hits: [...elementorHits, ...gutenbergHits] };
  }
  if (gutenbergHits.length > 0) return { verdict: 'GUTENBERG', hits: gutenbergHits };
  return { verdict: 'CLEAN', hits: [] };
}

function paintVerdict(v: Verdict): string {
  if (v === 'CLEAN') return green(bold('CLEAN'));
  if (v === 'GUTENBERG') return yellow(bold('GUTENBERG'));
  return red(bold('ELEMENTOR-WRAPPED'));
}

/** Tag histogram, so we know which elements the article CSS must style. */
function tagHistogram(html: string): string {
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/<([a-z][a-z0-9]*)\b/gi)) {
    const tag = m[1].toLowerCase();
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag, n]) => `${tag}×${n}`)
    .join(' ');
}

/** Infer the permalink template from a real WP link. */
function describePermalink(site: SiteConfig, link: string): { pattern: string; note: string } {
  let path: string;
  try {
    path = new URL(link).pathname;
  } catch {
    return { pattern: '(unparseable)', note: link };
  }

  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return { pattern: '/', note: 'root' };

  const pattern = segments
    .map((seg, i) => {
      const isLast = i === segments.length - 1;
      if (isLast) return '%postname%';
      if (/^\d{4}$/.test(seg)) return '%year%';
      if (/^\d{2}$/.test(seg)) return '%monthnum% or %day%';
      if (/^\d+$/.test(seg)) return '%post_id%';
      return seg; // a literal prefix such as 'category' or 'news'
    })
    .join('/');

  const trailing = path.endsWith('/') ? ' (trailing slash)' : ' (NO trailing slash)';
  return {
    pattern: `/${pattern}/${trailing}`.replace('//', '/'),
    note: `${segments.length} path segment${segments.length === 1 ? '' : 's'} — Next route: app/${segments.length === 1 ? '[slug]' : segments.map((_, i) => (i === segments.length - 1 ? '[slug]' : '[seg' + i + ']')).join('/')}/page.tsx`,
  };
}

// --- main -------------------------------------------------------------------

function pickSite(): SiteConfig {
  const arg = process.argv[2];
  if (!arg) return DEFAULT_SITE;
  const site = getSiteByHost(arg);
  if (site === DEFAULT_SITE && !Object.keys(SITES).includes(arg.replace(/^www\./, ''))) {
    console.log(yellow(`  note: "${arg}" is not in config/sites.ts — falling back to ${DEFAULT_SITE.hostname}`));
  }
  return site;
}

async function main(): Promise<void> {
  const site = pickSite();
  const started = Date.now();

  console.log('');
  console.log(bold(`  WP RECON  ·  ${site.name}  ·  ${site.hostname}`));
  console.log(dim(`  ${site.wpApiBase}`));
  console.log(dim(`  registry: ${allSites().length} site(s) in config/sites.ts`));
  rule('═');

  // 1. Unauthenticated reachability -----------------------------------------
  heading('1. REST API reachability (no auth)');

  let probe: { total: number; totalPages: number; data: WPPost[] };
  try {
    probe = await wp<WPPost[]>(site, '/posts?per_page=1', { revalidate: 0 });
    kv('GET /posts', `${PASS()}  200 OK, no credentials sent`);
  } catch (err) {
    if (err instanceof WPError) {
      kv('GET /posts', `${FAIL()}  HTTP ${err.status}`);
      console.log('');
      console.log(red('  The REST API is not readable anonymously.'));
      console.log(
        dim(
          err.status === 401 || err.status === 403
            ? '  A security plugin is blocking it. Whitelist read access to /wp-json/wp/v2/.'
            : `  ${err.message}`,
        ),
      );
    } else {
      kv('GET /posts', `${FAIL()}  ${(err as Error).message}`);
    }
    process.exitCode = 1;
    return;
  }

  // 2. Volume ----------------------------------------------------------------
  heading('2. Content volume');
  kv('X-WP-Total', String(probe.total));
  kv('X-WP-TotalPages', `${probe.totalPages}  ${dim('(at per_page=1)')}`);
  kv('Pages at per_page=12', String(Math.ceil(probe.total / 12)));
  kv('Sitemap fetches', `${Math.ceil(probe.total / 100)}  ${dim('(per_page=100 — getAllPostSlugs must paginate)')}`);

  // 3. Permalink structure ---------------------------------------------------
  heading('3. Permalink structure (from post.link — do not invent)');

  // ARTICLE_FIELDS, not the LIST_FIELDS default: section 4 inspects
  // content.rendered, which the listing whitelist deliberately strips —
  // without this the markup verdict silently reports CLEAN on empty strings.
  const { posts: recent } = await getPosts(site, { perPage: 3, fields: ARTICLE_FIELDS });
  const sample = recent[0];

  if (!sample) {
    console.log(red('  No posts returned — cannot infer permalinks.'));
    process.exitCode = 1;
    return;
  }

  const permalink = describePermalink(site, sample.link);
  kv('Live example', sample.link);
  kv('Inferred pattern', bold(permalink.pattern));
  kv('Implication', permalink.note);

  // Confirm the shape holds across a wider sample, not just post #1.
  // Deliberately no _embed here: 100 embedded posts exceeds even the 20s
  // budget (see section 8), and this check only needs `link`.
  const { data: wideLinks } = await wp<LinkRef[]>(
    site,
    '/posts?per_page=100&_fields=link,slug,featured_media',
    { revalidate: 0 },
  );

  const segmentCounts = new Map<number, number>();
  for (const p of wideLinks) {
    try {
      const n = new URL(p.link).pathname.split('/').filter(Boolean).length;
      segmentCounts.set(n, (segmentCounts.get(n) ?? 0) + 1);
    } catch {
      /* ignore unparseable */
    }
  }
  const spread = [...segmentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([segs, n]) => `${segs} seg: ${n}`)
    .join(', ');
  kv('Across 100 posts', segmentCounts.size === 1 ? `${green('consistent')} (${spread})` : `${yellow('MIXED')} (${spread})`);

  // 4. Content markup verdict ------------------------------------------------
  heading('4. Body markup — 3 most recent posts');

  for (const [i, post] of recent.entries()) {
    const html = post.content?.rendered ?? '';
    const { verdict, hits } = classifyContent(html);

    console.log('');
    console.log(`  ${bold(`[${i + 1}]`)} ${postTitle(post).slice(0, 62)}`);
    console.log(`      ${dim('slug    ')} ${post.slug}`);
    console.log(`      ${dim('verdict ')} ${paintVerdict(verdict)}${hits.length ? dim(`  markers: ${hits.join(', ')}`) : ''}`);
    console.log(`      ${dim('length  ')} ${html.length.toLocaleString()} chars · ${readingTime(post)} min read`);
    console.log(`      ${dim('tags    ')} ${tagHistogram(html).slice(0, 100)}`);

    // Inline <script> blocks matter: they must be stripped before rendering.
    const scripts = html.match(/<script[^>]*>/gi) ?? [];
    if (scripts.length > 0) {
      const ldjson = scripts.filter((s) => s.includes('ld+json')).length;
      console.log(
        `      ${dim('scripts ')} ${yellow(`${scripts.length} inline <script>`)}${ldjson ? dim(` (${ldjson} JSON-LD — strip before render, we emit our own schema)`) : ''}`,
      );
    }
  }

  // 5. Featured images -------------------------------------------------------
  heading('5. Featured images — 3 most recent posts');

  for (const [i, post] of recent.entries()) {
    const img = getFeaturedImage(post);
    const declared = post.featured_media ?? 0;
    const label = `  [${i + 1}] ${post.slug.slice(0, 44).padEnd(46)}`;
    if (img) {
      console.log(`${label} ${green('YES')}  ${img.width}×${img.height}`);
      console.log(`      ${dim(img.url)}`);
      console.log(`      ${dim(`alt: ${img.alt.slice(0, 64) || '(empty)'}`)}`);
    } else {
      console.log(
        `${label} ${red('NO')}   ${dim(declared === 0 ? 'featured_media: 0 (none set in WP)' : `featured_media: ${declared} but _embedded['wp:featuredmedia'] absent`)}`,
      );
    }
  }

  // Coverage across a real sample, since 3 posts is not a sample size.
  const withMedia = wideLinks.filter((p) => (p.featured_media ?? 0) > 0).length;
  const { posts: embedSample } = await getPosts(site, { perPage: 20 });
  const withEmbed = embedSample.filter((p) => getFeaturedImage(p) !== null).length;

  console.log('');
  kv('featured_media set', `${withMedia} / ${wideLinks.length} posts  ${dim('(_fields sample)')}`);
  kv('resolves via _embed', `${withEmbed} / ${embedSample.length} posts  ${dim('(_embed sample)')}`);
  const pct = wideLinks.length ? Math.round((withMedia / wideLinks.length) * 100) : 0;
  kv(
    'Design implication',
    pct < 90
      ? yellow(`only ~${pct}% have images — cards NEED a no-image variant`)
      : green(`~${pct}% have images`),
  );

  // 6. Embed block shape -----------------------------------------------------
  heading(`6. _embedded block coverage / ${embedSample.length} posts`);

  const embedKeys = new Map<string, number>();
  for (const p of embedSample) {
    for (const key of Object.keys(p._embedded ?? {})) {
      embedKeys.set(key, (embedKeys.get(key) ?? 0) + 1);
    }
  }
  if (embedKeys.size === 0) {
    console.log(red('  _embedded absent entirely — helpers must tolerate this.'));
  } else {
    for (const [key, n] of [...embedKeys.entries()].sort((a, b) => b[1] - a[1])) {
      const flag =
        n === embedSample.length
          ? green('always present')
          : yellow(`${Math.round((n / embedSample.length) * 100)}% — OPTIONAL, never assume`);
      kv(key, `${String(n).padStart(3)} / ${embedSample.length}  ${flag}`);
    }
  }

  const author = getAuthor(sample);
  const primary = getPrimaryCategory(sample);
  kv('author (post 1)', author ? `${author.name} (${author.slug})` : red('none'));
  kv('primary category', primary ? `${primary.name} (${primary.slug})` : red('none'));
  kv('tags (post 1)', getTags(sample).map((t) => t.slug).join(', ').slice(0, 60) || dim('none'));
  kv('excerpt (post 1)', `"${excerptText(sample, 90)}"`);

  // 7. Categories ------------------------------------------------------------
  heading('7. Categories (hide_empty=true, all pages)');

  const cats = await getCategoriesUncached(site);
  const totalTagged = cats.reduce((n, cat) => n + cat.count, 0);
  kv('Non-empty categories', String(cats.length));
  kv('Sum of counts', `${totalTagged}  ${dim(`(posts: ${probe.total} — multi-category overlap)`)}`);

  const singletons = cats.filter((cat) => cat.count === 1).length;
  kv(
    'Categories with 1 post',
    singletons > cats.length / 2
      ? yellow(`${singletons} of ${cats.length} — long tail, do not build a nav from all of these`)
      : String(singletons),
  );

  console.log('');
  console.log(dim(`  ${'count'.padStart(6)}  ${'slug'.padEnd(30)} name`));
  const shown = cats.slice(0, 25);
  for (const cat of shown) {
    console.log(`  ${String(cat.count).padStart(6)}  ${cat.slug.slice(0, 29).padEnd(30)} ${cat.name}`);
  }
  if (cats.length > shown.length) {
    console.log(dim(`  ${'…'.padStart(6)}  ${cats.length - shown.length} more with ${shown[shown.length - 1]?.count ?? 0} posts or fewer`));
  }

  // Verify the category permalink shape too — routes will need it.
  const catLink = cats[0]?.link;
  if (catLink) {
    console.log('');
    kv('Category URL example', catLink);
    try {
      kv('Category pattern', bold(`/${new URL(catLink).pathname.split('/').filter(Boolean).slice(0, -1).join('/')}/%category%/`));
    } catch {
      /* ignore */
    }
  }

  // 8. Payload cost ----------------------------------------------------------
  heading('8. Payload cost — what a listing page can afford');

  // Mirrors REQUEST_TIMEOUT_MS in lib/wp.ts. Recon proved this origin is
  // slow cold (12 posts + _embed took 11.8s), so the timeout is 20s and
  // anything past half of it is flagged as a design constraint.
  const TIMEOUT_BUDGET_MS = 20_000;

  async function timed(label: string, path: string): Promise<void> {
    const t0 = Date.now();
    try {
      const res = await wp<unknown[]>(site, path, { revalidate: 0 });
      const ms = Date.now() - t0;
      const bytes = JSON.stringify(res.data).length;
      const over = ms > TIMEOUT_BUDGET_MS / 2;
      console.log(
        `  ${label.padEnd(26)} ${String(ms).padStart(6)}ms  ${(bytes / 1024).toFixed(0).padStart(6)} KB  ${
          over ? red(`OVER ${TIMEOUT_BUDGET_MS / 2000}s — near the ${TIMEOUT_BUDGET_MS / 1000}s wp() timeout`) : green('ok')
        }`,
      );
    } catch (err) {
      const ms = Date.now() - t0;
      const timedOut = err instanceof Error && /abort|timeout/i.test(err.message);
      console.log(
        `  ${label.padEnd(26)} ${String(ms).padStart(6)}ms  ${''.padStart(6)}     ${
          timedOut ? red(`TIMED OUT at ${TIMEOUT_BUDGET_MS / 1000}s`) : red((err as Error).message.slice(0, 40))
        }`,
      );
    }
  }

  await timed('12 posts + _embed', '/posts?per_page=12&_embed=1');
  await timed('20 posts + _embed', '/posts?per_page=20&_embed=1');
  await timed('100 posts + _embed', '/posts?per_page=100&_embed=1');
  await timed('100 posts, _fields only', '/posts?per_page=100&_fields=slug,modified,date');

  // Done ---------------------------------------------------------------------
  console.log('');
  rule('═');
  console.log(dim(`  completed in ${Date.now() - started}ms`));
  console.log('');
}

main().catch((err: unknown) => {
  console.error('');
  console.error(red(`  smoke failed: ${err instanceof Error ? err.message : String(err)}`));
  console.error('');
  process.exitCode = 1;
});
