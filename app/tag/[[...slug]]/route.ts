/**
 * /tag/* — 410 Gone, permanently and on purpose.
 *
 * WordPress generated tag archives and some may sit in Google's index from
 * the WP era. This frontend deliberately builds no tag routes: 105 posts
 * carry 517 tags (recon 2026-09-10), and tag pages would be thin-content
 * sprawl far worse than the long tail of single-post categories. Tags still
 * do useful work internally — related-post scoring and NewsArticle
 * `keywords` — they just never get URLs.
 *
 * 410 rather than 404: it tells crawlers the removal is intentional and
 * final, which drops the URLs from the index faster and stops recrawl. The
 * optional catch-all covers /tag/, /tag/x/ and any depth below. /tag/ is
 * also in the robots.ts disallow list — remove BOTH together if tag pages
 * are ever built (a live page behind a disallow is deindexed).
 */

const GONE_BODY =
  'Gone. Tag archives are not published on this site. Browse sections at /category/ instead.';

function gone(): Response {
  return new Response(GONE_BODY, {
    status: 410,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Nothing here will ever change; let intermediaries remember that.
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      'X-Robots-Tag': 'noindex',
    },
  });
}

export async function GET(): Promise<Response> {
  return gone();
}

/** Crawlers probe with HEAD; answer it explicitly. */
export async function HEAD(): Promise<Response> {
  return gone();
}
