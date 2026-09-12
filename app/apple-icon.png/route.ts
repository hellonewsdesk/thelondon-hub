import { getSiteByHost } from '@/config/sites';
import { siteIconSvg, toArrayBuffer } from '@/lib/site-icon';
import { svgToPng } from '@/lib/rasterise';

/**
 * The iOS home-screen icon, per tenant.
 *
 * 180x180 because that is what current iPhones ask for, and iOS will not take
 * an SVG here however modern the device. iOS applies its own corner radius, so
 * the mark stays full-bleed and square — matching the site's global
 * zero-radius rule.
 */
export const dynamic = 'force-dynamic';

const SIZE = 180;

export async function GET(request: Request): Promise<Response> {
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? undefined;
  const site = getSiteByHost(host);

  const png = await svgToPng(siteIconSvg(site), SIZE);

  // No raster available: 404 rather than a broken image. iOS falls back to a
  // screenshot of the page, which is poor but not wrong.
  if (!png) return new Response('Icon unavailable', { status: 404 });

  return new Response(toArrayBuffer(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control':
        'public, max-age=0, must-revalidate, s-maxage=604800, stale-while-revalidate=2592000',
    },
  });
}
