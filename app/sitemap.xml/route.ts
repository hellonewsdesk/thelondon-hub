import { getSiteByHost } from '@/config/sites';
import { getAllPostSlugs } from '@/lib/wp';
import { absoluteUrl } from '@/lib/urls';
import { XML_HEADERS, xmlText } from '@/lib/xml';
import { POSTS_PER_SITEMAP } from '@/lib/sitemap-config';

export const revalidate = 3600;

/**
 * Sitemap index.
 *
 * Points at chunked post sitemaps plus the category, static-page and news
 * sitemaps. An index rather than one flat file: the network's cadence crosses
 * a single-file comfort threshold within a couple of years, and re-chunking
 * later means resubmitting everything.
 *
 * No tools sitemap here — The London Hub ships no tools system.
 */
export async function GET(request: Request) {
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? undefined;
  const site = getSiteByHost(host);

  let postCount = 0;
  let newest = new Date();

  try {
    const slugs = await getAllPostSlugs(site);
    postCount = slugs.length;
    // getAllPostSlugs is newest-first, so slugs[0] is the freshest post.
    const first = slugs[0];
    if (first) {
      // WP timestamps are naive UTC — the 'Z' suffix matters.
      const d = new Date(`${first.modified}Z`);
      if (!Number.isNaN(d.getTime())) newest = d;
    }
  } catch {
    // Never fail the index outright — a partial sitemap beats a 500.
  }

  const chunks = Math.max(1, Math.ceil(postCount / POSTS_PER_SITEMAP));
  const lastmod = newest.toISOString();

  const entries: string[] = [];

  for (let i = 1; i <= chunks; i += 1) {
    entries.push(
      `  <sitemap>\n    <loc>${xmlText(
        absoluteUrl(site, `/sitemap-posts/${i}/`),
      )}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`,
    );
  }

  entries.push(
    `  <sitemap>\n    <loc>${xmlText(
      absoluteUrl(site, '/sitemap-categories.xml'),
    )}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`,
  );
  entries.push(
    `  <sitemap>\n    <loc>${xmlText(
      absoluteUrl(site, '/sitemap-pages.xml'),
    )}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`,
  );
  entries.push(
    `  <sitemap>\n    <loc>${xmlText(
      absoluteUrl(site, '/sitemap-news.xml'),
    )}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`,
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>
`;

  return new Response(xml, { headers: XML_HEADERS });
}
