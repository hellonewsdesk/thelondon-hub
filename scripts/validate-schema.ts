/**
 * Structured-data validator — `npm run seo:schema`.
 *
 * Fetches built pages from a running production server, extracts every
 * JSON-LD block, and asserts the invariants that matter. Exits non-zero on
 * any hard error so it can gate a deploy.
 *
 * Why a crawler rather than unit tests on the builders: the failure mode this
 * catches is not "the builder returns the wrong shape" — it is "two
 * NewsArticle blocks ended up on the page", "the inbound WP JSON-LD came
 * back", "an @id points at a node that isn't there". Those only exist in the
 * assembled document. (Every post on this WP install carries 2 inline JSON-LD
 * <script> blocks — recon-verified — so the sanitiser regression is live.)
 *
 * Usage:
 *   npm run build && npm run start
 *   npm run seo:schema
 *   SEO_BASE_URL=http://localhost:3200 npm run seo:schema
 */

import { DEFAULT_SITE } from '../config/sites.ts';

const BASE = (process.env.SEO_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

interface Problem {
  page: string;
  severity: 'error' | 'warn';
  message: string;
}

const problems: Problem[] = [];

function fail(page: string, message: string) {
  problems.push({ page, severity: 'error', message });
}
function warn(page: string, message: string) {
  problems.push({ page, severity: 'warn', message });
}

type Json = Record<string, unknown>;

/** Every JSON-LD block in a document, parsed. */
function extractBlocks(html: string, page: string): Json[] {
  const out: Json[] = [];
  const pattern =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    // <JsonLd> escapes `<` as < to prevent tag breakout; undo for parsing.
    const raw = match[1].replace(/\\u003c/g, '<');
    try {
      const parsed = JSON.parse(raw) as Json;
      out.push(parsed);
    } catch (err) {
      fail(page, `invalid JSON-LD: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}

/** Flatten @graph containers so type checks see every node. */
function flatten(blocks: Json[]): Json[] {
  const nodes: Json[] = [];
  for (const block of blocks) {
    const graph = block['@graph'];
    if (Array.isArray(graph)) {
      for (const node of graph) nodes.push(node as Json);
    } else {
      nodes.push(block);
    }
  }
  return nodes;
}

const typeOf = (node: Json): string =>
  typeof node['@type'] === 'string' ? (node['@type'] as string) : '?';

function isIsoWithOffset(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (Number.isNaN(Date.parse(value))) return false;
  // Must carry a zone: trailing Z or ±HH:MM.
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
}

async function getHtml(path: string): Promise<string | null> {
  try {
    const res = await fetch(BASE + path, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      fail(path, `HTTP ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    fail(path, `fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** Newest article slugs, straight from the site's own feed. */
async function discoverArticles(limit: number): Promise<string[]> {
  const html = await getHtml('/feed.xml');
  if (!html) return [];
  const links = [...html.matchAll(/<link>([^<]+)<\/link>/g)]
    .map((m) => m[1])
    .filter((u) => !u.endsWith('/feed.xml'));
  const paths: string[] = [];
  for (const link of links) {
    try {
      const { pathname } = new URL(link);
      if (pathname !== '/' && !paths.includes(pathname)) paths.push(pathname);
    } catch {
      /* ignore */
    }
    if (paths.length >= limit) break;
  }
  return paths;
}

// ---------------------------------------------------------------------------

async function checkArticle(path: string): Promise<void> {
  const html = await getHtml(path);
  if (!html) return;

  const blocks = extractBlocks(html, path);
  const nodes = flatten(blocks);

  // 1. Exactly one NewsArticle. Two would be a Rich Results conflict, and a
  //    second one appearing is the signature of inbound WP JSON-LD surviving
  //    the sanitiser.
  const articles = nodes.filter((n) => typeOf(n) === 'NewsArticle');
  if (articles.length !== 1) {
    fail(path, `expected exactly 1 NewsArticle, found ${articles.length}`);
    return;
  }
  const article = articles[0];

  // 2. Required properties.
  for (const prop of ['headline', 'datePublished', 'dateModified', 'image', 'author', 'publisher', 'mainEntityOfPage']) {
    if (article[prop] === undefined) fail(path, `NewsArticle missing "${prop}"`);
  }

  // 3. Headline length — Google drops the rich result above 110 chars.
  const headline = article.headline;
  if (typeof headline === 'string' && headline.length > 110) {
    fail(path, `headline is ${headline.length} chars (max 110)`);
  }

  // 4. Dates parse AND carry a timezone offset.
  for (const prop of ['datePublished', 'dateModified']) {
    if (!isIsoWithOffset(article[prop])) {
      fail(path, `${prop} is not ISO 8601 with an offset: ${String(article[prop])}`);
    }
  }

  // 5. Breadcrumbs present and ordered from 1.
  const crumbs = nodes.find((n) => typeOf(n) === 'BreadcrumbList');
  if (!crumbs) {
    fail(path, 'no BreadcrumbList');
  } else {
    const items = crumbs.itemListElement;
    if (!Array.isArray(items) || items.length === 0) {
      fail(path, 'BreadcrumbList has no items');
    } else {
      items.forEach((item, i) => {
        const pos = (item as Json).position;
        if (pos !== i + 1) fail(path, `BreadcrumbList position ${String(pos)} at index ${i}`);
      });
    }
  }

  // 6. The publisher reference must resolve to the Organization node the root
  //    layout declares — a dangling @id is a broken graph.
  const publisher = article.publisher as Json | undefined;
  const publisherId = publisher?.['@id'];
  const org = nodes.find((n) => typeOf(n) === 'NewsMediaOrganization');
  if (!org) {
    fail(path, 'no NewsMediaOrganization node on the page');
  } else if (publisherId !== org['@id']) {
    fail(path, `publisher @id "${String(publisherId)}" does not match the Organization node`);
  }

  // 7. No duplicate @ids anywhere in the document.
  const ids = nodes.map((n) => n['@id']).filter((v): v is string => typeof v === 'string');
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) fail(path, `duplicate @id: ${[...new Set(dupes)].join(', ')}`);

  // 8. FAQPage, if present, must carry real questions.
  const faq = nodes.find((n) => typeOf(n) === 'FAQPage');
  if (faq) {
    const qs = faq.mainEntity;
    if (!Array.isArray(qs) || qs.length < 2) {
      fail(path, 'FAQPage present with fewer than 2 questions');
    } else {
      for (const q of qs) {
        const name = (q as Json).name;
        if (typeof name !== 'string' || !name.trim().endsWith('?')) {
          fail(path, `FAQPage question is not a question: "${String(name).slice(0, 60)}"`);
        }
      }
    }
  }
}

async function checkHome(): Promise<void> {
  const path = '/';
  const html = await getHtml(path);
  if (!html) return;

  const nodes = flatten(extractBlocks(html, path));

  const org = nodes.find((n) => typeOf(n) === 'NewsMediaOrganization');
  if (!org) {
    fail(path, 'no NewsMediaOrganization');
  } else {
    // Structural properties every publisher node can truthfully carry.
    for (const prop of ['masthead', 'logo']) {
      if (org[prop] === undefined) fail(path, `NewsMediaOrganization missing "${prop}"`);
    }

    // The E-E-A-T policy properties justify the NewsMediaOrganization type,
    // but each needs a REAL page to point at, and this WP install has no
    // corrections or editorial-policy page (recon-verified 2026-09-10).
    // Absent policy props therefore WARN rather than fail: inventing a URL
    // to satisfy the checker is the one thing this project never does.
    // Flip any of these to `fail` the day its page exists.
    for (const prop of [
      'publishingPrinciples',
      'correctionsPolicy',
      'ethicsPolicy',
      'diversityPolicy',
      'actionableFeedbackPolicy',
    ]) {
      if (org[prop] === undefined) {
        warn(path, `NewsMediaOrganization missing "${prop}" — add it once a real policy page exists`);
      }
    }

    // Logo needs real dimensions; Google requires >=112x112.
    const logo = org.logo as Json | undefined;
    const w = Number(logo?.width);
    const h = Number(logo?.height);
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      fail(path, 'logo has no numeric width/height');
    } else if (w < 112) {
      warn(path, `logo is ${w}x${h}; Google prefers at least 112px on the short side`);
    }
  }

  const website = nodes.find((n) => typeOf(n) === 'WebSite');
  if (!website) fail(path, 'no WebSite node');
  else if (!website.potentialAction) fail(path, 'WebSite has no SearchAction');

  const list = nodes.find((n) => typeOf(n) === 'ItemList');
  if (!list) warn(path, 'no ItemList of headlines');
}

async function checkCategory(path: string): Promise<void> {
  const html = await getHtml(path);
  if (!html) return;

  const nodes = flatten(extractBlocks(html, path));
  const collection = nodes.find((n) => typeOf(n) === 'CollectionPage');
  if (!collection) {
    fail(path, 'no CollectionPage');
    return;
  }
  const main = collection.mainEntity as Json | undefined;
  if (!main || main['@type'] !== 'ItemList') {
    warn(path, 'CollectionPage has no ItemList of visible posts');
  }
  if (!nodes.some((n) => typeOf(n) === 'BreadcrumbList')) fail(path, 'no BreadcrumbList');
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('');
  console.log(`  SCHEMA VALIDATION · ${BASE}`);
  console.log('  ' + '═'.repeat(70));

  const articles = await discoverArticles(5);
  const category = `/category/${DEFAULT_SITE.homepageSections[0]}/`;

  await checkHome();
  await checkCategory(category);
  for (const path of articles) await checkArticle(path);

  const checked = 2 + articles.length;
  const errors = problems.filter((p) => p.severity === 'error');
  const warns = problems.filter((p) => p.severity === 'warn');

  console.log(`  pages checked : ${checked} (home, ${category}, ${articles.length} articles)`);
  console.log('  ' + '─'.repeat(70));

  if (problems.length === 0) {
    console.log('  All structured-data checks passed.');
  } else {
    for (const p of problems) {
      console.log(`  ${p.severity === 'error' ? 'FAIL' : 'WARN'}  ${p.page.slice(0, 40).padEnd(42)} ${p.message}`);
    }
  }

  console.log('  ' + '─'.repeat(70));
  console.log(`  ${errors.length} error(s) · ${warns.length} warning(s)`);
  console.log('');

  if (errors.length > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(`  seo:schema failed to run: ${err instanceof Error ? err.message : String(err)}`);
  console.error(`  Is a production server listening at ${BASE}?`);
  process.exitCode = 1;
});
