import { getSiteByHost } from '@/config/sites';
import { getCategories } from '@/lib/wp-cache';
import { absoluteUrl, categoryPath } from '@/lib/urls';
import { isCategoryIndexable } from '@/lib/seo';
import { XML_HEADERS, xmlText } from '@/lib/xml';

export const revalidate = 86400;

/**
 * Category sitemap — INDEXABLE categories only.
 *
 * Same gate as the category pages themselves (isCategoryIndexable): curated
 * taxonomy AND depth. That predicate also excludes 'google-news' — the
 * 32-post syndication meta-category whose URL resolves but never earns an
 * index slot. Submitting a noindexed URL would ask Google to index pages we
 * deliberately marked noindex, which is a contradictory signal and wastes
 * crawl budget — seo:check treats it as a hard error.
 */
export async function GET(request: Request) {
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? undefined;
  const site = getSiteByHost(host);

  let categories: Awaited<ReturnType<typeof getCategories>> = [];
  try {
    categories = await getCategories(site);
  } catch {
    categories = [];
  }

  const indexable = categories.filter((c) => isCategoryIndexable(site, c));

  const urls = indexable
    .map((category) =>
      [
        '  <url>',
        `    <loc>${xmlText(absoluteUrl(site, categoryPath(category.slug)))}</loc>`,
        '    <changefreq>daily</changefreq>',
        `    <priority>${category.count >= 20 ? '0.8' : '0.6'}</priority>`,
        '  </url>',
      ].join('\n'),
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, { headers: XML_HEADERS });
}
