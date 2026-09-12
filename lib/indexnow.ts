import type { SiteConfig } from '../config/sites';

/**
 * IndexNow — push new and updated URLs to Bing, Yandex, Seznam and Naver the
 * moment they publish, instead of waiting to be crawled.
 *
 * Google does not participate, so this is not a Google ranking mechanism; the
 * sitemaps and the WP webhook cover that side. What it buys is near-immediate
 * indexation on every other engine, which for a news site is the difference
 * between being found the same hour and the next day.
 *
 * Two hard rules:
 *   1. **Never let this break a publish.** Every failure path is caught and
 *      logged. A dead IndexNow endpoint must not turn a successful
 *      revalidation into a 500.
 *   2. **No environment variable required.** The key is derived from the
 *      hostname, and /<key>.txt is generated into public/ by the prebuild
 *      script (scripts/indexnow-keys.ts — a folder named `[key].txt` would be
 *      a literal segment in the App Router, so a route handler cannot serve
 *      it), so a clean checkout works with an empty .env.local.
 */

/** IndexNow's own cap per submission. */
const MAX_URLS_PER_BATCH = 10_000;

const ENDPOINT = 'https://api.indexnow.org/indexnow';

const TIMEOUT_MS = 5_000;

/**
 * The site's IndexNow key.
 *
 * IndexNow requires 8–128 hexadecimal characters, and the same value must be
 * served at https://<host>/<key>.txt to prove ownership. Deriving it from the
 * hostname keeps it stable across deploys and unique per tenant with no
 * secret to manage — and it is not a secret: the whole point is that it is
 * published at a public URL.
 *
 * INDEXNOW_KEY overrides it if a specific key was already registered.
 */
export function indexNowKey(site: SiteConfig): string {
  const override = process.env.INDEXNOW_KEY;
  if (override && /^[a-f0-9]{8,128}$/i.test(override)) return override;

  // FNV-1a over the hostname, expanded to 32 hex characters. Deterministic,
  // dependency-free, and never zero-length.
  let hash = 0x811c9dc5;
  const seed = `indexnow:${site.hostname}`;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  let key = '';
  let state = hash;
  while (key.length < 32) {
    state = Math.imul(state ^ (state >>> 15), 0x2545f491) >>> 0;
    key += state.toString(16).padStart(8, '0');
  }
  return key.slice(0, 32);
}

export function indexNowKeyLocation(site: SiteConfig): string {
  return `${site.siteUrl.replace(/\/+$/, '')}/${indexNowKey(site)}.txt`;
}

export interface SubmitResult {
  submitted: number;
  ok: boolean;
  status?: number;
  error?: string;
  skipped?: string;
}

/**
 * Submit absolute URLs for (re)crawl.
 *
 * Returns a result rather than throwing — callers log it and carry on. Never
 * await this in a way that can fail a request.
 */
export async function submitUrls(
  site: SiteConfig,
  urls: string[],
): Promise<SubmitResult> {
  // Deduplicate and keep only URLs on this host: IndexNow rejects a batch
  // outright if any URL is off-host, so one stray link would lose the lot.
  const host = new URL(site.siteUrl).hostname;
  const unique = [...new Set(urls)].filter((url) => {
    try {
      return new URL(url).hostname === host;
    } catch {
      return false;
    }
  });

  if (unique.length === 0) {
    return { submitted: 0, ok: true, skipped: 'no valid URLs' };
  }

  // Localhost and preview hosts cannot serve the key file at a public URL,
  // so a submission would be rejected. Skip cleanly rather than log noise.
  if (host === 'localhost' || host.endsWith('.local')) {
    return { submitted: 0, ok: true, skipped: `non-public host ${host}` };
  }

  const batch = unique.slice(0, MAX_URLS_PER_BATCH);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: indexNowKey(site),
        keyLocation: indexNowKeyLocation(site),
        urlList: batch,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });

    // 200 accepted, 202 accepted-pending-key-validation. Both are success.
    const ok = res.status === 200 || res.status === 202;
    if (!ok) {
      console.warn(`IndexNow: ${res.status} submitting ${batch.length} URL(s) for ${host}`);
    }
    return { submitted: batch.length, ok, status: res.status };
  } catch (err) {
    // Timeouts, DNS failures, endpoint outages — all non-fatal by design.
    const error = err instanceof Error ? err.message : String(err);
    console.warn(`IndexNow: submission failed for ${host} — ${error}`);
    return { submitted: 0, ok: false, error };
  }
}
