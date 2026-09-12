import { getSiteByHost } from '@/config/sites';
import { siteIconSvg } from '@/lib/site-icon';

/**
 * The primary favicon: SVG, resolved per tenant from the Host header.
 *
 * Dynamic because tenancy is — a static file in public/ would hand every
 * tenant the same mark. Cheap to serve: the body is a few hundred bytes of
 * markup generated from config (lib/site-icon.ts — the "H." on the brand's
 * near-black chrome), with no I/O behind it.
 *
 * Every browser in current service prefers `image/svg+xml` when the document
 * offers it, so this is the one most readers actually see. The PNG and ICO
 * beside it exist for iOS and for clients that ask for /favicon.ico blind.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? undefined;
  const site = getSiteByHost(host);

  return new Response(siteIconSvg(site), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // The mark only changes on a deploy, and a favicon is re-requested on
      // every navigation — so this is one of the few responses on the site
      // that genuinely wants a long shared cache.
      'Cache-Control':
        'public, max-age=0, must-revalidate, s-maxage=604800, stale-while-revalidate=2592000',
    },
  });
}
