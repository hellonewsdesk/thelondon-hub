import { getSiteByHost } from '@/config/sites';
import { getAllPostSlugs } from '@/lib/wp';
import { absoluteUrl, postPath } from '@/lib/urls';
import { XML_HEADERS, xmlText } from '@/lib/xml';
import { parseWpDate } from '@/lib/format';
import { POSTS_PER_SITEMAP } from '@/lib/sitemap-config';

export const revalidate = 3600;

/**
 * One chunk of post URLs, 500 per file, served at /sitemap-posts/<n>/.
 *
 * NOTE ON THE PATH: the App Router only treats a WHOLE path segment as
 * dynamic, so a folder named `sitemap-posts-[n].xml` is a literal string and
 * yields no params. Hence `/sitemap-posts/[n]/` rather than
 * `/sitemap-posts-1.xml`. Google accepts any URL as a sitemap location
 * provided the Content-Type is XML.
 *
 * `lastmod` is the real `modified` timestamp from WordPress — a sitemap that
 * lies about freshness trains Google to ignore the signal entirely.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ n: string }> },
) {
  const { n } = await params;
  const chunk = Math.max(1, Number.parseInt(n, 10) || 1);

  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? undefined;
  const site = getSiteByHost(host);

  let slugs: Awaited<ReturnType<typeof getAllPostSlugs>> = [];
  try {
    slugs = await getAllPostSlugs(site);
  } catch {
    slugs = [];
  }

  const start = (chunk - 1) * POSTS_PER_SITEMAP;
  const page = slugs.slice(start, start + POSTS_PER_SITEMAP);

  if (page.length === 0) {
    return new Response('Not found', { status: 404 });
  }

  const urls = page
    .map((ref) => {
      const loc = absoluteUrl(site, postPath(ref.slug));
      const modified = parseWpDate(ref.modified) ?? parseWpDate(ref.date);
      return [
        '  <url>',
        `    <loc>${xmlText(loc)}</loc>`,
        modified ? `    <lastmod>${modified.toISOString()}</lastmod>` : '',
        '    <changefreq>monthly</changefreq>',
        '    <priority>0.7</priority>',
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, { headers: XML_HEADERS });
}
