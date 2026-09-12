import { getSiteByHost } from '@/config/sites';
import { absoluteUrl } from '@/lib/urls';
import { XML_HEADERS, xmlText } from '@/lib/xml';

export const revalidate = 86400;

/**
 * Static-page sitemap.
 *
 * MAINTAINED BY HAND: adding a static page without updating this list
 * silently omits it from the sitemap. The six entries below the homepage are
 * exactly the live WordPress pages (recon-verified 2026-09-10) — The London
 * Hub has NO /corrections/ or /editorial-policy/, so they are not listed.
 * Search is excluded too — it is noindex by design, and a noindexed URL never
 * belongs in a sitemap.
 */
const STATIC_PATHS: { path: string; priority: string; changefreq: string }[] = [
  { path: '/', priority: '1.0', changefreq: 'hourly' },
  // The full archive moves with every publish.
  { path: '/all-post/', priority: '0.6', changefreq: 'daily' },
  { path: '/about-us/', priority: '0.5', changefreq: 'yearly' },
  { path: '/contact-us/', priority: '0.5', changefreq: 'yearly' },
  { path: '/privacy-policy/', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms-conditions/', priority: '0.3', changefreq: 'yearly' },
  { path: '/disclaimer/', priority: '0.3', changefreq: 'yearly' },
];

export async function GET(request: Request) {
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? undefined;
  const site = getSiteByHost(host);

  const urls = STATIC_PATHS.map((entry) =>
    [
      '  <url>',
      `    <loc>${xmlText(absoluteUrl(site, entry.path))}</loc>`,
      `    <changefreq>${entry.changefreq}</changefreq>`,
      `    <priority>${entry.priority}</priority>`,
      '  </url>',
    ].join('\n'),
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, { headers: XML_HEADERS });
}
