import { getSiteByHost } from '@/config/sites';
import { pngToIco, siteIconSvg, toArrayBuffer } from '@/lib/site-icon';
import { svgToPng } from '@/lib/rasterise';

/**
 * /favicon.ico, per tenant.
 *
 * The document declares an SVG icon that every current browser prefers, so
 * almost nothing reaches this route — but crawlers still request /favicon.ico
 * without reading the markup first, and Google renders a favicon beside
 * mobile search results. For a site whose whole point is ranking, that is a
 * poor thing to answer with a 404.
 *
 * Answers with a real ICO (one embedded 32x32 PNG), not a PNG mislabelled as
 * an icon.
 */
export const dynamic = 'force-dynamic';

const SIZE = 32;

export async function GET(request: Request): Promise<Response> {
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? undefined;
  const site = getSiteByHost(host);

  const png = await svgToPng(siteIconSvg(site), SIZE);
  if (!png) return new Response('Icon unavailable', { status: 404 });

  return new Response(toArrayBuffer(pngToIco(png, SIZE)), {
    headers: {
      'Content-Type': 'image/x-icon',
      'Cache-Control':
        'public, max-age=0, must-revalidate, s-maxage=604800, stale-while-revalidate=2592000',
    },
  });
}
