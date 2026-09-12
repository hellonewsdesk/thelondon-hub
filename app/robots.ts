import type { MetadataRoute } from 'next';
import { getCurrentSite } from '@/lib/site';

/**
 * Crawler policy.
 *
 * Two deliberate positions here, both reversible:
 *
 * 1. **AI crawlers are explicitly ALLOWED.** GPTBot, OAI-SearchBot,
 *    PerplexityBot, ClaudeBot, Google-Extended and CCBot are named and
 *    permitted because being cited in AI search results is a visibility
 *    channel this site wants — for a title with no brand recognition, an AI
 *    answer that names you is often the only impression you get. That is a
 *    trade: it also means the content trains and grounds those systems.
 *    Flip any single line to `disallow: '/'` to opt that crawler out; the
 *    Terms already reserve the right (clause 3 forbids bulk scraping for
 *    model training without permission, which is what makes this an
 *    invitation rather than a free-for-all).
 *
 * 2. **The Next.js static chunk path is NOT disallowed.** Blocking those
 *    assets stops Google rendering the page at all, which is a self-inflicted
 *    deindexing. Only genuinely valueless paths are blocked.
 */

/** Crawlers invited specifically for AI search visibility. */
const AI_CRAWLERS = [
  'GPTBot', // OpenAI — model training + ChatGPT browsing
  'OAI-SearchBot', // OpenAI — ChatGPT Search index
  'ChatGPT-User', // OpenAI — user-initiated fetches
  'PerplexityBot', // Perplexity — answer citations
  'ClaudeBot', // Anthropic
  'Claude-Web',
  'anthropic-ai',
  'Google-Extended', // Gemini grounding (separate from Googlebot ranking)
  'Applebot-Extended', // Apple Intelligence
  'CCBot', // Common Crawl — feeds many downstream models
  'cohere-ai',
];

/**
 * Paths worth nobody's crawl budget.
 * - /search/ is an infinite query-string space (and noindex,nofollow anyway)
 * - /api/ is machine endpoints with no reader-facing content
 * - /og/ and /og-default/ are generated social images, not pages
 * - /tag/ returns 410; blocking it stops crawlers re-checking indefinitely
 */
const DISALLOW = ['/search/', '/api/', '/og/', '/og-default/', '/tag/'];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getCurrentSite();

  return {
    rules: [
      // Everything not named below.
      { userAgent: '*', allow: '/', disallow: DISALLOW },

      // Google's news and image crawlers, named explicitly so the intent is
      // unambiguous rather than inherited from the wildcard.
      { userAgent: 'Googlebot', allow: '/', disallow: DISALLOW },
      { userAgent: 'Googlebot-News', allow: '/', disallow: DISALLOW },
      { userAgent: 'Googlebot-Image', allow: '/', disallow: DISALLOW },
      { userAgent: 'Bingbot', allow: '/', disallow: DISALLOW },

      // AI crawlers — see the note above before changing any of these.
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: DISALLOW,
      })),
    ],

    // Both sitemaps explicitly: the news sitemap is a different document type
    // on a different cadence, and Google will not infer it from the index.
    sitemap: [`${site.siteUrl}/sitemap.xml`, `${site.siteUrl}/sitemap-news.xml`],
    host: site.siteUrl,
  };
}
