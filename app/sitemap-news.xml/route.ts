import { getSiteByHost } from '@/config/sites';
import { getRecentPostsForNewsSitemap } from '@/lib/wp';
import { postTitle } from '@/lib/wp-helpers';
import { absoluteUrl, postPath } from '@/lib/urls';
import { XML_HEADERS, xmlText } from '@/lib/xml';
import { parseWpDate } from '@/lib/format';

// Short window: a news sitemap that is an hour stale is useless. The data
// fetch underneath passes the same 600s window (see
// getRecentPostsForNewsSitemap in lib/wp.ts) so this route never
// re-serializes a stale response.
export const revalidate = 600;

/**
 * Google News sitemap.
 *
 * Strict 48-hour window and a 1000-URL cap, per Google's specification —
 * anything older is ignored and an oversized file is rejected outright.
 */
export async function GET(request: Request) {
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? undefined;
  const site = getSiteByHost(host);

  let posts: Awaited<ReturnType<typeof getRecentPostsForNewsSitemap>> = [];
  try {
    posts = await getRecentPostsForNewsSitemap(site, 48);
  } catch {
    posts = [];
  }

  const language = site.locale.split('-')[0] ?? 'en';

  const urls = posts
    .map((post) => {
      const loc = absoluteUrl(site, postPath(post.slug));
      const published = parseWpDate(post.date);
      if (!published) return '';

      return [
        '  <url>',
        `    <loc>${xmlText(loc)}</loc>`,
        '    <news:news>',
        '      <news:publication>',
        `        <news:name>${xmlText(site.name)}</news:name>`,
        `        <news:language>${xmlText(language)}</news:language>`,
        '      </news:publication>',
        `      <news:publication_date>${published.toISOString()}</news:publication_date>`,
        `      <news:title>${xmlText(postTitle(post))}</news:title>`,
        '    </news:news>',
        '  </url>',
      ].join('\n');
    })
    .filter(Boolean)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: {
      ...XML_HEADERS,
      'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600',
    },
  });
}
