/**
 * Request-scoped tenant resolution.
 *
 * `import 'server-only'` makes this a build error if it is ever pulled
 * into a client component — which is the point: it reads request headers.
 */

import 'server-only';
import { headers } from 'next/headers';
import { getSiteByHost, type SiteConfig } from '../config/sites.ts';

/**
 * The site this request belongs to. Every server component calls this
 * instead of importing a site directly.
 *
 * Falls back to DEFAULT_SITE when the host header is missing or unknown,
 * which covers localhost and preview deployments.
 */
export async function getCurrentSite(): Promise<SiteConfig> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  return getSiteByHost(host);
}
