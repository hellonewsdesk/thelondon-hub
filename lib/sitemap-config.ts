/**
 * Sitemap chunking.
 *
 * Lives here rather than in a route file: Next only permits handler exports
 * (GET/POST/…) plus a fixed set of config keys from `app/**\/route.ts`, so a
 * shared constant has to sit outside the route.
 *
 * 500 per file is well inside Google's 50,000 limit and keeps each document
 * small enough to regenerate cheaply. Changing it later means resubmitting
 * every chunk URL, so treat it as fixed once live.
 *
 * Both sitemap.xml (chunk-count maths) and sitemap-posts/[n] (slice bounds)
 * import this — they must agree, which is the whole reason it is shared.
 */
export const POSTS_PER_SITEMAP = 500;
