/**
 * Request-scoped tenant resolution.
 *
 * `import 'server-only'` makes this a build error if it is ever pulled
 * into a client component — which is the point: it reads request headers.
 */

import 'server-only';
import { headers } from 'next/headers';
import { allSites, getSiteByHost, DEFAULT_SITE, type SiteConfig } from '../config/sites.ts';

/**
 * The site this request belongs to. Every server component calls this
 * instead of importing a site directly.
 *
 * Falls back to DEFAULT_SITE when the host header is missing or unknown,
 * which covers localhost and preview deployments.
 */
export async function getCurrentSite(): Promise<SiteConfig> {
  // Single-tenant deployment: there is nothing to resolve, and reading
  // headers() would opt EVERY route out of static/ISR rendering — forcing a
  // full server render (and a cold WordPress round trip) per visitor. Only
  // consult the Host header once a second site is registered.
  if (allSites().length === 1) return DEFAULT_SITE;

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  return getSiteByHost(host);
}
