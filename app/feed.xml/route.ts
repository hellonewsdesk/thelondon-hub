import { getSiteByHost } from '@/config/sites';
import { getPosts } from '@/lib/wp';
import {
  excerptText,
  getAuthor,
  getFeaturedImage,
  getPrimaryCategory,
  postTitle,
} from '@/lib/wp-helpers';
import { absoluteUrl, postPath } from '@/lib/urls';
import { cdata, XML_HEADERS, xmlText } from '@/lib/xml';
import { parseWpDate } from '@/lib/format';

export const revalidate = 3600;

/**
 * RSS 2.0.
 *
 * WordPress served this at /feed/, which next.config.ts 308s here, so any
 * existing subscriber keeps working. Item bodies are the excerpt, not the
 * full text — a full-text feed cannibalises the pageviews the site runs on.
 */
export async function GET(request: Request) {
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? undefined;
  const site = getSiteByHost(host);

  // The fetch window matches this route's own revalidate — recomposing an
  // hourly feed over 3h-cached fetches would silently serve stale items.
  // A failed origin degrades to an empty channel, never a 500.
  let posts: Awaited<ReturnType<typeof getPosts>>['posts'] = [];
  try {
    ({ posts } = await getPosts(site, { perPage: 20, revalidate: 3600 }));
  } catch {
    posts = [];
  }

  const self = absoluteUrl(site, '/feed.xml');
  const home = absoluteUrl(site, '/');
  const lastBuild = new Date().toUTCString();

  const items = posts
    .map((post) => {
      const url = absoluteUrl(site, postPath(post.slug));
      const published = parseWpDate(post.date);
      const category = getPrimaryCategory(post);
      const author = getAuthor(post);
      const image = getFeaturedImage(post);

      return [
        '    <item>',
        `      <title>${cdata(postTitle(post))}</title>`,
        `      <link>${xmlText(url)}</link>`,
        `      <guid isPermaLink="true">${xmlText(url)}</guid>`,
        published ? `      <pubDate>${published.toUTCString()}</pubDate>` : '',
        category ? `      <category>${cdata(category.name)}</category>` : '',
        author ? `      <dc:creator>${cdata(author.name)}</dc:creator>` : '',
        `      <description>${cdata(excerptText(post, 300))}</description>`,
        image
          ? `      <enclosure url="${xmlText(image.url)}" type="image/jpeg" length="0" />`
          : '',
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${cdata(site.name)}</title>
    <link>${xmlText(home)}</link>
    <description>${cdata(site.tagline)}</description>
    <language>${xmlText(site.locale.toLowerCase())}</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <ttl>180</ttl>
    <atom:link href="${xmlText(self)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, { headers: XML_HEADERS });
}
