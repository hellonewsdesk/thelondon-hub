import { revalidatePath, revalidateTag } from 'next/cache';
import { getSiteByHost } from '@/config/sites';
import { absoluteUrl, categoryPath, postPath } from '@/lib/urls';
import { submitUrls } from '@/lib/indexnow';

export const dynamic = 'force-dynamic';

/**
 * On-demand ISR webhook.
 *
 * Without this, a story published in WordPress waits up to 3h for the ISR
 * window. WordPress calls this on `transition_post_status` (see
 * snippets/wp-webhook.php) and the article is live in seconds.
 *
 * Auth is a bearer token compared in constant time. The route is POST-only
 * and returns no information about why a request failed beyond the status.
 *
 * The tag vocabulary here (`posts`, `slugs`, `homepage`, `post:<slug>`,
 * `category:<x>`, site-scoped as `<site.key>:<name>`) must exactly match
 * what lib/wp.ts and lib/homepage.ts tag their fetches with — change both
 * sides together or revalidation silently stops working.
 */

interface RevalidateBody {
  slug?: unknown;
  categories?: unknown;
}

/**
 * Constant-time comparison. A plain `===` on a secret leaks its length and
 * prefix through timing, which is cheap to avoid.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function unauthorized(): Response {
  return Response.json(
    { revalidated: false, message: 'Unauthorized' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;

  // An unset secret must fail closed, never open.
  if (!secret) {
    return Response.json(
      { revalidated: false, message: 'Revalidation is not configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || !safeEqual(token, secret)) return unauthorized();

  let body: RevalidateBody;
  try {
    body = (await request.json()) as RevalidateBody;
  } catch {
    return Response.json(
      { revalidated: false, message: 'Invalid JSON body' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const categories = Array.isArray(body.categories)
    ? body.categories.filter(
        (c): c is string | number => typeof c === 'string' || typeof c === 'number',
      )
    : [];

  if (!slug && categories.length === 0) {
    return Response.json(
      { revalidated: false, message: 'Provide `slug` and/or `categories`' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? undefined;
  const site = getSiteByHost(host);

  const revalidated: string[] = [];

  // Tags are site-scoped in lib/wp.ts, so one tenant can never flush another.
  const tag = (name: string) => {
    revalidateTag(`${site.key}:${name}`);
    revalidated.push(`${site.key}:${name}`);
  };

  tag('posts');
  tag('slugs');
  // The front page is composed and cached separately (lib/homepage.ts), so it
  // needs its own bust or a newly published story would wait out the
  // 15-minute window.
  tag('homepage');
  if (slug) tag(`post:${slug}`);
  for (const category of categories) tag(`category:${category}`);

  // The front page is a rendered route, not a data tag.
  revalidatePath('/');
  revalidated.push('path:/');

  if (slug) {
    revalidatePath(postPath(slug));
    revalidated.push(`path:${postPath(slug)}`);
  }

  // ---- IndexNow -----------------------------------------------------------
  // Push the article, its category pages and the front page for immediate
  // recrawl by Bing/Yandex/Seznam/Naver. Awaited so the result can be
  // reported, but submitUrls never throws — a dead IndexNow endpoint must not
  // turn a successful publish into a 500.
  const indexNowUrls = [absoluteUrl(site, '/')];
  if (slug) indexNowUrls.push(absoluteUrl(site, postPath(slug)));
  for (const category of categories) {
    // Only slug-form categories are URLs; the webhook also sends term ids.
    if (typeof category === 'string' && !/^\d+$/.test(category)) {
      indexNowUrls.push(absoluteUrl(site, categoryPath(category)));
    }
  }

  const indexNow = await submitUrls(site, indexNowUrls);

  return Response.json(
    {
      revalidated: true,
      site: site.key,
      now: Date.now(),
      entries: revalidated,
      indexNow,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Everything except POST is rejected, with an explicit Allow header. */
export async function GET(): Promise<Response> {
  return Response.json(
    { message: 'Method not allowed. POST with a Bearer token.' },
    { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } },
  );
}
